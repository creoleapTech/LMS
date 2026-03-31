// controllers/admin-auth.controller.ts
import { PasetoUtil } from "@/lib/paseto";
import Elysia, { t } from "elysia";
import { AdminModel } from "@/schema/admin/admin-model";
import { StaffModel } from "@/schema/admin/staff-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { Types } from "mongoose";

// Admin Auth Controller
export const adminAuthController = new Elysia({
  prefix: "/auth",
  tags: ["Admin Auth"],
})

.post(
  "/register",
  async ({ body, set }) => {
    try {
      const { email, password, name, mobileNumber, role, institutionId } = body;

      // Check if admin already exists
      const existingAdmin = await AdminModel.findOne({ email, isDeleted: false });
      if (existingAdmin) {
        throw new BadRequestError("Admin already exists with this email");
      }

      // Create new admin (password will be hashed by pre-save hook)
      const admin = new AdminModel({
        email,
        password,
        name,
        mobileNumber,
        role: role || "admin",
        institutionId: institutionId ? new Types.ObjectId(institutionId) : undefined,
      });

      await admin.save();

      set.status = 201;
      return {
        success: true,
        message: "Admin registered successfully",
        data: {
          _id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          institutionId: admin.institutionId,
          isActive: admin.isActive,
        },
      };
    } catch (error: any) {
      set.status = 400;
      throw new BadRequestError(error.message || "Registration failed");
    }
  },
  {
    body: t.Object({
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 6 }),
      name: t.Optional(t.String({ maxLength: 100 })),
      mobileNumber: t.Optional(t.String({ maxLength: 10 })),
      role: t.Optional(t.Union([t.Literal('super_admin'), t.Literal('admin')])),
      institutionId: t.Optional(t.String()),
    }),
    detail: {
      summary: "Admin Registration",
      description: "Register a new admin with email and password",
    },
  }
)

  .post(
    "/login",
    async ({ body, set, request }) => {
      try {
        const { email, password } = body;

        let user: any = null;
        let isStaff = false;

        // 1. Try finding Admin first
        const admin = await AdminModel.findOne({ 
          email: email.toLowerCase(), 
          isDeleted: false 
        }).populate('institutionId', 'name logo').lean();

        if (admin) {
           user = admin;
        } else {
           // 2. If not admin, try StaffModel
           const staff = await StaffModel.findOne({ 
             email: email.toLowerCase(), 
             isDeleted: false 
           });
           if (staff) {
             user = staff;
             isStaff = true;
           }
        }

        if (!user) {
          throw new BadRequestError("Invalid email or password");
        }

        // Check active status
        if (!user.isActive) {
          throw new BadRequestError("Account is deactivated. Please contact administrator.");
        }

        // Verify password
        const isPasswordValid = await Bun.password.verify(
          password,
          user.password || "", 
          "bcrypt"
        ).catch((err) => {
          console.error("Password verification error:", err);
          return false;
        });

        if (!isPasswordValid) {
          throw new BadRequestError("Invalid email or password");
        }

        // Update last login
        user.lastLogin = new Date();
        if(!isStaff){
           user.lastIp = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        'unknown';
           user.lastUserAgent = request.headers.get('user-agent') || 'unknown';
        }
        await user.save();

        // Prepare token payload
        const tokenPayload = isStaff ? {
            id: user._id.toString(),
            email: user.email,
            role: user.type, // Map 'type' to 'role' for JWT
            institutionId: user.institutionId?.toString(),
        } : {
            id: user._id,
            email: user.email,
            role: user.role,
            institutionId: user?.institutionId ?? undefined,
        };

        const roleForToken = isStaff ? user.type : user.role;

        const token = await PasetoUtil.encodePaseto(
          tokenPayload,
          roleForToken
        );

        set.headers["Authorization"] = `Bearer ${token}`;
        set.status = 200;

        await user.populate('institutionId', 'name');

        const responseData = {
          success: true,
          message: "Login successful",
          data: {
            _id: user._id,
            email: user.email,
            name: user.name,
            mobileNumber: user.mobileNumber,
            role: isStaff ? user.type : user.role,
            institutionId: user.institutionId,
            profileImage: user.profileImage,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            token,
          },
        };

        console.log("Login response role:", responseData.data.role, "isStaff:", isStaff, "user.type:", user.type);

        return responseData;
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
        summary: "Universal Login",
        description: "Authenticate admin, super_admin, or staff using email and password",
      }, 
    }
  )

.post(
  "/logout",
  async ({ set, headers }) => {
    try {
      const token = headers.authorization?.replace("Bearer ", "");
      
      if (token) {
        // You can add token to blacklist here if needed
        // await TokenBlacklistModel.create({ token, expiresAt: new Date(Date.now() + 15 * 60 * 1000) });
      }

      set.status = 200;
      return {
        success: true,
        message: "Logout successful",
      };
    } catch (error: any) {
      set.status = 400;
      throw new BadRequestError(error.message || "Logout failed");
    }
  },
  {
    headers: t.Object({
      authorization: t.Optional(t.String()),
    }),
    detail: {
      summary: "Admin Logout",
      description: "Logout admin user",
    },
  }
)

.get(
  "/profile",
  async ({ headers, set }) => {
    try {
      const token = headers.authorization?.replace("Bearer ", "");
      
      if (!token) {
        throw new BadRequestError("No token provided");
      }

      // Verify token - try admin key first, then super_admin
      let decodedData = await PasetoUtil.decodePaseto(token, "admin");
      if (!decodedData || !decodedData.payload) {
        decodedData = await PasetoUtil.decodePaseto(token, "super_admin");
      }
      if (!decodedData || !decodedData.payload) throw new BadRequestError("Invalid token");
      const decoded = decodedData.payload;

      // Get admin data
      const admin = await AdminModel.findOne({
        _id: decoded.id, 
        isDeleted: false,
        isActive: true 
      }).select('-password');

      if (!admin) {
        throw new BadRequestError("Admin not found");
      }

      set.status = 200;
      return {
        success: true,
        message: "Profile fetched successfully",
        data: admin,
      };
    } catch (error: any) {
      set.status = 401;
      throw new BadRequestError(error.message || "Invalid token");
    }
  },
  {
    headers: t.Object({
      authorization: t.String(),
    }),
    detail: {
      summary: "Get Admin Profile",
      description: "Get current admin profile using JWT token",
    },
  }
)

.patch(
  "/profile",
  async ({ body, headers, set }) => {
    try {
      const token = headers.authorization?.replace("Bearer ", "");
      
      if (!token) {
        throw new BadRequestError("No token provided");
      }

      // Verify token - try admin key first, then super_admin
      let decodedData = await PasetoUtil.decodePaseto(token, "admin");
      if (!decodedData || !decodedData.payload) {
        decodedData = await PasetoUtil.decodePaseto(token, "super_admin");
      }
      if (!decodedData || !decodedData.payload) throw new BadRequestError("Invalid token");
      const decoded = decodedData.payload;

      // Update admin profile
      const admin = await AdminModel.findOneAndUpdate(
        { 
          _id: decoded.id, 
          isDeleted: false,
          isActive: true 
        },
        { 
          $set: body 
        },
        { 
          new: true,
          runValidators: true 
        }
      ).select('-password');

      if (!admin) {
        throw new BadRequestError("Admin not found");
      }

      set.status = 200;
      return {
        success: true,
        message: "Profile updated successfully",
        data: admin,
      };
    } catch (error: any) {
      set.status = 400;
      throw new BadRequestError(error.message || "Profile update failed");
    }
  },
  {
    body: t.Object({
      name: t.Optional(t.String({ maxLength: 100 })),
      mobileNumber: t.Optional(t.String({ maxLength: 10 })),
      profileImage: t.Optional(t.String()),
      fcmToken: t.Optional(t.String()),
    }),
    headers: t.Object({
      authorization: t.String(),
    }),
    detail: {
      summary: "Update Admin Profile",
      description: "Update admin profile information",
    },
  }
)

.patch(
  "/change-password",
  async ({ body, headers, set }) => {
    try {
      const token = headers.authorization?.replace("Bearer ", "");
      
      if (!token) {
        throw new BadRequestError("No token provided");
      }

      // Verify token - try admin key first, then super_admin
      let decodedData = await PasetoUtil.decodePaseto(token, "admin");
      if (!decodedData || !decodedData.payload) {
        decodedData = await PasetoUtil.decodePaseto(token, "super_admin");
      }
      if (!decodedData || !decodedData.payload) throw new BadRequestError("Invalid token");
      const decoded = decodedData.payload;

      const { currentPassword, newPassword } = body;

      // Get admin with password
      const admin = await AdminModel.findOne({ 
        _id: decoded.id, 
        isDeleted: false,
        isActive: true 
      });

      if (!admin) {
        throw new BadRequestError("Admin not found");
      }

      // Verify current password
          const  isCurrentPasswordValid = await Bun.password.verify(
        currentPassword,
        admin.password,
        "bcrypt"
      ).catch((err) => {
        console.error("Password verification error:", err);
        return false;
      });
      if (!isCurrentPasswordValid) {
        throw new BadRequestError("Current password is incorrect");
      }

      // Update password (pre-save hook will hash it)
      admin.password = newPassword;
      await admin.save();

      set.status = 200;
      return {
        success: true,
        message: "Password changed successfully",
      };
    } catch (error: any) {
      set.status = 400;
      throw new BadRequestError(error.message || "Password change failed");
    }
  },
  {
    body: t.Object({
      currentPassword: t.String(),
      newPassword: t.String({ minLength: 6 }),
    }),
    headers: t.Object({
      authorization: t.String(),
    }),
    detail: {
      summary: "Change Password",
      description: "Change admin password",
    },
  }
);