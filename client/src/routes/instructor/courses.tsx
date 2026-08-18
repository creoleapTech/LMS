import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const InstructorCourses = lazyWithRetry(() => import('@/pages/instructor/InstructorCourses'), 'InstructorCourses')

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
