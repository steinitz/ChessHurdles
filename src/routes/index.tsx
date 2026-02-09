import { HurdleTable } from '~/lib/chess-database' // Keep for type safety if needed, or remove if unused. Checking usage.. unused. Removing.
// Actually, let's just clean it all up.

import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import ChessGame from '../components/ChessGame/ChessGame'
import { getGameById } from '~/lib/chess-server'
import { GameList } from '~/components/GameList'
import { useSession } from '~stzUser/lib/auth-client'
import { CHESSBOARD_WIDTH } from '~/constants'

export const Route = createFileRoute('/')({
  loaderDeps: ({ search }) => {
    const gameId = (search as any)?.gameId
    return { gameId: typeof gameId === 'string' ? gameId : undefined }
  },
  loader: async ({ deps }) => {
    let initialPGN: string | undefined = undefined
    let gameDetails: any = null
    const gameId = deps?.gameId
    if (typeof gameId === 'string' && gameId.length) {
      try {
        const game = await getGameById({ data: gameId })
        initialPGN = game?.pgn || undefined
        gameDetails = game
      } catch (e) {
        console.error('Failed to load game by id:', e)
        initialPGN = undefined
      }
    }
    return { initialPGN, gameDetails }
  },
  component: Home,
})

function Home() {
  const { initialPGN, gameDetails } = Route.useLoaderData() as { initialPGN?: string; gameDetails?: any }
  const { data: session } = useSession()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleHurdleSaved = () => {
    // No-op for now as list is gone, or maybe show toast?
  }

  return (
    <div className="p-2">

      <ChessGame
        initialPGN={initialPGN}
        title={gameDetails?.title}
        date={gameDetails?.created_at}
        description={gameDetails?.description}
        onHurdleSaved={handleHurdleSaved}
      />

      <div style={{ width: CHESSBOARD_WIDTH, margin: '0 auto', marginTop: '2rem' }}>
        <GameList />
      </div>
    </div>
  )
}