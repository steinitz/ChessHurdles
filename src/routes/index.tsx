import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Spacer } from '~stzUtils/components/Spacer'
import ChessGame from '../components/ChessGame/ChessGame'
import { getGameById } from '~/lib/chess-server'
import { GameList } from '~/components/GameList'
import { HurdleReview } from '~/components/HurdleReview'
import { useSession } from '~stzUser/lib/auth-client'

export const Route = createFileRoute('/')({
  loaderDeps: ({ search }) => {
    const gameId = (search as any)?.gameId
    return { gameId: typeof gameId === 'string' ? gameId : undefined }
  },
  loader: async ({ deps }) => {
    let initialPGN: string | undefined = undefined
    const gameId = deps?.gameId
    if (typeof gameId === 'string' && gameId.length) {
      try {
        const game = await getGameById({ data: gameId })
        initialPGN = game?.pgn || undefined
      } catch (e) {
        console.error('Failed to load game by id:', e)
        initialPGN = undefined
      }
    }
    return { initialPGN }
  },
  component: Home,
})

import { HurdleTrainer } from '~/components/HurdleTrainer'
import { HurdleTable } from '~/lib/chess-database'
function Home() {
  const { initialPGN } = Route.useLoaderData() as { initialPGN?: string }
  const { data: session } = useSession()
  const [isMounted, setIsMounted] = useState(false)
  const [view, setView] = useState<'review' | 'train'>('review')
  const [hurdlesRefreshKey, setHurdlesRefreshKey] = useState(0)
  const [selectedHurdle, setSelectedHurdle] = useState<HurdleTable | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleHurdleSaved = () => {
    setHurdlesRefreshKey(prev => prev + 1)
  }

  return (
    <div className="p-2">

      <ChessGame initialPGN={initialPGN} onHurdleSaved={handleHurdleSaved} />

      {isMounted && session?.user && (
        <div className="mt-8 max-w-4xl mx-auto">
          <div className="flex gap-4 mb-4 border-b">
            <button
              className={`px-4 py-2 ${view === 'review' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
              onClick={() => setView('review')}
            >
              Review Hurdles
            </button>
            <button
              className={`px-4 py-2 ${view === 'train' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
              onClick={() => setView('train')}
            >
              Training Mode
            </button>
          </div>

          {view === 'review' ? (
            <HurdleReview
              key={hurdlesRefreshKey}
              onSelectHurdle={(hurdle) => {
                setSelectedHurdle(hurdle)
                setView('train')
              }}
            />
          ) : (
            <HurdleTrainer
              hurdle={selectedHurdle || undefined}
              onBack={() => {
                setSelectedHurdle(null)
                setView('review')
              }}
            />
          )}
        </div>
      )}

      <GameList />
    </div>
  )
}