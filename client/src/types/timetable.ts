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
  additionalClassId?: string | { _id: string; grade?: string; section?: string; year?: string };
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
  additionalClassId?: string;
  gradeBookId?: string;
  periodNumber: number;
  dayOfWeek: number;
  isRecurring: boolean;
  specificDate?: string;
  notes?: string;
}

export interface ChapterTopicItem {
  chapterId: string;
  chapterTitle: string;
  contentId?: string;
  contentTitle?: string;
}

export interface CompleteTimetableEntryDTO {
  topicsCovered?: string[];
  chapterTopics?: ChapterTopicItem[];
  notes?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
}

export interface IClassSession {
  _id: string;
  staffId: string;
  institutionId: string;
  classId: string | { _id: string; grade?: string; section?: string };
  courseId?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  remarks?: string;
  topicsCovered?: string[];
  status: "ongoing" | "completed";
  createdAt: string;
  updatedAt: string;
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
