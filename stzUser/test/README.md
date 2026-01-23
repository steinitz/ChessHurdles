# Testing Setup

This directory contains the comprehensive testing infrastructure for our TanStack Start application with Better Auth integration.

## Overview

We use a multi-layered testing approach:
- **Unit Tests**: **Vitest** with **React Testing Library** for component and route testing
- **E2E Tests**: **Playwright** for end-to-end browser testing across multiple browsers

## File Structure

stzUser/test/
├── README.md              # This file - comprehensive testing documentation
├── e2e/
│   ├── config/
│   │   ├── playwright.config.ts # Playwright E2E test configuration
│   │   └── global-setup.ts      # Global test setup and utilities
│   ├── utils/
│   │   ├── EmailTester.ts       # Ethereal Email testing class
│   │   ├── isPlaywrightRunning.ts # Playwright detection utility
│   │   └── server-check.ts      # Development server utilities
│   ├── contact-form-shows-email-success.spec.ts # Contact form email functionality tests
│   ├── smoke-navigation.spec.ts # E2E navigation and functionality tests
│   ├── wallet-visibility.spec.ts # Ledger balance and badge reactivity tests
│   └── README.md                # Email testing documentation
├── output/
│   ├── playwright-report/ # E2E test reports (auto-generated)
│   └── test-results/      # E2E test artifacts (auto-generated)
├── unit/
│   ├── setup.ts           # Test environment setup (jest-dom matchers)
│   ├── test-utils.tsx     # TanStack Router testing utilities
│   ├── routes.test.tsx    # Simple component smoke tests
│   ├── route-imports.test.tsx # Route import and rendering tests
│   ├── users-integration.test.ts # Direct database/Kysely interaction tests
│   └── wallet.integration.test.ts # Ledger and consumption logic tests
```

## Quick Start

### Unit Tests
```bash
# Run all unit tests (watch mode)
pnpm test

# Run unit tests with interactive UI
pnpm test:ui

# Run unit tests once (CI mode)
pnpm test:run
```

### E2E Tests
```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run E2E tests with interactive UI
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e -- smoke-navigation.spec.ts

# Run tests with specific browser
pnpm test:e2e -- --project=chromium
```

### Complete Test Suite
```bash
# Run all tests (unit + E2E)
pnpm test:all
```

## Server Management

Playwright automatically handles development server lifecycle for E2E tests with robust environment variable management:

### How It Works
- **Environment Validation**: Tests verify the server is running with `.env.test` environment variables
- **Smart Server Detection**: Checks if a compatible test server is already running on `http://localhost:3000`
- **Automatic Startup**: If no test-configured server is detected, starts one with `pnpx dotenv-cli -e .env.test -- pnpm dev`
- **Environment Enforcement**: Prevents tests from running against servers without proper test environment
- **Clean Shutdown**: Only stops servers it started, preserving your manual dev servers

### Environment Variable System
Tests now use a dedicated `.env.test` file with `PLAYWRIGHT_RUNNING=true` to ensure proper test environment:

```bash
# .env.test
PLAYWRIGHT_RUNNING=true
# ... other test-specific environment variables
```

### Configuration
The server management is handled by `server-check.ts` utilities:
- **`ensureServerRunning()`** - Starts server with `.env.test` if needed
- **`checkServerTestEnvironment()`** - Validates running servers use test environment
- **`isPlaywrightRunning()`** - Simple detection based on `PLAYWRIGHT_RUNNING` environment variable

### Benefits
✅ **Test Environment Isolation**: Ensures tests always run with proper test configuration  
✅ **Environment Variable Propagation**: Reliable loading of `.env.test` variables  
✅ **Development Friendly**: Reuses compatible servers, starts new ones when needed  
✅ **CI Optimized**: Always starts fresh servers with test environment in CI  
✅ **Error Prevention**: Blocks tests from running against misconfigured servers  
✅ **Zero Configuration**: Automatic environment detection and server management

# Unit Testing

## Test Files

### `unit/setup.ts`
Configures the test environment with jest-dom matchers for enhanced assertions like `toBeInTheDocument()`.

### `unit/routes.test.tsx`
Contains basic smoke tests that verify components can render without errors. These tests use simple mocking and don't require complex router setup.

**Tests:**
- Basic component rendering
- Sign-in component functionality
- User management with empty state

### `unit/route-imports.test.tsx`
More comprehensive tests that verify actual route imports and component rendering with proper TanStack Router integration.

**Tests:**
- Route module imports without errors
- Route component rendering
- Loader function execution

**Framework Resilience Mocks:**
This file includes generic mocks for `@tanstack/react-start` and `@tanstack/react-start/server`. This ensures application-specific routes that use `createServerFn` or `getWebRequest` can be safely imported and rendered in foundation tests without project-specific configuration.

### `unit/test-utils.tsx`
Provides utilities for testing TanStack Router components with proper context setup, including memory history.

## Test Utilities

### `e2e/utils/server-check.ts`
Development server management utilities with environment validation:

**Functions:**
- **`ensureServerRunning()`**: Starts development server with `.env.test` environment if needed
- **`checkServerTestEnvironment()`**: Validates running servers have proper test environment variables
- **Server Detection**: Automated checking for running development servers
- **Environment Validation**: Ensures servers are running with `PLAYWRIGHT_RUNNING=true`

**Benefits:**
- **Environment Isolation**: Guarantees tests run with proper test configuration
- **Test Reliability**: Prevents tests from running against misconfigured servers
- **Development Workflow**: Seamless integration with existing dev servers
- **CI/CD Support**: Automated server management with environment validation
- **Error Prevention**: Proactive detection of environment and server issues

# E2E Testing

## Test Files

### `e2e/config/playwright.config.ts`
Playwright configuration for multi-browser E2E testing:
- **Browsers**: Chromium, Firefox, WebKit (configurable per test run)
- **Base URL**: http://localhost:3000
- **Output**: Reports and artifacts in `src/test/e2e/.output/` directory
- **Retries**: 2 retries on CI, 0 locally for faster development
- **Global Setup**: Automated server checking and initialization via `global-setup.ts`
- **Web Server**: Automatic development server management with smart reuse
- **Timeouts**: 30s test timeout, 120s server startup timeout
- **Parallel Execution**: Optimized for CI/CD environments

### `e2e/config/global-setup.ts`
Global test setup and utilities:
- **Server Management**: Automated development server detection and startup
- **Environment Preparation**: Pre-test environment validation
- **Cross-Test Utilities**: Shared setup logic for all E2E tests

### `e2e/smoke-navigation.spec.ts`
Comprehensive navigation and functionality tests:

**Tests:**
- **Home Page**: Logo, navigation, footer verification
- **Contact Page**: Navigation, form elements, content verification
- **Cross-Navigation**: Bidirectional page navigation flows

**Coverage:**
- 9 tests across 3 browsers (27 total test executions)
- Core user journeys and page functionality
- Visual element verification and interaction testing

### `e2e/wallet-visibility.spec.ts`
Tests the ledger balance and UI badge reactivity:

**Tests:**
- **Badge Visibility**: Confirms the wallet badge appears after login
- **Reactivity**: Verifies the balance updates immediately after transactions (grants/consumption)
- **Allowance Exhaustion**: Tests visual transitions as daily allowance is used up

### `e2e/contact-form-shows-email-success.spec.ts`
Comprehensive contact form functionality testing:

**Tests:**
- **Form Submission**: Complete contact form workflow testing
- **Email Integration**: Verification of email sending functionality
- **UI State Management**: Success message display and form reset
- **Validation Flow**: Form validation and error handling

**Features:**
- **Real Email Testing**: Uses Ethereal Email for actual email verification
- **End-to-End Workflow**: Tests complete user journey from form to email
- **Production-Safe**: No impact on production email systems
- **Debugging Support**: Comprehensive logging for troubleshooting

### `e2e/contact-form-email.spec.ts` (Temporarily in reference/)
Comprehensive email functionality testing using Ethereal Email:

**Tests:**
- **Email Sending**: Verifies contact form sends emails with user data
- **Content Validation**: Confirms emails contain name, email, and message
- **Error Handling**: Tests graceful failure when email service unavailable
- **Form Validation**: Ensures invalid forms don't trigger emails

**Features:**
- **Ethereal Email Integration**: Uses temporary test accounts for safe email testing
- **Web Interface**: Provides URLs to view captured emails in browser
- **Production Isolation**: Zero impact on production email configuration
- **Automated Verification**: Programmatic email content and delivery verification

**Status**: Currently moved to reference/ directory while resolving Ethereal email interception issues.

### `e2e/README.md`
Comprehensive documentation for E2E testing including email testing setup and strategies:

**Coverage:**
- **Ethereal Email Setup**: Complete guide for test email configuration
- **Testing Strategies**: Best practices for email functionality testing
- **Troubleshooting**: Common issues and solutions for email tests
- **Integration Examples**: Code examples and implementation patterns

**Benefits:**
- **Production Safety**: Zero impact on production email systems
- **Visual Verification**: Web interface for manual email inspection
- **Automated Testing**: Programmatic email content validation
- **Developer Friendly**: Easy setup and maintenance

### `e2e/utils/EmailTester.ts`
Class for Ethereal Email testing:

**Core Functions:**
- `EmailTester.createTestAccount()` - Creates temporary Ethereal accounts
- `EmailTester.sendTestEmail()` - Sends emails to test environment
- `EmailTester.getSentEmails()` - Retrieves captured emails for verification
- `EmailTester.verifyEmailSent()` - Validates email sending with criteria

**Benefits:**
- **Zero Configuration**: Automatic test account creation
- **Visual Inspection**: Web interface for manual email review
- **Safe Testing**: No real emails sent, production code unchanged
- **Comprehensive Coverage**: Full email workflow testing

## Testing Architecture

**Our testing setup is designed specifically for TanStack Start applications:**

### 1. **Application Dependencies**
Our application components use **TanStack Start server functions**, not TanStack Query hooks:
- `useGetAllUsers()` - TanStack Start server function created with `createServerFn()`
- `useDeleteUserById()` - TanStack Start server function created with `createServerFn()`
- These provide server-side functionality with client-side interfaces

### 2. **Testing Strategy**
Our tests work by mocking the server functions directly:

```tsx
// Mock server functions for testing
vi.mock('~stzUser/lib/users-client', () => ({
  useGetAllUsers: vi.fn(() => Promise.resolve([])),
  useDeleteUserById: vi.fn(),
}))
```

### 3. **No Query Client Needed**
Since we use TanStack Start server functions instead of TanStack Query:
- No `QueryClientProvider` is required
- No query cache management needed
- Tests focus on component behavior with mocked server responses

### 4. **Clean Testing Environment**
The `renderWithProviders` utility provides:
- TanStack Router context with memory history
- Minimal route setup for component testing
- No unnecessary dependencies or providers

## Configuration

### Vitest Config (`vitest.config.ts`)
- **Environment**: jsdom for DOM testing
- **Globals**: Enabled for describe/it/expect
- **Setup**: Automatic jest-dom matcher loading
- **Plugins**: React SWC for fast compilation
- **TypeScript**: Full TypeScript support with type checking

### Test Utilities
The `renderWithProviders()` utility creates a minimal testing environment:
- TanStack Router with memory history
- Simplified route structure for component testing

## Mocking Strategy

### External Dependencies
We mock all external dependencies to isolate component logic:

```tsx
// User management functions
vi.mock('~stzUser/lib/users-client', () => ({
  useGetAllUsers: vi.fn(() => Promise.resolve([])),
  useDeleteUserById: vi.fn(),
}))

// Auth components
vi.mock('~stzUser/components/RouteComponents/SignIn', () => ({
  SignIn: () => <div data-testid="signin-component">Sign In Component</div>,
}))
```

### TanStack Router
We mock `createFileRoute` to provide controlled loader data:

```tsx
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn((path: string) => {
    return (config: any) => ({
      ...config,
      useLoaderData: mockUseLoaderData,
    })
  }),
}))
```

## Running Tests

### Unit Tests
```bash
# Run all unit tests
pnpm test

# Run unit tests with UI
pnpm test:ui

# Run unit tests once (CI mode)
pnpm test:run
```

### E2E Tests
```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run E2E tests with interactive UI
pnpm test:e2e:ui

# Run specific test patterns
pnpm test:e2e -- --grep="contact form"
pnpm test:e2e -- smoke-navigation.spec.ts

# Run with specific browser
pnpm test:e2e -- --project=firefox

# Debug mode (headed browser)
pnpm test:e2e -- --debug

# Run all tests (unit + E2E)
pnpm test:all
```

### Development Workflow
```bash
# Quick feedback loop during development
pnpm test:ui          # Unit tests with watch mode and UI
pnpm test:e2e:ui      # E2E tests with browser UI

# Pre-commit validation
pnpm test:run         # Unit tests (CI mode)
pnpm test:e2e         # E2E tests (headless)

# CI/CD pipeline
pnpm test:all         # Complete test suite (unit + E2E)
```

## Best Practices

### Test Organization
1. **File Naming**: Use descriptive names that clearly indicate what's being tested
2. **Directory Structure**: Keep tests organized by type (unit/, e2e/) and feature
3. **Configuration Separation**: Maintain test configs in dedicated config/ directories
4. **Shared Utilities**: Centralize common test utilities in utils/ directories
5. **Documentation**: Keep test documentation updated with new patterns and changes

### Unit Testing
1. **Mock External Dependencies**: Always mock API calls, external libraries, and complex components
2. **Use Test IDs**: Prefer `data-testid` attributes for reliable element selection
3. **Test Behavior, Not Implementation**: Focus on what users see and do
4. **Keep Tests Simple**: Each test should verify one specific behavior
5. **Proper Cleanup**: Use `beforeEach` to reset mocks between tests
6. **TypeScript Integration**: Leverage TypeScript for better test reliability and IDE support

### E2E Testing
1. **Page Object Pattern**: Organize selectors and actions into reusable page objects
2. **Stable Selectors**: Use `data-testid` or semantic selectors over CSS classes
3. **Wait Strategies**: Always wait for elements and state changes explicitly
4. **Test Independence**: Each test should be able to run in isolation
5. **Meaningful Assertions**: Verify user-visible behavior and outcomes
6. **Clean Test Data**: Reset application state between tests when needed

### General Testing
1. **Test Pyramid**: More unit tests, fewer E2E tests for optimal speed and reliability
2. **Fast Feedback**: Unit tests for quick iteration, E2E for confidence
3. **Clear Test Names**: Describe what the test verifies in plain language
4. **Documentation**: Keep this README updated with new patterns and practices
5. **Type Safety**: Ensure TypeScript types are properly validated across all test files
6. **CI/CD Integration**: Ensure all test commands work reliably in automated environments
7. **Development Workflow**: Design tests to work seamlessly with live development servers

## Future Enhancements

### Unit Testing
- **Integration Tests**: Test complete user flows with real router navigation
- **API Mocking**: Use MSW (Mock Service Worker) for more realistic API testing
- **Performance Testing**: Monitor component render times and memory usage

### E2E Testing
- **Email Testing**: Comprehensive email functionality testing with Ethereal Email
- **Wallet Testing**: Integrated tests for Ledger balances and UI badge reactivity
- **Visual Regression**: Add screenshot comparison testing
- **Authentication Flows**: Test sign-in/sign-up user journeys
- **Form Interactions**: Comprehensive form validation and submission testing
- **Mobile Testing**: Add mobile device emulation
- **API Integration**: Test real API interactions and data flows
- **Performance Monitoring**: Add Lighthouse audits and performance metrics

## Troubleshooting

### Unit Testing Issues

**"createFileRoute is not a function"**
- Ensure TanStack Router is properly mocked before importing route components
- Check that the mock is applied at the module level

**TypeScript errors with route properties**
- Access route properties via `RouteConfig.options?.component` instead of direct property access
- Ensure route mocks have proper TypeScript types

**Tests hanging or timing out**
- Check that all async operations are properly mocked
- Ensure server functions are mocked before component imports
- Verify no real network requests are being made

**Server function mocking issues**
- Mock server functions at the module level using `vi.mock()`
- Ensure mocks return appropriate Promise-based responses
- Clear mocks between tests using `vi.clearAllMocks()`
- Use proper TypeScript types for mock return values

### E2E Testing Issues

**"Error: connect ECONNREFUSED"**
- Ensure the development server is running on http://localhost:3000
- Start server with `pnpm dev` before running E2E tests

**Browser launch failures**
- Install Playwright browsers: `npx playwright install`
- Check system dependencies: `npx playwright install-deps`

**Test timeouts**
- Increase timeout in playwright.config.ts if needed
- Check for slow network requests or animations
- Use `page.waitForLoadState()` for proper page loading

**Flaky tests**
- Add proper wait conditions: `page.waitForSelector()`
- Use `expect.poll()` for dynamic content
- Increase retries in configuration for unstable environments

**Output directory issues**
- Reports and artifacts are auto-generated in `src/test/e2e/.output/`
- Clean output: `rm -rf src/test/e2e/.output/test-results src/test/e2e/.output/playwright-report`
- Ensure proper write permissions for output directories

**Configuration path issues**
- Verify Playwright config path: `src/test/e2e/config/playwright.config.ts`
- Check that global setup file exists: `src/test/e2e/config/global-setup.ts`
- Ensure all config files are properly typed and exported

### Development Workflow Issues

**Tests interfering with development server**
- Use `pnpm test:e2e:ui` for interactive debugging
- Playwright automatically reuses existing dev servers
- Check server status with `utils/server-check.ts` utilities

**CI/CD pipeline failures**
- Run complete test suite: `pnpm test:all`
- Verify TypeScript compilation is passing
- Check that all dependencies are properly installed
- Ensure proper environment variables are set
