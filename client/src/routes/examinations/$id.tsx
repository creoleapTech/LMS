import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const ExaminationDetailPage = lazyWithRetry(() => import('@/pages/examinations/ExaminationDetailPage'), 'ExaminationDetailPage')

export const Route = createFileRoute('/examinations/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading examination...</div>}>
      <ExaminationDetailPage id={id} />
    </Suspense>
  )
}
