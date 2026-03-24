// src/lib/errors/forbidden.error.ts

import { BaseError } from "./base-error";


export class ForbiddenError extends BaseError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}