import { createFileRoute } from '@tanstack/react-router'
import { Privacy } from '../../../stzUser/components/Legal/Privacy'

export const Route = createFileRoute('/legal/privacy')({
  component: Privacy,
})
