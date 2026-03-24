import asyncio
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
)
from app.services.db_service import get_ohlc_data, get_instrument_details
from app.services.greeks import calculate_iv, calculate_greeks, calculate_greeks_for_non_option


class LegState:
    """Tracks the runtime state of a single strategy leg during backtesting."""

    __slots__ = (
        "leg", "entry_price", "exit_price", "current_price",
        "is_active", "pnl", "direction", "greeks_dict",
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
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # not paused initially
        self._callback: Optional[Callable[[BacktestResult], Awaitable[None]]] = None

    def set_callback(self, callback: Callable[[BacktestResult], Awaitable[None]]) -> None:
        """Set an async callback to be invoked for each result tick."""
        self._callback = callback

    async def run(self) -> None:
        """
        Main backtest loop:
        1. Load all OHLC data
        2. Iterate candle by candle
        3. Track entry, SL, target, PnL, Greeks
        """
        self.status = "running"
        self.results = []

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

            # Process each leg at this timestamp
            for leg_id, state in self.leg_states.items():
                leg = state.leg
                token_candles = candles_by_token.get(leg.instrument_token, {})
                candle = token_candles.get(ts)

                if candle is None:
                    continue

                candle_time = ts.time() if isinstance(ts, datetime) else ts
                candle_close = candle["close"]
                candle_high = candle["high"]
                candle_low = candle["low"]

                # Entry logic: first candle at or after entry_time
                if state.entry_price is None:
                    if candle_time >= entry_time:
                        state.entry_price = candle_close
                        state.current_price = candle_close
                        state.pnl = 0.0
                    continue

                if not state.is_active:
                    # Leg is frozen (SL/Target hit)
                    continue

                # Update current price
                state.current_price = candle_close

                # SL/Target checks on intracandle prices
                if state.leg.sl is not None and state.leg.sl > 0:
                    if state.direction == 1:
                        # BUY leg: loss if price drops. SL breach if low <= entry - sl
                        sl_level = state.entry_price - state.leg.sl
                        if candle_low <= sl_level:
                            state.exit_price = sl_level
                            state.current_price = sl_level
                            state.is_active = False
                            state.pnl = (state.exit_price - state.entry_price) * state.leg.quantity * state.direction
                            continue
                    else:
                        # SELL leg: loss if price rises. SL breach if high >= entry + sl
                        sl_level = state.entry_price + state.leg.sl
                        if candle_high >= sl_level:
                            state.exit_price = sl_level
                            state.current_price = sl_level
                            state.is_active = False
                            state.pnl = (state.exit_price - state.entry_price) * state.leg.quantity * state.direction
                            continue

                if state.leg.target is not None and state.leg.target > 0:
                    if state.direction == 1:
                        # BUY leg: profit if price rises. Target breach if high >= entry + target
                        target_level = state.entry_price + state.leg.target
                        if candle_high >= target_level:
                            state.exit_price = target_level
                            state.current_price = target_level
                            state.is_active = False
                            state.pnl = (state.exit_price - state.entry_price) * state.leg.quantity * state.direction
                            continue
                    else:
                        # SELL leg: profit if price drops. Target breach if low <= entry - target
                        target_level = state.entry_price - state.leg.target
                        if candle_low <= target_level:
                            state.exit_price = target_level
                            state.current_price = target_level
                            state.is_active = False
                            state.pnl = (state.exit_price - state.entry_price) * state.leg.quantity * state.direction
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
            total_pnl = 0.0
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
                )
                leg_results.append(lr)
                total_pnl += state.pnl
                for g in ("delta", "gamma", "theta", "vega"):
                    total_greeks[g] += state.greeks_dict.get(g, 0.0)

            if leg_results:
                result = BacktestResult(
                    timestamp=ts.isoformat() if isinstance(ts, datetime) else str(ts),
                    leg_results=leg_results,
                    total_pnl=total_pnl,
                    greeks=Greeks(**total_greeks),
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
