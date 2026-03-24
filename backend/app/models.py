"""In-memory storage for strategies and backtests."""

from typing import Dict
from app.schemas import Strategy, BacktestState

# In-memory stores
backtests_store: Dict[str, BacktestState] = {}

# Load strategies from persistent storage on module import
try:
    from app.services.storage import load_strategies
    strategies_store: Dict[str, Strategy] = load_strategies()
except Exception:
    strategies_store: Dict[str, Strategy] = {}
