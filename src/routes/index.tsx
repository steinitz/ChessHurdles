import { createFileRoute } from '@tanstack/react-router'
import { getCount } from '~/lib/count'
import { Spacer } from '~stzUtils/components/Spacer'
import ChessGame from '../components/ChessGame'

export const Route = createFileRoute('/')({  
  component: Home,
  loader: async () => {
    const count = await getCount()
    return { count }
  },
})

function Home() {
  const { count } = Route.useLoaderData()

  return (
    <main>
      <section>
        <h1>Chess Hurdles</h1>
        <ChessGame />
      </section>
    </main>
  )
}