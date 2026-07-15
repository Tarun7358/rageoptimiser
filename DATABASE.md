# Rage Optimiser Database Schema

Rage Optimiser uses a local, shared **SQLite** database (`database.sqlite`) for all persistent user data, configurations, events, and session states. This replaced the legacy Cloud Firebase Firestore infrastructure, allowing for faster response times, reduced latency, and a stateless execution model.

---

## 🗄️ Database Tables

### 1. `admin_users`
Stores credentials, roles, and lockout details for administrative dashboard access.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `id` | TEXT (PK) | Unique system user ID |
  | `username` | TEXT (Unique) | Dashboard username |
  | `passwordHash` | TEXT | Hashed bcrypt password |
  | `role` | TEXT | User role (e.g. `owner`, `staff`) |
  | `totpEnabled` | INTEGER | 2FA status (`1` = active, `0` = disabled) |
  | `totpSecret` | TEXT | Encrypted 2FA TOTP secret |
  | `recoveryCodes` | TEXT | JSON string of recovery codes |
  | `failedAttempts` | INTEGER | Current count of consecutive failed logins |
  | `lockedUntil` | TEXT | ISO timestamp when lockout expires |
  | `lastLogin` | TEXT | ISO timestamp of the last login |
  | `createdAt` | TEXT | Account creation timestamp |
  | `updatedAt` | TEXT | Account modification timestamp |

### 2. `guild_configs`
Stores enabled/disabled status and active configuration options for all modules.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `guildId` | TEXT (PK) | Discord Guild ID |
  | `modules` | TEXT | JSON string of active module configs and states |
  | `globalSettings` | TEXT | JSON string of global settings |

### 3. `approvals`
Tracks guild registration approvals and blacklist status.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `guildId` | TEXT (PK) | Discord Guild ID |
  | `guildName` | TEXT | Name of the guild |
  | `ownerId` | TEXT | Discord User ID of the guild owner |
  | `ownerUsername` | TEXT | Username of the guild owner |
  | `memberCount` | INTEGER | Total members in the guild |
  | `botCount` | INTEGER | Bot count in the guild |
  | `humanCount` | INTEGER | Human count in the guild |
  | `verificationLevel` | INTEGER | Guild verification level |
  | `premiumTier` | INTEGER | Guild boost tier |
  | `premiumSubscriptionCount`| INTEGER | Guild boost count |
  | `riskScore` | INTEGER | Anti-nuke calculated risk score |
  | `riskLevel` | TEXT | Qualitative risk level |
  | `status` | TEXT | Guild approval status (`Approved`, `Not Registered`, `Blacklisted`, `Suspended`, `Rejected`, `Pending`) |
  | `blacklistedBy` | TEXT | User who blacklisted |
  | `blacklistedAt` | INTEGER | Unix epoch timestamp of blacklist |
  | `approvedBy` | TEXT | User who approved |
  | `approvedAt` | INTEGER | Unix epoch timestamp of approval |
  | `rejectedBy` | TEXT | User who rejected |
  | `rejectedAt` | INTEGER | Unix epoch timestamp of rejection |
  | `rejectionReason` | TEXT | Reason for rejection |
  | `notes` | TEXT | Staff notes |
  | `joinedAt` | INTEGER | Unix epoch timestamp when bot joined |
  | `lastUpdated` | INTEGER | Unix epoch timestamp of last sync |

### 4. `guild_backups`
Contains full templates of guild channels, roles, and emojis for point-in-time recovery.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `id` | TEXT (PK) | Backup ID (e.g. `BP-123-4567`) |
  | `timestamp` | TEXT | ISO timestamp when backup was captured |
  | `guildId` | TEXT | Source Discord Guild ID |
  | `guildName` | TEXT | Source Discord Guild Name |
  | `createdByName` | TEXT | Username who initiated backup |
  | `channelsCount` | INTEGER | Number of channels backed up |
  | `rolesCount` | INTEGER | Number of roles backed up |
  | `emojisCount` | INTEGER | Number of custom emojis backed up |
  | `data` | TEXT | JSON string containing roles, channels, emojis, and settings data |

### 5. `upm_snapshots`
Temporary storage of full server rollback states (channels/roles) captured before security incidents.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `guildId` | TEXT (PK) | Discord Guild ID |
  | `timestamp` | INTEGER | Milliseconds timestamp |
  | `channels` | TEXT | JSON string of channel layout |
  | `roles` | TEXT | JSON string of role layout |
  | `guildSettings` | TEXT | JSON string of guild details |

### 6. `guild_warnings`
Warn logs for infractions issued by the Moderation module.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `guildId` | TEXT | Discord Guild ID |
  | `userId` | TEXT | Discord Member User ID |
  | `warnings` | TEXT | JSON array of warnings |
  * **Primary Key:** `(guildId, userId)`

### 7. `guild_verifications`
List of members who completed verification to bypass quarantine.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `guildId` | TEXT | Discord Guild ID |
  | `userId` | TEXT | Discord Member User ID |
  | `verifiedAt` | TEXT | ISO timestamp |
  * **Primary Key:** `(guildId, userId)`

### 8. `guild_afk`
User AFK reason and timestamp markers.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `guildId` | TEXT | Discord Guild ID |
  | `userId` | TEXT | Discord Member User ID |
  | `reason` | TEXT | AFK status note |
  | `timestamp` | INTEGER | Unix epoch timestamp of status |
  * **Primary Key:** `(guildId, userId)`

### 9. `guild_xp`
Leveling progress tracking for active guild users.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `guildId` | TEXT | Discord Guild ID |
  | `userId` | TEXT | Discord Member User ID |
  | `xp` | INTEGER | Accumulated XP |
  | `updatedAt` | TEXT | ISO timestamp |
  * **Primary Key:** `(guildId, userId)`

### 10. `guild_economy`
Virtual currency ledger and inventory state.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `guildId` | TEXT | Discord Guild ID |
  | `userId` | TEXT | Discord Member User ID |
  | `balance` | INTEGER | Coin balance |
  | `lastDaily` | INTEGER | Unix timestamp of last daily claim |
  | `lastWork` | INTEGER | Unix timestamp of last work command |
  | `inventory` | TEXT | JSON string array of items owned |
  | `updatedAt` | TEXT | ISO timestamp |
  * **Primary Key:** `(guildId, userId)`

### 11. `discord_sessions`
OAuth credentials and access tokens for dashboard logging.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `discordId` | TEXT (PK) | Discord User ID |
  | `discordUsername` | TEXT | Discord Username |
  | `discordAvatar` | TEXT | Discord avatar URL hash |
  | `accessToken` | TEXT | Discord OAuth Access Token |
  | `managedGuildIds` | TEXT | JSON string array of managed guild IDs |
  | `loginAt` | INTEGER | Unix timestamp of login |

### 12. `public_feed`
Aggregated logs shown on the public feed page.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `id` | TEXT (PK) | UUID or unique string |
  | `category` | TEXT | Log type (e.g. `audit`, `security`) |
  | `text` | TEXT | Event content description |
  | `timestamp` | INTEGER | Milliseconds timestamp |

### 13. `upm_rollbacks`
Role restore checkpoints stored during nuke containment.
* **Schema:**
  | Field | Type | Description |
  |---|---|---|
  | `id` | TEXT (PK) | Rollback ID (e.g. `${guildId}_${userId}`) |
  | `roles` | TEXT | JSON string of role IDs |
  | `timestamp` | INTEGER | Unix timestamp of containment event |
