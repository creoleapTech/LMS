import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const ExaminationDetailPage = lazy(() => import('@/pages/examinations/ExaminationDetailPage'))

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
