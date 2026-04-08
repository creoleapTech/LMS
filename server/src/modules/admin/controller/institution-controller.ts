// controllers/institution.controller.ts
import Elysia, { t } from "elysia";
import { Types } from "mongoose";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { StudentModel } from "@/schema/admin/student-model";
import { StaffModel } from "@/schema/admin/staff-model";
import { ClassModel } from "@/schema/admin/class-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { superAdminAuthMacro } from "@/modules/superAdmin/superAdmin-macro";
import { saveFile } from "@/lib/file";

// Define the type for the decoded token
interface DecodedToken {
  role: string;
  institutionId?: Types.ObjectId | string;
  // Add other properties that your decoded token contains
}

export const institutionController = new Elysia({
  prefix: "/institutions",
  tags: ["Institutions"],
})
  .use(superAdminAuthMacro)
  .guard({
  isAuth: true
})
// CREATE - Only Super Admin
.post(
  "/",
  async ({ body, set, user }) => {
    // console.log("User from auth:", user);
    // Add runtime check and type assertion

    
    
    if (user.role !== "super_admin") {
      throw new ForbiddenError("Only super_admin can create institutions");
    }

    const institutionData: any = {
      name: body.name,
      type: body.type,
      address: body.address,
      contactDetails: typeof body.contactDetails === "string"
        ? JSON.parse(body.contactDetails)
        : body.contactDetails,
    };

    if (body.logo) {
      const result = await saveFile(body.logo as unknown as Blob, "institutions");
      if (result.ok) {
        institutionData.logo = result.filename;
      }
    }

    const institution = new InstitutionModel(institutionData);
    await institution.save();

    set.status = 201;
    return { success: true, data: institution };
  },
  {
    body: t.Object({
      name: t.String({ maxLength: 100 }),
      type: t.Union([t.Literal("school"), t.Literal("college")]),
      address: t.String({ maxLength: 255 }),
      contactDetails: t.Union([
        t.Object({
          inchargePerson: t.String(),
          mobileNumber: t.String(),
          email: t.Optional(t.String({ format: "email" })),
          officePhone: t.Optional(t.String()),
        }),
        t.String(),
      ]),
      logo: t.Optional(t.File()),
    }),
    detail: { summary: "Create Institution (Super Admin Only)" },
  }
)

// READ ALL - Super Admin sees all, Admin sees only own
.get("/", async ({ query, user, set }) => {
  const filter: any = { isDeleted: false };

  if (user.role !== "super_admin" && user.institutionId) {
    filter._id = user.institutionId;
  }

  // Add search
  if (query.search) {
    const searchRegex = new RegExp(query.search as string, "i");
    filter.$or = [
      { name: searchRegex },
      { "contactDetails.inchargePerson": searchRegex },
      { "contactDetails.mobileNumber": searchRegex },
      { "contactDetails.email": searchRegex },
    ];
  }

  // Add type filter
  if (query.type && ["school", "college"].includes(query.type as string)) {
    filter.type = query.type;
  }

  const institutions = await InstitutionModel.find(filter)
    .sort({ createdAt: -1 })
    .select("-adminIds -staffIds");

  set.status = 200;
  return { success: true, data: institutions };
})
// READ ONE
// READ ONE
.get("/:id", async ({ params, user, set }) => {
   if (user.role !== "super_admin") {
      throw new ForbiddenError("Only super_admin can create institutions");
    }
  
  const institution = await InstitutionModel.findOne({
    _id: params.id,
    isDeleted: false,
  });

  if (!institution) throw new BadRequestError("Institution not found");

  // Type assertion for _id
  const institutionId = institution._id as Types.ObjectId;
  
  if (user.role !== "super_admin" && institutionId.toString() !== user.institutionId?.toString()) {
    throw new ForbiddenError("Access denied");
  }

  set.status = 200;
  return { success: true, data: institution };
}, {
  params: t.Object({ id: t.String() }),
  detail: { summary: "Get Institution by ID" },
})

// STATS Endpoint
.get("/:id/stats", async ({ params, user, set }) => {
    // Basic auth check already done by guard but let's be safe on access
    if (user.role !== "super_admin" && params.id !== user.institutionId?.toString()) {
       throw new ForbiddenError("Access denied");
    }
    
    // We need to import Models manually if not present or use string refs if registered
    // Better to just ensure imports are added. 
    // Since I can't easily add imports at top with this tool without overwriting, 
    // I will try to use the models if they are globally available or just assume I will fix imports in next step.
    // Actually, I can use a multi-step approach. 
    // Step 1: Add imports. Step 2: Add endpoint.
    
    // Let's execute Step 2 here (adding endpoint) and then Step 1 (fixing imports).
    // ... wait, if I add code that uses missing imports, it might fail validaton or typecheck if running immediately?
    // No, it's just text replacement.
    
    const studentCount = await StudentModel.countDocuments({ institutionId: params.id, isDeleted: false });
    const staffCount = await StaffModel.countDocuments({ institutionId: params.id, isDeleted: false });
    const classCount = await ClassModel.countDocuments({ institutionId: params.id, isDeleted: false });

    // Active counts
    const activeStudentCount = await StudentModel.countDocuments({ institutionId: params.id, isActive: true, isDeleted: false });
    const activeStaffCount = await StaffModel.countDocuments({ institutionId: params.id, isActive: true, isDeleted: false });

    // This month's new additions for trend display
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [newStudentsThisMonth, newStaffThisMonth, newClassesThisMonth] = await Promise.all([
      StudentModel.countDocuments({ institutionId: params.id, isDeleted: false, createdAt: { $gte: startOfMonth } }),
      StaffModel.countDocuments({ institutionId: params.id, isDeleted: false, createdAt: { $gte: startOfMonth } }),
      ClassModel.countDocuments({ institutionId: params.id, isDeleted: false, createdAt: { $gte: startOfMonth } }),
    ]);

    return {
        success: true,
        data: {
            totalStudents: studentCount,
            activeStudents: activeStudentCount,
            totalStaff: staffCount,
            activeStaff: activeStaffCount,
            totalClasses: classCount,
            studentTrend: newStudentsThisMonth > 0 ? `+${newStudentsThisMonth} this month` : "No new this month",
            staffTrend: newStaffThisMonth > 0 ? `+${newStaffThisMonth} new joined` : "No new this month",
            classTrend: newClassesThisMonth > 0 ? `+${newClassesThisMonth} this month` : `${classCount} total`,
        }
    };
}, {
    params: t.Object({ id: t.String() })
})
// UPDATE
.patch("/:id", async ({ params, body, user, set }) => {
  // Add runtime check and type assertion
   if (user.role !== "super_admin") {
      throw new ForbiddenError("Only super_admin can create institutions");
    }

  const updateData: any = { ...body };
  delete updateData.logo;

  if (updateData.contactDetails && typeof updateData.contactDetails === "string") {
    updateData.contactDetails = JSON.parse(updateData.contactDetails);
  }

  if (body.logo) {
    const result = await saveFile(body.logo as unknown as Blob, "institutions");
    if (result.ok) {
      updateData.logo = result.filename;
    }
  }

  const institution = await InstitutionModel.findByIdAndUpdate(
    params.id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!institution || institution.isDeleted) {
    throw new BadRequestError("Institution not found");
  }

  set.status = 200;
  return { success: true, data: institution };
}, {
  params: t.Object({ id: t.String() }),
  body: t.Partial(t.Object({
    name: t.String(),
    type: t.Union([t.Literal("school"), t.Literal("college")]),
    address: t.String(),
    contactDetails: t.Union([
      t.Object({
        inchargePerson: t.String(),
        mobileNumber: t.String(),
        email: t.Optional(t.String()),
        officePhone: t.Optional(t.String()),
      }),
      t.String(),
    ]),
    isActive: t.Boolean(),
    logo: t.File(),
  })),
  detail: { summary: "Update Institution (Super Admin Only)" },
})

// SOFT DELETE
.delete("/:id", async ({ params, user, set }) => {
  // Add runtime check and type assertion
    if (user.role !== "super_admin") {
      throw new ForbiddenError("Only super_admin can create institutions");
    }
  
  
 
  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can delete institutions");
  }

  const institution = await InstitutionModel.findByIdAndUpdate(
    params.id,
    { isDeleted: true, isActive: false },
    { new: true }
  );

  if (!institution) throw new BadRequestError("Institution not found");

  set.status = 200;
  return { success: true, message: "Institution deleted successfully" };
}, {
  params: t.Object({ id: t.String() }),
  detail: { summary: "Soft Delete Institution" },
})
.patch(
  "/:id/toggle-active",
  async ({ params, user, set }) => {
      if (user.role !== "super_admin") {
      throw new ForbiddenError("Only super_admin can create institutions");
    }
  
    
    if (user.role !== "super_admin") {
      throw new ForbiddenError("Only super_admin can toggle status");
    }

    const institution = await InstitutionModel.findById(params.id);
    if (!institution || institution.isDeleted) {
      throw new BadRequestError("Institution not found");
    }

    institution.isActive = !institution.isActive;
    await institution.save();

    set.status = 200;
    return { success: true, data: institution };
  },
  {
    params: t.Object({ id: t.String() }),
    detail: { summary: "Toggle Institution Active/Inactive" },
  }
)