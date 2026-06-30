import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Course, Batch, Student, Progress, Assessment, Attendance, Instructor } from "./types";

interface AppData {
  courses: Course[];
  batches: Batch[];
  students: Student[];
  progress: Progress[];
  assessments: Assessment[];
  attendance: Attendance[];
  instructors: Instructor[];
  currentUserRole: string | null;
}

interface AppDataStore extends AppData {
  setCourses: (courses: Course[]) => void;
  setBatches: (batches: Batch[]) => void;
  setStudents: (students: Student[]) => void;
  setProgress: (progress: Progress[]) => void;
  setAssessments: (assessments: Assessment[]) => void;
  setAttendance: (attendance: Attendance[]) => void;
  setInstructors: (instructors: Instructor[]) => void;
  setCurrentUserRole: (role: string | null) => void;
  reset: () => void;
}

const seedInstructors: Instructor[] = [
  {
    id: "inst1",
    name: "Instructor User",
    email: "instructor@creoleap.com",
    password: "instructor123",
    assignedCourseIds: ["1", "2"],
    assignedBatchIds: ["b1", "b2"],
  },
];

const seedCourses: Course[] = [
  { id: "1", code: "MATH101", name: "Mathematics Grade 10", description: "CBSE Math for Class 10 covering algebra, geometry, and trigonometry", level: "Intermediate", duration: "1 Year", fees: 25000, status: "Active", startDate: "2025-04-01" },
  { id: "2", code: "SCI202", name: "Physics Advanced", description: "Advanced physics concepts including mechanics, thermodynamics, and electromagnetism", level: "Advanced", duration: "6 Months", fees: 35000, status: "Active", startDate: "2025-06-15" },
  { id: "3", code: "ENG101", name: "English Foundation", description: "Foundational English language skills", level: "Beginner", duration: "3 Months", fees: 15000, status: "Inactive", startDate: "2025-01-10" },
];

const seedBatches: Batch[] = [
  { id: "b1", courseId: "1", name: "Batch A - Morning", startDate: "2025-04-01", endDate: "2026-03-31", studentCount: 6, status: "Active", instructor: "Rajesh Kumar" },
  { id: "b2", courseId: "1", name: "Batch B - Afternoon", startDate: "2025-04-01", endDate: "2026-03-31", studentCount: 4, status: "Active", instructor: "Priya Singh" },
  { id: "b3", courseId: "2", name: "Batch C - Weekend", startDate: "2025-06-01", endDate: "2026-05-31", studentCount: 0, status: "Upcoming" },
];

const seedStudents: Student[] = [
  { id: "s1", name: "Aarav Sharma", email: "aarav@example.com", batchId: "b1", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s2", name: "Ananya Patel", email: "ananya@example.com", batchId: "b1", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s3", name: "Rohan Verma", email: "rohan@example.com", batchId: "b1", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s4", name: "Priya Gupta", email: "priya@example.com", batchId: "b1", enrolledDate: "2025-04-05", status: "Active" },
  { id: "s5", name: "Arjun Nair", email: "arjun@example.com", batchId: "b1", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s6", name: "Diya Reddy", email: "diya@example.com", batchId: "b1", enrolledDate: "2025-04-10", status: "Active" },
  { id: "s7", name: "Karan Joshi", email: "karan@example.com", batchId: "b2", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s8", name: "Neha Kapoor", email: "neha@example.com", batchId: "b2", enrolledDate: "2025-04-02", status: "Active" },
  { id: "s9", name: "Vikram Singh", email: "vikram@example.com", batchId: "b2", enrolledDate: "2025-04-01", status: "Active" },
  { id: "s10", name: "Isha Mehta", email: "isha@example.com", batchId: "b2", enrolledDate: "2025-04-03", status: "Inactive" },
];

const seedProgress: Progress[] = [
  { studentId: "s1", studentName: "Aarav Sharma", overallPercentage: 82, chaptersCompleted: 9, totalChapters: 12, lastActive: "2025-06-28" },
  { studentId: "s2", studentName: "Ananya Patel", overallPercentage: 75, chaptersCompleted: 9, totalChapters: 12, lastActive: "2025-06-27" },
  { studentId: "s3", studentName: "Rohan Verma", overallPercentage: 91, chaptersCompleted: 11, totalChapters: 12, lastActive: "2025-06-29" },
  { studentId: "s4", studentName: "Priya Gupta", overallPercentage: 68, chaptersCompleted: 8, totalChapters: 12, lastActive: "2025-06-25" },
  { studentId: "s5", studentName: "Arjun Nair", overallPercentage: 45, chaptersCompleted: 5, totalChapters: 12, lastActive: "2025-06-20" },
  { studentId: "s6", studentName: "Diya Reddy", overallPercentage: 88, chaptersCompleted: 10, totalChapters: 12, lastActive: "2025-06-28" },
  { studentId: "s7", studentName: "Karan Joshi", overallPercentage: 73, chaptersCompleted: 8, totalChapters: 11, lastActive: "2025-06-26" },
  { studentId: "s8", studentName: "Neha Kapoor", overallPercentage: 95, chaptersCompleted: 10, totalChapters: 11, lastActive: "2025-06-29" },
  { studentId: "s9", studentName: "Vikram Singh", overallPercentage: 60, chaptersCompleted: 7, totalChapters: 11, lastActive: "2025-06-22" },
  { studentId: "s10", studentName: "Isha Mehta", overallPercentage: 30, chaptersCompleted: 3, totalChapters: 11, lastActive: "2025-06-15" },
];

const seedAssessments: Assessment[] = [
  { studentId: "s1", studentName: "Aarav Sharma", assessmentName: "Mid-Term Exam", score: 78, totalMarks: 100, date: "2025-05-15", status: "Pass" },
  { studentId: "s1", studentName: "Aarav Sharma", assessmentName: "Weekly Test 3", score: 18, totalMarks: 20, date: "2025-06-10", status: "Pass" },
  { studentId: "s2", studentName: "Ananya Patel", assessmentName: "Mid-Term Exam", score: 72, totalMarks: 100, date: "2025-05-15", status: "Pass" },
  { studentId: "s2", studentName: "Ananya Patel", assessmentName: "Weekly Test 3", score: 15, totalMarks: 20, date: "2025-06-10", status: "Pass" },
  { studentId: "s3", studentName: "Rohan Verma", assessmentName: "Mid-Term Exam", score: 88, totalMarks: 100, date: "2025-05-15", status: "Pass" },
  { studentId: "s3", studentName: "Rohan Verma", assessmentName: "Weekly Test 3", score: 19, totalMarks: 20, date: "2025-06-10", status: "Pass" },
  { studentId: "s4", studentName: "Priya Gupta", assessmentName: "Mid-Term Exam", score: 65, totalMarks: 100, date: "2025-05-15", status: "Pass" },
  { studentId: "s4", studentName: "Priya Gupta", assessmentName: "Weekly Test 3", score: 12, totalMarks: 20, date: "2025-06-10", status: "Pass" },
  { studentId: "s5", studentName: "Arjun Nair", assessmentName: "Mid-Term Exam", score: 45, totalMarks: 100, date: "2025-05-15", status: "Fail" },
  { studentId: "s5", studentName: "Arjun Nair", assessmentName: "Weekly Test 3", score: 8, totalMarks: 20, date: "2025-06-10", status: "Fail" },
  { studentId: "s6", studentName: "Diya Reddy", assessmentName: "Mid-Term Exam", score: 85, totalMarks: 100, date: "2025-05-15", status: "Pass" },
  { studentId: "s7", studentName: "Karan Joshi", assessmentName: "Mid-Term Exam", score: 70, totalMarks: 100, date: "2025-05-16", status: "Pass" },
  { studentId: "s8", studentName: "Neha Kapoor", assessmentName: "Mid-Term Exam", score: 92, totalMarks: 100, date: "2025-05-16", status: "Pass" },
  { studentId: "s9", studentName: "Vikram Singh", assessmentName: "Mid-Term Exam", score: 58, totalMarks: 100, date: "2025-05-16", status: "Fail" },
];

const seedAttendance: Attendance[] = [
  { studentId: "s1", studentName: "Aarav Sharma", totalClasses: 48, attended: 44, percentage: 91.7 },
  { studentId: "s2", studentName: "Ananya Patel", totalClasses: 48, attended: 42, percentage: 87.5 },
  { studentId: "s3", studentName: "Rohan Verma", totalClasses: 48, attended: 46, percentage: 95.8 },
  { studentId: "s4", studentName: "Priya Gupta", totalClasses: 48, attended: 38, percentage: 79.2 },
  { studentId: "s5", studentName: "Arjun Nair", totalClasses: 48, attended: 32, percentage: 66.7 },
  { studentId: "s6", studentName: "Diya Reddy", totalClasses: 48, attended: 43, percentage: 89.6 },
  { studentId: "s7", studentName: "Karan Joshi", totalClasses: 42, attended: 37, percentage: 88.1 },
  { studentId: "s8", studentName: "Neha Kapoor", totalClasses: 42, attended: 40, percentage: 95.2 },
  { studentId: "s9", studentName: "Vikram Singh", totalClasses: 42, attended: 33, percentage: 78.6 },
  { studentId: "s10", studentName: "Isha Mehta", totalClasses: 42, attended: 20, percentage: 47.6 },
];

const initialData: AppData = {
  courses: seedCourses,
  batches: seedBatches,
  students: seedStudents,
  progress: seedProgress,
  assessments: seedAssessments,
  attendance: seedAttendance,
  instructors: seedInstructors,
  currentUserRole: null,
};

export const useAppData = create<AppDataStore>()(
  persist(
    (set) => ({
      ...initialData,
      setCourses: (courses) => set({ courses }),
      setBatches: (batches) => set({ batches }),
      setStudents: (students) => set({ students }),
      setProgress: (progress) => set({ progress }),
      setAssessments: (assessments) => set({ assessments }),
      setAttendance: (attendance) => set({ attendance }),
      setInstructors: (instructors) => set({ instructors }),
      setCurrentUserRole: (role) => set({ currentUserRole: role }),
      reset: () => set(initialData),
    }),
    {
      name: "lms-app-data",
      partialize: (state) => ({
        courses: state.courses,
        batches: state.batches,
        students: state.students,
        progress: state.progress,
        assessments: state.assessments,
        attendance: state.attendance,
        instructors: state.instructors,
      }),
    }
  )
);
