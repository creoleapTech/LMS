import Sidebar from '@/modules/sidebar';
import { GlobalHeader } from '@/components/GlobalHeader';
import { Outlet, createRootRoute, redirect, useLocation } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/userAuthStore';

function getStoredToken(): string | null {
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return null;
    return JSON.parse(stored)?.state?.user?.token ?? null;
  } catch {
    return null;
  }
}

function AppLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#dfe6f0]">
      <img src="/creo_white.png" alt="Creoleap" className="h-14 w-auto object-contain mb-8 opacity-0 animate-[fadeIn_0.4s_ease_forwards]" style={{ filter: 'invert(0.35) sepia(1) saturate(3) hue-rotate(210deg)' }} />
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0ms]" />
        <span className="h-2.5 w-2.5 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
        <span className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
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
    const hydrated = useAuthStore((s) => s.hydrated);
    const showSidebar = pathname !== '/';
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }, [pathname]);

    // Block render until Zustand has rehydrated from localStorage
    if (!hydrated) {
      return <AppLoader />;
    }

    return (
      <>
        <Toaster
          position="top-right"
          richColors
          expand={false}
          closeButton
        />

        <div className="flex h-screen overflow-hidden bg-background">
          <div className="z-50">
            {showSidebar && <Sidebar />}
          </div>

          <div ref={scrollRef} className="z-10 flex-1 overflow-y-auto relative">
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
