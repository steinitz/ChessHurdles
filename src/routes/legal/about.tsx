import { createFileRoute } from '@tanstack/react-router'
import { About } from '../../../stzUser/components/Legal/About'

export const Route = createFileRoute('/legal/about')({
  component: About,
})
