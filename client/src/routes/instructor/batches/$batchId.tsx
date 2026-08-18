import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const InstructorBatchDetail = lazyWithRetry(() => import('@/pages/instructor/InstructorBatchDetail'), 'InstructorBatchDetail')

export const Route = createFileRoute('/instructor/batches/$batchId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { batchId } = Route.useParams()
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading batch...</div>}>
      <InstructorBatchDetail batchId={batchId} />
    </Suspense>
  )
}
