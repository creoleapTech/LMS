import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const InstructorDashboard = lazyWithRetry(() => import('@/pages/instructor/InstructorDashboard'), 'InstructorDashboard')

export const Route = createFileRoute('/instructor/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>}>
      <InstructorDashboard />
    </Suspense>
  )
}
