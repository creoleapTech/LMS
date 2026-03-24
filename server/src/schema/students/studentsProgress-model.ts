// models/StudentProgress.js
import mongoose from "mongoose";

const StudentProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    curriculumId: { type: mongoose.Schema.Types.ObjectId, ref: "Curriculum" },
    grade  : Number,
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter" },
    completedContents: [{ type: mongoose.Schema.Types.ObjectId }],
    quizScores: [{ contentId: mongoose.Schema.Types.ObjectId, score: Number }],
    lastWatchedAt: Date,
    progressPercentage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

StudentProgressSchema.index({ userId: 1, curriculumId: 1, grade: 1 }, { unique: true });

export default mongoose.models.StudentProgress || mongoose.model("StudentProgress", StudentProgressSchema);