# Changelog

All notable changes to the Clutch Nation project are documented here.

## [1.0.0] - 2026-07-02
### Added
- **Firestore Persistence:** Fully migrated configuration storage from local `guilds_data/*.json` files to Firebase Firestore, enabling multi-instance scalability and durable updates.
- **Live Discord Resource Sync:** Configured the `/api/state` API endpoint and WebSocket connections to trigger direct Discord resource syncs (`syncRegistry`), ensuring channels, roles, and members are fresh.
- **Two-Factor Authentication (TOTP):** Enforced privileged status and security configuration changes using Google Authenticator codes.
- **Bypassed Whitelist Verification:** Configured Anti-Nuke event verification to check system owners, whitelisted members, and custom exception roles.
- **Music Persistent Queues:** Built persistent playlists and track recovery through Spotify URLs and queue sync.

### Fixed
- **Module Toggle Failure:** Removed the overly strict module toggle blocker that prevented activation of configured modules with less than 100% setup progress.
- **TOTP Verification Error:** Fixed parsing errors where numeric OTP codes sent by the client failed validation due to `otplib` length checks; cast and padded all codes properly.
- **Security Elevation Guard:** Fixed missing `requireElevation` wrapper on the client dashboard toggle button, ensuring TOTP checks are requested correctly.
- **Decryption Failures:** Migrated legacy database encryption keys, resolving decryption errors on admin accounts.

### Cleaned
- Removed all obsolete `guilds_data/` files and old temporary scripts.
- Optimized root `.gitignore` to prevent tracking of local environment settings, private JSON keys, and executable binaries.
