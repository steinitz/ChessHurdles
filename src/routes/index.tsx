import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
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

function Home() {
  const { initialPGN } = Route.useLoaderData() as { initialPGN?: string }
  const { data: session } = useSession()
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <main>
      <section>
        <h1>Chess Hurdles</h1>
        <ChessGame initialPGN={initialPGN} />

        {isMounted && session?.user && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <GameList />
            <HurdleReview />
          </div>
        )}
      </section>
    </main>
  )
}