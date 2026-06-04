import { create } from "zustand";

interface CurriculumNavState {
  curriculumName: string | null;
  gradeNumber: number | null;
  bookTitle: string | null;
  chapterNumber: number | null;
  chapterTitle: string | null;
  setCurriculumContext: (
    ctx: Partial<
      Omit<
        CurriculumNavState,
        | "setCurriculumContext"
        | "clearCurriculumContext"
        | "clearChapterContext"
        | "clearGradeContext"
      >
    >
  ) => void;
  clearCurriculumContext: () => void;
  clearChapterContext: () => void;
  clearGradeContext: () => void;
}

export const useCurriculumNavStore = create<CurriculumNavState>((set) => ({
  curriculumName: null,
  gradeNumber: null,
  bookTitle: null,
  chapterNumber: null,
  chapterTitle: null,
  setCurriculumContext: (ctx) => set((state) => ({ ...state, ...ctx })),
  clearCurriculumContext: () =>
    set({ curriculumName: null, gradeNumber: null, bookTitle: null, chapterNumber: null, chapterTitle: null }),
  clearChapterContext: () => set({ chapterNumber: null, chapterTitle: null }),
  clearGradeContext: () =>
    set({ gradeNumber: null, bookTitle: null, chapterNumber: null, chapterTitle: null }),
}));
