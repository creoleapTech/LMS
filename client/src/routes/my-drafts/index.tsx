import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/my-drafts/')({
  component: lazyRouteComponent(() => import('@/pages/my-drafts/MyDraftsPage'), 'default'),
})
