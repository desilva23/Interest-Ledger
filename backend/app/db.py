import psycopg2
from psycopg2.extras import DictCursor, RealDictCursor
from typing import Any, List, Tuple
from app.config import get_settings

class Database:
    def __init__(self):
        self.settings = get_settings()
    
    def get_connection(self):
        """Get a raw connection to the database."""
        return psycopg2.connect(self.settings.database_url)
    
    def query(self, sql: str, params: Tuple = None) -> List[dict]:
        """Execute a query and return rows as dicts."""
        conn = self.get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params)
                rows = cur.fetchall()
            conn.commit()
            return rows
        finally:
            conn.close()
    
    def query_one(self, sql: str, params: Tuple = None) -> dict | None:
        """Execute a query and return a single row as dict."""
        conn = self.get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params)
                row = cur.fetchone()
            conn.commit()
            return row
        finally:
            conn.close()
    
    def execute(self, sql: str, params: Tuple = None) -> None:
        """Execute a non-SELECT query (INSERT, UPDATE, DELETE)."""
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params)
            conn.commit()
        finally:
            conn.close()
    
    def execute_many(self, sql: str, params_list: List[Tuple]) -> None:
        """Execute multiple statements in a transaction."""
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                for params in params_list:
                    cur.execute(sql, params)
            conn.commit()
        finally:
            conn.close()
    
    def transaction(self):
        """Context manager for transactions."""
        return TransactionManager(self.settings.database_url)

class TransactionManager:
    """Manages a database transaction."""
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.conn = None
        self.cur = None
    
    def __enter__(self):
        self.conn = psycopg2.connect(self.database_url)
        self.cur = self.conn.cursor(cursor_factory=RealDictCursor)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.conn.rollback()
        else:
            self.conn.commit()
        if self.cur:
            self.cur.close()
        if self.conn:
            self.conn.close()
    
    def execute(self, sql: str, params: Tuple = None) -> None:
        self.cur.execute(sql, params)
    
    def query(self, sql: str, params: Tuple = None) -> List[dict]:
        self.cur.execute(sql, params)
        return self.cur.fetchall()
    
    def query_one(self, sql: str, params: Tuple = None) -> dict | None:
        self.cur.execute(sql, params)
        return self.cur.fetchone()

db = Database()
