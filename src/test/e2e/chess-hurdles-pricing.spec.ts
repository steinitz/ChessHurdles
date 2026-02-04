import { test, expect } from '@playwright/test';
import { newTestUser, EmailTester } from '../../../reference/Upstream/stzUser/test/e2e/utils/EmailTester';
import { testConstants } from '../../../reference/Upstream/stzUser/test/constants';

test.use({
  launchOptions: {
    slowMo: 1000,
  },
});

test.describe('Chess Hurdles Pricing and Analysis', () => {
  test.setTimeout(90000); // 1.5 minute timeout for full flow

  test('should deduct credits for worthy blunders', async ({ page }) => {
    // Clear previous emails
    await EmailTester.clearSentEmails();

    // Debug: Print browser logs
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    // 0. Pre-seed local storage to skip engine calibration
    await page.addInitScript(() => {
      localStorage.setItem('chesshurdles.analysisDepth', '12'); // Use moderate depth
    });

    // 1. Sign up a new user
    const uniqueEmail = newTestUser();
    // Use full URL to avoid config issues
    await page.goto('http://localhost:3000/auth/signup');
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="name"]', 'Chess Tester');
    await page.fill('input[name="password"]', testConstants.defaultPassword);

    const signUpButton = page.getByRole('button', { name: 'Sign Up' });
    await expect(signUpButton).toBeEnabled({ timeout: 15000 });
    await signUpButton.click();

    await expect(page.locator('h1')).toContainText('Account Created', { timeout: 15000 });

    // 2. Verify Email (Required for login in strict mode)
    // Wait a moment for email to arrive
    await page.waitForTimeout(2000);
    const verificationUrl = await EmailTester.getFirstVerificationLink(uniqueEmail);

    if (verificationUrl) {
      await page.goto(verificationUrl);
      await page.waitForLoadState('networkidle');
    } else {
      console.warn('No verification email found. Attempting login anyway (might fail if verification required).');
    }

    // 3. Explicitly Sign In
    await page.goto('http://localhost:3000/auth/signin');
    await page.fill('input[name="email"]', uniqueEmail);
    await page.fill('input[name="password"]', testConstants.defaultPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for login to complete (Sign Out link visible)
    await expect(page.getByText('Sign Out')).toBeVisible({ timeout: 15000 });

    // 4. Verify Initial Credits (100)
    // Wait for header to show credits
    const walletBadge = page.locator('span', { hasText: 'Credits' });
    await expect(walletBadge).toBeVisible({ timeout: 15000 });
    await expect(walletBadge).toContainText('100 Credits');

    // 3. Navigate to Play vs Computer (or Index if it's the game)
    await page.goto('http://localhost:3000/');

    // Wait for board to be visible
    await expect(page.locator('.chess-board-container')).toBeVisible({ timeout: 10000 });

    // 4. Play Fool's Mate (White gets mated, so USER plays White moves leading to mate)
    // Moves: 1. f3 e5 2. g4 Qh4#

    // Move 1: f3
    // Click f2 -> f3
    // Assuming drag/drop or click-click. Click-click is safer for automation.
    // We need accurate selectors for squares. Usually data-square="f2".
    // If custom element, might be harder.
    // Let's assume standard chessboard element behavior or click coordinates if needed.
    // Let's try text-based or data-attribute interaction if possible.
    // If the board uses <div data-square="..."> we can use that.
    // Let's use a helper to click squares.

    const clickSquare = async (square: string) => {
      // Try broad selector
      const sq = page.locator(`[data-square="${square}"]`);
      await sq.click({ force: true });
    };

    // 1. f3
    await clickSquare('f2');
    await clickSquare('f3');

    // Black responds e5 (Wait for response)
    // Wait for black piece on e5? Or simply wait a moment.
    await page.waitForTimeout(1000);

    // 2. g4
    await clickSquare('g2');
    await clickSquare('g4');

    // Black responds (e.g. Qh4# or similar)
    // We don't necessarily need Checkmate, just the blunder.
    await page.waitForTimeout(2000); // Wait for engine response

    // 5. Analyze Game
    const analyzeBtn = page.getByRole('button', { name: 'Analyze Entire Game' });
    await analyzeBtn.click();

    // 6. Verify Analysis Results
    // Wait for AI Analysis text for the blunder (g4)
    // Expected text: "WPL > 20.0%" or "Blunder"
    await expect(page.getByText('Blunder')).toBeVisible({ timeout: 20000 });
    // Wait for AI Analysis text (No-Key Mock)
    await expect(page.locator('body')).toContainText('[MOCK AI (No Key)]', { timeout: 30000 });

    // 7. Verify Credit Deduction
    // Reload to ensure backend state is reflected (UI might not invalidate immediately)
    await page.reload();
    // Two blunders were identified (Move 3 'g4' and Move 4 'g6' depending on engine response), both Worthy.
    // 100 - 15 - 15 = 70 Credits.
    await expect(walletBadge).toContainText('70 Credits');
  });
});
