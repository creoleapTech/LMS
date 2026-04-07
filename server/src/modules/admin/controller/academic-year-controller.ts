import Elysia, { t } from "elysia";
import { adminAuthMacro } from "../admin-macro";
import { AcademicYearModel } from "@/schema/admin/academic-year-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { Types } from "mongoose";

export const academicYearController = new Elysia({
  prefix: "/academic-year",
  tags: ["Academic Year"],
})
  .use(adminAuthMacro)
  .guard({ isAuth: true })

  // GET all academic years for institution
  .get(
    "/",
    async ({ query, user }) => {
      let institutionId = query.institutionId;

      if (!institutionId && user.role !== "super_admin") {
        institutionId =
          typeof user.institutionId === "object"
            ? (user.institutionId as any)._id?.toString()
            : user.institutionId?.toString();
      }

      if (!institutionId) {
        throw new BadRequestError("Institution ID is required");
      }

      const years = await AcademicYearModel.find({
        institutionId: new Types.ObjectId(institutionId),
        isDeleted: false,
      }).sort({ startDate: -1 });

      return { success: true, data: years };
    },
    {
      query: t.Object({
        institutionId: t.Optional(t.String()),
      }),
    }
  )

  // GET active academic year
  .get(
    "/active",
    async ({ query, user }) => {
      let institutionId = query.institutionId;

      if (!institutionId && user.role !== "super_admin") {
        institutionId =
          typeof user.institutionId === "object"
            ? (user.institutionId as any)._id?.toString()
            : user.institutionId?.toString();
      }

      if (!institutionId) {
        return { success: true, data: null };
      }

      const activeYear = await AcademicYearModel.findOne({
        institutionId: new Types.ObjectId(institutionId),
        isActive: true,
        isDeleted: false,
      });

      return { success: true, data: activeYear };
    },
    {
      query: t.Object({
        institutionId: t.Optional(t.String()),
      }),
    }
  )

  // CREATE academic year
  .post(
    "/",
    async ({ body, user, set }) => {
      if (user.role !== "super_admin" && user.role !== "admin") {
        throw new BadRequestError("Only admin or super_admin can create academic years");
      }

      const institutionId = body.institutionId;

      // Check for duplicate label
      const existing = await AcademicYearModel.findOne({
        institutionId: new Types.ObjectId(institutionId),
        label: body.label,
        isDeleted: false,
      });

      if (existing) {
        throw new BadRequestError(`Academic year "${body.label}" already exists`);
      }

      const academicYear = new AcademicYearModel({
        institutionId: new Types.ObjectId(institutionId),
        label: body.label,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        isActive: body.isActive ?? false,
        terms: body.terms || [],
      });

      // If this is set as active, deactivate others
      if (academicYear.isActive) {
        await AcademicYearModel.updateMany(
          {
            institutionId: new Types.ObjectId(institutionId),
            isDeleted: false,
          },
          { isActive: false }
        );
      }

      await academicYear.save();

      set.status = 201;
      return { success: true, data: academicYear };
    },
    {
      body: t.Object({
        institutionId: t.String(),
        label: t.String({ maxLength: 20 }),
        startDate: t.String(),
        endDate: t.String(),
        isActive: t.Optional(t.Boolean()),
        terms: t.Optional(
          t.Array(
            t.Object({
              label: t.String(),
              startDate: t.String(),
              endDate: t.String(),
            })
          )
        ),
      }),
    }
  )

  // ACTIVATE academic year (deactivates others)
  .patch(
    "/:id/activate",
    async ({ params, user }) => {
      const year = await AcademicYearModel.findById(params.id);
      if (!year || year.isDeleted) {
        throw new BadRequestError("Academic year not found");
      }

      // Deactivate all for this institution
      await AcademicYearModel.updateMany(
        {
          institutionId: year.institutionId,
          isDeleted: false,
        },
        { isActive: false }
      );

      // Activate this one
      year.isActive = true;
      await year.save();

      return { success: true, data: year };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // UPDATE academic year
  .patch(
    "/:id",
    async ({ params, body }) => {
      const year = await AcademicYearModel.findById(params.id);
      if (!year || year.isDeleted) {
        throw new BadRequestError("Academic year not found");
      }

      if (body.label) year.label = body.label;
      if (body.startDate) year.startDate = new Date(body.startDate);
      if (body.endDate) year.endDate = new Date(body.endDate);
      if (body.terms) year.terms = body.terms as any;

      await year.save();

      return { success: true, data: year };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        label: t.Optional(t.String({ maxLength: 20 })),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        terms: t.Optional(
          t.Array(
            t.Object({
              label: t.String(),
              startDate: t.String(),
              endDate: t.String(),
            })
          )
        ),
      }),
    }
  )

  // DELETE academic year (soft delete)
  .delete(
    "/:id",
    async ({ params }) => {
      const year = await AcademicYearModel.findById(params.id);
      if (!year || year.isDeleted) {
        throw new BadRequestError("Academic year not found");
      }

      year.isDeleted = true;
      year.isActive = false;
      await year.save();

      return { success: true, message: "Academic year deleted" };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );
