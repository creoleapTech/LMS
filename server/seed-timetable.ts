/**
 * Seed script to create period config for Chavara School
 * and sample timetable entries for teachers.
 * Run: cd server && bun run seed-timetable.ts
 */
import mongoose from "mongoose";
import { InstitutionModel } from "./src/schema/admin/institution-model";
import { StaffModel } from "./src/schema/admin/staff-model";
import { ClassModel } from "./src/schema/admin/class-model";
import { GradeBookModel } from "./src/schema/books/gradeBook-model";
import { PeriodConfigModel } from "./src/schema/admin/period-config-model";
import { TimetableEntryModel } from "./src/schema/admin/timetable-entry-model";

const MONGO_URI = "mongodb+srv://stainsrubus:Stains2001@cluster0.ogeipvb.mongodb.net/";

async function main() {
  await mongoose.connect(MONGO_URI, { dbName: "LMS" });
  console.log("Connected to MongoDB");

  // Find Chavara School
  const institution = await InstitutionModel.findOne({ name: "Chavara School" });
  if (!institution) {
    console.error("Chavara School not found. Run seed.ts first.");
    process.exit(1);
  }
  const instId = institution._id;
  console.log(`Found Chavara School: ${instId}`);

  // ── 1. Upsert Period Config ──
  const periods = [
    { periodNumber: 1, label: "Period 1", startTime: "08:00", endTime: "08:45", isBreak: false },
    { periodNumber: 2, label: "Period 2", startTime: "08:45", endTime: "09:30", isBreak: false },
    { periodNumber: 3, label: "Period 3", startTime: "09:30", endTime: "10:15", isBreak: false },
    { periodNumber: 4, label: "Short Break", startTime: "10:15", endTime: "10:30", isBreak: true },
    { periodNumber: 5, label: "Period 4", startTime: "10:30", endTime: "11:15", isBreak: false },
    { periodNumber: 6, label: "Period 5", startTime: "11:15", endTime: "12:00", isBreak: false },
    { periodNumber: 7, label: "Lunch", startTime: "12:00", endTime: "12:45", isBreak: true },
    { periodNumber: 8, label: "Period 6", startTime: "12:45", endTime: "13:30", isBreak: false },
    { periodNumber: 9, label: "Period 7", startTime: "13:30", endTime: "14:15", isBreak: false },
    { periodNumber: 10, label: "Period 8", startTime: "14:15", endTime: "15:00", isBreak: false },
  ];

  const workingDays = [1, 2, 3, 4, 5]; // Mon–Fri

  await PeriodConfigModel.findOneAndUpdate(
    { institutionId: instId },
    { institutionId: instId, periods, workingDays, isDeleted: false },
    { upsert: true, new: true }
  );
  console.log("Period config upserted (10 slots: 8 periods + 2 breaks)");

  // ── 2. Find teachers ──
  const teachers = await StaffModel.find({
    institutionId: instId,
    type: { $in: ["teacher", "staff"] },
    isDeleted: false,
  }).limit(5);

  if (teachers.length === 0) {
    console.warn("No teachers found for Chavara School. Skipping timetable entries.");
    await mongoose.disconnect();
    return;
  }
  console.log(`Found ${teachers.length} teachers`);

  // ── 3. Get classes and gradebooks ──
  const classes = await ClassModel.find({ institutionId: instId, isDeleted: false });
  const gradeBooks = await GradeBookModel.find({ isPublished: true });

  if (classes.length === 0) {
    console.warn("No classes found. Skipping timetable entries.");
    await mongoose.disconnect();
    return;
  }
  console.log(`Found ${classes.length} classes, ${gradeBooks.length} gradebooks`);

  // ── 4. Clear old timetable entries for these teachers ──
  const teacherIds = teachers.map((t) => t._id);
  await TimetableEntryModel.deleteMany({ staffId: { $in: teacherIds } });
  console.log("Cleared old timetable entries");

  // ── 5. Create recurring timetable entries ──
  // Teaching period numbers (non-break): 1, 2, 3, 5, 6, 8, 9, 10
  const teachingPeriods = periods.filter((p) => !p.isBreak).map((p) => p.periodNumber);

  const entries: any[] = [];

  for (const teacher of teachers) {
    // Find classes this teacher is assigned to
    const teacherClasses = classes.filter((c) =>
      c.teacherIds?.some((tid: any) => tid.toString() === teacher._id.toString())
    );

    if (teacherClasses.length === 0) continue;

    // For each working day (Mon-Fri), assign 3-5 periods
    for (const dayOfWeek of workingDays) {
      // Shuffle teaching periods and pick 3-5
      const shuffled = [...teachingPeriods].sort(() => Math.random() - 0.5);
      const count = 3 + Math.floor(Math.random() * 3); // 3-5 periods
      const selectedPeriods = shuffled.slice(0, count);

      for (const pNum of selectedPeriods) {
        const cls = teacherClasses[Math.floor(Math.random() * teacherClasses.length)];
        const grade = parseInt(cls.grade || "6", 10);
        const matchingBooks = gradeBooks.filter((gb) => gb.grade === grade);
        const gradeBook = matchingBooks.length > 0
          ? matchingBooks[Math.floor(Math.random() * matchingBooks.length)]
          : null;

        entries.push({
          institutionId: instId,
          staffId: teacher._id,
          classId: cls._id,
          gradeBookId: gradeBook?._id || undefined,
          periodNumber: pNum,
          dayOfWeek,
          isRecurring: true,
          status: "scheduled",
          isDeleted: false,
        });
      }
    }
  }

  if (entries.length > 0) {
    await TimetableEntryModel.insertMany(entries, { ordered: false }).catch((err) => {
      // Ignore duplicate key errors
      if (err.code !== 11000) throw err;
      console.warn(`Some duplicate entries skipped`);
    });
    console.log(`Created ${entries.length} recurring timetable entries`);
  }

  // ── 6. Mark some past entries as completed (one-off overrides) ──
  const TOPICS = [
    "Algebra basics", "Linear equations", "Quadratic formula",
    "Photosynthesis", "Cell division", "Evolution",
    "Grammar rules", "Essay writing", "Poetry analysis",
    "HTML & CSS", "Python intro", "Data structures",
    "Trigonometry", "Geometry", "Statistics",
  ];

  const completedEntries: any[] = [];
  const today = new Date();

  for (const teacher of teachers) {
    // Create completed entries for past 3 weeks
    for (let weekOffset = 1; weekOffset <= 3; weekOffset++) {
      for (const dayOfWeek of workingDays) {
        const pastDate = new Date(today);
        pastDate.setDate(today.getDate() - (weekOffset * 7) + (dayOfWeek - today.getDay()));

        if (pastDate >= today) continue; // skip future dates

        // Find this teacher's recurring entries for this day
        const teacherDayEntries = entries.filter(
          (e) => e.staffId.toString() === teacher._id.toString() && e.dayOfWeek === dayOfWeek
        );

        // Mark 60-80% of them as completed
        const completeCount = Math.ceil(teacherDayEntries.length * (0.6 + Math.random() * 0.2));
        const toComplete = teacherDayEntries.slice(0, completeCount);

        for (const entry of toComplete) {
          const numTopics = 1 + Math.floor(Math.random() * 3);
          const topicsCovered = Array.from({ length: numTopics }, () =>
            TOPICS[Math.floor(Math.random() * TOPICS.length)]
          );

          completedEntries.push({
            institutionId: instId,
            staffId: teacher._id,
            classId: entry.classId,
            gradeBookId: entry.gradeBookId,
            periodNumber: entry.periodNumber,
            dayOfWeek,
            isRecurring: false,
            specificDate: pastDate,
            status: "completed",
            topicsCovered,
            completedAt: pastDate,
            notes: Math.random() > 0.5 ? "Good class participation" : undefined,
            isDeleted: false,
          });
        }
      }
    }
  }

  if (completedEntries.length > 0) {
    await TimetableEntryModel.insertMany(completedEntries, { ordered: false }).catch((err) => {
      if (err.code !== 11000) throw err;
      console.warn(`Some duplicate completed entries skipped`);
    });
    console.log(`Created ${completedEntries.length} completed (one-off) timetable entries`);
  }

  console.log("\nSeed complete!");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
