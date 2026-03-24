import uuid
import asyncio
import json
import csv
import io

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from app.models import strategies_store, backtests_store
from app.schemas import (
    BacktestConfig,
    BacktestState,
    BacktestResult,
    BacktestStatusResponse,
)
from app.services.backtest_engine import BacktestEngine

router = APIRouter(prefix="/api/backtest", tags=["backtest"])

# In-memory store for engine instances (separate from the serializable state)
_engines: dict[str, BacktestEngine] = {}


@router.post("/run")
async def start_backtest(config: BacktestConfig):
    """Start a backtest. Returns a backtest_id immediately."""
    strategy = strategies_store.get(config.strategy_id)
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")

    backtest_id = str(uuid.uuid4())

    state = BacktestState(
        id=backtest_id,
        strategy_id=config.strategy_id,
        config=config,
        status="idle",
        results=[],
    )
    backtests_store[backtest_id] = state

    engine = BacktestEngine(strategy=strategy, config=config)
    _engines[backtest_id] = engine

    async def _run_backtest():
        try:
            backtests_store[backtest_id].status = "running"
            await engine.run()
        except Exception as exc:
            engine.status = "stopped"
            backtests_store[backtest_id].status = "stopped"
        finally:
            backtests_store[backtest_id].status = engine.status
            backtests_store[backtest_id].results = engine.results
            backtests_store[backtest_id].events = engine.events
            backtests_store[backtest_id].analytics = engine.compute_analytics()
            backtests_store[backtest_id].data_validation = engine.data_validation

    asyncio.get_event_loop().create_task(_run_backtest())

    return {"backtest_id": backtest_id, "status": "starting"}


@router.get("/{backtest_id}/status", response_model=BacktestStatusResponse)
def get_backtest_status(backtest_id: str):
    """Get backtest status."""
    engine = _engines.get(backtest_id)
    state = backtests_store.get(backtest_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Backtest not found")

    current_status = engine.status if engine else state.status
    results_count = len(engine.results) if engine else len(state.results)

    return BacktestStatusResponse(
        id=backtest_id,
        status=current_status,
        results_count=results_count,
    )


@router.post("/{backtest_id}/pause")
def pause_backtest(backtest_id: str):
    """Pause a running backtest."""
    engine = _engines.get(backtest_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    if engine.status != "running":
        raise HTTPException(status_code=400, detail=f"Cannot pause backtest in '{engine.status}' state")
    engine.pause()
    backtests_store[backtest_id].status = engine.status
    return {"status": engine.status}


@router.post("/{backtest_id}/resume")
def resume_backtest(backtest_id: str):
    """Resume a paused backtest."""
    engine = _engines.get(backtest_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    if engine.status != "paused":
        raise HTTPException(status_code=400, detail=f"Cannot resume backtest in '{engine.status}' state")
    engine.resume()
    backtests_store[backtest_id].status = engine.status
    return {"status": engine.status}


@router.post("/{backtest_id}/stop")
def stop_backtest(backtest_id: str):
    """Stop a running or paused backtest."""
    engine = _engines.get(backtest_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    if engine.status not in ("running", "paused"):
        raise HTTPException(status_code=400, detail=f"Cannot stop backtest in '{engine.status}' state")
    engine.stop()
    backtests_store[backtest_id].status = engine.status
    return {"status": engine.status}


@router.get("/{backtest_id}/results")
def get_backtest_results(backtest_id: str):
    """Get all results collected so far."""
    engine = _engines.get(backtest_id)
    state = backtests_store.get(backtest_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Backtest not found")

    results = engine.results if engine else state.results
    return {
        "backtest_id": backtest_id,
        "status": engine.status if engine else state.status,
        "results_count": len(results),
        "results": [r.model_dump() for r in results],
    }


@router.get("/{backtest_id}/analytics")
def get_backtest_analytics(backtest_id: str):
    """Get analytics summary."""
    engine = _engines.get(backtest_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    analytics = engine.compute_analytics()
    return analytics.model_dump()


@router.get("/{backtest_id}/events")
def get_backtest_events(backtest_id: str):
    """Get trade event log."""
    engine = _engines.get(backtest_id)
    if engine is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    return {"events": [e.model_dump() for e in engine.events]}


@router.get("/{backtest_id}/validation")
def get_data_validation(backtest_id: str):
    """Get data validation results."""
    engine = _engines.get(backtest_id)
    state = backtests_store.get(backtest_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    if state.data_validation:
        return state.data_validation.model_dump()
    return {"message": "No validation data available yet"}


@router.get("/{backtest_id}/export/csv")
def export_csv(backtest_id: str):
    """Export backtest results as CSV."""
    engine = _engines.get(backtest_id)
    state = backtests_store.get(backtest_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Backtest not found")

    results = engine.results if engine else state.results
    if not results:
        raise HTTPException(status_code=400, detail="No results to export")

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    first = results[0]
    header = ["Timestamp", "Total_PnL"]
    for lr in first.leg_results:
        prefix = lr.symbol or lr.leg_id
        header.extend([
            f"{prefix}_Price", f"{prefix}_PnL", f"{prefix}_State",
            f"{prefix}_Delta", f"{prefix}_Gamma", f"{prefix}_Theta",
            f"{prefix}_Vega", f"{prefix}_IV",
        ])
    header.extend(["Capital", "Used_Margin", "Drawdown"])
    writer.writerow(header)

    # Rows
    for r in results:
        row = [r.timestamp, f"{r.total_pnl:.2f}"]
        for lr in r.leg_results:
            row.extend([
                f"{lr.current_price:.2f}", f"{lr.pnl:.2f}",
                lr.state, f"{lr.delta:.4f}", f"{lr.gamma:.6f}",
                f"{lr.theta:.4f}", f"{lr.vega:.4f}", f"{lr.iv:.4f}",
            ])
        cap = r.capital
        row.extend([f"{cap.current_capital:.2f}", f"{cap.used_margin:.2f}", f"{cap.drawdown:.2f}"])
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=backtest_{backtest_id}.csv"},
    )


@router.websocket("/{backtest_id}/ws")
async def backtest_websocket(websocket: WebSocket, backtest_id: str):
    """Stream backtest results in real-time via WebSocket."""
    await websocket.accept()

    engine = _engines.get(backtest_id)
    if engine is None:
        await websocket.send_json({"error": "Backtest not found"})
        await websocket.close()
        return

    last_sent_index = 0

    try:
        while True:
            current_results = engine.results
            current_len = len(current_results)

            if current_len > last_sent_index:
                for i in range(last_sent_index, current_len):
                    result = current_results[i]
                    await websocket.send_json(result.model_dump())
                last_sent_index = current_len

            if engine.status in ("completed", "stopped"):
                # Send any remaining results
                final_len = len(engine.results)
                if final_len > last_sent_index:
                    for i in range(last_sent_index, final_len):
                        result = engine.results[i]
                        await websocket.send_json(result.model_dump())
                await websocket.send_json({"event": "backtest_finished", "status": engine.status})
                break

            await asyncio.sleep(0.1)

    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass
