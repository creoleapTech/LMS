import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const CourseManagementPage = lazy(() =>
  import('@/pages/course/CourseManagementPage').then((m) => ({ default: m.CourseManagementPage }))
)

export const Route = createFileRoute('/courses/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading course...</div>}>
      <CourseManagementPage courseId={id} />
    </Suspense>
  )
}
