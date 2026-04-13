import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { institutions } from "../../schema/admin";
import { curricula, gradeBooks } from "../../schema/books";
import {
  institutionCurriculumAccess,
  institutionAccessibleGradebooks,
} from "../../schema/junction";
import { BadRequestError } from "../../lib/errors/bad-request";
import { superAdminAuth } from "../../middleware/super-admin-auth";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// All routes require super-admin auth
app.use("*", superAdminAuth);

// ─── GET / — List curriculum access for an institution ───
app.get("/:id/curriculum-access", async (c) => {
  const institutionId = c.req.param("id");
  const db = getDb(c.env.DB);

  // Verify institution exists
  const [institution] = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)));

  if (!institution) {
    throw new BadRequestError("Institution not found");
  }

  // Get all curriculum access rows for this institution
  const accessRows = await db
    .select({
      accessId: institutionCurriculumAccess.id,
      curriculumId: institutionCurriculumAccess.curriculumId,
    })
    .from(institutionCurriculumAccess)
    .where(eq(institutionCurriculumAccess.institutionId, institutionId));

  // Build full response with curriculum + gradebook details
  const result = [];
  for (const access of accessRows) {
    // Fetch curriculum info
    const [curriculum] = await db
      .select({
        id: curricula.id,
        name: curricula.name,
      })
      .from(curricula)
      .where(eq(curricula.id, access.curriculumId));

    // Fetch accessible gradebooks
    const gbRows = await db
      .select({
        id: gradeBooks.id,
        grade: gradeBooks.grade,
        bookTitle: gradeBooks.bookTitle,
        subtitle: gradeBooks.subtitle,
        coverImage: gradeBooks.coverImage,
      })
      .from(institutionAccessibleGradebooks)
      .innerJoin(gradeBooks, eq(gradeBooks.id, institutionAccessibleGradebooks.gradeBookId))
      .where(eq(institutionAccessibleGradebooks.accessId, access.accessId));

    result.push({
      curriculumId: curriculum || { id: access.curriculumId },
      accessibleGradeBooks: gbRows,
      _accessId: access.accessId,
    });
  }

  return c.json({ success: true, data: result });
});

// ─── POST / — Add or replace curriculum access ───────────
app.post("/:id/curriculum-access", async (c) => {
  const institutionId = c.req.param("id");
  const body = await c.req.json<{ curriculumId: string; gradeBookIds: string[] }>();
  const { curriculumId, gradeBookIds } = body;

  if (!curriculumId || !Array.isArray(gradeBookIds)) {
    throw new BadRequestError("curriculumId and gradeBookIds[] are required");
  }

  const db = getDb(c.env.DB);

  // Verify institution exists
  const [institution] = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)));

  if (!institution) {
    throw new BadRequestError("Institution not found");
  }

  // Remove existing access for this curriculum (prevents duplicates)
  const existingAccess = await db
    .select({ id: institutionCurriculumAccess.id })
    .from(institutionCurriculumAccess)
    .where(
      and(
        eq(institutionCurriculumAccess.institutionId, institutionId),
        eq(institutionCurriculumAccess.curriculumId, curriculumId),
      ),
    );

  for (const row of existingAccess) {
    // Delete child gradebook rows first
    await db
      .delete(institutionAccessibleGradebooks)
      .where(eq(institutionAccessibleGradebooks.accessId, row.id));
    // Delete the access row
    await db
      .delete(institutionCurriculumAccess)
      .where(eq(institutionCurriculumAccess.id, row.id));
  }

  // Insert new access row
  const accessId = uuid();
  await db.insert(institutionCurriculumAccess).values({
    id: accessId,
    institutionId,
    curriculumId,
  });

  // Insert gradebook access rows
  for (const gbId of gradeBookIds) {
    await db.insert(institutionAccessibleGradebooks).values({
      id: uuid(),
      accessId,
      gradeBookId: gbId,
    });
  }

  // Return updated full list
  const allAccess = await db
    .select({
      accessId: institutionCurriculumAccess.id,
      curriculumId: institutionCurriculumAccess.curriculumId,
    })
    .from(institutionCurriculumAccess)
    .where(eq(institutionCurriculumAccess.institutionId, institutionId));

  const result = [];
  for (const access of allAccess) {
    const [curriculum] = await db
      .select({ id: curricula.id, name: curricula.name })
      .from(curricula)
      .where(eq(curricula.id, access.curriculumId));

    const gbRows = await db
      .select({
        id: gradeBooks.id,
        grade: gradeBooks.grade,
        bookTitle: gradeBooks.bookTitle,
        subtitle: gradeBooks.subtitle,
        coverImage: gradeBooks.coverImage,
      })
      .from(institutionAccessibleGradebooks)
      .innerJoin(gradeBooks, eq(gradeBooks.id, institutionAccessibleGradebooks.gradeBookId))
      .where(eq(institutionAccessibleGradebooks.accessId, access.accessId));

    result.push({
      curriculumId: curriculum || { id: access.curriculumId },
      accessibleGradeBooks: gbRows,
      _accessId: access.accessId,
    });
  }

  return c.json({ success: true, message: "Curriculum access updated", data: result });
});

// ─── DELETE /:curriculumId — Remove access for a curriculum ──
app.delete("/:id/curriculum-access/:curriculumId", async (c) => {
  const institutionId = c.req.param("id");
  const curriculumId = c.req.param("curriculumId");
  const db = getDb(c.env.DB);

  // Verify institution exists
  const [institution] = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)));

  if (!institution) {
    throw new BadRequestError("Institution not found");
  }

  // Find and delete access rows
  const accessRows = await db
    .select({ id: institutionCurriculumAccess.id })
    .from(institutionCurriculumAccess)
    .where(
      and(
        eq(institutionCurriculumAccess.institutionId, institutionId),
        eq(institutionCurriculumAccess.curriculumId, curriculumId),
      ),
    );

  for (const row of accessRows) {
    await db
      .delete(institutionAccessibleGradebooks)
      .where(eq(institutionAccessibleGradebooks.accessId, row.id));
    await db
      .delete(institutionCurriculumAccess)
      .where(eq(institutionCurriculumAccess.id, row.id));
  }

  return c.json({ success: true, message: "Curriculum access removed" });
});

// ─── PATCH /:curriculumId/toggle-book — Toggle a single gradebook ──
app.patch("/:id/curriculum-access/:curriculumId/toggle-book", async (c) => {
  const institutionId = c.req.param("id");
  const curriculumId = c.req.param("curriculumId");
  const body = await c.req.json<{ gradeBookId: string }>();
  const { gradeBookId } = body;

  if (!gradeBookId) {
    throw new BadRequestError("gradeBookId is required");
  }

  const db = getDb(c.env.DB);

  // Verify institution exists
  const [institution] = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)));

  if (!institution) {
    throw new BadRequestError("Institution not found");
  }

  // Find the access entry for this curriculum
  const [accessEntry] = await db
    .select({ id: institutionCurriculumAccess.id })
    .from(institutionCurriculumAccess)
    .where(
      and(
        eq(institutionCurriculumAccess.institutionId, institutionId),
        eq(institutionCurriculumAccess.curriculumId, curriculumId),
      ),
    );

  if (!accessEntry) {
    throw new BadRequestError("Curriculum not assigned to this institution");
  }

  // Check if this gradebook is already enabled
  const [existing] = await db
    .select({ id: institutionAccessibleGradebooks.id })
    .from(institutionAccessibleGradebooks)
    .where(
      and(
        eq(institutionAccessibleGradebooks.accessId, accessEntry.id),
        eq(institutionAccessibleGradebooks.gradeBookId, gradeBookId),
      ),
    );

  if (existing) {
    // Disable — remove the row
    await db
      .delete(institutionAccessibleGradebooks)
      .where(eq(institutionAccessibleGradebooks.id, existing.id));
  } else {
    // Enable — insert a new row
    await db.insert(institutionAccessibleGradebooks).values({
      id: uuid(),
      accessId: accessEntry.id,
      gradeBookId,
    });
  }

  // Return updated access entry
  const [curriculum] = await db
    .select({ id: curricula.id, name: curricula.name })
    .from(curricula)
    .where(eq(curricula.id, curriculumId));

  const gbRows = await db
    .select({
      id: gradeBooks.id,
      grade: gradeBooks.grade,
      bookTitle: gradeBooks.bookTitle,
      subtitle: gradeBooks.subtitle,
      coverImage: gradeBooks.coverImage,
    })
    .from(institutionAccessibleGradebooks)
    .innerJoin(gradeBooks, eq(gradeBooks.id, institutionAccessibleGradebooks.gradeBookId))
    .where(eq(institutionAccessibleGradebooks.accessId, accessEntry.id));

  return c.json({
    success: true,
    message: "Book access toggled",
    data: {
      curriculumId: curriculum || { id: curriculumId },
      accessibleGradeBooks: gbRows,
      _accessId: accessEntry.id,
    },
  });
});

export { app as institutionCurriculumController };
