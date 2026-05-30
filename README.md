# Yoga for Happiness Attendance Backend

## Setup

1. Create tables in Supabase using the SQL in `database/schema.sql`.
2. Copy `.env.example` to `.env` and fill in values.
3. Install dependencies and run:

```bash
npm install
npm run dev
```

## Create Admin User

```bash
npm run create-admin -- --name "Admin" --email admin@example.com --password "YourPassword"
```

## API Overview

- `POST /api/auth/login`
- `GET /api/auth/profile`
- `POST /api/auth/change-password`

- `POST /api/students`
- `GET /api/students`
- `GET /api/students/:id`
- `PUT /api/students/:id`
- `PATCH /api/students/:id/status`

- `POST /api/attendance/sessions`
- `GET /api/attendance/sessions`
- `POST /api/attendance/mark`
- `GET /api/attendance`
- `GET /api/attendance/summary`
