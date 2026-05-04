import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { CellData } from "../types";

// Feature: examination-feature, Property 6: Cell serialization round-trip
describe("Property 6: Cell serialization round-trip", () => {
  it("produces an object deeply equal to the original after JSON.parse(JSON.stringify(cell))", () => {
    // Validates: Requirements 11.1, 11.3
    fc.assert(
      fc.property(
        fc.record<CellData>({
          studentId: fc.string(),
          columnId: fc.string(),
          value: fc.string(),
        }),
        (cell) => {
          const deserialized: CellData = JSON.parse(JSON.stringify(cell));
          expect(deserialized).toEqual(cell);
        }
      ),
      { numRuns: 100 }
    );
  });
});
