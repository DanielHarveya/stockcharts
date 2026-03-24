from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.db_service import (
    search_instruments,
    get_instrument_details,
    get_expiries,
    get_strikes,
)
from app.schemas import InstrumentDetail

router = APIRouter(prefix="/api/instruments", tags=["instruments"])


@router.get("/search")
def search(q: str = Query(..., min_length=1, description="Search query for instrument symbol")):
    """Search instruments from the instrument master table. Matches partial symbol names."""
    try:
        results = search_instruments(q)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}")
    return {"instruments": results}


@router.get("/expiries")
def expiries(symbol: str = Query(..., description="Symbol to look up expiries for")):
    """Get unique expiry dates for a symbol."""
    try:
        result = get_expiries(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get expiries: {exc}")
    return {"symbol": symbol, "expiries": result}


@router.get("/strikes")
def strikes(
    symbol: str = Query(..., description="Symbol"),
    expiry: str = Query(..., description="Expiry date"),
):
    """Get available strikes for symbol + expiry."""
    try:
        result = get_strikes(symbol, expiry)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get strikes: {exc}")
    return {"symbol": symbol, "expiry": expiry, "strikes": result}


@router.get("/{instrument_token}")
def instrument_detail(instrument_token: str):
    """Get full instrument details by instrument_token."""
    try:
        detail = get_instrument_details(instrument_token)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get instrument: {exc}")

    if detail is None:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return detail
