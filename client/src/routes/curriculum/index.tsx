import CurriculumManagementPage from '@/pages/curriculum/CurriculamManagement'
import StaffCurriculumViewer from '@/pages/staff/StaffCurriculumViewer'
import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@/store/userAuthStore'

export const Route = createFileRoute('/curriculum/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  // Show management page for super_admin, simplified viewer for staff/teachers
  return isSuperAdmin ? <CurriculumManagementPage /> : <StaffCurriculumViewer />;
}
