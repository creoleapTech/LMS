// controllers/curriculum/gradebook.controller.ts
import { BadRequestError } from "@/lib/shared/bad-request";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { CurriculumModel } from "@/schema/books/curriculam-model";
import { GradeBookModel } from "@/schema/books/gradeBook-model";

import Elysia, { t } from "elysia";
import { Types } from "mongoose";

interface DecodedToken {
  role: string;
  institutionId?: Types.ObjectId | string;
}

export const gradeBookController = new Elysia({
  prefix: "/gradeBook",
  tags: ["GradeBook (Super Admin Only)"],
})

// CREATE GradeBook
.post("/:curriculumId/grades", async ({ params, body, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") {
    throw new ForbiddenError("Invalid authentication token");
  }
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") {
    throw new ForbiddenError("Only super_admin can manage grade books");
  }

  const curriculum = await CurriculumModel.findById(params.curriculumId);
  if (!curriculum) throw new BadRequestError("Curriculum not found");

  const existing = await GradeBookModel.findOne({
    curriculumId: params.curriculumId,
    grade: body.grade,
  });
  if (existing) throw new BadRequestError("Grade book already exists for this grade");

  const gradeBook = new GradeBookModel({
    ...body,
    curriculumId: params.curriculumId,
  });
  await gradeBook.save();

  set.status = 201;
  return { success: true, data: gradeBook };
}, {
  params: t.Object({ curriculumId: t.String() }),
  body: t.Object({
    grade: t.Number({ minimum: 1, maximum: 12 }),
    bookTitle: t.String({ minLength: 3 }),
    subtitle: t.Optional(t.String()),
    coverImage: t.Optional(t.String()),
    description: t.Optional(t.String()),
    isPublished: t.Optional(t.Boolean()),
  }),
})

// LIST GradeBooks by Curriculum
.get("/:curriculumId/grades", async ({ params, headers }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const gradeBooks = await GradeBookModel.find({ curriculumId: params.curriculumId })
    .sort({ grade: 1 })
    .populate("curriculumId", "name");

  return { success: true, data: gradeBooks };
}, { params: t.Object({ curriculumId: t.String() }) })

// UPDATE GradeBook
.patch("/:curriculumId/grades/:grade", async ({ params, body, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const gradeBook = await GradeBookModel.findOneAndUpdate(
    { curriculumId: params.curriculumId, grade: Number(params.grade) },
    { $set: body },
    { new: true, runValidators: true }
  );

  if (!gradeBook) throw new BadRequestError("Grade book not found");

  set.status = 200;
  return { success: true, data: gradeBook };
}, {
  params: t.Object({ curriculumId: t.String(), grade: t.String() }),
  body: t.Partial(t.Object({
    bookTitle: t.String(),
    subtitle: t.String(),
    coverImage: t.String(),
    description: t.String(),
    isPublished: t.Boolean(),
  })),
})

// DELETE GradeBook (soft delete or hard)
.delete("/:curriculumId/grades/:grade", async ({ params, headers, set }) => {
  if (!headers.decoded || typeof headers.decoded === "string") throw new ForbiddenError("Invalid token");
  const decoded = headers.decoded as DecodedToken;
  if (decoded.role !== "super_admin") throw new ForbiddenError("Access denied");

  const result = await GradeBookModel.deleteOne({
    curriculumId: params.curriculumId,
    grade: Number(params.grade),
  });

  if (result.deletedCount === 0) throw new BadRequestError("Grade book not found");

  set.status = 200;
  return { success: true, message: "Grade book deleted" };
}, { params: t.Object({ curriculumId: t.String(), grade: t.String() }) });