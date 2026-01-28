import { db } from '~stzUser/lib/database'
import { clientEnv } from '~stzUser/lib/env'

export type WalletStatus = {
  credits: number
  welcomeClaimed: boolean
}

const DAILY_ALLOWANCE = clientEnv.DAILY_GRANT_CREDITS

/**
 * Logic: Fetches wallet status for a specific user.
 * This also triggers the daily grant if it hasn't been applied yet.
 */
export async function getWalletStatusInternal(userId: string) {
  // 1. Ensure daily allowance is applied (lazy grant)
  await ensureDailyAllowance(userId)

  // 2. Simply fetch credits from user record
  const user = await db
    .selectFrom('user')
    .select(['credits', 'welcome_claimed'])
    .where('id', '=', userId)
    .executeTakeFirst()

  return {
    credits: Number(user?.credits || 0),
    welcomeClaimed: Boolean(user?.welcome_claimed),
  }
}
/**
 * Logic: Ensures a user receives their daily credit grant.
 * Wrapped in a transaction to prevent race conditions (double grants).
 */
export async function ensureDailyAllowance(userId: string) {
  const today = new Date().toISOString().split('T')[0]

  await db.transaction().execute(async (trx) => {
    // Re-check inside transaction for maximum safety
    const existingGrant = await trx
      .selectFrom('transactions')
      .select('id')
      .where('user_id', '=', userId)
      .where('type', '=', 'daily_grant')
      .where('created_at', '>=', today)
      .executeTakeFirst()

    if (!existingGrant) {
      console.log(`🎁 Granting daily credits to user ${userId}`)
      // Passing trx to ensure the grant happens in the same atomic block
      await grantCreditsTx(trx, userId, DAILY_ALLOWANCE, 'daily_grant', 'Daily credit grant')
    }
  })
}

/**
 * Logic: Consumes a resource (variable credits) for a specific user.
 */
export async function consumeResourceInternal(userId: string, resourceType: string, amount: number = 1) {
  // 1. Ensure daily allowance is applied
  await ensureDailyAllowance(userId)

  // 2. Fetch current balance
  const status = await getWalletStatusInternal(userId)

  if (status.credits >= amount) {
    // 3. Consume credits
    const updateResult = await db.transaction().execute(async (trx) => {
      // Update user balance ONLY if they still have enough credits
      const res = await trx
        .updateTable('user')
        .set((eb) => ({
          credits: eb('credits', '-', amount),
        }))
        .where('id', '=', userId)
        .where('credits', '>=', amount) // Hard safeguard against negative balance
        .executeTakeFirst()

      // If update was successful, record the ledger entry
      if (Number(res.numUpdatedRows) > 0) {
        await trx
          .insertInto('transactions')
          .values({
            id: crypto.randomUUID(),
            user_id: userId,
            amount: -amount,
            type: 'consumption',
            description: `Resource consumption: ${resourceType} (${amount} credits)`,
            created_at: new Date().toISOString(),
          })
          .execute()
        return true
      }
      return false
    })

    if (updateResult) {
      return { success: true, message: `Consumed ${amount} credits` }
    }
  }

  return { success: false, message: 'Insufficient credits' }
}

/**
 * Logic: Grants credits to a specific user.
 * Updates both the ledger and the cached balance.
 */
export async function grantCreditsInternal(
  userId: string,
  amount: number,
  type: 'daily_grant' | 'purchase' | 'manual_adjustment',
  description: string
) {
  return await db.transaction().execute(async (trx) => {
    return await grantCreditsTx(trx, userId, amount, type, description)
  })
}

/**
 * Internal helper to grant credits using an existing transaction object.
 */
async function grantCreditsTx(
  trx: any,
  userId: string,
  amount: number,
  type: 'daily_grant' | 'purchase' | 'manual_adjustment',
  description: string
) {
  // 1. Add ledger entry
  await trx
    .insertInto('transactions')
    .values({
      id: crypto.randomUUID(),
      user_id: userId,
      amount: amount,
      type: type,
      description: description,
      created_at: new Date().toISOString(),
    })
    .execute()

  // 2. Update user cached balance
  await trx
    .updateTable('user')
    .set((eb) => ({
      credits: eb('credits', '+', amount),
    }))
    .where('id', '=', userId)
    .execute()

  return { success: true }
}

/**
 * Logic: Fetches the transaction history for a specific user.
 */
export async function getTransactionsInternal(userId: string) {
  return await db
    .selectFrom('transactions')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .execute()
}

/**
 * Logic: Checks if a user has already claimed their one-time welcome grant.
 */
export async function hasClaimedWelcomeGrant(userId: string) {
  const user = await db
    .selectFrom('user')
    .select('welcome_claimed')
    .where('id', '=', userId)
    .executeTakeFirst()

  return Boolean(user?.welcome_claimed)
}

/**
 * Logic: Claims the one-time welcome grant for a user.
 */
export async function claimWelcomeGrantInternal(userId: string) {
  return await db.transaction().execute(async (trx) => {
    // 1. Re-check claimed status inside transaction for safety
    const user = await trx
      .selectFrom('user')
      .select('welcome_claimed')
      .where('id', '=', userId)
      .executeTakeFirst()

    if (user?.welcome_claimed) {
      return { success: false, message: 'Welcome grant already claimed.' }
    }

    // 2. Grant credits (this updates both user balance and transaction ledger)
    await grantCreditsTx(trx, userId, clientEnv.WELCOME_GRANT_CREDITS, 'manual_adjustment', 'One-time Welcome Grant')

    // 3. Mark as claimed
    await trx
      .updateTable('user')
      .set({ welcome_claimed: 1 })
      .where('id', '=', userId)
      .execute()

    return { success: true }
  })
}
