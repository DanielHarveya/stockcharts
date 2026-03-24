import asyncio
from datetime import date, timedelta
from typing import List, Dict, Any
from app.schemas import Strategy, BacktestConfig, AnalyticsSummary
from app.services.backtest_engine import BacktestEngine
from app.models import strategies_store


async def run_walkforward(
    strategy_id: str,
    total_start: date,
    total_end: date,
    in_sample_days: int = 30,
    out_sample_days: int = 10,
    entry_time: str = "09:15",
    interval_minutes: int = 1,
) -> Dict[str, Any]:
    """
    Walk-forward analysis:
    1. Split total period into rolling windows
    2. For each window, run in-sample (training) and out-of-sample (testing)
    3. Compare performance to measure robustness
    """
    strategy = strategies_store.get(strategy_id)
    if strategy is None:
        raise ValueError(f"Strategy {strategy_id} not found")

    window_size = in_sample_days + out_sample_days
    windows = []

    current_start = total_start
    while current_start + timedelta(days=window_size) <= total_end:
        in_sample_end = current_start + timedelta(days=in_sample_days)
        out_sample_end = in_sample_end + timedelta(days=out_sample_days)

        windows.append({
            "in_sample_start": current_start,
            "in_sample_end": in_sample_end,
            "out_sample_start": in_sample_end,
            "out_sample_end": out_sample_end,
        })
        current_start = in_sample_end  # Roll forward

    results = []
    in_sample_pnls = []
    out_sample_pnls = []

    for i, window in enumerate(windows):
        # Run in-sample
        in_config = BacktestConfig(
            strategy_id=strategy_id,
            start_date=window["in_sample_start"],
            end_date=window["in_sample_end"],
            entry_time=entry_time,
            interval_minutes=interval_minutes,
        )
        in_engine = BacktestEngine(strategy=strategy, config=in_config)
        await in_engine.run()
        in_analytics = in_engine.compute_analytics()

        # Run out-of-sample
        out_config = BacktestConfig(
            strategy_id=strategy_id,
            start_date=window["out_sample_start"],
            end_date=window["out_sample_end"],
            entry_time=entry_time,
            interval_minutes=interval_minutes,
        )
        out_engine = BacktestEngine(strategy=strategy, config=out_config)
        await out_engine.run()
        out_analytics = out_engine.compute_analytics()

        in_sample_pnls.append(in_analytics.net_pnl)
        out_sample_pnls.append(out_analytics.net_pnl)

        results.append({
            "window": i + 1,
            "in_sample": {
                "start": window["in_sample_start"].isoformat(),
                "end": window["in_sample_end"].isoformat(),
                "analytics": in_analytics.model_dump(),
            },
            "out_sample": {
                "start": window["out_sample_start"].isoformat(),
                "end": window["out_sample_end"].isoformat(),
                "analytics": out_analytics.model_dump(),
            },
        })

    # Compute robustness score
    if in_sample_pnls and out_sample_pnls:
        in_wins = sum(1 for p in in_sample_pnls if p > 0)
        out_wins = sum(1 for p in out_sample_pnls if p > 0)
        consistency = out_wins / len(out_sample_pnls) * 100 if out_sample_pnls else 0
        # Robustness: how well does out-of-sample match in-sample direction
        direction_matches = sum(
            1 for i_p, o_p in zip(in_sample_pnls, out_sample_pnls)
            if (i_p > 0) == (o_p > 0)
        )
        robustness = direction_matches / len(in_sample_pnls) * 100 if in_sample_pnls else 0
    else:
        consistency = 0
        robustness = 0

    return {
        "strategy_id": strategy_id,
        "total_windows": len(windows),
        "windows": results,
        "summary": {
            "in_sample_total_pnl": round(sum(in_sample_pnls), 2),
            "out_sample_total_pnl": round(sum(out_sample_pnls), 2),
            "consistency_pct": round(consistency, 2),
            "robustness_pct": round(robustness, 2),
            "in_sample_win_rate": round(sum(1 for p in in_sample_pnls if p > 0) / max(len(in_sample_pnls), 1) * 100, 2),
            "out_sample_win_rate": round(sum(1 for p in out_sample_pnls if p > 0) / max(len(out_sample_pnls), 1) * 100, 2),
        }
    }
