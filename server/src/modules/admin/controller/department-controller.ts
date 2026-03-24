// controllers/department.controller.ts
import { BadRequestError } from "@/lib/shared/bad-request";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { DepartmentModel } from "@/schema/admin/department-model";
import { InstitutionModel } from "@/schema/admin/institution-model";
import Elysia, { t } from "elysia";
import { Types } from "mongoose";

interface DecodedToken {
  role: string;
  institutionId?: Types.ObjectId | string;
  // Add other properties that your decoded token contains
}


export const departmentController = new Elysia({
  prefix: "/departments",
  tags: ["Departments (Colleges Only)"],
})

// CREATE
// CREATE
.post("/", async ({ body, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === 'string') {
    throw new ForbiddenError("Invalid authentication token");
  }
  
  const decoded = headers.decoded as DecodedToken;
  
  const institution = await InstitutionModel.findById(body.institutionId);
  if (!institution || institution.isDeleted) {
    throw new BadRequestError("Institution not found");
  }
  
  if (institution.type !== "college") {
    throw new BadRequestError("Departments are only for colleges");
  }

  // Explicit type assertion
  const institutionId = (institution as any)._id as Types.ObjectId;
  
  if (decoded.role !== "super_admin" && institutionId.toString() !== decoded.institutionId?.toString()) {
    throw new ForbiddenError("Access denied");
  }

  const dept = new DepartmentModel(body);
  await dept.save();

  set.status = 201;
  return { success: true, data: dept };
}, {
  body: t.Object({
    name: t.String({ maxLength: 100 }),
    institutionId: t.String(),
  }),
})
// LIST
.get("/", async ({ query, headers, set }) => {
  const filter: any = { isDeleted: false };
  if (!headers.decoded || typeof headers.decoded === 'string') {
    throw new ForbiddenError("Invalid authentication token");
  }
  
  const decoded = headers.decoded as DecodedToken;
  
  if (decoded.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can update institutions");
  }

  const depts = await DepartmentModel.find(filter)
    .populate("institutionId", "name type")
    .sort({ name: 1 });

  return { success: true, data: depts };
}, {
  query: t.Object({
    institutionId: t.Optional(t.String()),
  }),
})

// UPDATE, DELETE - similar pattern...