import { StaffTable } from '@/pages/staff/StaffTable'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/staff/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <>
  <StaffTable institutionId={''} institutionName={''} />
  </>
}
