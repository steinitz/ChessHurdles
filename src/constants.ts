export const companyName: string = 'TanStack Start App'

// Support email for the application - don't use this, use process.env.SMTP_REPLY_TO_ADDRESS
// export const supportEmail: string = 'support@example.com'

// Uses:
// reset-password.$token route to identify no default email
// FormFieldError as a no-error-message value
export const noValue = '_'

// Used for user-not-found-for-token in email-address-confirmed
// and reset-password routes
export const errorStringUserNotDefined = "User is not defined"
export const errorRowNotFound = "Row not found"

// route strings
export const routeStrings = {
  signin: '/auth/signin',
  signup: '/auth/signup',
  profile: '/auth/profile',
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  about: '/legal/about',
  acknowledgements: '/legal/acknowledgements',
  refunds: '/legal/refunds',
  pricing: '/legal/pricing',
}