from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from app.models import PayeeCreate, PayeeUpdate, PayeeResponse
from app.db import db
from app.routes.auth import get_current_user_id

router = APIRouter(prefix="/api/payees", tags=["payees"])

@router.post("/", response_model=dict)
def create_payee(data: PayeeCreate, user_id: str = Depends(get_current_user_id)):
    """Create a new payee."""
    if not data.name:
        raise HTTPException(status_code=400, detail="name is required")
    
    payee = db.query_one(
        """INSERT INTO payees (user_id, name, mobile, notes, status)
           VALUES (%s, %s, %s, %s, %s) RETURNING *""",
        (user_id, data.name, data.mobile, data.notes, data.status or "active")
    )
    return {"payee": payee}

@router.get("/", response_model=dict)
def list_payees(search: Optional[str] = None, user_id: str = Depends(get_current_user_id)):
    """List all payees for the current user, optionally filtered by name."""
    sql = "SELECT * FROM payees WHERE user_id = %s"
    params = [user_id]
    
    if search:
        sql += " AND name ILIKE %s"
        params.append(f"%{search}%")
    
    sql += " ORDER BY created_at DESC"
    payees = db.query(sql, tuple(params))
    return {"payees": payees}

@router.get("/{payee_id}", response_model=dict)
def get_payee(payee_id: str, user_id: str = Depends(get_current_user_id)):
    """Get a specific payee."""
    payee = db.query_one(
        "SELECT * FROM payees WHERE id = %s AND user_id = %s",
        (payee_id, user_id)
    )
    if not payee:
        raise HTTPException(status_code=404, detail="Payee not found")
    return {"payee": payee}

@router.put("/{payee_id}", response_model=dict)
def update_payee(payee_id: str, data: PayeeUpdate, user_id: str = Depends(get_current_user_id)):
    """Update a payee."""
    updates = []
    params = []
    
    if data.name is not None:
        updates.append(f"name = %s")
        params.append(data.name)
    if data.mobile is not None:
        updates.append(f"mobile = %s")
        params.append(data.mobile)
    if data.notes is not None:
        updates.append(f"notes = %s")
        params.append(data.notes)
    if data.status is not None:
        updates.append(f"status = %s")
        params.append(data.status)
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    params.extend([payee_id, user_id])
    sql = f"UPDATE payees SET {', '.join(updates)} WHERE id = %s AND user_id = %s RETURNING *"
    
    payee = db.query_one(sql, tuple(params))
    if not payee:
        raise HTTPException(status_code=404, detail="Payee not found")
    return {"payee": payee}

@router.delete("/{payee_id}")
def delete_payee(payee_id: str, user_id: str = Depends(get_current_user_id)):
    """Delete a payee."""
    result = db.query(
        "DELETE FROM payees WHERE id = %s AND user_id = %s RETURNING id",
        (payee_id, user_id)
    )
    if not result:
        raise HTTPException(status_code=404, detail="Payee not found")
    return {"status": "deleted"}
