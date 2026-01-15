# Deployment Guide: CloudPanel (VPS)

This document tracks the configuration and steps for deploying ChessHurdles to the VPS.

## Server Connection Details
- **IP Address**: `163.47.117.74`
- **Default Domain**: `npvfd2e.vps.networkpresence.com.au`
- **User**: `chesshurdles` (for app deployment)
- **Root User**: `root` (for Nginx and system configuration)
- **Path**: `/home/chesshurdles/htdocs/chesshurdles.com/`

## 0. SSH Key Authentication (Recommended for Automation)
Setting this up allows the assistant (Antigravity) to help you run commands on the server directly.

### 1. Check for Existing Keys
Run this in your Mac terminal:
```bash
ls -al ~/.ssh
```
If you see files like `id_ed25519.pub` or `id_rsa.pub`, you already have a key! 

### 2. Copy Key to App User (chesshurdles)
This allows managing the files and starting the Node app.
```bash
ssh-copy-id -i ~/.ssh/id_rsa.pub chesshurdles@163.47.117.74
```

### 3. Copy Key to Root User (root)
This allows managing Nginx Vhost and installing system tools.
```bash
ssh-copy-id -i ~/.ssh/id_rsa.pub root@163.47.117.74
```

### 4. Verify
Try to log in as both. They should not ask for passwords:
```bash
ssh chesshurdles@163.47.117.74
ssh root@163.47.117.74
```

## 1. Pre-flight Check (Recommended)
Before committing to a full deployment, verify the VPS can handle the dependencies.

1. **Install pnpm** (CloudPanel/NVM version):
   CloudPanel uses NVM. To install `pnpm` globally for the current Node version:
   ```bash
   # Source NVM (required for non-interactive SSH)
   export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
   
   # Install pnpm
   nvm use v22.21.1 # Match the system version
   npm install -g pnpm
   ```

2. **Smoke Test & Native Build**:
   Upload `package.json` and `pnpm-lock.yaml` to the server root, then run:
   ```bash
   # Source NVM and CD to app
   export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
   nvm use v22.21.1
   cd /home/chesshurdles/htdocs/chesshurdles.com/
   
   # Allow native builds for better-sqlite3
   pnpm config set only-built-dependencies better-sqlite3
   
   # Install and Rebuild
   pnpm install --prod
   pnpm rebuild better-sqlite3
   ```
   *Note: If the rebuild fails, ensure `build-essential` is installed via root.*

## 2. Nginx Configuration
Add this to the **Vhost Configuration** in CloudPanel to block direct access to SQLite database files.

```nginx
# Block access to SQLite database files
location ~ \.db$ {
    deny all;
    return 404;
}
```

## 3. Environment Variables (.env.production)
Create this file in the site root on the VPS. 

```bash
# Core Environment
NODE_ENV=production
DATABASE_PATH="/home/chesshurdles/htdocs/chesshurdles.com/sqlite.db"

# Authentication (IMPORTANT: URL must be the public domain)
BETTER_AUTH_SECRET="[YOUR_SECRET_OR_COPY_FROM_DEV]"
BETTER_AUTH_URL="https://chesshurdles.com"

# Copy these directly from your .env.development
# --------------------------------------------
# SMTP Email Configuration
SMTP_HOST=mail.smtp2go.com
SMTP_PORT=465
SMTP_USERNAME=steinitz
SMTP_PASSWORD="..."
SMTP_FROM_ADDRESS=steve@stzdev.com
SMTP_FROM_NAME=Steve Steinitz

# AI Agent
GEMINI_API_KEY="..."

# App Config
COMPANY_NAME=STZDev
APP_NAME=ChessHurdles
SUPPORT_EMAIL_ADDRESS=support@stzdev.com
```

## 4. Local Build & Upload
Since the VPS is resource-constrained, build locally and sync the artifacts.

```bash
# 1. Build locally
pnpm build

# 2. Upload to VPS (example via rsync)
rsync -avz --exclude 'node_modules' .output package.json pnpm-lock.yaml bootstrap.env.mjs .env.production chesshurdles@163.47.117.74:/home/chesshurdles/htdocs/chesshurdles.com/
```

## Server Shell: The "NVM Magic"
> [!IMPORTANT]
> CloudPanel uses NVM to manage Node versions. Every time you open a new SSH session to run `pnpm` or `node`, you **must** run this "Source NVM" command first to wake up the environment:
> ```bash
> export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.21.1
> ```

## 5. VPS Process Management (One-off)
Before starting the app, ensure the port is clear and everything is installed.

```bash
# 1. Source NVM (Required)
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.21.1

# 2. Kill existing process on port 3000
fuser -k 3000/tcp

# 3. Install and build
cd /home/chesshurdles/htdocs/chesshurdles.com/
pnpm config set only-built-dependencies better-sqlite3
pnpm install --prod
pnpm rebuild better-sqlite3
```

## 6. Going Permanent with PM2
To ensure the app stays alive after you close your terminal or if the server reboots:

```bash
# 1. Source NVM (Required)
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use v22.21.1

# 2. Start with PM2
cd /home/chesshurdles/htdocs/chesshurdles.com/
NODE_ENV=production pm2 start bootstrap.env.mjs --name "chesshurdles"

# 3. Save for auto-reboot
pm2 save
```

## 7. Next Session: The "Permanent Spell"
> [!IMPORTANT] 
> **Goal**: Move the current "manual" app process into PM2.
> 1. Source NVM as shown above.
> 2. Run the **Section 6** commands.
> 3. (As root) run `pm2 startup` and follow the instructions to lock it in.

> [!NOTE]
> **Dependencies**: The `bootstrap.env.mjs` script requires `dotenv` in `"dependencies"`.
