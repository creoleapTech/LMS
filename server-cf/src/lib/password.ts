import bcrypt from "bcryptjs";

const ITERATIONS = 10000;
const BULK_ITERATIONS = 500;
const KEY_LENGTH = 256;
const SALT_BYTES = 16;

function base64Encode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  return hashPasswordWithIterations(password, ITERATIONS);
}

/**
 * Lighter-weight hash for bulk credential generation.
 * Passwords are machine-generated random strings with high entropy,
 * so fewer iterations are acceptable and keeps us within CF Workers CPU limits.
 */
export async function hashPasswordBulk(password: string): Promise<string> {
  return hashPasswordWithIterations(password, BULK_ITERATIONS);
}

async function hashPasswordWithIterations(password: string, iterations: number): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH,
  );
  return `pbkdf2:${iterations}:${base64Encode(salt.buffer)}:${base64Encode(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts[0] === "pbkdf2") {
    const iterations = parseInt(parts[1], 10);
    const salt = base64Decode(parts[2]);
    const storedHash = base64Decode(parts[3]);

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );
    const hash = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      keyMaterial,
      KEY_LENGTH,
    );

    const hashBytes = new Uint8Array(hash);
    if (hashBytes.length !== storedHash.length) return false;
    return hashBytes.every((byte, i) => byte === storedHash[i]);
  }

  // Fallback for legacy bcrypt hashes (from old server)
  try {
    return await bcrypt.compare(password, stored);
  } catch (err) {
    console.error("Legacy bcrypt verification failed:", err);
    return false;
  }
}
