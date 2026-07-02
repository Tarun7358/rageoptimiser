# Production Deployment Guide

This document outlines the deployment process for running Rage Optimiser in a secure, production-ready Linux server environment.

---

## 📋 Prerequisites

* Linux Server (Ubuntu 22.04 LTS recommended)
* **Node.js** `v20.x` or higher
* **Nginx** (Reverse proxy and SSL termination)
* **PM2** (Process manager)

---

## 🏃 Process Management with PM2

The workspace includes a pre-configured `ecosystem.config.js` in the root directory. To run both the Core Backend Server and the Music Bot under PM2 monitoring:

### 1. Build the Projects
Compile the TypeScript code for the frontend and backends:
```bash
# Build React Frontend
npm run build

# Build Core Backend
cd backend
npm run build

# Build Music Bot
cd ../clutch-music
npm run build
```

### 2. Start PM2 Processes
```bash
# From the root directory
pm2 start ecosystem.config.js
```

### 3. Setup PM2 Startup Script
Ensure the processes resume automatically after system restarts:
```bash
pm2 startup
pm2 save
```

---

## 🌐 Reverse Proxy (Nginx) Configuration

Configure Nginx to proxy HTTP requests (port `5000`) and WebSocket connections (port `5001`) under a secure domain.

Create a site configuration file (e.g. `/etc/nginx/sites-available/clutch`):

```nginx
server {
    listen 80;
    server_name dashboard.rageoptimiser.com;

    # Static React Frontend
    location / {
        root /home/ubuntu/RageOptimiser/dist;
        try_files $uri $uri/ /index.html;
        expires 30d;
    }

    # REST API Proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Proxy
    location /ws {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Enable the configuration:
```bash
ln -s /etc/nginx/sites-available/clutch /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## 🔒 SSL Considerations (Certbot)

Secure Nginx using Let's Encrypt SSL certificates:

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d dashboard.rageoptimiser.com
```

Certbot will automatically verify ownership, acquire the SSL certificates, update the Nginx configuration, and establish a cron job for automatic certificate renewal.
