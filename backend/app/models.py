from pydantic import BaseModel, EmailStr, ConfigDict
from pydantic.alias_generators import to_camel
from datetime import date, datetime
from typing import Optional
from uuid import UUID

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

# ============ Auth ============
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    created_at: datetime

class AuthResponse(BaseModel):
    user: UserResponse
    token: str

# ============ Payees ============
class PayeeCreate(BaseModel):
    name: str
    mobile: Optional[str] = None
    notes: Optional[str] = None
    status: str = "active"

class PayeeUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class PayeeResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    mobile: Optional[str]
    notes: Optional[str]
    status: str
    created_at: datetime

# ============ Loans ============
class LoanCreate(CamelModel):
    payee_id: UUID
    principal: float
    interest_rate: float
    interest_type: str
    start_date: date
    duration_days: int
    initial_interest: Optional[float] = None
    notes: Optional[str] = None

class LoanUpdate(CamelModel):
    payee_id: Optional[UUID] = None
    principal: Optional[float] = None
    interest_rate: Optional[float] = None
    interest_type: Optional[str] = None
    start_date: Optional[date] = None
    duration_days: Optional[int] = None
    initial_interest: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class LoanResponse(BaseModel):
    id: UUID
    user_id: UUID
    payee_id: UUID
    principal: float
    interest_rate: float
    interest_type: str
    start_date: date
    initial_duration_days: int
    due_date: date
    initial_interest: float
    extra_interest: float
    status: str
    notes: Optional[str]
    closed_date: Optional[date]
    created_at: datetime

# ============ Extensions ============
class ExtensionCreate(CamelModel):
    loan_id: UUID
    additional_days: int

class ExtensionResponse(BaseModel):
    id: UUID
    loan_id: UUID
    previous_due_date: date
    new_due_date: date
    additional_days: int
    additional_interest: float
    created_at: datetime

# ============ Payments ============
class PaymentCreate(CamelModel):
    loan_id: UUID
    interest_amount: float = 0.0
    principal_amount: float = 0.0
    payment_date: date
    notes: Optional[str] = None

class PaymentResponse(BaseModel):
    id: UUID
    loan_id: UUID
    interest_amount: float
    principal_amount: float
    payment_date: date
    notes: Optional[str]
    created_at: datetime

# ============ Reports ============
class MonthlyReportRow(BaseModel):
    month: str
    interest: float
    principal: float

class LifetimeReportResponse(BaseModel):
    total_lent: float
    total_loans: int
    active_loans: int
    closed_loans: int
    total_interest_earned: float
    total_principal_returned: float
    total_payees: int
    outstanding_principal: float
