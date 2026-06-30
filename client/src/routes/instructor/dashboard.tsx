import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const InstructorDashboard = lazy(() => import('@/pages/instructor/InstructorDashboard'))

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
