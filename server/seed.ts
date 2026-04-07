/**
 * Seed script for Chavara School dummy data.
 * Run: cd server && bun run seed.ts
 */
import mongoose from "mongoose";
import { InstitutionModel } from "./src/schema/admin/institution-model";
import { AdminModel } from "./src/schema/admin/admin-model";
import { StaffModel } from "./src/schema/admin/staff-model";
import { StudentModel } from "./src/schema/admin/student-model";
import { ClassModel } from "./src/schema/admin/class-model";
import { CurriculumModel } from "./src/schema/books/curriculam-model";
import { GradeBookModel } from "./src/schema/books/gradeBook-model";
import { ChapterModel } from "./src/schema/books/chapter-model";
import { ChapterContentModel } from "./src/schema/books/chapterContent-model";
import { TeachingProgressModel } from "./src/schema/staff/teaching-progress-model";
import { ClassSessionModel } from "./src/schema/staff/class-session-model";
import { AcademicYearModel } from "./src/schema/admin/academic-year-model";

const MONGO_URI = "mongodb+srv://stainsrubus:Stains2001@cluster0.ogeipvb.mongodb.net/";

async function seed() {
  await mongoose.connect(MONGO_URI, { dbName: "LMS" });
  console.log("Connected to MongoDB");

  // ─── 1. Institution ───
  let institution = await InstitutionModel.findOne({ name: "Chavara School" });
  if (!institution) {
    institution = await InstitutionModel.create({
      name: "Chavara School",
      type: "school",
      address: "123 Education Lane, Kochi, Kerala - 682001",
      contactDetails: {
        inchargePerson: "Fr. Thomas Mathew",
        mobileNumber: "9876543210",
        email: "admin@chavaraschool.edu.in",
        officePhone: "0484-2345678",
      },
      isActive: true,
    });
    console.log("Created institution:", institution.name);
  } else {
    console.log("Institution already exists:", institution.name);
  }
  const instId = institution._id;

  // ─── 2. Admin user ───
  let admin = await AdminModel.findOne({ email: "admin@chavaraschool.edu.in" });
  if (!admin) {
    admin = await AdminModel.create({
      email: "admin@chavaraschool.edu.in",
      password: "admin123",
      name: "Thomas Mathew",
      salutation: "Mr",
      role: "admin",
      institutionId: instId,
      mobileNumber: "9876543210",
      isActive: true,
    });
    console.log("Created admin:", admin.email);
  }
  // Link admin to institution
  await InstitutionModel.findByIdAndUpdate(instId, {
    $addToSet: { adminIds: admin._id },
  });

  // ─── 3. Academic Year ───
  let academicYear = await AcademicYearModel.findOne({ institutionId: instId, label: "2025-2026" });
  if (!academicYear) {
    academicYear = await AcademicYearModel.create({
      institutionId: instId,
      label: "2025-2026",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      isActive: true,
      terms: [
        { label: "Term 1", startDate: new Date("2025-04-01"), endDate: new Date("2025-09-30") },
        { label: "Term 2", startDate: new Date("2025-10-01"), endDate: new Date("2026-03-31") },
      ],
    });
    console.log("Created academic year:", academicYear.label);
  }

  // ─── 4. Teachers ───
  const teacherData = [
    { name: "Anjali Menon", salutation: "Mrs" as const, email: "anjali.menon@chavaraschool.edu.in", subjects: ["Mathematics", "Physics"] },
    { name: "Rajesh Kumar", salutation: "Mr" as const, email: "rajesh.kumar@chavaraschool.edu.in", subjects: ["English", "Social Studies"] },
    { name: "Priya Nair", salutation: "Ms" as const, email: "priya.nair@chavaraschool.edu.in", subjects: ["Science", "Biology"] },
    { name: "Deepak Sharma", salutation: "Mr" as const, email: "deepak.sharma@chavaraschool.edu.in", subjects: ["Hindi", "Sanskrit"] },
    { name: "Lakshmi Iyer", salutation: "Mrs" as const, email: "lakshmi.iyer@chavaraschool.edu.in", subjects: ["Computer Science"] },
    { name: "Suresh Pillai", salutation: "Mr" as const, email: "suresh.pillai@chavaraschool.edu.in", subjects: ["Physical Education"] },
  ];

  const teachers: any[] = [];
  for (const td of teacherData) {
    let staff = await StaffModel.findOne({ email: td.email });
    if (!staff) {
      staff = await StaffModel.create({
        name: td.name,
        salutation: td.salutation,
        email: td.email,
        mobileNumber: `98765${String(Math.floor(10000 + Math.random() * 90000))}`,
        password: "teacher123",
        type: "teacher",
        subjects: td.subjects,
        institutionId: instId,
        isActive: true,
        joiningDate: new Date(`2024-0${Math.floor(1 + Math.random() * 6)}-15`),
      });
      console.log("Created teacher:", staff.name);
    }
    teachers.push(staff);
    await InstitutionModel.findByIdAndUpdate(instId, {
      $addToSet: { staffIds: staff._id },
    });
  }

  // ─── 5. Classes (grades 6-10, sections A and B) ───
  const classData: Array<{ grade: string; section: string }> = [];
  for (let g = 6; g <= 10; g++) {
    classData.push({ grade: String(g), section: "A" });
    classData.push({ grade: String(g), section: "B" });
  }

  const classes: any[] = [];
  for (const cd of classData) {
    let cls = await ClassModel.findOne({
      grade: cd.grade,
      section: cd.section,
      institutionId: instId,
    });
    if (!cls) {
      // Assign 1-2 teachers per class
      const assignedTeachers = [
        teachers[Math.floor(Math.random() * teachers.length)]._id,
        teachers[Math.floor(Math.random() * teachers.length)]._id,
      ];
      cls = await ClassModel.create({
        grade: cd.grade,
        section: cd.section,
        year: "2025-2026",
        institutionId: instId,
        teacherIds: [...new Set(assignedTeachers)],
        isActive: true,
      });
      console.log(`Created class: ${cd.grade}-${cd.section}`);
    }
    classes.push(cls);
  }

  // Update teacher assignedClasses
  for (const teacher of teachers) {
    const assignedClasses = classes
      .filter((c) => c.teacherIds?.some((tid: any) => tid.toString() === teacher._id.toString()))
      .map((c) => c._id);
    await StaffModel.findByIdAndUpdate(teacher._id, {
      $set: { assignedClasses },
    });
  }

  // ─── 6. Students (15-25 per class) ───
  const firstNames = {
    male: ["Arjun", "Aditya", "Rahul", "Vivek", "Karthik", "Nikhil", "Sanjay", "Akash", "Rohan", "Varun", "Pranav", "Abhishek", "Dev", "Hari", "Mohan"],
    female: ["Meera", "Ananya", "Divya", "Kavya", "Shreya", "Pooja", "Neha", "Riya", "Sneha", "Ammu", "Lakshmi", "Aishwarya", "Devi", "Gayathri", "Nithya"],
  };
  const lastNames = ["Nair", "Menon", "Pillai", "Kumar", "Sharma", "Iyer", "Das", "Thomas", "George", "Joseph", "Varma", "Patel"];

  for (const cls of classes) {
    const existingCount = await StudentModel.countDocuments({ classId: cls._id, isDeleted: false });
    if (existingCount > 0) {
      console.log(`Class ${cls.grade}-${cls.section} already has ${existingCount} students`);
      continue;
    }

    const numStudents = 15 + Math.floor(Math.random() * 11); // 15-25
    const studentIds: any[] = [];

    for (let i = 0; i < numStudents; i++) {
      const gender = Math.random() > 0.45 ? "male" : "female";
      const fNames = firstNames[gender];
      const fName = fNames[Math.floor(Math.random() * fNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const monthOffset = Math.floor(Math.random() * 6);

      const student = await StudentModel.create({
        name: `${fName} ${lName}`,
        rollNumber: `CS${cls.grade}${cls.section}${String(i + 1).padStart(2, "0")}`,
        admissionNumber: `ADM-2025-${cls.grade}${cls.section}${String(i + 1).padStart(3, "0")}`,
        parentName: `Parent of ${fName}`,
        parentMobile: `98${String(Math.floor(10000000 + Math.random() * 90000000))}`,
        gender,
        dateOfBirth: new Date(2012 - Number(cls.grade) + 6, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)),
        classId: cls._id,
        institutionId: instId,
        isActive: true,
        admissionDate: new Date(2025, monthOffset, 1 + Math.floor(Math.random() * 28)),
        // Spread createdAt across months for chart data
        createdAt: new Date(2025, monthOffset, 1 + Math.floor(Math.random() * 28)),
      });
      studentIds.push(student._id);
    }

    await ClassModel.findByIdAndUpdate(cls._id, {
      $set: { studentIds },
    });
    console.log(`Created ${numStudents} students for class ${cls.grade}-${cls.section}`);
  }

  // ─── 7. Curriculums and Grade Books ───
  const curriculumData = [
    { name: "CBSE Mathematics", description: "Central Board Mathematics curriculum", grades: [6, 7, 8, 9, 10] },
    { name: "CBSE Science", description: "Central Board Science curriculum", grades: [6, 7, 8, 9, 10] },
    { name: "CBSE English", description: "Central Board English curriculum", grades: [6, 7, 8, 9, 10] },
  ];

  const gradeBooks: any[] = [];

  for (const cd of curriculumData) {
    let curriculum = await CurriculumModel.findOne({ name: cd.name });
    if (!curriculum) {
      curriculum = await CurriculumModel.create({
        name: cd.name,
        description: cd.description,
        tags: ["CBSE", "K-12"],
        level: ["Intermediate"],
        grades: cd.grades,
        isPublished: true,
      });
      console.log("Created curriculum:", curriculum.name);
    }

    // Create grade books for each grade
    for (const grade of cd.grades) {
      let gb = await GradeBookModel.findOne({ curriculumId: curriculum._id, grade });
      if (!gb) {
        gb = await GradeBookModel.create({
          curriculumId: curriculum._id,
          grade,
          bookTitle: `${cd.name.replace("CBSE ", "")} Grade ${grade}`,
          description: `${cd.name} for Grade ${grade}`,
          totalChapters: 8 + Math.floor(Math.random() * 5),
          isPublished: true,
        });
        console.log(`Created grade book: ${gb.bookTitle}`);
      }
      gradeBooks.push(gb);
    }

    // Add curriculum access to institution
    const currGradeBooks = gradeBooks
      .filter((gb) => gb.curriculumId.toString() === curriculum!._id.toString())
      .map((gb) => gb._id);

    await InstitutionModel.findByIdAndUpdate(instId, {
      $addToSet: {
        curriculumAccess: {
          curriculumId: curriculum._id,
          accessibleGradeBooks: currGradeBooks,
        },
      },
    });
  }

  // ─── 8. Chapters & Content for each GradeBook ───
  const contentTypes = ["video", "youtube", "ppt", "pdf", "quiz", "activity", "text", "note", "project"];

  for (const gb of gradeBooks) {
    const existingChapters = await ChapterModel.countDocuments({ gradeBookId: gb._id });
    if (existingChapters > 0) continue;

    const numChapters = gb.totalChapters || 8;
    for (let c = 1; c <= numChapters; c++) {
      const chapter = await ChapterModel.create({
        gradeBookId: gb._id,
        title: `Chapter ${c}: Topic ${c}`,
        chapterNumber: c,
        description: `Chapter ${c} of ${gb.bookTitle}`,
        durationMinutes: 30 + Math.floor(Math.random() * 30),
        order: c,
      });

      // 3-5 content items per chapter
      const numContent = 3 + Math.floor(Math.random() * 3);
      for (let ci = 1; ci <= numContent; ci++) {
        const type = contentTypes[Math.floor(Math.random() * contentTypes.length)];
        await ChapterContentModel.create({
          chapterId: chapter._id,
          type,
          title: `${type.charAt(0).toUpperCase() + type.slice(1)}: ${gb.bookTitle} Ch${c}.${ci}`,
          durationMinutes: 10 + Math.floor(Math.random() * 20),
          order: ci,
          textContent: type === "text" || type === "note" ? "Sample content for this lesson." : undefined,
        });
      }
    }
    console.log(`Created ${numChapters} chapters with content for ${gb.bookTitle}`);
  }

  // ─── 9. Teaching Progress (teachers progressing through grade books) ───
  for (const teacher of teachers) {
    const teacherClasses = classes.filter((c) =>
      c.teacherIds?.some((tid: any) => tid.toString() === teacher._id.toString())
    );

    for (const cls of teacherClasses) {
      // Find grade books matching this class grade
      const classGradeBooks = gradeBooks.filter((gb) => gb.grade === Number(cls.grade));

      for (const gb of classGradeBooks) {
        const existing = await TeachingProgressModel.findOne({
          staffId: teacher._id,
          classId: cls._id,
          gradeBookId: gb._id,
        });
        if (existing) continue;

        // Get all content for this grade book
        const chapters = await ChapterModel.find({ gradeBookId: gb._id });
        const allContent: any[] = [];
        for (const ch of chapters) {
          const contents = await ChapterContentModel.find({ chapterId: ch._id });
          allContent.push(...contents.map((c) => ({ contentId: c._id, chapterId: ch._id })));
        }

        // Random progress: 20-90%
        const progressPercent = 20 + Math.floor(Math.random() * 70);
        const completedCount = Math.floor((progressPercent / 100) * allContent.length);

        const contentProgress = allContent.map((item, idx) => ({
          contentId: item.contentId,
          chapterId: item.chapterId,
          isCompleted: idx < completedCount,
          completedAt: idx < completedCount ? new Date(2025, Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 28)) : undefined,
          lastAccessedAt: new Date(2025, Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 28)),
        }));

        try {
          await TeachingProgressModel.create({
            staffId: teacher._id,
            classId: cls._id,
            gradeBookId: gb._id,
            institutionId: instId,
            contentProgress,
            overallPercentage: progressPercent,
            lastAccessedAt: new Date(2026, 2 + Math.floor(Math.random() * 2), 1 + Math.floor(Math.random() * 28)),
          });
        } catch (e: any) {
          if (e.code === 11000) continue; // skip duplicates
          throw e;
        }
      }
    }
    console.log(`Created teaching progress for ${teacher.name}`);
  }

  // ─── 10. Class Sessions (spread over 6 months) ───
  const existingSessions = await ClassSessionModel.countDocuments({ institutionId: instId });
  if (existingSessions === 0) {
    const topics = [
      ["Algebra basics", "Linear equations"],
      ["Photosynthesis", "Cell division"],
      ["Grammar rules", "Essay writing"],
      ["Hindi kavya", "Sanskrit shloka"],
      ["HTML & CSS", "Python intro"],
      ["Warm-up exercises", "Team sports"],
      ["Trigonometry", "Geometry"],
      ["Chemical reactions", "Periodic table"],
      ["Poetry analysis", "Comprehension"],
      ["Programming logic", "Data structures"],
    ];

    for (let month = 0; month < 6; month++) {
      const sessionsThisMonth = 8 + Math.floor(Math.random() * 12); // 8-20 sessions
      for (let s = 0; s < sessionsThisMonth; s++) {
        const teacher = teachers[Math.floor(Math.random() * teachers.length)];
        const cls = classes[Math.floor(Math.random() * classes.length)];
        const day = 1 + Math.floor(Math.random() * 28);
        const hour = 8 + Math.floor(Math.random() * 6); // 8am - 2pm
        const duration = 30 + Math.floor(Math.random() * 30); // 30-60 min
        const startTime = new Date(2025, month, day, hour);
        const endTime = new Date(startTime.getTime() + duration * 60000);
        const topicSet = topics[Math.floor(Math.random() * topics.length)];

        await ClassSessionModel.create({
          staffId: teacher._id,
          institutionId: instId,
          classId: cls._id,
          startTime,
          endTime,
          durationMinutes: duration,
          topicsCovered: topicSet,
          status: "completed",
          remarks: "Session completed successfully",
        });
      }
    }
    const totalSessions = await ClassSessionModel.countDocuments({ institutionId: instId });
    console.log(`Created ${totalSessions} class sessions over 6 months`);
  }

  console.log("\n✅ Seed complete! Chavara School is fully populated.");
  console.log(`\nLogin credentials:`);
  console.log(`  Admin: admin@chavaraschool.edu.in / admin123`);
  console.log(`  Teacher: anjali.menon@chavaraschool.edu.in / teacher123`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
