import { Schema, model, Document, Types } from "mongoose";

export interface IContentProgress {
  contentId: Types.ObjectId;
  chapterId: Types.ObjectId;
  isCompleted: boolean;
  completedAt?: Date;
  videoTimestamp?: number;
  pdfPage?: number;
  lastAccessedAt: Date;
}

export interface ITeachingProgress extends Document {
  staffId: Types.ObjectId;
  classId: Types.ObjectId;
  gradeBookId: Types.ObjectId;
  institutionId: Types.ObjectId;
  contentProgress: IContentProgress[];
  overallPercentage: number;
  lastAccessedContentId?: Types.ObjectId;
  lastAccessedAt: Date;
}

const contentProgressSchema = new Schema<IContentProgress>(
  {
    contentId: { type: Schema.Types.ObjectId, ref: "ChapterContent", required: true },
    chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    videoTimestamp: { type: Number },
    pdfPage: { type: Number },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const teachingProgressSchema = new Schema<ITeachingProgress>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    gradeBookId: { type: Schema.Types.ObjectId, ref: "GradeBook", required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", required: true },
    contentProgress: [contentProgressSchema],
    overallPercentage: { type: Number, default: 0 },
    lastAccessedContentId: { type: Schema.Types.ObjectId },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

teachingProgressSchema.index({ staffId: 1, classId: 1, gradeBookId: 1 }, { unique: true });
teachingProgressSchema.index({ institutionId: 1 });
teachingProgressSchema.index({ staffId: 1, lastAccessedAt: -1 });

export const TeachingProgressModel = model<ITeachingProgress>(
  "TeachingProgress",
  teachingProgressSchema
);
