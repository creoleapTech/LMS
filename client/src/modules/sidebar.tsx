import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { Menu, X, LayoutDashboard, BookOpen, Building, BarChart, Settings, ChevronLeft, ChevronRight, LogOut, BookDashedIcon, BookIcon, BookOpenText, Users } from 'lucide-react';
import { useAuthStore } from '@/store/userAuthStore';
import { toast } from 'sonner';

// Define types for navigation items
interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  roles: ('admin' | 'super_admin' | 'staff' | 'teacher')[];
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['admin', 'super_admin', 'staff', 'teacher'] },
  { name: 'Curriculum', path: '/curriculum', icon: <BookOpenText className="w-5 h-5" />, roles: ['admin', 'super_admin', 'staff', 'teacher'] },
  // { name: 'Courses', path: '/courses', icon: <BookIcon className="w-5 h-5" />, roles: ['admin', 'super_admin', 'staff', 'teacher'] },
  { name: 'Institutions', path: '/institutions', icon: <Building className="w-5 h-5" />, roles: ['super_admin'] },
  { name: 'My Classes', path: '/my-classes', icon: <Users className="w-5 h-5" />, roles: ['staff', 'teacher'] },
  { name: 'Reports', path: '/reports', icon: <BarChart className="w-5 h-5" />, roles: ['admin', 'super_admin', 'staff', 'teacher'] },
  { name: 'Settings', path: '/settings', icon: <Settings className="w-5 h-5" />, roles: ['admin', 'super_admin', 'staff', 'teacher'] },
];

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false); // Mobile toggle
  const [isExpanded, setIsExpanded] = useState<boolean>(true); // Desktop expand/minimize
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => setIsOpen(!isOpen); // Mobile toggle
  const toggleExpand = () => setIsExpanded(!isExpanded); // Desktop expand/minimize

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate({ to: '/' });
  };

  if (!user) return null;

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-[#080028] text-white rounded-md shadow-lg"
        aria-label="Toggle sidebar"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 md:static md:inset-0 w-64 ${!isExpanded ? 'md:w-16' : ''
          } bg-brand-color text-white flex flex-col transition-all duration-300 ease-in-out z-40`}
      >
        {/* Header with logo and expand/minimize button */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          {isExpanded && <h1 className="text-2xl font-bold">LMS Portal</h1>}
          <button
            onClick={toggleExpand}
            className="p-2 absolute top-4 -right-3 rounded-full bg-[#1A0C52] hover:bg-blue-900 md:block hidden shadow-md"
            aria-label={isExpanded ? 'Minimize sidebar' : 'Expand sidebar'}
          >
            {isExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {filteredNavItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center ${isExpanded ? 'space-x-2' : ''
                    } p-2 rounded-md hover:bg-blue-900 ${location.pathname === item.path ? 'bg-blue-900' : ''
                    }`}
                  activeProps={{ className: 'bg-blue-900' }}
                >
                  {item.icon}
                  {isExpanded && <span>{item.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer with logout button */}
        <div className="p-4 border-t border-gray-700">
          {isExpanded ? (
            <>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 p-2 w-full rounded-md hover:bg-red-700 bg-red-600"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
              <p className="text-sm mt-2">© 2025 LMS Portal</p>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="flex items-center justify-center p-2 w-full rounded-md hover:bg-red-700 bg-red-600"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#1A0C52] bg-opacity-50 md:hidden z-30"
          onClick={toggleSidebar}
        ></div>
      )}
    </>
  );
};

export default Sidebar;