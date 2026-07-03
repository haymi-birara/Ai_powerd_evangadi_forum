# Deploying to Hostinger as a Node.js App (no VPS)

This uses Hostinger's **Node.js application** feature in hPanel (Passenger-based) on a
**Business Web Hosting** or **Cloud** plan — no VPS, no server admin.

**How it works here:** the Express backend now **also serves the built React frontend**
(see `backend/index.js` — it serves `frontend/dist` and falls back to `index.html` for
SPA routes). So the whole thing is **one Node app**: the API lives at `/api/*`, and every
other path returns the React app. That's exactly the single-app shape Hostinger's Node.js
hosting expects.

```
https://yourdomain.com
  ├─ /api/*   → Express routes
  └─ /*       → React SPA (frontend/dist/index.html)
```

---

## 0. Prerequisite — confirm your plan has Node.js

In **hPanel**, look for **Advanced → Node.js** (a.k.a. "Setup Node.js App").
- If it's there → ✅ continue.
- If not → your plan doesn't support Node.js. It's available on **Business Web Hosting**
  and **Cloud** plans (upgrade, or use the VPS path in `DEPLOY.md`).

You'll also want (same as any deploy): a **domain**, a **Gemini API key** (billing on),
and a **Resend API key** + verified sending domain.

---

## 1. Create the MySQL database

hPanel → **Databases → MySQL Databases**:
- Create a database — note the **name** (it'll be prefixed, e.g. `u123456789_evangadi`)
- Create a **user** + strong password, and **add the user to the database**
- The DB **host** is usually `localhost`

Then load the schema + the changelog migration via **hPanel → phpMyAdmin** → select your DB
→ **Import**, running these files in order (from this repo, `backend/db/`):
1. `db/schema.sql`
2. `db/migrations/002_changelog_releases_up.sql`

> **Do NOT import migration `001` on a fresh database.** `schema.sql` already includes its
> five tables and the `users.trust_score` / `role` columns, so 001's `ALTER … ADD COLUMN`
> would fail with *"Duplicate column name"* and abort the import. Migration `001` is only
> for upgrading an **older** pre-trust database.
>
> `002` adds the `users.last_seen_release_id` column (which `schema.sql` doesn't have) and
> **seeds the "What's New" changelog** with 7 entries — so import it **exactly once**. Its
> `ALTER` and seed aren't idempotent, so re-importing errors (duplicate column / unique
> `version`).

---

## 2. Build the frontend (point it at your domain)

Locally, before uploading:

```bash
echo "VITE_API_BASE_URL=https://yourdomain.com" > frontend/.env.production
cd frontend && npm install && npm run build && cd ..
```

> Set the base URL to your real domain (it's same-origin, so this just makes the SPA call
> `https://yourdomain.com/api/...`). Don't leave it empty — the code falls back to
> `localhost:5004` for an empty value.

---

## 3. Upload the code to the server

**Option A — SSH (Business/Cloud plans have it):**
```bash
ssh u123456789@yourdomain.com        # creds in hPanel → Advanced → SSH Access
cd ~
git clone https://github.com/Kingspark/ai-powered-disc-forum.git evangadi
cd evangadi
cd frontend && npm install && npm run build && cd ..   # build on server
mkdir -p backend/uploads
```

**Option B — no SSH (File Manager):** zip the repo locally **including `frontend/dist`**
(but exclude `node_modules`), upload via hPanel **File Manager**, and extract into a folder
like `~/evangadi`. Create an empty `backend/uploads` folder.

Keep the repo structure intact — `backend/` and `frontend/` must stay siblings, because the
backend serves `../frontend/dist`.

---

## 4. Create the Node.js application (hPanel)

hPanel → **Advanced → Node.js → Create application**:

| Field | Value |
|---|---|
| **Node.js version** | 20 (or 18) |
| **Application mode** | Production |
| **Application root** | the **backend** folder, e.g. `evangadi/backend` |
| **Application URL** | `yourdomain.com` |
| **Application startup file** | `index.js` |

Create it. hPanel sets up the app and an isolated Node environment.

---

## 5. Set environment variables

In the Node.js app screen there's an **Environment variables** section. Add (generate the
JWT secret locally with `openssl rand -hex 32`):

```
NODE_ENV         = production
FRONTEND_URL     = https://yourdomain.com
DB_HOST          = localhost
DB_PORT          = 3306
DB_USER          = u123456789_evangadi
DB_PASSWORD      = your_db_password
DB_NAME          = u123456789_evangadi
JWT_SECRET       = <openssl rand -hex 32 output>
JWT_EXPIRES_IN   = 1d
GEMINI_API_KEY   = your_gemini_key
RESEND_API_KEY   = your_resend_key
```

> Don't set `PORT` — Passenger assigns it and the app reads `process.env.PORT`
> automatically. (Alternatively you can put all of these in a `backend/.env` file; the app
> loads dotenv. The hPanel UI is cleaner.)

---

## 6. Install dependencies & start

In the Node.js app screen:
1. Click **Run NPM Install** (installs `backend/` dependencies). The frontend is already
   built, so it needs no runtime install.
2. Click **Restart** / **Start**.
3. Open the **log** — you want `Database connection established` and `Server running`.

---

## 7. Domain + SSL

- Make sure the domain points to this hosting (hPanel → Domains).
- hPanel → **SSL** → enable the free Let's Encrypt certificate (often automatic).

Visit **https://yourdomain.com** — the app should load, and login/questions/RAG should work.

---

## 8. Verify

- [ ] Site loads at your domain (React SPA)
- [ ] Register → confirmation email arrives (Resend)
- [ ] Log in → dashboard loads questions (no "Unable to connect")
- [ ] Post a question → moderation runs (Gemini)
- [ ] Upload a PDF → it processes and you can ask it

---

## Updating later

```bash
# via SSH:
cd ~/evangadi && git pull
cd frontend && npm run build && cd ..
# then in hPanel → Node.js → Run NPM Install (if backend deps changed) → Restart
# new DB migration? import it via phpMyAdmin.
```

---

## Troubleshooting (Node-app specifics)

| Symptom | Fix |
|---|---|
| App won't start / 503 | Check the Node.js app **log**. Most common: wrong **startup file** (must be `index.js`) or missing `JWT_SECRET`/DB vars. The app listens on `process.env.PORT` — don't hardcode a port. |
| Blank page, API works | Frontend not built or `frontend/dist` missing / wrong location. Rebuild and confirm `backend/../frontend/dist/index.html` exists. |
| SPA loads but API calls fail | `VITE_API_BASE_URL` wasn't set to your domain at build time, or `FRONTEND_URL` env is wrong. |
| 413 on PDF upload | Hostinger's proxy body limit — uploads cap at 10 MB in-app; if blocked earlier, check hPanel/PHP `upload_max_filesize` isn't capping the domain. |
| Page renders unstyled / CSP errors in console | `helmet()` default CSP — if needed, loosen it in `backend/index.js` for your asset hosts. |
| Out-of-memory restarts | Shared Node plans have RAM caps; the app loads question vectors into memory. Fine for a class dataset; large data wants the VPS path. |

---

### Reminder
This shared-hosting path is convenient but has tighter CPU/RAM limits than a VPS. For a
class project / demo it's fine. If you outgrow it, `DEPLOY.md` (VPS) is the same app with
more headroom — and the single-app frontend-serving change means it works there too.

---

## Lessons from the first production deploy (read before you deploy)

- **Hostinger's "MySQL" is MariaDB.** `CAST('...' AS JSON)` is MySQL-only — MariaDB
  rejects it and the whole statement fails (this silently left the changelog seed
  empty). Write seeds/migrations with plain JSON strings; the JSON column is a
  `longtext` alias there, and the backend parses string JSON defensively.
- **`DB_HOST` must be `localhost`/`127.0.0.1`**, not the remote host name — the Node
  app runs on the same server as MySQL, and the DB user only allows local connections.
- **Don't burst SSH connections.** The shared server rate-limits rapid SSH/rsync
  sessions from one IP (looks like brute force) and then resets everything for
  30-60 min. Batch server work into one SSH session, or use ControlMaster.
- **Global API rate limit**: the SPA fires several calls per page view and Hostinger's
  CDN can blur client IPs — the limiter backstop is 1000/15min for this reason.

---

## Deploying from GitHub (recommended — replaces manual zip uploads)

The repo is set up for platform builds: root `npm run build` installs backend +
frontend deps and produces `frontend/dist`; root `server.js` starts the backend,
which serves both `/api` and the built SPA. The SPA calls the API **same-origin**
(no `VITE_API_BASE_URL` needed) as long as the site and API share one domain.

In hPanel → your Node.js app → **Settings and redeploy** (or Deployments):

| Setting | Value |
|---|---|
| Source | **GitHub** → authorize → `Kingspark/ai-powered-disc-forum` (private) |
| Branch | `main` |
| Root directory | `/` (repository root) |
| Build command | `npm run build` |
| Startup file / start | `server.js` (or `npm start`) |
| Node version | 20+ |

Environment variables stay as configured (DB_*, JWT_SECRET, GEMINI/RESEND keys,
FRONTEND_URL). Add **`UPLOAD_DIR=/home/<user>/forum-uploads`** so uploaded PDFs
live outside the app folder — GitHub deploys replace the app directory, which
would otherwise wipe them. After connecting, every push to `main` can be deployed with one
click (or auto-deploy if enabled).

> If the panel insists on `backend` as the root directory instead, keep startup
> file `index.js` and set the build command to
> `npm install --prefix ../frontend && npm run build --prefix ../frontend` —
> the backend serves `../frontend/dist`.

> **Domain tip:** connect your real domain to the Node app itself (app dashboard →
> Connect domain). Then one deploy updates frontend AND backend together, and the
> separate static copy in `public_html` becomes obsolete. Set `FRONTEND_URL` to that
> domain for CORS.
