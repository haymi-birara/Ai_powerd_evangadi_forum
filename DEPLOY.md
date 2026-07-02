# Deploying to Hostinger (KVM VPS) — Step-by-Step

This app is **React (Vite) + Express (Node) + MySQL 8**. It needs a persistent Node
process, so it must run on a **Hostinger VPS (KVM)** — *not* the shared/web hosting
plans (those are PHP-only and can't keep a Node server alive).

**Target:** one VPS running Nginx (serves the built frontend + reverse-proxies `/api`
to the backend), the Express backend under PM2, and MySQL — all behind HTTPS.

```
Browser ──HTTPS──▶ Nginx :443 (yourdomain.com)
                    ├─ /         → static files   (frontend/dist)
                    └─ /api/*     → 127.0.0.1:5004  (Express via PM2)
                                      └─ MySQL :3306 + ./backend/uploads (PDFs)
```

> **Ready-made files in this repo** — use these instead of typing configs by hand:
> | File | Used in | Purpose |
> |------|---------|---------|
> | `backend/.env.production.example` | Step 6 | copy → `backend/.env`, then fill in |
> | `ecosystem.config.cjs` | Step 8 | PM2 process config (`pm2 start ecosystem.config.cjs`) |
> | `deploy/nginx.conf` | Step 9 | Nginx site config |
> | `deploy/redeploy.sh` | Step 12 | one-command redeploy after the first deploy |

---

## 0. Before you start — gather these

- [ ] A **Hostinger KVM VPS** (KVM 2 / 8 GB RAM recommended; KVM 1 / 4 GB minimum), Ubuntu 22.04
- [ ] A **domain name** (you'll point it at the VPS IP)
- [ ] **Gemini API key** (with billing enabled — production traffic costs money) → https://aistudio.google.com/apikey
- [ ] **Resend API key** + a verified sending domain (for email confirm / password reset) → https://resend.com
- [ ] A strong **JWT secret** (generated in Step 6) and a strong **DB password**

---

## 1. Point your domain at the VPS

In Hostinger → **Domains → DNS** (or your registrar), add:

| Type | Name | Value |
|------|------|-------|
| A    | `@`  | your VPS IP |
| A    | `www`| your VPS IP |

DNS can take 5–60 min to propagate. Check with `ping yourdomain.com`.

---

## 2. First login & basic server hardening

SSH in as root (Hostinger emails you the IP + password, or use the hPanel browser terminal):

```bash
ssh root@YOUR_VPS_IP
```

Update the system and create a non-root sudo user:

```bash
apt update && apt upgrade -y
adduser deploy                 # set a password
usermod -aG sudo deploy
```

Set up the firewall (allow only SSH + web):

```bash
apt install -y ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'         # opens 80 + 443 (added after Nginx is installed in step 3)
ufw --force enable
```

From here on, work as `deploy`:

```bash
su - deploy
```

---

## 3. Install Node.js, MySQL, Nginx, PM2, Git

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx mysql-server

# PM2 (process manager) + Certbot (SSL)
sudo npm install -g pm2
sudo apt install -y certbot python3-certbot-nginx

node -v && npm -v          # sanity check (expect v20.x)
```

Secure MySQL:

```bash
sudo mysql_secure_installation     # set a root password, answer Y to the rest
```

---

## 4. Create the database and load the schema

```bash
sudo mysql
```

In the MySQL prompt (replace the password):

```sql
CREATE DATABASE evangadi_forum CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'evangadi'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON evangadi_forum.* TO 'evangadi'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 5. Get the code

```bash
cd ~
git clone https://github.com/Kingspark/ai-powered-disc-forum.git
cd ai-powered-disc-forum
npm run install:all            # installs backend + frontend deps
mkdir -p backend/uploads        # persistent folder for RAG PDFs
```

Now load the schema, then the changelog migration:

```bash
cd backend
mysql -u evangadi -p evangadi_forum < db/schema.sql
mysql -u evangadi -p evangadi_forum < db/migrations/002_changelog_releases_up.sql
cd ..
```

> **Do NOT run migration `001` on a fresh database.** `schema.sql` already includes the
> `users.trust_score` / `role` columns and all of 001's tables, so 001's
> `ALTER TABLE … ADD COLUMN` statements would error with *"Duplicate column name"*.
> Migration `001` exists only to upgrade an **older** database that predates the trust
> feature. A fresh install needs just `schema.sql` + `002`.
>
> `002` adds the `users.last_seen_release_id` column (which `schema.sql` doesn't have) and
> **seeds the "What's New" changelog** with 7 entries — so run it **exactly once**. Its
> `ALTER` and seed aren't idempotent, so re-importing errors (duplicate column / unique
> `version`).

---

## 6. Configure the backend (`backend/.env`)

Generate a strong JWT secret first:

```bash
openssl rand -hex 32           # copy the output for JWT_SECRET below
```

Create the file:

```bash
nano backend/.env
```

Paste (fill in every value):

```ini
# Server
PORT=5004
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com      # CORS allow-list — must be your real domain

# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=evangadi
DB_PASSWORD=CHANGE_ME_STRONG_DB_PASSWORD
DB_NAME=evangadi_forum

# JWT (required — server refuses to start without JWT_SECRET)
JWT_SECRET=PASTE_THE_openssl_rand_OUTPUT_HERE
JWT_EXPIRES_IN=1d

# AI (Gemini)
GEMINI_API_KEY=your_gemini_api_key

# Email (Resend) — required for email confirm / password reset
RESEND_API_KEY=your_resend_api_key

# RAG defaults (optional — leave unset to use built-in defaults)
# RAG_EMBEDDING_DIM=768
# RAG_SEARCH_THRESHOLD=0.55
# RAG_CHUNK_CHARS=900
# RAG_CHUNK_OVERLAP=120
```

> ⚠️ **Do not** reuse the dev placeholder `change_me_to_a_long_random_secret`. A weak
> JWT secret lets anyone forge logins.

---

## 7. Build the frontend

Tell the frontend where the API lives, then build:

```bash
echo "VITE_API_BASE_URL=https://yourdomain.com" > frontend/.env.production
cd frontend
npm run build                  # outputs to frontend/dist
cd ..
```

(The frontend calls `/api/...`, so with the base URL set to your domain, Nginx routes
those calls to the backend.)

---

## 8. Start the backend with PM2

```bash
cd ~/ai-powered-forum-project/backend
pm2 start index.js --name evangadi-api
pm2 save                       # remember this process list
pm2 startup                    # run the command it prints, to auto-start on reboot
pm2 logs evangadi-api --lines 30   # confirm "Server running on http://localhost:5004"
```

If you see *"Database connection established"* and *"Server running"*, the backend is up.

---

## 9. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/evangadi
```

Paste (replace `yourdomain.com`):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Allow 10 MB PDF uploads (RAG) — Nginx default is 1 MB
    client_max_body_size 12M;

    root /home/deploy/ai-powered-forum-project/frontend/dist;
    index index.html;

    # API → Express backend
    location /api/ {
        proxy_pass http://127.0.0.1:5004;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;          # AI calls can be slow
    }

    # SPA — let React Router handle client-side routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable it and reload:

```bash
sudo ln -s /etc/nginx/sites-available/evangadi /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t                  # test config
sudo systemctl reload nginx
```

Visit `http://yourdomain.com` — the site should load (still HTTP).

---

## 10. Enable HTTPS (free SSL)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Choose **redirect HTTP → HTTPS** when asked. Certbot auto-renews. Now visit
`https://yourdomain.com`.

---

## 11. Verify

- [ ] `https://yourdomain.com` loads the app
- [ ] Register a user → you receive the confirmation email (Resend)
- [ ] Log in → dashboard loads questions (no "Unable to connect")
- [ ] Post a question → moderation runs (Gemini)
- [ ] Upload a PDF in RAG → it processes and you can ask it

---

## 12. Updating / redeploying (after code changes)

```bash
cd ~/ai-powered-forum-project
git pull
npm run install:all                       # if deps changed
cd frontend && npm run build && cd ..      # rebuild frontend
pm2 restart evangadi-api                    # restart backend
# new DB migrations? run them: mysql -u evangadi -p evangadi_forum < db/migrations/NNN_up.sql
```

---

## 13. Maintenance

- **Logs:** `pm2 logs evangadi-api` · Nginx: `/var/log/nginx/error.log`
- **DB backup (do this regularly / cron it):**
  ```bash
  mysqldump -u evangadi -p evangadi_forum > ~/backup-$(date +%F).sql
  ```
- **Back up `backend/uploads/`** too — that's where RAG PDFs live (not in the DB).
- **Changed `RAG_EMBEDDING_DIM`?** Re-embed: `cd backend && node scripts/reembed-rag-chunks.js`
- **Monitor resources:** `pm2 monit`, `htop`

---

## 14. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Backend won't start | `JWT_SECRET` missing, or DB creds wrong → `pm2 logs evangadi-api` |
| "Unable to connect to server" in the UI | `FRONTEND_URL` doesn't match the site URL, or backend down |
| "Something went wrong" right after login works elsewhere | token expired → expected, log in again (already returns 401 → re-login) |
| 413 error on PDF upload | `client_max_body_size` missing/too small in Nginx |
| 502 Bad Gateway | backend not running on 5004 → `pm2 restart evangadi-api` |
| No emails | `RESEND_API_KEY` unset or sending domain not verified |
| Gemini features fail | `GEMINI_API_KEY` invalid or no billing/quota |

---

### Notes specific to this app
- The cosine search is an in-memory linear scan — fine for a class/demo dataset, but
  it loads vectors into RAM, so give the VPS enough memory.
- `uploads/` and the MySQL data are your only stateful pieces — back up both.
- Everything runs on one box here; for higher scale you'd split MySQL onto a managed DB
  and add more app instances behind Nginx.

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
