import { eq, and, sql, desc } from "drizzle-orm";
import type { DB } from "../db";
import { institutions, students } from "../schema/admin";

export function institutionInitials(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return "INS";

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  const initials = words.map((w) => w.charAt(0).toUpperCase()).join("");
  return initials.slice(0, 3).toUpperCase();
}

export function padSequence(n: number, minLength = 3): string {
  return String(n).padStart(minLength, "0");
}

export async function syncRollNumberCounter(
  db: DB,
  institutionId: string
): Promise<void> {
  const [inst] = await db
    .select({ name: institutions.name })
    .from(institutions)
    .where(eq(institutions.id, institutionId))
    .limit(1);

  if (!inst) return;

  const prefix = institutionInitials(inst.name);
  const yearSuffix = String(new Date().getFullYear()).slice(-2);

  const [maxRoll] = await db
    .select({ rollNumber: students.rollNumber })
    .from(students)
    .where(
      and(
        eq(students.institutionId, institutionId),
        eq(students.isDeleted, 0),
        sql`${students.rollNumber} IS NOT NULL`,
        sql`${students.rollNumber} LIKE ${prefix + yearSuffix + "%"}`,
      ),
    )
    .orderBy(desc(students.rollNumber))
    .limit(1);

  let maxSeq = 0;
  if (maxRoll?.rollNumber) {
    const numPart = maxRoll.rollNumber.replace(prefix + yearSuffix, "");
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) {
      maxSeq = parsed;
    }
  }

  await db
    .update(institutions)
    .set({ rollNumberCounter: maxSeq })
    .where(eq(institutions.id, institutionId));
}

export async function generateRollNumber(
  db: DB,
  institutionId: string
): Promise<string | null> {
  const [inst] = await db
    .select({ id: institutions.id, name: institutions.name, rollNumberCounter: institutions.rollNumberCounter })
    .from(institutions)
    .where(eq(institutions.id, institutionId))
    .limit(1);

  if (!inst) return null;

  const prefix = institutionInitials(inst.name);
  const yearSuffix = String(new Date().getFullYear()).slice(-2);
  const nextSeq = (inst.rollNumberCounter ?? 0) + 1;
  const rollNumber = `${prefix}${yearSuffix}${padSequence(nextSeq)}`;

  await db
    .update(institutions)
    .set({ rollNumberCounter: nextSeq })
    .where(eq(institutions.id, institutionId));

  return rollNumber;
}

export async function generateRollNumbers(
  db: DB,
  institutionId: string,
  count: number
): Promise<string[]> {
  if (count <= 0) return [];

  const [inst] = await db
    .select({ id: institutions.id, name: institutions.name, rollNumberCounter: institutions.rollNumberCounter })
    .from(institutions)
    .where(eq(institutions.id, institutionId))
    .limit(1);

  if (!inst) return [];

  const prefix = institutionInitials(inst.name);
  const yearSuffix = String(new Date().getFullYear()).slice(-2);
  const currentCounter = inst.rollNumberCounter ?? 0;

  const rollNumbers: string[] = [];
  for (let i = 1; i <= count; i++) {
    rollNumbers.push(`${prefix}${yearSuffix}${padSequence(currentCounter + i)}`);
  }

  await db
    .update(institutions)
    .set({ rollNumberCounter: currentCounter + count })
    .where(eq(institutions.id, institutionId));

  return rollNumbers;
}
