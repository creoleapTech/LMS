import Elysia from "elysia";
import { PasetoUtil } from "@/lib/paseto";
import { validateToken } from "@/lib/utils";
import { adminAuthController } from "./adminAuth-controller";
import { institutionController } from "./institution-controller";
import { departmentController } from "./department-controller";
import { staffController } from "./staff-controller";
import { classController } from "./class-controller";
import { studentController } from "./student-controller";
import { curriculumController } from "./curriculam-controller";
import { staffAuthController } from "./staffAuth-controller";
import { classSessionController } from "../../staff/controller/class-session-controller";
import { institutionCurriculumController } from "./institution-curriculum-controller";
import { filteredCurriculumController } from "./filtered-curriculum-controller";
import { gradeBookController } from "./gradeBook-controller";
import { staffCurriculumController } from "./staff-curriculam-controller";
import { curriculumReaderController } from "./curriculum-reader-controller";
import { teachingProgressController } from "../../staff/controller/teaching-progress-controller";
import { dashboardController } from "./dashboard-controller";
// import { userController } from "./user-controller";


export const adminBaseRouter = new Elysia({
  prefix: "/admin",
  tags: ["Admin Routes"],
})
.use(adminAuthController)
.use(institutionController)
.use(departmentController)
.use(staffController)
.use(classController)
.use(studentController)
.use(curriculumController)
.use(staffAuthController)
.use(classSessionController)
.use(institutionCurriculumController)
.use(filteredCurriculumController)
.use(gradeBookController)
.use(curriculumReaderController)
.use(teachingProgressController)
.use(dashboardController)
// .use(staffCurriculumController)
// .use(userController)