import { Schema, model, Document, Types } from "mongoose";

export interface IStudent extends Document {
  name: string;
  rollNumber?: string;
  admissionNumber?: string;
  email?: string;
  mobileNumber?: string;
  parentName: string;
  parentMobile: string;
  parentEmail?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  admissionDate?: Date;
  profileImage?: string;
  classId: Types.ObjectId;
  institutionId: Types.ObjectId;
  isActive: boolean;
  isDeleted: boolean;
}

const studentSchema = new Schema<IStudent>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    rollNumber: { type: String, maxlength: 50 },
    admissionNumber: { type: String, maxlength: 50 },
    email: { type: String, lowercase: true, trim: true, maxlength: 100 },
    mobileNumber: { type: String, trim: true, maxlength: 15 },
    parentName: { type: String, required: true, trim: true, maxlength: 100 },
    parentMobile: { type: String, required: true, trim: true, maxlength: 15 },
    parentEmail: { type: String, lowercase: true, trim: true, maxlength: 100 },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    address: { type: String, maxlength: 500 },
    admissionDate: { type: Date, default: Date.now },
    profileImage: { type: String },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

studentSchema.index({ classId: 1 });
studentSchema.index({ institutionId: 1, isDeleted: 1 });

export const StudentModel = model<IStudent>("Student", studentSchema);