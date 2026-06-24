from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from app.models import ExtensionCreate, PaymentCreate
from app.db import db
from app.routes.auth import get_current_user_id
from app.utils.interestEngine import calc_interest, add_days

# ============ Extensions Router ============
ext_router = APIRouter(prefix="/api/loan-extension", tags=["extensions"])

@ext_router.post("/", response_model=dict)
def create_extension(data: ExtensionCreate, user_id: str = Depends(get_current_user_id)):
    """Extend a loan's due date."""
    loan = db.query_one("SELECT * FROM loans WHERE id = %s AND user_id = %s", (str(data.loan_id), user_id))
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] == "closed":
        raise HTTPException(status_code=400, detail="Closed loans can't be extended")
    
    result = calc_interest(loan["principal"], loan["interest_rate"], loan["interest_type"], data.additional_days)
    new_due = add_days(str(loan["due_date"]), data.additional_days)
    
    # Transaction
    with db.transaction() as txn:
        extension = txn.query_one(
            """INSERT INTO extensions (loan_id, previous_due_date, new_due_date, additional_days, additional_interest)
               VALUES (%s, %s, %s, %s, %s) RETURNING *""",
            (str(loan["id"]), loan["due_date"], new_due, data.additional_days, result["interest"])
        )
        txn.execute(
            "UPDATE loans SET due_date = %s, extra_interest = extra_interest + %s WHERE id = %s",
            (new_due, result["interest"], str(loan["id"]))
        )
    
    return {"extension": extension, "loan": loan}

@ext_router.get("/", response_model=dict)
def list_extensions(loanId: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """List extensions for loans owned by the current user."""
    sql = """SELECT e.* FROM extensions e 
             JOIN loans l ON l.id = e.loan_id 
             WHERE l.user_id = %s"""
    params = [user_id]
    
    if loanId:
        sql += " AND e.loan_id = %s"
        params.append(loanId)
    
    sql += " ORDER BY e.created_at DESC"
    extensions = db.query(sql, tuple(params))
    return {"extensions": extensions}

# ============ Payments Router ============
pay_router = APIRouter(prefix="/api/payments", tags=["payments"])

@pay_router.post("/", response_model=dict)
def create_payment(data: PaymentCreate, user_id: str = Depends(get_current_user_id)):
    """Record a payment and auto-close loan if principal fully repaid."""
    loan = db.query_one("SELECT * FROM loans WHERE id = %s AND user_id = %s", (str(data.loan_id), user_id))
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    total_amount = data.interest_amount + data.principal_amount
    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="Enter an amount towards interest, principal, or both")
    
    with db.transaction() as txn:
        payment = txn.query_one(
            """INSERT INTO payments (loan_id, interest_amount, principal_amount, payment_date, notes)
               VALUES (%s, %s, %s, %s, %s) RETURNING *""",
            (str(loan["id"]), data.interest_amount, data.principal_amount, data.payment_date, data.notes)
        )
        
        # Check if principal is fully repaid
        total_principal_returned = txn.query_one(
            "SELECT COALESCE(SUM(principal_amount), 0) AS total FROM payments WHERE loan_id = %s",
            (str(loan["id"]),)
        )
        
        if total_principal_returned["total"] >= loan["principal"] and loan["status"] != "closed":
            txn.execute(
                "UPDATE loans SET status = 'closed', closed_date = %s WHERE id = %s",
                (data.payment_date, str(loan["id"]))
            )
    
    return {"payment": payment}

@pay_router.get("/", response_model=dict)
def list_payments(loanId: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """List payments for loans owned by the current user."""
    sql = """SELECT p.* FROM payments p 
             JOIN loans l ON l.id = p.loan_id 
             WHERE l.user_id = %s"""
    params = [user_id]
    
    if loanId:
        sql += " AND p.loan_id = %s"
        params.append(loanId)
    
    sql += " ORDER BY p.payment_date DESC"
    payments = db.query(sql, tuple(params))
    return {"payments": payments}
