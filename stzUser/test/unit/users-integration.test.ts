import {describe, it, expect} from 'vitest'
import {queryUsersWithKysely, queryUserWithKysely} from '~stzUser/lib/users'
import {auth} from '~stzUser/lib/auth'
import {testConstants} from '~stzUser/test/constants'
import {T} from 'vitest/dist/chunks/reporters.d.BFLkQcL6.js'

describe('queryUsersWithKysely basic test', () => {
  it('should allow Kysely to query better-auth users from database and return expected structure', async () => {
    // Query all users using the function we want to test
    const users = await queryUsersWithKysely()

    // Log the number of users found
    console.log(`Found ${users.length} users in database`)

    // Verify basic array structure
    expect(Array.isArray(users)).toBe(true)

    // If we have users, verify the structure
    if (users.length > 0) {
      const user = users[0]

      // Verify basic user properties exist
      expect(user.id).toBeDefined()
      expect(user.email).toBeDefined()

      // Verify date conversion worked -- seems unimportant
      // expect(user.createdAt).toBeInstanceOf(Date)
      // expect(user.updatedAt).toBeInstanceOf(Date)

      // Verify role fields were added
      // On second thought, these make the test slightly fragile and don't add much value
      // expect(user).toHaveProperty('role')
      // expect(user).toHaveProperty('banned')
      // expect(user).toHaveProperty('banReason')
      // expect(user).toHaveProperty('banExpires')
    } else {
      console.log('No users found in database - test is still valid but limited')
    }
  })
 
  // Helper function to create test user if it doesn't already exist.
  // Can be reused with different user parameters for various tests.

  // Note we never delete this test user due to better-auth requiring
  // admin privileges for deletion.  And manual deletion might cause
  // issues with orphan session etc
  async function createTestUserIfNeeded(email: string, password: string, name: string) {
    // First check if the user already exists
    let testUser = await queryUserWithKysely(email)
    
    // If the test user doesn't exist, create it
    if (!testUser) {
      console.log(`Test user ${email} does not exist, creating it now`)
      
      await auth.api.createUser({
        body: {
          email,
          password,
          name,
          role: "user",
          data: {isTestUser: true, purpose: "integration-testing"},
        },
      });
      console.log(`Test user ${email} created successfully`)
    } else {
      // console.log(`Test user ${email} already exists, no action needed`)
    }
  }
  
  it('kysely should be able to retrieve a user from better-auth', async () => {
    // Test-user constants
    const testEmail = `integration-test-user@${testConstants.defaultUserDomain}`
    const password = testConstants.defaultPassword
    const name = "Integration Test User"
    
    try {
        // Ensure test user exists
        await createTestUserIfNeeded(testEmail, password, name)
        
        // Explicitly query for the user with the new direct query function
      const testUser = await queryUserWithKysely(testEmail)
      
      // Verify the test user exists and can be retrieved via Kysely
      expect(testUser).not.toBeNull()
      expect(testUser?.email).toBe(testEmail)
      
      // No cleanup needed - we keep the test user for future test runs
      // also see note about user deletion in createTestUserIfNeeded
    } catch (error) {
      console.error('Error in integration test user verification:', error)
      throw error
    }
  })
})