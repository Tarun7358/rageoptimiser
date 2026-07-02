# Contributing to Clutch Nation

This codebase is a private, proprietary software project. Contributions are limited to authorized team members and internal developers.

## 💻 Development Workflow

1. **Local Setup:** Follow the configuration guidelines in `README.md` to run the React frontend, core backend, and music bot locally.
2. **TypeScript Integrity:** All code must pass compiler checks. Run `npm run build` in root and backend folders to verify.
3. **Database Changes:** Since Firebase Firestore is the source of truth, verify that any new metadata fields added to local models are correctly synchronized and loaded in `ModuleRegistry.ts`.

## 📁 Branching & Commits

* Prefix branches with `feat/`, `fix/`, or `chore/`.
* Write concise commit messages explaining the *why* of the change.
* Do **not** commit environment variables (`.env`), Firebase credential files (`firebase-key.json`), or other secrets.

## 🧪 Testing Guidelines

* **Simulations:** Use the `/api/simulate` endpoint for local validation of events (such as channel deletion rate limits) without needing physical Discord client triggers.
* **TOTP Elevation:** Test elevated endpoints by setting up a test user in Firestore, enabling TOTP, and providing codes via `Google Authenticator`.
