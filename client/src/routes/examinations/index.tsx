import { createFileRoute } from '@tanstack/react-router'
import ExaminationsPage from '@/pages/examinations/ExaminationsPage'

export const Route = createFileRoute('/examinations/')({
  component: ExaminationsPage,
})
