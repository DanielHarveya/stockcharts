from typing import List, Dict, Any, Optional
from app.services.greeks import calculate_greeks, bs_call_price, bs_put_price
from app.schemas import LegResult, Greeks
import math


def run_scenario(
    legs: List[Dict[str, Any]],  # Current leg states with entry_price, current_price, strike, expiry, option_type, action, quantity
    spot_shift: float = 0.0,      # points to add to spot
    iv_shift: float = 0.0,        # absolute IV change (e.g., 0.05 = +5%)
    days_forward: int = 0,         # days to subtract from DTE
    risk_free_rate: float = 0.07,
) -> Dict[str, Any]:
    """Run a what-if scenario on current positions."""
    results = []
    total_pnl_change = 0.0
    total_greeks = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}

    for leg in legs:
        entry_price = leg.get("entry_price", 0)
        current_price = leg.get("current_price", 0)
        strike = leg.get("strike")
        option_type = leg.get("option_type")
        action = leg.get("action", "BUY")
        quantity = leg.get("quantity", 1)
        iv = leg.get("iv", 0.2)
        dte_days = leg.get("dte_days", 30)
        symbol = leg.get("symbol", "")
        direction = 1 if action == "BUY" else -1

        # Apply shifts
        new_spot = current_price + spot_shift
        new_iv = max(iv + iv_shift, 0.01)
        new_dte = max(dte_days - days_forward, 0)
        t = new_dte / 365.0

        # Calculate new option price
        if option_type in ("CE", "PE") and strike and t > 0:
            if option_type == "CE":
                new_price = bs_call_price(new_spot, strike, t, risk_free_rate, new_iv)
            else:
                new_price = bs_put_price(new_spot, strike, t, risk_free_rate, new_iv)
            new_greeks = calculate_greeks(new_spot, strike, t, new_iv, risk_free_rate, option_type)
        else:
            new_price = new_spot
            new_greeks = {"delta": direction, "gamma": 0, "theta": 0, "vega": 0}

        new_pnl = (new_price - entry_price) * quantity * direction
        old_pnl = (current_price - entry_price) * quantity * direction
        pnl_change = new_pnl - old_pnl
        total_pnl_change += pnl_change

        for g in ("delta", "gamma", "theta", "vega"):
            total_greeks[g] += new_greeks.get(g, 0) * quantity * direction

        results.append({
            "symbol": symbol,
            "action": action,
            "quantity": quantity,
            "original_price": current_price,
            "scenario_price": round(new_price, 2),
            "original_pnl": round(old_pnl, 2),
            "scenario_pnl": round(new_pnl, 2),
            "pnl_change": round(pnl_change, 2),
            "greeks": {k: round(v, 6) for k, v in new_greeks.items()},
        })

    return {
        "legs": results,
        "total_pnl_change": round(total_pnl_change, 2),
        "total_greeks": {k: round(v, 6) for k, v in total_greeks.items()},
    }


def run_scenario_matrix(
    legs: List[Dict[str, Any]],
    spot_range: List[float],    # e.g., [-500, -250, 0, 250, 500]
    iv_range: List[float],      # e.g., [-0.05, 0, 0.05]
    days_forward: int = 0,
) -> List[Dict[str, Any]]:
    """Run multiple scenarios as a matrix (spot x IV)."""
    matrix = []
    for spot_shift in spot_range:
        for iv_shift in iv_range:
            result = run_scenario(legs, spot_shift, iv_shift, days_forward)
            matrix.append({
                "spot_shift": spot_shift,
                "iv_shift": iv_shift,
                "days_forward": days_forward,
                "total_pnl_change": result["total_pnl_change"],
                "total_greeks": result["total_greeks"],
            })
    return matrix
