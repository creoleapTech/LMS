import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const CourseManagementPage = lazy(() =>
  import('@/pages/course/CourseManagementPage').then((m) => ({ default: m.CourseManagementPage }))
)

export const Route = createFileRoute('/courses/$id')({
  component: CourseDetailsPage,
})

function CourseDetailsPage() {
  const { id } = Route.useParams()
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader /></div>}>
      <CourseManagementPage courseId={id} />
    </Suspense>
  )
}

function Loader() {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="text-sm">Loading course...</span>
    </div>
  )
}
