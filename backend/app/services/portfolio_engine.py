import asyncio
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.schemas import Strategy, BacktestConfig, AnalyticsSummary, BacktestResult
from app.services.backtest_engine import BacktestEngine
from app.models import strategies_store


class PortfolioEngine:
    def __init__(self, strategy_ids: List[str], config_template: Dict[str, Any]):
        self.strategy_ids = strategy_ids
        self.config_template = config_template  # shared config (dates, times)
        self.engines: Dict[str, BacktestEngine] = {}
        self.status = "idle"
        self.portfolio_results: List[Dict[str, Any]] = []

    async def run(self):
        self.status = "running"
        # Create engines for each strategy
        for sid in self.strategy_ids:
            strategy = strategies_store.get(sid)
            if strategy is None:
                continue
            config = BacktestConfig(strategy_id=sid, **self.config_template)
            engine = BacktestEngine(strategy=strategy, config=config)
            self.engines[sid] = engine

        # Run all engines concurrently
        tasks = []
        for sid, engine in self.engines.items():
            tasks.append(engine.run())

        await asyncio.gather(*tasks, return_exceptions=True)

        # Aggregate results by timestamp
        self._aggregate_results()
        self.status = "completed"

    def _aggregate_results(self):
        # Collect all timestamps across all engines
        all_timestamps = set()
        for engine in self.engines.values():
            for r in engine.results:
                all_timestamps.add(r.timestamp)

        sorted_ts = sorted(all_timestamps)

        # Build per-timestamp lookup for each engine
        results_by_ts: Dict[str, Dict[str, BacktestResult]] = {}
        for sid, engine in self.engines.items():
            for r in engine.results:
                if r.timestamp not in results_by_ts:
                    results_by_ts[r.timestamp] = {}
                results_by_ts[r.timestamp][sid] = r

        # Aggregate
        for ts in sorted_ts:
            ts_results = results_by_ts.get(ts, {})
            combined_pnl = 0.0
            combined_greeks = {"delta": 0, "gamma": 0, "theta": 0, "vega": 0}
            strategy_pnls = {}

            for sid, r in ts_results.items():
                strategy = strategies_store.get(sid)
                sname = strategy.name if strategy else sid
                combined_pnl += r.total_pnl
                strategy_pnls[sname] = r.total_pnl
                for g in combined_greeks:
                    combined_greeks[g] += getattr(r.greeks, g, 0)

            self.portfolio_results.append({
                "timestamp": ts,
                "total_pnl": round(combined_pnl, 2),
                "strategy_pnls": strategy_pnls,
                "greeks": {k: round(v, 6) for k, v in combined_greeks.items()},
            })

    def get_analytics(self) -> Dict[str, Any]:
        combined = {}
        for sid, engine in self.engines.items():
            strategy = strategies_store.get(sid)
            sname = strategy.name if strategy else sid
            combined[sname] = engine.compute_analytics().model_dump()

        # Portfolio-level analytics
        if self.portfolio_results:
            pnls = [r["total_pnl"] for r in self.portfolio_results]
            net_pnl = pnls[-1] if pnls else 0
            peak = float('-inf')
            max_dd = 0
            for p in pnls:
                peak = max(peak, p)
                max_dd = max(max_dd, peak - p)
            combined["__portfolio__"] = {
                "net_pnl": net_pnl,
                "max_drawdown": max_dd,
                "max_profit": max(pnls) if pnls else 0,
                "max_loss": min(pnls) if pnls else 0,
            }
        return combined
