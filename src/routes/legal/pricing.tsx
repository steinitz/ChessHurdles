import { createFileRoute } from '@tanstack/react-router'
import { Pricing } from '../../../stzUser/components/Legal/Pricing'

export const Route = createFileRoute('/legal/pricing')({
  component: Pricing,
})
