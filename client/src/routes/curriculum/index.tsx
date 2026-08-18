import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { useAuthStore } from '@/store/userAuthStore'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const CurriculumManagementPage = lazyWithRetry(() => import('@/pages/curriculum/CurriculamManagement'), 'CurriculumManagementPage')
const StaffCurriculumViewer = lazyWithRetry(() => import('@/pages/staff/StaffCurriculumViewer'), 'StaffCurriculumViewer')

interface CurriculumSearch {
  gradeBookId?: string
  classId?: string
  bookTitle?: string
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
  const { user } = useAuthStore()
  const { gradeBookId, classId, bookTitle } = Route.useSearch()
  const isSuperAdmin = user?.role === 'super_admin'

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading curriculum...</div>}>
      {isSuperAdmin ? (
        <CurriculumManagementPage />
      ) : (
        <StaffCurriculumViewer resumeGradeBookId={gradeBookId} resumeClassId={classId} resumeBookTitle={bookTitle} />
      )}
    </Suspense>
  )
}
