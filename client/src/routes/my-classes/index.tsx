import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/my-classes/')({
  component: lazyRouteComponent(() => import('@/pages/my-classes/MyClassesPage'), 'default'),
})
