import Elysia, { t } from "elysia";
import { adminAuthMacro } from "@/modules/admin/admin-macro";
import { TeachingProgressModel } from "@/schema/staff/teaching-progress-model";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { GradeBookModel } from "@/schema/books/gradeBook-model";
import { ClassModel } from "@/schema/admin/class-model";
import { StudentModel } from "@/schema/admin/student-model";
import { ChapterContentModel } from "@/schema/books/chapterContent-model";
import { ChapterModel } from "@/schema/books/chapter-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";

export const teachingProgressController = new Elysia({
  prefix: "/teaching-progress",
  tags: ["Teaching Progress"],
})
  .use(adminAuthMacro)
  .guard({ isAuth: true })

  // GET classes/sections grouped by grade for a curriculum
  .get(
    "/classes/:curriculumId",
    async ({ params, user }) => {
      const institutionId = user.institutionId;
      if (!institutionId) {
        throw new ForbiddenError("No institution associated with this account");
      }

      // 1. Get institution's accessible gradeBooks for this curriculum
      const institution = await InstitutionModel.findById(institutionId).lean();
      if (!institution || institution.isDeleted) {
        throw new BadRequestError("Institution not found");
      }

      const curriculumAccess = (institution.curriculumAccess || []).find(
        (access: any) => access.curriculumId.toString() === params.curriculumId
      );

      if (!curriculumAccess || !curriculumAccess.accessibleGradeBooks?.length) {
        return { success: true, data: [] };
      }

      // 2. Get gradeBooks to know which grades are available
      const gradeBooks = await GradeBookModel.find({
        _id: { $in: curriculumAccess.accessibleGradeBooks },
      })
        .select("grade bookTitle")
        .lean();

      if (!gradeBooks.length) {
        return { success: true, data: [] };
      }

      // 3. Build a map: grade number -> gradeBook info
      const gradeToBook = new Map<string, { gradeBookId: string; gradeBookTitle: string }>();
      for (const gb of gradeBooks) {
        gradeToBook.set(String(gb.grade), {
          gradeBookId: (gb as any)._id.toString(),
          gradeBookTitle: gb.bookTitle,
        });
      }

      // 4. Query classes matching those grades in this institution
      const gradeStrings = Array.from(gradeToBook.keys());
      const classes = await ClassModel.find({
        institutionId,
        grade: { $in: gradeStrings },
        isActive: true,
        isDeleted: false,
      })
        .sort({ grade: 1, section: 1 })
        .lean();

      // 5. Get student counts per class
      const classIds = classes.map((c: any) => c._id);
      const studentCounts = await StudentModel.aggregate([
        { $match: { classId: { $in: classIds }, isDeleted: false } },
        { $group: { _id: "$classId", count: { $sum: 1 } } },
      ]);
      const countMap = new Map(
        studentCounts.map((s: any) => [s._id.toString(), s.count])
      );

      // 6. Get existing progress summaries for this teacher
      const progressDocs = await TeachingProgressModel.find({
        staffId: user.id,
        gradeBookId: { $in: gradeBooks.map((gb: any) => gb._id) },
        institutionId,
      })
        .select("classId gradeBookId overallPercentage")
        .lean();

      const progressMap = new Map(
        progressDocs.map((p: any) => [
          `${p.classId.toString()}_${p.gradeBookId.toString()}`,
          p.overallPercentage,
        ])
      );

      // 7. Group by grade
      const grouped = new Map<
        string,
        {
          grade: string;
          gradeBookId: string;
          gradeBookTitle: string;
          sections: any[];
        }
      >();

      for (const cls of classes) {
        const grade = cls.grade || "";
        const bookInfo = gradeToBook.get(grade);
        if (!bookInfo) continue;

        if (!grouped.has(grade)) {
          grouped.set(grade, {
            grade,
            gradeBookId: bookInfo.gradeBookId,
            gradeBookTitle: bookInfo.gradeBookTitle,
            sections: [],
          });
        }

        const classId = (cls as any)._id.toString();
        const progressKey = `${classId}_${bookInfo.gradeBookId}`;

        grouped.get(grade)!.sections.push({
          classId,
          section: cls.section,
          studentCount: countMap.get(classId) || 0,
          progressPercentage: progressMap.get(progressKey) || 0,
        });
      }

      // Sort by grade numerically
      const result = Array.from(grouped.values()).sort(
        (a, b) => Number(a.grade) - Number(b.grade)
      );

      return { success: true, data: result };
    },
    { params: t.Object({ curriculumId: t.String() }) }
  )

  // GET teaching progress for a class section + gradebook
  .get(
    "/:classId/:gradeBookId",
    async ({ params, user }) => {
      const progress = await TeachingProgressModel.findOne({
        staffId: user.id,
        classId: params.classId,
        gradeBookId: params.gradeBookId,
      }).lean();

      if (!progress) {
        return {
          success: true,
          data: {
            overallPercentage: 0,
            lastAccessedContentId: null,
            contentProgress: [],
          },
        };
      }

      return {
        success: true,
        data: {
          overallPercentage: progress.overallPercentage,
          lastAccessedContentId: progress.lastAccessedContentId || null,
          contentProgress: progress.contentProgress,
        },
      };
    },
    {
      params: t.Object({
        classId: t.String(),
        gradeBookId: t.String(),
      }),
    }
  )

  // PUT update content progress (auto-save timestamps/pages)
  .put(
    "/:classId/:gradeBookId/content/:contentId",
    async ({ params, body, user }) => {
      const { classId, gradeBookId, contentId } = params;

      // Get the chapter for this content
      const content = await ChapterContentModel.findById(contentId)
        .select("chapterId")
        .lean();
      if (!content) {
        throw new BadRequestError("Content not found");
      }

      const chapterId = (content as any).chapterId.toString();

      // Try to update existing content entry
      const updated = await TeachingProgressModel.findOneAndUpdate(
        {
          staffId: user.id,
          classId,
          gradeBookId,
          "contentProgress.contentId": contentId,
        },
        {
          $set: {
            "contentProgress.$.videoTimestamp": body.videoTimestamp,
            "contentProgress.$.pdfPage": body.pdfPage,
            "contentProgress.$.lastAccessedAt": new Date(),
            ...(body.isCompleted !== undefined && {
              "contentProgress.$.isCompleted": body.isCompleted,
              ...(body.isCompleted && { "contentProgress.$.completedAt": new Date() }),
            }),
            lastAccessedContentId: contentId,
            lastAccessedAt: new Date(),
          },
        },
        { new: true }
      );

      if (updated) {
        // Recalculate percentage if completion changed
        if (body.isCompleted !== undefined) {
          await recalculatePercentage(updated, gradeBookId);
        }
        return { success: true, data: { updated: true } };
      }

      // Content entry doesn't exist — create or push
      const upserted = await TeachingProgressModel.findOneAndUpdate(
        { staffId: user.id, classId, gradeBookId },
        {
          $push: {
            contentProgress: {
              contentId,
              chapterId,
              isCompleted: body.isCompleted || false,
              completedAt: body.isCompleted ? new Date() : undefined,
              videoTimestamp: body.videoTimestamp,
              pdfPage: body.pdfPage,
              lastAccessedAt: new Date(),
            },
          },
          $set: {
            lastAccessedContentId: contentId,
            lastAccessedAt: new Date(),
          },
          $setOnInsert: {
            institutionId: user.institutionId,
          },
        },
        { new: true, upsert: true }
      );

      if (body.isCompleted !== undefined && upserted) {
        await recalculatePercentage(upserted, gradeBookId);
      }

      return { success: true, data: { updated: true } };
    },
    {
      params: t.Object({
        classId: t.String(),
        gradeBookId: t.String(),
        contentId: t.String(),
      }),
      body: t.Object({
        isCompleted: t.Optional(t.Boolean()),
        videoTimestamp: t.Optional(t.Number()),
        pdfPage: t.Optional(t.Number()),
      }),
    }
  )

  // POST mark content as complete (toggle)
  .post(
    "/:classId/:gradeBookId/content/:contentId/complete",
    async ({ params, user }) => {
      const { classId, gradeBookId, contentId } = params;

      // Get the chapter for this content
      const content = await ChapterContentModel.findById(contentId)
        .select("chapterId")
        .lean();
      if (!content) {
        throw new BadRequestError("Content not found");
      }

      const chapterId = (content as any).chapterId.toString();

      // Check if progress doc and content entry exist
      const existing = await TeachingProgressModel.findOne({
        staffId: user.id,
        classId,
        gradeBookId,
        "contentProgress.contentId": contentId,
      });

      if (existing) {
        // Toggle completion
        const entry = existing.contentProgress.find(
          (p) => p.contentId.toString() === contentId
        );
        const newCompleted = !entry?.isCompleted;

        await TeachingProgressModel.updateOne(
          {
            staffId: user.id,
            classId,
            gradeBookId,
            "contentProgress.contentId": contentId,
          },
          {
            $set: {
              "contentProgress.$.isCompleted": newCompleted,
              "contentProgress.$.completedAt": newCompleted ? new Date() : null,
              "contentProgress.$.lastAccessedAt": new Date(),
              lastAccessedContentId: contentId,
              lastAccessedAt: new Date(),
            },
          }
        );

        const updated = await TeachingProgressModel.findOne({
          staffId: user.id,
          classId,
          gradeBookId,
        });
        if (updated) {
          await recalculatePercentage(updated, gradeBookId);
        }

        return {
          success: true,
          data: { isCompleted: newCompleted },
        };
      }

      // No existing entry — create doc with completed entry
      const doc = await TeachingProgressModel.findOneAndUpdate(
        { staffId: user.id, classId, gradeBookId },
        {
          $push: {
            contentProgress: {
              contentId,
              chapterId,
              isCompleted: true,
              completedAt: new Date(),
              lastAccessedAt: new Date(),
            },
          },
          $set: {
            lastAccessedContentId: contentId,
            lastAccessedAt: new Date(),
          },
          $setOnInsert: {
            institutionId: user.institutionId,
          },
        },
        { new: true, upsert: true }
      );

      if (doc) {
        await recalculatePercentage(doc, gradeBookId);
      }

      return { success: true, data: { isCompleted: true } };
    },
    {
      params: t.Object({
        classId: t.String(),
        gradeBookId: t.String(),
        contentId: t.String(),
      }),
    }
  );

// Helper: recalculate overall percentage
async function recalculatePercentage(doc: any, gradeBookId: string) {
  // Count total content items in this grade book
  const chapters = await ChapterModel.find({ gradeBookId }).select("_id").lean();
  const chapterIds = chapters.map((ch: any) => ch._id);
  const totalContent = await ChapterContentModel.countDocuments({
    chapterId: { $in: chapterIds },
  });

  if (totalContent === 0) return;

  const completedCount = doc.contentProgress.filter(
    (p: any) => p.isCompleted
  ).length;
  const percentage = Math.round((completedCount / totalContent) * 100);

  await TeachingProgressModel.updateOne(
    { _id: doc._id },
    { $set: { overallPercentage: percentage } }
  );
}
