
import { PasetoUtil } from "@/lib/paseto";
import Elysia, { t } from "elysia";
import { StaffModel } from "@/schema/admin/staff-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { Types } from "mongoose";

// Staff Auth Controller
export const staffAuthController = new Elysia({
  prefix: "/staff/auth",
  tags: ["Staff Auth"],
})

.post(
  "/login",
  async ({ body, set, request }) => {
    try {
      const { email, password } = body;

      // Find staff by email
      const staff = await StaffModel.findOne({ 
        email, 
        isDeleted: false 
      });
      
      if (!staff) {
        throw new BadRequestError("Invalid email or password");
      }

      // Check if staff is active
      if (!staff.isActive) {
        throw new BadRequestError("Account is deactivated. Please contact administrator.");
      }

      // Verify password
      const isPasswordValid = await Bun.password.verify(
        password,
        staff.password || "", // Handle legacy or missing password
        "bcrypt"
      ).catch((err) => {
        console.error("Password verification error:", err);
        return false;
      });

      if (!isPasswordValid) {
        throw new BadRequestError("Invalid email or password");
      }

      // Update last login info
      staff.lastLogin = new Date();
      await staff.save();

      // Generate token
      // We map the staff type to the role in the token
      const token = await PasetoUtil.encodePaseto(
        {
          id: staff._id.toString(),
          email: staff.email,
          role: staff.type as any, // "teacher" | "admin"
          institutionId: staff.institutionId.toString(),
        },
        staff.type as any
      );

      set.headers["Authorization"] = `Bearer ${token}`;
      set.status = 200;

      return {
        success: true,
        message: "Login successful",
        data: {
          _id: staff._id,
          email: staff.email,
          name: staff.name,
          mobileNumber: staff.mobileNumber,
          role: staff.type,
          institutionId: staff.institutionId,
          profileImage: staff.profileImage,
          isActive: staff.isActive,
          lastLogin: staff.lastLogin,
          token,
        },
      };
    } catch (error: any) {
      set.status = 400;
      throw new BadRequestError(error.message || "Login failed");
    }
  },
  {
    body: t.Object({
      email: t.String({ format: "email" }),
      password: t.String(),
    }),
    detail: {
      summary: "Staff Login",
      description: "Authenticate staff using email and password",
    }, 
  }
)

.post(
    "/logout",
    async ({ set }) => {
        // Logout logic if needed (e.g. blacklist)
        set.status = 200;
        return { success: true, message: "Logged out successfully" };
    },
    {
        detail: { summary: "Staff Logout" }
    }
);
