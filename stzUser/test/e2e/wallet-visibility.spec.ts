import { test, expect } from '@playwright/test';
import { newTestUser } from './utils/EmailTester';
import { testConstants } from '~stzUser/test/constants';

test.use({
  launchOptions: {
    slowMo: 1000,
  },
});

test.describe('Wallet Visibility and Reactivity', () => {
  test('should show correct wallet status after signup and updates', async ({ page }) => {
    // 1. Sign up a new user
    const uniqueEmail = newTestUser();
    await page.goto('/auth/signup');
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="name"]', 'Wallet Tester');
    await page.fill('input[name="password"]', testConstants.defaultPassword);

    // Wait for Turnstile to enable the button
    const signUpButton = page.getByRole('button', { name: 'Sign Up' });
    await expect(signUpButton).toBeEnabled({ timeout: 15000 });
    await signUpButton.click();

    // Wait for "Account Created" message
    await expect(page.locator('h1')).toContainText('Account Created', { timeout: 15000 });

    // The UserBlock should be visible in the header
    const walletBadge = page.locator('div', { hasText: /Actions:/ });
    await expect(walletBadge).toBeVisible();
    await expect(walletBadge).toContainText('Actions: 3/3');
    await expect(walletBadge).toContainText('Credits: 0');

    // 2. Grant 10 Credits via Developer Tools
    await page.locator('summary', { hasText: 'Developer Tools' }).click();
    await page.getByRole('button', { name: 'Grant 10 Credits' }).click();

    // Page reloads after click in handleGrantCredits
    await expect(walletBadge).toContainText('Credits: 10', { timeout: 10000 });

    // 3. Consume 1 Action
    // Open dev tools again (it closes on reload)
    await page.locator('summary', { hasText: 'Developer Tools' }).click();
    await page.getByRole('button', { name: 'Consume 1 Action' }).click();

    // Page reloads
    await expect(walletBadge).toContainText('Actions: 2/3');
    await expect(walletBadge).toContainText('Credits: 10');

    // 4. Consume to exhaustion and verify credits are hit
    await page.locator('summary', { hasText: 'Developer Tools' }).click();
    await page.getByRole('button', { name: 'Consume 1 Action' }).click(); // 1/3
    await page.locator('summary', { hasText: 'Developer Tools' }).click();
    await page.getByRole('button', { name: 'Consume 1 Action' }).click(); // 0/3

    await expect(walletBadge).toContainText('Actions: 0/3');
    await expect(walletBadge).toContainText('Credits: 10');

    // Next consumption should hit credits
    await page.locator('summary', { hasText: 'Developer Tools' }).click();
    await page.getByRole('button', { name: 'Consume 1 Action' }).click();

    await expect(walletBadge).toContainText('Actions: 0/3'); // Stays 0/3 (usage is now 4)
    await expect(walletBadge).toContainText('Credits: 9');
  })
})
