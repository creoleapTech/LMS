import { InstitutionTable } from '@/pages/institutions/InstitutionTable'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/institutions/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <>
  <InstitutionTable />
  </>
}
