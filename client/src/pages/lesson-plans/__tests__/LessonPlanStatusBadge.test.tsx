// Feature: lesson-plan, Property 9: Status badge variant mapping

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as fc from "fast-check";
import { LessonPlanStatusBadge } from "../components/LessonPlanStatusBadge";
import type { PlanStatus } from "../types";

/**
 * Validates: Requirements 7.3, 7.4, 7.5
 *
 * Property 9: Status badge variant mapping
 * For every PlanStatus value, the rendered badge must contain the correct
 * colour class:
 *   - draft     → bg-slate-100 text-slate-600 border-slate-300
 *   - ready     → bg-indigo-100 text-indigo-700 border-indigo-300
 *   - completed → bg-emerald-100 text-emerald-700 border-emerald-300
 */

const PLAN_STATUSES: PlanStatus[] = ["draft", "ready", "completed"];

const EXPECTED_CLASSES: Record<PlanStatus, string[]> = {
  draft: ["bg-slate-100", "text-slate-600", "border-slate-300"],
  ready: ["bg-indigo-100", "text-indigo-700", "border-indigo-300"],
  completed: ["bg-emerald-100", "text-emerald-700", "border-emerald-300"],
};

const EXPECTED_LABELS: Record<PlanStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  completed: "Completed",
};

describe("LessonPlanStatusBadge", () => {
  afterEach(() => {
    cleanup();
  });

  // ── Unit tests: one per status ──────────────────────────────────────────

  it("renders draft badge with neutral grey classes", () => {
    const { getByText } = render(<LessonPlanStatusBadge status="draft" />);
    const badge = getByText("Draft");
    expect(badge.className).toContain("bg-slate-100");
    expect(badge.className).toContain("text-slate-600");
    expect(badge.className).toContain("border-slate-300");
  });

  it("renders ready badge with indigo/blue classes", () => {
    const { getByText } = render(<LessonPlanStatusBadge status="ready" />);
    const badge = getByText("Ready");
    expect(badge.className).toContain("bg-indigo-100");
    expect(badge.className).toContain("text-indigo-700");
    expect(badge.className).toContain("border-indigo-300");
  });

  it("renders completed badge with green classes", () => {
    const { getByText } = render(<LessonPlanStatusBadge status="completed" />);
    const badge = getByText("Completed");
    expect(badge.className).toContain("bg-emerald-100");
    expect(badge.className).toContain("text-emerald-700");
    expect(badge.className).toContain("border-emerald-300");
  });

  it("capitalises the status label", () => {
    for (const status of PLAN_STATUSES) {
      const { getByText } = render(<LessonPlanStatusBadge status={status} />);
      const expectedLabel = EXPECTED_LABELS[status];
      expect(getByText(expectedLabel)).toBeTruthy();
    }
  });

  it("applies smaller text class when size='sm'", () => {
    const { getByText } = render(
      <LessonPlanStatusBadge status="draft" size="sm" />,
    );
    expect(getByText("Draft").className).toContain("text-xs");
  });

  it("applies default text class when size='md'", () => {
    const { getByText } = render(
      <LessonPlanStatusBadge status="draft" size="md" />,
    );
    expect(getByText("Draft").className).toContain("text-sm");
  });

  // ── Property 9: Status badge variant mapping ────────────────────────────

  it("Property 9: every PlanStatus renders with the correct colour classes", () => {
    // Validates: Requirements 7.3, 7.4, 7.5
    fc.assert(
      fc.property(fc.constantFrom(...PLAN_STATUSES), (status: PlanStatus) => {
        const { getByText } = render(<LessonPlanStatusBadge status={status} />);
        const badge = getByText(EXPECTED_LABELS[status]);
        const expectedClasses = EXPECTED_CLASSES[status];

        for (const cls of expectedClasses) {
          expect(badge.className).toContain(cls);
        }

        // Ensure no colour classes from other statuses bleed in
        const otherStatuses = PLAN_STATUSES.filter((s) => s !== status);
        for (const other of otherStatuses) {
          // Check the primary background class of other statuses is absent
          const [otherBg] = EXPECTED_CLASSES[other];
          expect(badge.className).not.toContain(otherBg);
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});
