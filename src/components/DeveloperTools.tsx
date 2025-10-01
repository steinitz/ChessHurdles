// import { Route as RootRoute } from '~/routes/__root'; // Import the root route
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { sendTestEmail } from '~stzUser/lib/mail-utilities'
import { updateCount } from '~/lib/count'
import { useLoaderData, useRouter } from '@tanstack/react-router'
import { Spacer } from '~stzUtils/components/Spacer'
import { useEffect, useState, useRef } from 'react'
import { getCount } from '~/lib/count'
import { saveSampleGame, deleteGameById } from '~/lib/chess-server'
import { admin, useSession } from '~stzUser/lib/auth-client'
import { Link } from '@tanstack/react-router'
import { CSSProperties } from 'react'

type DetailsItemsStyleAttributeType = {
  position: string
  top: string
  left: string
}

export const DeveloperTools = ({
  detailItemsStyleAttribute,
}: {
  detailItemsStyleAttribute: DetailsItemsStyleAttributeType
}) => {
  // const {count} = useLoaderData({from: RootRoute.id})
  const [count, setCount] = useState(0)
  const router = useRouter()
  const { data: session } = useSession()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [savedGameId, setSavedGameId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string>('')


  useEffect(() => {
    // declare the data fetching function
    const doGetCount = async () => {
      setCount(await getCount())
    }

    // call the function
    doGetCount()
      // make sure to catch any error
      .catch(console.error);
  }, [])

  // Auto-close developer tools on click outside and route changes
  useEffect(() => {
    const closeDetails = () => {
      if (detailsRef.current && detailsRef.current.open) {
        detailsRef.current.open = false
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && detailsRef.current.open && !detailsRef.current.contains(event.target as Node)) {
        detailsRef.current.open = false
      }
    }

    // Close on route changes using native browser events
    let currentUrl = window.location.href
    const handleRouteChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href
        closeDetails()
      }
    }

    // Listen for both popstate (back/forward) and any URL changes
    window.addEventListener('popstate', closeDetails)
    const urlCheckInterval = setInterval(handleRouteChange, 100)

    document.addEventListener('click', handleClickOutside)

    return () => {
      window.removeEventListener('popstate', closeDetails)
      clearInterval(urlCheckInterval)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])



  const detailsItemsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  }

  if (detailItemsStyleAttribute) {
    Object.assign(detailsItemsStyle, detailItemsStyleAttribute)
  }

  const handleSendTestMessage = async () => {
    sendTestEmail()
    alert('test email sent')
  }

  const handleUpdateCount = async () => {
    await updateCount({ data: 1 }).then(() => {
      // this makes the count value update in the UI
      // router.invalidate()
    })
    setCount(await getCount())
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

  const testListUsers = async () => {
    const userEmail = session?.user?.email || 'current user'

    const createErrorMessage = (errorMessage: string, isException = false) => {
      const failureType = isException ? 'failed with exception' : 'failed'
      return `❌ User ${userEmail} does not have admin privileges.\n\nBetter Auth reports a permission error on the test call to auth.listUsers: \n\n    ${failureType}: ${errorMessage}.`
    }

    try {
      const { data: users, error } = await admin.listUsers({
        query: {}
      })
      if (error) {
        console.error('listUsers error:', error)
        alert(createErrorMessage(error.message || 'Permission denied'))
      } else {
        console.log('✅ listUsers success:', users)
        const userCount = Array.isArray(users) ? users.length : (users?.users?.length || 0)
        alert(`✅ Call to admin.listUsers succeeded returning ${userCount} users. This confirms user ${userEmail} has admin privileges.`)
      }
    } catch (error) {
      console.error('listUsers exception:', error)
      alert(createErrorMessage(error.message || 'Permission denied', true))
    }
  }

  return (
    <>
      <details ref={detailsRef}>
        <summary>Developer Tools</summary>
        <div style={detailsItemsStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
              <button type="button" onClick={handleSendTestMessage}>
                Send Test Email
              </button>
              <Spacer orientation={'horizontal'} />
              <button type="button" onClick={handleUpdateCount}>
                Add 1 to {count}
              </button>
              <Spacer orientation={'horizontal'} />
              <button type="button" onClick={testListUsers}>
                Test Admin Privilege
              </button>
              <Spacer orientation={'horizontal'} />
              <button type="button" onClick={handleSaveSampleGame}>
                Save Sample Game
              </button>
              <Spacer orientation={'horizontal'} />
              <input
                type="text"
                placeholder="Game ID to delete"
                value={deleteTargetId}
                onChange={(e) => setDeleteTargetId(e.target.value)}
                style={{ minWidth: '280px' }}
              />
              <button type="button" onClick={handleDeleteGame}>
                Delete Game
              </button>
              <Spacer orientation={'horizontal'} />
              {session?.user && (
                <Link to="/auth/users">
                  <button type="button">
                    View Users
                  </button>
                </Link>
              )}
            </div>
          </div>

          </div>
      </details>

      {/* <TanStackRouterDevtools initialIsOpen={false} position="bottom-right" router={router} /> */}
    </>
  )
}