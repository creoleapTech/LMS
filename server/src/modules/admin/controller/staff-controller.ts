// controllers/staff.controller.ts
import { BadRequestError } from "@/lib/shared/bad-request";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { StaffModel } from "@/schema/admin/staff-model";
import Elysia, { t } from "elysia";
import { Types } from "mongoose";
import { adminAuthMacro } from "../admin-macro";
import { parseExcelFile, generateExcelTemplate } from "@/lib/excel-parser";


export const staffController = new Elysia({
  prefix: "/staff",
  tags: ["Staff"],
})
  .use(adminAuthMacro)
  .guard({
    isAuth: true
  })
  // CREATE Single Staff
  .post(
    "/",
    async ({ body, set, user }) => {
      const inst = await InstitutionModel.findById(body.institutionId);
      if (!inst || inst.isDeleted)
        throw new BadRequestError("Institution not found");

      const institutionId = (inst as any)._id as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      // Use provided password or generate a random one
      const finalPassword = body.password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2);

      const staff = new StaffModel({
        ...body,
        email: body.email.toLowerCase(),
        password: finalPassword
      });
      await staff.save();

      // Add to institution.staffIds
      await InstitutionModel.findByIdAndUpdate(body.institutionId, {
        $addToSet: { staffIds: staff._id },
      });

      set.status = 201;
      // Return the staff object with the plain text password for one-time viewing
      return { 
        success: true, 
        data: {
          ...staff.toObject(),
          ...staff.toObject(),
          password: finalPassword 
        } 
      };
    },
    {
      isAuth: true,
      body: t.Object({
        name: t.String({ maxLength: 100 }),
        email: t.String({ format: "email" }),
        mobileNumber: t.String({ maxLength: 15 }),
        type: t.Optional(
          t.Union([
            t.Literal("teacher"),
            t.Literal("admin"),
          ])
        ),
        subjects: t.Optional(t.Array(t.String())),
        assignedClasses: t.Optional(t.Array(t.String())),
        joiningDate: t.Optional(t.String()),
        profileImage: t.Optional(t.String()),
        institutionId: t.String(),
        password: t.Optional(t.String()), 
      }),
    }
  )
  // RESET PASSWORD
  .patch(
    "/:id/reset-password",
    async ({ params, user, set }) => {
      const staff = await StaffModel.findById(params.id);
      if (!staff || staff.isDeleted) throw new BadRequestError("Staff not found");

      const institutionId = staff.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      // Generate new password
      const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2);
      
      staff.password = newPassword;
      await staff.save();

      set.status = 200;
      return {
        success: true,
        message: "Password reset successfully",
        data: {
          _id: staff._id,
          newPassword: newPassword
        }
      };
    },
    {
      isAuth: true,
      params: t.Object({ id: t.String() }),
    }
  )

  // BULK UPLOAD Staff from Excel
  .post(
    "/bulk-upload",
    async ({ body, set, user }) => {
      const inst = await InstitutionModel.findById(body.institutionId);
      if (!inst || inst.isDeleted)
        throw new BadRequestError("Institution not found");

      const institutionId = (inst as any)._id as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      if (!body.file) {
        throw new BadRequestError("Excel file is required");
      }

      // Parse Excel file
      const fileBuffer = Buffer.from(await body.file.arrayBuffer());

      const result = parseExcelFile(
        fileBuffer,
        (row, rowIndex) => {
          const errors: string[] = [];

          // Validate required fields
          if (!row.name || row.name.trim() === "") {
            errors.push("Name is required");
          }
          if (!row.email || row.email.trim() === "") {
            errors.push("Email is required");
          }
          if (!row.mobileNumber || row.mobileNumber.trim() === "") {
            errors.push("Mobile number is required");
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (row.email && !emailRegex.test(row.email)) {
            errors.push("Invalid email format");
          }

          if (errors.length > 0) {
            return { isValid: false, errors };
          }

          // Parse subjects if provided (comma-separated)
          const subjects = row.subjects
            ? row.subjects.split(",").map((s: string) => s.trim())
            : [];

          return {
            isValid: true,
            errors: [],
            data: {
              name: row.name.trim(),
              email: row.email.trim().toLowerCase(),
              mobileNumber: row.mobileNumber.trim(),
              type: row.type || "teacher",
              subjects,
              joiningDate: row.joiningDate ? new Date(row.joiningDate) : new Date(),
              institutionId: body.institutionId,
              password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2), // Auto-generate password
            },
          };
        },
        ["name", "email", "mobileNumber"]
      );

      if (!result.success || result.data.length === 0) {
        return {
          success: false,
          message: "No valid data to import",
          errors: result.errors,
          summary: {
            totalRows: result.totalRows,
            validRows: result.validRows,
            errorRows: result.errors.length,
          },
        };
      }

      // Hash passwords before inserting (insertMany bypasses pre-save hooks)
      const staffWithHashedPasswords = await Promise.all(
        result.data.map(async (staffData: any) => ({
          ...staffData,
          password: await Bun.password.hash(staffData.password, { algorithm: "bcrypt", cost: 10 }),
        }))
      );

      // Insert valid staff members
      const insertedStaff = await StaffModel.insertMany(staffWithHashedPasswords);

      // Add staff IDs to institution
      await InstitutionModel.findByIdAndUpdate(body.institutionId, {
        $addToSet: { staffIds: { $each: insertedStaff.map((s) => s._id) } },
      });

      set.status = 201;
      return {
        success: true,
        message: `Successfully imported ${insertedStaff.length} staff members`,
        data: insertedStaff,
        errors: result.errors,
        summary: {
          totalRows: result.totalRows,
          validRows: result.validRows,
          errorRows: result.errors.length,
        },
      };
    },
    {
      isAuth: true,
      body: t.Object({
        institutionId: t.String(),
        file: t.File(),
      }),
    }
  )

  // GET Excel Template
  .get("/template", async ({ set }) => {
    const headers = [
      "name",
      "email",
      "mobileNumber",
      "type",
      "subjects",
      "joiningDate",
    ];

    const sampleData = [
      {
        name: "John Doe",
        email: "john@example.com",
        mobileNumber: "9876543210",
        type: "teacher",
        subjects: "Math, Science",
        joiningDate: "2024-01-15",
      },
    ];

    const buffer = generateExcelTemplate(headers, sampleData);

    set.headers = {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="staff_template.xlsx"',
    };

    return buffer;
  })

  // GET All Staff
  .get(
    "/",
    async ({ query, user, set }) => {
      const filter: any = { isDeleted: false };

      // Filter by institution
      if (query.institutionId) {
        filter.institutionId = query.institutionId;
      } else if (user.role !== "super_admin") {
        filter.institutionId = user.institutionId;
      }

      // Filter by type
      if (query.type) {
        filter.type = query.type;
      }

      // Search
      if (query.search) {
        const searchRegex = new RegExp(query.search, "i");
        filter.$or = [
          { name: searchRegex },
          { email: searchRegex },
          { mobileNumber: searchRegex },
        ];
      }

      const staff = await StaffModel.find(filter)
        .populate("institutionId", "name type")
        .populate("assignedClasses", "grade section")
        .sort({ createdAt: -1 });

      return { success: true, data: staff };
    },
    {
      isAuth: true,
      query: t.Object({
        institutionId: t.Optional(t.String()),
        type: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    }
  )

  // GET Single Staff
  .get(
    "/:id",
    async ({ params, user, set }) => {
      const staff = await StaffModel.findOne({
        _id: params.id,
        isDeleted: false,
      })
        .populate("institutionId", "name type")
        .populate("assignedClasses", "grade section");

      if (!staff) throw new BadRequestError("Staff not found");

      const institutionId = staff.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      return { success: true, data: staff };
    },
    {
      isAuth: true,
      params: t.Object({ id: t.String() }),
    }
  )

  // UPDATE Staff
  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const staff = await StaffModel.findById(params.id);
      if (!staff || staff.isDeleted)
        throw new BadRequestError("Staff not found");

      const institutionId = staff.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      const updateData: any = { ...body };
      if (updateData.password) {
        updateData.password = await Bun.password.hash(updateData.password, { algorithm: "bcrypt", cost: 10 });
      }

      const updated = await StaffModel.findByIdAndUpdate(
        params.id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      set.status = 200;
      return { success: true, data: updated };
    },
    {
      isAuth: true,
      params: t.Object({ id: t.String() }),
      body: t.Partial(
        t.Object({
          name: t.String({ maxLength: 100 }),
          email: t.String({ format: "email" }),
          mobileNumber: t.String({ maxLength: 15 }),
          type: t.String(),
          subjects: t.Array(t.String()),
          assignedClasses: t.Array(t.String()),
          profileImage: t.String(),
          isActive: t.Boolean(),
          password: t.String(),
        })
      ),
    }
  )

  // DELETE Staff (Soft Delete)
  .delete(
    "/:id",
    async ({ params, user, set }) => {
      const staff = await StaffModel.findById(params.id);
      if (!staff || staff.isDeleted)
        throw new BadRequestError("Staff not found");

      const institutionId = staff.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      await StaffModel.findByIdAndUpdate(params.id, {
        isDeleted: true,
        isActive: false,
      });

      // Remove from institution
      await InstitutionModel.findByIdAndUpdate(institutionId, {
        $pull: { staffIds: params.id },
      });

      set.status = 200;
      return { success: true, message: "Staff deleted successfully" };
    },
    {
      isAuth: true,
      params: t.Object({ id: t.String() }),
    }
  );