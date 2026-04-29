// Feature: lesson-plan, Property 6: List card displays required fields

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as fc from "fast-check";
import { LessonPlanCard } from "../components/LessonPlanCard";
import type { LessonPlan, PlanStatus } from "../types";

/**
 * Validates: Requirements 2.6
 *
 * Property 6: List card displays all required fields
 * For any LessonPlan, the rendered list card must include the plan's
 * title, subject, gradeOrClass, date, and status — none of these fields
 * should be absent from the rendered output.
 */

// ─── Mock DropdownMenu to avoid Radix portal issues in jsdom ─────────────────
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const planStatusArb = fc.constantFrom<PlanStatus>("draft", "ready", "completed");

/** Generates a valid YYYY-MM-DD date string */
const dateStringArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // cap at 28 to avoid invalid dates
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );

/** Generates a non-empty string (avoids empty titles/subjects that would be invisible) */
const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => s.trim().length > 0);

/** Generates an arbitrary LessonPlan object */
const lessonPlanArb: fc.Arbitrary<LessonPlan> = fc
  .record({
    id: fc.uuid(),
    _id: fc.uuid(),
    staffId: fc.uuid(),
    institutionId: fc.uuid(),
    title: nonEmptyStringArb,
    subject: nonEmptyStringArb,
    gradeOrClass: nonEmptyStringArb,
    date: dateStringArb,
    durationMinutes: fc.integer({ min: 1, max: 300 }),
    status: planStatusArb,
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  })
  .map((record) => record as LessonPlan);

// ─── No-op callbacks ──────────────────────────────────────────────────────────

const noop = () => {};

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("LessonPlanCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the plan title", () => {
    const plan: LessonPlan = {
      id: "1",
      _id: "1",
      staffId: "s1",
      institutionId: "i1",
      title: "Introduction to Fractions",
      subject: "Maths",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
      durationMinutes: 45,
      status: "draft",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    render(
      <LessonPlanCard
        plan={plan}
        onEdit={noop}
        onDelete={noop}
        onStatusChange={noop}
      />,
    );

    expect(screen.getByText("Introduction to Fractions")).toBeTruthy();
  });

  it("renders subject, gradeOrClass, and duration", () => {
    const plan: LessonPlan = {
      id: "2",
      _id: "2",
      staffId: "s1",
      institutionId: "i1",
      title: "Photosynthesis",
      subject: "Science",
      gradeOrClass: "Grade 6B",
      date: "2025-06-18",
      durationMinutes: 60,
      status: "ready",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    render(
      <LessonPlanCard
        plan={plan}
        onEdit={noop}
        onDelete={noop}
        onStatusChange={noop}
      />,
    );

    expect(screen.getByText("Science")).toBeTruthy();
    expect(screen.getByText("Grade 6B")).toBeTruthy();
    expect(screen.getByText("60 min")).toBeTruthy();
  });

  it("hides the dropdown menu when readOnly is true", () => {
    const plan: LessonPlan = {
      id: "3",
      _id: "3",
      staffId: "s1",
      institutionId: "i1",
      title: "Read Only Plan",
      subject: "History",
      gradeOrClass: "Grade 4",
      date: "2025-07-01",
      durationMinutes: 30,
      status: "completed",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    render(
      <LessonPlanCard
        plan={plan}
        onEdit={noop}
        onDelete={noop}
        onStatusChange={noop}
        readOnly
      />,
    );

    // The three-dot button should not be present
    expect(screen.queryByRole("button", { name: /plan actions/i })).toBeNull();
  });

  // ── Property 6: List card displays required fields ────────────────────────

  it("Property 6: for any LessonPlan, the card renders title, subject, gradeOrClass, date, and status", () => {
    // Validates: Requirements 2.6
    fc.assert(
      fc.property(lessonPlanArb, (plan) => {
        const { container } = render(
          <LessonPlanCard
            plan={plan}
            onEdit={noop}
            onDelete={noop}
            onStatusChange={noop}
          />,
        );

        const text = container.textContent ?? "";

        // Title must appear
        expect(text).toContain(plan.title);

        // Subject must appear
        expect(text).toContain(plan.subject);

        // gradeOrClass must appear
        expect(text).toContain(plan.gradeOrClass);

        // Date: the formatted date should contain the year and day number
        const [yearStr, , dayStr] = plan.date.split("-");
        expect(text).toContain(yearStr);
        // Day may be rendered without leading zero (e.g. "1" not "01")
        expect(text).toContain(String(parseInt(dayStr, 10)));

        // Status badge label must appear
        const STATUS_LABELS: Record<PlanStatus, string> = {
          draft: "Draft",
          ready: "Ready",
          completed: "Completed",
        };
        expect(text).toContain(STATUS_LABELS[plan.status]);

        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});
