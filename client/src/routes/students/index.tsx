import { StudentManagementPage } from '@/pages/students/StudentManagementPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/students/')({
  component: () => <StudentManagementPage />,
})
