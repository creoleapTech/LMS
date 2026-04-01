import CurriculumManagementPage from '@/pages/curriculum/CurriculamManagement'
import StaffCurriculumViewer from '@/pages/staff/StaffCurriculumViewer'
import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@/store/userAuthStore'

interface CurriculumSearch {
  gradeBookId?: string;
  classId?: string;
  bookTitle?: string;
}

export const Route = createFileRoute('/curriculum/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CurriculumSearch => ({
    gradeBookId: search.gradeBookId as string | undefined,
    classId: search.classId as string | undefined,
    bookTitle: search.bookTitle as string | undefined,
  }),
})

function RouteComponent() {
  const { user } = useAuthStore();
  const { gradeBookId, classId, bookTitle } = Route.useSearch();
  const isSuperAdmin = user?.role === 'super_admin';

  return isSuperAdmin
    ? <CurriculumManagementPage />
    : <StaffCurriculumViewer resumeGradeBookId={gradeBookId} resumeClassId={classId} resumeBookTitle={bookTitle} />;
}
