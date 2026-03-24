// models/GradeBook.js
import mongoose, { model } from "mongoose";

const GradeBookSchema = new mongoose.Schema(
  {
    curriculumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Curriculum",
      required: true,
    },
    grade: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    bookTitle: { type: String, required: true },
    subtitle: String,
    coverImage: String,
    description: String,
    totalChapters: { type: Number, default: 0 },
    totalVideos: { type: Number, default: 0 },
    totalActivities: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Unique: one book per curriculum per grade
GradeBookSchema.index({ curriculumId: 1, grade: 1 }, { unique: true });

export const GradeBookModel = model("GradeBook", GradeBookSchema);
