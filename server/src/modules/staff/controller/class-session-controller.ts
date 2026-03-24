
import { BadRequestError } from "@/lib/shared/bad-request";
import { ForbiddenError } from "@/lib/shared/errors/forbidden";
import { ClassSessionModel } from "@/schema/staff/class-session-model";
import { StaffModel } from "@/schema/admin/staff-model";
import { ClassModel } from "@/schema/admin/class-model";
import Elysia, { t } from "elysia";

// Temporary macro until staff-macro is confirmed or created
const authGuard = { isAuth: true };

export const classSessionController = new Elysia({
  prefix: "/class-session",
  tags: ["Class Session"],
})
  // .use(staffAuthMacro) // Use if exists, otherwise rely on manual check or admin macro
  
  // START SESSION
  .post(
    "/start",
    async ({ body, set, headers }) => {
      // Manual Auth Check (Replace with macro if available)
      const token = headers.authorization?.replace("Bearer ", "");
      if (!token) throw new BadRequestError("Unauthorized");
      // Ideally verify token here or use a guard
      
      const { staffId, classId, institutionId, courseId } = body;

      // Verify Staff belongs to Institution
      const staff = await StaffModel.findById(staffId);
      if (!staff || staff.institutionId.toString() !== institutionId) {
        throw new BadRequestError("Invalid Staff or Institution");
      }

      // Verify Class
      const cls = await ClassModel.findById(classId);
      if (!cls || cls.institutionId.toString() !== institutionId) {
        throw new BadRequestError("Invalid Class");
      }

      const session = new ClassSessionModel({
        staffId,
        institutionId,
        classId,
        courseId,
        startTime: new Date(),
        status: "ongoing",
      });

      await session.save();

      set.status = 201;
      return { success: true, data: session };
    },
    {
       // Macro guard would go here
       body: t.Object({
         staffId: t.String(),
         institutionId: t.String(),
         classId: t.String(),
         courseId: t.Optional(t.String()),
       }),
       headers: t.Object({ authorization: t.String() })
    }
  )

  // END SESSION
  .patch(
    "/:id/end",
    async ({ params, body, set }) => {
      const { remarks, topicsCovered } = body;
      
      const session = await ClassSessionModel.findById(params.id);
      if (!session) throw new BadRequestError("Session not found");
      
      if (session.status === "completed") {
         throw new BadRequestError("Session already completed");
      }

      const endTime = new Date();
      const durationMinutes = Math.round((endTime.getTime() - new Date(session.startTime).getTime()) / 60000);

      session.endTime = endTime;
      session.durationMinutes = durationMinutes;
      session.remarks = remarks;
      session.topicsCovered = topicsCovered;
      session.status = "completed";

      await session.save();

      set.status = 200;
      return { success: true, data: session };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        remarks: t.String(),
        topicsCovered: t.Optional(t.Array(t.String())),
      })
    }
  )

  // GET SESSIONS (My History)
  .get(
    "/my-history",
    async ({ query, headers }) => {
       // Extract staffId from token or pass as query (insecure if not validated)
       // ideally extraction from token.
       // For now, assume passed in query with some validation from macro
       if (!query.staffId) throw new BadRequestError("Staff ID required");
       
       const sessions = await ClassSessionModel.find({ staffId: query.staffId })
         .populate("classId", "grade section")
         .sort({ startTime: -1 });

       return { success: true, data: sessions };
    },
    {
      query: t.Object({ staffId: t.String() })
    }
  );
