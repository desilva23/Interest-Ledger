-- Khata database schema
-- Run with: psql "$DATABASE_URL" -f backend/db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  mobile     TEXT,
  notes      TEXT,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payees_user ON payees(user_id);

CREATE TABLE IF NOT EXISTS loans (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payee_id             UUID NOT NULL REFERENCES payees(id) ON DELETE CASCADE,
  principal            NUMERIC(14, 2) NOT NULL CHECK (principal >= 0),
  interest_rate        NUMERIC(6, 3) NOT NULL CHECK (interest_rate >= 0),
  interest_type        TEXT NOT NULL CHECK (interest_type IN ('flat', 'monthly', 'daily')),
  start_date           DATE NOT NULL,
  initial_duration_days INTEGER NOT NULL CHECK (initial_duration_days > 0),
  due_date             DATE NOT NULL,
  initial_interest     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  extra_interest       NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  notes                TEXT,
  closed_date          DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_payee ON loans(payee_id);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON loans(due_date);

CREATE TABLE IF NOT EXISTS extensions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id            UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  previous_due_date  DATE NOT NULL,
  new_due_date       DATE NOT NULL,
  additional_days    INTEGER NOT NULL CHECK (additional_days > 0),
  additional_interest NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extensions_loan ON extensions(loan_id);

CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id           UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  interest_amount   NUMERIC(14, 2) NOT NULL DEFAULT 0,
  principal_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_date      DATE NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id       UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('one_day_before', 'due_morning', 'due_evening')),
  reminder_date DATE NOT NULL,
  sent_status   TEXT NOT NULL DEFAULT 'pending' CHECK (sent_status IN ('pending', 'sent', 'failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loan_id, reminder_type, reminder_date)
);
CREATE INDEX IF NOT EXISTS idx_notifications_loan ON notifications(loan_id);
