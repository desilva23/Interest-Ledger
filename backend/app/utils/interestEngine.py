from datetime import datetime, timedelta
from decimal import Decimal

def calc_interest(principal: float, rate_pct: float, interest_type: str, days: int) -> dict:
    """
    Calculate interest based on type (flat/monthly/daily).
    Returns dict with interest, daily_equivalent, monthly_equivalent, total_receivable.
    """
    p = float(principal) or 0
    r = float(rate_pct) or 0
    d = max(int(days) or 0, 0)
    
    if interest_type == "daily":
        interest = p * (r / 100) * d
    elif interest_type == "monthly":
        interest = p * (r / 100) * (d / 30)
    else:  # flat
        interest = p * (r / 100)
    
    daily_eq = interest / d if d > 0 else 0
    monthly_eq = daily_eq * 30
    total = p + interest
    
    return {
        "interest": round(interest, 2),
        "daily_equivalent": round(daily_eq, 2),
        "monthly_equivalent": round(monthly_eq, 2),
        "total_receivable": round(total, 2),
    }

def add_days(iso_date: str, days: int) -> str:
    """Add days to an ISO date string, return ISO date string."""
    d = datetime.fromisoformat(iso_date)
    d = d + timedelta(days=int(days))
    return d.date().isoformat()

def days_between(from_iso: str, to_iso: str) -> int:
    """Calculate days between two ISO date strings."""
    a = datetime.fromisoformat(from_iso).date()
    b = datetime.fromisoformat(to_iso).date()
    return (b - a).days

def today_iso() -> str:
    """Return today's date as ISO string."""
    return datetime.now().date().isoformat()
