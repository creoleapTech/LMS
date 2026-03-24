import Sidebar from '@/modules/sidebar';
import { Outlet, createRootRoute, useLocation } from '@tanstack/react-router';
import { Toaster } from 'sonner';

export const Route = createRootRoute({
  component: () => {
    const { pathname } = useLocation();
    const showSidebar = pathname !== '/';

    return (
     <>
      <Toaster 
        position="top-right"
        richColors
        expand={false}
        closeButton
      />
      <div className="flex min-h-screen">
        {showSidebar && <Sidebar />}
        <div className={`flex-1 ${showSidebar ? '' : ''}`}>
          <Outlet />
        </div>
      </div>
     </>
    );
  },
});