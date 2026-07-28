import { Hono } from "hono";
import { z } from "zod";
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
import { hashPassword } from "../../lib/password";
import { PHONE_PATTERN, TEXT_LIMITS, USERNAME_PATTERN } from "../../lib/validation/text";
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

const studentCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(TEXT_LIMITS.personName, "Name too long"),
  rollNumber: z.string().trim().max(TEXT_LIMITS.studentRollNumber).optional().nullable().or(z.literal("")),
  admissionNumber: z.string().trim().max(TEXT_LIMITS.studentAdmissionNumber).optional().nullable().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(TEXT_LIMITS.email).optional().nullable().or(z.literal("")),
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(TEXT_LIMITS.username, "Username too long").regex(USERNAME_PATTERN, "Only letters, numbers and underscores").optional().nullable().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(TEXT_LIMITS.password).optional().nullable().or(z.literal("")),
  mobileNumber: z.string().trim().max(TEXT_LIMITS.phone, "Mobile number too long").regex(PHONE_PATTERN, "Invalid mobile number format").optional().nullable().or(z.literal("")),
  parentName: z.string().trim().max(TEXT_LIMITS.personName, "Parent name too long").optional().nullable().or(z.literal("")),
  parentMobile: z.string().trim().max(TEXT_LIMITS.phone, "Parent mobile too long").regex(PHONE_PATTERN, "Invalid parent mobile number format").optional().nullable().or(z.literal("")),
  parentEmail: z.string().trim().email().max(TEXT_LIMITS.email).optional().nullable().or(z.literal("")),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  address: z.string().trim().max(TEXT_LIMITS.address).optional().nullable().or(z.literal("")),
  admissionDate: z.string().optional().nullable(),
  classId: z.string().min(1, "Class is required"),
  profileImage: z.string().optional(),
});

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
      username: formData.get("username") as string | null,
      password: formData.get("password") as string | null,
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

  // Validate with Zod
  const parsed = studentCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(", "));
  }
  body = parsed.data as any;

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

  // Handle password: use provided or generate random
  let plainPassword: string | null = null;
  let hashedPw: string | null = null;
  if (body.password) {
    plainPassword = body.password as string;
    hashedPw = await hashPassword(plainPassword);
  } else if (body.username) {
    // If username provided but no password, generate one
    plainPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-2);
    hashedPw = await hashPassword(plainPassword);
  }

  const [created] = await db
    .insert(students)
    .values({
      id: studentId,
      name: body.name,
      rollNumber: body.rollNumber,
      admissionNumber: body.admissionNumber,
      email: body.email?.toLowerCase(),
      username: body.username?.toLowerCase() || null,
      password: hashedPw,
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

  return c.json({
    success: true,
    data: {
      ...created,
      ...(plainPassword ? { password: plainPassword } : {}),
    },
  }, 201);
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

      const r = row;

      // Silently skip non-data rows (empty rows, section headers, second headers)
      const nameVal = r.name ? String(r.name).trim() : "";
      const gradeVal = r.grade ? String(r.grade).trim() : "";
      const sectionVal = r.section ? String(r.section).trim() : "";

      if (!nameVal && !gradeVal && !sectionVal) {
        return { isValid: false, errors: [] };
      }

      if (/^(GRADE|CLASS)\b/i.test(nameVal) && !gradeVal && !sectionVal) {
        return { isValid: false, errors: [] };
      }

      if (/^(SI\.NO|SL\.NO|STUDENT\s+NAME|ROLL\s+NUMBER)\b/i.test(nameVal)) {
        return { isValid: false, errors: [] };
      }

      // Validate compulsory fields: grade, section, name
      if (!r.grade || String(r.grade).trim() === "") {
        errors.push("Grade is required");
      }

      if (!r.section || String(r.section).trim() === "") {
        errors.push("Section is required");
      }

      if (!r.name || String(r.name).trim() === "") {
        errors.push("Name is required");
      }

      // Validate class info
      let classId = defaultClassId;
      if (r.grade && r.section) {
        const key = `${r.grade}-${r.section}`.trim().toUpperCase();
        if (classMap.has(key)) {
          const cls = classMap.get(key)!;
          if (!cls.isActive) {
            errors.push(`Class ${r.grade}-${r.section} is inactive.`);
          } else {
            classId = cls.id;
          }
        } else {
          errors.push(
            `Class not found for Grade: ${r.grade}, Section: ${r.section}. Create the class first.`
          );
        }
      }

      // Validate email format if provided
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (r.email && !emailRegex.test(r.email)) {
        errors.push("Invalid email format");
      }

      // Validate gender if provided
      if (
        r.gender &&
        !["male", "female", "other"].includes(String(r.gender).toLowerCase())
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
          _rowNumber: rowIndex,
          name: String(r.name).trim(),
          rollNumber: r.rollNumber ? String(r.rollNumber).trim() : undefined,
          admissionNumber: r.admissionNumber ? String(r.admissionNumber).trim() : undefined,
          email: r.email ? String(r.email).trim().toLowerCase() : undefined,
          username: r.username ? String(r.username).trim().toLowerCase() : undefined,
          mobileNumber: r.mobileNumber ? String(r.mobileNumber).trim() : undefined,
          parentName: r.parentName ? String(r.parentName).trim() : undefined,
          parentMobile: r.parentMobile ? String(r.parentMobile).trim() : undefined,
          parentEmail: r.parentEmail ? String(r.parentEmail).trim().toLowerCase() : undefined,
          dateOfBirth: r.dateOfBirth || undefined,
          gender: r.gender ? String(r.gender).toLowerCase() : undefined,
          address: r.address ? String(r.address).trim() : undefined,
          admissionDate: r.admissionDate || nowISO(),
          classId,
          institutionId,
        },
      };
    },
    ["grade", "section", "name"]
  );

  // ── DEDUPLICATION ────────────────────────────────
  const validData = result.data as any[];

  if (validData.length > 0) {
    // 1. Check for duplicates WITHIN the file
    const uniqueDataInFile: any[] = [];
    const seenInFile = new Set<string>();

    validData.forEach((student, index) => {
      const key = `${student.name.trim().toLowerCase()}-${student.classId}`;
      if (seenInFile.has(key)) {
        result.errors.push({
          row: student._rowNumber,
          errors: [
            `Duplicate entry in this file: Student '${student.name}' appears multiple times.`,
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
          existing.classId === newStudent.classId
      );

      if (isDuplicate) {
        result.errors.push({
          row: newStudent._rowNumber,
          errors: [
            `Student '${newStudent.name}' already exists in this class.`,
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
        username: studentData.username || null,
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
    "roll number",
    "gender",
  ];

  const sampleData = [
    {
      grade: "10",
      section: "A",
      name: "Jane Smith",
      "roll number": "001",
      gender: "female",
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
  const rawPage = parseInt(c.req.query("page") || "1", 10);
  const page = Number.isNaN(rawPage) ? 1 : Math.max(1, rawPage);
  const rawLimit = parseInt(c.req.query("limit") || "50", 10);
  const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(100, rawLimit));
  const offset = (page - 1) * limit;

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
        like(students.admissionNumber, `%${search}%`)
      )
    );
  }

  // Count total matching rows
  const [countResult] = await db
    .select({ count: count() })
    .from(students)
    .where(and(...conditions));
  const total = countResult?.count ?? 0;

  // Slim select for list view
  const studentRows = await db
    .select({
      id: students.id,
      name: students.name,
      classId: students.classId,
      admissionNumber: students.admissionNumber,
      rollNumber: students.rollNumber,
      email: students.email,
      username: students.username,
      gender: students.gender,
      institutionId: students.institutionId,
      isActive: students.isActive,
    })
    .from(students)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset);

  const classIds = [...new Set(studentRows.map((s) => s.classId).filter(Boolean))];
  const institutionIds = [...new Set(studentRows.map((s) => s.institutionId).filter(Boolean))];

  // Batch fetch classes
  const classMap = new Map<string, any>();
  if (classIds.length > 0) {
    const classRows = await db
      .select({ id: classes.id, grade: classes.grade, section: classes.section, year: classes.year })
      .from(classes)
      .where(inArray(classes.id, classIds as string[]));
    for (const c of classRows) classMap.set(c.id, c);
  }

  // Batch fetch institutions
  const institutionMap = new Map<string, any>();
  if (institutionIds.length > 0) {
    const instRows = await db
      .select({ id: institutions.id, name: institutions.name, type: institutions.type })
      .from(institutions)
      .where(inArray(institutions.id, institutionIds as string[]));
    for (const i of instRows) institutionMap.set(i.id, i);
  }

  const enriched = studentRows.map((s) => ({
    ...s,
    classId: (s.classId && classMap.get(s.classId)) || s.classId,
    institutionId: (s.institutionId && institutionMap.get(s.institutionId)) || s.institutionId,
  }));

  const pages = Math.ceil(total / limit);

  return c.json({ success: true, data: enriched, pagination: { total, page, limit, pages } }, 200);
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
      "name", "rollNumber", "admissionNumber", "email", "username", "password",
      "mobileNumber", "parentName", "parentMobile", "parentEmail", "dateOfBirth",
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

  // Validate with Zod
  const parsed = studentCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    throw new BadRequestError(parsed.error.errors.map((e) => e.message).join(", "));
  }
  body = parsed.data as any;

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
    "username",
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

  // Handle password update
  if (body.password) {
    updateData.password = await hashPassword(body.password);
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
