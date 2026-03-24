// store/userAuthStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  _id: string;
  email: string;
  name: string;
  mobileNumber: string;
  role: 'admin' | 'super_admin' | 'staff' | 'teacher';
  institutionId?: string;
  profileImage?: string;
  isActive: boolean;
  lastLogin: Date;
  token: string;
}

interface AuthStore {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

// Use persist middleware + auto-rehydrate from localStorage
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null });
      },
      isAuthenticated: () => !!get().user?.token,
    }),
    {
      name: 'auth-storage', // key in localStorage
      partialize: (state) => ({ user: state.user }), // only persist user
    }
  )
);