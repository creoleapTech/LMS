import { createFileRoute } from '@tanstack/react-router';
import { LogOut, Users, BookOpen, BarChart, Building } from 'lucide-react';
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
    return <div className="min-h-screen flex items-center justify-center">Please log in to view the dashboard.</div>;
  }

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-gray-100">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 wrap-break-word min-w-0">
          Welcome, {user.name} ({user.role})
        </h1>
        <button
          onClick={handleLogout}
          className="flex md:hidden items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-150"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </header>

      {/* Dashboard Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Overview Cards */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center space-x-4">
            <div className="bg-indigo-100 p-3 rounded-full">
              <Users className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Total Students</h3>
              <p className="text-2xl font-bold">{dummyData.analytics.totalStudents}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 p-3 rounded-full">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Active Courses</h3>
              <p className="text-2xl font-bold">{dummyData.analytics.activeCourses}</p>
            </div>
          </div>
        </div>
        {user.role === 'super_admin' && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center space-x-4">
              <div className="bg-purple-100 p-3 rounded-full">
                <Building className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Institutions</h3>
                <p className="text-2xl font-bold">{dummyData.analytics.institutions}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Courses Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Courses</h2>
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Title</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Students</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Progress</th>
                {(user.role === 'admin' || user.role === 'super_admin') && (
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dummyData.courses.map((course) => (
                <tr key={course.id}>
                  <td className="px-6 py-4">{course.title}</td>
                  <td className="px-6 py-4">{course.students}</td>
                  <td className="px-6 py-4">{course.progress}%</td>
                  {(user.role === 'admin' || user.role === 'super_admin') && (
                    <td className="px-6 py-4">
                      <button className="text-indigo-600 hover:text-indigo-800">Edit</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Users Section (SuperAdmin and Admin only) */}
      {(user.role === 'admin' || user.role === 'super_admin') && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Users</h2>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dummyData.users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4">{user.name}</td>
                    <td className="px-6 py-4">{user.role}</td>
                    <td className="px-6 py-4">{user.status}</td>
                    <td className="px-6 py-4">
                      <button className="text-indigo-600 hover:text-indigo-800">Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Analytics</h2>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <BarChart className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Course Completion Rate</h3>
              <p className="text-2xl font-bold">{dummyData.analytics.completionRate}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/dashboard/')({
  component: Dashboard,
});