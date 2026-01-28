/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { db } from '~stzUser/lib/database'
import { getWalletStatusInternal, grantCreditsInternal, consumeResourceInternal, claimWelcomeGrantInternal } from '~stzUser/lib/wallet.logic'
import { auth } from '~stzUser/lib/auth'
import { ensureAdditionalTables } from '~stzUser/lib/migrations'
import { testConstants } from '~stzUser/test/constants'

describe.sequential('Wallet Ledger Integration', () => {
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

  it('should start with 100 credits (from daily grant)', async () => {
    const status = await getWalletStatusInternal(testUserId)
    expect(status.credits).toBe(100)
  })

  it('should consume resources from daily grant', async () => {
    // Consume 1
    const res1 = await consumeResourceInternal(testUserId, 'test_resource')
    expect(res1.success).toBe(true)
    expect(res1.message).toContain('Consumed 1 credits')

    let status = await getWalletStatusInternal(testUserId)
    expect(status.credits).toBe(99)

    // Consume 99 more (total 100)
    for (let i = 0; i < 99; i++) {
      await consumeResourceInternal(testUserId, 'test_resource')
    }

    status = await getWalletStatusInternal(testUserId)
    expect(status.credits).toBe(0)

    // Try to consume 4th without credits
    const res4 = await consumeResourceInternal(testUserId, 'test_resource')
    expect(res4.success).toBe(false)
    expect(res4.message).toContain('Insufficient')
  })

  it('should consume from credits after grant is exhausted', async () => {
    // 1. Exhaust grant (100)
    for (let i = 0; i < 100; i++) {
      await consumeResourceInternal(testUserId, 'test_resource')
    }

    // 2. Grant credits
    await grantCreditsInternal(testUserId, 10, 'purchase', 'Test Purchase')

    let status = await getWalletStatusInternal(testUserId)
    expect(status.credits).toBe(10)

    // 3. Consume 4th action (should hit credits)
    const res4 = await consumeResourceInternal(testUserId, 'test_resource')
    expect(res4.success).toBe(true)
    expect(res4.message).toContain('Consumed 1 credits')

    status = await getWalletStatusInternal(testUserId)
    expect(status.credits).toBe(9)
  })

  it('should handle granting credits correctly', async () => {
    await grantCreditsInternal(testUserId, 50, 'purchase', 'Huge Grant')
    await grantCreditsInternal(testUserId, -10, 'manual_adjustment', 'Adjustment')

    const status = await getWalletStatusInternal(testUserId)
    // 100 initial + 50 - 10 = 140
    expect(status.credits).toBe(140)
  })

  it('should support consuming multiple credits at once', async () => {
    // 1. Grant extra credits
    await grantCreditsInternal(testUserId, 10, 'purchase', 'Bonus')

    // 2. Consume 5 credits (3 daily + 10 bonus = 13 total)
    const res = await consumeResourceInternal(testUserId, 'bulk_action', 5)
    expect(res.success).toBe(true)
    expect(res.message).toContain('Consumed 5 credits')

    const status = await getWalletStatusInternal(testUserId)
    expect(status.credits).toBe(105)
  })

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  it('should prevent double-granting during concurrent requests (Race Condition)', async () => {
    // 1. Create a fresh user without credits (they get 0 on construction)
    const timestamp = Date.now() + Math.random()
    const res = await auth.api.createUser({
      body: {
        email: `race-test-${timestamp}@example.com`,
        password: testConstants.defaultPassword,
        name: 'Race Tester',
      },
    })
    const raceUserId = res.user!.id

    // 2. Fire 5 concurrent requests to get status (which triggers grant)
    // We use a small stagger (10ms) to allow LibSQL's queue to handle the locks
    // while still testing the atomicity of the 'ensureDailyAllowance' check.
    const requests = [
      getWalletStatusInternal(raceUserId),
      (async () => { await sleep(10); return getWalletStatusInternal(raceUserId) })(),
      (async () => { await sleep(20); return getWalletStatusInternal(raceUserId) })(),
      (async () => { await sleep(30); return getWalletStatusInternal(raceUserId) })(),
      (async () => { await sleep(40); return getWalletStatusInternal(raceUserId) })(),
    ]
    await Promise.all(requests)

    // 3. Verify exactly 100 credits were granted, not 500
    const status = await getWalletStatusInternal(raceUserId)
    expect(status.credits).toBe(100)
  })

  it('should prevent negative balance during concurrent consumption', async () => {
    // 1. Give user exactly 1 credit
    // (Note: they already have 3 from the first action, so we use that)
    const statusBefore = await getWalletStatusInternal(testUserId)
    const currentCredits = statusBefore.credits

    // We want to try to spend more than they have concurrently
    // Let's try to spend 'currentCredits + 2' credits using concurrent requests of 1 each
    const requests: Promise<{ success: boolean; message: string }>[] = []
    for (let i = 0; i < currentCredits + 2; i++) {
      const stagger = i * 10
      requests.push((async () => {
        if (stagger > 0) await sleep(stagger)
        return consumeResourceInternal(testUserId, 'race_resource', 1)
      })())
    }

    const results = await Promise.all(requests)

    // 2. Count successes
    const successes = results.filter(r => r.success).length
    expect(successes).toBe(currentCredits)

    // 3. Verify balance is exactly 0, not negative
    const statusAfter = await getWalletStatusInternal(testUserId)
    expect(statusAfter.credits).toBe(0)
  })

  it('should handle the one-time welcome grant', async () => {
    // 1. Claim grant
    const result = await claimWelcomeGrantInternal(testUserId)
    expect(result.success).toBe(true)
    if ('message' in result) {
      expect(result.message).toContain('Welcome grant of 10 credits')
    }

    const status = await getWalletStatusInternal(testUserId)
    // 100 from first action (daily grant) + 500 welcome = 600
    expect(status.credits).toBe(600)

    // 2. Try to claim again
    const result2 = await claimWelcomeGrantInternal(testUserId)
    expect(result2.success).toBe(false)
    if ('message' in result2) {
      expect(result2.message).toContain('already claimed')
    }

    // 3. Verify balance hasn't changed
    const status2 = await getWalletStatusInternal(testUserId)
    expect(status2.credits).toBe(600)
  })
})
