# Khata — Lending Ledger

A self-hosted interest tracker for private lenders: payees, multiple loans per
payee, configurable interest (flat / monthly / daily), due-date reminders,
loan extensions, payment tracking, and monthly/lifetime reports — built per
the PRD with Next.js + TypeScript + Tailwind on the frontend and
FastAPI + Python on the backend.

```
khata-app/
├── backend/     FastAPI app, JWT auth, interest engine, email reminders
└── frontend/    Next.js (App Router) + TypeScript + Tailwind UI
```

## 1. Database

Create a Postgres database (a free [Supabase](https://supabase.com) project
works well) and run the schema against it:

```bash
psql "$DATABASE_URL" -f backend/db/schema.sql
```

## 2. Backend

```bash
cd backend
cp .env.example .env     # fill in DATABASE_URL and SECRET_KEY at minimum
python3 -m venv venv
source venv/bin/activate  # on Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py             # http://localhost:8000
```

Endpoints (all under `/api`, except `/api/auth/*` everything requires
`Authorization: Bearer <token>`):

| Resource    | Routes |
|-------------|--------|
| Auth        | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Payees      | `POST /payees`, `GET /payees`, `GET /payees/{id}`, `PUT /payees/{id}`, `DELETE /payees/{id}` |
| Loans       | `POST /loans`, `GET /loans`, `GET /loans/{id}`, `PUT /loans/{id}`, `DELETE /loans/{id}` |
| Extensions  | `POST /loan-extension`, `GET /loan-extension` |
| Payments    | `POST /payments`, `GET /payments` |
| Reports     | `GET /reports/monthly`, `GET /reports/lifetime` |

### Email reminders

The reminder scheduler (`src/services/reminderScheduler.js`) runs two cron
jobs (default 8am and 6pm) that check for loans due tomorrow and today, and
send an email **to your own inbox** with the three reminder types from the
PRD: one day before, due-day morning, due-day evening. Each send is logged
in the `notifications` table so the same reminder is never sent twice in a
day.

**Two ways to enable real emails:**

1. **Resend (recommended, easiest)**: sign up free at [resend.com](https://resend.com),
   create an API key, and set `RESEND_API_KEY` and `REMINDER_TO_EMAIL` (the
   address you signed up with). No domain setup needed — Resend's default sender
   can email you right away. Free tier covers 3,000 emails/month.

2. **Gmail or any SMTP**: if you have a Gmail account, enable
   [2-Step Verification](https://myaccount.google.com/security), create an
   [App Password](https://myaccount.google.com/apppasswords), and set `SMTP_HOST`,
   `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` in `.env`. Leave `RESEND_API_KEY`
   blank; the app will use SMTP instead.

Without either set, reminders are simply logged to the server console — the
app works fully without any email provider account.

The scheduler only runs while the Node process is alive, which is fine on an
always-on paid host. On free hosting (where the server sleeps), use the
GitHub Actions workflow described in the hosting section below instead —
it triggers the same reminder logic externally, so the server doesn't need
to be awake on its own at 8am/6pm.

## 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # point NEXT_PUBLIC_API_URL at your backend
npm install
npm run dev                         # http://localhost:3000
```

Pages: `/login`, `/` (dashboard), `/payees`, `/loans`, `/reports`.

## 4. Hosting it for free

Free tiers change their fine print often, so here's what's actually true as of mid-2026, and the setup that works around the gotchas.

| Piece | Service | What's free | The catch |
|---|---|---|---|
| Frontend | [Vercel](https://vercel.com) | Fully, for personal projects | None worth worrying about |
| Backend API | [Render](https://render.com) free Web Service | Yes, no card needed | Sleeps after 15 min idle; ~1 min cold start on the next request |
| Database | [Supabase](https://supabase.com) free Postgres | Yes, 500MB | Pauses after 7 days with zero activity (data isn't deleted — one click resumes it) |
| Email sending | [Resend](https://resend.com) free tier | Yes, 3,000 emails/month | No domain setup needed (can email your own address immediately); paid plans start at $20/mo |
| Scheduling reminders | **GitHub Actions** (this repo's `.github/workflows/reminders.yml`) | Yes | None — this is what makes the above work despite the sleep/pause behavior |

**Why GitHub Actions for scheduling:** Render's free web service is asleep most of the day, so an in-process cron job (like the one in `reminderScheduler.js`) can't be trusted to fire at 8am/6pm. Instead, this repo exposes `POST /api/internal/run-reminders` — a secret-protected endpoint — and a GitHub Actions workflow pings it twice a day. That ping wakes Render up, runs the reminder check (which sends the emails via Resend), and (as a side effect) touches the database, which also keeps Supabase from pausing. One free mechanism solves three problems.

### Steps

1. **Database**: create a free Supabase project, then run the schema:
   ```bash
   psql "$DATABASE_URL" -f backend/db/schema.sql
   ```
2. **Backend → Render**: push this repo to GitHub, create a new free Web Service on Render pointing at `backend/`, set the root directory to `backend`, set the build command to `pip install -r requirements.txt`, set the start command to `python run.py`, set the env vars from `.env.example` (especially `SECRET_KEY` for JWT signing, and `REMINDER_TRIGGER_SECRET` you make up; optionally set `RESEND_API_KEY` and `REMINDER_TO_EMAIL`), deploy. Note the URL Render gives you.
3. **Frontend → Vercel**: import the same repo, set the root directory to `frontend/`, set `NEXT_PUBLIC_API_URL` to your Render URL, deploy.
4. **Email → Resend (optional)**: sign up free at [resend.com](https://resend.com), create an API key, set `RESEND_API_KEY` and `REMINDER_TO_EMAIL` (the address you signed up with) in Render's env vars, redeploy. Without this, reminders just print to the server console, which is fine to test the whole flow.
5. **Reminders → GitHub Actions**: in your repo's Settings → Secrets and variables → Actions, add `BACKEND_URL` (your Render URL) and `REMINDER_TRIGGER_SECRET` (same value as step 2). The workflow in `.github/workflows/reminders.yml` will then run automatically every day at 8am and 6pm IST — you can also trigger it manually from the Actions tab to test.

That's the whole stack running at $0/month. The only real trade-off: the dashboard takes ~1 minute to load if nobody's used it in the last 15 minutes (Render waking up). Email sending is free via Resend's 3,000/month tier.

## Notes on scope

This is a working MVP scaffold matching the PRD's architecture and feature
set (payees, multi-loan tracking, interest engine, extensions, payments,
reports, email reminders). It intentionally keeps the UI styling simple so
it's easy to extend — for a fully designed, ready-to-use version with no
setup, see the companion in-chat artifact (`khata.jsx`), which runs entirely
in the browser with its own built-in storage.

Things you'd likely want to add before running this for real money:
password-reset email flow, rate limiting, input validation hardening, audit
logging, PDF/Excel export, and tests.
