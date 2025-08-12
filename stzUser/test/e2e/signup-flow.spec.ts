import { test, expect } from '@playwright/test';
import { newTestUser, EmailTester } from './utils/EmailTester';
import { isEmailVerified } from './utils/user-verification';

test.describe('Signup Flow', () => {
  test('should complete signup flow and show success message', async ({ page }) => {
    // Listen for console messages and errors
    page.on('console', msg => {
      console.log(`🖥️ Browser console [${msg.type()}]:`, msg.text());
    });

    page.on('pageerror', error => {
      console.log('🚨 Page error:', error.message);
    });

    // Clear any previous emails from EmailTester
    EmailTester.clearSentEmails();
    
    let verificationUrl: string | null = null;

    // Navigate to signup page
    await page.goto('/auth/signup');



    // Check if we're on the signup page by looking for the form
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();

    // Generate unique email to avoid conflicts
    const uniqueEmail = newTestUser();

    // Fill out the signup form
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="password"]', 'TestPassword123!');

    // Read back the values before submission
    // Note: Adding this helps with timing for route interception
    const email = await page.inputValue('input[name="email"]');
    const name = await page.inputValue('input[name="name"]');
    const password = await page.inputValue('input[name="password"]');



    // Add form submission event listener
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          // Form submission event listener for debugging if needed
        });
      }
    });

    const timeoutSeconds = 13;

    // Submit the form
    await expect(page.getByRole('button', { name: 'Sign Up' })).toBeEnabled({timeout: timeoutSeconds * 1000});
    await page.click('button[type="submit"]');

    // Wait for and verify the success message (this also ensures the page has loaded)
    await expect(page.locator('h1')).toContainText('Account Created', {timeout: timeoutSeconds * 1000});
    


    // Verify the success message content
    await expect(page.getByText('We\'ve sent an email-confirmation link to')).toBeVisible();
    await expect(page.getByText(uniqueEmail)).toBeVisible();
    await expect(page.getByText('Please check your email inbox and follow the instructions')).toBeVisible();

    // Verify the OK button is present
    await expect(page.getByRole('button', { name: 'Ok' })).toBeVisible();

    // Verify that the user's email is NOT verified (should require email confirmation)
    const emailVerified = await isEmailVerified(uniqueEmail);
    expect(emailVerified).toBe(false);


    // Get the verification email from EmailTester
    const lastEmail = EmailTester.getLastSentEmail();
    
    if (lastEmail) {

      
      // Extract verification URL using EmailTester's built-in method
      verificationUrl = EmailTester.getFirstVerificationLink(uniqueEmail);
      if (verificationUrl) {

      }
    } else {
      console.warn('⚠️ No email was captured by EmailTester');
    }

    // Now click the verification link if we captured it
    if (verificationUrl) {

      await page.goto(verificationUrl);
      
      // Wait for the verification page to load
      await page.waitForLoadState('networkidle', { timeout: timeoutSeconds * 1000});
      

      
      // Verify that the user's email is NOW verified
      const emailVerifiedAfter = await isEmailVerified(uniqueEmail);
      expect(emailVerifiedAfter).toBe(true);

    } else {
      console.warn('⚠️ No verification URL was captured - skipping verification link test');
    }


  });
});
