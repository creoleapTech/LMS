// controllers/institution-curriculum-controller.ts
import { Elysia, t } from "elysia";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { superAdminAuthMacro } from "@/modules/superAdmin/superAdmin-macro";

export const institutionCurriculumController = new Elysia({
  prefix: "/institutions/:id/curriculum-access", // ← uses :id to avoid conflict
  tags: ["Institution Curriculum Access"],
})
  .use(superAdminAuthMacro) // only super_admin

  // GET: List current curriculum access for the institution
  .get(
    "/",
    async ({ params }) => {
      const institution = await InstitutionModel.findById(params.id)
        .populate({
          path: "curriculumAccess.curriculumId",
          select: "name level grades",
        })
        .populate({
          path: "curriculumAccess.accessibleGradeBooks",
          select: "grade bookTitle subtitle coverImage",
        });

      if (!institution || institution.isDeleted) {
        throw new BadRequestError("Institution not found");
      }

      return {
        success: true,
        data: institution.curriculumAccess || [],
      };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  )

  // POST: Add or completely replace access for a curriculum
  .post(
    "/",
    async ({ params, body }) => {
      const { curriculumId, gradeBookIds } = body;

      const institution = await InstitutionModel.findById(params.id);
      if (!institution || institution.isDeleted) {
        throw new BadRequestError("Institution not found");
      }

      // Remove existing access for this curriculum (prevents duplicates)
      institution.curriculumAccess = institution.curriculumAccess.filter(
        (a: any) => a.curriculumId.toString() !== curriculumId
      );

      // Add new access
      institution.curriculumAccess.push({
        curriculumId,
        accessibleGradeBooks: gradeBookIds,
      });

      await institution.save();

      await institution.populate([
        { path: "curriculumAccess.curriculumId", select: "name level grades" },
        { path: "curriculumAccess.accessibleGradeBooks", select: "grade bookTitle subtitle coverImage" },
      ]);

      return {
        success: true,
        message: "Curriculum access updated",
        data: institution.curriculumAccess,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        curriculumId: t.String(),
        gradeBookIds: t.Array(t.String()),
      }),
    }
  )

  // DELETE: Remove access for a specific curriculum
  .delete(
    "/:curriculumId",
    async ({ params }) => {
      const institution = await InstitutionModel.findById(params.id);
      if (!institution || institution.isDeleted) {
        throw new BadRequestError("Institution not found");
      }

      institution.curriculumAccess = institution.curriculumAccess.filter(
        (a: any) => a.curriculumId.toString() !== params.curriculumId
      );

      await institution.save();

      return {
        success: true,
        message: "Curriculum access removed",
      };
    },
    {
      params: t.Object({
        id: t.String(),
        curriculumId: t.String(),
      }),
    }
  )

  // PATCH: Toggle a single grade book (enable or disable)
  .patch(
    "/:curriculumId/toggle-book",
    async ({ params, body }) => {
      const { gradeBookId } = body;

      const institution = await InstitutionModel.findById(params.id);
      if (!institution || institution.isDeleted) {
        throw new BadRequestError("Institution not found");
      }

      const accessEntry = institution.curriculumAccess.find(
        (a: any) => a.curriculumId.toString() === params.curriculumId
      );

      if (!accessEntry) {
        throw new BadRequestError("Curriculum not assigned to this institution");
      }

      const bookIdStr = gradeBookId.toString();
      const index = accessEntry.accessibleGradeBooks.findIndex(
        (id: any) => id.toString() === bookIdStr
      );

      if (index === -1) {
        // Enable the book
        accessEntry.accessibleGradeBooks.push(gradeBookId);
      } else {
        // Disable the book
        accessEntry.accessibleGradeBooks.splice(index, 1);
      }

      await institution.save();

      await institution.populate([
        { path: "curriculumAccess.curriculumId", select: "name" },
        { path: "curriculumAccess.accessibleGradeBooks", select: "grade bookTitle subtitle coverImage" },
      ]);

      const updatedAccess = institution.curriculumAccess.find(
        (a: any) => a.curriculumId.toString() === params.curriculumId
      );

      return {
        success: true,
        message: "Book access toggled",
        data: updatedAccess,
      };
    },
    {
      params: t.Object({
        id: t.String(),
        curriculumId: t.String(),
      }),
      body: t.Object({
        gradeBookId: t.String(),
      }),
    }
  );