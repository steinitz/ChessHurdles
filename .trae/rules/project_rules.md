# Project Testing Guidelines

## Email Testing Architecture
The project uses Mailpit as a lightweight local SMTP server for E2E testing. EmailTester has been migrated from Ethereal Email to integrate with Mailpit's HTTP API, allowing tests to capture and verify emails sent during test execution.

## Available Test Commands

### Unit Tests
- `pnpm test` - Run unit tests
- `pnpm test:ui` - Run unit tests with UI
- `pnpm test:run` - Run unit tests once

### E2E Tests
- `pnpm test:e2e` - Run all E2E tests
- `pnpm test:e2e:ui` - Run E2E tests with Playwright UI
- `pnpm test:all` - Run both unit and E2E tests

### Specific E2E Test Flows
- `pnpm test:e2e:contact` - Test contact form flow
- `pnpm test:e2e:signup` - Test user signup flow
- `pnpm test:e2e:change-email` - Test email change flow
- `pnpm test:e2e:password-reset` - Test password reset flow
- `pnpm test:e2e:create-verified-user` - Test createVerifiedTestUser utility function
- `pnpm test:e2e:mailpit` - Test Mailpit integration

## Development Commands
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start:prod` - Start production server
- `pnpm typecheck` - Check TypeScript types

## Testing Best Practices
- Use the specific test commands above (e.g., `pnpm test:e2e:password-reset`)
- E2E tests automatically start the dev server as needed
- Avoid running the test version of the dev server manually
- Keep Mailpit running during E2E tests to avoid connection errors

## E2E Test Server Stability - RESOLVED ✅

### Issue Summary
Intermittent E2E test failures across non-trivial tests due to timing issues and server load during test execution.

### Solution Found
**Root Cause**: Tests were running too fast for the server to handle, causing timing-related failures.

**Fix Applied**: Use focused waiting and/or `slowMo` in Playwright launchOptions:
```typescript
// In test files, add to browser launch options:
slowMo: 1000,  // Adds 1 second delay between actions
```

### Files Modified
- `/stzUser/test/e2e/config/global-teardown.ts` - Added brutal server shutdown with `pkill -f "vite.*dev"` to ensure clean state between test runs
- Individual test files - Added `slowMo` configuration to launchOptions

### Key Learnings
- E2E test failures were primarily timing-related, not server crashes
- `slowMo` parameter in Playwright helps with server load management
- Focused waiting strategies improve test reliability
- Brutal teardown ensures clean state between test runs

### Status: RESOLVED
- All E2E tests now pass consistently with proper timing configuration
- Server stability issues resolved through pacing test execution

## Development Server Guidelines

### Automatic Server Launch Policy
- **DO NOT** automatically start the development server (`pnpm dev`) unless explicitly requested by the user
- Only launch the dev server when the user specifically asks to:
  - "Start the dev server"
  - "Run the application" 
  - "Open a preview"
  - Or similar explicit requests
- Avoid launching the server for code changes, refactoring, or general development tasks
- The user prefers to manually control when the server runs

## Recent Feature Additions

### Password Change Feature (Profile.tsx)
- Enhanced `PasswordInput` component with configurable props (fieldName, label, placeholder, autoComplete, style)
- Added password change functionality to Profile page with current/new password fields
- Implemented custom bullet spacing for password fields (bold font, increased letter spacing)
- Added explanatory text and improved UX with loading spinners
- Fixed querySelector null error with proper error handling
- **Testing Strategy**: Unit tests preferred over E2E for component-level functionality