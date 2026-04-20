import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, like, or, count, inArray } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import {
  students,
  classes,
  institutions,
} from "../../schema/admin";
import { classStudentIds } from "../../schema/junction";
import {
  parseExcelFile,
  generateExcelTemplate,
} from "../../lib/excel-parser";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { saveFile, deleteFile } from "../../lib/file";
import * as XLSX from "xlsx";

const studentController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
studentController.use("*", adminAuth);

function isJsonRequest(contentType: string | undefined): boolean {
  return (contentType ?? "").toLowerCase().includes("application/json");
}

// ─── CREATE Single Student ─────────────────────────
studentController.post("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  let body: Record<string, any>;
  let profileImageFile: File | null = null;

  const contentType = c.req.header("content-type");

  if (isJsonRequest(contentType)) {
    body = await c.req.json();
  } else {
    const formData = await c.req.formData();
    body = {
      name: formData.get("name") as string,
      rollNumber: formData.get("rollNumber") as string | null,
      admissionNumber: formData.get("admissionNumber") as string | null,
      email: formData.get("email") as string | null,
      mobileNumber: formData.get("mobileNumber") as string | null,
      parentName: formData.get("parentName") as string | null,
      parentMobile: formData.get("parentMobile") as string | null,
      parentEmail: formData.get("parentEmail") as string | null,
      dateOfBirth: formData.get("dateOfBirth") as string | null,
      gender: formData.get("gender") as string | null,
      address: formData.get("address") as string | null,
      admissionDate: formData.get("admissionDate") as string | null,
      classId: formData.get("classId") as string,
    };

    const imgInput = formData.get("profileImage");
    if (imgInput && typeof imgInput !== "string") {
      profileImageFile = imgInput as unknown as File;
    }
  }

  // Verify class exists
  const [classData] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, body.classId), eq(classes.isDeleted, 0)))
    .limit(1);

  if (!classData) {
    throw new BadRequestError("Class not found");
  }

  if (!classData.isActive) {
    throw new BadRequestError("Cannot add student to an inactive class");
  }

  if (
    user.role !== "super_admin" &&
    classData.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  // Handle profile image upload
  let profileImage: string | undefined = body.profileImage;
  if (profileImageFile) {
    const result = await saveFile(c.env.BUCKET, profileImageFile, "students/profiles");
    if (result.ok) profileImage = result.key;
  }

  const studentId = uuid();
  const now = nowISO();

  const [created] = await db
    .insert(students)
    .values({
      id: studentId,
      name: body.name,
      rollNumber: body.rollNumber,
      admissionNumber: body.admissionNumber,
      email: body.email?.toLowerCase(),
      mobileNumber: body.mobileNumber,
      parentName: body.parentName,
      parentMobile: body.parentMobile,
      parentEmail: body.parentEmail?.toLowerCase(),
      dateOfBirth: body.dateOfBirth,
      gender: body.gender,
      address: body.address,
      admissionDate: body.admissionDate || now,
      profileImage,
      classId: body.classId,
      institutionId: classData.institutionId,
      isActive: 1,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Add to class_student_ids junction
  await db.insert(classStudentIds).values({
    id: uuid(),
    classId: body.classId,
    studentId,
  });

  return c.json({ success: true, data: created }, 201);
});

// ─── BULK UPLOAD Students from Excel ───────────────
studentController.post("/bulk-upload", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const formData = await c.req.formData();
  const institutionId = formData.get("institutionId") as string;
  const defaultClassId = formData.get("classId") as string | null;
  const file = formData.get("file") as File | null;

  // Verify institution
  const [inst] = await db
    .select()
    .from(institutions)
    .where(
      and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0))
    )
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

  // Pre-fetch all classes for this institution
  const allClasses = await db
    .select()
    .from(classes)
    .where(
      and(
        eq(classes.institutionId, institutionId),
        eq(classes.isDeleted, 0)
      )
    );

  const classMap = new Map<string, { id: string; isActive: number | null }>();
  allClasses.forEach((cls) => {
    const key = `${cls.grade || ""}-${cls.section}`.toUpperCase();
    classMap.set(key, { id: cls.id, isActive: cls.isActive });
  });

  const fileBuffer = new Uint8Array(await file.arrayBuffer());

  const result = parseExcelFile(
    fileBuffer,
    (row: any, rowIndex: number) => {
      const errors: string[] = [];

      // Validate class info
      let classId = defaultClassId;
      if (!classId) {
        if (!row.section) {
          errors.push("Section is required (or select a default Class)");
        } else {
          const key =
            `${row.grade || ""}-${row.section}`.trim().toUpperCase();
          if (classMap.has(key)) {
            const cls = classMap.get(key)!;
            if (!cls.isActive) {
              errors.push(
                `Class ${row.grade}-${row.section} is inactive.`
              );
            } else {
              classId = cls.id;
            }
          } else {
            errors.push(
              `Class not found for Grade: ${row.grade}, Section: ${row.section}. Create the class first.`
            );
          }
        }
      }

      // Validate required fields
      if (!row.name || row.name.trim() === "") {
        errors.push("Name is required");
      }
      if (!row.parentName || row.parentName.trim() === "") {
        errors.push("Parent name is required");
      }
      if (!row.parentMobile || row.parentMobile.trim() === "") {
        errors.push("Parent mobile is required");
      }

      // Validate email format if provided
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (row.email && !emailRegex.test(row.email)) {
        errors.push("Invalid email format");
      }
      if (row.parentEmail && !emailRegex.test(row.parentEmail)) {
        errors.push("Invalid parent email format");
      }

      // Validate gender
      if (
        row.gender &&
        !["male", "female", "other"].includes(row.gender.toLowerCase())
      ) {
        errors.push("Gender must be male, female, or other");
      }

      if (errors.length > 0) {
        return { isValid: false, errors };
      }

      return {
        isValid: true,
        errors: [],
        data: {
          name: row.name.trim(),
          rollNumber: row.rollNumber?.trim(),
          admissionNumber: row.admissionNumber?.trim(),
          email: row.email?.trim().toLowerCase(),
          mobileNumber: row.mobileNumber?.trim(),
          parentName: row.parentName.trim(),
          parentMobile: row.parentMobile.trim(),
          parentEmail: row.parentEmail?.trim().toLowerCase(),
          dateOfBirth: row.dateOfBirth || undefined,
          gender: row.gender?.toLowerCase(),
          address: row.address?.trim(),
          admissionDate: row.admissionDate || nowISO(),
          classId,
          institutionId,
        },
      };
    },
    ["name", "parentName", "parentMobile"]
  );

  // ── DEDUPLICATION ────────────────────────────────
  const validData = result.data as any[];

  if (validData.length > 0) {
    // 1. Check for duplicates WITHIN the file
    const uniqueDataInFile: any[] = [];
    const seenInFile = new Set<string>();

    validData.forEach((student, index) => {
      const key = `${student.name.trim().toLowerCase()}-${student.parentName.trim().toLowerCase()}-${student.classId}`;
      if (seenInFile.has(key)) {
        result.errors.push({
          row: index + 2,
          errors: [
            `Duplicate entry in this file: Student '${student.name}' with parent '${student.parentName}' appears multiple times.`,
          ],
        });
      } else {
        seenInFile.add(key);
        uniqueDataInFile.push(student);
      }
    });

    // 2. Check for duplicates AGAINST DATABASE
    const studentNames = uniqueDataInFile.map((s) => s.name);

    // Fetch existing students for this institution with matching names
    let existingStudents: any[] = [];
    if (studentNames.length > 0) {
      // Query in batches to avoid overly long IN clauses
      for (const name of [...new Set(studentNames)]) {
        const matches = await db
          .select()
          .from(students)
          .where(
            and(
              eq(students.institutionId, institutionId),
              eq(students.name, name),
              eq(students.isDeleted, 0)
            )
          );
        existingStudents.push(...matches);
      }
    }

    const finalUniqueData: any[] = [];

    uniqueDataInFile.forEach((newStudent, index) => {
      const isDuplicate = existingStudents.some(
        (existing) =>
          (existing.name || "").toLowerCase() ===
            newStudent.name.toLowerCase() &&
          (existing.parentName || "").toLowerCase() ===
            newStudent.parentName.toLowerCase() &&
          existing.classId === newStudent.classId
      );

      if (isDuplicate) {
        result.errors.push({
          row: index + 2,
          errors: [
            `Student '${newStudent.name}' with parent '${newStudent.parentName}' already exists in this class.`,
          ],
        });
      } else {
        finalUniqueData.push(newStudent);
      }
    });

    // Update result data
    (result as any).data = finalUniqueData;
    result.validRows = finalUniqueData.length;
  }

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

  // Insert valid students
  const now = nowISO();
  const insertedStudents: any[] = [];
  const studentsByClass: Record<string, string[]> = {};

  for (const studentData of result.data as any[]) {
    const studentId = uuid();

    const [created] = await db
      .insert(students)
      .values({
        id: studentId,
        name: studentData.name,
        rollNumber: studentData.rollNumber,
        admissionNumber: studentData.admissionNumber,
        email: studentData.email,
        mobileNumber: studentData.mobileNumber,
        parentName: studentData.parentName,
        parentMobile: studentData.parentMobile,
        parentEmail: studentData.parentEmail,
        dateOfBirth: studentData.dateOfBirth,
        gender: studentData.gender,
        address: studentData.address,
        admissionDate: studentData.admissionDate,
        classId: studentData.classId,
        institutionId: studentData.institutionId,
        profileImage: undefined,
        isActive: 1,
        isDeleted: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    insertedStudents.push(created);

    // Track for junction table
    if (studentData.classId) {
      if (!studentsByClass[studentData.classId]) {
        studentsByClass[studentData.classId] = [];
      }
      studentsByClass[studentData.classId].push(studentId);
    }
  }

  // Update classStudentIds junction table
  for (const [classId, studentIdList] of Object.entries(studentsByClass)) {
    for (const sId of studentIdList) {
      await db.insert(classStudentIds).values({
        id: uuid(),
        classId,
        studentId: sId,
      });
    }
  }

  return c.json(
    {
      success: true,
      message: `Successfully imported ${insertedStudents.length} students`,
      data: insertedStudents,
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
studentController.get("/template", async (c) => {
  const headers = [
    "grade",
    "section",
    "name",
    "rollNumber",
    "admissionNumber",
    "email",
    "mobileNumber",
    "parentName",
    "parentMobile",
    "parentEmail",
    "dateOfBirth",
    "gender",
    "address",
    "admissionDate",
  ];

  const sampleData = [
    {
      grade: "10",
      section: "A",
      name: "Jane Smith",
      rollNumber: "001",
      admissionNumber: "ADM2024001",
      email: "jane@example.com",
      mobileNumber: "9876543210",
      parentName: "John Smith",
      parentMobile: "9876543211",
      parentEmail: "john.smith@example.com",
      dateOfBirth: "2010-05-15",
      gender: "female",
      address: "123 Main St, City",
      admissionDate: "2024-01-15",
    },
  ];

  const buffer = generateExcelTemplate(headers, sampleData);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="students_template.xlsx"',
    },
  });
});

// ─── POST Error Report (Excel) ─────────────────────
studentController.post("/error-report", async (c) => {
  const body = await c.req.json<{
    errors: Array<{ row: number; errors: string | string[] }>;
  }>();
  const errors = body.errors;

  if (!errors || !Array.isArray(errors)) {
    throw new BadRequestError("Invalid errors data");
  }

  // Transform errors to flat format for Excel
  const rows = errors.map((e) => ({
    "Row Number": e.row,
    "Error Details": Array.isArray(e.errors)
      ? e.errors.join(", ")
      : e.errors,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet["!cols"] = [{ wch: 10 }, { wch: 100 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Errors");

  const buffer = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  }) as Uint8Array;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="import_errors.xlsx"',
    },
  });
});

// ─── GET All Students ──────────────────────────────
studentController.get("/", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const classId = c.req.query("classId");
  const institutionId = c.req.query("institutionId");
  const search = c.req.query("search");

  const conditions: any[] = [eq(students.isDeleted, 0)];

  if (classId) {
    conditions.push(eq(students.classId, classId));
  }

  if (institutionId) {
    conditions.push(eq(students.institutionId, institutionId));
  } else if (user.role !== "super_admin") {
    conditions.push(eq(students.institutionId, user.institutionId));
  }

  if (search) {
    conditions.push(
      or(
        like(students.name, `%${search}%`),
        like(students.rollNumber, `%${search}%`),
        like(students.admissionNumber, `%${search}%`),
        like(students.parentName, `%${search}%`),
        like(students.parentMobile, `%${search}%`)
      )
    );
  }

  const studentRows = await db
    .select()
    .from(students)
    .where(and(...conditions));

  // Enrich with class and institution info
  const enriched = await Promise.all(
    studentRows.map(async (s) => {
      // Class info
      let classInfo: any = null;
      if (s.classId) {
        const [cls] = await db
          .select({
            id: classes.id,
            grade: classes.grade,
            section: classes.section,
            year: classes.year,
          })
          .from(classes)
          .where(eq(classes.id, s.classId))
          .limit(1);
        classInfo = cls || null;
      }

      // Institution info
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

      return {
        ...s,
        classId: classInfo || s.classId,
        institutionId: institution || s.institutionId,
      };
    })
  );

  return c.json({ success: true, data: enriched }, 200);
});

// ─── GET Single Student ────────────────────────────
studentController.get("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.isDeleted, 0)))
    .limit(1);

  if (!student) {
    throw new BadRequestError("Student not found");
  }

  if (
    user.role !== "super_admin" &&
    student.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  // Class info
  let classInfo: any = null;
  if (student.classId) {
    const [cls] = await db
      .select({
        id: classes.id,
        grade: classes.grade,
        section: classes.section,
        year: classes.year,
      })
      .from(classes)
      .where(eq(classes.id, student.classId))
      .limit(1);
    classInfo = cls || null;
  }

  // Institution info
  let institution: any = null;
  if (student.institutionId) {
    const [inst] = await db
      .select({
        id: institutions.id,
        name: institutions.name,
        type: institutions.type,
      })
      .from(institutions)
      .where(eq(institutions.id, student.institutionId))
      .limit(1);
    institution = inst || null;
  }

  return c.json(
    {
      success: true,
      data: {
        ...student,
        classId: classInfo || student.classId,
        institutionId: institution || student.institutionId,
      },
    },
    200
  );
});

// ─── UPDATE Student ────────────────────────────────
studentController.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.isDeleted, 0)))
    .limit(1);

  if (!student) {
    throw new BadRequestError("Student not found");
  }

  if (
    user.role !== "super_admin" &&
    student.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  let body: Record<string, any>;
  let profileImageFile: File | null = null;

  const contentType = c.req.header("content-type");

  if (isJsonRequest(contentType)) {
    body = await c.req.json();
  } else {
    const formData = await c.req.formData();
    body = {};
    const fields = [
      "name", "rollNumber", "admissionNumber", "email", "mobileNumber",
      "parentName", "parentMobile", "parentEmail", "dateOfBirth",
      "gender", "address", "classId", "isActive",
    ];
    for (const f of fields) {
      const v = formData.get(f);
      if (v !== null) body[f] = v;
    }

    const imgInput = formData.get("profileImage");
    if (imgInput && typeof imgInput !== "string") {
      profileImageFile = imgInput as unknown as File;
    } else if (typeof imgInput === "string") {
      body.profileImage = imgInput;
    }
  }

  // If changing class, update junction table
  if (body.classId && body.classId !== student.classId) {
    // Remove from old class junction
    await db
      .delete(classStudentIds)
      .where(
        and(
          eq(classStudentIds.classId, student.classId),
          eq(classStudentIds.studentId, id)
        )
      );

    // Add to new class junction
    await db.insert(classStudentIds).values({
      id: uuid(),
      classId: body.classId,
      studentId: id,
    });
  }

  // Build update set
  const updateData: Record<string, any> = { updatedAt: nowISO() };
  const allowedFields = [
    "name",
    "rollNumber",
    "admissionNumber",
    "email",
    "mobileNumber",
    "parentName",
    "parentMobile",
    "parentEmail",
    "dateOfBirth",
    "gender",
    "address",
    "profileImage",
    "classId",
    "isActive",
  ] as const;

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  // Handle profile image file upload
  if (profileImageFile) {
    // Delete old profile image from R2
    if (student.profileImage) {
      await deleteFile(c.env.BUCKET, student.profileImage);
    }
    const result = await saveFile(c.env.BUCKET, profileImageFile, "students/profiles");
    if (result.ok) updateData.profileImage = result.key;
  }

  await db.update(students).set(updateData).where(eq(students.id, id));

  const [updated] = await db
    .select()
    .from(students)
    .where(eq(students.id, id))
    .limit(1);

  return c.json({ success: true, data: updated }, 200);
});

// ─── DELETE Student (Soft Delete) ──────────────────
studentController.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, id), eq(students.isDeleted, 0)))
    .limit(1);

  if (!student) {
    throw new BadRequestError("Student not found");
  }

  if (
    user.role !== "super_admin" &&
    student.institutionId !== user.institutionId
  ) {
    throw new ForbiddenError("Access denied");
  }

  // Soft delete
  await db
    .update(students)
    .set({ isDeleted: 1, isActive: 0, updatedAt: nowISO() })
    .where(eq(students.id, id));

  // Remove from class junction
  await db
    .delete(classStudentIds)
    .where(
      and(
        eq(classStudentIds.classId, student.classId),
        eq(classStudentIds.studentId, id)
      )
    );

  return c.json(
    { success: true, message: "Student deleted successfully" },
    200
  );
});

export { studentController };
