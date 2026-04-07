import Sidebar from '@/modules/sidebar';
import { GlobalHeader } from '@/components/GlobalHeader';
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

        <div className="flex h-screen  overflow-hidden bg-background">
          <div className='z-50'>
            {showSidebar && <Sidebar />}
          </div>


          <div className="z-10 flex-1 overflow-y-auto relative">
            {showSidebar && <GlobalHeader />}
            <div className="min-h-full page-enter" key={pathname}>
              <Outlet />
            </div>
          </div>
        </div>
      </>
    );
  },
});