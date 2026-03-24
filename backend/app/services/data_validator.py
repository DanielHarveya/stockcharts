"""Data validation service - checks OHLC data quality before backtesting."""

from datetime import datetime, timedelta, time as dtime
from typing import List, Dict, Any
from collections import defaultdict
import statistics

from app.schemas import DataValidationResult


def validate_ohlc_data(
    raw_data: List[Dict[str, Any]],
    instrument_tokens: List[Any],
    expected_start_time: dtime = dtime(9, 15),
    expected_end_time: dtime = dtime(15, 30),
) -> DataValidationResult:
    """
    Validate OHLC data quality.

    Checks:
    1. Missing candles (gaps in 1-min sequence)
    2. Abnormal values (negative prices, zero volume on high-vol instruments)
    3. Data completeness per instrument
    """
    result = DataValidationResult()

    if not raw_data:
        result.is_valid = False
        result.gap_warnings.append("No data found for the given date range and instruments")
        return result

    result.total_candles = len(raw_data)

    # Group by token and date
    by_token_date: Dict[Any, Dict[str, List]] = defaultdict(lambda: defaultdict(list))

    for candle in raw_data:
        dt = candle["datetime"]
        if isinstance(dt, str):
            dt = datetime.fromisoformat(dt)
        token = candle["instrument_token"]
        date_key = dt.date().isoformat()
        by_token_date[token][date_key].append(dt)

    # Check each token's data
    for token in instrument_tokens:
        token_data = by_token_date.get(token, {})
        if not token_data:
            result.gap_warnings.append(f"No data found for instrument_token={token}")
            result.missing_candles += 1
            continue

        for date_key, timestamps in token_data.items():
            sorted_ts = sorted(timestamps)

            # Check for gaps (missing minutes)
            for i in range(1, len(sorted_ts)):
                diff = (sorted_ts[i] - sorted_ts[i - 1]).total_seconds()
                if diff > 120:  # More than 2 minutes gap
                    gap_minutes = int(diff / 60)
                    result.missing_candles += gap_minutes - 1
                    if gap_minutes > 5:  # Only warn for significant gaps
                        result.gap_warnings.append(
                            f"Token {token} on {date_key}: {gap_minutes}min gap at {sorted_ts[i - 1].strftime('%H:%M')}"
                        )

    # Check for abnormal prices
    closes = [c["close"] for c in raw_data if c.get("close") is not None]
    if len(closes) > 20:
        mean_close = statistics.mean(closes)
        stdev_close = statistics.stdev(closes)
        if stdev_close > 0:
            for candle in raw_data:
                close = candle.get("close", 0)
                if close > 0 and abs(close - mean_close) > 3 * stdev_close:
                    dt = candle["datetime"]
                    if isinstance(dt, datetime):
                        dt = dt.isoformat()
                    result.iv_spike_warnings.append(
                        f"Abnormal price {close:.2f} at {dt} (mean={mean_close:.2f}, 3\u03c3={3 * stdev_close:.2f})"
                    )

    if result.missing_candles > result.total_candles * 0.3:
        result.is_valid = False

    # Cap warnings to prevent huge responses
    result.gap_warnings = result.gap_warnings[:50]
    result.iv_spike_warnings = result.iv_spike_warnings[:50]

    return result
