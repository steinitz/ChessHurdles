import { createFileRoute } from '@tanstack/react-router'
import { Terms } from '../../../stzUser/components/Legal/Terms'

export const Route = createFileRoute('/legal/terms')({
  component: Terms,
})
