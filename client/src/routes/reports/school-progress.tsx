import { createFileRoute } from '@tanstack/react-router';
import { Suspense } from 'react';
import { useAuthStore } from '@/store/userAuthStore';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const SchoolProgressPage = lazyWithRetry(() => import('@/pages/reports/SchoolProgressPage'), 'SchoolProgressPage');

interface SchoolProgressSearch {
  schoolId?: string;
}

export const Route = createFileRoute('/reports/school-progress')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): SchoolProgressSearch => ({
    schoolId: search.schoolId as string | undefined,
  }),
});

function RouteComponent() {
  const { schoolId } = Route.useSearch();
  const { user } = useAuthStore();
  const isSchoolLocked = user?.role !== 'super_admin';
  const userInstitutionId = typeof user?.institutionId === 'object'
    ? (user?.institutionId as any)?._id || (user?.institutionId as any)?.id
    : user?.institutionId;
  const effectiveSchoolId = isSchoolLocked ? (userInstitutionId || schoolId) : schoolId;

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-medium">Loading school progress...</div>}>
      <SchoolProgressPage initialSchoolId={effectiveSchoolId} lockedToSchool={isSchoolLocked} />
    </Suspense>
  );
}
