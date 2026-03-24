// controllers/staff/staff-curriculum-controller.ts
import { Elysia } from "elysia";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { BadRequestError } from "@/lib/shared/bad-request";

// Assuming you have a staff auth macro similar to superAdminAuthMacro
// If not, create one or use your existing auth logic for staff/teacher
import { staffAuthMacro } from "@/modules/staff/staff-macro"; // adjust path if needed

export const staffCurriculumController = new Elysia({
  prefix: "/staff/curriculum",
  tags: ["Staff Curriculum Access"],
})
  .use(staffAuthMacro) // Ensures only logged-in staff/teacher can access

  // GET: Return only the curriculums and enabled books assigned to the staff's institution
  .get("/accessible", async ({ user }) => {
    const institutionId = user.institutionId;

    if (!institutionId) {
      throw new BadRequestError("Institution not found in your profile");
    }

    const institution = await InstitutionModel.findById(institutionId)
      .populate({
        path: "curriculumAccess.curriculumId",
        select: "name level grades isPublished _id",
        match: { isDeleted: false },
      })
      .populate({
        path: "curriculumAccess.accessibleGradeBooks",
        select: "grade bookTitle subtitle coverImage description isPublished _id",
        match: { isDeleted: false },
      })
      .lean();

    if (!institution || institution.isDeleted) {
      throw new BadRequestError("Institution not found or deleted");
    }

    // Filter out any access entries where curriculum or books are missing
    const validAccess = (institution.curriculumAccess || []).filter(
      (access: any) => access.curriculumId && access.accessibleGradeBooks?.length > 0
    );

    const data = validAccess.map((access: any) => ({
      _id: access.curriculumId._id,
      name: access.curriculumId.name,
      level: access.curriculumId.level,
      grades: access.curriculumId.grades,
      isPublished: access.curriculumId.isPublished,
      gradeBooks: access.accessibleGradeBooks || [],
    }));

    return {
      success: true,
      data,
      message: data.length === 0 ? "No curriculum assigned yet" : "Curriculum loaded successfully",
    };
  });