import { generateKeys } from "paseto-ts/v4";

export class TokenGenerator {
  public static generateKey(): string {
    const localKey = generateKeys("local");
    return localKey;
  }

  private static generateKeyBuffer(): Uint8Array<ArrayBufferLike> {
    const localKeyBuffer = generateKeys("local", { format: "buffer" });
    return localKeyBuffer;
  }
}
