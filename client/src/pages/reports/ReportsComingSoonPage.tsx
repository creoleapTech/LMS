import { BarChart3, Clock3 } from 'lucide-react';

export default function ReportsComingSoonPage() {
  return (
    <div className="min-h-screen">
      <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1.5 tracking-tight">
            Reports
          </h1>
          <p className="text-muted-foreground">Insights and analytics for your LMS.</p>
        </div>

        <section className="neo-card rounded-2xl border border-slate-200/80 p-8 sm:p-10 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            We are building a full reporting suite with attendance, performance, and curriculum progress analytics.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 bg-white">
            <Clock3 className="h-4 w-4" />
            Reports module in progress
          </div>
        </section>
      </div>
    </div>
  );
}
