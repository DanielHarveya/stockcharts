import re
from typing import List, Optional, Any, Dict
from datetime import date, datetime

from sqlalchemy import text

from app.config import get_config
from app.database import get_engine


_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _validate_identifier(name: str) -> str:
    """Validate that a string is a safe SQL identifier (table/column name)."""
    if not _IDENTIFIER_RE.match(name):
        raise ValueError(f"Invalid SQL identifier: {name!r}")
    return name


def get_ohlc_data(
    instrument_tokens: List[Any],
    start_date: date,
    end_date: date,
) -> List[Dict[str, Any]]:
    """
    Query OHLC data using mapped columns for the given instrument tokens and date range.
    Returns a list of dicts with keys: instrument_token, datetime, open, high, low, close, volume.
    """
    config = get_config()
    if not config.is_ohlc_mapped:
        raise RuntimeError("OHLC column mapping is not configured.")

    table = _validate_identifier(config.ohlc_table_name)
    token_col = _validate_identifier(config.ohlc_instrument_token_col)
    dt_col = _validate_identifier(config.ohlc_datetime_col)
    open_col = _validate_identifier(config.ohlc_open_col)
    high_col = _validate_identifier(config.ohlc_high_col)
    low_col = _validate_identifier(config.ohlc_low_col)
    close_col = _validate_identifier(config.ohlc_close_col)
    vol_col = _validate_identifier(config.ohlc_volume_col) if config.ohlc_volume_col else None

    select_cols = [
        f"{token_col} AS instrument_token",
        f"{dt_col} AS datetime",
        f"{open_col} AS open",
        f"{high_col} AS high",
        f"{low_col} AS low",
        f"{close_col} AS close",
    ]
    if vol_col:
        select_cols.append(f"{vol_col} AS volume")

    # Build token placeholders
    token_placeholders = ", ".join(f":tok_{i}" for i in range(len(instrument_tokens)))

    query_str = (
        f"SELECT {', '.join(select_cols)} "
        f"FROM {table} "
        f"WHERE {token_col} IN ({token_placeholders}) "
        f"AND {dt_col} >= :start_date "
        f"AND {dt_col} <= :end_date "
        f"ORDER BY {dt_col} ASC"
    )

    params: Dict[str, Any] = {
        "start_date": datetime.combine(start_date, datetime.min.time()),
        "end_date": datetime.combine(end_date, datetime.max.time()),
    }
    for i, tok in enumerate(instrument_tokens):
        params[f"tok_{i}"] = tok

    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(text(query_str), params)
        rows = result.mappings().all()

    output = []
    for row in rows:
        d = {
            "instrument_token": row["instrument_token"],
            "datetime": row["datetime"],
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
        }
        if vol_col:
            d["volume"] = int(row["volume"]) if row["volume"] is not None else 0
        else:
            d["volume"] = 0
        output.append(d)

    return output


def get_instrument_details(instrument_token: Any) -> Optional[Dict[str, Any]]:
    """Get instrument info from the master table by instrument_token."""
    config = get_config()
    if not config.is_instrument_mapped:
        raise RuntimeError("Instrument column mapping is not configured.")

    table = _validate_identifier(config.inst_table_name)
    token_col = _validate_identifier(config.inst_instrument_token_col)

    select_cols = [f"{token_col} AS instrument_token"]
    col_aliases = {
        "exchange": config.inst_exchange_col,
        "segment": config.inst_segment_col,
        "symbol": config.inst_symbol_col,
        "expiry": config.inst_expiry_col,
        "strike": config.inst_strike_col,
        "option_type": config.inst_option_type_col,
        "lot_size": config.inst_lot_size_col,
    }
    for alias, col in col_aliases.items():
        if col:
            select_cols.append(f"{_validate_identifier(col)} AS {alias}")

    query_str = (
        f"SELECT {', '.join(select_cols)} "
        f"FROM {table} "
        f"WHERE {token_col} = :token "
        f"LIMIT 1"
    )

    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(text(query_str), {"token": instrument_token})
        row = result.mappings().first()

    if row is None:
        return None

    detail: Dict[str, Any] = {"instrument_token": row["instrument_token"]}
    for alias in col_aliases:
        if alias in row.keys():
            val = row[alias]
            if val is not None and hasattr(val, "isoformat"):
                val = val.isoformat()
            detail[alias] = val
        else:
            detail[alias] = None

    return detail


def search_instruments(query: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Search instruments by partial symbol match."""
    config = get_config()
    if not config.is_instrument_mapped:
        raise RuntimeError("Instrument column mapping is not configured.")

    if not config.inst_symbol_col:
        raise RuntimeError("Symbol column is not mapped.")

    table = _validate_identifier(config.inst_table_name)
    token_col = _validate_identifier(config.inst_instrument_token_col)
    symbol_col = _validate_identifier(config.inst_symbol_col)

    select_cols = [
        f"{token_col} AS instrument_token",
        f"{symbol_col} AS symbol",
    ]
    col_aliases = {
        "exchange": config.inst_exchange_col,
        "expiry": config.inst_expiry_col,
        "strike": config.inst_strike_col,
        "option_type": config.inst_option_type_col,
        "lot_size": config.inst_lot_size_col,
    }
    for alias, col in col_aliases.items():
        if col:
            select_cols.append(f"{_validate_identifier(col)} AS {alias}")

    query_str = (
        f"SELECT {', '.join(select_cols)} "
        f"FROM {table} "
        f"WHERE UPPER({symbol_col}) LIKE UPPER(:search_pattern) "
        f"ORDER BY {symbol_col} ASC "
        f"LIMIT :lim"
    )

    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text(query_str),
            {"search_pattern": f"%{query}%", "lim": limit},
        )
        rows = result.mappings().all()

    instruments = []
    for row in rows:
        item: Dict[str, Any] = {
            "instrument_token": row["instrument_token"],
            "symbol": row["symbol"],
        }
        for alias in col_aliases:
            if alias in row.keys():
                val = row[alias]
                if val is not None and hasattr(val, "isoformat"):
                    val = val.isoformat()
                item[alias] = val
            else:
                item[alias] = None
        instruments.append(item)

    return instruments


def get_expiries(symbol: str) -> List[str]:
    """Get unique expiry dates for a symbol."""
    config = get_config()
    if not config.is_instrument_mapped:
        raise RuntimeError("Instrument column mapping is not configured.")

    if not config.inst_symbol_col or not config.inst_expiry_col:
        raise RuntimeError("Symbol and/or expiry columns are not mapped.")

    table = _validate_identifier(config.inst_table_name)
    symbol_col = _validate_identifier(config.inst_symbol_col)
    expiry_col = _validate_identifier(config.inst_expiry_col)

    query_str = (
        f"SELECT DISTINCT {expiry_col} AS expiry "
        f"FROM {table} "
        f"WHERE UPPER({symbol_col}) = UPPER(:symbol) "
        f"AND {expiry_col} IS NOT NULL "
        f"ORDER BY expiry ASC"
    )

    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(text(query_str), {"symbol": symbol})
        rows = result.mappings().all()

    expiries = []
    for row in rows:
        val = row["expiry"]
        if val is not None:
            if hasattr(val, "isoformat"):
                expiries.append(val.isoformat())
            else:
                expiries.append(str(val))
    return expiries


def get_strikes(symbol: str, expiry: str) -> List[float]:
    """Get available strikes for a symbol and expiry."""
    config = get_config()
    if not config.is_instrument_mapped:
        raise RuntimeError("Instrument column mapping is not configured.")

    if not config.inst_symbol_col or not config.inst_strike_col or not config.inst_expiry_col:
        raise RuntimeError("Symbol, strike and/or expiry columns are not mapped.")

    table = _validate_identifier(config.inst_table_name)
    symbol_col = _validate_identifier(config.inst_symbol_col)
    expiry_col = _validate_identifier(config.inst_expiry_col)
    strike_col = _validate_identifier(config.inst_strike_col)

    query_str = (
        f"SELECT DISTINCT {strike_col} AS strike "
        f"FROM {table} "
        f"WHERE UPPER({symbol_col}) = UPPER(:symbol) "
        f"AND {expiry_col} = :expiry "
        f"AND {strike_col} IS NOT NULL "
        f"ORDER BY strike ASC"
    )

    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(text(query_str), {"symbol": symbol, "expiry": expiry})
        rows = result.mappings().all()

    return [float(row["strike"]) for row in rows]
