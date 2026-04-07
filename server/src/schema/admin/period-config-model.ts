import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IPeriodSlot {
  periodNumber: number;
  label?: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

export interface IPeriodConfig extends Document {
  institutionId: Types.ObjectId;
  periods: IPeriodSlot[];
  workingDays: number[];
  isDeleted: boolean;
}

const periodSlotSchema = new Schema<IPeriodSlot>(
  {
    periodNumber: { type: Number, required: true, min: 1 },
    label: { type: String, trim: true, maxlength: 50 },
    startTime: { type: String, required: true, maxlength: 5 },
    endTime: { type: String, required: true, maxlength: 5 },
    isBreak: { type: Boolean, default: false },
  },
  { _id: false }
);

const periodConfigSchema = new Schema<IPeriodConfig>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    periods: { type: [periodSlotSchema], default: [] },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

periodConfigSchema.index({ institutionId: 1 }, { unique: true });

export const PeriodConfigModel =
  mongoose.models.PeriodConfig ||
  model<IPeriodConfig>("PeriodConfig", periodConfigSchema);
