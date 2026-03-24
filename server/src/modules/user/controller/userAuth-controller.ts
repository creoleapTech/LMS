import { PasetoUtil } from "@/lib/paseto";
import Elysia, { t } from "elysia";
import axios from "axios";
import { UserModel } from "@/schema/user/user-model";
import { BadRequestError } from "@/lib/shared/bad-request";
import { OtpCountModel } from "@/schema/otpCount-model";
import { convertTime } from "@/lib/timeConversion";

const logError = (context: string, error: any) => {
  console.error(`[${new Date().toISOString()}] ${context}:`, {
    message: error.message,
    stack: error.stack,
    response: error.response ? {
      status: error.response.status,
      data: error.response.data,
    } : null,
  });
};
interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: {
    code: string;
    details?: any;
  };
}
const createResponse = (
  success: boolean,
  message: string,
  data?: any,
  error?: { code: string; details?: any },
  statusCode: number = success ? 200 : 400
): [ApiResponse, number] => {
  return [
    {
      success,
      message,
      ...(data && { data }),
      ...(error && { error }),
    },
    statusCode,
  ];
};

export const userAuthController = new Elysia({
  prefix: "/auth",
  tags: ["User Auth"],
})
.post(
  "/login",
  async ({ body, set }) => {
    try {
      const { mobile, fcmToken } = body;
      
      // Try to find existing user
      let user = await UserModel.findOne({ mobile, isDeleted: false });
      
      let isNewUser = false;
      
      if (!user) {
        user = new UserModel({
          mobile,
          fcmToken: fcmToken || '',
          isDeleted: false,
        });
        isNewUser = true;
      } 

      // Update lastLogin with offset for IST
      user.lastLogin = convertTime();

      if (!isNewUser && fcmToken) {
        user.fcmToken = fcmToken;
      }

      await user.save();

      // Generate authentication token
      const token = await PasetoUtil.encodePaseto(
        {
          mobileNumber: mobile,
          role: 'user',
        },
        "user"
      );

      // Format the username
      const formatUsername = (name: string) => {
        return name.split(' ').map((part: string) => 
          part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        ).join(' ');
      };

      // Prepare user data, excluding sensitive fields and trimming to main details
      const { fcmToken: _, ...userData } = user.toObject();
      userData.username = formatUsername(userData.username || '');

      set.headers["Authorization"] = `Bearer ${token}`;
      set.status = 200;
      
      return {
        message: isNewUser ? "Registration and Login Successful" : "Login Successful",
        status: true,
        isNewUser,
        data: {
          userId: userData._id,
          username: userData.username,
          mobile: userData.mobile,
          subscriptionPlan: userData.subscriptionPlan,
          isActive: userData.isActive,
          lastLogin: userData.lastLogin,
          token,
        },
      };
    } catch (error) {
      set.status = 400;
      console.error(error);
      return {
        status: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
  {
    detail: {
      summary: "User login or register",
      description: "Login existing user or create new user if doesn't exist, then perform login",
    },
    body: t.Object({
      mobile: t.String(),
      fcmToken: t.Optional(t.String()),
    }),
  }
)
.post(
  "/logout",
  async ({ set }) => {
    try {
      set.status = 200;
      set.headers['Set-Cookie'] = `user=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
      return {
        message: "Logout Successful",
        status: true,
      };
    } catch (error: any) {
      set.status = 400;
      console.error(error);
      return {
        status: false,
        message: error.message,
      };
    }
  },
  {
    detail: {
      summary: "User logout",
    },
  }
)
.post(
  "/send-otp",
  async ({ body }) => {
    const { mobile, smsId } = body;
    // For demo account purpose
    if (mobile === "9344676467"||mobile=="7448765578") {
      return {
        message: "OTP sent successfully",
        status: true,
        otpId: "6866ba997f4f48b71fb6fd27",
      };
    }

    try {
      const response = await axios.post('https://www.xopay.in/api/v2/otp/otp', {
        phone: mobile,
        comapny_name: "NFC",
        ...(smsId !== "-" ? { sms_id: smsId } : {}),
      });

      if (response.data.status) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        let otpCount = await OtpCountModel.findOne({ month, year });
        if (!otpCount) {
          otpCount = new OtpCountModel({ month, year, count: 0 });
        }
        otpCount.count += 1;
        await otpCount.save();

        return {
          message: "OTP sent successfully",
          status: true,
          otpId: response.data.id,
        };
      } else {
        return {
          message: "Failed to send OTP",
          status: false,
        };
      }
    } catch (error: any) {
      console.error(error);
      return {
        error: error.message,
        status: false,
      };
    }
  },
  {
    body: t.Object({
      mobile: t.String({ minLength: 10, maxLength: 10 }),
      smsId: t.Optional(
        t.String({
          default: "-",
          description: "Optional SMS ID for tracking purposes",
        })
      ),
    }),
    detail: {
      summary: "Send OTP to the user's mobile number",
      description: "Send OTP to the user's mobile number for verification",
    },
  }
)
.post(
  "/verify-otp",
  async ({ body }) => {
    const { otpId, otpNo, mobile } = body;

    // Special handling for demo number
    if (mobile === "9344676467" && otpNo === "000000"||mobile=="7448765578" && otpNo === "000000") {
      return {
        message: "OTP verified successfully",
        status: true,
        existingUser: true,
      };
    }

    try {
      const response = await axios.post('https://www.xopay.in/api/v2/otp/otpverify', {
        id: otpId,
        otp_no: otpNo,
      });

      if (response.data.status) {
        const existingUser = await UserModel.findOne({ mobile, isDeleted: false });
        return {
          message: "OTP verified successfully",
          status: true,
          existingUser: !!existingUser,
        };
      } else {
        return {
          message: "Failed to verify OTP",
          status: false,
        };
      }
    } catch (error: any) {
      console.error(error);
      return {
        error: error.message,
        status: false,
      };
    }
  },
  {
    body: t.Object({
      otpId: t.String(),
      otpNo: t.String({ minLength: 4, maxLength: 6 }),
      mobile: t.String(),
    }),
    detail: {
      summary: "Verify OTP provided by the user",
      description: "Verify the OTP provided by the user for login",
    },
  }
)

