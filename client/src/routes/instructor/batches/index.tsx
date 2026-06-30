import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const InstructorBatches = lazy(() => import('@/pages/instructor/InstructorBatches'))

export const Route = createFileRoute('/instructor/batches/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading batches...</div>}>
      <InstructorBatches />
    </Suspense>
  )
}
