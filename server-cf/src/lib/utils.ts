export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
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

export function nowISO(): string {
  return new Date().toISOString();
}
