# Database Schema & Firestore Collections

Rage Optimiser utilizes Google Firebase Firestore for all persistent configurations and credentials.

---

## 🗄️ Database Collections

### 1. `admin_users`
Stores credentials and Two-Factor Authentication profiles for administrative dashboard access.
* **Document ID:** Unique user identifier (e.g. `admin`).
* **Schema:**
  ```json
  {
    "username": "admin",
    "password": "bcrypt_hashed_password_string",
    "role": "owner",
    "totpEnabled": true,
    "totpSecret": "iv:encrypted_hex:auth_tag",
    "recoveryCodes": [
      "XXXX-XXXX"
    ]
  }
  ```

### 2. `guild_configs`
Stores configuration state, live resource registry caches, event logs, and whitelist details for each Discord server.
* **Document ID:** Discord Guild ID (e.g. `1508399161798819840`).
* **Schema:**
  ```json
  {
    "modules": [
      {
        "id": "security",
        "name": "Security Guard",
        "status": "enabled",
        "progress": 100,
        "config": {
          "quarantineRoleId": "...",
          "alertChannelId": "...",
          "rules": {
            "anti_channel_delete": { "limit": 1, "window": 10, "action": "quarantine" }
          }
        }
      }
    ],
    "registry": {
      "memberCount": 1500,
      "onlineCount": 420,
      "roles": [],
      "channels": []
    },
    "syncLogs": [
      { "time": "12:00:00", "msg": "Log entry", "type": "info" }
    ],
    "globalSettings": {
      "maintenanceMode": false
    },
    "whitelistAudit": [],
    "whitelistActivity": []
  }
  ```

### 3. `guild_approvals`
Tracks approvals for server registration requests.
* **Document ID:** Target Guild ID.
* **Schema:**
  ```json
  {
    "guildId": "1508399161798819840",
    "guildName": "Rage Server",
    "status": "approved",
    "requestedBy": "user_id",
    "requestedAt": "timestamp"
  }
  ```

### 4. `backups`
Contains historic snapshots of module states for point-in-time recovery.
* **Document ID:** Backup Identifier (e.g. `backup-1782980000`).
* **Schema:**
  ```json
  {
    "id": "backup-1782980000",
    "guildId": "1508399161798819840",
    "time": "2026-07-02T12:00:00.000Z",
    "modules": []
  }
  ```
