import { db } from '~stzUser/lib/database'

export type WalletStatus = {
  allowance: number
  usageToday: number
  credits: number
}

const DAILY_ALLOWANCE = 3

/**
 * Logic: Fetches wallet status for a specific user.
 */
export async function getWalletStatusInternal(userId: string) {
  const today = new Date().toISOString().split('T')[0]

  // Count usage today
  const usageCount = await db
    .selectFrom('resource_usage')
    .select(db.fn.count('id').as('count'))
    .where('user_id', '=', userId)
    .where('created_at', '>=', today)
    .executeTakeFirst()

  const usageToday = Number(usageCount?.count || 0)

  // Sum credits from transactions
  const creditSum = await db
    .selectFrom('transactions')
    .select(db.fn.sum('amount').as('total'))
    .where('user_id', '=', userId)
    .executeTakeFirst()

  const credits = Number(creditSum?.total || 0)

  return {
    allowance: DAILY_ALLOWANCE,
    usageToday,
    credits,
  }
}

/**
 * Logic: Consumes a resource for a specific user.
 */
export async function consumeResourceInternal(userId: string, resourceType: string) {
  // Check current usage
  const status = await getWalletStatusInternal(userId)

  if (status.usageToday < DAILY_ALLOWANCE) {
    // Consume from allowance
    await db
      .insertInto('resource_usage')
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        resource_type: resourceType,
        created_at: new Date().toISOString(),
      })
      .execute()

    return { success: true, message: 'Resource consumed from daily allowance' }
  }

  if (status.credits >= 1) {
    // Consume 1 credit
    await db.transaction().execute(async (trx) => {
      // 1. Record transaction
      await trx
        .insertInto('transactions')
        .values({
          id: crypto.randomUUID(),
          user_id: userId,
          amount: -1,
          description: `Resource consumption: ${resourceType}`,
          created_at: new Date().toISOString(),
        })
        .execute()

      // 2. Record usage
      await trx
        .insertInto('resource_usage')
        .values({
          id: crypto.randomUUID(),
          user_id: userId,
          resource_type: resourceType,
          created_at: new Date().toISOString(),
        })
        .execute()
    })

    return { success: true, message: 'Resource consumed from credits' }
  }

  return { success: false, message: 'Insufficient actions or credits' }
}

/**
 * Logic: Grants credits to a specific user.
 */
export async function grantCreditsInternal(userId: string, amount: number, description: string) {
  await db
    .insertInto('transactions')
    .values({
      id: crypto.randomUUID(),
      user_id: userId,
      amount: amount,
      description: description,
      created_at: new Date().toISOString(),
    })
    .execute()

  return { success: true }
}
