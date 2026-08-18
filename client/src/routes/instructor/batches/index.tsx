import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const InstructorBatches = lazyWithRetry(() => import('@/pages/instructor/InstructorBatches'), 'InstructorBatches')

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
