// controllers/curriculum/chapter.controller.ts
import { BadRequestError } from "@/lib/shared/bad-request";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { ChapterModel } from "@/schema/books/chapter-model";
import { GradeBookModel } from "@/schema/books/gradeBook-model";

import Elysia, { t } from "elysia";

interface DecodedToken {
  role: string;
}

export const chapterController = new Elysia({
  prefix: "/admin/curriculum",
  tags: ["Chapter (Super Admin Only)"],
})

// CREATE Chapter
.post("/:curriculumId/grades/:grade/chapters", async ({ params, body, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const gradeBook = await GradeBookModel.findOne({
    curriculumId: params.curriculumId,
    grade: Number(params.grade),
  });
  if (!gradeBook) throw new BadRequestError("Grade book not found");

  const chapter = new ChapterModel({
    ...body,
    gradeBookId: gradeBook._id,
  });
  await chapter.save();

  set.status = 201;
  return { success: true, data: chapter };
}, {
  params: t.Object({ curriculumId: t.String(), grade: t.String() }),
  body: t.Object({
    title: t.String(),
    chapterNumber: t.Number(),
    description: t.Optional(t.String()),
    isFree: t.Optional(t.Boolean()),
    order: t.Number(),
  }),
})

// LIST Chapters
.get("/:curriculumId/grades/:grade/chapters", async ({ params, headers }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const gradeBook = await GradeBookModel.findOne({
    curriculumId: params.curriculumId,
    grade: Number(params.grade),
  });
  if (!gradeBook) throw new BadRequestError("Grade book not found");

  const chapters = await ChapterModel.find({ gradeBookId: gradeBook._id })
    .sort({ order: 1 });

  return { success: true, data: chapters };
}, { params: t.Object({ curriculumId: t.String(), grade: t.String() }) })

// UPDATE Chapter
.patch("/:curriculumId/grades/:grade/chapters/:chapterId", async ({ params, body, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const chapter = await ChapterModel.findByIdAndUpdate(
    params.chapterId,
    { $set: body },
    { new: true }
  );

  if (!chapter) throw new BadRequestError("Chapter not found");

  set.status = 200;
  return { success: true, data: chapter };
}, {
  params: t.Object({ curriculumId: t.String(), grade: t.String(), chapterId: t.String() }),
  body: t.Partial(t.Object({
    title: t.String(),
    description: t.String(),
    isFree: t.Boolean(),
    order: t.Number(),
  })),
})

// REORDER Chapters
.post("/:curriculumId/grades/:grade/chapters/reorder", async ({ params, body, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const updates = body.map(({ chapterId, order }) =>
    ChapterModel.updateOne({ _id: chapterId }, { order })
  );
  await Promise.all(updates);

  set.status = 200;
  return { success: true, message: "Chapters reordered" };
}, {
  params: t.Object({ curriculumId: t.String(), grade: t.String() }),
  body: t.Array(t.Object({ chapterId: t.String(), order: t.Number() })),
})

// DELETE Chapter
.delete("/:curriculumId/grades/:grade/chapters/:chapterId", async ({ params, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const result = await ChapterModel.findByIdAndDelete(params.chapterId);
  if (!result) throw new BadRequestError("Chapter not found");

  set.status = 200;
  return { success: true, message: "Chapter deleted" };
}, { params: t.Object({ curriculumId: t.String(), grade: t.String(), chapterId: t.String() }) });