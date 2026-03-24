import { Schema, model, Document, Types } from "mongoose";

type StaffType = "teacher" | "admin";

export interface IStaff extends Document {
  name: string;
  email: string;
  mobileNumber: string;
  type: StaffType | string;
  subjects?: string[]; // For teachers
  assignedClasses?: Types.ObjectId[]; // Classes assigned to this staff
  joiningDate?: Date;
  profileImage?: string;
  institutionId: Types.ObjectId;
  isActive: boolean;
  isDeleted: boolean;
  password?: string;
  lastLogin?: Date;
}

const staffSchema = new Schema<IStaff>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, maxlength: 100 },
    mobileNumber: { type: String, required: true, trim: true, maxlength: 15 },
    password: { type: String, required: true },
    type: {
      type: String,
      enum: ["teacher", "admin"],
      default: "teacher",
    },
    subjects: [{ type: String, trim: true }],
    assignedClasses: [{ type: Schema.Types.ObjectId, ref: "Class" }],
    joiningDate: { type: Date, default: Date.now },
    profileImage: { type: String },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

staffSchema.index({ institutionId: 1, isDeleted: 1 });

// Password hashing middleware
staffSchema.pre("save", async function (next) {
  const staff = this;

  if (!staff.isModified("password")) {
    return next();
  }

  // Handle case where password might be undefined (though required)
  if (staff.password) {
      try {
        // Check if password is already hashed (bcrypt hashes start with $2)
        if (!staff.password.startsWith('$2')) {
          staff.password = await Bun.password.hash(staff.password, {
            algorithm: "bcrypt",
            cost: 10
          });
        }
      } catch (error) {
        console.error("Password hashing error:", error);
        throw error;
      }
  }
  next();
});

export const StaffModel = model<IStaff>("Staff", staffSchema);