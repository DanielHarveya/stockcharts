import asyncio
import itertools
from datetime import date
from typing import List, Dict, Any, Optional
from app.schemas import Strategy, BacktestConfig, StrategyLeg
from app.services.backtest_engine import BacktestEngine
from app.models import strategies_store


async def optimize_parameters(
    strategy_id: str,
    start_date: date,
    end_date: date,
    entry_time: str = "09:15",
    interval_minutes: int = 1,
    # Parameter ranges to sweep
    sl_range: Optional[List[float]] = None,       # e.g., [10, 20, 30, 50]
    target_range: Optional[List[float]] = None,    # e.g., [20, 40, 60, 100]
    trailing_sl_range: Optional[List[float]] = None,
    entry_time_range: Optional[List[str]] = None,  # e.g., ["09:15", "09:30", "10:00"]
    max_combinations: int = 100,  # Cap to prevent overfitting/long runs
) -> Dict[str, Any]:
    """
    Sweep parameter combinations and find optimal settings.
    Returns ranked results with overfitting warnings.
    """
    strategy = strategies_store.get(strategy_id)
    if strategy is None:
        raise ValueError(f"Strategy {strategy_id} not found")

    # Build parameter combinations
    sl_values = sl_range or [None]
    target_values = target_range or [None]
    trailing_values = trailing_sl_range or [None]
    entry_times = entry_time_range or [entry_time]

    combinations = list(itertools.product(sl_values, target_values, trailing_values, entry_times))

    if len(combinations) > max_combinations:
        combinations = combinations[:max_combinations]

    results = []

    for sl, target, trail, etime in combinations:
        # Clone strategy with modified parameters
        modified_legs = []
        for leg in strategy.legs:
            leg_dict = leg.model_dump()
            if sl is not None:
                leg_dict["sl"] = sl
            if target is not None:
                leg_dict["target"] = target
            if trail is not None:
                leg_dict["trailing_sl"] = trail
            modified_legs.append(StrategyLeg(**leg_dict))

        modified_strategy = Strategy(
            id=strategy.id,
            name=strategy.name,
            legs=modified_legs,
            created_at=strategy.created_at,
        )

        config = BacktestConfig(
            strategy_id=strategy_id,
            start_date=start_date,
            end_date=end_date,
            entry_time=etime,
            interval_minutes=interval_minutes,
        )

        engine = BacktestEngine(strategy=modified_strategy, config=config)
        try:
            await engine.run()
            analytics = engine.compute_analytics()

            results.append({
                "params": {"sl": sl, "target": target, "trailing_sl": trail, "entry_time": etime},
                "net_pnl": analytics.net_pnl,
                "sharpe_ratio": analytics.sharpe_ratio,
                "max_drawdown": analytics.max_drawdown,
                "win_rate": analytics.win_rate,
                "profit_factor": analytics.profit_factor,
                "total_trades": analytics.total_trades,
            })
        except Exception:
            continue

    # Sort by Sharpe ratio (best risk-adjusted)
    results.sort(key=lambda x: x.get("sharpe_ratio", 0), reverse=True)

    # Overfitting warnings
    warnings = []
    if len(results) > 20:
        warnings.append("Large parameter space increases overfitting risk. Validate with walk-forward testing.")
    if results and results[0]["total_trades"] < 10:
        warnings.append("Low trade count — results may not be statistically significant.")

    return {
        "strategy_id": strategy_id,
        "total_combinations": len(results),
        "best": results[0] if results else None,
        "results": results[:50],  # Top 50
        "warnings": warnings,
    }
