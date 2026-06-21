# AI-Powered Evangadi Forum

A full-stack community forum with AI-powered features built on React + Vite (frontend), Express (backend), and MySQL. Supports semantic question search, AI draft coaching, answer-fit evaluation, and a RAG knowledge base pipeline.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Security Configuration](#security-configuration)
- [API Overview](#api-overview)
- [Team Members](#team-members)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, React Router v6, Axios, Framer Motion |
| Backend | Node.js, Express 5, express-validator, helmet, express-rate-limit |
| Database | MySQL 8, mysql2/promise |
| Auth | JWT (jsonwebtoken), bcryptjs |
| AI | Google Gemini (`gemini-embedding-001`, `gemini-2.5-flash-lite`) |
| Email | Resend |
| File Upload | Multer, pdf-parse |

---

## Project Structure

```text
ai-powered-forum-project/
├── backend/
│   ├── db/
│   │   ├── config.js          # MySQL pool + safeExecute wrapper
│   │   └── schema.sql         # Full schema (all 8 tables)
│   ├── scripts/
│   │   └── reembed-questions.js
│   ├── src/
│   │   ├── api/
│   │   │   ├── auth/          # Register, login, email verify, password reset
│   │   │   ├── answer/        # Post answer
│   │   │   ├── question/      # CRUD, semantic search, similar, draft coach
│   │   │   └── questions/     # Answer-fit evaluation
│   │   ├── middleware/
│   │   │   ├── authentication.js
│   │   │   ├── error-handler.js
│   │   │   └── validation-handler.js
│   │   └── utils/
│   │       ├── errors/
│   │       └── mailer.js
│   ├── index.js               # Entry point — security middleware wired here
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # Layout, Navbar, Sidebar, ProtectedRoute, AIDraftCoach
│   │   ├── contexts/          # AuthContext
│   │   ├── hooks/             # useAICoach
│   │   ├── pages/             # Landing, Auth, Dashboard, PostQuestion, QuestionDetail, MyQuestions
│   │   └── services/          # api.client.js, auth.service.js, question.service.js
│   └── package.json
├── docs/
│   └── implementation.html    # Full implementation documentation
├── plans/                     # Feature planning documents
└── tasks/                     # Milestone task breakdowns
```

---

## Environment Variables

### Backend — `backend/.env`

Copy `backend/.env.example` and fill in all **Required** values before starting the server. The server will refuse to start if any required variable is missing.

#### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3777` | Port the Express server listens on |
| `NODE_ENV` | No | — | Set to `production` in deployed environments. Controls dev-only logging (e.g. token links are only printed to stdout when this is NOT `production`). |

#### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | **Yes** | — | MySQL host (e.g. `127.0.0.1` or a cloud hostname) |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_USER` | **Yes** | — | MySQL username |
| `DB_PASSWORD` | **Yes** | — | MySQL password |
| `DB_NAME` | No | `evangadi_forum` | Database name |

#### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | — | Secret used to sign and verify all JWTs. Use a long random string (32+ chars). Never commit this value. |
| `JWT_EXPIRES_IN` | No | `1d` | How long login tokens remain valid (e.g. `1d`, `7d`, `2h`). |
| `EMAIL_CONFIRM_EXPIRES_IN` | No | `24h` | How long email confirmation links remain valid. |
| `PASSWORD_RESET_EXPIRES_IN` | No | `15m` | How long password reset links remain valid. Shorter is more secure. |

#### Email (Resend)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | **Yes** (for email) | — | API key from [resend.com](https://resend.com). Without this, registration and password reset will still work but no emails will be delivered. |
| `EMAIL_FROM` | No | — | Sender address shown in emails, e.g. `Evangadi Forum <noreply@yourdomain.com>`. Must be a verified domain in Resend for production delivery. |
| `FRONTEND_URL` | No | `http://localhost:5001` | Base URL prepended to email confirmation and password reset links. **Must be set in production** so links point to the live domain. |

> **Resend sandbox mode:** In development, Resend restricts delivery to your own verified email address. Set `NODE_ENV` to anything other than `production` and the server will print confirmation/reset links to stdout so you can test without real email delivery.

#### AI (Gemini)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | **Yes** (for AI features) | — | API key from [Google AI Studio](https://aistudio.google.com). Without this key, semantic search falls back to keyword search and AI features return graceful empty responses. |
| `GEMINI_EMBEDDING_MODEL` | No | `gemini-embedding-001` | Embedding model — produces 768-dimensional vectors. |
| `GEMINI_TEXT_MODEL` | No | `gemini-2.5-flash-lite` | Text generation model used for AI answers, draft coach, and answer fit. |

#### RAG Pipeline (Knowledge Base)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RAG_UPLOAD_DIR` | No | `uploads/rag` | Local filesystem path where uploaded PDFs are stored. Create this directory before uploading. |
| `RAG_MAX_UPLOAD_MB` | No | `5` | Maximum PDF file size in megabytes. |
| `RAG_CHUNK_CHARS` | No | `900` | Character length of each text chunk when splitting a document. |
| `RAG_CHUNK_OVERLAP` | No | `120` | Overlapping characters between adjacent chunks for context continuity. |
| `RAG_MAX_CHUNKS_PER_DOC` | No | `1000` | Hard cap on chunks per document to prevent runaway processing. |
| `RAG_MAX_PDFS_PER_USER` | No | `20` | Maximum number of documents a single user can upload. |
| `RAG_MIN_TEXT_CHARS` | No | `50` | Minimum extracted text length — PDFs below this threshold are rejected as unreadable. |
| `RAG_SEARCH_THRESHOLD` | No | `0.45` | Cosine similarity threshold for RAG chunk retrieval (lower than question search because chunk text is shorter). |
| `RAG_SEARCH_K` | No | `10` | Number of top chunks returned per RAG search. |

### Frontend — `frontend/.env.local`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | `http://localhost:3777` | Backend API base URL. Change this if the backend runs on a different host or port. |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- MySQL 8

### 1. Clone

```bash
git clone https://github.com/desta-getaw/ai-powered-forum-project.git
cd ai-powered-forum-project
```

### 2. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Set up environment variables

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — fill in DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET at minimum
```

### 4. Create the database

```bash
mysql -u <user> -p -e "CREATE DATABASE IF NOT EXISTS evangadi_forum CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u <user> -p evangadi_forum < backend/db/schema.sql
```

### 5. Start both servers

Open two terminals:

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Backend runs on `http://localhost:3777` (or `PORT` from your `.env`).  
Frontend runs on `http://localhost:5001` by default.

---

## Available Scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (hot reload) |
| `npm start` | Start with Node (production) |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

### Maintenance

```bash
# Re-embed all questions after changing model or fixing failed rows
node backend/scripts/reembed-questions.js
```

---

## Security Configuration

The following security controls are active. Some require environment variable configuration to be effective in production.

### HTTP Security Headers (helmet)

`helmet` is applied globally and sets `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, and `Referrer-Policy` on every response. No configuration required — active by default.

### CORS

The API only accepts requests from the origin defined in `FRONTEND_URL` (defaults to `http://localhost:5001` in development). **Set `FRONTEND_URL` in production** to your real domain or the API will reject requests from your deployed frontend.

### Rate Limiting

Per-route limits are applied to all auth endpoints to prevent brute-force and email spam attacks:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/auth/login` | 10 requests | 15 minutes |
| `POST /api/auth/register` | 5 requests | 1 hour |
| `POST /api/auth/forgot-password` | 5 requests | 1 hour |
| `POST /api/auth/confirm-email` | 10 requests | 15 minutes |
| `POST /api/auth/reset-password` | 10 requests | 15 minutes |
| All other `/api/*` routes | 200 requests | 15 minutes |

Limits are per-IP. In production behind a reverse proxy (Nginx, Render, Railway), set `app.set('trust proxy', 1)` so the real client IP is used instead of the proxy IP.

### Body Size Limit

Request bodies are capped at **50 KB** on all routes. Content fields sent to the Gemini API (question body, answer draft) are additionally validated to a maximum of **10,000 characters** at the validator layer.

### Password Policy

Passwords must be at least **8 characters**. This applies to both registration and password reset.

### Token Security

- Email confirmation tokens expire after `EMAIL_CONFIRM_EXPIRES_IN` (default 24 hours).
- Password reset tokens expire after `PASSWORD_RESET_EXPIRES_IN` (default 15 minutes).
- In **development** (`NODE_ENV` ≠ `production`), confirmation and reset links are printed to stdout for local testing. In production these logs are suppressed — links are only delivered via email.

### SQL Injection

All database calls go through the `safeExecute` wrapper which enforces parameterized queries via `mysql2`'s `pool.execute`. No string interpolation is used in SQL anywhere in the codebase.

---

## API Overview

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | Public | Create account + send confirmation email |
| `POST` | `/auth/login` | Public | Authenticate + receive JWT |
| `POST` | `/auth/confirm-email` | Public | Verify email from token |
| `POST` | `/auth/forgot-password` | Public | Request password reset email |
| `POST` | `/auth/reset-password` | Public | Set new password from token |
| `GET` | `/questions` | Protected | List questions (keyword + mine filter) |
| `POST` | `/questions` | Protected | Create question (triggers async embedding) |
| `GET` | `/questions/search` | Protected | AI semantic search |
| `POST` | `/questions/draft-coach` | Protected | AI feedback on question draft |
| `GET` | `/questions/:hash` | Protected | Get question + all answers |
| `GET` | `/questions/:hash/similar` | Protected | Related questions by vector similarity |
| `POST` | `/questions/:hash/answer-fit` | Protected | Score a draft answer 0–100 |
| `POST` | `/answers` | Protected | Post an answer |
| `GET` | `/health` | Public | Server health check |

---

## Team Members

| No. | Name | Email | Role |
|-----|------|-------|------|
| 1 | Anteneh Alemayehu | antenehmekuriaw@gmail.com | Team Lead |
| 2 | Destaw Getaw | destage.29@gmail.com | Team Lead |
| 3 | Sofanit Dejene | sofanitdejene@gmail.com | Collaborator |
| 4 | Melese Shukuro | Meleseshukuro@gmail.com | Collaborator |
| 5 | Haymanot Birara | haymibirara7@gmail.com | Collaborator |
| 6 | Waganesh Wogaye | waganeshadmase@gmail.com | Collaborator |
| 7 | Abayneh Mekonnen | abayneh1999@gmail.com | Collaborator |
| 8 | Gedamu Mersha | gedamumersha27@gmail.com | Collaborator |
| 9 | Fiteh Tesfaye | fitehtesfaye@gmail.com | Collaborator |
| 10 | Kena Tolcha | kenatolcha445@gmail.com | Collaborator |
| 11 | Solome Zewdu | solomezewdu125@gmail.com | Collaborator |
| 12 | Amanawit Geremew | Amanawit.22@gmail.com | Collaborator |
| 13 | Mesud Ali | mesud3818@gmail.com | Collaborator |
