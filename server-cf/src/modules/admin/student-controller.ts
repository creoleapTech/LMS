import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../../env";
import { getDb } from "../../db";
import { v4 as uuid } from "uuid";
import { nowISO } from "../../lib/utils";
import { eq, and, like, or, count, inArray, sql } from "drizzle-orm";
import { adminAuth } from "../../middleware/admin-auth";
import {
  students,
  classes,
  institutions,
} from "../../schema/admin";
import { classStudentIds } from "../../schema/junction";
import { institutionQuizAttempts } from "../../schema/quiz";
import { examinationCells } from "../../schema/examinations";
import {
  parseExcelFile,
  generateExcelTemplate,
} from "../../lib/excel-parser";
import { BadRequestError } from "../../lib/errors/bad-request";
import { ForbiddenError } from "../../lib/errors/forbidden";
import { saveFile, deleteFile } from "../../lib/file";
import { hashPassword, hashPasswordBulk } from "../../lib/password";
import { generateStudentPassword } from "../../lib/generate-password";
import { generateRollNumber, generateRollNumbers, syncRollNumberCounter } from "../../lib/roll-number";
import { PHONE_PATTERN, TEXT_LIMITS, USERNAME_PATTERN } from "../../lib/validation/text";
import * as XLSX from "xlsx";

const studentController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Apply auth to all routes
studentController.use("*", adminAuth);

function requireStudentManagementAccess(user: Record<string, any>): void {
  if (!["super_admin", "teacher"].includes(user.role)) {
    throw new ForbiddenError("Access denied. Only super admin and teachers can manage students");
  }
}

function isJsonRequest(contentType: string | undefined): boolean {
  return (contentType ?? "").toLowerCase().includes("application/json");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function hasStudentAssessments(db: any, studentId: string): Promise<boolean> {
  const [quiz] = await db
    .select({ id: institutionQuizAttempts.id })
    .from(institutionQuizAttempts)
    .where(eq(institutionQuizAttempts.studentId, studentId))
    .limit(1);

  if (quiz) return true;

  const [exam] = await db
    .select({ id: examinationCells.id })
    .from(examinationCells)
    .where(eq(examinationCells.studentId, studentId))
    .limit(1);

  return !!exam;
}

async function importStudentRecords(db: any, rows: any[]) {
  const now = nowISO();

  // Auto-generate roll numbers for any rows missing one or having just numeric values
  const isInvalidRoll = (val: any) => !val || /^\d+$/.test(String(val).trim());
  const rowsWithoutRoll = rows.filter((r) => isInvalidRoll(r.rollNumber));
  if (rowsWithoutRoll.length > 0) {
    const instId = rows[0]?.institutionId;
    if (instId) {
      const generatedRolls = await generateRollNumbers(db, instId, rowsWithoutRoll.length);
      let gIdx = 0;
      for (const r of rows) {
        if (isInvalidRoll(r.rollNumber)) {
          r.rollNumber = generatedRolls[gIdx++];
        }
      }
    }
  }

  const studentRecords: Record<string, any>[] = rows.map((studentData: any) => ({
    id: uuid(),
    name: studentData.name,
    rollNumber: studentData.rollNumber,
    admissionNumber: studentData.admissionNumber,
    email: studentData.email,
    username: studentData.username || null,
    password: undefined as string | undefined,
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
  }));

  // Hash passwords sequentially to stay within CF Workers CPU limit
  const passwordMap = new Map<string, { plain: string; hashed: string }>();
  const studentsNeedingPasswords = studentRecords.filter((s) => s.username);

  for (const s of studentsNeedingPasswords) {
    const plain = generateStudentPassword();
    const hashed = await hashPasswordBulk(plain);
    passwordMap.set(s.id, { plain, hashed });
  }

  for (const record of studentRecords) {
    const pw = passwordMap.get(record.id);
    if (pw) {
      record.password = pw.hashed;
      (record as any).plainPassword = pw.plain;
    }
  }

  // Bulk insert students in chunks (D1 limit: 100 vars/query; ~21 cols/student → 4/batch)
  const studentChunks = chunk(studentRecords, 4);
  for (const chunk of studentChunks) {
    const values = chunk.map((s) => ({
      id: s.id,
      name: s.name,
      rollNumber: s.rollNumber,
      admissionNumber: s.admissionNumber,
      email: s.email,
      username: s.username,
      password: s.password || null,
      plainPassword: (s as any).plainPassword ?? null,
      mobileNumber: s.mobileNumber,
      parentName: s.parentName,
      parentMobile: s.parentMobile,
      parentEmail: s.parentEmail,
      dateOfBirth: s.dateOfBirth,
      gender: s.gender,
      address: s.address,
      admissionDate: s.admissionDate,
      classId: s.classId,
      institutionId: s.institutionId,
      profileImage: s.profileImage,
      isActive: s.isActive,
      isDeleted: s.isDeleted,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    await db.insert(students).values(values);
  }

  // Bulk insert junction entries in chunks
  const junctionChunks = chunk(
    studentRecords
      .filter((s) => s.classId)
      .map((s) => ({
        id: uuid(),
        classId: s.classId,
        studentId: s.id,
      })),
    30
  );

  for (const jc of junctionChunks) {
    await db.insert(classStudentIds).values(jc);
  }

  // Attach plain passwords for response
  return studentRecords.map((s) => {
    const pw = passwordMap.get(s.id);
    return pw ? { ...s, password: pw.plain } : s;
  });
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
  requireStudentManagementAccess(user);
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

  // Auto-generate roll number if not provided
  if (!body.rollNumber) {
    body.rollNumber = await generateRollNumber(db, classData.institutionId) ?? undefined;
  }

  // Handle password: use provided or generate random
  let plainPassword: string | null = null;
  let hashedPw: string | null = null;
  if (body.password) {
    plainPassword = body.password as string;
    hashedPw = await hashPassword(plainPassword);
  } else if (body.username) {
    // If username provided but no password, generate one
    plainPassword = generateStudentPassword();
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
      plainPassword,
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
  requireStudentManagementAccess(user);
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

  const inFileDuplicates: any[] = [];
  const dbDuplicates: any[] = [];

  if (validData.length > 0) {
    // 1. Check for duplicates WITHIN the file
    const seenInFile = new Map<string, number>();

    for (const student of validData) {
      const key = `${student.name.trim().toLowerCase()}-${student.classId}`;
      if (seenInFile.has(key)) {
        inFileDuplicates.push(student);
      } else {
        seenInFile.set(key, student._rowNumber);
      }
    }

    // 2. Check for duplicates AGAINST DATABASE (batched IN queries)
    const studentNames = [...new Set(validData.map((s) => s.name))];

    let existingStudents: any[] = [];
    if (studentNames.length > 0) {
      const nameChunks = chunk(studentNames, 95);
      for (const nc of nameChunks) {
        const matches = await db
          .select()
          .from(students)
          .where(
            and(
              eq(students.institutionId, institutionId),
              inArray(students.name, nc),
              eq(students.isDeleted, 0)
            )
          );
        existingStudents.push(...matches);
      }
    }

    const existingKeySet = new Set(
      existingStudents.map(
        (s) => `${(s.name || "").toLowerCase()}-${s.classId}`
      )
    );

    for (const student of validData) {
      const key = `${student.name.toLowerCase()}-${student.classId}`;
      if (existingKeySet.has(key)) {
        dbDuplicates.push(student);
      }
    }
  }

  result.validRows = validData.length;

  // Auto-generate roll numbers for all valid students without one
  const studentsWithoutRollNumber = validData.filter((s: any) => !s.rollNumber);
  if (studentsWithoutRollNumber.length > 0) {
    const rollNumbers = await generateRollNumbers(db, institutionId, studentsWithoutRollNumber.length);
    let rnIdx = 0;
    for (const s of validData) {
      if (!s.rollNumber) {
        s.rollNumber = rollNumbers[rnIdx++];
      }
    }
  }

  if (!result.success || validData.length === 0) {
    return c.json(
      {
        success: false,
        message: "No valid data to import",
        errors: result.errors,
        summary: {
          totalRows: result.totalRows,
          validRows: 0,
          errorRows: result.errors.length,
        },
      },
      200
    );
  }

  // If there are duplicates, return preview without importing
  const hasDuplicates = inFileDuplicates.length > 0 || dbDuplicates.length > 0;
  if (hasDuplicates) {
    return c.json(
      {
        success: true,
        preview: true,
        rows: validData,
        duplicates: {
          inFile: inFileDuplicates.map((s) => s._rowNumber),
          inDatabase: dbDuplicates.map((s) => s._rowNumber),
        },
        errors: result.errors,
        summary: {
          totalRows: result.totalRows,
          validRows: validData.length,
          duplicateRows: new Set([...inFileDuplicates, ...dbDuplicates].map((s) => s._rowNumber)).size,
          errorRows: result.errors.length,
        },
      },
      200
    );
  }

  const insertedStudents = await importStudentRecords(db, validData as any[]);

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

// ─── BULK UPLOAD Commit (confirm duplicate selections) ─
studentController.post("/bulk-upload/commit", async (c) => {
  const user = c.get("user") as Record<string, any>;
  requireStudentManagementAccess(user);
  const db = getDb(c.env.DB);

  const body = await c.req.json<{
    institutionId: string;
    selectedRowIds: number[];
    rows: any[];
  }>();

  const { institutionId, selectedRowIds, rows } = body;

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

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new BadRequestError("No rows to import");
  }

  if (!selectedRowIds || !Array.isArray(selectedRowIds) || selectedRowIds.length === 0) {
    throw new BadRequestError("No rows selected");
  }

  const selectedSet = new Set(selectedRowIds);
  const toImport = rows.filter((r) => selectedSet.has(r._rowNumber));

  if (toImport.length === 0) {
    throw new BadRequestError("No matching rows found for the selected IDs");
  }

  const insertedStudents = await importStudentRecords(db, toImport);

  return c.json(
    {
      success: true,
      message: `Successfully imported ${insertedStudents.length} students`,
      data: insertedStudents,
    },
    201
  );
});

// ─── BULK UPDATE Roll Numbers ──────────────────────
studentController.post("/bulk-update-roll-numbers", async (c) => {
  const user = c.get("user") as Record<string, any>;
  requireStudentManagementAccess(user);
  const db = getDb(c.env.DB);

  const formData = await c.req.formData();
  const institutionId = formData.get("institutionId") as string;
  const file = formData.get("file") as File | null;

  const [inst] = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)))
    .limit(1);

  if (!inst) throw new BadRequestError("Institution not found");
  if (user.role !== "super_admin" && inst.id !== user.institutionId) throw new ForbiddenError("Access denied");
  if (!file) throw new BadRequestError("Excel file is required");

  const allClasses = await db
    .select()
    .from(classes)
    .where(and(eq(classes.institutionId, institutionId), eq(classes.isDeleted, 0)));

  const classMap = new Map<string, { id: string; grade: string | null; section: string }>();
  allClasses.forEach((cls) => {
    const key = `${cls.grade || ""}-${cls.section}`.toUpperCase();
    classMap.set(key, { id: cls.id, grade: cls.grade, section: cls.section });
  });

  const fileBuffer = new Uint8Array(await file.arrayBuffer());
  const workbook = XLSX.read(fileBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];

  const matched: any[] = [];
  const notFound: { row: number; name: string; grade: string; section: string; rollNumber: string }[] = [];
  const ambiguous: { row: number; name: string; grade: string; section: string; rollNumber: string; matches: { id: string; name: string; rollNumber: string | null }[] }[] = [];

  let rowIndex = 0;
  for (const r of jsonRows) {
    rowIndex++;
    const name = (r.name || "").trim();
    const grade = (r.grade || "").toString().trim();
    const section = (r.section || "").toString().trim();
    const rollNumber = (r.roll_number !== undefined ? String(r.roll_number).trim() : r.rollNumber ? String(r.rollNumber).trim() : "");

    if (!name || !grade || !section) continue;
    if (/^(GRADE|CLASS|SI\.NO|SL\.NO|STUDENT\s+NAME|ROLL\s+NUMBER)\b/i.test(name)) continue;

    const classKey = `${grade}-${section}`.toUpperCase();
    const cls = classMap.get(classKey);
    if (!cls) {
      notFound.push({ row: rowIndex, name, grade, section, rollNumber });
      continue;
    }

    const existingStudents = await db
      .select({ id: students.id, name: students.name, rollNumber: students.rollNumber })
      .from(students)
      .where(
        and(
          eq(students.institutionId, institutionId),
          eq(students.classId, cls.id),
          eq(students.name, name),
          eq(students.isDeleted, 0)
        )
      )
      .limit(10) as unknown as { id: string; name: string; rollNumber: string | null }[];

    if (existingStudents.length === 0) {
      notFound.push({ row: rowIndex, name, grade, section, rollNumber });
    } else if (existingStudents.length === 1) {
      matched.push({ studentId: existingStudents[0].id, rollNumber, row: rowIndex, name, grade, section });
    } else {
      ambiguous.push({ row: rowIndex, name, grade, section, rollNumber, matches: existingStudents });
    }
  }

  if (notFound.length === 0 && ambiguous.length === 0) {
    for (const m of matched) {
      await db
        .update(students)
        .set({ rollNumber: m.rollNumber || null, updatedAt: nowISO() })
        .where(eq(students.id, m.studentId));
    }

    await syncRollNumberCounter(db, institutionId);

    return c.json({
      success: true,
      message: `Updated roll numbers for ${matched.length} student(s)`,
      data: { updated: matched.length },
    }, 200);
  }

  return c.json({
    success: true,
    preview: true,
    matched,
    notFound,
    ambiguous,
    summary: {
      matched: matched.length,
      notFound: notFound.length,
      ambiguous: ambiguous.length,
    },
  }, 200);
});

// ─── BULK UPDATE Roll Numbers Confirm ──────────────
studentController.post("/bulk-update-roll-numbers/commit", async (c) => {
  const user = c.get("user") as Record<string, any>;
  requireStudentManagementAccess(user);
  const db = getDb(c.env.DB);

  const body = await c.req.json<{
    institutionId: string;
    matched: { studentId: string; rollNumber: string }[];
    addNotFound: { name: string; grade: string; section: string; rollNumber: string }[];
    resolveAmbiguous: { studentId: string; rollNumber: string }[];
  }>();

  const { institutionId, matched, addNotFound, resolveAmbiguous } = body;

  const [inst] = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)))
    .limit(1);

  if (!inst) throw new BadRequestError("Institution not found");
  if (user.role !== "super_admin" && inst.id !== user.institutionId) throw new ForbiddenError("Access denied");

  let updatedCount = 0;
  let addedCount = 0;

  if (matched) {
    for (const m of matched) {
      await db
        .update(students)
        .set({ rollNumber: m.rollNumber || null, updatedAt: nowISO() })
        .where(eq(students.id, m.studentId));
      updatedCount++;
    }
  }

  if (resolveAmbiguous) {
    for (const a of resolveAmbiguous) {
      await db
        .update(students)
        .set({ rollNumber: a.rollNumber || null, updatedAt: nowISO() })
        .where(eq(students.id, a.studentId));
      updatedCount++;
    }
  }

  if (addNotFound && addNotFound.length > 0) {
    const rowsWithoutRoll = addNotFound.filter((s: any) => !s.rollNumber);
    if (rowsWithoutRoll.length > 0) {
      const generatedRolls = await generateRollNumbers(db, institutionId, rowsWithoutRoll.length);
      let gIdx = 0;
      for (const s of addNotFound) {
        if (!s.rollNumber) {
          s.rollNumber = generatedRolls[gIdx++];
        }
      }
    }

    const allClasses = await db
      .select()
      .from(classes)
      .where(and(eq(classes.institutionId, institutionId), eq(classes.isDeleted, 0)));

    const classMap = new Map<string, string>();
    allClasses.forEach((cls) => {
      const key = `${cls.grade || ""}-${cls.section}`.toUpperCase();
      classMap.set(key, cls.id);
    });

    const now = nowISO();
    const newStudents = addNotFound.map((s) => {
      const classKey = `${s.grade}-${s.section}`.toUpperCase();
      const classId = classMap.get(classKey) || "";
      return {
        id: uuid(),
        name: s.name,
        rollNumber: s.rollNumber || null,
        classId,
        institutionId,
        isActive: 1,
        isDeleted: 0,
        createdAt: now,
        updatedAt: now,
      };
    });

    for (const ns of newStudents) {
      await db.insert(students).values(ns);
      if (ns.classId) {
        await db.insert(classStudentIds).values({ id: uuid(), classId: ns.classId, studentId: ns.id });
      }
      addedCount++;
    }
  }

  await syncRollNumberCounter(db, institutionId);

  return c.json({
    success: true,
    message: `Updated ${updatedCount} student(s), added ${addedCount} new student(s)`,
    data: { updated: updatedCount, added: addedCount },
  }, 200);
});

// ─── GET Roll Numbers Update Template ──────────────
studentController.get("/bulk-update-roll-numbers/template", async (c) => {
  const user = c.get("user") as Record<string, any>;
  const db = getDb(c.env.DB);
  const institutionId = c.req.query("institutionId");

  if (!institutionId) throw new BadRequestError("institutionId is required");

  const [inst] = await db
    .select({ id: institutions.id, name: institutions.name })
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.isDeleted, 0)))
    .limit(1);

  if (!inst) throw new BadRequestError("Institution not found");

  const studentRows = await db
    .select({
      id: students.id,
      name: students.name,
      grade: classes.grade,
      section: classes.section,
      rollNumber: students.rollNumber,
      classId: students.classId,
    })
    .from(students)
    .leftJoin(classes, eq(students.classId, classes.id))
    .where(
      and(
        eq(students.institutionId, institutionId),
        eq(students.isDeleted, 0),
      )
    )
    .orderBy(classes.grade, classes.section, students.name);

  const headers = ["current_roll_number", "name", "grade", "section", "new_roll_number", "id"];
  const rows = studentRows.map((s) => ({
    current_roll_number: s.rollNumber || "",
    name: s.name || "",
    grade: s.grade || "",
    section: s.section || "",
    new_roll_number: "",
    id: s.id,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 40 },
  ];

  // Reorder columns to match headers order
  XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="update_roll_numbers_template.xlsx"',
    },
  });
});

// ─── GET Excel Template ────────────────────────────
studentController.get("/template", async (c) => {
  const headers = [
    "roll number",
    "name",
    "grade",
    "section",
    "gender",
  ];

  const sampleData = [
    {
      "roll number": "001",
      name: "Jane Smith",
      grade: "10",
      section: "A",
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
    _id: s.id,
    rollNumber: s.rollNumber || s.username || "",
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
  requireStudentManagementAccess(user);
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

  const hasAssessments = await hasStudentAssessments(db, id);
  if (hasAssessments) {
    throw new BadRequestError(
      "Cannot edit student: this student has existing quiz attempts or examination records."
    );
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
  requireStudentManagementAccess(user);
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

  const hasAssessments = await hasStudentAssessments(db, id);
  if (hasAssessments) {
    throw new BadRequestError(
      "Cannot delete student: this student has existing quiz attempts or examination records."
    );
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

// ─── BULK DELETE Students ──────────────────────────
studentController.post("/bulk-delete", async (c) => {
  const user = c.get("user") as Record<string, any>;
  requireStudentManagementAccess(user);
  const db = getDb(c.env.DB);

  const body = await c.req.json<{ ids: string[] }>();
  const { ids } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new BadRequestError("No student IDs provided");
  }

  // Fetch all students
  const studentsToDelete = await db
    .select()
    .from(students)
    .where(and(inArray(students.id, ids), eq(students.isDeleted, 0)));

  if (studentsToDelete.length === 0) {
    throw new BadRequestError("No students found");
  }

  // Verify access
  for (const s of studentsToDelete) {
    if (user.role !== "super_admin" && s.institutionId !== user.institutionId) {
      throw new ForbiddenError("Access denied to one or more students");
    }
  }

  // Check assessments for ALL students
  const blocked: { id: string; name: string }[] = [];
  const allowed: string[] = [];

  for (const s of studentsToDelete) {
    const hasAssessments = await hasStudentAssessments(db, s.id);
    if (hasAssessments) {
      blocked.push({ id: s.id, name: s.name ?? "Unknown" });
    } else {
      allowed.push(s.id);
    }
  }

  if (allowed.length > 0) {
    const now = nowISO();
    await db
      .update(students)
      .set({ isDeleted: 1, isActive: 0, updatedAt: now })
      .where(inArray(students.id, allowed));

    // Remove from class junctions
    for (const sid of allowed) {
      await db
        .delete(classStudentIds)
        .where(eq(classStudentIds.studentId, sid));
    }
  }

  return c.json({
    success: true,
    message: allowed.length > 0
      ? `Deleted ${allowed.length} student(s)`
      : "No students were deleted",
    data: { deleted: allowed.length, blocked: blocked.length },
    blocked,
  }, 200);
});

// ─── Backfill Admission Numbers (school roll no, per class/section) ─
studentController.post("/backfill-admission-numbers", async (c) => {
  const user = c.get("user") as Record<string, any>;
  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super admin can backfill admission numbers");
  }

  const db = getDb(c.env.DB);
  const institutionId = c.req.query("institutionId") || null;

  const classConditions: any[] = [eq(classes.isDeleted, 0)];
  if (institutionId) classConditions.push(eq(classes.institutionId, institutionId));

  const allClasses = await db
    .select({ id: classes.id, grade: classes.grade, section: classes.section, institutionId: classes.institutionId })
    .from(classes)
    .where(and(...classConditions))
    .orderBy(classes.institutionId, classes.grade, classes.section);

  if (allClasses.length === 0) {
    throw new BadRequestError("No classes found");
  }

  const results: { classId: string; grade: string | null; section: string; backfilled: number }[] = [];

  for (const cls of allClasses) {
    const studentsWithoutAdmission = await db
      .select({ id: students.id, name: students.name })
      .from(students)
      .where(
        and(
          eq(students.classId, cls.id),
          eq(students.isDeleted, 0),
          sql`(${students.admissionNumber} IS NULL OR ${students.admissionNumber} = '')`,
        ),
      )
      .orderBy(students.name);

    if (studentsWithoutAdmission.length === 0) continue;

    const updates: ReturnType<ReturnType<typeof getDb>["update"]>[] = [];
    let count = 0;
    const now = nowISO();
    for (const s of studentsWithoutAdmission) {
      count++;
      updates.push(
        db
          .update(students)
          .set({ admissionNumber: String(count), updatedAt: now })
          .where(eq(students.id, s.id)) as any
      );
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const chunk = updates.slice(i, i + BATCH_SIZE);
      if (chunk.length === 1) {
        await chunk[0];
      } else {
        await db.batch(chunk as any);
      }
    }

    results.push({ classId: cls.id, grade: cls.grade, section: cls.section, backfilled: count });
  }

  const total = results.reduce((sum, r) => sum + r.backfilled, 0);
  return c.json({
    success: true,
    message: `Backfilled admission numbers for ${total} student(s) across ${results.length} class(es)`,
    data: results,
  });
});

// ─── Backfill Roll Numbers (super_admin only) ──────
studentController.post("/backfill-roll-numbers", async (c) => {
  const user = c.get("user") as Record<string, any>;

  if (user.role !== "super_admin") {
    throw new ForbiddenError("Only super admin can backfill roll numbers");
  }

  const db = getDb(c.env.DB);

  const allInstitutions = await db
    .select({ id: institutions.id, name: institutions.name })
    .from(institutions)
    .where(eq(institutions.isDeleted, 0));

  const results: { institution: string; backfilled: number }[] = [];

  for (const inst of allInstitutions) {
    await syncRollNumberCounter(db, inst.id);

    const studentsWithoutRoll = await db
      .select({ id: students.id })
      .from(students)
      .where(
        and(
          eq(students.institutionId, inst.id),
          eq(students.isDeleted, 0),
          sql`${students.rollNumber} IS NULL`,
        ),
      );

    if (studentsWithoutRoll.length === 0) continue;

    const rollNumbers = await generateRollNumbers(db, inst.id, studentsWithoutRoll.length);
    const updates: ReturnType<ReturnType<typeof getDb>["update"]>[] = [];
    const now = nowISO();

    for (let i = 0; i < studentsWithoutRoll.length; i++) {
      updates.push(
        db
          .update(students)
          .set({ rollNumber: rollNumbers[i], updatedAt: now })
          .where(eq(students.id, studentsWithoutRoll[i].id)) as any
      );
    }

    const BATCH_SIZE = 50;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const chunk = updates.slice(i, i + BATCH_SIZE);
      if (chunk.length === 1) {
        await chunk[0];
      } else {
        await db.batch(chunk as any);
      }
    }

    results.push({ institution: inst.name, backfilled: studentsWithoutRoll.length });
  }

  return c.json({ success: true, data: results });
});

export { studentController };
