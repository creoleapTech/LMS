import Elysia, { t } from "elysia";
import { adminAuthMacro } from "../admin-macro";
import { PeriodConfigModel } from "@/schema/admin/period-config-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { Types } from "mongoose";

function resolveInstitutionId(query: any, user: any): string {
  let institutionId = query.institutionId;
  if (!institutionId && user.role !== "super_admin") {
    institutionId =
      typeof user.institutionId === "object"
        ? (user.institutionId as any)._id?.toString()
        : user.institutionId?.toString();
  }
  if (!institutionId) {
    throw new BadRequestError("Institution ID is required");
  }
  return institutionId;
}

export const periodConfigController = new Elysia({
  prefix: "/period-config",
  tags: ["Period Config"],
})
  .use(adminAuthMacro)
  .guard({ isAuth: true })

  // GET period config for institution
  .get(
    "/",
    async ({ query, user }) => {
      const institutionId = resolveInstitutionId(query, user);

      const config = await PeriodConfigModel.findOne({
        institutionId: new Types.ObjectId(institutionId),
        isDeleted: false,
      });

      return { success: true, data: config };
    },
    {
      query: t.Object({
        institutionId: t.Optional(t.String()),
      }),
    }
  )

  // POST upsert period config
  .post(
    "/",
    async ({ body, user, set }) => {
      if (user.role !== "super_admin" && user.role !== "admin") {
        throw new BadRequestError("Only admin can configure periods");
      }

      let institutionId = body.institutionId;
      if (!institutionId) {
        institutionId =
          typeof user.institutionId === "object"
            ? (user.institutionId as any)._id?.toString()
            : user.institutionId?.toString();
      }
      if (!institutionId) {
        throw new BadRequestError("Institution ID is required");
      }

      // Validate periods: no overlapping times, startTime < endTime
      for (const p of body.periods) {
        if (p.startTime >= p.endTime) {
          throw new BadRequestError(
            `Period ${p.periodNumber}: start time must be before end time`
          );
        }
      }

      const instOid = new Types.ObjectId(institutionId);

      // Upsert: update if exists, create if not
      const config = await PeriodConfigModel.findOneAndUpdate(
        { institutionId: instOid, isDeleted: false },
        {
          $set: {
            institutionId: instOid,
            periods: body.periods,
            workingDays: body.workingDays || [1, 2, 3, 4, 5],
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      set.status = 201;
      return { success: true, data: config };
    },
    {
      body: t.Object({
        institutionId: t.Optional(t.String()),
        periods: t.Array(
          t.Object({
            periodNumber: t.Number({ minimum: 1, maximum: 20 }),
            label: t.Optional(t.String({ maxLength: 50 })),
            startTime: t.String(),
            endTime: t.String(),
            isBreak: t.Optional(t.Boolean()),
          })
        ),
        workingDays: t.Optional(
          t.Array(t.Number({ minimum: 0, maximum: 6 }))
        ),
      }),
    }
  );
