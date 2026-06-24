import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from app.db import db
from app.services.email import send_email_reminder
from app.utils.interestEngine import today_iso, add_days
import logging

logger = logging.getLogger(__name__)

def build_email(reminder_type: str, loan: dict) -> dict:
    """Build subject and body for a reminder email."""
    interest_due = float(loan.get("initial_interest", 0)) + float(loan.get("extra_interest", 0))
    amount = f"₹{int(interest_due):,}"
    principal = f"₹{int(loan.get('principal', 0)):,}"
    payee_name = loan.get("payee_name", "Unknown payee")
    due_date = loan.get("due_date_str", "")
    
    if reminder_type == "one_day_before":
        return {
            "subject": f"Due tomorrow: {payee_name}'s loan ({amount} interest)",
            "body": f"{payee_name}'s loan is due tomorrow, {due_date}.\n\nPrincipal: {principal}\nInterest due: {amount}"
        }
    elif reminder_type == "due_morning":
        return {
            "subject": f"Collect today: {payee_name} — {amount}",
            "body": f"Collection Reminder\n\n{payee_name}\nPrincipal: {principal}\nInterest: {amount}\nDue: Today"
        }
    else:  # due_evening
        return {
            "subject": f"Still pending: {payee_name}'s payment was due today",
            "body": f"{payee_name}'s payment was due today and hasn't been marked as collected yet in Khata.\n\nPrincipal: {principal}\nInterest due: {amount}"
        }

async def send_if_not_already_sent(loan: dict, reminder_type: str, reminder_date: str) -> None:
    """Send a reminder if it hasn't been sent for this date already."""
    existing = db.query(
        "SELECT id FROM notifications WHERE loan_id = %s AND reminder_type = %s AND reminder_date = %s",
        (str(loan["id"]), reminder_type, reminder_date)
    )
    if existing:
        return  # Already sent
    
    email_parts = build_email(reminder_type, loan)
    result = await send_email_reminder(email_parts["subject"], email_parts["body"])
    
    # Record the attempt
    db.execute(
        """INSERT INTO notifications (loan_id, reminder_type, reminder_date, sent_status)
           VALUES (%s, %s, %s, %s)
           ON CONFLICT (loan_id, reminder_type, reminder_date) DO NOTHING""",
        (str(loan["id"]), reminder_type, reminder_date, "sent" if result.get("sent") else "failed")
    )

def fetch_loans_due_on(date_iso: str) -> list:
    """Fetch active loans due on a specific date."""
    rows = db.query(
        """SELECT l.*, p.name as payee_name
           FROM loans l JOIN payees p ON p.id = l.payee_id
           WHERE l.status = 'active' AND l.due_date = %s::DATE""",
        (date_iso,)
    )
    # Convert date objects to strings
    for row in rows:
        if row.get("due_date"):
            row["due_date_str"] = str(row["due_date"])
    return rows

async def run_morning_pass_async() -> None:
    """Run the morning reminder pass asynchronously."""
    today = today_iso()
    tomorrow = add_days(today, 1)
    
    # Loans due tomorrow
    due_tomorrow = fetch_loans_due_on(tomorrow)
    for loan in due_tomorrow:
        await send_if_not_already_sent(loan, "one_day_before", today)
    
    # Loans due today (morning)
    due_today = fetch_loans_due_on(today)
    for loan in due_today:
        await send_if_not_already_sent(loan, "due_morning", today)
    
    logger.info(f"[reminders] morning pass: {len(due_tomorrow)} due tomorrow, {len(due_today)} due today")

def run_morning_pass() -> None:
    """Run the morning reminder pass synchronously (called by APScheduler)."""
    asyncio.run(run_morning_pass_async())

async def run_evening_pass_async() -> None:
    """Run the evening reminder pass asynchronously."""
    today = today_iso()
    due_today = fetch_loans_due_on(today)
    for loan in due_today:
        await send_if_not_already_sent(loan, "due_evening", today)
    
    logger.info(f"[reminders] evening pass: {len(due_today)} still due today")

def run_evening_pass() -> None:
    """Run the evening reminder pass synchronously (called by APScheduler)."""
    asyncio.run(run_evening_pass_async())

def start_reminder_scheduler(app) -> None:
    """Start the APScheduler-based reminder scheduler."""
    scheduler = BackgroundScheduler()
    
    # Default times: 8am and 6pm
    scheduler.add_job(run_morning_pass, 'cron', hour=8, minute=0, id='morning_reminders')
    scheduler.add_job(run_evening_pass, 'cron', hour=18, minute=0, id='evening_reminders')
    
    scheduler.start()
    logger.info("[reminders] scheduler started — morning (8:00) and evening (18:00)")
    
    # Ensure scheduler shuts down when app stops
    def shutdown_scheduler():
        scheduler.shutdown()
    
    app.add_event_handler("shutdown", shutdown_scheduler)
