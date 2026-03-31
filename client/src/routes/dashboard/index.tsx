import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Users,
  Bot,
  Zap,
  Target,
  Activity,
  BookOpen,
  Layers,
  Radio,
  CheckCircle2,
  LogOut,
  TrendingUp,
  Clock,
  Calendar,
  Wrench
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart as RechartsBarChart,
  Bar,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/userAuthStore';

// ─── Extended Mock Data ─────────────────────────────────────────────────────

const INSTITUTION = {
  name: 'Nexus Robotics Academy',
  location: 'Main Campus',
  tier: 'Diamond',
};

const COLORS = {
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#e11d48',
  cyan: '#06b6d4',
  violet: '#8b5cf6',
  slate: '#64748b',
};

const dummyData = {
  analytics: {
    totalStudents: 1250,
    activeCourses: 24,
    completionRate: 82,
    institutions: 1,
    activeBots: 85,
    simulationHours: '4.2k',
    avgScore: 76.5,
    certIssued: 840,
  },

  // Targeted Curriculum: Robotics (1-12) and Electronics (6-12)
  curriculum: [
    {
      grade: 'Grade 1',
      section: '1A',
      course: 'Robotics Basics',
      students: 32,
      progress: 85,
      type: 'Robotics',
      topics: [
        { name: 'Introduction to Motors', done: true, coverage: 100 },
        { name: 'Basic Sensors', done: true, coverage: 90 },
        { name: 'Drag & Drop Logic', done: false, coverage: 40 },
      ]
    },
    {
      grade: 'Grade 6',
      section: '6B',
      course: 'Embedded Systems 101',
      students: 28,
      progress: 65,
      type: 'Electronics',
      topics: [
        { name: 'Circuits & Voltages', done: true, coverage: 100 },
        { name: 'Soldering Basics', done: true, coverage: 85 },
        { name: 'Microcontroller Logic', done: false, coverage: 30 },
      ]
    },
    {
      grade: 'Grade 10',
      section: '10C',
      course: 'Advanced ROS2 & AI',
      students: 24,
      progress: 45,
      type: 'Robotics',
      topics: [
        { name: 'SLAM Theory', done: true, coverage: 100 },
        { name: 'Computer Vision', done: false, coverage: 50 },
        { name: 'Path Planning', done: false, coverage: 10 },
      ]
    },
    {
      grade: 'Grade 12',
      section: '12A',
      course: 'IoT & Edge Computing',
      students: 20,
      progress: 92,
      type: 'Electronics',
      topics: [
        { name: 'Cloud Integration', done: true, coverage: 100 },
        { name: 'Edge AI Deployment', done: true, coverage: 95 },
        { name: 'Final Semester Project', done: false, coverage: 60 },
      ]
    }
  ],

  users: [
    { id: '1', name: 'John Doe', role: 'student', status: 'active', avatar: 'JD' },
    { id: '2', name: 'Jane Smith', role: 'staff', status: 'active', avatar: 'JS' },
    { id: '3', name: 'Alice Johnson', role: 'admin', status: 'inactive', avatar: 'AJ' },
    { id: '4', name: 'Bob Kumar', role: 'teacher', status: 'active', avatar: 'BK' },
  ],

  monthlyActivity: [
    { name: 'Jan', completions: 12, simulations: 140, hwDeployments: 45, students: 380 },
    { name: 'Feb', completions: 18, simulations: 210, hwDeployments: 62, students: 420 },
    { name: 'Mar', completions: 25, simulations: 580, hwDeployments: 88, students: 510 },
    { name: 'Apr', completions: 20, simulations: 420, hwDeployments: 75, students: 490 },
    { name: 'May', completions: 32, simulations: 680, hwDeployments: 110, students: 620 },
    { name: 'Jun', completions: 45, simulations: 890, hwDeployments: 140, students: 730 },
    { name: 'Jul', completions: 38, simulations: 730, hwDeployments: 125, students: 850 },
  ],

  botDiagnostics: [
    { name: 'Online Fleet', value: 85, color: COLORS.emerald },
    { name: 'Maintenance', value: 10, color: COLORS.amber },
    { name: 'Offline', value: 5, color: COLORS.rose },
  ],

  recentActivity: [
    { id: 1, user: 'Student 6A', action: 'completed circuit', target: 'Ohm’s Law Lab', time: '5m ago', type: 'success', avatar: '6A' },
    { id: 2, user: 'Teacher Bob', action: 'started session', target: 'Grade 1 Robotics', time: '12m ago', type: 'info', avatar: 'BK' },
    { id: 3, user: 'Student 10C', action: 'deployed code', target: 'Rover #42', time: '20m ago', type: 'info', avatar: 'TC' },
    { id: 4, user: 'Bot #08', action: 'low battery', target: 'Lab Front', time: '45m ago', type: 'warning', avatar: '⚙' },
  ],

  scoreDistribution: [
    { range: '0–20', count: 5 },
    { range: '21–40', count: 12 },
    { range: '41–60', count: 45 },
    { range: '61–80', count: 120 },
    { range: '81–100', count: 98 },
  ],

  skillRadar: [
    { skill: 'Logic', A: 82, fullMark: 100 },
    { skill: 'Circuits', A: 75, fullMark: 100 },
    { skill: 'Coding', A: 88, fullMark: 100 },
    { skill: 'Hardware', A: 70, fullMark: 100 },
    { skill: 'AI/ML', A: 45, fullMark: 100 },
    { skill: 'Design', A: 91, fullMark: 100 },
  ],

  weeklyEngagement: [
    { day: 'Mon', sessions: 120 },
    { day: 'Tue', sessions: 145 },
    { day: 'Wed', sessions: 190 },
    { day: 'Thu', sessions: 165 },
    { day: 'Fri', sessions: 210 },
    { day: 'Sat', sessions: 45 },
    { day: 'Sun', sessions: 20 },
  ],
};

// ─── Component ───────────────────────────────────────────────────────────────

function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate({ to: '/' });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
        Please log in to view the dashboard.
      </div>
    );
  }

  const isPrivileged = ['admin', 'super_admin', 'staff', 'teacher'].includes(user.role);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 leading-normal tracking-tight relative overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-3xl rounded-full -mr-48 -mt-48 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full -ml-48 -mb-48" />
      </div>

      {/* ── Institution Header ── */}
      <header className="relative z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 shadow-sm/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-linear-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Bot size={22} className="shrink-0" />
          </div>
          <div>
            <h2 className="text-base capitalize font-black tracking-tight text-slate-900 leading-none mb-1">{user.institutionId?.name}</h2>
            {/* <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{INSTITUTION.location} &nbsp;·&nbsp; {INSTITUTION.tier} Portal</p> */}
          </div>
        </div>

        <div className="flex items-center gap-4">

          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors">
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 p-8 max-w-screen-2xl mx-auto space-y-8">

        {/* ── User Context ── */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            {/* <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em]">Dashboard Overview</p> */}
            <h1 className="text-4xl capitalize font-medium text-slate-900 tracking-tighter leading-none mb-2">Hello, {user.name.split(' ')[0]}!</h1>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-md uppercase tracking-wider">
                {user.role.replace('_', ' ')}
              </span>
              <span className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} />
                {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </section>

        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Students" value={dummyData.analytics.totalStudents.toLocaleString()} change="+5.2%" positive icon="👥" accent="indigo" />
          <StatCard title="Active Labs" value={dummyData.analytics.activeCourses.toString()} change="+2 NEW" positive icon="🔧" accent="emerald" />
          <StatCard title="Robot Fleet" value={dummyData.analytics.activeBots.toString()} change="92% UP" positive icon="🤖" accent="violet" />
          <StatCard title="Completion" value={`${dummyData.analytics.completionRate}%`} change="+1.2%" positive icon="🎯" accent="amber" />
        </div>

        {/* ── Primary Charts Section ── */}
        {isPrivileged && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Platform Activity */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Platform Activity</h3>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Simulations vs Hardware Deployments</p>
                  </div>
                </div>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dummyData.monthlyActivity} margin={{ left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gSim" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontSize: '11px', fontWeight: 'bold' }} />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="simulations" name="Simulations" stroke="#6366f1" strokeWidth={3} fill="url(#gSim)" />
                    <Bar dataKey="hwDeployments" name="Hardware Deploys" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Mastery View */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-violet-50 rounded-lg text-violet-600">
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Cohort Mastery</h3>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Skill domain distribution</p>
                </div>
              </div>
              <div className="h-[320px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={dummyData.skillRadar}>
                    <PolarGrid stroke="#f1f5f9" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                    <Radar name="Skills" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ── Curriculum & Secondary Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Active Curriculum */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <BookOpen size={20} className="text-indigo-600" />
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Active Curriculum Tracking</h3>
              </div>
              <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">Grades 1 - 12</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dummyData.curriculum.map((item, idx) => (
                <CurriculumCard key={idx} item={item} />
              ))}
            </div>
          </div>

          {/* Side Panel: Fleet & Activity */}
          <div className="space-y-6">

            {/* Fleet Status */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
              <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                <Bot size={16} className="text-emerald-500" /> Robot Fleet Status
              </h3>
              <div className="h-48 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dummyData.botDiagnostics} innerRadius={55} outerRadius={75} paddingAngle={8} dataKey="value" stroke="none">
                      {dummyData.botDiagnostics.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">{dummyData.analytics.activeBots}</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Bots</span>
                </div>
              </div>
              <div className="space-y-4 mt-6">
                {dummyData.botDiagnostics.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] font-black tracking-widest uppercase">
                    <div className="flex items-center gap-2 text-slate-400">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </div>
                    <span className="text-slate-900">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Feed */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden">
              <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                <Radio size={16} className="text-rose-500" /> Real-time Activity
              </h3>
              <div className="space-y-5">
                {dummyData.recentActivity.map((activity, i) => (
                  <div key={i} className="flex gap-4 items-start group">
                    <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black tracking-tighter transition-transform group-hover:scale-110 ${activity.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {activity.avatar}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] leading-snug text-slate-900 font-bold group-hover:text-indigo-600 transition-colors">
                        {activity.user} <span className="text-slate-400 font-medium">{activity.action}</span> {activity.target}
                      </p>
                      <p className="text-[9px] text-slate-400 font-black mt-1 uppercase tracking-widest opacity-60">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components using Tailwind ───

function StatCard({ title, value, change, positive, icon: IconStr, accent }: { title: string, value: string, change: string, positive: boolean, icon: string, accent: string }) {
  const accentColors: Record<string, string> = {
    indigo: 'text-indigo-600 bg-indigo-50 ring-indigo-100',
    emerald: 'text-emerald-600 bg-emerald-50 ring-emerald-100',
    violet: 'text-violet-600 bg-violet-50 ring-violet-100',
    amber: 'text-amber-600 bg-amber-50 ring-amber-100',
  };

  const accentClass = accentColors[accent] || accentColors.indigo;

  return (
    <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative">
      <div className="absolute -right-6 -bottom-6 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500 text-slate-900">
        <span className="text-9xl tracking-tighter font-black select-none">{IconStr}</span>
      </div>
      <div className="relative z-10 flex flex-col justify-between h-full space-y-5">
        <div className="flex items-center justify-between">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl ring-4 ${accentClass}`}>
            {IconStr}
          </div>
          <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase ${positive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
            {change}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</p>
          <h4 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{value}</h4>
        </div>
      </div>
    </div>
  );
}

function CurriculumCard({ item }: { item: any }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-lg transition-all duration-300 group">
      <div className="flex justify-between items-start mb-5">
        <div className="min-w-0">
          <h4 className="text-base font-black text-slate-900 truncate leading-tight tracking-tight">{item.course}</h4>
          <p className="text-[10px] font-black text-slate-400 mt-1.5 uppercase tracking-widest">Class {item.section} &nbsp;·&nbsp; {item.students} Students</p>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] border ${item.type === 'Robotics' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
          {item.type}
        </span>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Overall Progress</span>
            <span className="text-indigo-600">{item.progress}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden p-[2px]">
            <div className="h-full bg-linear-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000 shadow-sm shadow-indigo-200" style={{ width: `${item.progress}%` }} />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-80 mb-2">Active Modules</p>
          <div className="space-y-2.5">
            {item.topics.map((t: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${t.done ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200 scale-110' : 'bg-slate-100 border border-slate-200'}`}>
                  {t.done ? <CheckCircle2 size={10} className="stroke-[3]" /> : <div className="w-1 h-1 bg-slate-300 rounded-full" />}
                </div>
                <span className={`text-xs font-bold leading-none ${t.done ? 'text-slate-400 line-through opacity-70' : 'text-slate-700'}`}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/dashboard/')({
  component: Dashboard,
});