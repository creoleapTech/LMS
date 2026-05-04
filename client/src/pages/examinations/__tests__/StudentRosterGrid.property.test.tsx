// @vitest-environment jsdom

// Feature: examination-feature, Property 8: Default columns are always present and non-removable

import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import { render, screen, cleanup } from "@testing-library/react";
import { StudentRosterGrid } from "../components/StudentRosterGrid";
import type { ExaminationDetail } from "../types";

afterEach(() => {
  cleanup();
});

describe("Property 8: Default columns are always present and non-removable", () => {
  it("renders Student Name, Class, and Section headers for any combination of user columns", () => {
    // Validates: Requirements 4.2, 4.3, 15.5
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 20 }),
            type: fc.constantFrom("number" as const, "text" as const),
            order: fc.nat(),
          })
        ),
        (userColumns) => {
          const examination: ExaminationDetail = {
            id: "exam-1",
            _id: "exam-1",
            name: "Test Examination",
            createdBy: "user-1",
            institutionId: "inst-1",
            selectedClassIds: [],
            columns: userColumns,
            students: [],
            cells: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const { unmount } = render(
            <StudentRosterGrid
              examination={examination}
              isReadOnly={true}
              onCellChange={() => {}}
              onAddColumn={() => {}}
              onEditColumn={() => {}}
              onDeleteColumn={() => {}}
              onReorderColumn={() => {}}
            />
          );

          expect(screen.getByText("Student Name")).toBeTruthy();
          expect(screen.getByText("Class")).toBeTruthy();
          expect(screen.getByText("Section")).toBeTruthy();

          unmount();
        }
      )
    );
  });
});
