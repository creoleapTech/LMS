import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const TeachingDiaryPage = lazyWithRetry(() =>
  import('@/pages/staff/TeachingDiaryPage').then((m) => ({ default: m.default })),
  'TeachingDiaryPage'
)

export const Route = createFileRoute('/teaching-diary')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading teaching diary...</div>}>
      <TeachingDiaryPage />
    </Suspense>
  )
}
