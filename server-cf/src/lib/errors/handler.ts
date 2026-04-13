import type { ErrorHandler } from "hono";
import { BaseError } from "./base-error";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof BaseError) {
    return c.json(
      {
        success: false,
        message: err.message,
      },
      err.statusCode as any,
    );
  }

  console.error("Unhandled Error:", err);
  return c.json(
    {
      success: false,
      message: "Something went wrong",
    },
    500,
  );
};
