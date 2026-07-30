import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ─── admins ─────────────────────────────────────────
export const admins = sqliteTable("admins", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  mobileNumber: text("mobile_number"),
  password: text("password").notNull(),
  lastLogin: text("last_login"),
  lastIp: text("last_ip"),
  lastUserAgent: text("last_user_agent"),
  name: text("name"),
  salutation: text("salutation"),
  role: text("role", { enum: ["super_admin", "admin"] }),
  institutionId: text("institution_id").references(() => institutions.id),
  profileImage: text("profile_image"),
  fcmToken: text("fcm_token"),
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("admins_institution_id_idx").on(table.institutionId),
  index("admins_is_deleted_idx").on(table.isDeleted),
  index("admins_is_active_idx").on(table.isActive),
]);

// ─── institutions ───────────────────────────────────
export const institutions = sqliteTable("institutions", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type", { enum: ["school", "college"] }),
  address: text("address"),
  contactInchargePerson: text("contact_incharge_person"),
  contactMobile: text("contact_mobile"),
  contactEmail: text("contact_email"),
  contactOfficePhone: text("contact_office_phone"),
  logo: text("logo"),
  rollNumberCounter: integer("roll_number_counter").default(0),
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("institutions_is_deleted_idx").on(table.isDeleted),
  index("institutions_is_active_idx").on(table.isActive),
]);

// ─── staff ──────────────────────────────────────────
export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  name: text("name"),
  salutation: text("salutation"),
  email: text("email").notNull().unique(),
  mobileNumber: text("mobile_number"),
  password: text("password").notNull(),
  type: text("type", { enum: ["teacher", "admin", "instructor"] }),
  joiningDate: text("joining_date"),
  profileImage: text("profile_image"),
  signatureKey: text("signature_key"),
  institutionId: text("institution_id").references(() => institutions.id),
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  lastLogin: text("last_login"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("staff_institution_id_idx").on(table.institutionId),
  index("staff_is_deleted_idx").on(table.isDeleted),
  index("staff_is_active_idx").on(table.isActive),
  index("staff_type_idx").on(table.type),
]);

// ─── departments ────────────────────────────────────
export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  institutionId: text("institution_id").references(() => institutions.id),
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("departments_institution_id_idx").on(table.institutionId),
  index("departments_is_deleted_idx").on(table.isDeleted),
]);

// ─── classes ────────────────────────────────────────
export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  grade: text("grade"),
  section: text("section").notNull(),
  year: text("year"),
  institutionId: text("institution_id").notNull().references(() => institutions.id),
  departmentId: text("department_id").references(() => departments.id),
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("classes_institution_id_idx").on(table.institutionId),
  index("classes_is_deleted_idx").on(table.isDeleted),
  index("classes_is_active_idx").on(table.isActive),
  index("classes_grade_idx").on(table.grade),
]);

// ─── students ───────────────────────────────────────
export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  name: text("name"),
  rollNumber: text("roll_number"),
  admissionNumber: text("admission_number"),
  email: text("email"),
  username: text("username").unique(),
  password: text("password"),
  plainPassword: text("plain_password"),
  mobileNumber: text("mobile_number"),
  parentName: text("parent_name"),
  parentMobile: text("parent_mobile"),
  parentEmail: text("parent_email"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender", { enum: ["male", "female", "other"] }),
  address: text("address"),
  admissionDate: text("admission_date"),
  profileImage: text("profile_image"),
  classId: text("class_id").notNull().references(() => classes.id),
  institutionId: text("institution_id").notNull().references(() => institutions.id),
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("students_institution_id_idx").on(table.institutionId),
  index("students_class_id_idx").on(table.classId),
  index("students_is_deleted_idx").on(table.isDeleted),
  index("students_is_active_idx").on(table.isActive),
  index("students_name_idx").on(table.name),
]);

// ─── courses ──────────────────────────────────────
export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  thumbnail: text("thumbnail"),
  level: text("level", { enum: ["Beginner", "Intermediate", "Advanced"] }),
  duration: text("duration"),
  fees: integer("fees").default(0),
  status: text("status", { enum: ["Active", "Inactive", "Archived"] }).default("Active"),
  startDate: text("start_date"),
  institutionId: text("institution_id").references(() => institutions.id),
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("courses_institution_id_idx").on(table.institutionId),
  index("courses_is_deleted_idx").on(table.isDeleted),
  index("courses_is_active_idx").on(table.isActive),
  index("courses_code_idx").on(table.code),
]);

// ─── batches ──────────────────────────────────────
export const batches = sqliteTable("batches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  courseId: text("course_id").notNull().references(() => courses.id),
  instructorId: text("instructor_id").references(() => staff.id),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status", { enum: ["Active", "Upcoming", "Completed"] }).default("Upcoming"),
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  index("batches_course_id_idx").on(table.courseId),
  index("batches_instructor_id_idx").on(table.instructorId),
  index("batches_is_deleted_idx").on(table.isDeleted),
  index("batches_is_active_idx").on(table.isActive),
]);
