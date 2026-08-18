import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const StaffTable = lazyWithRetry(() =>
  import('@/pages/staff/StaffTable').then((m) => ({ default: m.StaffTable })),
  'StaffTable'
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
