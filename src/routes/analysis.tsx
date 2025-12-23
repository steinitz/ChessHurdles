import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import ChessGame from '../components/ChessGame/ChessGame'
import GameLoad from '../components/ChessGame/GameLoad'
import { getGameById } from '~/lib/chess-server'

export const Route = createFileRoute('/analysis')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      gameId: search.gameId as string | undefined,
    }
  },
  loaderDeps: ({ search }) => ({ gameId: search.gameId }),
  loader: async ({ deps }) => {
    if (deps.gameId) {
      try {
        const game = await getGameById({ data: deps.gameId })
        return { initialPGN: game?.pgn, gameId: deps.gameId }
      } catch (e) {
        console.error('Failed to load game:', e)
        return { initialPGN: undefined, gameId: deps.gameId }
      }
    }
    return { initialPGN: undefined, gameId: undefined }
  },
  component: AnalysisPage,
})

function AnalysisPage() {
  const { initialPGN, gameId } = Route.useLoaderData()
  // Lift state for PGN so manual loading works
  const [currentPGN, setCurrentPGN] = useState(initialPGN)

  // Sync state if loader data changes (e.g. navigation)
  useEffect(() => {
    setCurrentPGN(initialPGN)
  }, [initialPGN])

  const handleManualLoad = (pgn: string) => {
    setCurrentPGN(pgn)
  }

  const handleClear = () => {
    setCurrentPGN(undefined)
  }

  // If we have a gameId, we are in "Saved Game Mode" -> Hide Loader
  // If no gameId, we are in "Manual/Playground Mode" -> Show Loader
  const showLoader = !gameId

  return (
    <div className="p-2">
      <h1 className="mb-4">Game Analysis</h1>

      {showLoader && (
        <div className="mb-6 max-w-4xl mx-auto">
          <GameLoad onPgnLoad={handleManualLoad} onClear={handleClear} />
        </div>
      )}

      <ChessGame initialPGN={currentPGN} />
    </div>
  )
}
