import React, { useState, useEffect } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { Menu, X, LayoutDashboard, Building, BarChart, Settings, ChevronLeft, ChevronRight, BookOpenText, Users, LogOut, GraduationCap } from 'lucide-react';
import { useAuthStore } from '@/store/userAuthStore';

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
  { name: 'My Classes', path: '/my-classes', icon: <Users className="w-5 h-5" />, roles: ['admin', 'super_admin', 'staff', 'teacher'] },
  { name: 'Students', path: '/students', icon: <GraduationCap className="w-5 h-5" />, roles: ['admin', 'super_admin'] },
  { name: 'Reports', path: '/reports', icon: <BarChart className="w-5 h-5" />, roles: ['admin', 'super_admin', 'staff', 'teacher'] },
  { name: 'Settings', path: '/settings', icon: <Settings className="w-5 h-5" />, roles: ['admin', 'super_admin', 'staff', 'teacher'] },
];

import { useSidebarStore } from '@/store/sidebarStore';

const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false); // Mobile toggle
  const { isExpanded, toggleExpand } = useSidebarStore();
  const location = useLocation();
  const { user } = useAuthStore();

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => setIsOpen(!isOpen); // Mobile toggle

  if (!user) return null;

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="md:hidden z-50 fixed top-3 left-3 z-50 p-2.5 bg-[#0D0630] text-white rounded-xl shadow-lg shadow-purple-900/20 backdrop-blur-sm border border-white/10 active:scale-95 transition-transform"
        aria-label="Toggle sidebar"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed z-50 inset-y-0 left-0 transform ${isOpen ? 'translate-x-0 transition-all duration-300' : '-translate-x-full  transition-all duration-300'
          } md:translate-x-0 md:relative h-screen ${isExpanded ? 'w-64' : 'w-20'
          } bg-brand-color text-white flex flex-col transition-all duration-300 ease-in-out shrink-0`}
      >
        {/* Header with logo and expand/minimize button */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-center min-h-[72px] relative">
          {isExpanded ? (
            <div className="flex flex-col items-center gap-1 transition-all duration-300">
              <img src="/creo_white.png" alt="CreaLeap" className="h-11 w-auto object-contain" />
              <span className="text-sm font-bold tracking-widest text-white/70 uppercase">LMS</span>
            </div>
          ) : (
            <img src="/creo_white.png" alt="CreaLeap" className="h-9 w-auto object-contain" />
          )}

          <button
            onClick={toggleExpand}
            className="p-1.5 absolute top-1/2 -right-3.5 -translate-y-1/2 rounded-full bg-[#1A0C52] hover:bg-[#241266] border border-white/10 md:flex hidden shadow-lg shadow-black/50 z-50 transition-colors"
            aria-label={isExpanded ? 'Minimize sidebar' : 'Expand sidebar'}
          >
            {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3  transition-all duration-300  py-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              const displayName = item.path === '/my-classes' && (user?.role === 'admin' || user?.role === 'super_admin')
                ? 'Class Management' : item.name;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center ${isExpanded ? 'px-3' : 'justify-center'} py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group relative
                      ${isActive
                        ? 'bg-white/15 text-white shadow-inner shadow-white/5'
                        : 'text-white/70 hover:text-white hover:bg-white/8'
                      }`}
                    activeProps={{ className: 'bg-white/15 text-white' }}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-linear-to-b from-indigo-400 to-purple-400 rounded-r-full" />
                    )}
                    <span className={`!transition-all duration-200 shrink-0 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                      {item.icon}
                    </span>
                    <span className={`ml-3 !transition-all !duration-300 whitespace-nowrap overflow-hidden ${isExpanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0 ml-0'}`}>
                      {displayName}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/10 space-y-2">
          <button
            onClick={() => {
              useAuthStore.getState().logout();
              window.location.href = '/';
            }}
            className={`flex items-center ${isExpanded ? 'px-3' : 'justify-center'} py-2.5 rounded-xl text-sm font-medium transition-all duration-300 w-full text-white/70 hover:text-white hover:bg-white/8 group`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={`ml-3 transition-all duration-300 whitespace-nowrap overflow-hidden ${isExpanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0 ml-0'}`}>
              Logout
            </span>
          </button>
          <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'opacity-30 max-h-5' : 'opacity-0 max-h-0'}`}>
            <p className="text-[11px] text-center tracking-wide">© 2026 LMS</p>
          </div>
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