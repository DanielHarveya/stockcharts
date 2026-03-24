from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.config import get_config
from app.database import get_engine, test_connection, reset_engine
from app.schemas import (
    DatabaseConfig,
    ColumnMapping,
    MappingResponse,
    OHLCMapping,
    InstrumentMapping,
    DatabaseStatus,
)

router = APIRouter(prefix="/api/database", tags=["database"])


@router.post("/connect")
def connect_database(config: DatabaseConfig):
    """Accept DB connection params, test connection, save to config."""
    app_config = get_config()
    app_config.set_db_connection(
        host=config.db_host,
        port=config.db_port,
        user=config.db_user,
        password=config.db_password,
        name=config.db_name,
    )
    reset_engine()
    try:
        test_connection()
    except Exception as exc:
        app_config.db_host = None
        app_config.db_user = None
        app_config.db_password = None
        app_config.db_name = None
        reset_engine()
        raise HTTPException(status_code=400, detail=f"Connection failed: {exc}")
    return {"message": "Connected successfully"}


@router.get("/tables")
def list_tables():
    """List all tables in user's database."""
    try:
        engine = get_engine()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    query = text(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public' ORDER BY table_name"
    )
    with engine.connect() as conn:
        result = conn.execute(query)
        tables = [row[0] for row in result]
    return {"tables": tables}


@router.get("/columns/{table_name}")
def list_columns(table_name: str):
    """List columns for a table."""
    try:
        engine = get_engine()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    query = text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = :table_name "
        "ORDER BY ordinal_position"
    )
    with engine.connect() as conn:
        result = conn.execute(query, {"table_name": table_name})
        columns = [{"name": row[0], "type": row[1]} for row in result]

    if not columns:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found or has no columns")
    return {"table_name": table_name, "columns": columns}


@router.post("/mapping")
def save_mapping(mapping: ColumnMapping):
    """Save OHLC and instrument master column mappings."""
    app_config = get_config()

    app_config.set_ohlc_mapping(
        table_name=mapping.ohlc.table_name,
        instrument_token_col=mapping.ohlc.instrument_token_col,
        datetime_col=mapping.ohlc.datetime_col,
        open_col=mapping.ohlc.open_col,
        high_col=mapping.ohlc.high_col,
        low_col=mapping.ohlc.low_col,
        close_col=mapping.ohlc.close_col,
        volume_col=mapping.ohlc.volume_col,
    )

    app_config.set_instrument_mapping(
        table_name=mapping.instrument.table_name,
        instrument_token_col=mapping.instrument.instrument_token_col,
        exchange_col=mapping.instrument.exchange_col,
        segment_col=mapping.instrument.segment_col,
        symbol_col=mapping.instrument.symbol_col,
        expiry_col=mapping.instrument.expiry_col,
        strike_col=mapping.instrument.strike_col,
        option_type_col=mapping.instrument.option_type_col,
        lot_size_col=mapping.instrument.lot_size_col,
    )

    return {"message": "Mapping saved successfully"}


@router.get("/mapping", response_model=MappingResponse)
def get_mapping():
    """Get current column mapping."""
    app_config = get_config()

    ohlc = None
    if app_config.is_ohlc_mapped:
        ohlc = OHLCMapping(
            table_name=app_config.ohlc_table_name,
            instrument_token_col=app_config.ohlc_instrument_token_col,
            datetime_col=app_config.ohlc_datetime_col,
            open_col=app_config.ohlc_open_col,
            high_col=app_config.ohlc_high_col,
            low_col=app_config.ohlc_low_col,
            close_col=app_config.ohlc_close_col,
            volume_col=app_config.ohlc_volume_col,
        )

    instrument = None
    if app_config.is_instrument_mapped:
        instrument = InstrumentMapping(
            table_name=app_config.inst_table_name,
            instrument_token_col=app_config.inst_instrument_token_col,
            exchange_col=app_config.inst_exchange_col,
            segment_col=app_config.inst_segment_col,
            symbol_col=app_config.inst_symbol_col,
            expiry_col=app_config.inst_expiry_col,
            strike_col=app_config.inst_strike_col,
            option_type_col=app_config.inst_option_type_col,
            lot_size_col=app_config.inst_lot_size_col,
        )

    return MappingResponse(ohlc=ohlc, instrument=instrument)


@router.get("/status", response_model=DatabaseStatus)
def get_status():
    """Check if DB is connected and mapping is configured."""
    app_config = get_config()

    connected = False
    if app_config.is_db_configured:
        try:
            test_connection()
            connected = True
        except Exception:
            connected = False

    return DatabaseStatus(
        connected=connected,
        ohlc_mapped=app_config.is_ohlc_mapped,
        instrument_mapped=app_config.is_instrument_mapped,
    )
