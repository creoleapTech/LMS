import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const CourseTable = lazyWithRetry(() =>
  import('@/pages/course/CourseTable').then((m) => ({ default: m.CourseTable })),
  'CourseTable'
)

export const Route = createFileRoute('/courses/')({
  component: CoursesPage,
})

function CoursesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader /></div>}>
      <CourseTable />
    </Suspense>
  )
}

function Loader() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="text-sm">Loading courses...</span>
    </div>
  )
}
