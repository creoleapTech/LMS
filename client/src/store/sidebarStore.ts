import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  isExpanded: boolean;
  toggleExpand: () => void;
  setExpanded: (expanded: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isExpanded: true,
      toggleExpand: () => set((state) => ({ isExpanded: !state.isExpanded })),
      setExpanded: (expanded) => set({ isExpanded: expanded }),
    }),
    {
      name: 'sidebar-storage',
    }
  )
);
