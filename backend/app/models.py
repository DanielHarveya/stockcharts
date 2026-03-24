"""In-memory storage for strategies and backtests."""

from typing import Dict
from app.schemas import Strategy, BacktestState

# In-memory stores
strategies_store: Dict[str, Strategy] = {}
backtests_store: Dict[str, BacktestState] = {}
