import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  columnsForGrade,
  studentsForGrade,
  gradesFromStudents,
  type ExaminationColumn,
  type StudentRow,
} from "../types";

// Feature: examination-feature, per-grade column isolation.
// Each grade owns an independent column set; sections of one grade share it.

const gradeArb = fc.constantFrom("1", "2", "3");

const columnArb: fc.Arbitrary<ExaminationColumn> = fc.record({
  id: fc.uuid(),
  grade: gradeArb,
  name: fc.string({ minLength: 1, maxLength: 12 }),
  type: fc.constantFrom("number" as const, "text" as const, "formula" as const),
  order: fc.nat({ max: 20 }),
});

const studentArb: fc.Arbitrary<StudentRow> = fc.record({
  studentId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 12 }),
  classId: fc.uuid(),
  grade: gradeArb,
  section: fc.constantFrom("A", "B", "C"),
});

describe("columnsForGrade: grade isolation", () => {
  it("returns only the requested grade's columns, sorted by order", () => {
    fc.assert(
      fc.property(fc.array(columnArb), gradeArb, (columns, grade) => {
        const result = columnsForGrade(columns, grade);
        // Every returned column belongs to the requested grade
        expect(result.every((c) => c.grade === grade)).toBe(true);
        // Every matching column is present
        expect(result.length).toBe(columns.filter((c) => c.grade === grade).length);
        // Sorted by order ascending
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1].order).toBeLessThanOrEqual(result[i].order);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("never leaks another grade's columns into the result", () => {
    fc.assert(
      fc.property(fc.array(columnArb, { minLength: 1 }), (columns) => {
        const grades = [...new Set(columns.map((c) => c.grade))];
        for (const grade of grades) {
          const result = columnsForGrade(columns, grade);
          const otherIds = new Set(
            columns.filter((c) => c.grade !== grade).map((c) => c.id)
          );
          expect(result.every((c) => !otherIds.has(c.id))).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("studentsForGrade: section sharing within a grade", () => {
  it("returns only the requested grade's students", () => {
    fc.assert(
      fc.property(fc.array(studentArb), gradeArb, (students, grade) => {
        const result = studentsForGrade(students, grade);
        expect(result.every((s) => s.grade === grade)).toBe(true);
        expect(result.length).toBe(students.filter((s) => s.grade === grade).length);
      }),
      { numRuns: 100 }
    );
  });
});

describe("gradesFromStudents: distinct sorted grades", () => {
  it("returns distinct grades in numeric order", () => {
    fc.assert(
      fc.property(fc.array(studentArb), (students) => {
        const result = gradesFromStudents(students);
        expect(new Set(result).size).toBe(result.length);
        const sorted = [...result].sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
        expect(result).toEqual(sorted);
      }),
      { numRuns: 100 }
    );
  });
});
