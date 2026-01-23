
/**
 * Verifies a Cloudflare Turnstile token.
 * This should only be called on the server.
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY is not set');
    return false;
  }

  if (!token) {
    console.error('Turnstile token is missing');
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    });

    const outcome = await response.json();

    if (outcome.success) {
      console.log('✅ Turnstile verification successful');
      return true;
    } else {
      console.error('❌ Turnstile verification failed:', outcome['error-codes']);
      return false;
    }
  } catch (error) {
    console.error('❌ Error verifying Turnstile token:', error);
    return false;
  }
}
