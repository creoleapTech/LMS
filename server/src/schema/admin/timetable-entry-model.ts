import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface ITimetableEntry extends Document {
  institutionId: Types.ObjectId;
  staffId: Types.ObjectId;
  classId: Types.ObjectId;
  gradeBookId?: Types.ObjectId;
  periodNumber: number;
  dayOfWeek: number;
  isRecurring: boolean;
  specificDate?: Date;
  notes?: string;
  status: "scheduled" | "completed" | "cancelled";
  topicsCovered?: string[];
  completedAt?: Date;
  isDeleted: boolean;
}

const timetableEntrySchema = new Schema<ITimetableEntry>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    gradeBookId: {
      type: Schema.Types.ObjectId,
      ref: "GradeBook",
    },
    periodNumber: { type: Number, required: true, min: 1 },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    isRecurring: { type: Boolean, default: true },
    specificDate: { type: Date },
    notes: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    topicsCovered: [{ type: String, trim: true }],
    completedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

timetableEntrySchema.index({
  institutionId: 1,
  staffId: 1,
  dayOfWeek: 1,
  isDeleted: 1,
});
timetableEntrySchema.index({
  staffId: 1,
  dayOfWeek: 1,
  periodNumber: 1,
  isRecurring: 1,
});

export const TimetableEntryModel =
  mongoose.models.TimetableEntry ||
  model<ITimetableEntry>("TimetableEntry", timetableEntrySchema);
