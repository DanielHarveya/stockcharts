from datetime import date, datetime
from enum import Enum
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────

class TradeState(str, Enum):
    WAITING = "WAITING"
    ENTERED = "ENTERED"
    EXITED = "EXITED"
    EXPIRED = "EXPIRED"

class SlippageModel(str, Enum):
    NONE = "none"
    FIXED = "fixed"       # fixed ticks
    PERCENT = "percent"   # % of price

class ExitReason(str, Enum):
    ACTIVE = "active"
    STOP_LOSS = "stop_loss"
    TARGET = "target"
    TIME_EXIT = "time_exit"
    MANUAL_STOP = "manual_stop"
    EXPIRY = "expiry"
    RISK_LIMIT = "risk_limit"
    TRAILING_SL = "trailing_sl"


# ── V1 Config Models ──────────────────────────────────────────────────

class ExecutionConfig(BaseModel):
    slippage_model: str = "none"  # none, fixed, percent
    slippage_value: float = 0.0   # ticks for fixed, % for percent

class EntryCondition(BaseModel):
    condition_type: str = "immediate"  # immediate, price_above, price_below, iv_above, iv_below
    value: Optional[float] = None       # threshold value

class ExitConfig(BaseModel):
    exit_time: Optional[str] = None     # HH:MM format - force exit at this time daily
    dte_exit: Optional[int] = None      # Exit when days to expiry <= this value

class RiskConfig(BaseModel):
    max_loss: Optional[float] = None         # Max loss for entire strategy, stop all if breached
    max_drawdown: Optional[float] = None     # Max drawdown from peak, stop all if breached
    max_loss_per_leg: Optional[float] = None # Max loss per individual leg

class CapitalConfig(BaseModel):
    initial_capital: float = 1000000.0    # Starting capital

class TradeEvent(BaseModel):
    timestamp: str
    event_type: str   # ENTRY, EXIT, SL_HIT, TARGET_HIT, TIME_EXIT, RISK_STOP, ADJUSTMENT, DATA_WARNING
    leg_id: Optional[str] = None
    symbol: Optional[str] = None
    details: str
    price: Optional[float] = None
    pnl: Optional[float] = None

class CapitalState(BaseModel):
    initial_capital: float = 1000000.0
    current_capital: float = 1000000.0
    used_margin: float = 0.0
    free_capital: float = 1000000.0
    peak_capital: float = 1000000.0
    drawdown: float = 0.0
    drawdown_pct: float = 0.0

class AnalyticsSummary(BaseModel):
    net_pnl: float = 0.0
    net_pnl_pct: float = 0.0
    max_profit: float = 0.0
    max_loss: float = 0.0
    max_drawdown: float = 0.0
    max_drawdown_pct: float = 0.0
    win_count: int = 0
    loss_count: int = 0
    total_trades: int = 0
    win_rate: float = 0.0
    sharpe_ratio: float = 0.0
    profit_factor: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    risk_reward_ratio: float = 0.0
    total_fees: float = 0.0

class DataValidationResult(BaseModel):
    total_candles: int = 0
    missing_candles: int = 0
    gap_warnings: List[str] = Field(default_factory=list)
    iv_spike_warnings: List[str] = Field(default_factory=list)
    is_valid: bool = True


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
    trailing_sl: Optional[float] = None  # trailing stop loss in points - trails from peak profit
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
    # V1 fields
    execution: ExecutionConfig = Field(default_factory=ExecutionConfig)
    entry_conditions: EntryCondition = Field(default_factory=EntryCondition)
    exit_config: ExitConfig = Field(default_factory=ExitConfig)
    risk: RiskConfig = Field(default_factory=RiskConfig)
    capital: CapitalConfig = Field(default_factory=CapitalConfig)


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
    # V1 fields
    state: str = "WAITING"       # TradeState value
    exit_reason: str = "active"  # ExitReason value
    exit_price: Optional[float] = None
    sl_level: Optional[float] = None
    target_level: Optional[float] = None


class BacktestResult(BaseModel):
    timestamp: str
    leg_results: List[LegResult]
    total_pnl: float
    greeks: Greeks
    # V1 fields
    events: List[TradeEvent] = Field(default_factory=list)
    capital: CapitalState = Field(default_factory=CapitalState)
    underlying_prices: Dict[str, float] = Field(default_factory=dict)  # {symbol: price}


class BacktestState(BaseModel):
    id: str
    strategy_id: str
    config: BacktestConfig
    status: str = "idle"  # idle, running, paused, stopped, completed
    results: List[BacktestResult] = Field(default_factory=list)
    # V1 fields
    events: List[TradeEvent] = Field(default_factory=list)
    analytics: Optional[AnalyticsSummary] = None
    data_validation: Optional[DataValidationResult] = None


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
