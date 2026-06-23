import { BarChart, Construction } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate and view monthly lesson reports</p>
      </div>

      <div className="neo-card rounded-2xl border border-slate-200/80 p-12 sm:p-16 text-center mt-8">
        <div className="mx-auto mb-6 h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 text-amber-600 flex items-center justify-center shadow-sm">
          <Construction className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-3">Coming Soon</h2>
        <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
          The Reports module is currently under development. We're working on bringing you comprehensive
          analytics and reporting features. Stay tuned!
        </p>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <BarChart className="h-4 w-4" />
          <span>Advanced reporting features in progress</span>
        </div>
      </div>
    </div>
  );
}
