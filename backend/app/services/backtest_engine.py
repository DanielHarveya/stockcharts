import asyncio
import statistics
from datetime import datetime, date, timedelta, time as dtime
from typing import List, Dict, Any, Optional, Callable, Awaitable
from collections import defaultdict

from app.schemas import (
    Strategy,
    BacktestConfig,
    BacktestResult,
    LegResult,
    Greeks,
    StrategyLeg,
    TradeEvent,
    CapitalState,
    AnalyticsSummary,
    DataValidationResult,
)
from app.services.db_service import get_ohlc_data, get_instrument_details
from app.services.greeks import calculate_iv, calculate_greeks, calculate_greeks_for_non_option
from app.services.data_validator import validate_ohlc_data


class LegState:
    """Tracks the runtime state of a single strategy leg during backtesting."""

    __slots__ = (
        "leg", "entry_price", "exit_price", "current_price",
        "is_active", "pnl", "direction", "greeks_dict",
        "state", "exit_reason", "sl_level", "target_level",
    )

    def __init__(self, leg: StrategyLeg):
        self.leg = leg
        self.entry_price: Optional[float] = None
        self.exit_price: Optional[float] = None
        self.current_price: float = 0.0
        self.is_active: bool = True
        self.pnl: float = 0.0
        self.direction: int = 1 if leg.action == "BUY" else -1
        self.greeks_dict: Dict[str, float] = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
        self.state: str = "WAITING"
        self.exit_reason: str = "active"
        self.sl_level: Optional[float] = None
        self.target_level: Optional[float] = None


class BacktestEngine:
    """Core backtesting engine that replays OHLC data against a strategy."""

    def __init__(
        self,
        strategy: Strategy,
        config: BacktestConfig,
    ):
        self.strategy = strategy
        self.config = config
        self.status: str = "idle"
        self.results: List[BacktestResult] = []
        self.leg_states: Dict[str, LegState] = {}
        self.events: List[TradeEvent] = []
        self.data_validation: Optional[DataValidationResult] = None
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # not paused initially
        self._callback: Optional[Callable[[BacktestResult], Awaitable[None]]] = None

    def set_callback(self, callback: Callable[[BacktestResult], Awaitable[None]]) -> None:
        """Set an async callback to be invoked for each result tick."""
        self._callback = callback

    def _calc_slippage(self, price: float) -> float:
        """Calculate slippage amount based on execution config."""
        exec_config = self.config.execution
        if exec_config.slippage_model == "fixed":
            return exec_config.slippage_value
        elif exec_config.slippage_model == "percent":
            return price * exec_config.slippage_value / 100.0
        return 0.0

    def _check_entry_condition(self, candle_close: float) -> bool:
        """Check if entry condition is met."""
        ec = self.config.entry_conditions
        if ec.condition_type == "immediate":
            return True
        if ec.condition_type == "price_above" and ec.value is not None:
            return candle_close >= ec.value
        if ec.condition_type == "price_below" and ec.value is not None:
            return candle_close <= ec.value
        if ec.condition_type == "iv_above" and ec.value is not None:
            # IV-based conditions would need IV data; for now treat as immediate
            return True
        if ec.condition_type == "iv_below" and ec.value is not None:
            return True
        return True

    async def run(self) -> None:
        """
        Main backtest loop:
        1. Load all OHLC data
        2. Validate data quality
        3. Iterate candle by candle
        4. Track entry, SL, target, PnL, Greeks
        5. Apply slippage, time exits, risk limits, capital tracking
        """
        self.status = "running"
        self.results = []
        self.events = []

        # Initialize leg states
        for leg in self.strategy.legs:
            self.leg_states[leg.id] = LegState(leg)

        # Collect instrument tokens
        instrument_tokens = list({leg.instrument_token for leg in self.strategy.legs})

        # Load OHLC data
        try:
            raw_data = get_ohlc_data(
                instrument_tokens=instrument_tokens,
                start_date=self.config.start_date,
                end_date=self.config.end_date,
            )
        except Exception as exc:
            self.status = "stopped"
            raise RuntimeError(f"Failed to load OHLC data: {exc}")

        # Validate data
        self.data_validation = validate_ohlc_data(raw_data, instrument_tokens)

        if not raw_data:
            self.status = "completed"
            return

        # Build per-token candle lookup: {token: {datetime: candle_dict}}
        candles_by_token: Dict[Any, Dict[datetime, Dict[str, Any]]] = defaultdict(dict)
        all_timestamps = set()
        for candle in raw_data:
            dt = candle["datetime"]
            if isinstance(dt, str):
                dt = datetime.fromisoformat(dt)
            candles_by_token[candle["instrument_token"]][dt] = candle
            all_timestamps.add(dt)

        sorted_timestamps = sorted(all_timestamps)

        # Parse entry time
        entry_h, entry_m = map(int, self.config.entry_time.split(":"))
        entry_time = dtime(entry_h, entry_m)

        # Parse exit time if configured
        exit_time: Optional[dtime] = None
        exit_config = self.config.exit_config
        if exit_config.exit_time:
            exit_h, exit_m = map(int, exit_config.exit_time.split(":"))
            exit_time = dtime(exit_h, exit_m)

        # Risk config
        risk = self.config.risk

        # Capital tracking
        initial_capital = self.config.capital.initial_capital
        peak_capital = initial_capital
        peak_pnl: float = 0.0

        # Pre-fetch instrument details for Greeks calculation
        instrument_info: Dict[str, Dict[str, Any]] = {}
        for leg in self.strategy.legs:
            if leg.option_type in ("CE", "PE"):
                info = get_instrument_details(leg.instrument_token)
                if info:
                    instrument_info[leg.id] = info

        # Determine interval for display ticks
        interval = self.config.interval_minutes

        # Track which timestamps are display ticks
        tick_count = 0

        for ts in sorted_timestamps:
            # Check stopped
            if self.status == "stopped":
                break

            # Check paused - wait until resumed
            await self._pause_event.wait()

            if self.status == "stopped":
                break

            candle_time = ts.time() if isinstance(ts, datetime) else ts
            tick_events: List[TradeEvent] = []

            # Process each leg at this timestamp
            for leg_id, state in self.leg_states.items():
                leg = state.leg
                token_candles = candles_by_token.get(leg.instrument_token, {})
                candle = token_candles.get(ts)

                if candle is None:
                    continue

                candle_close = candle["close"]
                candle_high = candle["high"]
                candle_low = candle["low"]

                # Entry logic: first candle at or after entry_time
                if state.entry_price is None:
                    if candle_time >= entry_time:
                        # Check entry condition
                        if not self._check_entry_condition(candle_close):
                            continue

                        # Apply slippage
                        slippage = self._calc_slippage(candle_close)
                        if state.direction == 1:  # BUY
                            state.entry_price = candle_close + slippage
                        else:  # SELL
                            state.entry_price = candle_close - slippage

                        state.current_price = candle_close
                        state.pnl = 0.0
                        state.state = "ENTERED"

                        # Compute SL/Target levels
                        if leg.sl is not None and leg.sl > 0:
                            if state.direction == 1:
                                state.sl_level = state.entry_price - leg.sl
                            else:
                                state.sl_level = state.entry_price + leg.sl

                        if leg.target is not None and leg.target > 0:
                            if state.direction == 1:
                                state.target_level = state.entry_price + leg.target
                            else:
                                state.target_level = state.entry_price - leg.target

                        entry_event = TradeEvent(
                            timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                            event_type="ENTRY",
                            leg_id=leg_id,
                            symbol=leg.symbol,
                            details=f"{leg.action} {leg.quantity} @ {state.entry_price:.2f} (slippage={slippage:.2f})",
                            price=state.entry_price,
                            pnl=0.0,
                        )
                        tick_events.append(entry_event)
                        self.events.append(entry_event)
                    continue

                if not state.is_active:
                    # Leg is frozen (SL/Target/Exit hit)
                    continue

                # Update current price
                state.current_price = candle_close

                # SL/Target checks on intracandle prices
                sl_hit = False
                target_hit = False

                if state.leg.sl is not None and state.leg.sl > 0:
                    if state.direction == 1:
                        sl_level = state.entry_price - state.leg.sl
                        if candle_low <= sl_level:
                            state.exit_price = sl_level
                            state.current_price = sl_level
                            state.is_active = False
                            state.state = "EXITED"
                            state.exit_reason = "stop_loss"
                            state.pnl = (state.exit_price - state.entry_price) * state.leg.quantity * state.direction
                            sl_hit = True
                            sl_event = TradeEvent(
                                timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                                event_type="SL_HIT",
                                leg_id=leg_id,
                                symbol=leg.symbol,
                                details=f"SL hit @ {sl_level:.2f}",
                                price=sl_level,
                                pnl=state.pnl,
                            )
                            tick_events.append(sl_event)
                            self.events.append(sl_event)
                    else:
                        sl_level = state.entry_price + state.leg.sl
                        if candle_high >= sl_level:
                            state.exit_price = sl_level
                            state.current_price = sl_level
                            state.is_active = False
                            state.state = "EXITED"
                            state.exit_reason = "stop_loss"
                            state.pnl = (state.exit_price - state.entry_price) * state.leg.quantity * state.direction
                            sl_hit = True
                            sl_event = TradeEvent(
                                timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                                event_type="SL_HIT",
                                leg_id=leg_id,
                                symbol=leg.symbol,
                                details=f"SL hit @ {sl_level:.2f}",
                                price=sl_level,
                                pnl=state.pnl,
                            )
                            tick_events.append(sl_event)
                            self.events.append(sl_event)

                if sl_hit:
                    continue

                if state.leg.target is not None and state.leg.target > 0:
                    if state.direction == 1:
                        target_level = state.entry_price + state.leg.target
                        if candle_high >= target_level:
                            state.exit_price = target_level
                            state.current_price = target_level
                            state.is_active = False
                            state.state = "EXITED"
                            state.exit_reason = "target"
                            state.pnl = (state.exit_price - state.entry_price) * state.leg.quantity * state.direction
                            target_hit = True
                            tgt_event = TradeEvent(
                                timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                                event_type="TARGET_HIT",
                                leg_id=leg_id,
                                symbol=leg.symbol,
                                details=f"Target hit @ {target_level:.2f}",
                                price=target_level,
                                pnl=state.pnl,
                            )
                            tick_events.append(tgt_event)
                            self.events.append(tgt_event)
                    else:
                        target_level = state.entry_price - state.leg.target
                        if candle_low <= target_level:
                            state.exit_price = target_level
                            state.current_price = target_level
                            state.is_active = False
                            state.state = "EXITED"
                            state.exit_reason = "target"
                            state.pnl = (state.exit_price - state.entry_price) * state.leg.quantity * state.direction
                            target_hit = True
                            tgt_event = TradeEvent(
                                timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                                event_type="TARGET_HIT",
                                leg_id=leg_id,
                                symbol=leg.symbol,
                                details=f"Target hit @ {target_level:.2f}",
                                price=target_level,
                                pnl=state.pnl,
                            )
                            tick_events.append(tgt_event)
                            self.events.append(tgt_event)

                if target_hit:
                    continue

                # Time-based exit check
                if exit_time is not None and candle_time >= exit_time and state.is_active:
                    state.exit_price = candle_close
                    state.current_price = candle_close
                    state.is_active = False
                    state.state = "EXITED"
                    state.exit_reason = "time_exit"
                    state.pnl = (candle_close - state.entry_price) * state.leg.quantity * state.direction
                    time_event = TradeEvent(
                        timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                        event_type="TIME_EXIT",
                        leg_id=leg_id,
                        symbol=leg.symbol,
                        details=f"Time exit @ {candle_close:.2f} (exit_time={exit_config.exit_time})",
                        price=candle_close,
                        pnl=state.pnl,
                    )
                    tick_events.append(time_event)
                    self.events.append(time_event)
                    continue

                # Per-leg risk check
                if risk.max_loss_per_leg is not None:
                    running_pnl = (candle_close - state.entry_price) * state.leg.quantity * state.direction
                    if running_pnl <= -abs(risk.max_loss_per_leg):
                        state.exit_price = candle_close
                        state.current_price = candle_close
                        state.is_active = False
                        state.state = "EXITED"
                        state.exit_reason = "risk_limit"
                        state.pnl = running_pnl
                        risk_event = TradeEvent(
                            timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                            event_type="RISK_STOP",
                            leg_id=leg_id,
                            symbol=leg.symbol,
                            details=f"Per-leg max loss {risk.max_loss_per_leg} breached, PnL={running_pnl:.2f}",
                            price=candle_close,
                            pnl=running_pnl,
                        )
                        tick_events.append(risk_event)
                        self.events.append(risk_event)
                        continue

                # Calculate running PnL
                state.pnl = (state.current_price - state.entry_price) * state.leg.quantity * state.direction

                # Calculate Greeks for option legs
                if leg.option_type in ("CE", "PE") and leg.strike is not None:
                    info = instrument_info.get(leg.id)
                    if info and leg.expiry:
                        try:
                            expiry_date = datetime.fromisoformat(leg.expiry).date() if isinstance(leg.expiry, str) else leg.expiry
                            current_date = ts.date() if isinstance(ts, datetime) else ts
                            days_to_expiry = (expiry_date - current_date).days
                            t = max(days_to_expiry, 0) / 365.0

                            if t > 0 and state.current_price > 0:
                                iv = calculate_iv(
                                    option_price=state.current_price,
                                    spot=state.current_price,
                                    strike=leg.strike,
                                    time_to_expiry=t,
                                    option_type=leg.option_type,
                                )
                                greeks = calculate_greeks(
                                    spot=state.current_price,
                                    strike=leg.strike,
                                    time_to_expiry=t,
                                    iv=iv,
                                    option_type=leg.option_type,
                                )
                                state.greeks_dict = greeks
                                state.greeks_dict["iv"] = iv
                            else:
                                state.greeks_dict = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "iv": 0.0}
                        except Exception:
                            state.greeks_dict = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "iv": 0.0}
                else:
                    state.greeks_dict = calculate_greeks_for_non_option(leg.quantity, leg.action)
                    state.greeks_dict["iv"] = 0.0

            # After all legs processed, check strategy-level risk
            total_pnl = sum(s.pnl for s in self.leg_states.values() if s.entry_price is not None)

            # Track peak P&L for drawdown
            peak_pnl = max(peak_pnl, total_pnl)
            current_drawdown = peak_pnl - total_pnl

            # Max loss check
            if risk.max_loss is not None and total_pnl <= -abs(risk.max_loss):
                any_active = any(s.is_active and s.entry_price is not None for s in self.leg_states.values())
                if any_active:
                    for lid, state in self.leg_states.items():
                        if state.is_active and state.entry_price is not None:
                            state.is_active = False
                            state.state = "EXITED"
                            state.exit_reason = "risk_limit"
                            state.exit_price = state.current_price
                    risk_stop_event = TradeEvent(
                        timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                        event_type="RISK_STOP",
                        details=f"Max loss {risk.max_loss} breached. Total PnL={total_pnl:.2f}",
                        pnl=total_pnl,
                    )
                    tick_events.append(risk_stop_event)
                    self.events.append(risk_stop_event)
                    self.status = "stopped"

            # Max drawdown check
            if risk.max_drawdown is not None and current_drawdown >= abs(risk.max_drawdown):
                any_active = any(s.is_active and s.entry_price is not None for s in self.leg_states.values())
                if any_active:
                    for lid, state in self.leg_states.items():
                        if state.is_active and state.entry_price is not None:
                            state.is_active = False
                            state.state = "EXITED"
                            state.exit_reason = "risk_limit"
                            state.exit_price = state.current_price
                    dd_event = TradeEvent(
                        timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                        event_type="RISK_STOP",
                        details=f"Max drawdown {risk.max_drawdown} breached. Drawdown={current_drawdown:.2f}",
                        pnl=total_pnl,
                    )
                    tick_events.append(dd_event)
                    self.events.append(dd_event)
                    self.status = "stopped"

            # Capital tracking
            current_capital = initial_capital + total_pnl
            peak_capital = max(peak_capital, current_capital)
            capital_drawdown = peak_capital - current_capital
            capital_drawdown_pct = (capital_drawdown / peak_capital * 100) if peak_capital > 0 else 0.0
            used_margin = sum(
                abs(s.entry_price * s.leg.quantity)
                for s in self.leg_states.values()
                if s.entry_price is not None and s.is_active
            )
            free_capital = current_capital - used_margin

            capital_state = CapitalState(
                initial_capital=initial_capital,
                current_capital=current_capital,
                used_margin=used_margin,
                free_capital=free_capital,
                peak_capital=peak_capital,
                drawdown=capital_drawdown,
                drawdown_pct=capital_drawdown_pct,
            )

            # Determine if this timestamp is a display tick
            tick_count += 1
            if interval > 1 and (tick_count % interval != 0):
                # Not a display tick, but SL/Target already checked above
                continue

            # Build result for this timestamp
            any_entry = any(s.entry_price is not None for s in self.leg_states.values())
            if not any_entry:
                continue

            leg_results = []
            total_greeks = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}

            for leg_id, state in self.leg_states.items():
                if state.entry_price is None:
                    continue

                lr = LegResult(
                    leg_id=leg_id,
                    symbol=state.leg.symbol,
                    action=state.leg.action,
                    entry_price=state.entry_price,
                    current_price=state.current_price,
                    pnl=state.pnl,
                    delta=state.greeks_dict.get("delta", 0.0),
                    gamma=state.greeks_dict.get("gamma", 0.0),
                    theta=state.greeks_dict.get("theta", 0.0),
                    vega=state.greeks_dict.get("vega", 0.0),
                    iv=state.greeks_dict.get("iv", 0.0),
                    is_active=state.is_active,
                    state=state.state,
                    exit_reason=state.exit_reason,
                    exit_price=state.exit_price,
                    sl_level=state.sl_level,
                    target_level=state.target_level,
                )
                leg_results.append(lr)
                for g in ("delta", "gamma", "theta", "vega"):
                    total_greeks[g] += state.greeks_dict.get(g, 0.0)

            if leg_results:
                result = BacktestResult(
                    timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                    leg_results=leg_results,
                    total_pnl=total_pnl,
                    greeks=Greeks(**total_greeks),
                    events=tick_events,
                    capital=capital_state,
                )
                self.results.append(result)

                if self._callback is not None:
                    try:
                        await self._callback(result)
                    except Exception:
                        pass

            # Yield control to event loop briefly for responsiveness
            await asyncio.sleep(0)

        if self.status == "running":
            self.status = "completed"

    def compute_analytics(self) -> AnalyticsSummary:
        """Compute analytics summary from backtest results."""
        if not self.results:
            return AnalyticsSummary()

        # Net P&L
        net_pnl = self.results[-1].total_pnl if self.results else 0.0

        # Max profit/loss over time
        pnls = [r.total_pnl for r in self.results]
        max_profit = max(pnls) if pnls else 0.0
        max_loss = min(pnls) if pnls else 0.0

        # Max drawdown
        peak = float('-inf')
        max_dd = 0.0
        for pnl in pnls:
            peak = max(peak, pnl)
            dd = peak - pnl
            max_dd = max(max_dd, dd)

        # Win/loss per leg
        wins, losses = 0, 0
        total_win_amt, total_loss_amt = 0.0, 0.0
        for leg_id, state in self.leg_states.items():
            if state.entry_price is not None:
                if state.pnl >= 0:
                    wins += 1
                    total_win_amt += state.pnl
                else:
                    losses += 1
                    total_loss_amt += abs(state.pnl)

        total = wins + losses
        win_rate = (wins / total * 100) if total > 0 else 0.0
        avg_win = total_win_amt / wins if wins > 0 else 0.0
        avg_loss = total_loss_amt / losses if losses > 0 else 0.0
        if total_loss_amt > 0:
            profit_factor = total_win_amt / total_loss_amt
        elif total_win_amt > 0:
            profit_factor = 9999.0
        else:
            profit_factor = 0.0
        risk_reward = avg_win / avg_loss if avg_loss > 0 else 0.0

        # Sharpe (annualized from per-minute returns)
        sharpe = 0.0
        if len(pnls) > 1:
            returns = [pnls[i] - pnls[i - 1] for i in range(1, len(pnls))]
            mean_ret = statistics.mean(returns) if returns else 0.0
            std_ret = statistics.stdev(returns) if len(returns) > 1 else 1.0
            if std_ret > 0:
                sharpe = mean_ret / std_ret * (252 * 375) ** 0.5  # annualized

        initial_cap = self.config.capital.initial_capital

        return AnalyticsSummary(
            net_pnl=net_pnl,
            net_pnl_pct=(net_pnl / initial_cap * 100) if initial_cap > 0 else 0.0,
            max_profit=max_profit,
            max_loss=max_loss,
            max_drawdown=max_dd,
            max_drawdown_pct=(max_dd / initial_cap * 100) if initial_cap > 0 else 0.0,
            win_count=wins,
            loss_count=losses,
            total_trades=total,
            win_rate=win_rate,
            sharpe_ratio=round(sharpe, 4),
            profit_factor=round(profit_factor, 4),
            avg_win=avg_win,
            avg_loss=avg_loss,
            risk_reward_ratio=round(risk_reward, 4),
        )

    def pause(self) -> None:
        """Pause the backtest."""
        if self.status == "running":
            self.status = "paused"
            self._pause_event.clear()

    def resume(self) -> None:
        """Resume the backtest."""
        if self.status == "paused":
            self.status = "running"
            self._pause_event.set()

    def stop(self) -> None:
        """Stop the backtest."""
        self.status = "stopped"
        self._pause_event.set()  # unblock if paused so loop can exit
