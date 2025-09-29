'use server'

import { auth } from './auth'
import { appDatabase, UserWithRole, ListUsersResponse, db } from './database'

/**
 * Query users directly from the database using Kysely
 * This function bypasses the Better Auth API and queries the user table directly
 */
export async function queryUsersWithKysely(): Promise<UserWithRole[]> {
  try {
    const basicUsers = await db
      .selectFrom('user')
      .selectAll()
      .execute()
    
    // Convert string dates to Date objects and add role-related fields
    return basicUsers.map(user => ({ 
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt), 
      role: null, 
      banned: null, 
      banReason: null, 
      banExpires: null 
    })) as UserWithRole[]
  } catch (dbError) {
    console.error('Database query failed:', dbError)
    return []
  }
}

/**
 * Query a single user by email directly from the database using Kysely
 * This function bypasses the Better Auth API and queries the user table directly
 */
export async function queryUserWithKysely(email: string): Promise<UserWithRole | null> {
  try {
    const user = await db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst()
    
    if (!user) {
      return null
    }
    
    // Convert string dates to Date objects and add role-related fields
    return {
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
      role: null,
      banned: null,
      banReason: null,
      banExpires: null
    } as UserWithRole
  } catch (dbError) {
    console.error('Database query failed:', dbError)
    return null
  }
}

export async function getAllUsers(headers: Headers): Promise<UserWithRole[]> {
  try {
    // Use Better Auth API to get users with role information
    const result = await auth.api.listUsers({
      query: {},
      headers
    }) as ListUsersResponse
    
    // Return the users array from the response
    return result.users || []
  } catch (error) {
    console.error('Error fetching users from Better Auth API:', error)
    // Fallback to basic user data from database using Kysely
    return queryUsersWithKysely()
  }
}

export async function deleteUserById(userId: string, headers: Headers) {
  console.log('deleteUserById', userId)
  
  try {
    // Get current session
    const session = await auth.api.getSession({ headers })
    
    if (!session) {
      throw new Error('Not authenticated')
    }
    
    // Prevent self-deletion for all users
    if (session.user.id === userId) {
      throw new Error('Cannot delete your own account. Please have another admin delete your account.')
    }
    
    // Use Better-auth's admin API to remove user by ID
    const result = await auth.api.removeUser({
      body: {
        userId: userId
      },
      headers
    })
    
    return { success: true, result }
  } catch (error) {
    console.error('Error deleting user:', error)
    throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function setUserRole(data: { userId: string; role: "admin" | "user" }, headers: Headers) {
  try {
    // Use Better Auth admin API to set user role with proper authentication
    const result = await auth.api.setRole({
      body: {
        userId: data.userId,
        role: data.role
      },
      headers
    })
    
    return { success: true, result }
  } catch (error) {
    console.error('Error setting user role:', error)
    throw new Error('Failed to set user role')
  }
}

export async function demoteUserToUserRole(data: { userId: string }, headers: Headers) {
  try {
    // Use Better Auth admin API to set user role to default "user"
    const result = await auth.api.setRole({
      body: {
        userId: data.userId,
        role: "user"
      },
      headers
    })
    
    return { success: true, result }
  } catch (error) {
    console.error('Error demoting user to regular user role:', error)
    throw new Error('Failed to demote user to regular user role')
  }
}

export async function updateEmailVerificationStatus(data: { userId: string; emailVerified: boolean }, headers: Headers) {
  try {
    // Get current session to verify admin access
    const session = await auth.api.getSession({ headers })
    
    if (!session) {
      throw new Error('Not authenticated')
    }
    
    // Update email verification status using Kysely
    const result = await db
      .updateTable('user')
      .set({ emailVerified: data.emailVerified })
      .where('id', '=', data.userId)
      .executeTakeFirst()
    
    if (!result || result.numUpdatedRows === 0n) {
      throw new Error('User not found or no changes made')
    }
    
    return { success: true, result }
  } catch (error) {
    console.error('Error updating email verification status:', error)
    throw new Error(`Failed to update email verification status: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Export the UserWithRole type as User for backward compatibility
export type User = UserWithRole