/**
 * Seed script to link 3 existing user accounts to Chavara School
 * and create dashboard chart data for them.
 * Run: cd server && bun run seed-users.ts
 */
import mongoose from "mongoose";
import { InstitutionModel } from "./src/schema/admin/institution-model";
import { AdminModel } from "./src/schema/admin/admin-model";
import { StaffModel } from "./src/schema/admin/staff-model";
import { ClassModel } from "./src/schema/admin/class-model";
import { GradeBookModel } from "./src/schema/books/gradeBook-model";
import { ChapterModel } from "./src/schema/books/chapter-model";
import { ChapterContentModel } from "./src/schema/books/chapterContent-model";
import { TeachingProgressModel } from "./src/schema/staff/teaching-progress-model";
import { ClassSessionModel } from "./src/schema/staff/class-session-model";

const MONGO_URI = "mongodb+srv://stainsrubus:Stains2001@cluster0.ogeipvb.mongodb.net/";

const TARGET_EMAILS = [
  "chrisjaron@karunya.edu.in",
  "ruthra@creoleap.com",
  "tech@creoleap.com",
];

const TOPICS = [
  ["Algebra basics", "Linear equations"],
  ["Photosynthesis", "Cell division"],
  ["Grammar rules", "Essay writing"],
  ["Hindi kavya", "Sanskrit shloka"],
  ["HTML & CSS", "Python intro"],
  ["Trigonometry", "Geometry"],
  ["Chemical reactions", "Periodic table"],
  ["Poetry analysis", "Comprehension"],
  ["Programming logic", "Data structures"],
  ["Warm-up exercises", "Team sports"],
];

type ResolvedUser = {
  email: string;
  source: "admin" | "staff";
  role: string;
  doc: any;
};

async function seedUsers() {
  await mongoose.connect(MONGO_URI, { dbName: "LMS" });
  console.log("Connected to MongoDB");

  // ─── 1. Find Chavara School ───
  const institution = await InstitutionModel.findOne({ name: "Chavara School" });
  if (!institution) {
    console.error("Chavara School not found. Run seed.ts first.");
    process.exit(1);
  }
  const instId = institution._id;
  console.log("Found Chavara School:", instId);

  // ─── 2. Pre-fetch classes and grade books ───
  const allClasses = await ClassModel.find({ institutionId: instId, isDeleted: { $ne: true } }).sort({ grade: 1, section: 1 });
  const allGradeBooks = await GradeBookModel.find({ isPublished: true });
  console.log(`Found ${allClasses.length} classes, ${allGradeBooks.length} grade books`);

  // ─── 3. Resolve each user ───
  const resolved: ResolvedUser[] = [];

  for (const email of TARGET_EMAILS) {
    const lowerEmail = email.toLowerCase();

    // Check AdminModel first (mirrors login flow)
    let adminUser = await AdminModel.findOne({ email: lowerEmail, isDeleted: false });
    if (adminUser) {
      resolved.push({ email, source: "admin", role: adminUser.role, doc: adminUser });
      console.log(`Found ${email} in AdminModel (role: ${adminUser.role})`);
      continue;
    }

    // Then check StaffModel
    let staffUser = await StaffModel.findOne({ email: lowerEmail, isDeleted: false });
    if (staffUser) {
      resolved.push({ email, source: "staff", role: staffUser.type || "teacher", doc: staffUser });
      console.log(`Found ${email} in StaffModel (type: ${staffUser.type})`);
      continue;
    }

    console.warn(`WARNING: ${email} not found in AdminModel or StaffModel — skipping`);
  }

  if (resolved.length === 0) {
    console.log("No users found. Nothing to do.");
    await mongoose.disconnect();
    process.exit(0);
  }

  // ─── 4. Process each user ───
  let teacherClassIndex = 0; // offset for class assignment diversity

  for (const user of resolved) {
    const userId = user.doc._id;

    if (user.source === "admin") {
      // ─── Admin-role user ───
      await AdminModel.findByIdAndUpdate(userId, { $set: { institutionId: instId } });
      await InstitutionModel.findByIdAndUpdate(instId, { $addToSet: { adminIds: userId } });
      console.log(`✅ Linked ${user.email} (admin) to Chavara School — all admin charts use institution-wide data`);

    } else {
      // ─── Teacher/Staff-role user ───
      await StaffModel.findByIdAndUpdate(userId, { $set: { institutionId: instId } });
      await InstitutionModel.findByIdAndUpdate(instId, { $addToSet: { staffIds: userId } });

      // Assign 3 classes (rotating through available classes for diversity)
      const numAssign = 3;
      const selectedClasses: any[] = [];
      for (let i = 0; i < numAssign && i < allClasses.length; i++) {
        const idx = (teacherClassIndex + i) % allClasses.length;
        selectedClasses.push(allClasses[idx]);
      }
      teacherClassIndex += numAssign;

      const selectedClassIds = selectedClasses.map((c) => c._id);

      // Update Staff.assignedClasses
      await StaffModel.findByIdAndUpdate(userId, {
        $addToSet: { assignedClasses: { $each: selectedClassIds } },
      });

      // Update Class.teacherIds for each class
      for (const cls of selectedClasses) {
        await ClassModel.findByIdAndUpdate(cls._id, {
          $addToSet: { teacherIds: userId },
        });
      }
      console.log(`  Assigned classes: ${selectedClasses.map((c) => `${c.grade}-${c.section}`).join(", ")}`);

      // ─── Create TeachingProgress records ───
      let progressCount = 0;
      for (const cls of selectedClasses) {
        const classGradeBooks = allGradeBooks.filter((gb) => gb.grade === Number(cls.grade));

        for (const gb of classGradeBooks) {
          // Check if already exists
          const existing = await TeachingProgressModel.findOne({
            staffId: userId,
            classId: cls._id,
            gradeBookId: gb._id,
          });
          if (existing) {
            progressCount++;
            continue;
          }

          // Fetch chapters + content
          const chapters = await ChapterModel.find({ gradeBookId: gb._id });
          const allContent: Array<{ contentId: any; chapterId: any }> = [];
          for (const ch of chapters) {
            const contents = await ChapterContentModel.find({ chapterId: ch._id });
            allContent.push(...contents.map((c) => ({ contentId: c._id, chapterId: ch._id })));
          }

          const progressPercent = 20 + Math.floor(Math.random() * 70);
          const completedCount = Math.floor((progressPercent / 100) * allContent.length);

          const contentProgress = allContent.map((item, idx) => ({
            contentId: item.contentId,
            chapterId: item.chapterId,
            isCompleted: idx < completedCount,
            completedAt: idx < completedCount
              ? new Date(2025, Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 28))
              : undefined,
            lastAccessedAt: new Date(2025, Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 28)),
          }));

          try {
            await TeachingProgressModel.create({
              staffId: userId,
              classId: cls._id,
              gradeBookId: gb._id,
              institutionId: instId,
              contentProgress,
              overallPercentage: progressPercent,
              lastAccessedAt: new Date(2026, 2 + Math.floor(Math.random() * 2), 1 + Math.floor(Math.random() * 28)),
            });
            progressCount++;
          } catch (e: any) {
            if (e.code === 11000) {
              progressCount++;
              continue;
            }
            throw e;
          }
        }
      }
      console.log(`  Created/found ${progressCount} TeachingProgress records`);

      // ─── Create ClassSession records ───
      const existingSessions = await ClassSessionModel.countDocuments({
        staffId: userId,
        institutionId: instId,
      });

      if (existingSessions > 0) {
        console.log(`  Sessions already exist (${existingSessions}) — skipping`);
      } else {
        let sessionCount = 0;
        for (const cls of selectedClasses) {
          const numSessions = 8 + Math.floor(Math.random() * 8); // 8-15
          for (let s = 0; s < numSessions; s++) {
            const monthsAgo = Math.floor(Math.random() * 6); // 0-5 months ago from Apr 2026
            const month = 3 - monthsAgo; // April=3, March=2, ... November=-2
            const year = month < 0 ? 2025 : 2026;
            const actualMonth = month < 0 ? month + 12 : month;

            const day = 1 + Math.floor(Math.random() * 28);
            const hour = 8 + Math.floor(Math.random() * 6);
            const duration = 30 + Math.floor(Math.random() * 30);
            const startTime = new Date(year, actualMonth, day, hour);
            const endTime = new Date(startTime.getTime() + duration * 60000);
            const topicSet = TOPICS[Math.floor(Math.random() * TOPICS.length)];

            await ClassSessionModel.create({
              staffId: userId,
              institutionId: instId,
              classId: cls._id,
              startTime,
              endTime,
              durationMinutes: duration,
              topicsCovered: topicSet,
              status: "completed",
              remarks: "Session completed successfully",
            });
            sessionCount++;
          }
        }
        console.log(`  Created ${sessionCount} ClassSession records`);
      }

      console.log(`✅ Linked ${user.email} (teacher) to Chavara School`);
    }
  }

  console.log("\n✅ Seed-users complete!");
  await mongoose.disconnect();
  process.exit(0);
}

seedUsers().catch((err) => {
  console.error("Seed-users failed:", err);
  process.exit(1);
});
