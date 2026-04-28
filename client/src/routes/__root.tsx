import Sidebar from '@/modules/sidebar';
import { GlobalHeader } from '@/components/GlobalHeader';
import { Outlet, createRootRouteWithContext, redirect, useLocation } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';

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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <img
        src="/creo_white.png"
        alt="Creoleap"
        className="h-14 w-auto object-contain mb-8"
        style={{ filter: 'brightness(0) saturate(100%) invert(13%) sepia(50%) saturate(800%) hue-rotate(220deg) brightness(90%)' }}
      />
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0ms]" />
        <span className="h-2.5 w-2.5 rounded-full bg-violet-500 animate-bounce [animation-delay:150ms]" />
        <span className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    const token = getStoredToken();
    if (!token && location.pathname !== '/') {
      throw redirect({ to: '/' });
    }
  },
  component: RootComponent,
});

function RootComponent() {
  const { pathname } = useLocation();
  const showSidebar = pathname !== '/';
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef<string>(pathname);

  // Show loader only on login (/ → /dashboard) or logout (/dashboard → /)
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const prev = prevPathRef.current;
    const isLoginTransition = prev === '/' && pathname.startsWith('/dashboard');
    const isLogoutTransition = prev !== '/' && pathname === '/';

    if (isLoginTransition || isLogoutTransition) {
      setShowLoader(true);
      // Keep loader visible briefly so it's actually seen
      const id = setTimeout(() => setShowLoader(false), 800);
      return () => clearTimeout(id);
    }

    prevPathRef.current = pathname;
  }, [pathname]);

  // Update prevPath after loader logic runs
  useEffect(() => {
    prevPathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  if (showLoader) {
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
}
