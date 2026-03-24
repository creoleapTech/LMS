import SettingsPage from '@/pages/settings/SettingsPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/')({
  component: RouteComponent,
})

function RouteComponent() {
  return<>
  <SettingsPage />
  </>
}
