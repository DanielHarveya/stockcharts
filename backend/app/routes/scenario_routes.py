from typing import List, Dict, Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.scenario_engine import run_scenario, run_scenario_matrix

router = APIRouter(prefix="/api/scenario", tags=["scenario"])


class ScenarioLeg(BaseModel):
    entry_price: float = 0
    current_price: float = 0
    strike: Optional[float] = None
    option_type: Optional[str] = None  # CE, PE, or None
    action: str = "BUY"
    quantity: int = 1
    iv: float = 0.2
    dte_days: int = 30
    symbol: str = ""


class ScenarioRequest(BaseModel):
    legs: List[ScenarioLeg]
    spot_shift: float = 0.0
    iv_shift: float = 0.0
    days_forward: int = 0
    risk_free_rate: float = 0.07


class ScenarioMatrixRequest(BaseModel):
    legs: List[ScenarioLeg]
    spot_range: List[float]      # e.g., [-500, -250, 0, 250, 500]
    iv_range: List[float]        # e.g., [-0.05, 0, 0.05]
    days_forward: int = 0


@router.post("/analyze")
async def analyze_scenario(req: ScenarioRequest):
    """Run a single what-if scenario on current positions."""
    try:
        legs_dicts = [leg.model_dump() for leg in req.legs]
        result = run_scenario(
            legs=legs_dicts,
            spot_shift=req.spot_shift,
            iv_shift=req.iv_shift,
            days_forward=req.days_forward,
            risk_free_rate=req.risk_free_rate,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/matrix")
async def analyze_scenario_matrix(req: ScenarioMatrixRequest):
    """Run a matrix of what-if scenarios (spot x IV)."""
    try:
        legs_dicts = [leg.model_dump() for leg in req.legs]
        result = run_scenario_matrix(
            legs=legs_dicts,
            spot_range=req.spot_range,
            iv_range=req.iv_range,
            days_forward=req.days_forward,
        )
        return {"matrix": result}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
