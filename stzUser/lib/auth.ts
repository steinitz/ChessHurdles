// src/lib/auth.ts
import { betterAuth, type BetterAuthOptions } from "better-auth"
import { reactStartCookies } from "better-auth/react-start"
import { admin } from "better-auth/plugins"
import { createAccessControl } from "better-auth/plugins/access"
import { adminAc } from "better-auth/plugins/admin/access"
import { oneTimeToken } from "better-auth/plugins/one-time-token"
import nodemailer from "nodemailer"
import { transportOptions, sendEmail } from "~stzUser/lib/mail-utilities"
import { routeStrings } from "~/constants"
import { libsqlClient, db } from "./database"
import { minPasswordLength } from "./password-validation"
import { verifyTurnstileToken } from "~stzUser/lib/turnstile.server"
import { APIError } from "better-auth/api"

// import { getEnvVar } from "./env"

const from = process.env.SMTP_FROM_ADDRESS

// new email address verification text
const verifyEmailSubject = 'Verify your email address'
const verifyEmailInstructions = 'Click the link below to verify your email address' // signup
const verifyEmailLinkText = 'Confirm Email Address' // signup

// change email address verification text
const verifyChangeEmailSubject = 'Verify your new email address'
const verifyChangeEmailInstructions = 'Click the link below to verify your new email address' // email change
const verifyChangeEmailLinkText = 'Confirm New Email Address'

// password Reset text
const passwordResetSubject = 'Reset your password'
const passwordResetLinkText = 'Click the link to reset your password: '

export { passwordResetSubject }

// Create email transport that automatically handles test vs production environments
let emailTransport: any = null

async function getEmailTransport() {
  if (!emailTransport) {
    emailTransport = nodemailer.createTransport(transportOptions!)
  }
  return emailTransport
}

let _auth: any = null

export const authOptions: BetterAuthOptions = {
  database: {
    db: db,
    type: "sqlite",
  },
  logger: {
    level: 'debug',
    log: (level, message, ...args) => {
      console.log(`[Better Auth ${level.toUpperCase()}]`, message, ...args);
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async (
        { user, newEmail, url }
      ) => {
        console.log('🔧 sendChangeEmailVerification called:', { user: user.email, newEmail, url });
        console.log('🔧 DEBUG: This function should send email to NEW address:', newEmail);
        // Send verification email to the NEW email address for email changes
        await sendEmail({
          data: {
            to: newEmail, // Send to the new email address, not the old one
            from: from || 'test@example.com',
            subject: verifyChangeEmailSubject /* + ' - sendChangeEmailVerification' */,
            text: `${verifyChangeEmailInstructions} ${newEmail} 

          ${verifyChangeEmailLinkText}
          ${url}`,
            html: `<p>${verifyChangeEmailInstructions} ${newEmail}</p>
          <br />
          <a href=${url}>${verifyChangeEmailLinkText}</a>`,
          }
        })
      }
    },
    deleteUser: {
      enabled: true
    }
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength,
    sendResetPassword: async (
      { user, url }
    ) => {
      console.log('🔄 sendResetPassword called for user:', user.email);
      console.log('🔄 Current time:', new Date().toISOString());

      await sendEmail({
        data: {
          to: user.email,
          from: from || 'test@example.com',
          subject: passwordResetSubject,
          text: `${passwordResetLinkText}${url}`,
          html: `<a href="${url}">${passwordResetLinkText}</a>`,
        }
      })
    },
    onPasswordReset: async ({ user }, request) => {
      console.log('✅ Password reset completed for user:', user.email);
      console.log('✅ Current time:', new Date().toISOString());
    },
  },
  emailVerification: {
    // WORKAROUND: Set to false due to Better Auth bug where sendOnSignUp affects email change verification
    // See: https://github.com/better-auth/better-auth/issues/2538
    // This should be true for proper security, but causes email change verification to fail
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({
      user,
      url,
    },
      request
    ) => {
      // Email verification data is available here:
      // - user: contains email and id
      // - url: the verification URL
      // - text/html: the email content

      // only send the email if it's not a change email request
      // this is fragile but works for now because the url includes 'callbackURL=/auth/profile'
      console.log('🔍 DEBUG: request.url =', request?.url);
      console.log('🔍 DEBUG: routeStrings.profile =', routeStrings.profile);
      const isEmailChange = request?.url.includes(routeStrings.profile)
      console.log('🔍 DEBUG: isEmailChange =', isEmailChange);
      if (!isEmailChange) {
        console.log('📧 sendVerificationEmail: sending signup verification email to', user.email);

        await sendEmail({
          data: {
            to: user.email,
            from: from || 'test@example.com',
            subject: verifyEmailSubject /* + ' - sendVerificationEmail' */,
            text: `${verifyEmailInstructions}

${verifyEmailLinkText}
${url}`,
            html: `<p>${verifyEmailInstructions}</p>
          <br />
          <a href="${url}">${verifyEmailLinkText}</a>`,
          }
        })
      }
      else {
        console.log('🚫 sendVerificationEmail: skipping old-email verification for change-email flow.  Calling verifyEmail directly, maybe for no good reason');

        // Experiment - get the token and verify the email address old email address.
        // I may have observed the changed email address not being verified but now i'm not sure. 
        // The following uses server-side auth.api.verifyEmail instead of client-side verifyEmail
        const temp = new URL(url)
        const searchParams = new URLSearchParams(temp.search)
        const token = searchParams.get("token") ?? ""
        if (_auth) {
          await _auth.api.verifyEmail({
            query: {
              token
            }
          })
        }
      }
    },
  },
  // session: {
  //   expiresIn: 60 * 60 * 24 * 7, // 7 days
  //   updateAge: 60 * 60 * 24, // 1 day (how often the session expiration is updated)
  // },
  hooks: {
    before: async (context) => {
      // Better Auth paths are relative to the auth base path (usually /api/auth)
      // but the context.request URL might vary depending on how it's called.
      if (context.request?.url.includes("/sign-up/email")) {
        const token = context.request.headers.get("x-turnstile-token");
        if (!token) {
          throw new APIError("BAD_REQUEST", {
            message: "Anti-bot verification required",
          });
        }
        const isValid = await verifyTurnstileToken(token);
        if (!isValid) {
          throw new APIError("BAD_REQUEST", {
            message: "Anti-bot verification failed",
          });
        }
      }
      return { context };
    },
  },
  plugins: [
    admin({
      ac: createAccessControl({
        ...adminAc.statements
      })
    }), // Admin plugin for user management
    oneTimeToken(), // One-time token plugin for email verification testing
    reactStartCookies() // This plugin handles cookie setting for TanStack Start.  Leave it as the last plugin.
  ],
}

export const auth = betterAuth(authOptions)
_auth = auth
