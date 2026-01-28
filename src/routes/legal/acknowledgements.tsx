import { createFileRoute } from '@tanstack/react-router'
import { Acknowledgements } from '../../../stzUser/components/Legal/Acknowledgements'

export const Route = createFileRoute('/legal/acknowledgements')({
  component: Acknowledgements,
})
