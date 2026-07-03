import { Hono } from "hono";
import type { Bindings, Variables } from "../env";
import { fileController } from "./file/file-controller";
import { adminBaseRouter } from "./admin/admin-router";
import { leaplabAuthController } from "./public/leaplab-auth-controller";
import { leaplabProjectController } from "./public/leaplab-project-controller";
import { leaplabQuizController } from "./public/leaplab-quiz-controller";

export const baseRouter = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

baseRouter.route("/file", fileController);
baseRouter.route("/admin", adminBaseRouter);
baseRouter.route("/leaplab/auth", leaplabAuthController);
baseRouter.route("/leaplab/projects", leaplabProjectController);
baseRouter.route("/leaplab/quiz", leaplabQuizController);
