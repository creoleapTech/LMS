// src/lib/errors/handler.ts
import { Elysia } from "elysia";
import { BaseError } from "./base-error";

export const errorHandler = new Elysia()
  .onError(({ code, error, set }) => {
    if (error instanceof BaseError) {
      set.status = error.statusCode;
      return {
        success: false,
        message: error.message,
        // Remove stack in production
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      };
    }

    // Unexpected errors
    console.error("Unhandled Error:", error);
    set.status = 500;
    return {
      success: false,
      message: "Something went wrong",
    };
  });