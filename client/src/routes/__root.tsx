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

        <div className="flex h-screen overflow-hidden bg-background">

          {showSidebar && (
            <div className="w-64 fixed left-0 top-0 h-full">
              <Sidebar />
            </div>
          )}

          <div
            className={`flex-1 overflow-y-auto ${showSidebar ? 'ml-64' : ''
              }`}
          >
            <div className="min-h-full page-enter" key={pathname}>
              <Outlet />
            </div>
          </div>

        </div>
      </>
    );
  },
});