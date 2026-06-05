import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/students/')({
  component: lazyRouteComponent(() => import('@/pages/students/StudentManagementPage'), 'StudentManagementPage'),
})
