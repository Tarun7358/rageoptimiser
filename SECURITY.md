# Security Policy

## 🔒 Security Architectures

Clutch Nation implements several layers of active defence mechanisms:

### 1. Privilege Elevation (TOTP)
* Any route affecting system configuration (such as enabling/disabling modules, adding staff, or changing anti-nuke rules) requires a short-lived elevated token (`X-Elevated-Token`).
* Elevated tokens are signed using SHA-256 JWT secrets and expire after **5 minutes**.
* Elevation requires verification of a Time-Based One-Time Password (TOTP) from a registered Google Authenticator device.

### 2. Encryption at Rest
* Secrets such as the TOTP seed for each administrator are encrypted in the Firestore database using **AES-256-GCM** encryption.
* Decryption keys are derived from the system-wide `JWT_SECRET` variable.

### 3. Anti-Nuke Event Mitigation
* Rate-limiting checks monitor all administrative events (such as `channelDelete` and `roleDelete`).
* If an event threshold is violated (e.g. more than 1 channel deletion within the defined limit), the system instantly triggers:
  1. A target roll-back (re-creating the resource if needed).
  2. Removal of all dangerous roles from the executor.
  3. Automatic quarantine assignment.

---

## 🛑 Reporting Vulnerabilities

If you discover a security issue or vulnerability within this codebase, please contact the development team directly or submit a report to the administrator. Do **not** open a public GitHub issue.
