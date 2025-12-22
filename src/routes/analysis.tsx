import { createFileRoute } from '@tanstack/react-router'
import ChessGame from '../components/ChessGame/ChessGame'
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
        return { initialPGN: game?.pgn }
      } catch (e) {
        console.error('Failed to load game:', e)
        return { initialPGN: undefined }
      }
    }
    return { initialPGN: undefined }
  },
  component: AnalysisPage,
})

function AnalysisPage() {
  const { initialPGN } = Route.useLoaderData()

  return (
    <div className="p-2">
      <h1 className="mb-4">Game Analysis</h1>
      <ChessGame initialPGN={initialPGN} />
    </div>
  )
}
