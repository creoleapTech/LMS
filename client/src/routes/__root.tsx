import Sidebar from '@/modules/sidebar';
import { GlobalHeader } from '@/components/GlobalHeader';
import { Outlet, createRootRouteWithContext, redirect, useLocation } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/userAuthStore';
import type { QueryClient } from '@tanstack/react-query';

function getStoredToken(): string | null {
  try {
    const stored = localStorage.getItem('auth-storage');
    const token = stored ? JSON.parse(stored)?.state?.user?.token : null;
    if (token) return token;
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

function AppLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <img
        src="/creoleap_white_short.svg"
        alt="Creoleap"
        className="h-14 w-14 object-contain mb-8"
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
  errorComponent: ({ error }) => {
    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Failed to load module script') ||
      error?.message?.includes('Expected a JavaScript-or-Wasm module script');

    if (isChunkError) {
      const key = 'root_chunk_error_reload';
      const last = sessionStorage.getItem(key);
      const now = Date.now();
      if (!last || now - parseInt(last, 10) > 10000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
        return (
          <div className="flex h-screen items-center justify-center bg-background text-slate-500 font-medium">
            Updating application to latest version...
          </div>
        );
      }
    }

    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center space-y-4 bg-background">
        <h2 className="text-xl font-bold text-slate-800">Something went wrong</h2>
        <p className="text-slate-500 text-sm max-w-md">
          {error?.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => {
            sessionStorage.clear();
            window.location.reload();
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition"
        >
          Reload Page
        </button>
      </div>
    );
  },
  component: RootComponent,
});

function RootComponent() {
  const { pathname } = useLocation();
  const showSidebar = pathname !== '/';
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef<string>(pathname);
  const hydrated = useAuthStore((s) => s.hydrated);

  // Show loader while Zustand rehydrates to prevent flash of login screen
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

  if (!hydrated || showLoader) {
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
