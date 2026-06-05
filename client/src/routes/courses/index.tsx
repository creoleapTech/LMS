import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/courses/')({
  component: lazyRouteComponent(() => import('@/pages/course/CourseTable'), 'CourseTable'),
})
