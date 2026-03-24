import { Schema, model, Document, Types } from "mongoose";

export interface IClass extends Document {
  grade?: string;
  section: string;
  year?: string;
  institutionId: Types.ObjectId;
  departmentId?: Types.ObjectId;
  studentIds: Types.ObjectId[];
  teacherIds: Types.ObjectId[];
  isActive: boolean;
  isDeleted: boolean;
}

const classSchema = new Schema<IClass>(
  {
    grade: { type: String, maxlength: 50 },
    section: { type: String, required: true, uppercase: true, trim: true, maxlength: 10 },
    year: { type: String, maxlength: 50 },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    studentIds: [{ type: Schema.Types.ObjectId, ref: "Student" }],
    teacherIds: [{ type: Schema.Types.ObjectId, ref: "Staff" }],
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

classSchema.index({ institutionId: 1, isDeleted: 1 });
classSchema.index({ departmentId: 1 });

export const ClassModel = model<IClass>("Class", classSchema);