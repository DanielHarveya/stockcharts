from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.iv_surface import compute_iv_surface

router = APIRouter(prefix="/api/iv", tags=["iv"])


class IVSurfaceRequest(BaseModel):
    symbol: str
    date: date
    underlying_price: float
    risk_free_rate: float = 0.07


@router.post("/surface")
async def get_iv_surface(req: IVSurfaceRequest):
    """Compute IV surface across strikes and expiries for visualization."""
    try:
        result = compute_iv_surface(
            symbol=req.symbol,
            target_date=req.date,
            underlying_price=req.underlying_price,
            risk_free_rate=req.risk_free_rate,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
