// controllers/curriculum/chapterContent.controller.ts
import { BadRequestError } from "@/lib/shared/bad-request";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { ChapterModel } from "@/schema/books/chapter-model";
import { ChapterContentModel } from "@/schema/books/chapterContent-model";
import Elysia, { t } from "elysia";

interface DecodedToken {
  role: string;
}

export const chapterContentController = new Elysia({
  prefix: "/admin/curriculum",
  tags: ["Chapter Content (Super Admin Only)"],
})

// CREATE Content
.post("/:curriculumId/grades/:grade/chapters/:chapterId/content", async ({ params, body, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const chapter = await ChapterModel.findById(params.chapterId);
  if (!chapter) throw new BadRequestError("Chapter not found");

  const content = new ChapterContentModel({
    ...body,
    chapterId: params.chapterId,
  });
  await content.save();

  set.status = 201;
  return { success: true, data: content };
}, {
  params: t.Object({ curriculumId: t.String(), grade: t.String(), chapterId: t.String() }),
  body: t.Object({
    type: t.Union([
      t.Literal("video"), t.Literal("ppt"), t.Literal("pdf"),
      t.Literal("activity"), t.Literal("quiz"), t.Literal("project"), t.Literal("note")
    ]),
    title: t.String(),
    videoUrl: t.Optional(t.String()),
    fileUrl: t.Optional(t.String()),
    durationMinutes: t.Optional(t.Number()),
    questions: t.Optional(t.Array(t.Any())),
    projectInstructions: t.Optional(t.String()),
    isFree: t.Optional(t.Boolean()),
    order: t.Number(),
  }),
})

// LIST Content
.get("/:curriculumId/grades/:grade/chapters/:chapterId/content", async ({ params, headers }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const contents = await ChapterContentModel.find({ chapterId: params.chapterId })
    .sort({ order: 1 });

  return { success: true, data: contents };
}, { params: t.Object({ curriculumId: t.String(), grade: t.String(), chapterId: t.String() }) })

// UPDATE Content
.patch("/:curriculumId/grades/:grade/chapters/:chapterId/content/:contentId", async ({ params, body, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const content = await ChapterContentModel.findByIdAndUpdate(
    params.contentId,
    { $set: body },
    { new: true }
  );

  if (!content) throw new BadRequestError("Content not found");

  set.status = 200;
  return { success: true, data: content };
}, {
  params: t.Object({ curriculumId: t.String(), grade: t.String(), chapterId: t.String(), contentId: t.String() }),
  body: t.Partial(t.Object({ /* same as create */ })),
})

// REORDER Content
.post("/:curriculumId/grades/:grade/chapters/:chapterId/content/reorder", async ({ params, body, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const updates = body.map(({ contentId, order }) =>
    ChapterContentModel.updateOne({ _id: contentId }, { order })
  );
  await Promise.all(updates);

  set.status = 200;
  return { success: true, message: "Content reordered" };
}, {
  params: t.Object({ curriculumId: t.String(), grade: t.String(), chapterId: t.String() }),
  body: t.Array(t.Object({ contentId: t.String(), order: t.Number() })),
})

// DELETE Content
.delete("/:curriculumId/grades/:grade/chapters/:chapterId/content/:contentId", async ({ params, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const result = await ChapterContentModel.findByIdAndDelete(params.contentId);
  if (!result) throw new BadRequestError("Content not found");

  set.status = 200;
  return { success: true, message: "Content deleted" };
}, { params: t.Object({ curriculumId: t.String(), grade: t.String(), chapterId: t.String(), contentId: t.String() }) });