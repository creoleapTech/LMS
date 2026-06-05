import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

const StaffTable = lazy(() =>
  import('@/pages/staff/StaffTable').then((m) => ({ default: m.StaffTable }))
)

export const Route = createFileRoute('/staff/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading staff...</div>}>
      <StaffTable institutionId={''} institutionName={''} />
    </Suspense>
  )
}
