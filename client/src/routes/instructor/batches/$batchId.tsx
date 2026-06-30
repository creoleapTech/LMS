import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const InstructorBatchDetail = lazy(() => import('@/pages/instructor/InstructorBatchDetail'))

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
