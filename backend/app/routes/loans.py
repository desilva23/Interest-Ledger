from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import date
from app.models import LoanCreate, LoanUpdate
from app.db import db
from app.routes.auth import get_current_user_id
from app.utils.interestEngine import calc_interest, add_days

router = APIRouter(prefix="/api/loans", tags=["loans"])

@router.post("/", response_model=dict)
def create_loan(data: LoanCreate, user_id: str = Depends(get_current_user_id)):
    """Create a new loan with calculated interest."""
    payee = db.query_one("SELECT id FROM payees WHERE id = %s AND user_id = %s", (str(data.payee_id), user_id))
    if not payee:
        raise HTTPException(status_code=404, detail="Payee not found")
    
    due_date = add_days(data.start_date.isoformat(), data.duration_days)
    
    if data.initial_interest is not None:
        initial_interest = data.initial_interest
    else:
        result = calc_interest(data.principal, data.interest_rate, data.interest_type, data.duration_days)
        initial_interest = result["interest"]
    
    loan = db.query_one(
        """INSERT INTO loans (user_id, payee_id, principal, interest_rate, interest_type,
                             start_date, initial_duration_days, due_date, initial_interest, notes)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *""",
        (user_id, str(data.payee_id), data.principal, data.interest_rate, data.interest_type,
         data.start_date, data.duration_days, due_date, initial_interest, data.notes)
    )
    return {"loan": loan}

@router.get("/", response_model=dict)
def list_loans(status: Optional[str] = None, payeeId: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """List loans for the current user."""
    sql = "SELECT * FROM loans WHERE user_id = %s"
    params = [user_id]
    
    if status:
        sql += " AND status = %s"
        params.append(status)
    if payeeId:
        sql += " AND payee_id = %s"
        params.append(payeeId)
    
    sql += " ORDER BY due_date ASC"
    loans = db.query(sql, tuple(params))
    return {"loans": loans}

@router.get("/{loan_id}", response_model=dict)
def get_loan(loan_id: str, user_id: str = Depends(get_current_user_id)):
    """Get a specific loan."""
    loan = db.query_one("SELECT * FROM loans WHERE id = %s AND user_id = %s", (loan_id, user_id))
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return {"loan": loan}

@router.put("/{loan_id}", response_model=dict)
def update_loan(loan_id: str, data: LoanUpdate, user_id: str = Depends(get_current_user_id)):
    """Update a loan (all fields)."""
    loan = db.query_one("SELECT * FROM loans WHERE id = %s AND user_id = %s", (loan_id, user_id))
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    payee_id = str(data.payee_id) if data.payee_id is not None else loan["payee_id"]
    principal = data.principal if data.principal is not None else float(loan["principal"])
    interest_rate = data.interest_rate if data.interest_rate is not None else float(loan["interest_rate"])
    interest_type = data.interest_type if data.interest_type is not None else loan["interest_type"]
    start_date = data.start_date if data.start_date is not None else loan["start_date"]
    duration_days = data.duration_days if data.duration_days is not None else loan["initial_duration_days"]
    notes = data.notes if data.notes is not None else loan["notes"]
    status = data.status if data.status is not None else loan["status"]
    
    due_date = add_days(start_date.isoformat() if hasattr(start_date, "isoformat") else str(start_date), duration_days)
    
    if data.initial_interest is not None:
        initial_interest = data.initial_interest
    elif data.principal is not None or data.interest_rate is not None or data.interest_type is not None or data.duration_days is not None:
        result = calc_interest(principal, interest_rate, interest_type, duration_days)
        initial_interest = result["interest"]
    else:
        initial_interest = float(loan["initial_interest"])
        
    closed_date = None
    if status == "closed":
        closed_date = loan["closed_date"] or date.today()
        
    updated = db.query_one(
        """UPDATE loans SET
             payee_id = %s, principal = %s, interest_rate = %s, interest_type = %s,
             start_date = %s, initial_duration_days = %s, due_date = %s, initial_interest = %s,
             notes = %s, status = %s, closed_date = %s
           WHERE id = %s AND user_id = %s RETURNING *""",
        (payee_id, principal, interest_rate, interest_type, start_date, duration_days,
         due_date, initial_interest, notes, status, closed_date, loan_id, user_id)
    )
    
    return {"loan": updated}

@router.delete("/{loan_id}")
def delete_loan(loan_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a loan (and related payments/extensions)."""
    db.execute("DELETE FROM loans WHERE id = %s AND user_id = %s", (loan_id, user_id))
    return {"status": "deleted"}
