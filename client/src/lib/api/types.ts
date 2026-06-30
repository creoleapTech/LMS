export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";
export type CourseStatus = "Active" | "Inactive" | "Archived";
export type BatchStatus = "Active" | "Upcoming" | "Completed";
export type StudentStatus = "Active" | "Inactive";
export type AssessmentStatus = "Pass" | "Fail" | "Pending";

export interface Course {
  id: string;
  code: string;
  name: string;
  description?: string;
  thumbnail?: string;
  level: CourseLevel;
  duration: string;
  fees: number;
  status: CourseStatus;
  startDate: string;
}

export interface Batch {
  id: string;
  courseId: string;
  name: string;
  startDate: string;
  endDate: string;
  studentCount: number;
  status: BatchStatus;
  instructor?: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  batchId: string;
  enrolledDate: string;
  status: StudentStatus;
}

export interface Progress {
  studentId: string;
  studentName: string;
  overallPercentage: number;
  chaptersCompleted: number;
  totalChapters: number;
  lastActive: string;
}

export interface Assessment {
  studentId: string;
  studentName: string;
  assessmentName: string;
  score: number;
  totalMarks: number;
  date: string;
  status: AssessmentStatus;
}

export interface Attendance {
  studentId: string;
  studentName: string;
  totalClasses: number;
  attended: number;
  percentage: number;
}

export interface Instructor {
  id: string;
  name: string;
  email: string;
  password: string;
  assignedCourseIds: string[];
  assignedBatchIds: string[];
}

export interface User {
  _id: string;
  email: string;
  name: string;
  role: "admin" | "super_admin" | "staff" | "teacher" | "student" | "instructor";
  token: string;
  lastLogin: Date;
}
