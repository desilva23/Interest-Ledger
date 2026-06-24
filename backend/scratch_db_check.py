import os
import sys

# Add app to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import db
from app.routes.auth import verify_password
from app.config import get_settings

def check():
    settings = get_settings()
    print(f"DATABASE_URL in settings: {settings.database_url}")
    users = db.query("SELECT id, name, email, password_hash FROM users")
    print(f"Total users in DB: {len(users)}")
    for u in users:
        print(f"User: {u['name']}, Email: {u['email']}, Hash: {u['password_hash']}")
        # Test verification with a common password if we want, or just check the length of hash
        print(f"Hash length: {len(u['password_hash'])}")

if __name__ == "__main__":
    check()
