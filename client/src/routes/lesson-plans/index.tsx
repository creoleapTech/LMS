import { createFileRoute, redirect } from '@tanstack/react-router'
import LessonPlansPage from '@/pages/lesson-plans/LessonPlansPage'

function getStoredAuth(): { token: string | null; role: string | null } {
  try {
    const stored = localStorage.getItem('auth-storage')
    if (!stored) return { token: null, role: null }
    const state = JSON.parse(stored)?.state?.user
    return { token: state?.token ?? null, role: state?.role ?? null }
  } catch {
    return { token: null, role: null }
  }
}

export const Route = createFileRoute('/lesson-plans/')({
  beforeLoad: () => {
    const { token, role } = getStoredAuth()
    if (!token) throw redirect({ to: '/' })
    if (role === 'staff') throw redirect({ to: '/dashboard' })
  },
  component: LessonPlansPage,
})
