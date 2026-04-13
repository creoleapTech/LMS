import { BaseError } from "./base-error";

export class NotFoundError extends BaseError {
  constructor(message: string = "Not found") {
    super(message, 404);
  }
}
