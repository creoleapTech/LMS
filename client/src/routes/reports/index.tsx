import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const ReportsPage = lazyWithRetry(() => import('@/pages/reports/ReportsPage'), 'ReportsPage')

interface ReportsSearch {
  draftId?: string
}

export const Route = createFileRoute('/reports/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): ReportsSearch => ({
    draftId: search.draftId as string | undefined,
  }),
})

function RouteComponent() {
  const { draftId } = Route.useSearch()
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading reports...</div>}>
      <ReportsPage draftId={draftId} />
    </Suspense>
  )
}
