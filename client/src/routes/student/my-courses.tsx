import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const StudentMyCourses = lazy(() => import('@/pages/student/StudentMyCourses'))

export const Route = createFileRoute('/student/my-courses')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading courses...</div>}>
      <StudentMyCourses />
    </Suspense>
  )
}
