import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { evaluateFormula } from "../lib/formulaEngine";

// Feature: examination-feature, Property 1: Formula evaluation is deterministic
describe("Property 1: Formula evaluation is deterministic", () => {
  it("evaluating the same expression with the same context twice returns identical results", () => {
    // Validates: Requirements 9.1, 9.2
    const expressions = ["a + b", "a * b", "a - b"];

    fc.assert(
      fc.property(
        fc.constantFrom(...expressions),
        fc.record({
          a: fc.float({ noNaN: true, noDefaultInfinity: true }),
          b: fc.float({ noNaN: true, noDefaultInfinity: true }),
        }),
        (expr, vars) => {
          const context = { values: vars };
          const result1 = evaluateFormula(expr, context);
          const result2 = evaluateFormula(expr, context);

          expect(result1.value).toBe(result2.value);
          expect(result1.error).toBe(result2.error);
        }
      )
    );
  });
});

// Feature: examination-feature, Property 2: Formula round-trip
describe("Property 2: Formula round-trip — parse then evaluate preserves value", () => {
  it("evaluating 'a + b' with known values returns the mathematically correct sum", () => {
    // Validates: Requirements 8.3, 8.4, 9.1
    // Use integers to avoid subnormal float edge cases where expr-eval may
    // lose precision on extremely small denormalized numbers.
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        (a, b) => {
          const result = evaluateFormula("a + b", { values: { a, b } });

          expect(result.error).toBeNull();
          expect(result.value).not.toBeNull();

          const expected = a + b;
          expect(result.value).toBe(expected);
        }
      )
    );
  });
});

// Feature: examination-feature, Property 3: Unknown column references resolve to zero
describe("Property 3: Unknown column references resolve to zero", () => {
  it("referencing a column not in context returns a numeric result (no error/throw)", () => {
    // Validates: Requirements 9.4
    fc.assert(
      fc.property(
        fc.stringMatching(/^[c-z][a-z0-9]{1,9}$/).filter((s) => s !== "a" && s !== "b"),
        (unknownCol) => {
          // Expression references a column that is NOT in the context
          const result = evaluateFormula(unknownCol, { values: {} });

          expect(result.error).toBeNull();
          expect(result.value).not.toBeNull();
          expect(typeof result.value).toBe("number");
          // Unknown references resolve to 0
          expect(result.value).toBe(0);
        }
      )
    );
  });
});

// Feature: examination-feature, Property 7: Formula recalculation covers all dependent columns
describe("Property 7: Formula recalculation covers all dependent columns", () => {
  it("changing the value of a referenced column produces a different result when v1 !== v2", () => {
    // Validates: Requirements 9.2
    fc.assert(
      fc.property(
        fc.float({ noNaN: true, noDefaultInfinity: true }),
        fc.float({ noNaN: true, noDefaultInfinity: true }),
        (v1, v2) => {
          // Identity formula: just references the column directly
          const result1 = evaluateFormula("score", { values: { score: v1 } });
          const result2 = evaluateFormula("score", { values: { score: v2 } });

          // Both should succeed
          expect(result1.error).toBeNull();
          expect(result2.error).toBeNull();

          // When v1 !== v2, the results must differ
          if (v1 !== v2) {
            expect(result1.value).not.toBe(result2.value);
          } else {
            expect(result1.value).toBe(result2.value);
          }
        }
      )
    );
  });
});
