import { test, expect } from '@playwright/test';
import { createVerifiedTestUser, isEmailVerified } from './utils/user-verification';
import { testConstants } from '~stzUser/test/constants';
import { EmailTester } from './utils/EmailTester';
import { signInUser, waitForElementVisible, waitWithExponentialBackoff } from './utils/testActions';
import { profileTestIds, profileStructuralSelectors } from '~stzUser/components/RouteComponents/Profile/Profile';
import { checkForEmailChangeConfirmationDialogText } from '~stzUser/components/RouteComponents/Profile/checkForEmailChangeConfirmationLinkDialog';

// Configure test-specific options
test.use({
  launchOptions: {
    // slowMo: 1000, // 1 second delay between actions to prevent timing issues
  },
});

// Set test timeout (Fibonacci sequence: 8000 -> 13000 for slowMo + dialog timing)
test.setTimeout(13000);

// Construct test selectors from component exports
const profileSelectors = {
  // Test ID-based selectors (constructed by test)
  profileForm: `[data-testid="${profileTestIds.profileForm}"]`,
  saveChangesButton: `[data-testid="${profileTestIds.saveChangesButton}"]`,
  
  // Structural selectors (used directly)
  ...profileStructuralSelectors
};

/**
 * Helper function to find email by subject fragment
 * Reusable for any email type (verification, password reset, welcome, etc.)
 */
async function findEmailBySubject(targetEmailAddresses: string[], subjectFragment: string = 'verify'): Promise<any> {
  const sentEmails = await EmailTester.getSentEmails();
  
  return sentEmails.find(email => 
      targetEmailAddresses.some(targetEmailAddress => email.envelope.to.includes(targetEmailAddress)) &&
    email.subject.toLowerCase().includes(subjectFragment.toLowerCase())
  );
}

/**
 * Helper function to extract and validate verification links
 * Reusable for any verification flow
 */
function extractVerificationLink(email: any): string | null {
  const verificationLinks = EmailTester.extractVerificationLinks(email);
  return verificationLinks.length > 0 ? verificationLinks[0] : null;
}

/**
 * Tests the complete email change process:
 * 1. Create test User and sign in 
 * 2. Navigate to profile and initiate email change
 * 3. Wait for email change processing (test hangs here but works manually in browser)
 * 4. Verify email change verification was sent ONLY to new address
 * 5. Extract verification link using helper function and simulate a click
 * 6: Confirm new email address is verified and old one is not
 * 
 * This test demonstrates enhanced Playwright testing patterns:
 * - Specific form state assertions (visibility, enabled state, values)
 * - Button state validation before and after interactions
 * - Centralized selector management with component-exported test IDs
 * 
 * This test serves as a reference for similar flows (e.g., change password)
 */

test.describe('Change Email Flow', () => {
  
  test.beforeEach(async () => {
    // Clear any previous test emails
    EmailTester.clearSentEmails();
  });

  test('should successfully change and verify user email', async ({ page }) => {
    // Setup: Create verified test user
    const originalEmailAddress = await createVerifiedTestUser();
    // Clear signup verification emails to isolate email change behavior
    EmailTester.clearSentEmails();

    const newEmailAddress = `new-${originalEmailAddress}`;
    
    // Verify initial state - manually check email verification status
    // NOTE: Better Auth may not require email verification for address changes 
    // if the user's original email address is not verified
    const isOriginalEmailVerified = await isEmailVerified(originalEmailAddress);
    expect(isOriginalEmailVerified).toBe(true);
    
    // Step 1: Sign in user
    await signInUser(page, originalEmailAddress, testConstants.defaultPassword);
    
    // Step 2: Navigate to profile and initiate email change
    await page.goto('/auth/profile');
    
    // Use robust waiting mechanisms for form elements
    const profileForm = page.locator(profileSelectors.profileForm);
    const emailInput = page.locator(profileSelectors.emailInput);
    const saveChangesButton = page.locator(profileSelectors.saveChangesButton);
    
    await waitForElementVisible(saveChangesButton, {
      errorMessage: 'Save changes button not visible after maximum attempts',
      maxAttempts: 5,
      baseWaitMs: 500
    });
    
    // Verify form state
    await expect(emailInput).toBeEnabled();
    await expect(emailInput).toHaveValue(originalEmailAddress);
    await expect(saveChangesButton).toBeEnabled();
    
    await emailInput.fill(newEmailAddress);

    await expect(emailInput).toHaveValue(newEmailAddress);

    // Button state assertions
    await expect(saveChangesButton).not.toBeDisabled();
    

    await saveChangesButton.click();
    
    try {
      // First wait for spinner to appear (indicating email-sending started)
      const spinnerContainer = page.locator(profileSelectors.spinnerContainer);
      await waitForElementVisible(spinnerContainer, {
        errorMessage: 'Spinner never appeared - email sending may not have started',
        maxAttempts: 5,
        baseWaitMs: 300,
        timeout: 2000
      });

      console.log('Spinner appeared - email sending started');
      
      // Then wait for spinner to disappear (indicating email-sending completed)
      await waitWithExponentialBackoff(
        async () => {
          const isVisible = await spinnerContainer.isVisible();
          if (isVisible) {
            throw new Error('Spinner still visible');
          }
        },
        {
          errorMessage: 'Spinner never disappeared - email sending may not have completed',
          maxAttempts: 8,
          baseWaitMs: 500,
          maxWaitMs: 2000
        }
      );
    } catch (error) {
      console.log('Spinner visibility error:', error.message);
      // Fallback waiting strategy if spinner detection fails
      await page.waitForTimeout(2000);
    }
    
    console.log('checking for success dialog')
    // Check for the dialog using text content
    const dialogVisible = await page.getByText(checkForEmailChangeConfirmationDialogText).isVisible().catch(() => false);
    
    // Step 4: Verify email change verification was sent to both addresses
    const allSentEmails = await EmailTester.getSentEmails();
    
    // Find emails sent to the new email address
    const newEmailVerifications = allSentEmails.filter(email => 
      email.envelope.to.includes(newEmailAddress) && 
      email.subject.toLowerCase().includes('verify')
    );
    
    // Verify email change verification behavior
    // Only new email should receive verification during email change
    expect(newEmailVerifications.length).toBe(1);
    // Note: Original email verification was from signup (now cleared)
    
    const verificationEmail = newEmailVerifications[0];
    expect(verificationEmail).toBeTruthy();
    
    // 5. Extract verification link using helper function and simulate user click
    const verificationLink = extractVerificationLink(verificationEmail);
    expect(verificationLink).toBeTruthy();
    
    await page.goto(verificationLink!);
    await page.waitForTimeout(1000);
    
    // Step 6: Confirm new email address is verified and old one is not
    const isNewEmailVerified = await isEmailVerified(newEmailAddress);
    expect(isNewEmailVerified).toBe(true);

    const isOriginalEmailStillVerified = await isEmailVerified(originalEmailAddress);
    expect(isOriginalEmailStillVerified).toBe(false);
  });
});