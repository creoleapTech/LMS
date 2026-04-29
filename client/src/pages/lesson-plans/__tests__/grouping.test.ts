// Feature: lesson-plan, Property 4: Month-view grouping invariant
// Feature: lesson-plan, Property 5: Week-view grouping invariant

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { groupByMonth, groupByWeek } from "../types";
import type { LessonPlan, PlanStatus } from "../types";

/**
 * Validates: Requirements 2.3, 2.4
 *
 * Property 4: Month-view grouping invariant
 * For any non-empty list of lesson plans, grouping them into month-view
 * should produce groups where every plan in a group has a `date` falling
 * within that group's calendar month, and the groups are ordered
 * chronologically by month.
 *
 * Property 5: Week-view grouping invariant
 * For any non-empty list of lesson plans, grouping them into week-view
 * should produce groups where every plan in a group has a `date` falling
 * within that group's ISO week, and the groups are ordered chronologically
 * by week.
 */

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const planStatusArb = fc.constantFrom<PlanStatus>("draft", "ready", "completed");

/**
 * Generates a valid YYYY-MM-DD date string.
 * Day is capped at 28 to avoid invalid dates (e.g. Feb 30).
 */
const dateStringArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );

/** Generates a minimal LessonPlan with a random date */
const lessonPlanArb: fc.Arbitrary<LessonPlan> = fc
  .record({
    id: fc.uuid(),
    _id: fc.uuid(),
    staffId: fc.uuid(),
    institutionId: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    subject: fc.string({ minLength: 1, maxLength: 30 }),
    gradeOrClass: fc.string({ minLength: 1, maxLength: 20 }),
    date: dateStringArb,
    durationMinutes: fc.integer({ min: 1, max: 300 }),
    status: planStatusArb,
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  })
  .map((record) => record as LessonPlan);

/** Generates a non-empty array of lesson plans */
const nonEmptyPlansArb = fc.array(lessonPlanArb, { minLength: 1, maxLength: 50 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the ISO week number and ISO week-year for a YYYY-MM-DD date string.
 * Mirrors the logic in types.ts getISOWeek.
 */
function getISOWeekKey(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const date = new Date(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    parseInt(dayStr, 10),
  );
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const weekPadded = String(week).padStart(2, "0");
  return `${d.getUTCFullYear()}-W${weekPadded}`;
}

/** Returns the "YYYY-MM" month key for a YYYY-MM-DD date string */
function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("groupByMonth", () => {
  it("returns an empty array for an empty input", () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it("groups a single plan into one group", () => {
    const plan: LessonPlan = {
      id: "1",
      _id: "1",
      staffId: "s1",
      institutionId: "i1",
      title: "Test",
      subject: "Maths",
      gradeOrClass: "Grade 5",
      date: "2025-06-12",
      durationMinutes: 45,
      status: "draft",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };
    const groups = groupByMonth([plan]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("2025-06");
    expect(groups[0].label).toBe("June 2025");
    expect(groups[0].plans).toHaveLength(1);
  });

  it("groups plans from the same month together", () => {
    const makePlan = (id: string, date: string): LessonPlan => ({
      id,
      _id: id,
      staffId: "s1",
      institutionId: "i1",
      title: "Test",
      subject: "Maths",
      gradeOrClass: "Grade 5",
      date,
      durationMinutes: 45,
      status: "draft",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    const plans = [
      makePlan("1", "2025-06-01"),
      makePlan("2", "2025-06-15"),
      makePlan("3", "2025-07-01"),
    ];

    const groups = groupByMonth(plans);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("2025-06");
    expect(groups[0].plans).toHaveLength(2);
    expect(groups[1].key).toBe("2025-07");
    expect(groups[1].plans).toHaveLength(1);
  });

  it("orders groups chronologically", () => {
    const makePlan = (id: string, date: string): LessonPlan => ({
      id,
      _id: id,
      staffId: "s1",
      institutionId: "i1",
      title: "Test",
      subject: "Maths",
      gradeOrClass: "Grade 5",
      date,
      durationMinutes: 45,
      status: "draft",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    // Provide plans out of chronological order
    const plans = [
      makePlan("3", "2025-08-01"),
      makePlan("1", "2025-06-01"),
      makePlan("2", "2025-07-01"),
    ];

    const groups = groupByMonth(plans);
    expect(groups.map((g) => g.key)).toEqual(["2025-06", "2025-07", "2025-08"]);
  });

  // ── Property 4: Month-view grouping invariant ─────────────────────────────

  it("Property 4: every plan in a group has a date in that group's calendar month", () => {
    // Validates: Requirements 2.3
    fc.assert(
      fc.property(nonEmptyPlansArb, (plans) => {
        const groups = groupByMonth(plans);

        for (const group of groups) {
          for (const plan of group.plans) {
            // The plan's month key must match the group key
            expect(getMonthKey(plan.date)).toBe(group.key);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Property 4: all plans are preserved across groups (no plans lost or duplicated)", () => {
    // Validates: Requirements 2.3
    fc.assert(
      fc.property(nonEmptyPlansArb, (plans) => {
        const groups = groupByMonth(plans);
        const allGroupedPlans = groups.flatMap((g) => g.plans);

        // Total count must match
        expect(allGroupedPlans).toHaveLength(plans.length);

        // Every original plan must appear in exactly one group
        for (const plan of plans) {
          const count = allGroupedPlans.filter((p) => p.id === plan.id).length;
          expect(count).toBe(1);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Property 4: groups are ordered chronologically by month key", () => {
    // Validates: Requirements 2.3
    fc.assert(
      fc.property(nonEmptyPlansArb, (plans) => {
        const groups = groupByMonth(plans);
        const keys = groups.map((g) => g.key);

        for (let i = 1; i < keys.length; i++) {
          // Each key must be strictly greater than the previous (lexicographic
          // order works for "YYYY-MM" keys)
          expect(keys[i] > keys[i - 1]).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Property 4: group labels match the expected 'Month YYYY' format", () => {
    // Validates: Requirements 2.3
    const MONTH_NAMES = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    fc.assert(
      fc.property(nonEmptyPlansArb, (plans) => {
        const groups = groupByMonth(plans);

        for (const group of groups) {
          const [yearStr, monthStr] = group.key.split("-");
          const expectedLabel = `${MONTH_NAMES[parseInt(monthStr, 10) - 1]} ${yearStr}`;
          expect(group.label).toBe(expectedLabel);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("groupByWeek", () => {
  it("returns an empty array for an empty input", () => {
    expect(groupByWeek([])).toEqual([]);
  });

  it("groups a single plan into one group", () => {
    const plan: LessonPlan = {
      id: "1",
      _id: "1",
      staffId: "s1",
      institutionId: "i1",
      title: "Test",
      subject: "Maths",
      gradeOrClass: "Grade 5",
      date: "2025-06-12", // ISO week 24 of 2025
      durationMinutes: 45,
      status: "draft",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };
    const groups = groupByWeek([plan]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("2025-W24");
    expect(groups[0].label).toBe("Week 24, 2025");
    expect(groups[0].plans).toHaveLength(1);
  });

  it("groups plans from the same ISO week together", () => {
    const makePlan = (id: string, date: string): LessonPlan => ({
      id,
      _id: id,
      staffId: "s1",
      institutionId: "i1",
      title: "Test",
      subject: "Maths",
      gradeOrClass: "Grade 5",
      date,
      durationMinutes: 45,
      status: "draft",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    // 2025-06-09 (Mon) and 2025-06-13 (Fri) are both in ISO week 24
    // 2025-06-16 (Mon) is in ISO week 25
    const plans = [
      makePlan("1", "2025-06-09"),
      makePlan("2", "2025-06-13"),
      makePlan("3", "2025-06-16"),
    ];

    const groups = groupByWeek(plans);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("2025-W24");
    expect(groups[0].plans).toHaveLength(2);
    expect(groups[1].key).toBe("2025-W25");
    expect(groups[1].plans).toHaveLength(1);
  });

  it("orders groups chronologically", () => {
    const makePlan = (id: string, date: string): LessonPlan => ({
      id,
      _id: id,
      staffId: "s1",
      institutionId: "i1",
      title: "Test",
      subject: "Maths",
      gradeOrClass: "Grade 5",
      date,
      durationMinutes: 45,
      status: "draft",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    });

    // Provide plans out of order
    const plans = [
      makePlan("3", "2025-06-23"), // W26
      makePlan("1", "2025-06-09"), // W24
      makePlan("2", "2025-06-16"), // W25
    ];

    const groups = groupByWeek(plans);
    expect(groups.map((g) => g.key)).toEqual(["2025-W24", "2025-W25", "2025-W26"]);
  });

  // ── Property 5: Week-view grouping invariant ──────────────────────────────

  it("Property 5: every plan in a group has a date in that group's ISO week", () => {
    // Validates: Requirements 2.4
    fc.assert(
      fc.property(nonEmptyPlansArb, (plans) => {
        const groups = groupByWeek(plans);

        for (const group of groups) {
          for (const plan of group.plans) {
            // The plan's ISO week key must match the group key
            expect(getISOWeekKey(plan.date)).toBe(group.key);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Property 5: all plans are preserved across groups (no plans lost or duplicated)", () => {
    // Validates: Requirements 2.4
    fc.assert(
      fc.property(nonEmptyPlansArb, (plans) => {
        const groups = groupByWeek(plans);
        const allGroupedPlans = groups.flatMap((g) => g.plans);

        // Total count must match
        expect(allGroupedPlans).toHaveLength(plans.length);

        // Every original plan must appear in exactly one group
        for (const plan of plans) {
          const count = allGroupedPlans.filter((p) => p.id === plan.id).length;
          expect(count).toBe(1);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Property 5: groups are ordered chronologically by week key", () => {
    // Validates: Requirements 2.4
    fc.assert(
      fc.property(nonEmptyPlansArb, (plans) => {
        const groups = groupByWeek(plans);
        const keys = groups.map((g) => g.key);

        for (let i = 1; i < keys.length; i++) {
          // Each key must be strictly greater than the previous (lexicographic
          // order works for "YYYY-WNN" keys with zero-padded week numbers)
          expect(keys[i] > keys[i - 1]).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Property 5: group labels match the expected 'Week N, YYYY' format", () => {
    // Validates: Requirements 2.4
    fc.assert(
      fc.property(nonEmptyPlansArb, (plans) => {
        const groups = groupByWeek(plans);

        for (const group of groups) {
          // key format: "YYYY-WNN"
          const [yearStr, weekPart] = group.key.split("-W");
          const week = parseInt(weekPart, 10);
          const expectedLabel = `Week ${week}, ${yearStr}`;
          expect(group.label).toBe(expectedLabel);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("Property 5: handles year-boundary weeks correctly (ISO week year may differ from calendar year)", () => {
    // Validates: Requirements 2.4
    // 2025-12-29 is in ISO week 1 of 2026
    const plan: LessonPlan = {
      id: "1",
      _id: "1",
      staffId: "s1",
      institutionId: "i1",
      title: "Year boundary test",
      subject: "Maths",
      gradeOrClass: "Grade 5",
      date: "2025-12-29",
      durationMinutes: 45,
      status: "draft",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    const groups = groupByWeek([plan]);
    expect(groups).toHaveLength(1);
    // The ISO week year should be 2026, not 2025
    expect(groups[0].key).toBe("2026-W01");
    expect(groups[0].label).toBe("Week 1, 2026");
  });
});
