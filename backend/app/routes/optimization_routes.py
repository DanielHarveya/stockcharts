from datetime import date
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.walkforward import run_walkforward
from app.services.optimizer import optimize_parameters

router = APIRouter(tags=["optimization"])


class WalkForwardRequest(BaseModel):
    strategy_id: str
    total_start: date
    total_end: date
    in_sample_days: int = 30
    out_sample_days: int = 10
    entry_time: str = "09:15"
    interval_minutes: int = 1


class OptimizerRequest(BaseModel):
    strategy_id: str
    start_date: date
    end_date: date
    entry_time: str = "09:15"
    interval_minutes: int = 1
    sl_range: Optional[List[float]] = None
    target_range: Optional[List[float]] = None
    trailing_sl_range: Optional[List[float]] = None
    entry_time_range: Optional[List[str]] = None
    max_combinations: int = 100


@router.post("/api/walkforward/run")
async def walkforward_run(req: WalkForwardRequest):
    """Run walk-forward analysis to measure strategy robustness."""
    try:
        result = await run_walkforward(
            strategy_id=req.strategy_id,
            total_start=req.total_start,
            total_end=req.total_end,
            in_sample_days=req.in_sample_days,
            out_sample_days=req.out_sample_days,
            entry_time=req.entry_time,
            interval_minutes=req.interval_minutes,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/api/optimizer/run")
async def optimizer_run(req: OptimizerRequest):
    """Run parameter optimization sweep over SL, target, trailing SL, and entry time."""
    try:
        result = await optimize_parameters(
            strategy_id=req.strategy_id,
            start_date=req.start_date,
            end_date=req.end_date,
            entry_time=req.entry_time,
            interval_minutes=req.interval_minutes,
            sl_range=req.sl_range,
            target_range=req.target_range,
            trailing_sl_range=req.trailing_sl_range,
            entry_time_range=req.entry_time_range,
            max_combinations=req.max_combinations,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
