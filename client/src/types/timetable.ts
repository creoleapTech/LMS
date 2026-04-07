export interface IPeriodSlot {
  periodNumber: number;
  label?: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

export interface IPeriodConfig {
  _id: string;
  institutionId: string;
  periods: IPeriodSlot[];
  workingDays: number[];
}

export interface ITimetableEntry {
  _id: string;
  institutionId: string;
  staffId: string;
  classId: string | { _id: string; grade?: string; section?: string; year?: string };
  gradeBookId?: string | { _id: string; bookTitle?: string; grade?: number };
  periodNumber: number;
  dayOfWeek: number;
  isRecurring: boolean;
  specificDate?: string;
  notes?: string;
  status: "scheduled" | "completed" | "cancelled";
  topicsCovered?: string[];
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IMonthSummary {
  [dateString: string]: {
    entryCount: number;
    hasCompleted: boolean;
  };
}

export interface CreateTimetableEntryDTO {
  classId: string;
  gradeBookId?: string;
  periodNumber: number;
  dayOfWeek: number;
  isRecurring: boolean;
  specificDate?: string;
  notes?: string;
}

export interface CompleteTimetableEntryDTO {
  topicsCovered?: string[];
  notes?: string;
}

export interface IClassOption {
  _id: string;
  grade: string;
  section: string;
  year?: string;
}

export interface IGradeBookOption {
  _id: string;
  bookTitle: string;
  grade: number;
  curriculumId: string;
}
