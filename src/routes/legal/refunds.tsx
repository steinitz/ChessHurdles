import { createFileRoute } from '@tanstack/react-router'
import { Refunds } from '../../../stzUser/components/Legal/Refunds'

export const Route = createFileRoute('/legal/refunds')({
  component: Refunds,
})
