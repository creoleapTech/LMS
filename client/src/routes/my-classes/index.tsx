import { createFileRoute } from '@tanstack/react-router'
import MyClassesPage from '@/pages/my-classes/MyClassesPage'

export const Route = createFileRoute('/my-classes/')({
  component: () => <MyClassesPage />,
})
