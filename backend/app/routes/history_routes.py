"""Routes for backtest history management."""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.storage import (
    save_backtest_history,
    save_backtest_results,
    load_backtest_history,
    load_backtest_results,
    list_backtest_history,
    delete_backtest_history,
)

router = APIRouter(prefix="/api/history", tags=["history"])


class SaveBacktestRequest(BaseModel):
    backtest_id: str
    name: Optional[str] = None


@router.get("")
def list_history():
    """List all saved backtests (summary only)."""
    records = list_backtest_history()
    # Return only summary fields
    summaries = []
    for r in records:
        summaries.append({
            "id": r.get("id"),
            "name": r.get("name"),
            "strategy_name": r.get("strategy_name"),
            "created_at": r.get("created_at"),
            "status": r.get("status"),
            "net_pnl": r.get("net_pnl"),
        })
    return summaries


@router.get("/compare")
def compare_backtests(ids: str = Query(..., description="Comma-separated backtest IDs")):
    """Get results for multiple backtests for comparison."""
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        raise HTTPException(status_code=400, detail="No IDs provided")

    results = []
    for bt_id in id_list:
        record = load_backtest_history(bt_id)
        if record is None:
            raise HTTPException(status_code=404, detail=f"Backtest {bt_id} not found")
        full_results = load_backtest_results(bt_id)
        record["results"] = full_results or []
        results.append(record)
    return results


@router.get("/{history_id}")
def get_history_detail(history_id: str):
    """Get full backtest record including results."""
    record = load_backtest_history(history_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Backtest history not found")
    full_results = load_backtest_results(history_id)
    record["results"] = full_results or []
    return record


@router.post("/save")
def save_history(request: SaveBacktestRequest):
    """Save a backtest from the in-memory store to persistent history."""
    from app.models import backtests_store

    state = backtests_store.get(request.backtest_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Backtest not found in memory")

    history_id = str(uuid.uuid4())
    name = request.name or f"Backtest {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"

    analytics_dict = state.analytics.model_dump() if state.analytics else {}

    record = {
        "id": history_id,
        "name": name,
        "strategy_id": state.strategy_id,
        "strategy_name": _get_strategy_name(state.strategy_id),
        "config": state.config.model_dump(),
        "status": state.status,
        "net_pnl": analytics_dict.get("net_pnl", 0.0),
        "analytics": analytics_dict,
        "created_at": datetime.utcnow().isoformat(),
        "results_count": len(state.results),
    }

    save_backtest_history(record)
    save_backtest_results(history_id, state.results)

    return record


@router.delete("/{history_id}")
def delete_history(history_id: str):
    """Delete a saved backtest from history."""
    deleted = delete_backtest_history(history_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Backtest history not found")
    return {"message": "Backtest history deleted"}


def auto_save_backtest(state) -> dict:
    """Auto-save a completed backtest. Called from backtest_routes."""
    history_id = str(uuid.uuid4())
    name = f"Auto: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"

    analytics_dict = state.analytics.model_dump() if state.analytics else {}

    record = {
        "id": history_id,
        "name": name,
        "strategy_id": state.strategy_id,
        "strategy_name": _get_strategy_name(state.strategy_id),
        "config": state.config.model_dump(),
        "status": state.status,
        "net_pnl": analytics_dict.get("net_pnl", 0.0),
        "analytics": analytics_dict,
        "created_at": datetime.utcnow().isoformat(),
        "results_count": len(state.results),
    }

    save_backtest_history(record)
    save_backtest_results(history_id, state.results)

    return record


def _get_strategy_name(strategy_id: str) -> str:
    """Helper to get strategy name from store."""
    from app.models import strategies_store
    strategy = strategies_store.get(strategy_id)
    return strategy.name if strategy else "Unknown"
