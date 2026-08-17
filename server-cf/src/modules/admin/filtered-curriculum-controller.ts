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
  const userRole = user?.role;
  const institutionId = user?.institutionId;

  const allowedRoles = ["teacher", "admin", "staff", "super_admin"];
  if (!userRole || !allowedRoles.includes(userRole)) {
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

    if (allCurricula.length === 0) {
      return c.json({
        success: true,
        data: [],
        role: userRole,
      }, 200);
    }

    const [allLevels, allGrades, allGradeBooks] = await Promise.all([
      db
        .select({ curriculumId: curriculumLevels.curriculumId, level: curriculumLevels.level })
        .from(curriculumLevels),
      db
        .select({ curriculumId: curriculumGrades.curriculumId, grade: curriculumGrades.grade })
        .from(curriculumGrades),
      db
        .select({
          id: gradeBooks.id,
          curriculumId: gradeBooks.curriculumId,
          grade: gradeBooks.grade,
          bookTitle: gradeBooks.bookTitle,
          subtitle: gradeBooks.subtitle,
          coverImage: gradeBooks.coverImage,
          isPublished: gradeBooks.isPublished,
        })
        .from(gradeBooks),
    ]);

    const levelsMap = new Map<string, string[]>();
    for (const l of allLevels) {
      const list = levelsMap.get(l.curriculumId) || [];
      list.push(l.level);
      levelsMap.set(l.curriculumId, list);
    }

    const gradesMap = new Map<string, number[]>();
    for (const g of allGrades) {
      const list = gradesMap.get(g.curriculumId) || [];
      list.push(g.grade);
      gradesMap.set(g.curriculumId, list);
    }

    const gradeBooksMap = new Map<string, any[]>();
    for (const gb of allGradeBooks) {
      const list = gradeBooksMap.get(gb.curriculumId) || [];
      list.push({
        id: gb.id,
        grade: gb.grade,
        bookTitle: gb.bookTitle,
        subtitle: gb.subtitle,
        coverImage: gb.coverImage,
        isPublished: gb.isPublished,
      });
      gradeBooksMap.set(gb.curriculumId, list);
    }

    const curriculumsWithBooks = allCurricula.map((curriculum) => ({
      ...curriculum,
      level: levelsMap.get(curriculum.id) || [],
      grades: gradesMap.get(curriculum.id) || [],
      gradeBooks: gradeBooksMap.get(curriculum.id) || [],
    }));

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

    if (accessEntries.length === 0) {
      return c.json({
        success: true,
        data: [],
        role: userRole,
        institutionId,
      }, 200);
    }

    const curriculumIds = accessEntries.map((a) => a.curriculumId);
    const accessIds = accessEntries.map((a) => a.id);

    const [curriculaRows, levelsRows, gradesRows, accessibleGbRows] = await Promise.all([
      db
        .select({
          id: curricula.id,
          name: curricula.name,
          isPublished: curricula.isPublished,
          thumbnail: curricula.thumbnail,
          banner: curricula.banner,
        })
        .from(curricula)
        .where(inArray(curricula.id, curriculumIds)),
      db
        .select({ curriculumId: curriculumLevels.curriculumId, level: curriculumLevels.level })
        .from(curriculumLevels)
        .where(inArray(curriculumLevels.curriculumId, curriculumIds)),
      db
        .select({ curriculumId: curriculumGrades.curriculumId, grade: curriculumGrades.grade })
        .from(curriculumGrades)
        .where(inArray(curriculumGrades.curriculumId, curriculumIds)),
      db
        .select({
          accessId: institutionAccessibleGradebooks.accessId,
          gradeBookId: institutionAccessibleGradebooks.gradeBookId,
        })
        .from(institutionAccessibleGradebooks)
        .where(inArray(institutionAccessibleGradebooks.accessId, accessIds)),
    ]);

    const gbIds = accessibleGbRows.map((r) => r.gradeBookId);
    let gradeBooksList: any[] = [];
    if (gbIds.length > 0) {
      gradeBooksList = await db
        .select({
          id: gradeBooks.id,
          curriculumId: gradeBooks.curriculumId,
          grade: gradeBooks.grade,
          bookTitle: gradeBooks.bookTitle,
          subtitle: gradeBooks.subtitle,
          coverImage: gradeBooks.coverImage,
          isPublished: gradeBooks.isPublished,
        })
        .from(gradeBooks)
        .where(inArray(gradeBooks.id, gbIds));
    }

    const levelsMap = new Map<string, string[]>();
    for (const l of levelsRows) {
      const list = levelsMap.get(l.curriculumId) || [];
      list.push(l.level);
      levelsMap.set(l.curriculumId, list);
    }

    const gradesMap = new Map<string, number[]>();
    for (const g of gradesRows) {
      const list = gradesMap.get(g.curriculumId) || [];
      list.push(g.grade);
      gradesMap.set(g.curriculumId, list);
    }

    const gradeBooksMap = new Map<string, any[]>();
    for (const gb of gradeBooksList) {
      const list = gradeBooksMap.get(gb.curriculumId) || [];
      list.push({
        id: gb.id,
        grade: gb.grade,
        bookTitle: gb.bookTitle,
        subtitle: gb.subtitle,
        coverImage: gb.coverImage,
        isPublished: gb.isPublished,
      });
      gradeBooksMap.set(gb.curriculumId, list);
    }

    const validCurriculums = curriculaRows.map((curriculum) => ({
      ...curriculum,
      level: levelsMap.get(curriculum.id) || [],
      grades: gradesMap.get(curriculum.id) || [],
      gradeBooks: gradeBooksMap.get(curriculum.id) || [],
    }));

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
