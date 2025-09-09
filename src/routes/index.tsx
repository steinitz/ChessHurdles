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
        <h1>Tanstack Start with Better Auth</h1>
        <Spacer />
        <h2>Index Page Content Area</h2>
        <Spacer />
        <h3>Default element styling provided by <a href="https://andybrewer.github.io/mvp/" target="_blank" rel="noopener noreferrer">MVP.css</a></h3>
        <ChessGame />
      </section>
    </main>
  )
}