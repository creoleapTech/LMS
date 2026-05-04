import { createFileRoute } from '@tanstack/react-router'
import ExaminationDetailPage from '@/pages/examinations/ExaminationDetailPage'

export const Route = createFileRoute('/examinations/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <ExaminationDetailPage id={id} />
}
