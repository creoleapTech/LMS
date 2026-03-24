
import { Schema, model, Document, Types } from "mongoose";

export interface IClassSession extends Document {
  staffId: Types.ObjectId;
  institutionId: Types.ObjectId;
  classId: Types.ObjectId;
  courseId?: Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  remarks?: string;
  topicsCovered?: string[];
  status: "ongoing" | "completed";
}

const classSessionSchema = new Schema<IClassSession>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", required: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" }, // Optional: If tracking specific course
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    durationMinutes: { type: Number },
    remarks: { type: String, trim: true },
    topicsCovered: [{ type: String }],
    status: { type: String, enum: ["ongoing", "completed"], default: "ongoing" },
  },
  { timestamps: true }
);

classSessionSchema.index({ staffId: 1, startTime: -1 });
classSessionSchema.index({ institutionId: 1 });
classSessionSchema.index({ classId: 1 });

export const ClassSessionModel = model<IClassSession>("ClassSession", classSessionSchema);
