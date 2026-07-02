# Rage Optimiser Platform

An enterprise-grade, real-time Discord community management platform. Rage Optimiser provides advanced server moderation, bot whitelisting, automation, logging, backups, role verification, and a high-fidelity music bot, all managed through a premium web dashboard with Two-Factor Authentication (TOTP) security.

---

## 🚀 Key Features

* **Real-time Synchronization:** Live updates of Discord resources (roles, channels, members) directly on the web dashboard using WebSockets and Server-Sent Events (SSE).
* **Anti-Nuke & Anti-Raid System:** Predefined, strict event limits (e.g. channel/role deletions) synced to Firebase Firestore that automatically quarantines unauthorized actors.
* **Granular Whitelist Management:** Separated whitelist configurations for Bots, Members, and Roles to manage elevation permissions.
* **Music Suite:** A dedicated voice gateway music bot with Spotify integration (`spotify-url-info`), persistent queue streams, and automatic idle timeouts.
* **Two-Factor Authentication (TOTP):** Cryptographically enforced administrative actions (AES-256-GCM encrypted keys) requiring Google Authenticator checks.
* **Modern Web Interface:** Built with React, TypeScript, and Vite, featuring rich aesthetics, transitions, dynamic charts, and micro-animations.

---

## 🛠️ System Architecture

Rage Optimiser is architected as three main components:
1. **Frontend Dashboard:** React/TS Single Page App communicating with the API via REST and WebSockets.
2. **Core Backend Server:** Express.js REST API + main Discord Bot Client managing the server state, gateway dispatches, and Firestore database interactions.
3. **Music Bot:** A lightweight, secondary Discord client focused solely on high-performance audio playback.

---

## 📦 Requirements

* **Node.js:** `v20.x` or higher
* **Firebase:** Google Firestore project with Admin credentials
* **Discord Application:** 2 Discord bot applications (one for Core, one for Music) with Gateway Intents enabled:
  * Server Members Intent
  * Message Content Intent
  * Presence Intent

---

## ⚙️ Installation & Configuration

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/Tarun7358/RageOptimiser.git
cd RageOptimiser

# Install project dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install music bot dependencies
cd ../clutch-music
npm install
```

### 2. Environment Variables
Create `.env` files in both the `backend/` and `clutch-music/` directories using their respective `.env.example` templates.

**`backend/.env`:**
```ini
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here
GUILD_ID=your_default_guild_id_here
OWNER_ID=your_discord_user_id_here
GOOGLE_APPLICATION_CREDENTIALS="./firebase-key.json"
PORT=5000
WS_PORT=5001
JWT_SECRET=use_a_strong_random_secret_key_here
DASHBOARD_PASSWORD=set_a_fallback_owner_dashboard_password_here
FRONTEND_URL=http://localhost:4680
DASHBOARD_URL=http://localhost:4680
OAUTH_REDIRECT_URI=http://localhost:5000/api/auth/discord/callback
```

**`clutch-music/.env`:**
```ini
DISCORD_TOKEN=your_music_bot_token_here
CLIENT_ID=your_music_client_id_here
GUILD_ID=your_default_guild_id_here
PORT=5000
WS_PORT=5001
```

### 3. Database Credentials
Save your Firebase Service Account private key JSON file as `firebase-key.json` in both the `backend/` and `clutch-music/` directories.

---

## 🏃 Running Locally

### Development Mode

**Start Core Backend:**
```bash
cd backend
npm run dev
```

**Start Music Bot:**
```bash
cd clutch-music
npm run dev
```

**Start Frontend Dashboard:**
```bash
# From the root directory
npm run dev
```

---

## 🐳 Production Deployment

Use **PM2** to manage the server processes in production:

```bash
# Start backend and music bot via PM2
pm2 start ecosystem.config.js
```

For dockerized deployment, a `Dockerfile` and `docker-compose.yml` are provided in the root directory.

---

## 🔒 Security Practices

* JWT sessions expire after **5 minutes** for elevated commands.
* Secrets are encrypted at rest using AES-256-GCM.
* Route handlers are protected by rate limiters and strict permission middleware.
* Refer to [SECURITY.md](./SECURITY.md) for more details.

---

## 📄 License
This codebase is private and proprietary. All rights reserved by the client.
