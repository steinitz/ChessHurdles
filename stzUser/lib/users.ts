'use server'

import { auth } from './auth'
import { appDatabase, UserWithRole, ListUsersResponse } from './database'

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
    // Fallback to basic user data from database
    try {
      const stmt = appDatabase.prepare('SELECT * FROM user')
      const basicUsers = stmt.all() as Array<{
        id: string
        name: string
        email: string
        emailVerified: boolean
        image: string | null
        createdAt: Date
        updatedAt: Date
      }>
      return basicUsers.map(user => ({ 
        ...user, 
        role: null, 
        banned: null, 
        banReason: null, 
        banExpires: null 
      })) as UserWithRole[]
    } catch (dbError) {
      console.error('Database fallback failed:', dbError)
      return []
    }
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
    
    // Update email verification status directly in the database
    const stmt = appDatabase.prepare('UPDATE user SET emailVerified = ? WHERE id = ?')
    const result = stmt.run(data.emailVerified ? 1 : 0, data.userId)
    
    if (result.changes === 0) {
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