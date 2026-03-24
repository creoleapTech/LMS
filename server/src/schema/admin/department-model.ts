import { Schema, model, Document, Types } from "mongoose";

export interface IDepartment extends Document {
  name: string;
  institutionId: Types.ObjectId;
  isActive: boolean;
  isDeleted: boolean;
}

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
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

departmentSchema.index({ institutionId: 1 });
export const DepartmentModel = model<IDepartment>("Department", departmentSchema);