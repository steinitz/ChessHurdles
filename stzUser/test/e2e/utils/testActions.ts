import { expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

/**
 * Helper function to sign in a user
 * Navigates to signin page, fills credentials, submits form, and confirms success
 * Reusable for multiple test flows (change email, change password, etc.)
 */
export async function signInUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/signin');
  
  // Wait for form elements to be visible and interactive before attempting to fill
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');
  
  // Use waitForElementVisible to ensure elements are ready before interaction
  await waitForElementVisible(emailInput, { 
    errorMessage: 'Email input not visible',
    maxAttempts: 5,
    baseWaitMs: 1000
  });
  
  await waitForElementVisible(passwordInput, {
    errorMessage: 'Password input not visible',
    maxAttempts: 5,
    baseWaitMs: 1000
  });

  // Without this wait, the signup form gets cleared after filling in the values, below.
  // Maybe related to validatedInput being an "uncontrolled" input field?
  await page.waitForTimeout(1000);
  
  // Fill form fields with exponential backoff
  await waitWithExponentialBackoff(
    async () => {
      await emailInput.fill(email);
      await passwordInput.fill(password);
    },
    {
      errorMessage: 'Failed to fill sign-in form fields',
      maxAttempts: 5,
      baseWaitMs: 1000
    }
  );
  
  // Wait for submit button and click with exponential backoff
  await waitForElementVisible(submitButton, {
    errorMessage: 'Submit button not visible',
    maxAttempts: 5,
    baseWaitMs: 1000
  });
  
  await waitWithExponentialBackoff(
    async () => {
      await submitButton.click();
    },
    {
      errorMessage: 'Failed to click submit button',
      maxAttempts: 3,
      baseWaitMs: 1000
    }
  );
  
  // Wait for either successful navigation or error message
  try {
    await page.waitForURL(url => !url.toString().includes('/auth/signin'), { timeout: 5000 });
  } catch (timeoutError) {
    // Check if there's an error message on the page
    const errorMessage = await page.locator('[role="alert"], .error, .text-red-500').textContent().catch(() => null);
    if (errorMessage) {
      throw new Error(`Sign in failed with error: ${errorMessage}`);
    }
    // If no error message, the signin might just be slow
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/signin')) {
      throw new Error(`Sign in failed - still on signin page: ${currentUrl}`);
    }
  }
  
  // Final confirmation that we're signed in
  const currentUrl = page.url();
  expect(currentUrl).not.toContain('/auth/signin');
}

/**
 * Exponential backoff utility for waiting on elements or conditions in E2E tests
 * This pattern has proven crucial for E2E test stability across the codebase
 * 
 * @param operation - Function that returns a Promise, should throw if condition not met
 * @param maxAttempts - Maximum number of retry attempts (default: 10)
 * @param baseWaitMs - Base wait time in milliseconds (default: 500)
 * @param maxWaitMs - Maximum wait time per attempt in milliseconds (default: 3000)
 * @param multiplier - Exponential backoff multiplier (default: 1.5)
 */
export async function waitWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseWaitMs?: number;
    maxWaitMs?: number;
    multiplier?: number;
    errorMessage?: string;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 10,
    baseWaitMs = 500,
    maxWaitMs = 3000,
    multiplier = 1.5,
    errorMessage = 'Operation failed after maximum attempts'
  } = options;

  let attempts = 0;
  let lastError: Error;

  while (attempts < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error(`${errorMessage} (${maxAttempts} attempts). Last error: ${lastError.message}`);
      }
      
      const waitTime = Math.min(baseWaitMs * Math.pow(multiplier, attempts), maxWaitMs);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError!;
}

/**
 * Convenience function for waiting on Playwright locator visibility with exponential backoff
 * Common pattern used across E2E tests for element visibility checks
 */
export async function waitForElementVisible(
  locator: Locator,
  options: {
    maxAttempts?: number;
    baseWaitMs?: number;
    maxWaitMs?: number;
    multiplier?: number;
    timeout?: number;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const { timeout = 1000, errorMessage, ...backoffOptions } = options;
  
  await waitWithExponentialBackoff(
    async () => {
      await expect(locator).toBeVisible({ timeout });
    },
    {
      ...backoffOptions,
      errorMessage: errorMessage || `Element not visible after maximum attempts: ${locator}`
    }
  );
}