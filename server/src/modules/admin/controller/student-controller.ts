// controllers/student.controller.ts
import { BadRequestError } from "@/lib/shared/bad-request";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { ClassModel } from "@/schema/admin/class-model";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { StudentModel } from "@/schema/admin/student-model";
import Elysia, { t } from "elysia";
import { Types } from "mongoose";
import { adminAuthMacro } from "../admin-macro";
import { parseExcelFile, generateExcelTemplate } from "@/lib/excel-parser";
import * as XLSX from "xlsx";

export const studentController = new Elysia({
  prefix: "/students",
  tags: ["Students"],
})
  .use(adminAuthMacro)

  // CREATE Single Student
  .post(
    "/",
    async ({ body, set, user }) => {
      // Verify class exists
      const classData = await ClassModel.findById(body.classId);
      if (!classData || classData.isDeleted)
        throw new BadRequestError("Class not found");
      
      if (!classData.isActive)
        throw new BadRequestError("Cannot add student to an inactive class");

      const institutionId = classData.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      const student = new StudentModel({
        ...body,
        institutionId: classData.institutionId,
      });
      await student.save();

      // Add to class.studentIds
      await ClassModel.findByIdAndUpdate(body.classId, {
        $addToSet: { studentIds: student._id },
      });

      set.status = 201;
      return { success: true, data: student };
    },
    {
      isAuth: true,
      body: t.Object({
        name: t.String({ maxLength: 100 }),
        rollNumber: t.Optional(t.String({ maxLength: 50 })),
        admissionNumber: t.Optional(t.String({ maxLength: 50 })),
        email: t.Optional(t.String({ format: "email" })),
        mobileNumber: t.Optional(t.String({ maxLength: 15 })),
        parentName: t.String({ maxLength: 100 }),
        parentMobile: t.String({ maxLength: 15 }),
        parentEmail: t.Optional(t.String({ format: "email" })),
        dateOfBirth: t.Optional(t.String()),
        gender: t.Optional(t.Union([t.Literal("male"), t.Literal("female"), t.Literal("other")])),
        address: t.Optional(t.String({ maxLength: 500 })),
        admissionDate: t.Optional(t.String()),
        profileImage: t.Optional(t.String()),
        classId: t.String(),
      }),
    }
  )

  // BULK UPLOAD Students from Excel
  .post(
    "/bulk-upload",
    async ({ body, set, user }) => {
      const inst = await InstitutionModel.findById(body.institutionId);
      if (!inst || inst.isDeleted)
        throw new BadRequestError("Institution not found");

      const institutionId = (inst as any)._id as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      if (!body.file) {
        throw new BadRequestError("Excel file is required");
      }

      // Pre-fetch all classes for this institution to minimize DB lookups
      const classes = await ClassModel.find({ institutionId, isDeleted: false });
      const classMap = new Map<string, string>(); // Key: "grade-section", Value: classId
      classes.forEach((c) => {
        const key = `${c.grade || ""}-${c.section}`.toUpperCase();
        classMap.set(key, c._id.toString());
      });

      // Parse Excel file
      const fileBuffer = Buffer.from(await body.file.arrayBuffer());

      const result = parseExcelFile(
        fileBuffer,
        (row, rowIndex) => {
          const errors: string[] = [];

          // Validate class info
          let classId = body.classId;
          if (!classId) {
            // Try to find class from Grade/Section columns
            if (!row.section) {
               errors.push("Section is required (or select a default Class)");
            } else {
               const key = `${row.grade || ""}-${row.section}`.trim().toUpperCase();
               if (classMap.has(key)) {
                 const clsId = classMap.get(key)!;
                 // We need to check if this class is active.
                 // We need access to the full class object or a separate map for status.
                 // For efficiency, let's look it up in the 'classes' array we fetched.
                 const cls = classes.find(c => c._id.toString() === clsId);
                 if (cls && !cls.isActive) {
                    errors.push(`Class ${row.grade}-${row.section} is inactive.`);
                 } else {
                    classId = clsId;
                 }
               } else {
                 errors.push(`Class not found for Grade: ${row.grade}, Section: ${row.section}. Create the class first.`);
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
          if (row.gender && !["male", "female", "other"].includes(row.gender.toLowerCase())) {
            errors.push("Gender must be male, female, or other");
          }

          if (errors.length > 0) {
            return { isValid: false, errors };
          }



          // We can check strictly for duplicates within the current batch being processed by using a Map/Set in the outer scope, 
          // but parseExcelFile might process in chunks or parallel depending on implementation. 
          // Safest to check for duplicates in the post-processing step (after parsing is done).
          // Removing the invalid 'result.data' access here.


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
              dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : undefined,
              gender: row.gender?.toLowerCase(),
              address: row.address?.trim(),
              admissionDate: row.admissionDate ? new Date(row.admissionDate) : new Date(),
              classId: classId,
              institutionId: institutionId,
            },
          };
        },
        ["name", "parentName", "parentMobile"]
      );

      // --- NEW DUPLICATION CHECK (IN-FILE & DB) ---
      const validData = result.data;
      if (validData.length > 0) {
        // 1. Check for duplicates WITHIN the file first
        const uniqueDataInFile: any[] = [];
        const seenInFile = new Set<string>();
        
        validData.forEach((student, index) => {
            // Key: Name-ParentName-ClassId
            const key = `${student.name.trim().toLowerCase()}-${student.parentName.trim().toLowerCase()}-${student.classId}`;
            if (seenInFile.has(key)) {
                result.errors.push({
                   row: index + 2, // simplified row number estimate
                   errors: [`Duplicate entry in this file: Student '${student.name}' with parent '${student.parentName}' appears multiple times.`]
                });
            } else {
                seenInFile.add(key);
                uniqueDataInFile.push(student);
            }
        });

        // 2. Check for duplicates AGAINST DATABASE
        const studentNames = uniqueDataInFile.map(s => s.name);
        const existingStudents = await StudentModel.find({
            institutionId,
            name: { $in: studentNames },
            isDeleted: false
        });

        const finalUniqueData: any[] = [];
        
        uniqueDataInFile.forEach((newStudent, index) => {
            const isDuplicate = existingStudents.some(existing => 
                existing.name.toLowerCase() === newStudent.name.toLowerCase() &&
                existing.parentName.toLowerCase() === newStudent.parentName.toLowerCase() &&
                existing.classId.toString() === newStudent.classId
            );

            if (isDuplicate) {
                 result.errors.push({
                   row: index + 2, // simplified estimate, note: might drift if file had invalid rows above
                   errors: [`Student '${newStudent.name}' with parent '${newStudent.parentName}' already exists in this class.`]
                 });
            } else {
                finalUniqueData.push(newStudent);
            }
        });
        
        // Update the result data
        result.data = finalUniqueData;
        result.validRows = finalUniqueData.length;
      }
      // ---------------------------------------------

      if (!result.success || result.data.length === 0) {
        return {
          success: false,
          message: "No valid data to import",
          errors: result.errors,
          summary: {
            totalRows: result.totalRows,
            validRows: result.validRows,
            errorRows: result.errors.length,
          },
        };
      }

      // Insert valid students
      const insertedStudents = await StudentModel.insertMany(result.data);

      // Update studentIds in Classes
      // We need to group students by classId
      const studentsByClass: Record<string, Types.ObjectId[]> = {};
      insertedStudents.forEach((s: any) => {
          if (s.classId) {
            const cId = s.classId.toString();
            if(!studentsByClass[cId]) studentsByClass[cId] = [];
            studentsByClass[cId].push(s._id);
          }
      });

      // Perform updates
      await Promise.all(
          Object.entries(studentsByClass).map(([cId, sIds]) => 
              ClassModel.findByIdAndUpdate(cId, {
                  $addToSet: { studentIds: { $each: sIds } }
              })
          )
      );

      set.status = 201;
      return {
        success: true,
        message: `Successfully imported ${insertedStudents.length} students`,
        data: insertedStudents,
        errors: result.errors,
        summary: {
          totalRows: result.totalRows,
          validRows: result.validRows,
          errorRows: result.errors.length,
        },
      };
    },
    {
      isAuth: true,
      body: t.Object({
        institutionId: t.String(),
        classId: t.Optional(t.String()),
        file: t.File(),
      }),
    }
  )

  // GET Excel Template
  .get("/template", async ({ set }) => {
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

    set.headers = {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="students_template.xlsx"',
    };

    return buffer;
  })

  // POST Generate Error Report (Excel)
  .post("/error-report", async ({ body, set }) => {
     const errors = body.errors;
     if (!errors || !Array.isArray(errors)) {
       throw new BadRequestError("Invalid errors data");
     }

     // Transform errors to flat format for Excel
     const rows = errors.map(e => ({
       "Row Number": e.row,
       "Error Details": Array.isArray(e.errors) ? e.errors.join(", ") : e.errors
     }));

     const worksheet = XLSX.utils.json_to_sheet(rows);
     
     // Set column widths
     worksheet['!cols'] = [{ wch: 10 }, { wch: 100 }];

     const workbook = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(workbook, worksheet, "Errors");

     const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

     set.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
     set.headers["Content-Disposition"] = 'attachment; filename="import_errors.xlsx"';

     return buffer;
  }, {
    body: t.Object({
       errors: t.Array(t.Any())
    })
  })

  // GET All Students
  .get(
    "/",
    async ({ query, user, set }) => {
      const filter: any = { isDeleted: false };

      // Filter by class (required for students)
      if (query.classId) {
        filter.classId = query.classId;
      }

      // Filter by institution
      if (query.institutionId) {
        filter.institutionId = query.institutionId;
      } else if (user.role !== "super_admin") {
        filter.institutionId = user.institutionId;
      }

      // Search
      if (query.search) {
        const searchRegex = new RegExp(query.search, "i");
        filter.$or = [
          { name: searchRegex },
          { rollNumber: searchRegex },
          { admissionNumber: searchRegex },
          { parentName: searchRegex },
          { parentMobile: searchRegex },
        ];
      }

      const students = await StudentModel.find(filter)
        .populate("classId", "grade section year")
        .populate("institutionId", "name type")
        .sort({ rollNumber: 1, name: 1 });

      return { success: true, data: students };
    },
    {
      isAuth: true,
      query: t.Object({
        classId: t.Optional(t.String()),
        institutionId: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    }
  )

  // GET Single Student
  .get(
    "/:id",
    async ({ params, user, set }) => {
      const student = await StudentModel.findOne({
        _id: params.id,
        isDeleted: false,
      })
        .populate("classId", "grade section year")
        .populate("institutionId", "name type");

      if (!student) throw new BadRequestError("Student not found");

      const institutionId = student.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      return { success: true, data: student };
    },
    {
      isAuth: true,
      params: t.Object({ id: t.String() }),
    }
  )

  // UPDATE Student
  .patch(
    "/:id",
    async ({ params, body, user, set }) => {
      const student = await StudentModel.findById(params.id);
      if (!student || student.isDeleted)
        throw new BadRequestError("Student not found");

      const institutionId = student.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      // If changing class, update both old and new class
      if (body.classId && body.classId !== student.classId.toString()) {
        // Remove from old class
        await ClassModel.findByIdAndUpdate(student.classId, {
          $pull: { studentIds: student._id },
        });

        // Add to new class
        await ClassModel.findByIdAndUpdate(body.classId, {
          $addToSet: { studentIds: student._id },
        });
      }

      const updated = await StudentModel.findByIdAndUpdate(
        params.id,
        { $set: body },
        { new: true, runValidators: true }
      );

      set.status = 200;
      return { success: true, data: updated };
    },
    {
      isAuth: true,
      params: t.Object({ id: t.String() }),
      body: t.Partial(
        t.Object({
          name: t.String({ maxLength: 100 }),
          rollNumber: t.String({ maxLength: 50 }),
          admissionNumber: t.String({ maxLength: 50 }),
          email: t.String({ format: "email" }),
          mobileNumber: t.String({ maxLength: 15 }),
          parentName: t.String({ maxLength: 100 }),
          parentMobile: t.String({ maxLength: 15 }),
          parentEmail: t.String({ format: "email" }),
          dateOfBirth: t.String(),
          gender: t.String(),
          address: t.String({ maxLength: 500 }),
          profileImage: t.String(),
          classId: t.String(),
          isActive: t.Boolean(),
        })
      ),
    }
  )

  // DELETE Student (Soft Delete)
  .delete(
    "/:id",
    async ({ params, user, set }) => {
      const student = await StudentModel.findById(params.id);
      if (!student || student.isDeleted)
        throw new BadRequestError("Student not found");

      const institutionId = student.institutionId as Types.ObjectId;

      if (
        user.role !== "super_admin" &&
        institutionId.toString() !== user.institutionId?.toString()
      ) {
        throw new ForbiddenError("Access denied");
      }

      await StudentModel.findByIdAndUpdate(params.id, {
        isDeleted: true,
        isActive: false,
      });

      // Remove from class
      await ClassModel.findByIdAndUpdate(student.classId, {
        $pull: { studentIds: params.id },
      });

      set.status = 200;
      return { success: true, message: "Student deleted successfully" };
    },
    {
      isAuth: true,
      params: t.Object({ id: t.String() }),
    }
  );