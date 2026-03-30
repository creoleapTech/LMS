import { createFileRoute } from '@tanstack/react-router';
import { LogOut, Users, BookOpen, BarChart, Building, TrendingUp, ArrowUpRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/store/userAuthStore';

// Dummy data
const dummyData = {
  courses: [
    { id: '1', title: 'Introduction to Programming', students: 120, progress: 75 },
    { id: '2', title: 'Advanced Mathematics', students: 85, progress: 60 },
    { id: '3', title: 'Data Science Basics', students: 200, progress: 90 },
  ],
  users: [
    { id: '1', name: 'John Doe', role: 'student', status: 'active' },
    { id: '2', name: 'Jane Smith', role: 'staff', status: 'active' },
    { id: '3', name: 'Alice Johnson', role: 'admin', status: 'inactive' },
  ],
  analytics: {
    totalStudents: 5000,
    activeCourses: 150,
    completionRate: 85,
    institutions: 10,
  },
};

function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate({ to: '/' });
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Please log in to view the dashboard.</div>;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100/80">
      <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Welcome back,</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {user.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{user.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex md:hidden items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-600 rounded-xl hover:bg-red-500/20 transition-colors text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </header>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <StatCard
            title="Total Students"
            value={dummyData.analytics.totalStudents.toLocaleString()}
            change="+12%"
            icon={Users}
            gradient="from-blue-500 to-indigo-600"
            bgAccent="bg-blue-50"
            textAccent="text-blue-600"
          />
          <StatCard
            title="Active Courses"
            value={dummyData.analytics.activeCourses.toString()}
            change="+8%"
            icon={BookOpen}
            gradient="from-emerald-500 to-teal-600"
            bgAccent="bg-emerald-50"
            textAccent="text-emerald-600"
          />
          {user.role === 'super_admin' ? (
            <StatCard
              title="Institutions"
              value={dummyData.analytics.institutions.toString()}
              change="+2"
              icon={Building}
              gradient="from-purple-500 to-violet-600"
              bgAccent="bg-purple-50"
              textAccent="text-purple-600"
            />
          ) : (
            <StatCard
              title="Completion Rate"
              value={`${dummyData.analytics.completionRate}%`}
              change="+5%"
              icon={BarChart}
              gradient="from-amber-500 to-orange-600"
              bgAccent="bg-amber-50"
              textAccent="text-amber-600"
            />
          )}
        </div>

        {/* Courses Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Courses</h2>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">{dummyData.courses.length} total</span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Students</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</th>
                    {(user.role === 'admin' || user.role === 'super_admin') && (
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dummyData.courses.map((course) => (
                    <tr key={course.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-medium text-sm">{course.title}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{course.students}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                            <div
                              className="h-full bg-linear-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground w-10">{course.progress}%</span>
                        </div>
                      </td>
                      {(user.role === 'admin' || user.role === 'super_admin') && (
                        <td className="px-6 py-4">
                          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">Edit</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Users Section (SuperAdmin and Admin only) */}
        {(user.role === 'admin' || user.role === 'super_admin') && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Users</h2>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">{dummyData.users.length} total</span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dummyData.users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-medium text-sm">{u.name}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-medium capitalize">{u.role}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            {u.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">Manage</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Analytics Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-5">
              <div className="p-3.5 bg-linear-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                <BarChart className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Course Completion Rate</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-bold tracking-tight">{dummyData.analytics.completionRate}%</span>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                    <TrendingUp className="h-3 w-3" /> +5%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, icon: Icon, gradient, bgAccent, textAccent }: {
  title: string; value: string; change: string; icon: any; gradient: string; bgAccent: string; textAccent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${textAccent} ${bgAccent} px-2.5 py-1 rounded-lg`}>
            <TrendingUp className="h-3 w-3" /> {change}
          </span>
        </div>
        <div className={`p-3.5 bg-linear-to-br ${gradient} rounded-2xl text-white shadow-lg shadow-${gradient.split('-')[1]}-500/20 group-hover:scale-105 transition-transform`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/dashboard/')({
  component: Dashboard,
});