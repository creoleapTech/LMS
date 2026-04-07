// controllers/class.controller.ts
import { BadRequestError } from "@/lib/shared/bad-request";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { ClassModel } from "@/schema/admin/class-model";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { StudentModel } from "@/schema/admin/student-model";
import { GradeBookModel } from "@/schema/books/gradeBook-model";
import Elysia, { t } from "elysia";
import { adminAuthMacro } from "../admin-macro";
import { Types } from "mongoose";

export const classController = new Elysia({
  prefix: "/classes",
  tags: ["Classes / Sections"],
})
  .use(adminAuthMacro)

  // CREATE Class
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

      if (inst.type === "college" && !body.departmentId) {
        throw new BadRequestError("departmentId is required for colleges");
      }

      // Validate grade against enabled curriculum grades
      if (body.grade) {
        const gradeBookIds = (inst.curriculumAccess || []).flatMap(
          (a: any) => a.accessibleGradeBooks || []
        );
        if (gradeBookIds.length > 0) {
          const gradeBooks = await GradeBookModel.find({
            _id: { $in: gradeBookIds },
          }).select("grade").lean();
          const allowedGrades = [...new Set(gradeBooks.map((b: any) => String(b.grade)))];
          if (allowedGrades.length > 0 && !allowedGrades.includes(body.grade)) {
            throw new BadRequestError(
              `Grade "${body.grade}" is not enabled for this institution`
            );
          }
        }
      }

      const newClass = new ClassModel(body);
      await newClass.save();

      set.status = 201;
      return { success: true, data: newClass };
    },
    {
      isAuth: true,
      body: t.Object({
        grade: t.Optional(t.String({ maxLength: 50 })),
        section: t.String({ maxLength: 10 }),
        year: t.Optional(t.String({ maxLength: 50 })),
        institutionId: t.String(),
        departmentId: t.Optional(t.String()),
        capacity: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  )

  // GET All Classes
  .get(
    "/",
    async ({ query, set, user }) => {
      const filter: any = { isDeleted: false };

      // Filter by institution
      if (query.institutionId) {
        filter.institutionId = query.institutionId;
      } else if (user.role !== "super_admin") {
        filter.institutionId = user.institutionId;
      }

      // Filter by academic year
      if (query.academicYear) {
        filter.year = query.academicYear;
      }

      const classes = await ClassModel.find(filter)
        .populate("departmentId", "name")
        .populate("institutionId", "name type")
        .sort({ grade: 1, section: 1 });

      // Get student count for each class
      const classesWithCount = await Promise.all(
        classes.map(async (cls) => {
          const studentCount = await StudentModel.countDocuments({
            classId: cls._id,
            isDeleted: false,
          });
          return {
            ...cls.toObject(),
            studentCount,
          };
        })
      );

      return { success: true, data: classesWithCount };
    },
    {
      isAuth: true,
      query: t.Object({
        institutionId: t.Optional(t.String()),
        academicYear: t.Optional(t.String()),
      }),
    }
  )

  // GET Single Class
  .get(
    "/:id",
    async ({ params, user, set }) => {
      const classData = await ClassModel.findOne({
        _id: params.id,
        isDeleted: false,
      })
        .populate("departmentId", "name")
        .populate("institutionId", "name type");

      if (!classData) throw new BadRequestError("Class not found");

      const classId = (classData as any)._id as Types.ObjectId;
      const institutionId = classData.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      // Get student count
      const studentCount = await StudentModel.countDocuments({
        classId: classId,
        isDeleted: false,
      });

      return {
        success: true,
        data: { ...classData.toObject(), studentCount },
      };
    },
    {
      isAuth: true,
      params: t.Object({ id: t.String() }),
    }
  )

  // UPDATE Class
  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const classData = await ClassModel.findById(params.id);
      if (!classData || classData.isDeleted)
        throw new BadRequestError("Class not found");

      const institutionId = classData.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      const updated = await ClassModel.findByIdAndUpdate(
        params.id,
        { $set: body },
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
          grade: t.String({ maxLength: 50 }),
          section: t.String({ maxLength: 10 }),
          year: t.String({ maxLength: 50 }),
          capacity: t.Number({ minimum: 1 }),
          isActive: t.Boolean(),
        })
      ),
    }
  )

  // DELETE Class (Soft Delete)
  .delete(
    "/:id",
    async ({ params, user, set }) => {
      const classData = await ClassModel.findById(params.id);
      if (!classData || classData.isDeleted)
        throw new BadRequestError("Class not found");

      const institutionId = classData.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      // Check if class has students
      const studentCount = await StudentModel.countDocuments({
        classId: params.id,
        isDeleted: false,
      });

      if (studentCount > 0) {
        throw new BadRequestError(
          `Cannot delete class with ${studentCount} active students`
        );
      }

      await ClassModel.findByIdAndUpdate(params.id, {
        isDeleted: true,
        isActive: false,
      });

      set.status = 200;
      return { success: true, message: "Class deleted successfully" };
    },
    {
      isAuth: true,
      params: t.Object({ id: t.String() }),
    }
  );