import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/examinations/')({
  component: lazyRouteComponent(() => import('@/pages/examinations/ExaminationsPage'), 'default'),
})
