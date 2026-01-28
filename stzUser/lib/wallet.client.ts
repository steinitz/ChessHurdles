/**
 * Client-side events for the wallet system.
 * These rely on the browser's native CustomEvent system to decouple UI components.
 */

export const WALLET_EVENTS = {
  UPDATED: 'stz-event-wallet-updated',
  INSUFFICIENT_CREDITS: 'stz-event-insufficient-credits',
} as const

/**
 * Dispatches an event indicating the wallet state has changed (e.g., after consumption or grant).
 */
export const notifyWalletUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WALLET_EVENTS.UPDATED))
  }
}

/**
 * Dispatches an event indicating the user has insufficient credits for an action.
 */
export const notifyInsufficientCredits = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WALLET_EVENTS.INSUFFICIENT_CREDITS))
  }
}
