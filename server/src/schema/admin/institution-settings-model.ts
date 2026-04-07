import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IGradeScaleEntry {
  grade: string;
  label: string;
  minPercentage: number;
  maxPercentage: number;
}

export interface IInstitutionNotificationPrefs {
  newStudentRegistration: boolean;
  feePaymentReceived: boolean;
  attendanceAlert: boolean;
  examResultsPublished: boolean;
  holidayAnnouncement: boolean;
}

export interface IInstitutionSettings extends Document {
  institutionId: Types.ObjectId;
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  enableStudentPortal: boolean;
  enableParentPortal: boolean;
  gradingScale: IGradeScaleEntry[];
  passingMarks: number;
  notificationPreferences: IInstitutionNotificationPrefs;
  sessionTimeout: number;
  isDeleted: boolean;
}

const gradeScaleEntrySchema = new Schema<IGradeScaleEntry>(
  {
    grade: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    minPercentage: { type: Number, required: true, min: 0, max: 100 },
    maxPercentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const institutionSettingsSchema = new Schema<IInstitutionSettings>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    language: {
      type: String,
      enum: ["en", "hi", "es"],
      default: "en",
    },
    timezone: { type: String, default: "Asia/Kolkata" },
    dateFormat: {
      type: String,
      enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"],
      default: "DD/MM/YYYY",
    },
    currency: {
      type: String,
      enum: ["INR", "USD", "EUR"],
      default: "INR",
    },
    enableStudentPortal: { type: Boolean, default: true },
    enableParentPortal: { type: Boolean, default: true },
    gradingScale: {
      type: [gradeScaleEntrySchema],
      default: [
        { grade: "O", label: "Outstanding", minPercentage: 90, maxPercentage: 100 },
        { grade: "A+", label: "Excellent", minPercentage: 80, maxPercentage: 89 },
        { grade: "A", label: "Very Good", minPercentage: 70, maxPercentage: 79 },
        { grade: "B+", label: "Good", minPercentage: 60, maxPercentage: 69 },
        { grade: "C", label: "Average", minPercentage: 50, maxPercentage: 59 },
        { grade: "D", label: "Below Average", minPercentage: 40, maxPercentage: 49 },
        { grade: "F", label: "Fail", minPercentage: 0, maxPercentage: 39 },
      ],
    },
    passingMarks: { type: Number, default: 40, min: 0, max: 100 },
    notificationPreferences: {
      type: new Schema(
        {
          newStudentRegistration: { type: Boolean, default: true },
          feePaymentReceived: { type: Boolean, default: true },
          attendanceAlert: { type: Boolean, default: true },
          examResultsPublished: { type: Boolean, default: true },
          holidayAnnouncement: { type: Boolean, default: true },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    sessionTimeout: { type: Number, default: 30, min: 5, max: 480 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

institutionSettingsSchema.index({ institutionId: 1 }, { unique: true });

export const InstitutionSettingsModel =
  mongoose.models.InstitutionSettings ||
  model<IInstitutionSettings>("InstitutionSettings", institutionSettingsSchema);
