from typing import List, Dict, Any, Optional
from datetime import date, datetime
from app.services.db_service import get_ohlc_data, search_instruments, get_strikes, get_expiries
from app.services.greeks import calculate_iv


def compute_iv_surface(
    symbol: str,
    target_date: date,
    underlying_price: float,
    risk_free_rate: float = 0.07,
) -> Dict[str, Any]:
    """
    Compute IV across strikes and expiries for a symbol on a given date.
    Returns data for IV surface/skew visualization.
    """
    # Get available expiries
    expiries = get_expiries(symbol)

    surface_data = []
    skew_data = {}

    for expiry_str in expiries[:5]:  # Limit to 5 nearest expiries
        try:
            expiry_date = date.fromisoformat(expiry_str)
        except (ValueError, TypeError):
            continue

        if expiry_date < target_date:
            continue

        dte = (expiry_date - target_date).days
        if dte <= 0:
            continue

        t = dte / 365.0
        strikes_list = get_strikes(symbol, expiry_str)

        expiry_skew = {"expiry": expiry_str, "dte": dte, "strikes": []}

        for strike in strikes_list:
            # For each strike, we'd need the option's LTP
            # Since we're using OHLC data, we search for the instrument and get its close price
            # This is simplified - in reality you'd query the option's OHLC directly
            for opt_type in ["CE", "PE"]:
                # Try to find matching instrument
                instruments = search_instruments(f"{symbol}")
                matching = [i for i in instruments
                           if i.get("strike") == strike
                           and i.get("expiry") == expiry_str
                           and i.get("option_type") == opt_type]

                if not matching:
                    continue

                token = matching[0]["instrument_token"]

                # Get the close price for target_date
                try:
                    ohlc = get_ohlc_data([token], target_date, target_date)
                    if not ohlc:
                        continue
                    option_price = ohlc[-1]["close"]  # Last candle's close
                except Exception:
                    continue

                if option_price <= 0:
                    continue

                iv = calculate_iv(option_price, underlying_price, strike, t, risk_free_rate, opt_type)

                surface_data.append({
                    "expiry": expiry_str,
                    "dte": dte,
                    "strike": strike,
                    "option_type": opt_type,
                    "iv": round(iv, 4),
                    "price": round(option_price, 2),
                    "moneyness": round((strike - underlying_price) / underlying_price * 100, 2),
                })

                expiry_skew["strikes"].append({
                    "strike": strike,
                    "option_type": opt_type,
                    "iv": round(iv, 4),
                })

        if expiry_skew["strikes"]:
            skew_data[expiry_str] = expiry_skew

    return {
        "symbol": symbol,
        "date": target_date.isoformat(),
        "underlying_price": underlying_price,
        "surface": surface_data,
        "skew": skew_data,
        "expiries": list(skew_data.keys()),
    }
