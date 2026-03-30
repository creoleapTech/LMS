import Elysia, { t } from "elysia";
import { ChapterModel } from "@/schema/books/chapter-model";
import { ChapterContentModel } from "@/schema/books/chapterContent-model";
import { adminAuthMacro } from "../admin-macro";

export const curriculumReaderController = new Elysia({
  prefix: "/curriculum-reader",
  tags: ["Curriculum Reader (All Authenticated Roles)"],
})
  .use(adminAuthMacro)
  .guard({ isAuth: true })

  // GET chapters for a grade book (any authenticated role)
  .get(
    "/chapters/:gradeBookId",
    async ({ params }) => {
      const chapters = await ChapterModel.find({
        gradeBookId: params.gradeBookId,
      }).sort({ order: 1 });

      return { success: true, data: chapters };
    },
    { params: t.Object({ gradeBookId: t.String() }) }
  )

  // GET content for a chapter (any authenticated role)
  .get(
    "/content/:chapterId",
    async ({ params }) => {
      const content = await ChapterContentModel.find({
        chapterId: params.chapterId,
      }).sort({ order: 1 });

      return { success: true, data: content };
    },
    { params: t.Object({ chapterId: t.String() }) }
  )

  // GET full gradebook data: chapters with nested content (for Coursera-like sidebar)
  .get(
    "/gradebook/:gradeBookId/full",
    async ({ params }) => {
      const chapters = await ChapterModel.find({
        gradeBookId: params.gradeBookId,
      })
        .sort({ order: 1 })
        .lean();

      const chaptersWithContent = await Promise.all(
        chapters.map(async (chapter: any) => {
          const content = await ChapterContentModel.find({
            chapterId: chapter._id,
          })
            .sort({ order: 1 })
            .lean();

          return { ...chapter, content };
        })
      );

      return { success: true, data: chaptersWithContent };
    },
    { params: t.Object({ gradeBookId: t.String() }) }
  );
