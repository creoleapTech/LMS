import mongoose, { Schema, model, Document, Types } from "mongoose";

type InstitutionType = "school" | "college";

export interface IInstitution extends Document {
  name: string;
  type: InstitutionType;
  address: string;
  contactDetails: {
    inchargePerson: string;
    mobileNumber: string;
    email?: string;
    officePhone?: string;
  };
  adminIds: Types.ObjectId[];
  staffIds: Types.ObjectId[];
  curriculumAccess: Array<{
    curriculumId: Types.ObjectId;
    accessibleGradeBooks: Types.ObjectId[]; // Array of GradeBook IDs this institution can access
  }>;
  isActive: boolean;
  isDeleted: boolean;
}

const institutionSchema = new Schema<IInstitution>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    type: { type: String, enum: ["school", "college"], required: true },
    address: { type: String, required: true, maxlength: 255 },
    contactDetails: {
      inchargePerson: { type: String, required: true, maxlength: 100 },
      mobileNumber: { type: String, required: true, maxlength: 15 },
      email: { type: String, lowercase: true },
      officePhone: { type: String, maxlength: 15 },
    },
    adminIds: [{ type: Schema.Types.ObjectId, ref: "Admin" }],
    staffIds: [{ type: Schema.Types.ObjectId, ref: "Staff" }],
    curriculumAccess: [{
      curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
      accessibleGradeBooks: [{ type: Schema.Types.ObjectId, ref: "GradeBook" }]
    }],
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const InstitutionModel = mongoose.models.Institution || model<IInstitution>("Institution", institutionSchema);