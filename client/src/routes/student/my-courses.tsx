import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const StudentMyCourses = lazyWithRetry(() => import('@/pages/student/StudentMyCourses'), 'StudentMyCourses')

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
