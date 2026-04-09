import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

// ── Animated count-up hook ──

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = ref.current;
    const diff = target - start;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setValue(current);
      if (progress < 1) requestAnimationFrame(tick);
      else ref.current = target;
    }
    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

// ── Stat Card Props ──

interface StatCardProps {
  title: string;
  value: number;
  suffix?: string;
  prefix?: string;
  subtitle?: string;
  icon: LucideIcon;
  accent: 'indigo' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan' | 'sky';
  delay?: number;
}

const accentConfig = {
  indigo: {
    iconGradient: 'from-indigo-500 to-indigo-600',
    gradient: 'from-indigo-500/10 to-transparent',
    glow: 'neo-glow-indigo',
    shadow: 'shadow-indigo-500/20',
  },
  emerald: {
    iconGradient: 'from-emerald-500 to-emerald-600',
    gradient: 'from-emerald-500/10 to-transparent',
    glow: 'neo-glow-emerald',
    shadow: 'shadow-emerald-500/20',
  },
  violet: {
    iconGradient: 'from-violet-500 to-violet-600',
    gradient: 'from-violet-500/10 to-transparent',
    glow: 'neo-glow-violet',
    shadow: 'shadow-violet-500/20',
  },
  amber: {
    iconGradient: 'from-amber-500 to-amber-600',
    gradient: 'from-amber-500/10 to-transparent',
    glow: 'neo-glow-amber',
    shadow: 'shadow-amber-500/20',
  },
  rose: {
    iconGradient: 'from-rose-500 to-rose-600',
    gradient: 'from-rose-500/10 to-transparent',
    glow: 'neo-glow-rose',
    shadow: 'shadow-rose-500/20',
  },
  cyan: {
    iconGradient: 'from-cyan-500 to-cyan-600',
    gradient: 'from-cyan-500/10 to-transparent',
    glow: 'neo-glow-cyan',
    shadow: 'shadow-cyan-500/20',
  },
  sky: {
    iconGradient: 'from-sky-500 to-sky-600',
    gradient: 'from-sky-500/10 to-transparent',
    glow: 'neo-glow-sky',
    shadow: 'shadow-sky-500/20',
  },
};

export function StatCard({ title, value, suffix, prefix, subtitle, icon: Icon, accent, delay = 0 }: StatCardProps) {
  const cfg = accentConfig[accent];
  const displayValue = useCountUp(value);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={`neo-card neo-card-hover ${cfg.glow} p-6 group relative overflow-hidden ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Colorful gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-40 group-hover:opacity-70 transition-opacity duration-500`} />

      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-1">
            {prefix && <span className="text-sm font-medium text-slate-600">{prefix}</span>}
            <h4 className="text-3xl font-bold text-slate-800 tracking-tight tabular-nums">
              {displayValue.toLocaleString()}
            </h4>
            {suffix && <span className="text-sm font-medium text-slate-600">{suffix}</span>}
          </div>
          {subtitle && (
            <p className="text-sm text-slate-600 font-medium">{subtitle}</p>
          )}
        </div>

        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${cfg.iconGradient} text-white shadow-lg ${cfg.shadow} shrink-0`}>
          <Icon size={20} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

// ── Section Header ──

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  accent?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ icon: Icon, title, subtitle, accent = 'text-indigo-600 bg-indigo-50', action }: SectionHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shadow-md ${accent}`}>
            <Icon size={18} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">{title}</h3>
            {subtitle && <p className="text-sm font-medium text-slate-600 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="mt-3 h-[2px] bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
    </>
  );
}

// ── Card Shell ──

export function DashCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`neo-card neo-card-hover p-6 ${className}`}>
      {children}
    </div>
  );
}

// ── Progress Bar ──

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2.5 neo-inset-sm overflow-hidden ${className}`}>
      <div
        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ── Custom Tooltip for Charts ──

export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="neo-glass px-4 py-3 text-sm">
      <p className="font-semibold text-slate-900 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-slate-600">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="font-medium">{p.name}:</span>
          <span className="font-bold text-slate-900">{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ── Activity Type Icon Map ──

export function ActivityDot({ type }: { type: 'student' | 'staff' }) {
  return (
    <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${type === 'student' ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
  );
}

// ── Empty State ──

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-slate-600 font-medium neo-card-flat mx-2 my-2">
      {message}
    </div>
  );
}

// ── Dashboard Loading Skeleton ──

export function DashboardSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-screen-2xl mx-auto space-y-6 animate-pulse neo-bg">
      {/* Header skeleton */}
      <div className="neo-card p-6 space-y-2">
        <div className="h-8 w-64 neo-inset-sm rounded-lg" />
        <div className="h-4 w-40 neo-inset-sm rounded-lg" />
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="neo-card p-6 space-y-3">
            <div className="h-3 w-20 neo-inset-sm rounded" />
            <div className="h-8 w-24 neo-inset-sm rounded" />
          </div>
        ))}
      </div>
      {/* Chart skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 neo-card p-6 h-80" />
        <div className="neo-card p-6 h-80" />
      </div>
    </div>
  );
}
