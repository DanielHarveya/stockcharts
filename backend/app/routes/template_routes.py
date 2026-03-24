"""Routes for strategy templates."""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/templates", tags=["templates"])

STRATEGY_TEMPLATES = [
    {
        "name": "Iron Condor",
        "description": "Non-directional strategy profiting from low volatility",
        "category": "neutral",
        "legs": [
            {"action": "SELL", "option_type": "CE", "strike_offset": 200, "quantity": 1},
            {"action": "BUY", "option_type": "CE", "strike_offset": 400, "quantity": 1},
            {"action": "SELL", "option_type": "PE", "strike_offset": -200, "quantity": 1},
            {"action": "BUY", "option_type": "PE", "strike_offset": -400, "quantity": 1},
        ],
        "risk_profile": "limited_risk",
        "max_profit": "Net premium received",
        "max_loss": "Width of spread - premium",
    },
    {
        "name": "Bull Call Spread",
        "description": "Moderately bullish strategy with limited risk and reward",
        "category": "bullish",
        "legs": [
            {"action": "BUY", "option_type": "CE", "strike_offset": 0, "quantity": 1},
            {"action": "SELL", "option_type": "CE", "strike_offset": 200, "quantity": 1},
        ],
        "risk_profile": "limited_risk",
        "max_profit": "Width of spread - premium paid",
        "max_loss": "Net premium paid",
    },
    {
        "name": "Bear Put Spread",
        "description": "Moderately bearish strategy with limited risk and reward",
        "category": "bearish",
        "legs": [
            {"action": "BUY", "option_type": "PE", "strike_offset": 0, "quantity": 1},
            {"action": "SELL", "option_type": "PE", "strike_offset": -200, "quantity": 1},
        ],
        "risk_profile": "limited_risk",
        "max_profit": "Width of spread - premium paid",
        "max_loss": "Net premium paid",
    },
    {
        "name": "Long Straddle",
        "description": "Volatility strategy profiting from large price moves in either direction",
        "category": "volatile",
        "legs": [
            {"action": "BUY", "option_type": "CE", "strike_offset": 0, "quantity": 1},
            {"action": "BUY", "option_type": "PE", "strike_offset": 0, "quantity": 1},
        ],
        "risk_profile": "limited_risk",
        "max_profit": "Unlimited",
        "max_loss": "Total premium paid",
    },
    {
        "name": "Short Straddle",
        "description": "Non-directional strategy profiting from low volatility and time decay",
        "category": "neutral",
        "legs": [
            {"action": "SELL", "option_type": "CE", "strike_offset": 0, "quantity": 1},
            {"action": "SELL", "option_type": "PE", "strike_offset": 0, "quantity": 1},
        ],
        "risk_profile": "unlimited_risk",
        "max_profit": "Total premium received",
        "max_loss": "Unlimited",
    },
    {
        "name": "Long Strangle",
        "description": "Volatility strategy using OTM options for cheaper entry",
        "category": "volatile",
        "legs": [
            {"action": "BUY", "option_type": "CE", "strike_offset": 200, "quantity": 1},
            {"action": "BUY", "option_type": "PE", "strike_offset": -200, "quantity": 1},
        ],
        "risk_profile": "limited_risk",
        "max_profit": "Unlimited",
        "max_loss": "Total premium paid",
    },
    {
        "name": "Short Strangle",
        "description": "Non-directional strategy selling OTM options for premium collection",
        "category": "neutral",
        "legs": [
            {"action": "SELL", "option_type": "CE", "strike_offset": 200, "quantity": 1},
            {"action": "SELL", "option_type": "PE", "strike_offset": -200, "quantity": 1},
        ],
        "risk_profile": "unlimited_risk",
        "max_profit": "Total premium received",
        "max_loss": "Unlimited",
    },
    {
        "name": "Butterfly Spread",
        "description": "Neutral strategy profiting from price staying near a target",
        "category": "neutral",
        "legs": [
            {"action": "BUY", "option_type": "CE", "strike_offset": -100, "quantity": 1},
            {"action": "SELL", "option_type": "CE", "strike_offset": 0, "quantity": 2},
            {"action": "BUY", "option_type": "CE", "strike_offset": 100, "quantity": 1},
        ],
        "risk_profile": "limited_risk",
        "max_profit": "Width of spread - premium paid",
        "max_loss": "Net premium paid",
    },
    {
        "name": "Ratio Spread",
        "description": "Directional strategy selling extra OTM calls against a long ATM call",
        "category": "directional",
        "legs": [
            {"action": "BUY", "option_type": "CE", "strike_offset": 0, "quantity": 1},
            {"action": "SELL", "option_type": "CE", "strike_offset": 200, "quantity": 2},
        ],
        "risk_profile": "unlimited_risk",
        "max_profit": "Width of spread + net premium",
        "max_loss": "Unlimited above upper strike",
    },
    {
        "name": "Jade Lizard",
        "description": "Neutral-bullish strategy combining short put with short call spread",
        "category": "neutral-bullish",
        "legs": [
            {"action": "SELL", "option_type": "PE", "strike_offset": -200, "quantity": 1},
            {"action": "SELL", "option_type": "CE", "strike_offset": 200, "quantity": 1},
            {"action": "BUY", "option_type": "CE", "strike_offset": 400, "quantity": 1},
        ],
        "risk_profile": "limited_risk",
        "max_profit": "Net premium received",
        "max_loss": "Put strike - premium received (downside)",
    },
]

# Build lookup by name
_TEMPLATES_BY_NAME = {t["name"].lower(): t for t in STRATEGY_TEMPLATES}


@router.get("")
def list_templates():
    """List all available strategy templates."""
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "category": t["category"],
            "legs_count": len(t["legs"]),
            "risk_profile": t["risk_profile"],
        }
        for t in STRATEGY_TEMPLATES
    ]


@router.get("/{name}")
def get_template(name: str):
    """Get full template details by name (case-insensitive)."""
    template = _TEMPLATES_BY_NAME.get(name.lower())
    if template is None:
        # Try partial match
        for key, t in _TEMPLATES_BY_NAME.items():
            if name.lower().replace("-", " ").replace("_", " ") in key:
                template = t
                break
    if template is None:
        raise HTTPException(status_code=404, detail=f"Template '{name}' not found")
    return template
