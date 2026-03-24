// src/lib/errors/internal-server.error.ts
import { BaseError } from "./base-error";

export class InternalServerError extends BaseError {
  constructor(message = "Internal Server Error") {
    super(message, 500);
  }
}