import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  filterStudentsBySection,
  getSortValue,
  sectionsInStudents,
  sortStudents,
} from "../lib/sorting";
import type { ExaminationColumn, StudentRow } from "../types";

// Feature: examination-feature, roster view — section filter + sorting.
// Students can be filtered to one section; every column (marks, totals,
// names) sorts both directions with blanks/absent always last.

const sectionArb = fc.constantFrom("A", "B", "C");

const studentArb: fc.Arbitrary<StudentRow> = fc.record({
  studentId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 12 }),
  classId: fc.uuid(),
  grade: fc.constantFrom("1", "4", "10"),
  section: sectionArb,
});

describe("filterStudentsBySection", () => {
  it("returns only the requested section, or everyone for 'all'", () => {
    fc.assert(
      fc.property(fc.array(studentArb), sectionArb, (students, section) => {
        const filtered = filterStudentsBySection(students, section);
        expect(filtered.every((s) => s.section === section)).toBe(true);
        expect(filtered.length).toBe(students.filter((s) => s.section === section).length);
        expect(filterStudentsBySection(students, "all")).toEqual(students);
      }),
      { numRuns: 100 }
    );
  });
});

describe("sectionsInStudents", () => {
  it("returns distinct sections sorted alphabetically", () => {
    fc.assert(
      fc.property(fc.array(studentArb), (students) => {
        const result = sectionsInStudents(students);
        expect(new Set(result).size).toBe(result.length);
        expect(result).toEqual([...result].sort((a, b) => a.localeCompare(b)));
      }),
      { numRuns: 100 }
    );
  });
});

describe("sortStudents: numeric columns (marks)", () => {
  it("orders marks ascending/descending with blanks and absent last in both directions", () => {
    fc.assert(
      fc.property(
        fc.array(studentArb, { minLength: 1, maxLength: 15 }),
        fc.constantFrom("asc" as const, "desc" as const),
        (students, direction) => {
          const column: ExaminationColumn = {
            id: "col-practical",
            grade: "4",
            name: "Practical",
            type: "number",
            order: 0,
          };
          // Random marks: numbers, blanks, and absent codes
          const values = students.map(() =>
            fc.sample(
              fc.oneof(
                fc.integer({ min: 0, max: 100 }).map(String),
                fc.constant(""),
                fc.constantFrom("AB", "absent")
              ),
              1
            )[0]
          );
          const cells = students.map((s, i) => ({
            studentId: s.studentId,
            columnId: "col-practical",
            value: values[i],
          }));

          const sorted = sortStudents(
            students,
            { key: "col-practical", direction },
            [column],
            cells
          );

          // Same students, none lost or duplicated
          expect(sorted.map((s) => s.studentId).sort()).toEqual(
            students.map((s) => s.studentId).sort()
          );

          // Pairwise order check: numerics ordered, nulls sink
          const keys = sorted.map((s) =>
            getSortValue(s, "col-practical", [column], cells)
          );
          for (let i = 1; i < keys.length; i++) {
            const prev = keys[i - 1];
            const curr = keys[i];
            if (curr.numeric === null) {
              // nulls sink — always fine for curr to be null here
              continue;
            }
            if (prev.numeric === null) {
              expect.unreachable(
                "null/blank mark must not precede a numeric mark"
              );
            }
            if (direction === "asc") {
              expect(prev.numeric as number).toBeLessThanOrEqual(curr.numeric as number);
            } else {
              expect(prev.numeric as number).toBeGreaterThanOrEqual(curr.numeric as number);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("sortStudents: formula totals", () => {
  it("sorts computed totals numerically (highest/lowest grand totals)", () => {
    const cols: ExaminationColumn[] = [
      { id: "c1", grade: "4", name: "Practical", type: "number", order: 0 },
      { id: "c2", grade: "4", name: "Theory", type: "number", order: 1 },
      { id: "c3", grade: "4", name: "Total", type: "formula", formula: "Practical + Theory", order: 2 },
    ];
    fc.assert(
      fc.property(
        fc.array(studentArb, { minLength: 2, maxLength: 10 }),
        fc.constantFrom("asc" as const, "desc" as const),
        (students, direction) => {
          const cells = students.flatMap((s) => [
            {
              studentId: s.studentId,
              columnId: "c1",
              value: String(fc.sample(fc.integer({ min: 0, max: 50 }), 1)[0]),
            },
            {
              studentId: s.studentId,
              columnId: "c2",
              value: String(fc.sample(fc.integer({ min: 0, max: 50 }), 1)[0]),
            },
          ]);

          const sorted = sortStudents(students, { key: "c3", direction }, cols, cells);
          const totals = sorted.map(
            (s) => getSortValue(s, "c3", cols, cells).numeric as number
          );
          for (let i = 1; i < totals.length; i++) {
            if (direction === "asc") {
              expect(totals[i - 1]).toBeLessThanOrEqual(totals[i]);
            } else {
              expect(totals[i - 1]).toBeGreaterThanOrEqual(totals[i]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("sortStudents: default columns + null sort", () => {
  it("sorts names alphabetically and leaves order untouched for null/unknown keys", () => {
    fc.assert(
      fc.property(fc.array(studentArb, { maxLength: 12 }), (students) => {
        const byName = sortStudents(students, { key: "studentName", direction: "asc" }, [], []);
        const names = byName.map((s) => s.name);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

        expect(sortStudents(students, null, [], [])).toEqual(students);
        expect(
          sortStudents(students, { key: "no-such-column", direction: "desc" }, [], []).map(
            (s) => s.studentId
          )
        ).toEqual(students.map((s) => s.studentId));
      }),
      { numRuns: 100 }
    );
  });
});
