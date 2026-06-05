import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/lesson-plans/')({
  component: lazyRouteComponent(() => import('@/pages/lesson-plans/LessonPlansPage'), 'default'),
})
