import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IUserNotificationPrefs {
  emailNotifications: boolean;
  smsNotifications: boolean;
  attendanceAlerts: boolean;
  examResults: boolean;
  announcements: boolean;
}

export interface IUserPreferences extends Document {
  userId: Types.ObjectId;
  userModel: "Admin" | "Staff";
  institutionId?: Types.ObjectId;
  language: string;
  theme: "light" | "dark" | "system";
  notificationPreferences: IUserNotificationPrefs;
  isDeleted: boolean;
}

const userPreferencesSchema = new Schema<IUserPreferences>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    userModel: {
      type: String,
      enum: ["Admin", "Staff"],
      required: true,
    },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
    },
    language: { type: String, default: "en" },
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    notificationPreferences: {
      type: new Schema(
        {
          emailNotifications: { type: Boolean, default: true },
          smsNotifications: { type: Boolean, default: false },
          attendanceAlerts: { type: Boolean, default: true },
          examResults: { type: Boolean, default: true },
          announcements: { type: Boolean, default: true },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userPreferencesSchema.index({ userId: 1, userModel: 1 }, { unique: true });

export const UserPreferencesModel =
  mongoose.models.UserPreferences ||
  model<IUserPreferences>("UserPreferences", userPreferencesSchema);
