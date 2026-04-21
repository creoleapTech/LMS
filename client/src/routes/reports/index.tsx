import { createFileRoute } from '@tanstack/react-router';
import ReportsComingSoonPage from '@/pages/reports/ReportsComingSoonPage';

export const Route = createFileRoute('/reports/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <ReportsComingSoonPage />;
}
