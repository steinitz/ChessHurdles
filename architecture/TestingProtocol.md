# Testing Protocol & Technical History

This document serves as a historical record and technical reference for the project's testing infrastructure and development milestones.

## Email Testing Architecture
The project uses Mailpit as a lightweight local SMTP server for E2E testing. `EmailTester` has been migrated from Ethereal Email to integrate with Mailpit's HTTP API, allowing tests to capture and verify emails sent during test execution.

## E2E Test Server Stability
### Issue Summary
Intermittent E2E test failures were discovered across non-trivial tests due to timing issues and server load during test execution.

### Solution
**Root Cause**: Tests were running too fast for the server to handle, causing timing-related failures.
**Fix**: Use focused waiting and/or `slowMo: 1000` in Playwright launchOptions.
**Teardown**: Added a brutal server shutdown in `stzUser/test/e2e/config/global-teardown.ts` using `pkill -f "vite.*dev"` to ensure a clean state between test runs.

## Notable Implementation Details
### Password Change Feature (`Profile.tsx`)
- Enhanced `PasswordInput` component with configurable props.
- Added password change functionality to the Profile page with current/new password fields.
- Implemented custom bullet spacing for password fields (bold font, increased letter spacing).

### Stockfish Web Worker Integration
- Stockfish.js runs in Web Workers for analysis.
- Engine communications handled via UCI protocol.
- Position analysis and move evaluation with principal variations.
- *Performance Note*: Currently limited to single-threaded due to missing Cross-Origin Isolation (COI).

## Legacy References
This content was migrated from `.trae/rules/project_rules.md` on 2026-01-06.
