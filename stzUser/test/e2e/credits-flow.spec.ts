import { test, expect } from '@playwright/test';
import { newTestUser, EmailTester } from './utils/EmailTester';
import { testConstants } from '~stzUser/test/constants';

test.use({
  launchOptions: {
    slowMo: 1000,
  },
});

test.describe('Credits Flow', () => {
  test('should allow claiming welcome grant and requesting bank transfer', async ({ page }) => {
    // 1. Sign up a new user
    const uniqueEmail = newTestUser();
    await page.goto('/auth/signup');
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="name"]', 'Credits Tester');
    await page.fill('input[name="password"]', testConstants.defaultPassword);

    const signUpButton = page.getByRole('button', { name: 'Sign Up' });
    await expect(signUpButton).toBeEnabled({ timeout: 15000 });
    await signUpButton.click();

    await expect(page.locator('h1')).toContainText('Account Created', { timeout: 15000 });

    // 2. Automated Email Verification via Mailpit
    // Wait a brief moment for email to arrive
    await page.waitForTimeout(2000);
    const verificationLink = await EmailTester.getFirstVerificationLink(uniqueEmail);
    if (!verificationLink) {
      throw new Error(`Verification link not found in Mailpit for ${uniqueEmail}`);
    }

    // 3. Navigate to verification link (this verifies the user and redirects to home)
    await page.goto(verificationLink);
    await expect(page).toHaveURL('/');

    // 4. Click the Wallet Widget in the header
    // Wait for session to hydrate - we should see the user email
    await expect(page.locator('p', { hasText: uniqueEmail })).toBeVisible({ timeout: 15000 });

    const walletWidget = page.locator('span', { hasText: /Credits/ });
    await expect(walletWidget).toBeVisible({ timeout: 15000 });
    await expect(walletWidget).toContainText('3 Credits');
    await walletWidget.click();

    // 5. Verify we are on the Credits page
    await expect(page).toHaveURL(/\/auth\/credits/);
    await expect(page.locator('h1')).toContainText('Credits');

    // 6. Claim Welcome Grant
    const claimButton = page.getByRole('button', { name: /Claim Welcome Grant/i });
    await expect(claimButton).toBeVisible();

    // Handle the alert
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Welcome grant claimed');
      dialog.accept();
    });

    await claimButton.click();

    // Verify balance updated (3 + 10 = 13)
    await expect(walletWidget).toContainText('13 Credits', { timeout: 10000 });

    // 7. Request Bank Transfer
    const requestButton = page.getByRole('button', { name: /Request Bank Transfer/i });
    await expect(requestButton).toBeVisible();
    await requestButton.click();

    // Verify instructions dialog appears
    await expect(page.locator('h2', { hasText: 'Bank Transfer Instructions' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('strong', { hasText: 'BSB:' })).toBeVisible();
    // Close dialog
    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(page.locator('h2', { hasText: 'Bank Transfer Instructions' })).not.toBeVisible();
  });

  test('should navigate from Credits Required dialog to credits page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('span', { hasText: /Credits/ })).toBeDefined();
  });
});
