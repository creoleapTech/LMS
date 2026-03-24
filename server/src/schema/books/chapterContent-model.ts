// models/ChapterContent.js
import mongoose, { model } from "mongoose";

const ChapterContentSchema = new mongoose.Schema(
  {
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
    },
    type: {
      type: String,
      enum: ["video", "ppt", "pdf", "activity", "quiz", "project", "note"],
      required: true,
    },
    title: { type: String, required: true },
    // Media
    videoUrl: String,
    fileUrl: String,
    embedCode: String,
    durationMinutes: Number,

    // Quiz
    questions: [
      {
        question: String,
        options: [String],
        correctAnswer: Number,
        explanation: String,
      },
    ],

    // Project / Activity
    projectInstructions: String,
    submissionType: { type: String, enum: ["file", "text", "link", "none"] },

    // Common
    isFree: { type: Boolean, default: false },
    order: { type: Number, required: true },
  },
  { timestamps: true }
);

ChapterContentSchema.index({ chapterId: 1, order: 1 }, { unique: true });
export const ChapterContentModel = model("ChapterContent", ChapterContentSchema);
