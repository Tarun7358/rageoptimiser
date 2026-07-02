# Commands Directory

Clutch Nation supports two types of command execution:
1. **Slash Commands:** Integrated directly into Discord (`/`).
2. **Prefix Commands:** Available via the custom prefix (default `c!`) for the Music module.

---

## 🛡️ Moderation Module

*Permissions Required:* Administrator permission or membership in the configured `modRoleIds` role list.

### `/status`
* **Description:** Check configuration completeness, database status, and active modules.
* **Usage:** `/status`

### `/ban`
* **Description:** Ban a user from the server.
* **Parameters:**
  * `user` (Required, USER): The member to ban.
  * `reason` (Optional, STRING): The reason for the ban.
* **Usage:** `/ban user:@User reason:Rule breaking`

### `/kick`
* **Description:** Kick a user from the server.
* **Parameters:**
  * `user` (Required, USER): The member to kick.
  * `reason` (Optional, STRING): The reason for the kick.
* **Usage:** `/kick user:@User reason:Inactivity`

### `/timeout`
* **Description:** Timeout/isolate a user temporarily.
* **Parameters:**
  * `user` (Required, USER): The member to timeout.
  * `duration` (Required, STRING): Format like `10m`, `2h`, `1d`.
* **Usage:** `/timeout user:@User duration:30m`

### `/untimeout`
* **Description:** Remove an active timeout from a user.
* **Parameters:**
  * `user` (Required, USER): The member to release.
* **Usage:** `/untimeout user:@User`

### `/mute`
* **Description:** Mutes a user (sets a standard 1-hour timeout).
* **Parameters:**
  * `user` (Required, USER): The member to mute.
* **Usage:** `/mute user:@User`

### `/unmute`
* **Description:** Unmutes a user (clears the timeout).
* **Parameters:**
  * `user` (Required, USER): The member to unmute.
* **Usage:** `/unmute user:@User`

### `/warn`
* **Description:** Log a warning against a user. Warning data is saved in memory.
* **Parameters:**
  * `user` (Required, USER): The member to warn.
  * `reason` (Required, STRING): Reason for the warning.
* **Usage:** `/warn user:@User reason:Spamming`

### `/warnings`
* **Description:** Check warnings logged against a user.
* **Parameters:**
  * `user` (Required, USER): User to check.
* **Usage:** `/warnings user:@User`

### `/clearwarnings`
* **Description:** Clear all warnings logged against a user.
* **Parameters:**
  * `user` (Required, USER): User to clear.
* **Usage:** `/clearwarnings user:@User`

### `/purge`
* **Description:** Delete multiple messages in the current channel.
* **Parameters:**
  * `amount` (Required, INTEGER): Range `1` to `100`.
* **Usage:** `/purge amount:50`

### `/lock`
* **Description:** Lock the current text channel, denying the `@everyone` role permission to send messages.
* **Usage:** `/lock`

### `/unlock`
* **Description:** Restore default message sending permissions to the channel.
* **Usage:** `/unlock`

### `/slowmode`
* **Description:** Set a message delay slowmode for the channel.
* **Parameters:**
  * `seconds` (Required, INTEGER): Delay in seconds.
* **Usage:** `/slowmode seconds:5`

---

## 🔒 Security Module

*Permissions Required:* Administrator permission or Owner status.

### `/quarantine`
* **Description:** Manually isolate a suspicious server member. Removes all administrative roles and adds the designated quarantine role.
* **Parameters:**
  * `user` (Required, USER): Target member.
* **Usage:** `/quarantine user:@SuspiciousUser`

### `/lockdown`
* **Description:** Perform emergency lock or unlock of all guild channels.
* **Parameters:**
  * `status` (Required, STRING): Choose `lock` or `unlock`.
* **Usage:** `/lockdown status:lock`

---

## 🎵 Music Module

*Note:* These can also be used as prefix commands (e.g. `c!play`).

### `/play`
* **Description:** Stream high-fidelity audio from YouTube or Spotify.
* **Parameters:**
  * `query` (Required, STRING): Search keywords or video/playlist URL.
* **Usage:** `/play query:lofi beats`

### `/pause`
* **Description:** Pause the active playback stream.
* **Usage:** `/pause`

### `/resume`
* **Description:** Resume paused audio playback.
* **Usage:** `/resume`

### `/stop`
* **Description:** Stop the playback stream and clear the music queue.
* **Usage:** `/stop`

### `/skip`
* **Description:** Skip the currently playing track.
* **Usage:** `/skip`

### `/queue`
* **Description:** View upcoming tracks in the music queue.
* **Usage:** `/queue`

### `/shuffle`
* **Description:** Shuffle the tracks in the queue.
* **Usage:** `/shuffle`

### `/loop`
* **Description:** Set loop mode.
* **Parameters:**
  * `mode` (Required, STRING): Options are `track`, `queue`, `off`.
* **Usage:** `/loop mode:queue`

### `/volume`
* **Description:** Adjust volume of the bot stream.
* **Parameters:**
  * `percent` (Required, INTEGER): Range `0` to `200`.
* **Usage:** `/volume percent:80`

### `/clear`
* **Description:** Clear all tracks in the queue except the current one.
* **Usage:** `/clear`

### `/remove`
* **Description:** Remove a track from a specific position in the queue.
* **Parameters:**
  * `position` (Required, INTEGER): Position number in queue.
* **Usage:** `/remove position:3`
