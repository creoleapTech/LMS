import { InstitutionDetailPage } from '@/pages/institutions/InstitutionDetailPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/institutions/$id')({
  component: RouteComponent,
})


function RouteComponent() {
  const { id } = Route.useParams();
  return<>
  <InstitutionDetailPage id={id} />
  </>
}
