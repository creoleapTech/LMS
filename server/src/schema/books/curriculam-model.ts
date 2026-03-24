// models/Curriculum.js
import mongoose, { model } from "mongoose";

const CurriculumSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: { type: String },
    thumbnail: { type: String },
    banner: { type: String },
    tags: [{ type: String }],
    level: [{
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
    }],
    grades: {
      type: [Number], // e.g., [1,2,3,4,5,6,7,8,9,10,11,12]
      default: [],
    },
    isPublished: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-generate slug before saving
CurriculumSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  next();
});

export const CurriculumModel = model("Curriculum", CurriculumSchema);
