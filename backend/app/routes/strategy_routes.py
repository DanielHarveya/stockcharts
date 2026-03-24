import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models import strategies_store
from app.schemas import Strategy, StrategyCreate, StrategyUpdate, StrategyLeg
from app.services.storage import save_strategies

router = APIRouter(prefix="/api/strategies", tags=["strategies"])


@router.post("", response_model=Strategy)
def create_strategy(payload: StrategyCreate):
    """Create a new strategy with legs (stored in memory)."""
    strategy_id = str(uuid.uuid4())

    legs = []
    for leg in payload.legs:
        leg_copy = leg.model_copy()
        if not leg_copy.id:
            leg_copy.id = str(uuid.uuid4())
        legs.append(leg_copy)

    strategy = Strategy(
        id=strategy_id,
        name=payload.name,
        legs=legs,
        created_at=datetime.utcnow(),
    )
    strategies_store[strategy_id] = strategy
    save_strategies(strategies_store)
    return strategy


@router.get("", response_model=list[Strategy])
def list_strategies():
    """List all strategies."""
    return list(strategies_store.values())


@router.get("/{strategy_id}", response_model=Strategy)
def get_strategy(strategy_id: str):
    """Get strategy details."""
    strategy = strategies_store.get(strategy_id)
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return strategy


@router.put("/{strategy_id}", response_model=Strategy)
def update_strategy(strategy_id: str, payload: StrategyUpdate):
    """Update strategy name and/or legs."""
    strategy = strategies_store.get(strategy_id)
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy not found")

    if payload.name is not None:
        strategy.name = payload.name

    if payload.legs is not None:
        legs = []
        for leg in payload.legs:
            leg_copy = leg.model_copy()
            if not leg_copy.id:
                leg_copy.id = str(uuid.uuid4())
            legs.append(leg_copy)
        strategy.legs = legs

    strategies_store[strategy_id] = strategy
    save_strategies(strategies_store)
    return strategy


@router.delete("/{strategy_id}")
def delete_strategy(strategy_id: str):
    """Delete a strategy."""
    if strategy_id not in strategies_store:
        raise HTTPException(status_code=404, detail="Strategy not found")
    del strategies_store[strategy_id]
    save_strategies(strategies_store)
    return {"message": "Strategy deleted"}
