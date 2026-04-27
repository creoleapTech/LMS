// controllers/curriculum.controller.ts
import Elysia, { t } from "elysia";
import { BadRequestError } from "@/lib/shared/bad-request";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { Types } from "mongoose";
import { CurriculumModel } from "@/schema/books/curriculam-model";
import { GradeBookModel } from "@/schema/books/gradeBook-model";
import { ChapterModel } from "@/schema/books/chapter-model";
import { ChapterContentModel } from "@/schema/books/chapterContent-model";
import { deleteFile, saveFile } from "@/lib/file";
import { superAdminAuthMacro } from "@/modules/superAdmin/superAdmin-macro";

interface DecodedToken {
  role: string;
  institutionId?: Types.ObjectId | string;
}

export const curriculumController = new Elysia({
  prefix: "/curriculum",
  tags: ["Curriculum System (Super Admin Only)"],
})
  .use(superAdminAuthMacro)
  .guard({
    isAuth: true
  })

  // ===================== CURRICULUM (Branches) =====================
  .post("/", async ({ body, user, set }) => {
    if (user.role !== "super_admin") {
      throw new ForbiddenError("Only super_admin can create curriculums");
    }

    const existing = await CurriculumModel.findOne({ name: body.name });
    if (existing) throw new BadRequestError("Curriculum with this name already exists");

    // Handle file uploads
    let thumbnailFilename = "";
    let bannerFilename = "";

    if (body.thumbnail) {
      const result = await saveFile(body.thumbnail, "curriculum/thumbnails");
      if (result.ok) thumbnailFilename = result.filename;
    }

    if (body.banner) {
      const result = await saveFile(body.banner, "curriculum/banners");
      if (result.ok) bannerFilename = result.filename;
    }

    // Parse FormData values to correct types
    const grades = Array.isArray(body.grades) 
      ? body.grades.map((g: any) => typeof g === 'string' ? parseInt(g) : g)
      : [];
    
    const tags = Array.isArray(body.tags) 
      ? body.tags 
      : (body.tags ? [body.tags] : []);

    const level = Array.isArray(body.level)
      ? body.level
      : (body.level ? [body.level] : []);
    
    const isPublished = typeof body.isPublished === 'string' 
      ? body.isPublished === 'true' 
      : body.isPublished;

    const curriculumData = {
      name: body.name,
      description: body.description,
      level,
      grades,
      tags,
      isPublished,
      thumbnail: thumbnailFilename,
      banner: bannerFilename,
    };

    const curriculum = new CurriculumModel(curriculumData);
    await curriculum.save();

    set.status = 201;
    return { 
      success: true, 
      data: {
        ...curriculum.toObject(),
        thumbnail: thumbnailFilename || "",
        banner: bannerFilename || ""
      }
    };
  }, {
    body: t.Object({
      name: t.String({ minLength: 3, maxLength: 100 }),
      description: t.Optional(t.String()),
      thumbnail: t.Optional(t.File()),
      banner: t.Optional(t.File()),
      tags: t.Optional(t.Union([t.Array(t.String()), t.String()])),
      level: t.Optional(t.Union([t.Array(t.String()), t.String()])),
      grades: t.Union([t.Array(t.Union([t.Number(), t.String()])), t.String()]),
      isPublished: t.Optional(t.Union([t.Boolean(), t.String()])),
    }),
    detail: { summary: "Create new curriculum branch" }
  })

  .get("/", async ({ query, user, set }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const { page = 1, limit = 10, published, search } = query;
    const filter: any = {};
    if (published !== undefined) filter.isPublished = published === "true";
    
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const curriculums = await CurriculumModel.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    const total = await CurriculumModel.countDocuments(filter);

    set.status = 200;
    return { 
      success: true, 
      data: curriculums, 
      meta: { total, page: +page, limit: +limit } 
    };
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      published: t.Optional(t.String()),
      search: t.Optional(t.String()),
    }),
  })

  .get("/curr/:id", async ({ params, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const curriculum = await CurriculumModel.findById(params.id);
    if (!curriculum) throw new BadRequestError("Curriculum not found");

    return { 
      success: true, 
      data: curriculum
    };
  }, { params: t.Object({ id: t.String() }) })

  .patch("/:id", async ({ params, body, user, set }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const existingCurriculum = await CurriculumModel.findById(params.id);
    if (!existingCurriculum) throw new BadRequestError("Curriculum not found");

    // Handle file uploads and deletions
    let updateData: any = { ...body };
    // Remove File objects — only re-add as string filename if successfully saved
    delete updateData.thumbnail;
    delete updateData.banner;

    if (body.thumbnail) {
      // Delete old thumbnail if exists
      if (existingCurriculum.thumbnail) {
        await deleteFile(existingCurriculum.thumbnail, "curriculum/thumbnails");
      }
      
      const result = await saveFile(body.thumbnail, "curriculum/thumbnails");
      if (result.ok) updateData.thumbnail = result.filename;
    }

    if (body.banner) {
      // Delete old banner if exists
      if (existingCurriculum.banner) {
        await deleteFile(existingCurriculum.banner, "curriculum/banners");
      }
      
      const result = await saveFile(body.banner, "curriculum/banners");
      if (result.ok) updateData.banner = result.filename;
    }

    // Parse FormData values for update
    if (updateData.grades) {
      updateData.grades = Array.isArray(updateData.grades)
        ? updateData.grades.map((g: any) => typeof g === 'string' ? parseInt(g) : g)
        : [];
    }
    
    if (updateData.tags) {
      updateData.tags = Array.isArray(updateData.tags)
        ? updateData.tags
        : (updateData.tags ? [updateData.tags] : []);
    }

    if (updateData.level) {
      updateData.level = Array.isArray(updateData.level)
        ? updateData.level
        : [updateData.level];
    }
    
    if (typeof updateData.isPublished === 'string') {
      updateData.isPublished = updateData.isPublished === 'true';
    }

    const curriculum = await CurriculumModel.findByIdAndUpdate(
      params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!curriculum) throw new BadRequestError("Curriculum not found");

    set.status = 200;
    return { 
      success: true, 
      data: curriculum
    };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Partial(t.Object({
      name: t.String(),
      description: t.String(),
      thumbnail: t.Optional(t.File()),
      banner: t.Optional(t.File()),
      tags: t.Union([t.Array(t.String()), t.String()]),
      level: t.Union([t.Array(t.String()), t.String()]),
      grades: t.Union([t.Array(t.Union([t.Number(), t.String()])), t.String()]),
      isPublished: t.Union([t.Boolean(), t.String()]),
      order: t.Number(),
    })),
  })

  .delete("/:id", async ({ params, user, set }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const curriculum = await CurriculumModel.findById(params.id);
    if (!curriculum) throw new BadRequestError("Curriculum not found");

    // Delete associated files
    if (curriculum.thumbnail) {
      await deleteFile(curriculum.thumbnail, "curriculum/thumbnails");
    }
    if (curriculum.banner) {
      await deleteFile(curriculum.banner, "curriculum/banners");
    }

    await CurriculumModel.findByIdAndDelete(params.id);
    set.status = 200;
    return { success: true, message: "Curriculum deleted" };
  }, { params: t.Object({ id: t.String() }) })

  // ===================== GRADE BOOKS =====================
  .post("/:curriculumId/grades", async ({ params, body, user, set }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const curriculum = await CurriculumModel.findById(params.curriculumId);
    if (!curriculum) throw new BadRequestError("Curriculum not found");

    // Parse FormData values
    const grade = typeof body.grade === 'string' ? parseInt(body.grade) : body.grade;
    const isPublished = typeof body.isPublished === 'string' 
      ? body.isPublished === 'true' 
      : body.isPublished;

    const existing = await GradeBookModel.findOne({
      curriculumId: params.curriculumId,
      grade: grade,
    });
    if (existing) throw new BadRequestError("Grade book already exists for this grade");

    // Handle cover image upload
    let coverImageFilename = "";
    if (body.coverImage) {
      const result = await saveFile(body.coverImage, "gradebook/covers");
      if (result.ok) coverImageFilename = result.filename;
    }

    const gradeBookData = {
      ...body,
      grade,
      isPublished,
      curriculumId: params.curriculumId,
      coverImage: coverImageFilename,
    };

    const gradeBook = new GradeBookModel(gradeBookData);
    await gradeBook.save();

    set.status = 201;
    return { 
      success: true, 
      data: gradeBook
    };
  }, {
    params: t.Object({ curriculumId: t.String() }),
    body: t.Object({
      grade: t.Union([t.Number({ minimum: 1, maximum: 12 }), t.String()]),
      bookTitle: t.String(),
      subtitle: t.Optional(t.String()),
      coverImage: t.Optional(t.File()),
      description: t.Optional(t.String()),
      isPublished: t.Optional(t.Union([t.Boolean(), t.String()])),
    }),
  })

  .get("/:curriculumId/grades", async ({ params, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const gradeBooks = await GradeBookModel.find({ curriculumId: params.curriculumId })
      .sort({ grade: 1 });

    return { success: true, data: gradeBooks };
  }, { params: t.Object({ curriculumId: t.String() }) })

  .patch("/gradebook/:id", async ({ params, body, user, set }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const existingGradeBook = await GradeBookModel.findById(params.id);
    if (!existingGradeBook) throw new BadRequestError("Grade book not found");

    let updateData: any = { ...body };
    // Remove File object — only re-add as string filename if successfully saved
    delete updateData.coverImage;
    
    // Parse FormData values
    if (updateData.isPublished !== undefined) {
      updateData.isPublished = typeof updateData.isPublished === 'string' 
        ? updateData.isPublished === 'true' 
        : updateData.isPublished;
    }

    if (body.coverImage) {
      // Delete old cover image if exists
      if (existingGradeBook.coverImage) {
        await deleteFile(existingGradeBook.coverImage, "gradebook/covers");
      }
      
      const result = await saveFile(body.coverImage, "gradebook/covers");
      if (result.ok) updateData.coverImage = result.filename;
    }

    const gradeBook = await GradeBookModel.findByIdAndUpdate(
      params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!gradeBook) throw new BadRequestError("Grade book not found");

    set.status = 200;
    return { 
      success: true, 
      data: gradeBook
    };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Partial(t.Object({
      bookTitle: t.String(),
      subtitle: t.String(),
      coverImage: t.Optional(t.File()),
      description: t.String(),
      isPublished: t.Union([t.Boolean(), t.String()]),
    })),
  })

  .delete("/gradebook/:id", async ({ params, user, set }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const gradeBook = await GradeBookModel.findById(params.id);
    if (!gradeBook) throw new BadRequestError("Grade book not found");

    // Delete associated cover image
    if (gradeBook.coverImage) {
      await deleteFile(gradeBook.coverImage, "gradebook/covers");
    }

    await GradeBookModel.findByIdAndDelete(params.id);

    set.status = 200;
    return { success: true, message: "Grade book deleted" };
  }, { params: t.Object({ id: t.String() }) })

  // ===================== CHAPTERS =====================
  .get("/gradebook/:gradeBookId/chapters", async ({ params, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");
    
    const chapters = await ChapterModel.find({ gradeBookId: params.gradeBookId })
      .sort({ order: 1 });
    
    return { success: true, data: chapters };
  }, { params: t.Object({ gradeBookId: t.String() }) })

  .post("/gradebook/:gradeBookId/chapters", async ({ params, body, user, set }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const gradeBook = await GradeBookModel.findById(params.gradeBookId);
    if (!gradeBook) throw new BadRequestError("Grade book not found");

    const count = await ChapterModel.countDocuments({ gradeBookId: params.gradeBookId });

    const chapter = new ChapterModel({
      ...body,
      gradeBookId: params.gradeBookId,
      order: count + 1,
    });
    await chapter.save();

    set.status = 201;
    return { success: true, data: chapter };
  }, {
    params: t.Object({ gradeBookId: t.String() }),
    body: t.Object({
      title: t.String(),
      chapterNumber: t.Number(),
      description: t.Optional(t.String()),
      learningObjectives: t.Optional(t.String()),
    })
  })

  .post("/gradebook/:gradeBookId/chapters/reorder", async ({ params, body, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const { order } = body;
    
    // Bulk write for performance
    const operations = order.map((item: { chapterId: string; order: number }) => ({
      updateOne: {
        filter: { _id: item.chapterId, gradeBookId: params.gradeBookId },
        update: { $set: { order: item.order } }
      }
    }));

    if (operations.length > 0) {
      await ChapterModel.bulkWrite(operations);
    }

    return { success: true, message: "Chapters reordered" };
  }, {
    params: t.Object({ gradeBookId: t.String() }),
    body: t.Object({
      order: t.Array(t.Object({
        chapterId: t.String(),
        order: t.Number()
      }))
    })
  })

  .patch("/chapters/:id", async ({ params, body, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const chapter = await ChapterModel.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true }
    );
    if (!chapter) throw new BadRequestError("Chapter not found");

    return { success: true, data: chapter };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Partial(t.Object({
      title: t.String(),
      chapterNumber: t.Number(),
      description: t.String(),
      learningObjectives: t.String(),
    }))
  })

  .delete("/chapters/:id", async ({ params, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");
    await ChapterModel.findByIdAndDelete(params.id);
    return { success: true, message: "Chapter deleted" };
  }, { params: t.Object({ id: t.String() }) })

  // ===================== CHAPTER CONTENT =====================
  .get("/chapter/:chapterId/content", async ({ params, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");
    
    const content = await ChapterContentModel.find({ chapterId: params.chapterId })
      .sort({ order: 1 });
    
    return { success: true, data: content };
  }, { params: t.Object({ chapterId: t.String() }) })

  .post("/chapter/:chapterId/content", async ({ params, body, user, set }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const chapter = await ChapterModel.findById(params.chapterId);
    if (!chapter) throw new BadRequestError("Chapter not found");

    const maxOrderDoc = await ChapterContentModel.findOne(
      { chapterId: params.chapterId },
      { order: 1 },
      { sort: { order: -1 } }
    );
    const count = maxOrderDoc?.order ?? 0;

    // Handle file upload
    let fileFilename = "";
    if (body.file) {
       // Determine folder based on type
       const folder = body.type === 'video' ? 'content/videos' : 'content/docs';
       const result = await saveFile(body.file, folder);
       if (result.ok) fileFilename = result.filename;
    }

    const contentData: any = {
      chapterId: params.chapterId,
      type: body.type,
      title: body.title || `${chapter.chapterNumber}.${count + 1}`,
      order: count + 1,
      isFree: body.isFree === 'true' || body.isFree === true,
    };

    if (body.type === 'youtube') {
      contentData.youtubeUrl = body.youtubeUrl;
    } else if (body.type === 'text') {
      contentData.textContent = body.textContent;
    } else if (body.type === 'quiz') {
      if (body.questions) {
        try {
          contentData.questions = typeof body.questions === 'string'
            ? JSON.parse(body.questions)
            : body.questions;
        } catch { /* ignore parse errors */ }
      }
      if (fileFilename) contentData.fileUrl = fileFilename;
    } else if (body.type === 'video') {
      contentData.videoUrl = fileFilename;
    } else {
      contentData.fileUrl = fileFilename;
    }

    const content = new ChapterContentModel(contentData);
    await content.save();

    set.status = 201;
    return { success: true, data: content };
  }, {
    params: t.Object({ chapterId: t.String() }),
    body: t.Object({
      type: t.String(),
      title: t.Optional(t.String()),
      file: t.Optional(t.File()),
      isFree: t.Optional(t.Union([t.Boolean(), t.String()])),
      youtubeUrl: t.Optional(t.String()),
      textContent: t.Optional(t.String()),
      questions: t.Optional(t.Any()),
    })
  })

  .delete("/content/:id", async ({ params, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const content = await ChapterContentModel.findById(params.id);
    if (!content) throw new BadRequestError("Content not found");

    if (content.fileUrl) await deleteFile(content.fileUrl, "content/docs");
    if (content.videoUrl) await deleteFile(content.videoUrl, "content/videos");

    await ChapterContentModel.findByIdAndDelete(params.id);
    return { success: true, message: "Content deleted" };
  }, { params: t.Object({ id: t.String() }) })

  .patch("/content/:id", async ({ params, body, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const content = await ChapterContentModel.findByIdAndUpdate(
      params.id,
      { $set: { title: body.title } },
      { new: true }
    );
    if (!content) throw new BadRequestError("Content not found");

    return { success: true, data: content };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({ title: t.String() })
  })

  .post("/chapter/:chapterId/content/reorder", async ({ params, body, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");

    const { order } = body;

    // Two-pass to avoid unique index conflicts on {chapterId, order}
    const negOps = order.map((item: { contentId: string; order: number }, i: number) => ({
      updateOne: {
        filter: { _id: item.contentId, chapterId: params.chapterId },
        update: { $set: { order: -(i + 1) } }
      }
    }));
    if (negOps.length > 0) await ChapterContentModel.bulkWrite(negOps);

    const finalOps = order.map((item: { contentId: string; order: number }) => ({
      updateOne: {
        filter: { _id: item.contentId, chapterId: params.chapterId },
        update: { $set: { order: item.order } }
      }
    }));
    if (finalOps.length > 0) await ChapterContentModel.bulkWrite(finalOps);

    return { success: true, message: "Content reordered" };
  }, {
    params: t.Object({ chapterId: t.String() }),
    body: t.Object({
      order: t.Array(t.Object({
        contentId: t.String(),
        order: t.Number()
      }))
    })
  })

  // ===================== GLOBAL LISTS (For Tabs) =====================
  .get("/all-gradebooks", async ({ query, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");
    
    const { page = 1, limit = 10, search } = query;
    const filter: any = {};
    
    if (search) {
      filter.bookTitle = { $regex: search, $options: "i" };
    }

    const gradeBooks = await GradeBookModel.find(filter)
      .populate('curriculumId', 'name')
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);
      
    const total = await GradeBookModel.countDocuments(filter);

    return { 
      success: true, 
      data: gradeBooks,
      meta: { total, page: +page, limit: +limit }
    };
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      search: t.Optional(t.String()),
    })
  })

  .get("/all-chapters", async ({ query, user }) => {
    if (user.role !== "super_admin") throw new ForbiddenError("Access denied");
    
    const { page = 1, limit = 10, search } = query;
    const filter: any = {};
    
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    const chapters = await ChapterModel.find(filter)
      .populate({
        path: 'gradeBookId',
        select: 'bookTitle curriculumId',
        populate: { path: 'curriculumId', select: 'name' }
      })
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);
      
    const total = await ChapterModel.countDocuments(filter);

    return { 
      success: true, 
      data: chapters,
      meta: { total, page: +page, limit: +limit }
    };
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      search: t.Optional(t.String()),
    })
  });