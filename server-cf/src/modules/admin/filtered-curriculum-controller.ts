// Filtered Curriculum — ported from Elysia filtered-curriculum-controller.ts
// Role-based curriculum/gradebook filtering by institution access.
// Original did manual token decoding; CF version uses adminAuth middleware
// and reads user from c.get("user").
import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { eq, and, inArray } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { curricula, gradeBooks } from "../../schema/books";
import { institutions } from "../../schema/admin";
import {
  institutionCurriculumAccess,
  institutionAccessibleGradebooks,
  curriculumLevels,
  curriculumGrades,
} from "../../schema/junction";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", adminAuth);

// GET filtered curriculums based on user role and institution
app.get("/", async (c) => {
  const user = c.get("user") as any;
  const userRole = user.role;
  const institutionId = user.institutionId;

  const allowedRoles = ["teacher", "admin", "staff", "super_admin"];
  if (!allowedRoles.includes(userRole)) {
    throw new ForbiddenError("Access denied");
  }

  const db = getDb(c.env.DB);

  // SUPER ADMIN: Return all curriculums with all grade books
  if (userRole === "super_admin") {
    const allCurricula = await db
      .select({
        id: curricula.id,
        name: curricula.name,
        isPublished: curricula.isPublished,
        thumbnail: curricula.thumbnail,
        banner: curricula.banner,
      })
      .from(curricula);

    const curriculumsWithBooks = await Promise.all(
      allCurricula.map(async (curriculum) => {
        const [levels, grades, gradeBookRows] = await Promise.all([
          db
            .select({ level: curriculumLevels.level })
            .from(curriculumLevels)
            .where(eq(curriculumLevels.curriculumId, curriculum.id)),
          db
            .select({ grade: curriculumGrades.grade })
            .from(curriculumGrades)
            .where(eq(curriculumGrades.curriculumId, curriculum.id)),
          db
            .select({
              id: gradeBooks.id,
              grade: gradeBooks.grade,
              bookTitle: gradeBooks.bookTitle,
              subtitle: gradeBooks.subtitle,
              coverImage: gradeBooks.coverImage,
              isPublished: gradeBooks.isPublished,
            })
            .from(gradeBooks)
            .where(eq(gradeBooks.curriculumId, curriculum.id)),
        ]);

        return {
          ...curriculum,
          level: levels.map((l) => l.level),
          grades: grades.map((g) => g.grade),
          gradeBooks: gradeBookRows,
        };
      }),
    );

    return c.json({
      success: true,
      data: curriculumsWithBooks,
      role: userRole,
    }, 200);
  }

  // ADMIN, TEACHER, STAFF: Return only curriculums assigned to their institution
  if (
    (userRole === "admin" || userRole === "teacher" || userRole === "staff") &&
    institutionId
  ) {
    // Check institution exists and is not deleted
    const [institution] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, institutionId))
      .limit(1);

    if (!institution || institution.isDeleted) {
      throw new BadRequestError("Institution not found");
    }

    // Get curriculum access entries for this institution
    const accessEntries = await db
      .select()
      .from(institutionCurriculumAccess)
      .where(eq(institutionCurriculumAccess.institutionId, institutionId));

    const accessibleCurriculums = await Promise.all(
      accessEntries.map(async (access) => {
        // Fetch the curriculum
        const [curriculum] = await db
          .select({
            id: curricula.id,
            name: curricula.name,
            isPublished: curricula.isPublished,
            thumbnail: curricula.thumbnail,
            banner: curricula.banner,
          })
          .from(curricula)
          .where(eq(curricula.id, access.curriculumId))
          .limit(1);

        if (!curriculum) return null;

        const [levels, grades] = await Promise.all([
          db
            .select({ level: curriculumLevels.level })
            .from(curriculumLevels)
            .where(eq(curriculumLevels.curriculumId, curriculum.id)),
          db
            .select({ grade: curriculumGrades.grade })
            .from(curriculumGrades)
            .where(eq(curriculumGrades.curriculumId, curriculum.id)),
        ]);

        // Get only the grade books this institution has access to
        const accessibleGradeBookIds = await db
          .select({ gradeBookId: institutionAccessibleGradebooks.gradeBookId })
          .from(institutionAccessibleGradebooks)
          .where(eq(institutionAccessibleGradebooks.accessId, access.id));

        const gbIds = accessibleGradeBookIds.map((r) => r.gradeBookId);

        let gradeBookRows: any[] = [];
        if (gbIds.length > 0) {
          gradeBookRows = await db
            .select({
              id: gradeBooks.id,
              grade: gradeBooks.grade,
              bookTitle: gradeBooks.bookTitle,
              subtitle: gradeBooks.subtitle,
              coverImage: gradeBooks.coverImage,
              isPublished: gradeBooks.isPublished,
            })
            .from(gradeBooks)
            .where(inArray(gradeBooks.id, gbIds));
        }

        return {
          ...curriculum,
          level: levels.map((l) => l.level),
          grades: grades.map((g) => g.grade),
          gradeBooks: gradeBookRows,
        };
      }),
    );

    const validCurriculums = accessibleCurriculums.filter((c) => c !== null);

    return c.json({
      success: true,
      data: validCurriculums,
      role: userRole,
      institutionId,
    }, 200);
  }

  // Default: No access
  return c.json({
    success: true,
    data: [],
    role: userRole,
    message: "No curriculum access",
  }, 200);
});

// GET filtered grade books for a specific curriculum
app.get("/:curriculumId/gradebooks", async (c) => {
  const user = c.get("user") as any;
  const userRole = user.role;
  const institutionId = user.institutionId;
  const curriculumId = c.req.param("curriculumId");

  const db = getDb(c.env.DB);

  // SUPER ADMIN: Return all grade books for this curriculum
  if (userRole === "super_admin") {
    const gradeBookRows = await db
      .select({
        id: gradeBooks.id,
        grade: gradeBooks.grade,
        bookTitle: gradeBooks.bookTitle,
        subtitle: gradeBooks.subtitle,
        description: gradeBooks.description,
        coverImage: gradeBooks.coverImage,
        isPublished: gradeBooks.isPublished,
      })
      .from(gradeBooks)
      .where(eq(gradeBooks.curriculumId, curriculumId));

    return c.json({ success: true, data: gradeBookRows }, 200);
  }

  // ADMIN, TEACHER, STAFF: Return only accessible grade books
  if (
    (userRole === "admin" || userRole === "teacher" || userRole === "staff") &&
    institutionId
  ) {
    const [institution] = await db
      .select()
      .from(institutions)
      .where(eq(institutions.id, institutionId))
      .limit(1);

    if (!institution || institution.isDeleted) {
      throw new BadRequestError("Institution not found");
    }

    // Find the curriculum access for this specific curriculum
    const [curriculumAccess] = await db
      .select()
      .from(institutionCurriculumAccess)
      .where(
        and(
          eq(institutionCurriculumAccess.institutionId, institutionId),
          eq(institutionCurriculumAccess.curriculumId, curriculumId),
        ),
      )
      .limit(1);

    if (!curriculumAccess) {
      return c.json({
        success: true,
        data: [],
        message: "No access to this curriculum",
      }, 200);
    }

    // Get only accessible grade books
    const accessibleGradeBookIds = await db
      .select({ gradeBookId: institutionAccessibleGradebooks.gradeBookId })
      .from(institutionAccessibleGradebooks)
      .where(eq(institutionAccessibleGradebooks.accessId, curriculumAccess.id));

    const gbIds = accessibleGradeBookIds.map((r) => r.gradeBookId);

    let gradeBookRows: any[] = [];
    if (gbIds.length > 0) {
      gradeBookRows = await db
        .select({
          id: gradeBooks.id,
          grade: gradeBooks.grade,
          bookTitle: gradeBooks.bookTitle,
          subtitle: gradeBooks.subtitle,
          description: gradeBooks.description,
          coverImage: gradeBooks.coverImage,
          isPublished: gradeBooks.isPublished,
        })
        .from(gradeBooks)
        .where(inArray(gradeBooks.id, gbIds));
    }

    return c.json({ success: true, data: gradeBookRows }, 200);
  }

  return c.json({ success: true, data: [] }, 200);
});

export const filteredCurriculumController = app;
