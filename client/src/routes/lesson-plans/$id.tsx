import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const LessonPlanDetailPage = lazy(() => import('@/pages/lesson-plans/LessonPlanDetailPage'))

export const Route = createFileRoute('/lesson-plans/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading lesson plan...</div>}>
      <LessonPlanDetailPage id={id} />
    </Suspense>
  )
}
