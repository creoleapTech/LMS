import Elysia from "elysia";
import { PasetoUtil } from "@/lib/paseto";
import { validateToken } from "@/lib/utils";
import { userAuthController } from "./userAuth-controller";
import { userController } from "./user-controller";
import { qrController } from "./qr-controller";

interface Store {
  id: string;
  userId: string;
}

export const userBaseRouter = new Elysia({
  prefix: "/user",
  tags: ["User Routes"],
})
.use(userAuthController)
.use(userController)
.use(qrController)