import { createFileRoute } from '@tanstack/react-router'
import LessonPlanDetailPage from '@/pages/lesson-plans/LessonPlanDetailPage'

export const Route = createFileRoute('/lesson-plans/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return <LessonPlanDetailPage id={id} />
}
