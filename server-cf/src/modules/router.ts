import { Hono } from "hono";
import type { Bindings, Variables } from "../env";
import { fileController } from "./file/file-controller";
import { adminBaseRouter } from "./admin/admin-router";

export const baseRouter = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

baseRouter.route("/file", fileController);
baseRouter.route("/admin", adminBaseRouter);
