import * as jose from "jose";
import type { Bindings } from "../env";

export type AdminRoles = "super_admin" | "admin" | "teacher";

function getKey(env: Bindings, role: AdminRoles): Uint8Array {
  const secret =
    role === "super_admin"
      ? env.JWT_SUPERADMIN_SECRET
      : role === "admin"
      ? env.JWT_ADMIN_SECRET
      : env.JWT_TEACHER_SECRET;
  if (!secret) {
    throw new Error(`JWT secret key for role ${role} is not set.`);
  }
  return new TextEncoder().encode(secret);
}

export async function encodeToken(
  payload: Record<string, string>,
  role: AdminRoles,
  env: Bindings,
): Promise<string | null> {
  try {
    const key = getKey(env, role);
    return await new jose.EncryptJWT(payload)
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt()
      .encrypt(key);
  } catch (error) {
    console.error("Failed to encode token:", error);
    return null;
  }
}

export async function decodeToken(
  token: string,
  role: AdminRoles,
  env: Bindings,
): Promise<Record<string, any> | null> {
  try {
    const key = getKey(env, role);
    const { payload } = await jose.jwtDecrypt(token, key);
    return payload as Record<string, any>;
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
}
