import Sidebar from '@/modules/sidebar';
import { GlobalHeader } from '@/components/GlobalHeader';
import { Outlet, createRootRoute, redirect, useLocation } from '@tanstack/react-router';
import { Toaster } from 'sonner';

function getStoredToken(): string | null {
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    return JSON.parse(stored)?.state?.user?.token ?? null;
  } catch {
    return null;
  }
}

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const token = getStoredToken();
    if (!token && location.pathname !== '/') {
      throw redirect({ to: '/' });
    }
  },
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