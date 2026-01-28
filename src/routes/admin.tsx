// src/routes/admin.tsx
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { sendTestEmail } from '~stzUser/lib/mail-utilities'
import { updateCount, getCount } from '~/lib/count'
import { admin, useSession } from '~stzUser/lib/auth-client'
import { Spacer } from '~stzUtils/components/Spacer'
import { useEffect, useState } from 'react'
import { useConsumeResource, useGrantCredits } from '~stzUser/lib/wallet.server'
import { userRoles } from '~stzUser/constants'
import { saveSampleGame, deleteGameById } from '~/lib/chess-server'

function AdminPage() {
  const { data: session } = useSession()
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [grantAmount, setGrantAmount] = useState(10)
  const [grantDescription, setGrantDescription] = useState('Manual Bank Transfer')
  const [savedGameId, setSavedGameId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    const doGetCount = async () => {
      try {
        setCount(await getCount())
      } catch (error) {
        console.error('Failed to get count:', error)
      } finally {
        setIsLoading(false)
      }
    }
    doGetCount()
  }, [])

  const handleSendTestMessage = async () => {
    sendTestEmail()
    alert('test email sent')
  }

  const handleUpdateCount = async () => {
    await updateCount({ data: 1 })
    setCount(await getCount())
  }

  const testListUsers = async () => {
    const userEmail = session?.user?.email || 'current user'
    try {
      const { data: users, error } = await admin.listUsers({ query: {} })
      if (error) {
        alert(`❌ Permission denied: ${error.message}`)
      } else {
        const userCount = Array.isArray(users) ? users.length : (users?.users?.length || 0)
        alert(`✅ Success: ${userCount} users found. Admin privileges confirmed for ${userEmail}.`)
      }
    } catch (error: any) {
      alert(`❌ Exception: ${error.message}`)
    }
  }

  const handleGrantCredits = async () => {
    try {
      await useGrantCredits({ data: { amount: grantAmount, description: grantDescription } })
      window.location.reload()
    } catch (err) {
      console.error('Failed to grant credits:', err)
    }
  }

  const handleConsumeCredit = async () => {
    try {
      const result = await useConsumeResource({ data: { resourceType: 'admin_tools_test', amount: 1 } })
      if (!result.success) {
        alert(result.message)
      } else {
        window.location.reload()
      }
    } catch (err) {
      console.error('Failed to consume credit:', err)
    }
  }

  const handleSaveSampleGame = async () => {
    try {
      const saved = await saveSampleGame()
      console.log('Saved sample game:', saved)
      alert(`✅ Sample game saved with id ${saved?.id || '(unknown)'} and title "${saved?.title || ''}"`)
      if (saved?.id) {
        setSavedGameId(saved.id)
        setDeleteTargetId(saved.id)
      }
    } catch (e: any) {
      console.error('Exception saving sample game:', e)
      alert(`Failed to save sample game: ${e?.message || e}`)
    }
  }

  const handleDeleteGame = async () => {
    const gameId = (deleteTargetId || savedGameId || '').trim()
    if (!gameId) {
      alert('Please enter a game id to delete.')
      return
    }
    try {
      const result = await deleteGameById({ data: gameId })
      console.log('Delete result:', result)
      const rows = result?.result?.numDeletedRows
      alert(`🗑️ Deleted game ${gameId}. Rows affected: ${typeof rows !== 'undefined' ? String(rows) : '?'}`)
      if (savedGameId === gameId) {
        setSavedGameId(null)
      }
    } catch (e: any) {
      console.error('Exception deleting game:', e)
      alert(`Failed to delete game: ${e?.message || e}`)
    }
  }

  if (session === undefined) return <div>Loading...</div>

  if (session?.user?.role !== userRoles.admin) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>You must be an administrator to view this page.</p>
        <Link to="/">Return to Home</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Admin Tools</h1>
      <p>Manage system state and verify administrative privileges.</p>

      <Spacer orientation="vertical" />

      <section style={{
        border: '1px solid var(--color-bg-secondary)',
        padding: '1.5rem',
        borderRadius: '8px',
        backgroundColor: 'var(--color-bg-alt)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <h2 style={{ margin: 0 }}>System Verification</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" onClick={handleSendTestMessage}>
            Send Test Email
          </button>
          <button type="button" onClick={handleUpdateCount}>
            Add 1 to {isLoading ? '...' : count}
          </button>
          <button type="button" onClick={testListUsers}>
            Test Admin Privilege
          </button>
          <Link to="/auth/users">
            <button type="button">View Users</button>
          </Link>
          <button type="button" onClick={handleSaveSampleGame}>
            Save Sample Game
          </button>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Game ID to delete"
              value={deleteTargetId}
              onChange={(e) => setDeleteTargetId(e.target.value)}
              style={{ minWidth: '200px', padding: '0.4rem' }}
            />
            <button type="button" onClick={handleDeleteGame}>
              Delete Game
            </button>
          </div>
        </div>
      </section>

      <Spacer orientation="vertical" />

      <section style={{
        border: '1px solid var(--color-bg-secondary)',
        padding: '1.5rem',
        borderRadius: '8px',
        backgroundColor: 'var(--color-bg-alt)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <h2 style={{ margin: 0 }}>Wallet Management</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            Amount:
            <input
              type="number"
              value={grantAmount}
              onChange={(e) => setGrantAmount(Number(e.target.value))}
              style={{ width: '80px', padding: '0.4rem' }}
            />
          </label>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            Description:
            <input
              type="text"
              value={grantDescription}
              onChange={(e) => setGrantDescription(e.target.value)}
              style={{ width: '200px', padding: '0.4rem' }}
            />
          </label>
          <button type="button" onClick={handleGrantCredits}>
            Process Grant
          </button>
          <button type="button" onClick={handleConsumeCredit}>
            Consume 1 Credit
          </button>
        </div>
      </section>

      <Spacer orientation="vertical" />

      <Link to="/">Back to Dashboard</Link>
    </div>
  )
}

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})
