import { CourseTable } from '@/pages/course/CourseTable'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/courses/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <>
  <CourseTable institutionName={''} />
  </>
}
