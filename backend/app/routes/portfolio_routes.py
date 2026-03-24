import uuid
import asyncio
from typing import List, Dict, Any, Optional
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.portfolio_engine import PortfolioEngine

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

# In-memory store for portfolio engines
_portfolio_engines: Dict[str, PortfolioEngine] = {}


class PortfolioRunRequest(BaseModel):
    strategy_ids: List[str]
    start_date: date
    end_date: date
    entry_time: str = "09:15"
    interval_minutes: int = 1


@router.post("/run")
async def run_portfolio(req: PortfolioRunRequest):
    """Run a portfolio backtest across multiple strategies concurrently."""
    portfolio_id = str(uuid.uuid4())

    config_template = {
        "start_date": req.start_date,
        "end_date": req.end_date,
        "entry_time": req.entry_time,
        "interval_minutes": req.interval_minutes,
    }

    engine = PortfolioEngine(
        strategy_ids=req.strategy_ids,
        config_template=config_template,
    )
    _portfolio_engines[portfolio_id] = engine

    async def _run():
        try:
            await engine.run()
        except Exception:
            engine.status = "stopped"

    asyncio.get_event_loop().create_task(_run())

    return {"portfolio_id": portfolio_id, "status": "starting"}


@router.get("/{portfolio_id}/status")
async def get_portfolio_status(portfolio_id: str):
    """Get portfolio backtest status."""
    engine = _portfolio_engines.get(portfolio_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {
        "portfolio_id": portfolio_id,
        "status": engine.status,
        "strategies_count": len(engine.engines),
        "results_count": len(engine.portfolio_results),
    }


@router.get("/{portfolio_id}/results")
async def get_portfolio_results(portfolio_id: str):
    """Get aggregated portfolio results."""
    engine = _portfolio_engines.get(portfolio_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {
        "portfolio_id": portfolio_id,
        "status": engine.status,
        "results": engine.portfolio_results,
    }


@router.get("/{portfolio_id}/analytics")
async def get_portfolio_analytics(portfolio_id: str):
    """Get per-strategy and portfolio-level analytics."""
    engine = _portfolio_engines.get(portfolio_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    if engine.status != "completed":
        raise HTTPException(status_code=400, detail="Portfolio backtest not yet completed")
    return engine.get_analytics()
