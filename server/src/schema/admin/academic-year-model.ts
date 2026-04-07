import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IAcademicYearTerm {
  label: string;
  startDate: Date;
  endDate: Date;
}

export interface IAcademicYear extends Document {
  institutionId: Types.ObjectId;
  label: string; // e.g. "2025-2026"
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  terms: IAcademicYearTerm[];
  isDeleted: boolean;
}

const academicYearSchema = new Schema<IAcademicYear>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    terms: [
      {
        label: { type: String, required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
      },
    ],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

academicYearSchema.index({ institutionId: 1, isActive: 1 });
academicYearSchema.index({ institutionId: 1, label: 1 }, { unique: true });

export const AcademicYearModel =
  mongoose.models.AcademicYear ||
  model<IAcademicYear>("AcademicYear", academicYearSchema);
