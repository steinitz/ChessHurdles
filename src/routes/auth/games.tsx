import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '~stzUser/lib/auth-client'
import { Spacer } from '~stzUtils/components/Spacer'
import { getGames } from '~/lib/chess-server'
import { Link } from '@tanstack/react-router'

function GamesPage() {
  const { data: session } = useSession()
  const { games } = Route.useLoaderData() as { games: Array<{
    id: string
    title: string | null
    description: string | null
    pgn: string
    game_type: string
    difficulty_rating: number | null
    tags: string | null
    is_favorite: boolean
    created_at: string
    updated_at: string
  }> }

  if (!session?.user) {
    return (
      <section>
        <h1>My Games</h1>
        <p>Please sign in to view your games.</p>
      </section>
    )
  }

  return (
    <section>
      <h1>My Games</h1>
      <Spacer space={1.5} />
      {games.length === 0 ? (
        <p>No games saved yet.</p>
      ) : (
        <ul>
          {games.map((g) => (
            <li key={g.id}>
              <strong>
                <Link to="/" search={{ gameId: g.id }}>
                  {g.title || 'Untitled Game'}
                </Link>
              </strong>
              <div>ID: {g.id}</div>
              {g.description ? <div>{g.description}</div> : null}
              <small>Saved: {new Date(g.created_at).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export const Route = createFileRoute('/auth/games')({
  component: GamesPage,
  loader: async () => {
    const games = await getGames()
    return { games }
  },
})