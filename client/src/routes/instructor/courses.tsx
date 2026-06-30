import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const InstructorCourses = lazy(() => import('@/pages/instructor/InstructorCourses'))

export const Route = createFileRoute('/instructor/courses')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading courses...</div>}>
      <InstructorCourses />
    </Suspense>
  )
}
