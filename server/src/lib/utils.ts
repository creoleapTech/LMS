import { customAlphabet } from "nanoid";
import { PasetoUtil } from "src/lib/paseto";

export const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
};

type IToken = "admin" | "user"|"Manager";

export const validateToken = async (pasetoToken: string, role: IToken) => {
  console.log("Validating token:", pasetoToken);
  if (!pasetoToken.startsWith("v4.local.")) {
    throw new Error("Unauthorized");
  }

  const payload = await PasetoUtil.decodePaseto(pasetoToken, role);

  if (!payload) {
    throw new Error("Unauthorized");
  }

  return payload.payload;
};

export function generateRandomString(length: number = 6, prefix = "#"): string {
  const characters = "0123456789";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return prefix + result;
}

export function generateInvoiceId(): string {
  return generateRandomString(18, "KP-");
}