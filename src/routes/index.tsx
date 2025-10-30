import { createFileRoute } from '@tanstack/react-router'
import { Spacer } from '~stzUtils/components/Spacer'
import ChessGame from '../components/ChessGame/ChessGame'
import { getGameById } from '~/lib/chess-server'

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

  return (
    <main>
      <section>
        <h1>Chess Hurdles</h1>
        <ChessGame initialPGN={initialPGN} />
      </section>
    </main>
  )
}