import { useAppData } from "./data";
import type { Course, Batch, Student, Progress, Assessment, Attendance, Instructor } from "./types";

function delay(ms = 200): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getState() {
  return useAppData.getState();
}

export const api = {
  // ─── Auth ───────────────────────────────────────────────
  async login(email: string, password: string) {
    await delay();
    const instructor = getState().instructors.find(
      (i) => i.email === email && i.password === password
    );
    if (instructor) {
      return {
        success: true,
        data: {
          _id: instructor.id,
          email: instructor.email,
          name: instructor.name,
          role: "instructor" as const,
          token: `mock-token-${instructor.id}`,
          lastLogin: new Date(),
        },
      };
    }
    return { success: false, message: "Invalid credentials" };
  },

  // ─── Courses ────────────────────────────────────────────
  async getCourses(): Promise<Course[]> {
    await delay();
    return getState().courses;
  },

  async getCourse(id: string): Promise<Course | undefined> {
    await delay();
    return getState().courses.find((c) => c.id === id);
  },

  async createCourse(data: Omit<Course, "id">): Promise<Course> {
    await delay();
    const course = { id: genId(), ...data };
    const courses = [...getState().courses, course];
    useAppData.getState().setCourses(courses);
    return course;
  },

  async updateCourse(id: string, data: Partial<Course>): Promise<Course | undefined> {
    await delay();
    const courses = getState().courses.map((c) => (c.id === id ? { ...c, ...data } : c));
    useAppData.getState().setCourses(courses);
    return courses.find((c) => c.id === id);
  },

  async deleteCourse(id: string): Promise<void> {
    await delay();
    useAppData.getState().setCourses(getState().courses.filter((c) => c.id !== id));
  },

  // ─── Batches ────────────────────────────────────────────
  async getBatches(courseId?: string): Promise<Batch[]> {
    await delay();
    let list = getState().batches;
    if (courseId) list = list.filter((b) => b.courseId === courseId);
    return list;
  },

  async getBatch(id: string): Promise<Batch | undefined> {
    await delay();
    return getState().batches.find((b) => b.id === id);
  },

  async createBatch(data: Omit<Batch, "id">): Promise<Batch> {
    await delay();
    const batch = { id: genId(), ...data };
    const batches = [...getState().batches, batch];
    useAppData.getState().setBatches(batches);
    return batch;
  },

  async updateBatch(id: string, data: Partial<Batch>): Promise<Batch | undefined> {
    await delay();
    const batches = getState().batches.map((b) => (b.id === id ? { ...b, ...data } : b));
    useAppData.getState().setBatches(batches);
    return batches.find((b) => b.id === id);
  },

  async deleteBatch(id: string): Promise<void> {
    await delay();
    useAppData.getState().setBatches(getState().batches.filter((b) => b.id !== id));
  },

  // ─── Students ───────────────────────────────────────────
  async getStudents(batchId?: string): Promise<Student[]> {
    await delay();
    let list = getState().students;
    if (batchId) list = list.filter((s) => s.batchId === batchId);
    return list;
  },

  async createStudent(data: Omit<Student, "id">): Promise<Student> {
    await delay();
    const student = { id: genId(), ...data };
    const students = [...getState().students, student];
    useAppData.getState().setStudents(students);
    const batch = getState().batches.find((b) => b.id === data.batchId);
    if (batch) {
      const batches = getState().batches.map((b) =>
        b.id === data.batchId ? { ...b, studentCount: b.studentCount + 1 } : b
      );
      useAppData.getState().setBatches(batches);
    }
    return student;
  },

  async deleteStudent(id: string): Promise<void> {
    await delay();
    const student = getState().students.find((s) => s.id === id);
    useAppData.getState().setStudents(getState().students.filter((s) => s.id !== id));
    if (student) {
      const batch = getState().batches.find((b) => b.id === student.batchId);
      if (batch) {
        const batches = getState().batches.map((b) =>
          b.id === student.batchId ? { ...b, studentCount: Math.max(0, b.studentCount - 1) } : b
        );
        useAppData.getState().setBatches(batches);
      }
    }
  },

  // ─── Progress ───────────────────────────────────────────
  async getProgress(studentIds?: string[]): Promise<Progress[]> {
    await delay();
    let list = getState().progress;
    if (studentIds) list = list.filter((p) => studentIds.includes(p.studentId));
    return list;
  },

  async updateProgress(
    studentId: string,
    data: Partial<Progress>
  ): Promise<Progress | undefined> {
    await delay();
    const progress = getState().progress.map((p) =>
      p.studentId === studentId ? { ...p, ...data } : p
    );
    useAppData.getState().setProgress(progress);
    return progress.find((p) => p.studentId === studentId);
  },

  // ─── Assessments ────────────────────────────────────────
  async getAssessments(studentIds?: string[]): Promise<Assessment[]> {
    await delay();
    let list = getState().assessments;
    if (studentIds) list = list.filter((a) => studentIds.includes(a.studentId));
    return list;
  },

  async createAssessment(data: Omit<Assessment, "id">): Promise<Assessment> {
    await delay();
    const assessment = { id: genId(), ...data };
    useAppData.getState().setAssessments([...getState().assessments, assessment]);
    return assessment;
  },

  async updateAssessment(
    studentId: string,
    assessmentName: string,
    data: Partial<Assessment>
  ): Promise<void> {
    await delay();
    const assessments = getState().assessments.map((a) =>
      a.studentId === studentId && a.assessmentName === assessmentName ? { ...a, ...data } : a
    );
    useAppData.getState().setAssessments(assessments);
  },

  // ─── Attendance ─────────────────────────────────────────
  async getAttendance(studentIds?: string[]): Promise<Attendance[]> {
    await delay();
    let list = getState().attendance;
    if (studentIds) list = list.filter((a) => studentIds.includes(a.studentId));
    return list;
  },

  async updateAttendance(
    studentId: string,
    data: Partial<Attendance>
  ): Promise<void> {
    await delay();
    const attendance = getState().attendance.map((a) =>
      a.studentId === studentId ? { ...a, ...data } : a
    );
    useAppData.getState().setAttendance(attendance);
  },

  // ─── Instructors ────────────────────────────────────────
  async getInstructor(id: string): Promise<Instructor | undefined> {
    await delay();
    return getState().instructors.find((i) => i.id === id);
  },
};
