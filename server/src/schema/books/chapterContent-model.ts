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
      enum: ["video", "youtube", "ppt", "pdf", "activity", "quiz", "project", "note", "text"],
      required: true,
    },
    title: { type: String, required: true },
    // Media
    videoUrl: String,
    fileUrl: String,
    embedCode: String,
    durationMinutes: Number,

    // YouTube
    youtubeUrl: String,

    // Rich Text
    textContent: String,

    // Quiz
    questions: [
      {
        questionText: { type: String },
        questionMedia: {
          type: { type: String, enum: ["image", "video"] },
          url: String,
        },
        answerType: {
          type: String,
          enum: ["multiple_choice", "fill_blank", "paragraph", "match_following"],
        },
        options: [String],
        correctAnswer: Number,
        correctTextAnswer: String,
        matchPairs: [
          {
            left: String,
            right: String,
          },
        ],
        explanation: String,
        points: { type: Number, default: 1 },
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
