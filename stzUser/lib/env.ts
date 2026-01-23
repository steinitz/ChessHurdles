// Environment variable loading and validation
import * as dotenv from 'dotenv'

// Helper function to check if we're on the server
export const isServer = () => typeof window === 'undefined'

// Helper to safely get environment variables (server-side only)
export function getEnvVar(name: string): string {
  if (!isServer()) {
    throw new Error('getEnvVar can only be called on the server')
  }

  const value = process.env[name]
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`)
  }
  return value
}

// Helper to get optional environment variables
export function getOptionalEnvVar(name: string, defaultValue?: string): string | undefined {
  if (!isServer()) {
    throw new Error('getOptionalEnvVar can only be called on the server')
  }
  return process.env[name] || defaultValue
}

// Client-safe environment variables
type ClientEnv = {
  APP_NAME: string
  SMTP_FROM_ADDRESS: string | undefined
  SUPPORT_EMAIL_ADDRESS: string | undefined
  COMPANY_NAME: string
  BETTER_AUTH_BASE_URL: string
  TURNSTILE_SITE_KEY: string
}

// Load environment variables based on NODE_ENV
if (isServer()) {
  dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` })
}

// Client-safe environment variables (exposed to browser)
export const clientEnv: ClientEnv = isServer()
  ? {
    APP_NAME: process.env.APP_NAME || 'TanStack Start with Better Auth',
    SMTP_FROM_ADDRESS: process.env.SMTP_FROM_ADDRESS,
    SUPPORT_EMAIL_ADDRESS: process.env.SUPPORT_EMAIL_ADDRESS,
    COMPANY_NAME: process.env.COMPANY_NAME || 'Your Company',
    BETTER_AUTH_BASE_URL:
      process.env.BETTER_AUTH_URL ||
      process.env.BETTER_AUTH_BASE_URL ||
      'http://localhost:3000',
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
  }
  : (typeof window !== 'undefined' && window.__ENV)
    ? window.__ENV
    : {
      APP_NAME: 'TanStack Start with Better Auth',
      SMTP_FROM_ADDRESS: undefined,
      SUPPORT_EMAIL_ADDRESS: undefined,
      COMPANY_NAME: 'Your Company',
      BETTER_AUTH_BASE_URL: (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
      TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    }

// console.log({clientEnv});

// Extend window interface for client-side access
declare global {
  interface Window {
    __ENV?: ClientEnv
  }
}