import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/leaplab')({
  component: lazyRouteComponent(() => import('@/pages/leaplab/LeapLabPage'), 'default'),
})
