import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, like, or, count, inArray } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import { staff, institutions, classes } from "../../schema/admin";
import {
  staffSubjects,
  staffAssignedClasses,
  institutionStaffIds,
} from "../../schema/junction";
import { hashPassword } from "../../lib/password";
import {
  parseExcelFile,
  generateExcelTemplate,
} from "../../lib/excel-parser";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";

const staffController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
staffController.use("*", adminAuth);

// ─── Helper: sync junction tables for a staff member ────
async function syncStaffSubjects(
  db: ReturnType<typeof getDb>,
  staffId: string,
  subjects: string[]
) {
  // Delete existing
  await db
    .delete(staffSubjects)
    .where(eq(staffSubjects.staffId, staffId));
  // Insert new
  if (subjects.length > 0) {
    await db.insert(staffSubjects).values(
      subjects.map((s) => ({ id: uuid(), staffId, subject: s }))
    );
  }
}

async function syncStaffAssignedClasses(
  db: ReturnType<typeof getDb>,
  staffId: string,
  classIds: string[]
) {
  await db
    .delete(staffAssignedClasses)
    .where(eq(staffAssignedClasses.staffId, staffId));
  if (classIds.length > 0) {
    await db.insert(staffAssignedClasses).values(
      classIds.map((classId) => ({ id: uuid(), staffId, classId }))
    );
  }
}

// ─── Helper: fetch subjects & assignedClasses for a staff row ──
async function getStaffRelations(
  db: ReturnType<typeof getDb>,
  staffId: string
) {
  const subjects = await db
    .select({ subject: staffSubjects.subject })
    .from(staffSubjects)
    .where(eq(staffSubjects.staffId, staffId));

  const assigned = await db
    .select({
      classId: staffAssignedClasses.classId,
    })
    .from(staffAssignedClasses)
    .where(eq(staffAssignedClasses.staffId, staffId));

  // Fetch class details for assigned classes
  let assignedClassDetails: any[] = [];
  if (assigned.length > 0) {
    assignedClassDetails = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section })
      .from(classes)
      .where(
        inArray(
          classes.id,
          assigned.map((a) => a.classId)
        )
      );
  }

  return {
    subjects: subjects.map((s) => s.subject),
    assignedClasses: assignedClassDetails,
  };
}

// ─── CREATE Single Staff ───────────────────────────
staffController.post("/", async (c) => {
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  // Verify institution
  const [inst] = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, body.institutionId), eq(institutions.isDeleted, 0)))
    .limit(1);

  if (!inst) {
    throw new BadRequestError("Institution not found");
  }

  if (user.role !== "super_admin" && inst.id !== user.institutionId) {
    throw new ForbiddenError("Access denied");
  }

  // Use provided password or generate a random one
  const plainPassword =
    body.password ||
    Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-2);

  const hashedPw = await hashPassword(plainPassword);

  const staffId = uuid();
  const now = nowISO();

  const [created] = await db
    .insert(staff)
    .values({
      id: staffId,
      name: body.name,
      salutation: body.salutation,
      email: body.email.toLowerCase(),
      mobileNumber: body.mobileNumber,
      type: body.type || "teacher",
      joiningDate: body.joiningDate || now,
      profileImage: body.profileImage,
      institutionId: body.institutionId,
      password: hashedPw,
      isActive: 1,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Add to institution_staff_ids junction
  await db.insert(institutionStaffIds).values({
    id: uuid(),
    institutionId: body.institutionId,
    staffId: staffId,
  });

  // Sync subjects junction
  if (body.subjects && body.subjects.length > 0) {
    await syncStaffSubjects(db, staffId, body.subjects);
  }

  // Sync assignedClasses junction
  if (body.assignedClasses && body.assignedClasses.length > 0) {
    await syncStaffAssignedClasses(db, staffId, body.assignedClasses);
  }

  return c.json(
    {
      success: true,
      data: {
        ...created,
        password: plainPassword, // One-time plain text viewing
        subjects: body.subjects || [],
        assignedClasses: body.assignedClasses || [],
      },
    },
    201
  );
});

// ─── RESET PASSWORD ────────────────────────────────
staffController.patch("/:id/reset-password", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [staffRow] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.isDeleted, 0)))
    .limit(1);

  if (!staffRow) {
    throw new BadRequestError("Staff not found");
  }

  if (
    user.role !== "super_admin" &&
    staffRow.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  const newPassword =
    Math.random().toString(36).slice(-8) +
    Math.random().toString(36).slice(-2);

  const hashedPw = await hashPassword(newPassword);

  await db
    .update(staff)
    .set({ password: hashedPw, updatedAt: nowISO() })
    .where(eq(staff.id, id));

  return c.json(
    {
      success: true,
      message: "Password reset successfully",
      data: { id: staffRow.id, newPassword },
    },
    200
  );
});

// ─── BULK UPLOAD Staff from Excel ──────────────────
staffController.post("/bulk-upload", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const formData = await c.req.formData();
  const institutionId = formData.get("institutionId") as string;
  const file = formData.get("file") as File | null;

  // Verify institution
  const [inst] = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)))
    .limit(1);

  if (!inst) {
    throw new BadRequestError("Institution not found");
  }

  if (user.role !== "super_admin" && inst.id !== user.institutionId) {
    throw new ForbiddenError("Access denied");
  }

  if (!file) {
    throw new BadRequestError("Excel file is required");
  }

  const fileBuffer = new Uint8Array(await file.arrayBuffer());

  const result = parseExcelFile(
    fileBuffer,
    (row: any, rowIndex: number) => {
      const errors: string[] = [];

      if (!row.name || row.name.trim() === "") errors.push("Name is required");
      if (!row.email || row.email.trim() === "")
        errors.push("Email is required");
      if (!row.mobileNumber || row.mobileNumber.trim() === "")
        errors.push("Mobile number is required");

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (row.email && !emailRegex.test(row.email))
        errors.push("Invalid email format");

      if (errors.length > 0) return { isValid: false, errors };

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
          joiningDate: row.joiningDate || nowISO(),
          institutionId,
          password:
            Math.random().toString(36).slice(-8) +
            Math.random().toString(36).slice(-2),
        },
      };
    },
    ["name", "email", "mobileNumber"]
  );

  if (!result.success || result.data.length === 0) {
    return c.json(
      {
        success: false,
        message: "No valid data to import",
        errors: result.errors,
        summary: {
          totalRows: result.totalRows,
          validRows: result.validRows,
          errorRows: result.errors.length,
        },
      },
      200
    );
  }

  // Hash passwords and insert
  const now = nowISO();
  const insertedStaff: any[] = [];

  for (const staffData of result.data as any[]) {
    const hashedPw = await hashPassword(staffData.password);
    const staffId = uuid();

    const [created] = await db
      .insert(staff)
      .values({
        id: staffId,
        name: staffData.name,
        email: staffData.email,
        mobileNumber: staffData.mobileNumber,
        type: staffData.type,
        joiningDate: staffData.joiningDate,
        institutionId: staffData.institutionId,
        password: hashedPw,
        isActive: 1,
        isDeleted: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    insertedStaff.push(created);

    // Add to institution junction
    await db.insert(institutionStaffIds).values({
      id: uuid(),
      institutionId,
      staffId,
    });

    // Sync subjects junction
    if (staffData.subjects && staffData.subjects.length > 0) {
      await syncStaffSubjects(db, staffId, staffData.subjects);
    }
  }

  return c.json(
    {
      success: true,
      message: `Successfully imported ${insertedStaff.length} staff members`,
      data: insertedStaff,
      errors: result.errors,
      summary: {
        totalRows: result.totalRows,
        validRows: result.validRows,
        errorRows: result.errors.length,
      },
    },
    201
  );
});

// ─── GET Excel Template ────────────────────────────
staffController.get("/template", async (c) => {
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

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="staff_template.xlsx"',
    },
  });
});

// ─── GET All Staff ─────────────────────────────────
staffController.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const institutionId = c.req.query("institutionId");
  const type = c.req.query("type");
  const search = c.req.query("search");

  // Build conditions
  const conditions: any[] = [eq(staff.isDeleted, 0)];

  if (institutionId) {
    conditions.push(eq(staff.institutionId, institutionId));
  } else if (user.role !== "super_admin") {
    conditions.push(eq(staff.institutionId, user.institutionId));
  }

  if (type) {
    conditions.push(eq(staff.type, type as "teacher" | "admin"));
  }

  if (search) {
    conditions.push(
      or(
        like(staff.name, `%${search}%`),
        like(staff.email, `%${search}%`),
        like(staff.mobileNumber, `%${search}%`)
      )
    );
  }

  const staffRows = await db
    .select()
    .from(staff)
    .where(and(...conditions));

  // Enrich with institution info and relations
  const enriched = await Promise.all(
    staffRows.map(async (s) => {
      // Get institution info
      let institution: any = null;
      if (s.institutionId) {
        const [inst] = await db
          .select({
            id: institutions.id,
            name: institutions.name,
            type: institutions.type,
          })
          .from(institutions)
          .where(eq(institutions.id, s.institutionId))
          .limit(1);
        institution = inst || null;
      }

      const relations = await getStaffRelations(db, s.id);

      const { password: _, ...staffWithoutPassword } = s;
      return {
        ...staffWithoutPassword,
        institutionId: institution || s.institutionId,
        ...relations,
      };
    })
  );

  return c.json({ success: true, data: enriched }, 200);
});

// ─── GET Single Staff ──────────────────────────────
staffController.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [staffRow] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.isDeleted, 0)))
    .limit(1);

  if (!staffRow) {
    throw new BadRequestError("Staff not found");
  }

  if (
    user.role !== "super_admin" &&
    staffRow.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  // Get institution info
  let institution: any = null;
  if (staffRow.institutionId) {
    const [inst] = await db
      .select({
        id: institutions.id,
        name: institutions.name,
        type: institutions.type,
      })
      .from(institutions)
      .where(eq(institutions.id, staffRow.institutionId))
      .limit(1);
    institution = inst || null;
  }

  const relations = await getStaffRelations(db, staffRow.id);

  const { password: _, ...staffWithoutPassword } = staffRow;
  return c.json(
    {
      success: true,
      data: {
        ...staffWithoutPassword,
        institutionId: institution || staffRow.institutionId,
        ...relations,
      },
    },
    200
  );
});

// ─── UPDATE Staff ──────────────────────────────────
staffController.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [staffRow] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.isDeleted, 0)))
    .limit(1);

  if (!staffRow) {
    throw new BadRequestError("Staff not found");
  }

  if (
    user.role !== "super_admin" &&
    staffRow.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  // Build update set from body (only known scalar fields)
  const updateData: Record<string, any> = { updatedAt: nowISO() };

  const scalarFields = [
    "name",
    "salutation",
    "email",
    "mobileNumber",
    "type",
    "profileImage",
    "isActive",
  ] as const;

  for (const field of scalarFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  // Hash password if provided
  if (body.password) {
    updateData.password = await hashPassword(body.password);
  }

  await db.update(staff).set(updateData).where(eq(staff.id, id));

  // Sync junction tables if provided
  if (body.subjects !== undefined) {
    await syncStaffSubjects(db, id, body.subjects);
  }

  if (body.assignedClasses !== undefined) {
    await syncStaffAssignedClasses(db, id, body.assignedClasses);
  }

  // Fetch updated row
  const [updated] = await db
    .select()
    .from(staff)
    .where(eq(staff.id, id))
    .limit(1);

  const relations = await getStaffRelations(db, id);
  const { password: _, ...withoutPassword } = updated;

  return c.json(
    { success: true, data: { ...withoutPassword, ...relations } },
    200
  );
});

// ─── DELETE Staff (Soft Delete) ────────────────────
staffController.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [staffRow] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, id), eq(staff.isDeleted, 0)))
    .limit(1);

  if (!staffRow) {
    throw new BadRequestError("Staff not found");
  }

  if (
    user.role !== "super_admin" &&
    staffRow.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  // Soft delete
  await db
    .update(staff)
    .set({ isDeleted: 1, isActive: 0, updatedAt: nowISO() })
    .where(eq(staff.id, id));

  // Remove from institution junction
  if (staffRow.institutionId) {
    await db
      .delete(institutionStaffIds)
      .where(
        and(
          eq(institutionStaffIds.institutionId, staffRow.institutionId),
          eq(institutionStaffIds.staffId, id)
        )
      );
  }

  return c.json({ success: true, message: "Staff deleted successfully" }, 200);
});

export { staffController };
