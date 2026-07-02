# REST API Specification

The Rage Optimiser backend exposes a REST API to support the frontend React dashboard. 

---

## 🔒 Authentication & Headers

Most endpoints require a valid JSON Web Token (JWT) sent via the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token_here>
```

Endpoints modifying guild settings also require the target guild ID header:

```http
X-Guild-Id: <discord_guild_id>
```

Privileged actions (such as toggling security modules, modifying staff lists, or managing whitelists) require session elevation. For these endpoints, send the elevated token in the headers:

```http
X-Elevated-Token: <your_elevated_token_here>
```

---

## 🔑 Authentication Endpoints

### `POST /api/auth/login`
Authenticate with local credentials (owner login).
* **Body:**
  ```json
  { "username": "admin", "password": "your_password" }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": { "username": "admin", "role": "owner" }
  }
  ```

### `POST /api/auth/discord/login`
Exchange Discord OAuth2 callback code for a platform session token.
* **Body:**
  ```json
  { "code": "discord_authorization_code" }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": { "username": "John", "role": "guild_manager", "discordId": "..." },
    "guilds": [ { "id": "...", "name": "..." } ]
  }
  ```

### `POST /api/auth/elevate`
Verify TOTP token to receive a short-lived 5-minute elevated token for privileged modifications.
* **Body:**
  ```json
  { "code": "6-digit-otp-code" }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "elevatedToken": "eyJhbGciOi..."
  }
  ```

---

## 🛡️ State & Controls Endpoints

### `GET /api/state`
Fetch the complete active configuration state, live Discord registry, resource counts, latency, and uptime.
* **Headers:** `Authorization`, `X-Guild-Id`
* **Response:**
  ```json
  {
    "modules": [ { "id": "security", "name": "...", "status": "enabled", "progress": 100, "config": {} } ],
    "registry": { "memberCount": 1500, "onlineCount": 420, "roles": [], "channels": [] },
    "syncLogs": [ { "time": "15:04:05", "msg": "Sync completed", "type": "info" } ],
    "globalSettings": { "maintenanceMode": false },
    "latency": 45,
    "uptime": "2d 4h 12m"
  }
  ```

### `POST /api/modules/toggle`
Enable or disable a module status.
* **Headers:** `Authorization`, `X-Guild-Id`, `X-Elevated-Token` (Required for Security module)
* **Body:**
  ```json
  { "moduleId": "security", "enabled": true }
  ```
* **Response:**
  ```json
  { "success": true, "module": { "id": "security", "status": "enabled" } }
  ```

### `POST /api/modules/update-config`
Update configuration values for a specific module.
* **Headers:** `Authorization`, `X-Guild-Id`, `X-Elevated-Token` (Required for Security module)
* **Body:**
  ```json
  {
    "moduleId": "security",
    "config": {
      "quarantineRoleId": "1508399161798819840",
      "alertChannelId": "1509197482700050587"
    }
  }
  ```
* **Response:**
  ```json
  { "success": true, "module": { "id": "security", "config": {} } }
  ```

---

## 📋 Whitelist & Backups Endpoints

### `POST /api/whitelist/add`
Add a Discord ID to a whitelist category.
* **Headers:** `Authorization`, `X-Guild-Id`, `X-Elevated-Token`
* **Body:**
  ```json
  { "type": "bots", "id": "1234567890", "name": "HelperBot" }
  ```
* **Response:**
  ```json
  { "success": true }
  ```

### `POST /api/whitelist/remove`
Remove a Discord ID from a whitelist category.
* **Headers:** `Authorization`, `X-Guild-Id`, `X-Elevated-Token`
* **Body:**
  ```json
  { "type": "bots", "id": "1234567890" }
  ```
* **Response:**
  ```json
  { "success": true }
  ```

### `POST /api/backups/create`
Create a database snapshot of module configurations.
* **Headers:** `Authorization`, `X-Guild-Id`, `X-Elevated-Token`
* **Response:**
  ```json
  { "success": true, "backup": { "id": "backup-1782980000", "time": "..." } }
  ```
