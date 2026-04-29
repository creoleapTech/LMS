// Feature: lesson-plan, Property 3: Required-field validation rejects incomplete payloads

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { lessonPlanSchema } from "../types";

/**
 * Validates: Requirements 3.4, 5.3
 *
 * Property 3: Required-field validation rejects incomplete payloads
 * For any lesson plan creation or update payload that is missing at least one
 * required field (title, subject, gradeOrClass, date, or durationMinutes),
 * the Zod schema must reject the payload.
 */

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Non-empty string for required text fields */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/** Valid YYYY-MM-DD date string */
const validDateArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );

/** Valid positive integer duration */
const validDurationArb = fc.integer({ min: 1, max: 300 });

/** A fully valid payload (all required fields present) */
const validPayloadArb = fc.record({
  title: nonEmptyStringArb,
  subject: nonEmptyStringArb,
  gradeOrClass: nonEmptyStringArb,
  date: validDateArb,
  durationMinutes: validDurationArb,
});

// ─── Unit tests: individual required-field rejections ─────────────────────────

describe("lessonPlanSchema — required field validation", () => {
  it("accepts a fully valid payload", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Introduction to Fractions",
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
      durationMinutes: 45,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a payload with missing title", () => {
    const result = lessonPlanSchema.safeParse({
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
      durationMinutes: 45,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with empty title", () => {
    const result = lessonPlanSchema.safeParse({
      title: "",
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
      durationMinutes: 45,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with missing subject", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
      durationMinutes: 45,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with empty subject", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      subject: "",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
      durationMinutes: 45,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with missing gradeOrClass", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      subject: "Mathematics",
      date: "2025-06-12",
      durationMinutes: 45,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with empty gradeOrClass", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      subject: "Mathematics",
      gradeOrClass: "",
      date: "2025-06-12",
      durationMinutes: 45,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with missing date", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      durationMinutes: 45,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with empty date", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      date: "",
      durationMinutes: 45,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with an invalid date format", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      date: "12/06/2025", // wrong format
      durationMinutes: 45,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with missing durationMinutes", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with zero durationMinutes", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
      durationMinutes: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with negative durationMinutes", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
      durationMinutes: -10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload with non-integer durationMinutes", () => {
    const result = lessonPlanSchema.safeParse({
      title: "Lesson",
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
      durationMinutes: 45.5,
    });
    expect(result.success).toBe(false);
  });

  // ── Property 3: Required-field validation rejects incomplete payloads ──────

  it("Property 3: schema accepts any payload with all required fields present", () => {
    // Validates: Requirements 3.4, 5.3
    fc.assert(
      fc.property(validPayloadArb, (payload) => {
        const result = lessonPlanSchema.safeParse(payload);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 3: schema rejects any payload missing the title field", () => {
    // Validates: Requirements 3.4, 5.3
    fc.assert(
      fc.property(
        fc.record({
          subject: nonEmptyStringArb,
          gradeOrClass: nonEmptyStringArb,
          date: validDateArb,
          durationMinutes: validDurationArb,
        }),
        (payload) => {
          const result = lessonPlanSchema.safeParse(payload);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 3: schema rejects any payload missing the subject field", () => {
    // Validates: Requirements 3.4, 5.3
    fc.assert(
      fc.property(
        fc.record({
          title: nonEmptyStringArb,
          gradeOrClass: nonEmptyStringArb,
          date: validDateArb,
          durationMinutes: validDurationArb,
        }),
        (payload) => {
          const result = lessonPlanSchema.safeParse(payload);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 3: schema rejects any payload missing the gradeOrClass field", () => {
    // Validates: Requirements 3.4, 5.3
    fc.assert(
      fc.property(
        fc.record({
          title: nonEmptyStringArb,
          subject: nonEmptyStringArb,
          date: validDateArb,
          durationMinutes: validDurationArb,
        }),
        (payload) => {
          const result = lessonPlanSchema.safeParse(payload);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 3: schema rejects any payload missing the date field", () => {
    // Validates: Requirements 3.4, 5.3
    fc.assert(
      fc.property(
        fc.record({
          title: nonEmptyStringArb,
          subject: nonEmptyStringArb,
          gradeOrClass: nonEmptyStringArb,
          durationMinutes: validDurationArb,
        }),
        (payload) => {
          const result = lessonPlanSchema.safeParse(payload);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 3: schema rejects any payload missing the durationMinutes field", () => {
    // Validates: Requirements 3.4, 5.3
    fc.assert(
      fc.property(
        fc.record({
          title: nonEmptyStringArb,
          subject: nonEmptyStringArb,
          gradeOrClass: nonEmptyStringArb,
          date: validDateArb,
        }),
        (payload) => {
          const result = lessonPlanSchema.safeParse(payload);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 3: schema rejects any payload with an empty required string field", () => {
    // Validates: Requirements 3.4, 5.3
    // Pick one required string field at random and set it to empty string
    const requiredStringFields = ["title", "subject", "gradeOrClass", "date"] as const;

    fc.assert(
      fc.property(
        validPayloadArb,
        fc.constantFrom(...requiredStringFields),
        (payload, fieldToEmpty) => {
          const invalidPayload = { ...payload, [fieldToEmpty]: "" };
          const result = lessonPlanSchema.safeParse(invalidPayload);
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
