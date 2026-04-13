import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";

// ─── Import all admin sub-controllers ─────────────
import { adminAuthController } from "./adminAuth-controller";
import { staffAuthController } from "./staffAuth-controller";
import { institutionController } from "./institution-controller";
import { departmentController } from "./department-controller";
import { staffController } from "./staff-controller";
import { classController } from "./class-controller";
import { studentController } from "./student-controller";
import { curriculumController } from "./curriculum-controller";
import { filteredCurriculumController } from "./filtered-curriculum-controller";
import { gradeBookController } from "./grade-book-controller";
import { curriculumReaderController } from "./curriculum-reader-controller";
import { chapterController } from "./chapter-controller";
import { chapterContentController } from "./chapter-content-controller";
import { institutionCurriculumController } from "./institution-curriculum-controller";
import { dashboardController } from "./dashboard-controller";
import { academicYearController } from "./academic-year-controller";
import { periodConfigController } from "./period-config-controller";
import { timetableController } from "./timetable-controller";
import { settingsController } from "./settings-controller";

// ─── Import staff-module controllers (mounted under admin) ─
import { classSessionController } from "../staff/class-session-controller";
import { teachingProgressController } from "../staff/teaching-progress-controller";

// ─── Admin base router ────────────────────────────

const adminBaseRouter = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Auth
adminBaseRouter.route("/auth", adminAuthController);
adminBaseRouter.route("/staff/auth", staffAuthController);

// Core entities
adminBaseRouter.route("/institutions", institutionController);
adminBaseRouter.route("/departments", departmentController);
adminBaseRouter.route("/staff", staffController);
adminBaseRouter.route("/classes", classController);
adminBaseRouter.route("/students", studentController);

// Curriculum
adminBaseRouter.route("/curriculum", curriculumController);
adminBaseRouter.route("/filtered-curriculum", filteredCurriculumController);
adminBaseRouter.route("/gradeBook", gradeBookController);
adminBaseRouter.route("/curriculum-reader", curriculumReaderController);

// Chapters — original Elysia prefix was "/admin/curriculum" (nested under /admin)
adminBaseRouter.route("/admin/curriculum", chapterController);
adminBaseRouter.route("/admin/curriculum", chapterContentController);

// Institution curriculum access (controller has /:id/curriculum-access in its routes)
adminBaseRouter.route("/institutions", institutionCurriculumController);

// Staff-module controllers (class sessions + teaching progress)
adminBaseRouter.route("/class-session", classSessionController);
adminBaseRouter.route("/teaching-progress", teachingProgressController);

// Dashboard & settings
adminBaseRouter.route("/dashboard", dashboardController);
adminBaseRouter.route("/academic-year", academicYearController);
adminBaseRouter.route("/period-config", periodConfigController);
adminBaseRouter.route("/timetable", timetableController);
adminBaseRouter.route("/settings", settingsController);

export { adminBaseRouter };
