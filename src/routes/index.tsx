import { createFileRoute } from '@tanstack/react-router'
import { Spacer } from '~stzUtils/components/Spacer'
import ChessGame from '../components/ChessGame'
import { getGameById } from '~/lib/chess-server'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const search = Route.useSearch() as { gameId?: string }
  const [initialPGN, setInitialPGN] = useState<string | undefined>(undefined)

  useEffect(() => {
    const loadGame = async () => {
      const gameId = search?.gameId
      if (typeof gameId === 'string' && gameId.length) {
        try {
          const game = await getGameById({ data: gameId })
          if (game?.pgn) {
            setInitialPGN(game.pgn)
          } else {
            setInitialPGN(undefined)
          }
        } catch (e) {
          console.error('Failed to load game by id:', e)
          setInitialPGN(undefined)
        }
      } else {
        setInitialPGN(undefined)
      }
    }

    loadGame()
  }, [search?.gameId])

  return (
    <main>
      <section>
        <h1>Chess Hurdles</h1>
        <ChessGame initialPGN={initialPGN} />
      </section>
    </main>
  )
}