import { createFileRoute, Link } from '@tanstack/react-router'
import { UserManagement } from '~stzUser/components/Other/UserManagement'
import { useGetAllUsers } from '~stzUser/lib/users-client'
import { useSession } from '~stzUser/lib/auth-client'
import { useEffect, useState } from 'react'
import type { User } from '~stzUser/lib/users-client'
import { userRoles } from '~stzUser/constants'

function UsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

  // Load users data when component mounts or session changes
  useEffect(() => {
    const loadUsers = async () => {
      if (!session?.user) return // Only load if user is signed in

      setIsLoadingUsers(true)
      try {
        const usersData = await useGetAllUsers()
        setUsers(usersData || [])
      } catch (error) {
        console.error('Error loading users:', error)
        setUsers([])
      } finally {
        setIsLoadingUsers(false)
      }
    }

    loadUsers()
  }, [session?.user?.id, session?.user?.role]) // Reload when user or role changes

  if (!session?.user || session?.user?.role !== userRoles.admin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>You must be an administrator to view this page.</p>
        <Link to="/">Return to Home</Link>
      </div>
    )
  }

  return (
    <div>
      <h1>User Management</h1>
      {isLoadingUsers ? (
        <p>Loading users...</p>
      ) : (
        <UserManagement users={users} />
      )}
    </div>
  )
}

export const Route = createFileRoute('/auth/users')({
  component: UsersPage,
})