import math
from typing import Optional

import numpy as np
from scipy.stats import norm


def _d1(spot: float, strike: float, t: float, r: float, sigma: float) -> float:
    """Calculate d1 for Black-Scholes."""
    return (math.log(spot / strike) + (r + 0.5 * sigma ** 2) * t) / (sigma * math.sqrt(t))


def _d2(spot: float, strike: float, t: float, r: float, sigma: float) -> float:
    """Calculate d2 for Black-Scholes."""
    return _d1(spot, strike, t, r, sigma) - sigma * math.sqrt(t)


def bs_call_price(spot: float, strike: float, t: float, r: float, sigma: float) -> float:
    """Black-Scholes call option price."""
    if t <= 0:
        return max(spot - strike, 0.0)
    if sigma <= 0:
        return max(spot * math.exp(-r * t) - strike * math.exp(-r * t), 0.0)
    d1 = _d1(spot, strike, t, r, sigma)
    d2 = d1 - sigma * math.sqrt(t)
    return spot * norm.cdf(d1) - strike * math.exp(-r * t) * norm.cdf(d2)


def bs_put_price(spot: float, strike: float, t: float, r: float, sigma: float) -> float:
    """Black-Scholes put option price."""
    if t <= 0:
        return max(strike - spot, 0.0)
    if sigma <= 0:
        return max(strike * math.exp(-r * t) - spot * math.exp(-r * t), 0.0)
    d1 = _d1(spot, strike, t, r, sigma)
    d2 = d1 - sigma * math.sqrt(t)
    return strike * math.exp(-r * t) * norm.cdf(-d2) - spot * norm.cdf(-d1)


def calculate_iv(
    option_price: float,
    spot: float,
    strike: float,
    time_to_expiry: float,
    risk_free_rate: float = 0.07,
    option_type: str = "CE",
    max_iterations: int = 100,
    tolerance: float = 1e-6,
) -> float:
    """
    Calculate implied volatility using Newton-Raphson method.

    Args:
        option_price: Market price of the option.
        spot: Current spot/underlying price.
        strike: Strike price.
        time_to_expiry: Time to expiry in years.
        risk_free_rate: Risk-free interest rate (annualized).
        option_type: 'CE' for call, 'PE' for put.
        max_iterations: Maximum iterations for convergence.
        tolerance: Convergence tolerance.

    Returns:
        Implied volatility as a decimal (e.g. 0.20 for 20%).
    """
    if time_to_expiry <= 0:
        return 0.0

    if option_price <= 0:
        return 0.0

    # Intrinsic value check
    if option_type == "CE":
        intrinsic = max(spot - strike, 0.0)
    else:
        intrinsic = max(strike - spot, 0.0)

    if option_price < intrinsic:
        return 0.0

    price_func = bs_call_price if option_type == "CE" else bs_put_price

    # Initial guess
    sigma = 0.3

    for _ in range(max_iterations):
        try:
            calc_price = price_func(spot, strike, time_to_expiry, risk_free_rate, sigma)
            diff = calc_price - option_price

            if abs(diff) < tolerance:
                return sigma

            # Vega for Newton-Raphson
            d1 = _d1(spot, strike, time_to_expiry, risk_free_rate, sigma)
            vega = spot * math.sqrt(time_to_expiry) * norm.pdf(d1)

            if vega < 1e-12:
                break

            sigma = sigma - diff / vega

            if sigma <= 0.001:
                sigma = 0.001
            if sigma > 5.0:
                sigma = 5.0

        except (ValueError, ZeroDivisionError, OverflowError):
            break

    return max(sigma, 0.0)


def calculate_greeks(
    spot: float,
    strike: float,
    time_to_expiry: float,
    iv: float,
    risk_free_rate: float = 0.07,
    option_type: str = "CE",
) -> dict:
    """
    Calculate option Greeks using Black-Scholes.

    Args:
        spot: Current spot/underlying price.
        strike: Strike price.
        time_to_expiry: Time to expiry in years.
        iv: Implied volatility (decimal).
        risk_free_rate: Risk-free interest rate (annualized).
        option_type: 'CE' for call, 'PE' for put.

    Returns:
        Dictionary with delta, gamma, theta, vega.
    """
    result = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}

    # Edge case: at or past expiry
    if time_to_expiry <= 0:
        if option_type == "CE":
            result["delta"] = 1.0 if spot > strike else 0.0
        else:
            result["delta"] = -1.0 if spot < strike else 0.0
        return result

    # Edge case: zero or negative IV
    if iv <= 0:
        if option_type == "CE":
            result["delta"] = 1.0 if spot > strike else 0.0
        else:
            result["delta"] = -1.0 if spot < strike else 0.0
        return result

    try:
        d1 = _d1(spot, strike, time_to_expiry, risk_free_rate, iv)
        d2 = d1 - iv * math.sqrt(time_to_expiry)

        sqrt_t = math.sqrt(time_to_expiry)
        exp_rt = math.exp(-risk_free_rate * time_to_expiry)
        pdf_d1 = norm.pdf(d1)

        # Gamma (same for calls and puts)
        result["gamma"] = pdf_d1 / (spot * iv * sqrt_t)

        # Vega (same for calls and puts), per 1% move in vol
        result["vega"] = spot * sqrt_t * pdf_d1 / 100.0

        if option_type == "CE":
            result["delta"] = norm.cdf(d1)
            result["theta"] = (
                -(spot * pdf_d1 * iv) / (2.0 * sqrt_t)
                - risk_free_rate * strike * exp_rt * norm.cdf(d2)
            ) / 365.0  # per day
        else:
            result["delta"] = norm.cdf(d1) - 1.0
            result["theta"] = (
                -(spot * pdf_d1 * iv) / (2.0 * sqrt_t)
                + risk_free_rate * strike * exp_rt * norm.cdf(-d2)
            ) / 365.0  # per day

    except (ValueError, ZeroDivisionError, OverflowError):
        pass

    return result


def calculate_greeks_for_non_option(quantity: int, action: str) -> dict:
    """
    For futures/equity legs: delta equals quantity * direction, other greeks are 0.

    Args:
        quantity: Number of units.
        action: 'BUY' or 'SELL'.

    Returns:
        Dictionary with delta, gamma, theta, vega.
    """
    direction = 1 if action == "BUY" else -1
    return {
        "delta": float(quantity * direction),
        "gamma": 0.0,
        "theta": 0.0,
        "vega": 0.0,
    }
