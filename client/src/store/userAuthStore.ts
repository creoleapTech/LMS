// store/userAuthStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  _id: string;
  email: string;
  name: string;
  salutation?: 'Mr' | 'Mrs' | 'Ms' | 'Dr';
  mobileNumber: string;
  role: 'admin' | 'super_admin' | 'staff' | 'teacher';
  institutionId?: string | { _id: string; name: string; logo?: string };
  profileImage?: string;
  isActive: boolean;
  lastLogin: Date;
  token: string;
}

interface AuthStore {
  user: User | null;
  hydrated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

// Use persist middleware + auto-rehydrate from localStorage
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      hydrated: false,
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null });
      },
      isAuthenticated: () => !!get().user?.token,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);