from datetime import date, datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


# ── Database Configuration ──────────────────────────────────────────────

class DatabaseConfig(BaseModel):
    db_host: str
    db_port: int = 5432
    db_user: str
    db_password: str
    db_name: str


class OHLCMapping(BaseModel):
    table_name: str
    instrument_token_col: str
    datetime_col: str
    open_col: str
    high_col: str
    low_col: str
    close_col: str
    volume_col: Optional[str] = None


class InstrumentMapping(BaseModel):
    table_name: str
    instrument_token_col: str
    exchange_col: Optional[str] = None
    segment_col: Optional[str] = None
    symbol_col: Optional[str] = None
    expiry_col: Optional[str] = None
    strike_col: Optional[str] = None
    option_type_col: Optional[str] = None
    lot_size_col: Optional[str] = None


class ColumnMapping(BaseModel):
    ohlc: OHLCMapping
    instrument: InstrumentMapping


class MappingResponse(BaseModel):
    ohlc: Optional[OHLCMapping] = None
    instrument: Optional[InstrumentMapping] = None


class DatabaseStatus(BaseModel):
    connected: bool
    ohlc_mapped: bool
    instrument_mapped: bool


# ── Strategy ────────────────────────────────────────────────────────────

class StrategyLeg(BaseModel):
    id: Optional[str] = None
    instrument_token: Any
    symbol: str = ""
    exchange: str = ""
    expiry: Optional[str] = None
    strike: Optional[float] = None
    option_type: Optional[str] = None  # CE, PE, or None for futures/equity
    action: str  # BUY or SELL
    quantity: int
    sl: Optional[float] = None  # stop loss in absolute points
    target: Optional[float] = None  # target in absolute points
    lot_size: int = 1


class StrategyCreate(BaseModel):
    name: str
    legs: List[StrategyLeg]


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    legs: Optional[List[StrategyLeg]] = None


class Strategy(BaseModel):
    id: str
    name: str
    legs: List[StrategyLeg]
    created_at: datetime


# ── Backtest ────────────────────────────────────────────────────────────

class BacktestConfig(BaseModel):
    strategy_id: str
    start_date: date
    end_date: date
    interval_minutes: int = 1  # 1, 5, 15, etc.
    entry_time: str = "09:15"  # HH:MM format


class Greeks(BaseModel):
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0


class LegResult(BaseModel):
    leg_id: str
    symbol: str
    action: str
    entry_price: float
    current_price: float
    pnl: float
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    iv: float = 0.0
    is_active: bool = True


class BacktestResult(BaseModel):
    timestamp: str
    leg_results: List[LegResult]
    total_pnl: float
    greeks: Greeks


class BacktestState(BaseModel):
    id: str
    strategy_id: str
    config: BacktestConfig
    status: str = "idle"  # idle, running, paused, stopped, completed
    results: List[BacktestResult] = Field(default_factory=list)


class BacktestStatusResponse(BaseModel):
    id: str
    status: str
    results_count: int


class InstrumentDetail(BaseModel):
    instrument_token: Any
    symbol: Optional[str] = None
    exchange: Optional[str] = None
    segment: Optional[str] = None
    expiry: Optional[str] = None
    strike: Optional[float] = None
    option_type: Optional[str] = None
    lot_size: Optional[int] = None
