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
  // Support & Compliance
  CONTACT_EMAIL: string | undefined
  CONTACT_ADDRESS: string | undefined
  REFUND_POLICY_URL: string | undefined
  COPYRIGHT_START_YEAR: string
  SUPPORT_LINK_TEXT: string
  SUPPORT_LINK_URL: string
  // Bank Transfer & Pricing
  BANK_TRANSFER_BSB: string | undefined
  BANK_TRANSFER_ACC: string | undefined
  CREDIT_PRICE_AUD: number
  MIN_CREDITS_PURCHASE: number
  DAILY_GRANT_CREDITS: number
  WELCOME_GRANT_CREDITS: number
  DEFAULT_CREDITS_PURCHASE: number
  IS_STRIPE_ENABLED: boolean
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
    CONTACT_EMAIL: process.env.CONTACT_EMAIL || process.env.SUPPORT_EMAIL_ADDRESS,
    CONTACT_ADDRESS: process.env.CONTACT_ADDRESS,
    REFUND_POLICY_URL: process.env.REFUND_POLICY_URL || '/legal/refunds',
    COPYRIGHT_START_YEAR: process.env.COPYRIGHT_START_YEAR || new Date().getFullYear().toString(),
    SUPPORT_LINK_TEXT: process.env.SUPPORT_LINK_TEXT || 'Contact our Support Team',
    SUPPORT_LINK_URL: process.env.SUPPORT_LINK_URL || '/contact',
    BANK_TRANSFER_BSB: process.env.BANK_TRANSFER_BSB,
    BANK_TRANSFER_ACC: process.env.BANK_TRANSFER_ACC,
    CREDIT_PRICE_AUD: Number(process.env.CREDIT_PRICE_AUD || '0.001'),
    MIN_CREDITS_PURCHASE: Number(process.env.MIN_CREDITS_PURCHASE || '10'),
    DAILY_GRANT_CREDITS: Number(process.env.DAILY_GRANT_CREDITS || '100'),
    WELCOME_GRANT_CREDITS: Number(process.env.WELCOME_GRANT_CREDITS || '500'),
    DEFAULT_CREDITS_PURCHASE: Number(process.env.DEFAULT_CREDITS_PURCHASE || '5000'),
    IS_STRIPE_ENABLED: false, // Set to true when Stripe is fully integrated
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
      CONTACT_EMAIL: undefined,
      CONTACT_ADDRESS: undefined,
      REFUND_POLICY_URL: '/legal/refunds',
      COPYRIGHT_START_YEAR: new Date().getFullYear().toString(),
      SUPPORT_LINK_TEXT: 'Contact our Support Team',
      SUPPORT_LINK_URL: '/contact',
      BANK_TRANSFER_BSB: undefined,
      BANK_TRANSFER_ACC: undefined,
      CREDIT_PRICE_AUD: 0.001,
      MIN_CREDITS_PURCHASE: 10,
      DAILY_GRANT_CREDITS: 100,
      WELCOME_GRANT_CREDITS: 500,
      DEFAULT_CREDITS_PURCHASE: 5000,
      IS_STRIPE_ENABLED: false,
    }

// console.log({clientEnv});

// Extend window interface for client-side access
declare global {
  interface Window {
    __ENV?: ClientEnv
  }
}