from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    """App configuration from environment variables."""
    
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_days: int = 30
    
    # Email
    resend_api_key: str = ""
    reminder_from_email: str = "Khata <onboarding@resend.dev>"
    reminder_to_email: str = ""
    
    # SMTP (fallback)
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_pass: str = ""
    
    # Reminders
    reminder_trigger_secret: str = ""
    
    environment: str = "development"
    port: int = 8000
    allowed_origins: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    return Settings()
