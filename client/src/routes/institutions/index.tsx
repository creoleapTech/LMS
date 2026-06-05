import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/institutions/')({
  component: lazyRouteComponent(() => import('@/pages/institutions/InstitutionTable'), 'InstitutionTable'),
})
