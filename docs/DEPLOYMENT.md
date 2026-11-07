# Deployment Guide — PPIC Alter-S to ppic.mufakat.id

## Overview

This guide walks you through deploying the PPIC Alter-S backend to your subdomain `https://ppic.mufakat.id` using GitHub Actions for CI/CD.

## Architecture

```
GitHub Push (main)
    ↓
GitHub Actions CI (test + build)
    ↓
GitHub Actions Deploy (SSH → VPS)
    ↓
VPS: PM2 runs Node.js server on :3000
    ↓
Nginx reverse proxy: ppic.mufakat.id → :3000
    ↓
Supabase: Postgres database (optional, for DB mode)
```

## Prerequisites

### 1. Server (VPS) Setup

You need a Linux server (Ubuntu 22.04+ recommended) with:

```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3
sudo apt-get install -y python3 python3-pip

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx
```

### 2. Nginx Configuration

Create `/etc/nginx/sites-available/ppic.mufakat.id`:

```nginx
server {
    listen 80;
    server_name ppic.mufakat.id;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/ppic.mufakat.id /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. SSL Certificate (HTTPS)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ppic.mufakat.id
```

### 4. Supabase Setup (Optional but recommended)

1. Create a project at [supabase.com](https://supabase.com)
2. Run SQL migrations:
   - `db/migrations/001_initial_schema.sql`
   - `db/seed/001_demo_data.sql`
3. Copy **Project URL** and **Service Role Key** from Settings → API

### 5. GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions, and add:

| Secret Name | Value | Required |
|---|---|---|
| `SSH_HOST` | Your server hostname/IP | Yes |
| `SSH_USER` | SSH username (e.g. `deploy`) | Yes |
| `SSH_PRIVATE_KEY` | Contents of your SSH private key | Yes |
| `SSH_PORT` | SSH port (default: 22) | No |
| `DEPLOY_PATH` | Server path (e.g. `/var/www/ppic-alters`) | Yes |
| `SUPABASE_URL` | Supabase project URL | No |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | No |

### 6. SSH Key Setup

On your local machine:
```bash
# Generate a deploy key (if you don't have one)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/ppic_deploy

# Copy the public key to the server
ssh-copy-id -i ~/.ssh/ppic_deploy.pub deploy@your-server-ip

# Copy the private key contents to GitHub Secret SSH_PRIVATE_KEY
cat ~/.ssh/ppic_deploy
```

## How It Works

1. **On push to `main`:**
   - CI workflow runs Python tests + Node.js build check
   - Deploy workflow triggers (after CI passes)

2. **Deploy workflow:**
   - Rsyncs files to the server (excluding `.git`, `node_modules`, `.env`)
   - Runs `npm ci --production` on the server
   - Writes `.env` file from GitHub secrets
   - Restarts the app with PM2

3. **PM2 keeps the app running:**
   - Auto-restarts on crash
   - Logs to `~/.pm2/logs/ppic-alters-*.log`
   - Survives server reboots (with `pm2 startup` + `pm2 save`)

## Docker + Traefik (used on the mufakat.id VPS)

The steps above assume bare-metal nginx + certbot on ports 80/443. On the VPS that
already runs **traefik** (which owns 80/443 for `yayan.mufakat.id`,
`supplyright.mufakat.id`, …), use the container setup instead:

```bash
cd ~/projects/ppic-alters
cp .env.example .env          # fill in CODEBUDDY_API_KEY
docker compose up -d --build
curl http://127.0.0.1/api/health -H 'Host: ppic.mufakat.id'
```

- TLS + routing come from traefik labels in `docker-compose.yml` (`certresolver=letsencrypt`).
- Requires a DNS A record `ppic.mufakat.id → <VPS IP>` **before** the first request,
  otherwise ACME fails with `NXDOMAIN` (traefik retries automatically once DNS exists).
- The `ppic-sdk-config` volume persists CodeBuddy auth across rebuilds.

### Agent authentication (required for `/api/chat`)

`/api/health`, `/` and `/api/demo-data` work without credentials, but the chat
endpoint needs a model backend.

**Option A — Tencent-hosted models** (key from <https://www.codebuddy.ai/profile/keys>):

```
CODEBUDDY_API_KEY=<key>
# CODEBUDDY_INTERNET_ENVIRONMENT=internal   # China edition only
```

**Option B — any OpenAI-compatible provider** (verified working with DeepSeek):
set the key plus a base URL and pick a model with `PPIC_MODEL`:

```
CODEBUDDY_API_KEY=<provider key>
CODEBUDDY_BASE_URL=https://api.deepseek.com/
PPIC_MODEL=deepseek-v4-pro
```

`CODEBUDDY_API_KEY` wins over OAuth/session auth, so no `/login` is needed.
Apply changes with `docker compose up -d --force-recreate`.

## Manual Deployment (without GitHub Actions)

```bash
# On the server:
cd /var/www/ppic-alters
git pull origin main
npm ci --production
pm2 restart ppic-alters
```

## Monitoring

```bash
# Check app status
pm2 status ppic-alters

# View logs
pm2 logs ppic-alters --lines 50

# Health check
curl https://ppic.mufakat.id/api/health
```

## Rollback

```bash
# On the server:
cd /var/www/ppic-alters
git log --oneline -5          # find the last good commit
git checkout <commit-hash>
npm ci --production
pm2 restart ppic-alters
```
