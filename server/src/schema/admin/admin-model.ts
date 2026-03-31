import mongoose, { Schema, model, Document, Types } from "mongoose";

export type AdminRoles = 'super_admin' | 'admin';
interface Admin extends Document {
  email: string;
  mobileNumber?: string;
  password: string;
  lastLogin?: Date;
  lastIp?: string;
  lastUserAgent?: string;
  name?: string;
  role: AdminRoles;
  institutionId?: Types.ObjectId; // Reference to Institution document
  profileImage?: string;
  fcmToken?: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<Admin>(
  {
    email: { 
      type: String, 
      unique: true, 
      lowercase: true, 
      required: true,
      maxlength: 100
    },
    mobileNumber: { 
      type: String, 
      maxlength: 10 
    },
    password: { 
      type: String, 
      required: true,
      maxlength: 255 
    },
    lastLogin: { 
      type: Date, 
      default: null 
    },
    lastIp: { 
      type: String, 
      maxlength: 45 
    },
    lastUserAgent: { 
      type: String, 
      maxlength: 255 
    },
    name: { 
      type: String, 
      maxlength: 100 
    },
    role: { 
      type: String, 
      enum: ['super_admin', 'admin'],
      default: 'admin',
      required: true
    },
    institutionId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Institution' 
    },
    profileImage: { 
      type: String, 
      default: "" 
    },
    fcmToken: { 
      type: String, 
      default: "" 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    isDeleted: { 
      type: Boolean, 
      default: false 
    },
  },
  { 
    timestamps: true 
  }
);

// Password hashing middleware
adminSchema.pre("save", async function (next) {
  const admin = this;

  if (!admin.isModified("password")) {
    return next();
  }

  admin.password = await Bun.password.hash(admin.password, "bcrypt");
  next();
});

  
// adminSchema.methods.comparePassword = async function (password: string) {
//   return await Bun.password.verify(password, this.password, "bcrypt");
// };

  
export const AdminModel = mongoose.models.Admin || model<Admin>("Admin", adminSchema);
