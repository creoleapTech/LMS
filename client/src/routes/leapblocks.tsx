import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/leapblocks')({
  component: lazyRouteComponent(() => import('@/pages/leapblocks/LeapBlocksPage'), 'default'),
})
