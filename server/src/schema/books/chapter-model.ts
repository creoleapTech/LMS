// models/Chapter.js
import mongoose, { model } from "mongoose";

const ChapterSchema = new mongoose.Schema(
  {
    gradeBookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GradeBook",
      required: true,
    },
    title: { type: String, required: true },
    chapterNumber: { type: Number, required: true },
    description: String,
    durationMinutes: { type: Number, default: 0 },
    isFree: { type: Boolean, default: false },
    order: { type: Number, required: true },
  },
  { timestamps: true }
);

// Unique order within a grade book
ChapterSchema.index({ gradeBookId: 1, order: 1 }, { unique: true });
export const ChapterModel = model("Chapter", ChapterSchema);
