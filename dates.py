"""
Small pure date-math helpers shared by the dashboard (month navigation)
and the reports page (rolling N-month windows). Kept dependency-free and
separate from app.py so they're trivially unit-testable on their own.
"""


def shift_month(year, month, delta):
    """(2026, 1, -1) -> (2025, 12); (2026, 12, 1) -> (2027, 1)."""
    idx = year * 12 + (month - 1) + delta
    return idx // 12, idx % 12 + 1


def month_bounds(month_str):
    """'2026-09' -> ('2026-09-01', '2026-10-01') half-open range for SQL."""
    year, mo = (int(p) for p in month_str.split("-"))
    start = f"{year:04d}-{mo:02d}-01"
    ny, nm = shift_month(year, mo, 1)
    end = f"{ny:04d}-{nm:02d}-01"
    return start, end
