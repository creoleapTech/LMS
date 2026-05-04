import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { examinationSchema, columnConfigSchema, formatClassLabel } from "../types";

// Feature: examination-feature, Property 4: Column config schema rejects invalid formulas
describe("Property 4: Column config schema rejects invalid formulas", () => {
  it("rejects formula column configs with empty, whitespace-only, or undefined formula", () => {
    // Validates: Requirements 8.6, 19.3
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(""),
          fc.constant(undefined),
          fc.stringMatching(/^\s+$/)
        ),
        (generatedFormula) => {
          const result = columnConfigSchema.safeParse({
            name: "Test",
            type: "formula",
            formula: generatedFormula,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: examination-feature, Property 5: Examination schema rejects empty names
describe("Property 5: Examination schema rejects empty names", () => {
  it("rejects examination names that are empty or composed entirely of whitespace", () => {
    // Validates: Requirements 2.3, 19.1
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(""), fc.stringMatching(/^\s+$/)),
        (generatedName) => {
          const result = examinationSchema.safeParse({ name: generatedName });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: examination-feature, Property 9: Class label format
describe("Property 9: Class label format", () => {
  it("returns a string matching 'Class {grade} - {section}' for any grade and section", () => {
    // Validates: Requirements 3.4
    fc.assert(
      fc.property(fc.string(), fc.string(), (grade, section) => {
        const label = formatClassLabel(grade, section);
        expect(label).toBe("Class " + grade + " - " + section);
      }),
      { numRuns: 100 }
    );
  });
});
