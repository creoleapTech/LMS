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
        className="md:hidden fixed top-3 left-3 z-50 p-2.5 bg-[#0D0630] text-white rounded-xl shadow-lg shadow-purple-900/20 backdrop-blur-sm border border-white/10 active:scale-95 transition-transform"
        aria-label="Toggle sidebar"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 md:static md:inset-0 w-64 ${!isExpanded ? 'md:w-[72px]' : ''
          } bg-brand-color text-white flex flex-col transition-all duration-300 ease-in-out z-40`}
      >
        {/* Header with logo and expand/minimize button */}
        <div className="px-5 py-2 border-b border-white/10 flex items-center justify-between">
          {isExpanded && (
            <div className="flex items-center gap-3">
              <img src="/creo_white.png" alt="Creo" className="h-8 w-auto object-contain" />
              <div className="h-5 w-px bg-white/20 shrink-0" />
              <span className="text-lg font-semibold tracking-wide shrink-0">LMS</span>
            </div>
          )}
          <button
            onClick={toggleExpand}
            className="p-1.5 absolute top-5 -right-3.5 rounded-full bg-[#1A0C52] hover:bg-[#241266] border border-white/10 md:flex hidden shadow-lg shadow-purple-900/30 transition-colors"
            aria-label={isExpanded ? 'Minimize sidebar' : 'Expand sidebar'}
          >
            {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center ${isExpanded ? 'gap-3 px-3' : 'justify-center px-2'
                      } py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                      ${isActive
                        ? 'bg-white/15 text-white shadow-inner shadow-white/5'
                        : 'text-white/70 hover:text-white hover:bg-white/8'
                      }`}
                    activeProps={{ className: 'bg-white/15 text-white' }}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-linear-to-b from-indigo-400 to-purple-400 rounded-r-full" />
                    )}
                    <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                      {item.icon}
                    </span>
                    {isExpanded && <span>{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer with logout button */}
        <div className="px-3 py-4 border-t border-white/10">
          {isExpanded ? (
            <div className="space-y-3">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-red-200 hover:bg-red-500/20 hover:text-red-100 transition-colors"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
              <p className="text-[11px] text-white/30 text-center tracking-wide">© 2026 LMS</p>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="flex items-center justify-center p-2.5 w-full rounded-xl text-red-200 hover:bg-red-500/20 hover:text-red-100 transition-colors"
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm md:hidden z-30 transition-opacity"
          onClick={toggleSidebar}
        ></div>
      )}
    </>
  );
};

export default Sidebar;