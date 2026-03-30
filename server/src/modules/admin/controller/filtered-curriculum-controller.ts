import { Elysia, t } from "elysia";
import { CurriculumModel } from "@/schema/books/curriculam-model";
import { GradeBookModel } from "@/schema/books/gradeBook-model";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { PasetoUtil } from "@/lib/paseto";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { superAdminAuthMacro } from "@/modules/superAdmin/superAdmin-macro";
import { staffAuthMacro } from "@/modules/staff/staff-macro";
import { adminAuthMacro } from "../admin-macro";
import { Types } from "mongoose";


interface DecodedToken {
  role: string;
  institutionId?: Types.ObjectId | string;
}


export const filteredCurriculumController = new Elysia({
  prefix: "/filtered-curriculum",
  tags: ["Filtered Curriculum"],
})

  // GET filtered curriculums based on user role and institution
  .get(
    "/",
    async ({ headers, set}) => {
      const token = headers.authorization?.replace("Bearer ", "");
      if (!token) {
        throw new ForbiddenError("Unauthorized");
      }

      let decoded: any;
      for (const role of ['super_admin', 'admin', 'teacher', 'staff']) {
        try {
          const result = await PasetoUtil.decodePaseto(token, role as any);
          if (result && result.payload) {
            decoded = result.payload;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!decoded) {
        throw new ForbiddenError("Invalid authentication token");
      }

      const allowedRoles = ["teacher", "admin", "staff", "super_admin"];
      if (!allowedRoles.includes(decoded.role)) {
        throw new ForbiddenError("Access denied");
      }

      const userRole = decoded.role;
      const institutionId = decoded.institutionId;
      // SUPER ADMIN: Return all curriculums with all grade books
      if (userRole === 'super_admin') {
        const curriculums = await CurriculumModel.find({})
          .select('name level grades isPublished')
          .lean();

        const curriculumsWithBooks = await Promise.all(
          curriculums.map(async (curriculum: any) => {
            const gradeBooks = await GradeBookModel.find({
              curriculumId: curriculum._id,
            }).select('grade bookTitle subtitle coverImage isPublished').lean();

            return {
              ...curriculum,
              gradeBooks
            };
          })
        );

        return {
          success: true,
          data: curriculumsWithBooks,
          role: userRole
        };
      }
      // ADMIN & TEACHER: Return only curriculums assigned to their institution
      if ((userRole === 'admin' || userRole === 'teacher' || userRole === 'staff') && institutionId) {
        const institution = await InstitutionModel.findById(institutionId)
          .populate('curriculumAccess.curriculumId', 'name level grades isPublished')
          .lean();

        if (!institution || institution.isDeleted) {
          throw new BadRequestError("Institution not found");
        }

        // Get accessible curriculum IDs and their grade books
        const accessibleCurriculums = await Promise.all(
          (institution.curriculumAccess || []).map(async (access: any) => {
            const curriculum = access.curriculumId;
         
            if (!curriculum) return null;

            // Get only the grade books this institution has access to
            const gradeBooks = await GradeBookModel.find({
              _id: { $in: access.accessibleGradeBooks },
            }).select('grade bookTitle subtitle coverImage isPublished').lean();
            return {
              _id: curriculum._id,
              name: curriculum.name,
              level: curriculum.level,
              grades: curriculum.grades,
              isPublished: curriculum.isPublished,
              gradeBooks
            };
          })
        );

        // Filter out null values
        const validCurriculums = accessibleCurriculums.filter(c => c !== null);

        return {
          success: true,
          data: validCurriculums,
          role: userRole,
          institutionId
        };
      }

      // Default: No access
      return {
        success: true,
        data: [],
        role: userRole,
        message: "No curriculum access"
      };
    },
    {
      headers: t.Object({
        authorization: t.String()
      })
    }
  )

  // GET filtered grade books for a specific curriculum
  .get(
    "/:curriculumId/gradebooks",
    async ({ params, headers }) => {
      const token = headers.authorization?.replace("Bearer ", "");
      if (!token) {
        throw new BadRequestError("Unauthorized");
      }

      let decoded: any;
      try {
        for (const role of ['super_admin', 'admin', 'teacher', 'staff']) {
          try {
            const result = await PasetoUtil.decodePaseto(token, role as any);
            if (result) {
              decoded = result;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      } catch (error) {
        throw new BadRequestError("Invalid token");
      }

      if (!decoded || !decoded.payload) {
        throw new BadRequestError("Invalid token");
      }

      const userRole = decoded.payload.role;
      const institutionId = decoded.payload.institutionId;

      // SUPER ADMIN: Return all grade books for this curriculum
      if (userRole === 'super_admin') {
        const gradeBooks = await GradeBookModel.find({
          curriculumId: params.curriculumId,
        }).select('grade bookTitle subtitle description coverImage isPublished').lean();

        return {
          success: true,
          data: gradeBooks
        };
      }

      // ADMIN & TEACHER: Return only accessible grade books
      if ((userRole === 'admin' || userRole === 'teacher' || userRole === 'staff') && institutionId) {
        const institution = await InstitutionModel.findById(institutionId).lean();
        
        if (!institution || institution.isDeleted) {
          throw new BadRequestError("Institution not found");
        }

        // Find the curriculum access for this specific curriculum
        const curriculumAccess = (institution.curriculumAccess || []).find(
          (access: any) => access.curriculumId.toString() === params.curriculumId
        );

        if (!curriculumAccess) {
          return {
            success: true,
            data: [],
            message: "No access to this curriculum"
          };
        }

        // Get only accessible grade books
        const gradeBooks = await GradeBookModel.find({
          _id: { $in: curriculumAccess.accessibleGradeBooks },
        }).select('grade bookTitle subtitle description coverImage isPublished').lean();

        return {
          success: true,
          data: gradeBooks
        };
      }

      return {
        success: true,
        data: []
      };
    },
    {
      params: t.Object({ curriculumId: t.String() }),
      headers: t.Object({ authorization: t.String() })
    }
  );
