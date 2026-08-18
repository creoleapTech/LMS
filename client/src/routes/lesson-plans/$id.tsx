import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const LessonPlanDetailPage = lazyWithRetry(() => import('@/pages/lesson-plans/LessonPlanDetailPage'), 'LessonPlanDetailPage')

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
