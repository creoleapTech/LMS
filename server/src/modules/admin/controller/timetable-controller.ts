import Elysia, { t } from "elysia";
import { adminAuthMacro } from "../admin-macro";
import { TimetableEntryModel } from "@/schema/admin/timetable-entry-model";
import { PeriodConfigModel } from "@/schema/admin/period-config-model";
import { ClassModel } from "@/schema/admin/class-model";
import { GradeBookModel } from "@/schema/books/gradeBook-model";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { Types } from "mongoose";

function resolveInstitutionId(user: any): string {
  const institutionId =
    typeof user.institutionId === "object"
      ? (user.institutionId as any)._id?.toString()
      : user.institutionId?.toString();
  if (!institutionId) throw new BadRequestError("Institution ID is required");
  return institutionId;
}

export const timetableController = new Elysia({
  prefix: "/timetable",
  tags: ["Timetable"],
})
  .use(adminAuthMacro)
  .guard({ isAuth: true })

  // GET month summary for teacher's calendar
  .get(
    "/my-month",
    async ({ query, user }) => {
      const staffId = user.id;
      const institutionId = resolveInstitutionId(user);
      const year = Number(query.year);
      const month = Number(query.month); // 1-12

      const instOid = new Types.ObjectId(institutionId);
      const staffOid = new Types.ObjectId(staffId);

      // Get period config for working days
      const periodConfig = await PeriodConfigModel.findOne({
        institutionId: instOid,
        isDeleted: false,
      });
      const workingDays = periodConfig?.workingDays || [1, 2, 3, 4, 5];

      // Get all recurring entries for this teacher
      const recurringEntries = await TimetableEntryModel.find({
        staffId: staffOid,
        isRecurring: true,
        isDeleted: false,
      });

      // Date range for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Get one-off entries in this month
      const oneOffEntries = await TimetableEntryModel.find({
        staffId: staffOid,
        isRecurring: false,
        specificDate: { $gte: startDate, $lte: endDate },
        isDeleted: false,
      });

      // Build summary for each date
      const dates: Record<string, { entryCount: number; hasCompleted: boolean }> = {};
      const daysInMonth = endDate.getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dow = date.getDay();

        if (!workingDays.includes(dow)) continue;

        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

        // Recurring entries for this day of week
        const recurringForDay = recurringEntries.filter(
          (e) => e.dayOfWeek === dow
        );

        // One-off entries for this specific date
        const oneOffForDate = oneOffEntries.filter((e) => {
          const sd = e.specificDate!;
          return (
            sd.getFullYear() === year &&
            sd.getMonth() === month - 1 &&
            sd.getDate() === d
          );
        });

        // Merge: one-off overrides recurring for same periodNumber
        const overriddenPeriods = new Set(
          oneOffForDate.map((e) => e.periodNumber)
        );
        const merged = [
          ...recurringForDay.filter(
            (e) => !overriddenPeriods.has(e.periodNumber)
          ),
          ...oneOffForDate,
        ];

        if (merged.length > 0) {
          dates[dateStr] = {
            entryCount: merged.length,
            hasCompleted: merged.some((e) => e.status === "completed"),
          };
        }
      }

      return { success: true, data: { dates } };
    },
    {
      query: t.Object({
        year: t.String(),
        month: t.String(),
      }),
    }
  )

  // GET day entries for teacher (recurring resolved + one-off merged)
  .get(
    "/my-day",
    async ({ query, user }) => {
      const staffId = user.id;
      const institutionId = resolveInstitutionId(user);
      const date = new Date(query.date);
      const dow = date.getDay();

      const instOid = new Types.ObjectId(institutionId);
      const staffOid = new Types.ObjectId(staffId);

      // Get period config
      const periodConfig = await PeriodConfigModel.findOne({
        institutionId: instOid,
        isDeleted: false,
      });

      // Get recurring entries for this day of week
      const recurringEntries = await TimetableEntryModel.find({
        staffId: staffOid,
        dayOfWeek: dow,
        isRecurring: true,
        isDeleted: false,
      })
        .populate("classId", "grade section year")
        .populate("gradeBookId", "bookTitle grade");

      // Get one-off entries for this specific date
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const oneOffEntries = await TimetableEntryModel.find({
        staffId: staffOid,
        specificDate: { $gte: dayStart, $lte: dayEnd },
        isRecurring: false,
        isDeleted: false,
      })
        .populate("classId", "grade section year")
        .populate("gradeBookId", "bookTitle grade");

      // Merge: one-off overrides recurring for same periodNumber
      const overriddenPeriods = new Set(
        oneOffEntries.map((e) => e.periodNumber)
      );
      const merged = [
        ...recurringEntries.filter(
          (e) => !overriddenPeriods.has(e.periodNumber)
        ),
        ...oneOffEntries,
      ].sort((a, b) => a.periodNumber - b.periodNumber);

      return { success: true, data: { entries: merged, periodConfig } };
    },
    {
      query: t.Object({
        date: t.String(),
      }),
    }
  )

  // GET teacher's assigned classes (for dropdown)
  .get("/my-classes-list", async ({ user }) => {
    const staffId = user.id;
    const classes = await ClassModel.find({
      teacherIds: new Types.ObjectId(staffId),
      isDeleted: { $ne: true },
      isActive: true,
    }).select("grade section year");

    return { success: true, data: classes };
  })

  // GET grade books matching a grade (for the institution)
  .get(
    "/gradebooks",
    async ({ query, user }) => {
      const institutionId = resolveInstitutionId(user);
      const grade = Number(query.grade);

      // Get institution's accessible gradebooks
      const institution = await InstitutionModel.findById(institutionId);
      const accessibleGradeBookIds =
        institution?.curriculumAccess?.flatMap(
          (ca: any) => ca.accessibleGradeBooks || []
        ) || [];

      let filter: any = { grade, isPublished: true };
      if (accessibleGradeBookIds.length > 0) {
        filter._id = { $in: accessibleGradeBookIds };
      }

      const gradeBooks = await GradeBookModel.find(filter).select(
        "bookTitle grade curriculumId"
      );

      return { success: true, data: gradeBooks };
    },
    {
      query: t.Object({
        grade: t.String(),
      }),
    }
  )

  // POST create timetable entry
  .post(
    "/",
    async ({ body, user, set }) => {
      const staffId = user.id;
      const institutionId = resolveInstitutionId(user);
      const staffOid = new Types.ObjectId(staffId);
      const instOid = new Types.ObjectId(institutionId);

      // Conflict check: teacher already has this slot
      const teacherConflict = await TimetableEntryModel.findOne({
        staffId: staffOid,
        dayOfWeek: body.dayOfWeek,
        periodNumber: body.periodNumber,
        isRecurring: body.isRecurring,
        isDeleted: false,
        ...(body.isRecurring
          ? {}
          : { specificDate: body.specificDate ? new Date(body.specificDate) : undefined }),
      });

      if (teacherConflict) {
        throw new BadRequestError(
          `You already have a class scheduled for this period`
        );
      }

      // Conflict check: class already has a teacher at this slot
      const classConflict = await TimetableEntryModel.findOne({
        classId: new Types.ObjectId(body.classId),
        dayOfWeek: body.dayOfWeek,
        periodNumber: body.periodNumber,
        isRecurring: body.isRecurring,
        isDeleted: false,
        ...(body.isRecurring
          ? {}
          : { specificDate: body.specificDate ? new Date(body.specificDate) : undefined }),
      });

      if (classConflict) {
        throw new BadRequestError(
          `This class already has a teacher assigned for this period`
        );
      }

      const entry = new TimetableEntryModel({
        institutionId: instOid,
        staffId: staffOid,
        classId: new Types.ObjectId(body.classId),
        gradeBookId: body.gradeBookId
          ? new Types.ObjectId(body.gradeBookId)
          : undefined,
        periodNumber: body.periodNumber,
        dayOfWeek: body.dayOfWeek,
        isRecurring: body.isRecurring,
        specificDate:
          !body.isRecurring && body.specificDate
            ? new Date(body.specificDate)
            : undefined,
        notes: body.notes,
      });

      await entry.save();

      const populated = await TimetableEntryModel.findById(entry._id)
        .populate("classId", "grade section year")
        .populate("gradeBookId", "bookTitle grade");

      set.status = 201;
      return { success: true, data: populated };
    },
    {
      body: t.Object({
        classId: t.String(),
        gradeBookId: t.Optional(t.String()),
        periodNumber: t.Number({ minimum: 1 }),
        dayOfWeek: t.Number({ minimum: 0, maximum: 6 }),
        isRecurring: t.Boolean(),
        specificDate: t.Optional(t.String()),
        notes: t.Optional(t.String({ maxLength: 500 })),
      }),
    }
  )

  // PATCH update timetable entry
  .patch(
    "/:id",
    async ({ params, body }) => {
      const entry = await TimetableEntryModel.findById(params.id);
      if (!entry || entry.isDeleted) {
        throw new BadRequestError("Timetable entry not found");
      }

      if (body.classId) entry.classId = new Types.ObjectId(body.classId);
      if (body.gradeBookId)
        entry.gradeBookId = new Types.ObjectId(body.gradeBookId);
      if (body.notes !== undefined) entry.notes = body.notes;

      await entry.save();

      const populated = await TimetableEntryModel.findById(entry._id)
        .populate("classId", "grade section year")
        .populate("gradeBookId", "bookTitle grade");

      return { success: true, data: populated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        classId: t.Optional(t.String()),
        gradeBookId: t.Optional(t.String()),
        notes: t.Optional(t.String({ maxLength: 500 })),
      }),
    }
  )

  // PATCH mark entry as completed (work done)
  .patch(
    "/:id/complete",
    async ({ params, body }) => {
      const entry = await TimetableEntryModel.findById(params.id);
      if (!entry || entry.isDeleted) {
        throw new BadRequestError("Timetable entry not found");
      }

      entry.status = "completed";
      entry.completedAt = new Date();
      if (body.topicsCovered) entry.topicsCovered = body.topicsCovered;
      if (body.notes !== undefined) entry.notes = body.notes;

      await entry.save();

      const populated = await TimetableEntryModel.findById(entry._id)
        .populate("classId", "grade section year")
        .populate("gradeBookId", "bookTitle grade");

      return { success: true, data: populated };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        topicsCovered: t.Optional(t.Array(t.String())),
        notes: t.Optional(t.String({ maxLength: 500 })),
      }),
    }
  )

  // DELETE soft-delete timetable entry
  .delete(
    "/:id",
    async ({ params }) => {
      const entry = await TimetableEntryModel.findById(params.id);
      if (!entry || entry.isDeleted) {
        throw new BadRequestError("Timetable entry not found");
      }

      entry.isDeleted = true;
      await entry.save();

      return { success: true, message: "Timetable entry deleted" };
    },
    {
      params: t.Object({ id: t.String() }),
    }
  );
