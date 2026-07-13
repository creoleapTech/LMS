import { createFileRoute } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';

const SchoolProgressPage = lazy(() => import('@/pages/reports/SchoolProgressPage'));

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
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-medium">Loading school progress...</div>}>
      <SchoolProgressPage initialSchoolId={schoolId} />
    </Suspense>
  );
}
