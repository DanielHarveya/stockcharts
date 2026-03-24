"""Persistent JSON-based storage for strategies and backtest history."""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

from app.schemas import Strategy, StrategyLeg

# Base data directory (relative to backend/)
_BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
_STRATEGIES_FILE = os.path.join(_BASE_DIR, "strategies.json")
_BACKTESTS_DIR = os.path.join(_BASE_DIR, "backtests")


def _ensure_dirs():
    """Create data directories if they don't exist."""
    os.makedirs(_BASE_DIR, exist_ok=True)
    os.makedirs(_BACKTESTS_DIR, exist_ok=True)


def save_strategies(strategies: Dict[str, Strategy]) -> None:
    """Save all strategies to data/strategies.json."""
    _ensure_dirs()
    data = {sid: s.model_dump() for sid, s in strategies.items()}
    with open(_STRATEGIES_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


def load_strategies() -> Dict[str, Strategy]:
    """Load strategies from data/strategies.json. Returns empty dict if file missing."""
    _ensure_dirs()
    if not os.path.exists(_STRATEGIES_FILE):
        return {}
    try:
        with open(_STRATEGIES_FILE, "r") as f:
            data = json.load(f)
        result = {}
        for sid, sdata in data.items():
            result[sid] = Strategy(**sdata)
        return result
    except Exception:
        return {}


def save_backtest_history(backtest_record: Dict[str, Any]) -> None:
    """Save a backtest summary record to data/backtests/{id}.json."""
    _ensure_dirs()
    bt_id = backtest_record["id"]
    filepath = os.path.join(_BACKTESTS_DIR, f"{bt_id}.json")
    with open(filepath, "w") as f:
        json.dump(backtest_record, f, indent=2, default=str)


def save_backtest_results(bt_id: str, results: List[Any]) -> None:
    """Save full backtest results to data/backtests/{id}_results.json."""
    _ensure_dirs()
    filepath = os.path.join(_BACKTESTS_DIR, f"{bt_id}_results.json")
    # Convert pydantic models to dicts if needed
    data = []
    for r in results:
        if hasattr(r, "model_dump"):
            data.append(r.model_dump())
        else:
            data.append(r)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)


def load_backtest_history(bt_id: str) -> Optional[Dict[str, Any]]:
    """Load a single backtest summary record."""
    filepath = os.path.join(_BACKTESTS_DIR, f"{bt_id}.json")
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, "r") as f:
            return json.load(f)
    except Exception:
        return None


def load_backtest_results(bt_id: str) -> Optional[List[Dict[str, Any]]]:
    """Load full backtest results for a given ID."""
    filepath = os.path.join(_BACKTESTS_DIR, f"{bt_id}_results.json")
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, "r") as f:
            return json.load(f)
    except Exception:
        return None


def list_backtest_history() -> List[Dict[str, Any]]:
    """List all saved backtest summary records (without full results)."""
    _ensure_dirs()
    records = []
    for fname in os.listdir(_BACKTESTS_DIR):
        if fname.endswith(".json") and not fname.endswith("_results.json"):
            filepath = os.path.join(_BACKTESTS_DIR, fname)
            try:
                with open(filepath, "r") as f:
                    record = json.load(f)
                records.append(record)
            except Exception:
                continue
    # Sort by created_at descending
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return records


def delete_backtest_history(bt_id: str) -> bool:
    """Delete a backtest record and its results file."""
    deleted = False
    summary_path = os.path.join(_BACKTESTS_DIR, f"{bt_id}.json")
    results_path = os.path.join(_BACKTESTS_DIR, f"{bt_id}_results.json")
    if os.path.exists(summary_path):
        os.remove(summary_path)
        deleted = True
    if os.path.exists(results_path):
        os.remove(results_path)
    return deleted
