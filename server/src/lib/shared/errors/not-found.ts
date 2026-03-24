// src/lib/errors/not-found.error.ts
import { BaseError } from "./base-error";

export class NotFoundError extends BaseError {
  constructor(message = "Not Found") {
    super(message, 404);
  }
}