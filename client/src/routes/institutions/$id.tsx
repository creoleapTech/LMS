import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const InstitutionDetailPage = lazy(() =>
  import('@/pages/institutions/InstitutionDetailPage').then((m) => ({ default: m.InstitutionDetailPage }))
)

export const Route = createFileRoute('/institutions/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading institution...</div>}>
      <InstitutionDetailPage id={id} />
    </Suspense>
  )
}
