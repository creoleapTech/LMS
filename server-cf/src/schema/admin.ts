import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
});

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
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// ─── staff ──────────────────────────────────────────
export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  name: text("name"),
  salutation: text("salutation"),
  email: text("email").notNull().unique(),
  mobileNumber: text("mobile_number"),
  password: text("password").notNull(),
  type: text("type", { enum: ["teacher", "admin"] }),
  joiningDate: text("joining_date"),
  profileImage: text("profile_image"),
  institutionId: text("institution_id").references(() => institutions.id),
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  lastLogin: text("last_login"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// ─── departments ────────────────────────────────────
export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  institutionId: text("institution_id").references(() => institutions.id),
  isActive: integer("is_active").default(1),
  isDeleted: integer("is_deleted").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

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
});

// ─── students ───────────────────────────────────────
export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  name: text("name"),
  rollNumber: text("roll_number"),
  admissionNumber: text("admission_number"),
  email: text("email"),
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
});
