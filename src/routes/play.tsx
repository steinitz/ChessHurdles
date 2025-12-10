import { createFileRoute } from '@tanstack/react-router'
import { PlayVsEngine } from '~/components/PlayVsEngine/PlayVsEngine'

export const Route = createFileRoute('/play')({
  component: PlayVsEngineRoute,
})

function PlayVsEngineRoute() {
  return <PlayVsEngine />
}
