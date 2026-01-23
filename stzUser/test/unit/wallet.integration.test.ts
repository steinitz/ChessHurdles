import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { db } from '~stzUser/lib/database'
import { getWalletStatusInternal, grantCreditsInternal, consumeResourceInternal } from '~stzUser/lib/wallet.logic'
import { auth } from '~stzUser/lib/auth'
import { ensureAdditionalTables } from '~stzUser/lib/migrations'
import { testConstants } from '~stzUser/test/constants'

describe('Wallet Ledger Integration', () => {
  let testUserId: string

  beforeAll(async () => {
    await ensureAdditionalTables()
  })

  beforeEach(async () => {
    const timestamp = Date.now() + Math.random()
    const testEmail = `wallet-test-${timestamp}@${testConstants.defaultUserDomain}`

    // Create a fresh test user
    const res = await auth.api.createUser({
      body: {
        email: testEmail,
        password: testConstants.defaultPassword,
        name: 'Wallet Tester',
        role: 'user',
      },
    })

    if (!res?.user) throw new Error('Failed to create test user')
    testUserId = res.user.id
  })

  it('should start with 3 actions and 0 credits', async () => {
    const status = await getWalletStatusInternal(testUserId)
    expect(status.allowance).toBe(3)
    expect(status.usageToday).toBe(0)
    expect(status.credits).toBe(0)
  })

  it('should consume resources from daily allowance first', async () => {
    // Consume 1
    const res1 = await consumeResourceInternal(testUserId, 'test_resource')
    expect(res1.success).toBe(true)
    expect(res1.message).toContain('daily allowance')

    let status = await getWalletStatusInternal(testUserId)
    expect(status.usageToday).toBe(1)
    expect(status.credits).toBe(0)

    // Consume 2 more (total 3)
    await consumeResourceInternal(testUserId, 'test_resource')
    await consumeResourceInternal(testUserId, 'test_resource')

    status = await getWalletStatusInternal(testUserId)
    expect(status.usageToday).toBe(3)
    expect(status.credits).toBe(0)

    // Try to consume 4th without credits
    const res4 = await consumeResourceInternal(testUserId, 'test_resource')
    expect(res4.success).toBe(false)
    expect(res4.message).toContain('Insufficient')
  })

  it('should consume from credits after allowance is exhausted', async () => {
    // 1. Exhaust allowance (3)
    for (let i = 0; i < 3; i++) {
      await consumeResourceInternal(testUserId, 'test_resource')
    }

    // 2. Grant credits
    await grantCreditsInternal(testUserId, 10, 'Test Grant')

    let status = await getWalletStatusInternal(testUserId)
    expect(status.credits).toBe(10)

    // 3. Consume 4th action (should hit credits)
    const res4 = await consumeResourceInternal(testUserId, 'test_resource')
    expect(res4.success).toBe(true)
    expect(res4.message).toContain('credits')

    status = await getWalletStatusInternal(testUserId)
    expect(status.usageToday).toBe(4)
    expect(status.credits).toBe(9)
  })

  it('should handle granting credits correctly', async () => {
    await grantCreditsInternal(testUserId, 50, 'Huge Grant')
    await grantCreditsInternal(testUserId, -10, 'Adjustment')

    const status = await getWalletStatusInternal(testUserId)
    expect(status.credits).toBe(40)
  })
})
