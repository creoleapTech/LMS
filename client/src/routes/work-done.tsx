import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/work-done')({
  component: lazyRouteComponent(() => import('@/pages/work-done/WorkDonePage'), 'default'),
})
