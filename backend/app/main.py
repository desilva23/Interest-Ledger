from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
import logging
from typing import Optional
from app.config import get_settings
from app.services.reminderScheduler import start_reminder_scheduler, run_morning_pass, run_evening_pass
from app.routes import auth
from app.db import db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()
app = FastAPI(title="Khata API", version="1.0.0")

# CORS middleware
allowed_origins = ["http://localhost:3000", "http://localhost:3001"]
if settings.allowed_origins:
    allowed_origins.extend([origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()])
elif settings.environment == "production":
    allowed_origins.extend(["https://khata-frontend.vercel.app"])  # Update with your actual domain

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth dependency
def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract user_id from Authorization header (Bearer token)."""
    from app.routes.auth import get_current_user_id as get_user
    return get_user(authorization)

# Include route modules
app.include_router(auth.router)

from app.routes import payees, loans, reports
from app.routes.extensions_payments import ext_router, pay_router

app.include_router(payees.router)
app.include_router(loans.router)
app.include_router(ext_router)
app.include_router(pay_router)
app.include_router(reports.router)

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"ok": True}

@app.post("/api/internal/run-reminders")
async def run_reminders_manual(
    x_reminder_secret: Optional[str] = Header(None),
    reminder_secret: Optional[str] = Header(None),
    pass_type: Optional[str] = None
):
    """
    Trigger reminders manually (called by GitHub Actions or external scheduler).
    Protected by a shared secret.
    """
    token = x_reminder_secret or reminder_secret
    if not settings.reminder_trigger_secret or token != settings.reminder_trigger_secret:
        raise HTTPException(status_code=401, detail="Invalid or missing reminder secret")
    
    if pass_type == "morning":
        run_morning_pass()
    elif pass_type == "evening":
        run_evening_pass()
    else:
        run_morning_pass()
        run_evening_pass()
    
    return {"ok": True, "pass": pass_type or "both"}

@app.on_event("startup")
def startup():
    """Start the reminder scheduler on app startup."""
    logger.info("Starting Khata API...")
    start_reminder_scheduler(app)
    logger.info("Reminder scheduler started")

@app.on_event("shutdown")
def shutdown():
    """Shutdown event."""
    logger.info("Shutting down Khata API...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
