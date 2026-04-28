import Sidebar from '@/modules/sidebar';
import { GlobalHeader } from '@/components/GlobalHeader';
import { Outlet, createRootRouteWithContext, redirect, useLocation, useRouterState } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/userAuthStore';
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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0D0630]">
      <img
        src="/creo_white.png"
        alt="Creoleap"
        className="h-14 w-auto object-contain mb-8"
      />
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
        <span className="h-2.5 w-2.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
        <span className="h-2.5 w-2.5 rounded-full bg-purple-400 animate-bounce [animation-delay:300ms]" />
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

  // ── 1. Boot hydration loader ──────────────────────────────────────────────
  // Zustand persist rehydrates synchronously from localStorage, but we still
  // want a brief loader on cold boot so the UI doesn't flash unstyled content.
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    // Give Zustand one tick to finish rehydration, then clear the loader
    const id = requestAnimationFrame(() => setBooting(false));
    return () => cancelAnimationFrame(id);
  }, []);

  // ── 2. Route-transition loader ────────────────────────────────────────────
  // Shows during login→dashboard and logout→login navigations
  const isNavigating = useRouterState({ select: (s) => s.status === 'pending' });

  // ── 3. Scroll to top on navigation ───────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  if (booting || isNavigating) {
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
