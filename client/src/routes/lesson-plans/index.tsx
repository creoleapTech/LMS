import { createFileRoute } from '@tanstack/react-router'
import LessonPlansPage from '@/pages/lesson-plans/LessonPlansPage'

export const Route = createFileRoute('/lesson-plans/')({
  component: LessonPlansPage,
})
