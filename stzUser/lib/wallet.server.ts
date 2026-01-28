import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { auth } from './auth'
import { getWalletStatusInternal, consumeResourceInternal, grantCreditsInternal, type WalletStatus, getTransactionsInternal, claimWelcomeGrantInternal } from './wallet.logic'
import { clientEnv } from './env'
import { sendEmail } from './mail-utilities'

export type { WalletStatus }

/**
 * Server function to get the current user's wallet status.
 */
export const getWalletStatus = createServerFn({
  method: 'GET',
}).handler(async () => {
  const request = getWebRequest()
  const headers = request?.headers
  if (!headers) throw new Error('Not authenticated')

  const session = await auth.api.getSession({ headers })
  if (!session?.user) throw new Error('Not authenticated')

  return getWalletStatusInternal(session.user.id)
})

/**
 * Server function to consume a resource for the current user.
 */
export const useConsumeResource = createServerFn({
  method: 'POST',
})
  .validator((data: { resourceType: string; amount?: number }) => data)
  .handler(async ({ data }) => {
    const request = getWebRequest()
    const headers = request?.headers
    if (!headers) throw new Error('Not authenticated')

    const session = await auth.api.getSession({ headers })
    if (!session?.user) throw new Error('Not authenticated')

    return consumeResourceInternal(session.user.id, data.resourceType, data.amount ?? 1)
  })

/**
 * Server function to grant credits to a user (e.g., for testing).
 */
export const useGrantCredits = createServerFn({
  method: 'POST',
})
  .validator((data: { amount: number; type?: 'manual_adjustment' | 'purchase'; description: string }) => data)
  .handler(async ({ data }) => {
    const request = getWebRequest()
    const headers = request?.headers
    if (!headers) throw new Error('Not authenticated')

    const session = await auth.api.getSession({ headers })
    if (!session?.user) throw new Error('Not authenticated')

    return grantCreditsInternal(
      session.user.id,
      data.amount,
      data.type || 'manual_adjustment',
      data.description
    )
  })

/**
 * Server function to get the current user's transaction history.
 */
export const getTransactions = createServerFn({
  method: 'GET',
}).handler(async () => {
  const request = getWebRequest()
  const headers = request?.headers
  if (!headers) throw new Error('Not authenticated')

  const session = await auth.api.getSession({ headers })
  if (!session?.user) throw new Error('Not authenticated')

  return getTransactionsInternal(session.user.id)
})

/**
 * Server function to claim the one-time welcome grant.
 */
export const claimWelcomeGrant = createServerFn({
  method: 'POST',
}).handler(async () => {
  const request = getWebRequest()
  const headers = request?.headers
  if (!headers) throw new Error('Not authenticated')

  const session = await auth.api.getSession({ headers })
  if (!session?.user) throw new Error('Not authenticated')

  return claimWelcomeGrantInternal(session.user.id)
})

/**
 * Server function to request a manual bank transfer purchase.
 */
export const requestBankTransfer = createServerFn({
  method: 'POST',
})
  .validator((data: { amount: number }) => data)
  .handler(async ({ data }) => {
    const request = getWebRequest()
    const headers = request?.headers
    if (!headers) throw new Error('Not authenticated')

    const session = await auth.api.getSession({ headers })
    if (!session?.user) throw new Error('Not authenticated')

    if (data.amount < clientEnv.MIN_CREDITS_PURCHASE) {
      throw new Error(`Minimum purchase is ${clientEnv.MIN_CREDITS_PURCHASE} credits`)
    }

    const cost = (data.amount * clientEnv.CREDIT_PRICE_AUD).toFixed(2)

    // Notify developer
    await sendEmail({
      data: {
        to: clientEnv.SUPPORT_EMAIL_ADDRESS,
        from: clientEnv.SUPPORT_EMAIL_ADDRESS,
        subject: `💰 Credit Purchase Request: ${session.user.email}`,
        text: `User ${session.user.email} (ID: ${session.user.id}) has requested to purchase ${data.amount} credits for AUD$${cost} via bank transfer.`,
        html: `
          <h3>Credit Purchase Request</h3>
          <p><strong>User:</strong> ${session.user.email}</p>
          <p><strong>User ID:</strong> ${session.user.id}</p>
          <p><strong>Requested Credits:</strong> ${data.amount}</p>
          <p><strong>Total Cost:</strong> AUD$${cost}</p>
          <p>Please wait for payment verification before manually granting credits via the Admin panel.</p>
        `
      }
    })

    return { success: true }
  })
