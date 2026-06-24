import httpx
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

settings = get_settings()

is_resend_configured = bool(settings.resend_api_key and settings.reminder_to_email)
is_smtp_configured = bool(settings.smtp_host and settings.smtp_user and settings.smtp_pass and settings.reminder_to_email)

smtp_transport = None
if not is_resend_configured and is_smtp_configured:
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        # We'll use it on-demand in send_email_reminder
    except ImportError:
        logger.warning("smtplib not available for SMTP fallback")

async def send_email_reminder(subject: str, body: str) -> dict:
    """
    Send a reminder email. Tries Resend first, falls back to SMTP,
    then just logs if neither configured.
    """
    if is_resend_configured:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.resend_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": settings.reminder_from_email,
                        "to": [settings.reminder_to_email],
                        "subject": subject,
                        "text": body,
                    },
                    timeout=10,
                )
                data = response.json() if response.text else {}
                if response.status_code < 300:
                    return {"sent": True, "id": data.get("id")}
                else:
                    error = data.get("message", f"Resend responded with {response.status_code}")
                    logger.error(f"Resend email failed: {error}")
                    return {"sent": False, "reason": error}
        except Exception as err:
            logger.error(f"Failed to send email via Resend: {err}")
            return {"sent": False, "reason": str(err)}
    
    if is_smtp_configured:
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            msg = MIMEMultipart()
            msg["From"] = settings.smtp_user
            msg["To"] = settings.reminder_to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))
            
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
                server.login(settings.smtp_user, settings.smtp_pass)
                server.send_message(msg)
            
            return {"sent": True, "id": msg["Message-ID"]}
        except Exception as err:
            logger.error(f"Failed to send email via SMTP: {err}")
            return {"sent": False, "reason": str(err)}
    
    logger.info(f"[email:not-configured] Would have sent \"{subject}\":\n{body}")
    return {"sent": False, "reason": "No email provider configured"}
