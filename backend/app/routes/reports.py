from fastapi import APIRouter, Depends
from app.db import db
from app.routes.auth import get_current_user_id

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/monthly", response_model=dict)
def monthly_report(user_id: str = Depends(get_current_user_id)):
    """Get monthly report of interest and principal collections."""
    rows = db.query(
        """SELECT to_char(p.payment_date, 'YYYY-MM') AS month,
                  COALESCE(SUM(p.interest_amount), 0) AS interest,
                  COALESCE(SUM(p.principal_amount), 0) AS principal
           FROM payments p
           JOIN loans l ON l.id = p.loan_id
           WHERE l.user_id = %s
           GROUP BY month
           ORDER BY month ASC""",
        (user_id,)
    )
    return {"months": rows}

@router.get("/lifetime", response_model=dict)
def lifetime_report(user_id: str = Depends(get_current_user_id)):
    """Get lifetime report of all lending activities."""
    totals = db.query_one(
        """SELECT COALESCE(SUM(principal), 0) AS total_lent,
                  COUNT(*) AS total_loans,
                  COUNT(*) FILTER (WHERE status = 'active') AS active_loans,
                  COUNT(*) FILTER (WHERE status = 'closed') AS closed_loans
           FROM loans WHERE user_id = %s""",
        (user_id,)
    )
    
    payment_totals = db.query_one(
        """SELECT COALESCE(SUM(p.interest_amount), 0) AS total_interest_earned,
                  COALESCE(SUM(p.principal_amount), 0) AS total_principal_returned
           FROM payments p
           JOIN loans l ON l.id = p.loan_id
           WHERE l.user_id = %s""",
        (user_id,)
    )
    
    payee_count = db.query_one(
        "SELECT COUNT(*) AS total_payees FROM payees WHERE user_id = %s",
        (user_id,)
    )
    
    outstanding = db.query_one(
        """SELECT COALESCE(SUM(l.principal - COALESCE(p_sum.returned, 0)), 0) AS outstanding
           FROM loans l
           LEFT JOIN (
               SELECT loan_id, SUM(principal_amount) AS returned
               FROM payments
               GROUP BY loan_id
           ) p_sum ON p_sum.loan_id = l.id
           WHERE l.user_id = %s AND l.status = 'active'""",
        (user_id,)
    )
    
    return {
        **totals,
        **payment_totals,
        **payee_count,
        "outstanding_principal": outstanding.get("outstanding") or 0,
    }
