import Elysia, { t } from "elysia";
import { adminAuthMacro } from "../admin-macro";
import { AdminModel } from "@/schema/admin/admin-model";
import { StaffModel } from "@/schema/admin/staff-model";
import { InstitutionModel } from "@/schema/admin/institution-model";
import { InstitutionSettingsModel } from "@/schema/admin/institution-settings-model";
import { UserPreferencesModel } from "@/schema/admin/user-preferences-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { Types } from "mongoose";

async function findUserByToken(user: any) {
  const admin = await AdminModel.findOne({
    _id: user.id,
    isDeleted: false,
    isActive: true,
  }).select("-password");
  if (admin) return { doc: admin, model: "Admin" as const };

  const staff = await StaffModel.findOne({
    _id: user.id,
    isDeleted: false,
    isActive: true,
  }).select("-password");
  if (staff) return { doc: staff, model: "Staff" as const };

  return null;
}

function resolveInstitutionId(user: any, queryInstitutionId?: string): string {
  // Super admin can specify institutionId explicitly via query param
  if (user.role === "super_admin" && queryInstitutionId) {
    return queryInstitutionId;
  }

  const instId =
    typeof user.institutionId === "object"
      ? (user.institutionId as any)._id?.toString()
      : user.institutionId?.toString();
  if (!instId) throw new BadRequestError("Institution ID is required");
  return instId;
}

export const settingsController = new Elysia({
  prefix: "/settings",
  tags: ["Settings"],
})
  .use(adminAuthMacro)
  .guard({ isAuth: true })

  // ── Profile ──────────────────────────────────────────────

  .get("/profile", async ({ user }) => {
    const result = await findUserByToken(user);
    if (!result) throw new BadRequestError("User not found");

    return { success: true, data: result.doc };
  })

  .patch(
    "/profile",
    async ({ user, body }) => {
      const result = await findUserByToken(user);
      if (!result) throw new BadRequestError("User not found");

      const Model = result.model === "Admin" ? AdminModel : StaffModel;
      const updated = await Model.findByIdAndUpdate(
        user.id,
        {
          $set: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.salutation !== undefined && { salutation: body.salutation }),
            ...(body.mobileNumber !== undefined && { mobileNumber: body.mobileNumber }),
            ...(body.profileImage !== undefined && { profileImage: body.profileImage }),
          },
        },
        { new: true, runValidators: true }
      ).select("-password");

      return { success: true, message: "Profile updated", data: updated };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 100 })),
        salutation: t.Optional(
          t.Union([
            t.Literal("Mr"),
            t.Literal("Mrs"),
            t.Literal("Ms"),
            t.Literal("Dr"),
          ])
        ),
        mobileNumber: t.Optional(t.String({ maxLength: 15 })),
        profileImage: t.Optional(t.String()),
      }),
    }
  )

  .patch(
    "/change-password",
    async ({ user, body }) => {
      const result = await findUserByToken(user);
      if (!result) throw new BadRequestError("User not found");

      // Re-fetch with password
      const Model = result.model === "Admin" ? AdminModel : StaffModel;
      const userDoc = await Model.findById(user.id);
      if (!userDoc) throw new BadRequestError("User not found");

      const valid = await Bun.password.verify(
        body.currentPassword,
        userDoc.password!,
        "bcrypt"
      );
      if (!valid) throw new BadRequestError("Current password is incorrect");

      userDoc.password = body.newPassword;
      await userDoc.save(); // triggers pre-save hash hook

      return { success: true, message: "Password changed successfully" };
    },
    {
      body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String({ minLength: 6 }),
      }),
    }
  )

  // ── Institution Profile ──────────────────────────────────

  .get("/institution-profile", async ({ user, query }) => {
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new BadRequestError("Access denied");
    }

    const institutionId = resolveInstitutionId(user, query.institutionId);
    const institution = await InstitutionModel.findOne({
      _id: new Types.ObjectId(institutionId),
      isDeleted: false,
    });

    return { success: true, data: institution };
  }, {
    query: t.Object({ institutionId: t.Optional(t.String()) }),
  })

  .patch(
    "/institution-profile",
    async ({ user, body, query }) => {
      if (user.role !== "admin" && user.role !== "super_admin") {
        throw new BadRequestError("Access denied");
      }

      const institutionId = resolveInstitutionId(user, query.institutionId);
      const updated = await InstitutionModel.findByIdAndUpdate(
        institutionId,
        {
          $set: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.type !== undefined && { type: body.type }),
            ...(body.address !== undefined && { address: body.address }),
            ...(body.contactDetails !== undefined && {
              contactDetails: body.contactDetails,
            }),
          },
        },
        { new: true, runValidators: true }
      );

      return {
        success: true,
        message: "Institution profile updated",
        data: updated,
      };
    },
    {
      query: t.Object({ institutionId: t.Optional(t.String()) }),
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 100 })),
        type: t.Optional(t.Union([t.Literal("school"), t.Literal("college")])),
        address: t.Optional(t.String({ maxLength: 255 })),
        contactDetails: t.Optional(
          t.Object({
            inchargePerson: t.String({ maxLength: 100 }),
            mobileNumber: t.String({ maxLength: 15 }),
            email: t.Optional(t.String()),
            officePhone: t.Optional(t.String({ maxLength: 15 })),
          })
        ),
      }),
    }
  )

  // ── Institution Settings ─────────────────────────────────

  .get("/institution", async ({ user, query }) => {
    if (user.role !== "admin" && user.role !== "super_admin") {
      throw new BadRequestError("Access denied");
    }

    const institutionId = resolveInstitutionId(user, query.institutionId);
    const settings = await InstitutionSettingsModel.findOne({
      institutionId: new Types.ObjectId(institutionId),
      isDeleted: false,
    });

    return { success: true, data: settings };
  }, {
    query: t.Object({ institutionId: t.Optional(t.String()) }),
  })

  .put(
    "/institution",
    async ({ user, body, query }) => {
      if (user.role !== "admin" && user.role !== "super_admin") {
        throw new BadRequestError("Access denied");
      }

      const institutionId = resolveInstitutionId(user, query.institutionId);
      const instOid = new Types.ObjectId(institutionId);

      const settings = await InstitutionSettingsModel.findOneAndUpdate(
        { institutionId: instOid, isDeleted: false },
        { $set: { ...body, institutionId: instOid } },
        { upsert: true, new: true, runValidators: true }
      );

      return { success: true, message: "Settings saved", data: settings };
    },
    {
      query: t.Object({ institutionId: t.Optional(t.String()) }),
      body: t.Object({
        language: t.Optional(t.String()),
        timezone: t.Optional(t.String()),
        dateFormat: t.Optional(t.String()),
        currency: t.Optional(t.String()),
        enableStudentPortal: t.Optional(t.Boolean()),
        enableParentPortal: t.Optional(t.Boolean()),
        gradingScale: t.Optional(
          t.Array(
            t.Object({
              grade: t.String(),
              label: t.String(),
              minPercentage: t.Number({ minimum: 0, maximum: 100 }),
              maxPercentage: t.Number({ minimum: 0, maximum: 100 }),
            })
          )
        ),
        passingMarks: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        notificationPreferences: t.Optional(
          t.Object({
            newStudentRegistration: t.Optional(t.Boolean()),
            feePaymentReceived: t.Optional(t.Boolean()),
            attendanceAlert: t.Optional(t.Boolean()),
            examResultsPublished: t.Optional(t.Boolean()),
            holidayAnnouncement: t.Optional(t.Boolean()),
          })
        ),
        sessionTimeout: t.Optional(t.Number({ minimum: 5, maximum: 480 })),
      }),
    }
  )

  // ── User Preferences ─────────────────────────────────────

  .get("/preferences", async ({ user }) => {
    const prefs = await UserPreferencesModel.findOne({
      userId: new Types.ObjectId(user.id),
      isDeleted: false,
    });

    return { success: true, data: prefs };
  })

  .put(
    "/preferences",
    async ({ user, body }) => {
      const result = await findUserByToken(user);
      if (!result) throw new BadRequestError("User not found");

      const userOid = new Types.ObjectId(user.id);
      const institutionId = user.institutionId
        ? new Types.ObjectId(
            typeof user.institutionId === "object"
              ? (user.institutionId as any)._id?.toString()
              : user.institutionId.toString()
          )
        : undefined;

      const prefs = await UserPreferencesModel.findOneAndUpdate(
        { userId: userOid, isDeleted: false },
        {
          $set: {
            ...body,
            userId: userOid,
            userModel: result.model,
            ...(institutionId && { institutionId }),
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      return { success: true, message: "Preferences saved", data: prefs };
    },
    {
      body: t.Object({
        language: t.Optional(t.String()),
        theme: t.Optional(
          t.Union([
            t.Literal("light"),
            t.Literal("dark"),
            t.Literal("system"),
          ])
        ),
        notificationPreferences: t.Optional(
          t.Object({
            emailNotifications: t.Optional(t.Boolean()),
            smsNotifications: t.Optional(t.Boolean()),
            attendanceAlerts: t.Optional(t.Boolean()),
            examResults: t.Optional(t.Boolean()),
            announcements: t.Optional(t.Boolean()),
          })
        ),
      }),
    }
  );
