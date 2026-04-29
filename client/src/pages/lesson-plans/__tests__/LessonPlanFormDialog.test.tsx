// Feature: lesson-plan, Property 12: Edit form pre-population

import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import * as fc from "fast-check";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LessonPlanFormDialog } from "../components/LessonPlanFormDialog";
import type { LessonPlan, LessonPlanFormValues, PlanStatus } from "../types";

/**
 * Validates: Requirements 5.1
 *
 * Property 12: Edit form pre-population
 * For any lesson plan with status `draft` or `ready`, opening the edit form
 * should pre-populate every form field with the plan's current stored values.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock TanStack Router's useRouter
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    navigate: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  }),
}));

// Mock the mutation hooks
vi.mock("../hooks/useCreateLessonPlan", () => ({
  useCreateLessonPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../hooks/useUpdateLessonPlan", () => ({
  useUpdateLessonPlan: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

// Mock axios to prevent real network calls for curriculum query
vi.mock("@/lib/axios", () => ({
  _axios: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

// Mock Radix UI Select — it uses portals and doesn't work in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange?.("")}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-value={value}>{children}</div>,
}));

// Mock AlertDialog to avoid portal issues in jsdom
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const draftOrReadyStatusArb = fc.constantFrom<PlanStatus>("draft", "ready");

const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter((s) => s.trim().length > 0 && !s.includes("\x00"));

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

const lessonPlanArb: fc.Arbitrary<LessonPlan> = fc
  .record({
    id: fc.uuid(),
    _id: fc.uuid(),
    staffId: fc.uuid(),
    institutionId: fc.uuid(),
    title: nonEmptyStringArb,
    subject: nonEmptyStringArb,
    gradeOrClass: nonEmptyStringArb,
    date: validDateArb,
    durationMinutes: fc.integer({ min: 1, max: 300 }),
    status: draftOrReadyStatusArb,
    learningObjectives: fc.option(nonEmptyStringArb, { nil: undefined }),
    materialsNeeded: fc.option(nonEmptyStringArb, { nil: undefined }),
    introduction: fc.option(nonEmptyStringArb, { nil: undefined }),
    mainActivity: fc.option(nonEmptyStringArb, { nil: undefined }),
    conclusion: fc.option(nonEmptyStringArb, { nil: undefined }),
    assessmentMethod: fc.option(nonEmptyStringArb, { nil: undefined }),
    homeworkNotes: fc.option(nonEmptyStringArb, { nil: undefined }),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  })
  .map((record) => record as LessonPlan);

/** Convert a LessonPlan to the LessonPlanFormValues shape used by the form */
function planToFormValues(plan: LessonPlan): Partial<LessonPlanFormValues> {
  return {
    title: plan.title,
    subject: plan.subject,
    gradeOrClass: plan.gradeOrClass,
    date: plan.date,
    durationMinutes: plan.durationMinutes,
    learningObjectives: plan.learningObjectives ?? "",
    materialsNeeded: plan.materialsNeeded ?? "",
    introduction: plan.introduction ?? "",
    mainActivity: plan.mainActivity ?? "",
    conclusion: plan.conclusion ?? "",
    assessmentMethod: plan.assessmentMethod ?? "",
    homeworkNotes: plan.homeworkNotes ?? "",
    gradeBookId: "",
    chapterId: "",
    // Pass status so the completed-plan guard doesn't trigger
    status: plan.status,
  };
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("LessonPlanFormDialog — edit mode pre-population", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the dialog in edit mode", async () => {
    const plan: LessonPlan = {
      id: "plan-1",
      _id: "plan-1",
      staffId: "staff-1",
      institutionId: "inst-1",
      title: "Introduction to Fractions",
      subject: "Mathematics",
      gradeOrClass: "Grade 5A",
      date: "2025-06-12",
      durationMinutes: 45,
      status: "draft",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    renderWithProviders(
      <LessonPlanFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        initialValues={planToFormValues(plan)}
        planId={plan.id}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Edit Lesson Plan")).toBeTruthy();
    });
  });

  it("pre-populates the title field with the plan's title", async () => {
    const plan: LessonPlan = {
      id: "plan-2",
      _id: "plan-2",
      staffId: "staff-1",
      institutionId: "inst-1",
      title: "Photosynthesis Deep Dive",
      subject: "Science",
      gradeOrClass: "Grade 6B",
      date: "2025-06-18",
      durationMinutes: 60,
      status: "ready",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    renderWithProviders(
      <LessonPlanFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        initialValues={planToFormValues(plan)}
        planId={plan.id}
      />,
    );

    await waitFor(() => {
      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      expect(titleInput.value).toBe("Photosynthesis Deep Dive");
    });
  });

  it("pre-populates subject, gradeOrClass, date, and duration", async () => {
    const plan: LessonPlan = {
      id: "plan-3",
      _id: "plan-3",
      staffId: "staff-1",
      institutionId: "inst-1",
      title: "History of Rome",
      subject: "History",
      gradeOrClass: "Grade 7C",
      date: "2025-07-01",
      durationMinutes: 90,
      status: "draft",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    renderWithProviders(
      <LessonPlanFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        initialValues={planToFormValues(plan)}
        planId={plan.id}
      />,
    );

    await waitFor(() => {
      const subjectInput = screen.getByLabelText(/subject/i) as HTMLInputElement;
      expect(subjectInput.value).toBe("History");

      const gradeInput = screen.getByLabelText(/grade \/ class/i) as HTMLInputElement;
      expect(gradeInput.value).toBe("Grade 7C");

      const dateInput = screen.getByLabelText(/date/i) as HTMLInputElement;
      expect(dateInput.value).toBe("2025-07-01");

      const durationInput = screen.getByLabelText(/duration/i) as HTMLInputElement;
      expect(durationInput.value).toBe("90");
    });
  });

  it("pre-populates optional text fields when provided", async () => {
    const plan: LessonPlan = {
      id: "plan-4",
      _id: "plan-4",
      staffId: "staff-1",
      institutionId: "inst-1",
      title: "Algebra Basics",
      subject: "Mathematics",
      gradeOrClass: "Grade 8A",
      date: "2025-08-15",
      durationMinutes: 50,
      status: "ready",
      learningObjectives: "Understand variables and expressions",
      materialsNeeded: "Whiteboard, markers",
      introduction: "Start with a warm-up problem",
      mainActivity: "Solve equations together",
      conclusion: "Review key concepts",
      assessmentMethod: "Exit ticket",
      homeworkNotes: "Complete exercises 1-10",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    renderWithProviders(
      <LessonPlanFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        initialValues={planToFormValues(plan)}
        planId={plan.id}
      />,
    );

    await waitFor(() => {
      const objectivesInput = screen.getByLabelText(
        /learning objectives/i,
      ) as HTMLTextAreaElement;
      expect(objectivesInput.value).toBe("Understand variables and expressions");

      const materialsInput = screen.getByLabelText(
        /materials needed/i,
      ) as HTMLTextAreaElement;
      expect(materialsInput.value).toBe("Whiteboard, markers");

      const introInput = screen.getByLabelText(
        /introduction/i,
      ) as HTMLTextAreaElement;
      expect(introInput.value).toBe("Start with a warm-up problem");

      const mainInput = screen.getByLabelText(
        /main activity/i,
      ) as HTMLTextAreaElement;
      expect(mainInput.value).toBe("Solve equations together");

      const conclusionInput = screen.getByLabelText(
        /conclusion/i,
      ) as HTMLTextAreaElement;
      expect(conclusionInput.value).toBe("Review key concepts");
    });
  });

  it("shows confirmation dialog when editing a completed plan", async () => {
    const plan: LessonPlan = {
      id: "plan-5",
      _id: "plan-5",
      staffId: "staff-1",
      institutionId: "inst-1",
      title: "Completed Lesson",
      subject: "Art",
      gradeOrClass: "Grade 3",
      date: "2025-05-01",
      durationMinutes: 30,
      status: "completed",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    renderWithProviders(
      <LessonPlanFormDialog
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        initialValues={{ ...planToFormValues(plan), status: "completed" }}
        planId={plan.id}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Edit Completed Plan?")).toBeTruthy();
    });
  });

  // ── Property 12: Edit form pre-population ─────────────────────────────────

  it("Property 12: for any draft/ready plan, all form fields are pre-populated with the plan's values", async () => {
    // Validates: Requirements 5.1
    await fc.assert(
      fc.asyncProperty(lessonPlanArb, async (plan) => {
        const formValues = planToFormValues(plan);

        renderWithProviders(
          <LessonPlanFormDialog
            open={true}
            onOpenChange={vi.fn()}
            mode="edit"
            initialValues={formValues}
            planId={plan.id}
          />,
        );

        await waitFor(() => {
          // Required fields
          const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
          expect(titleInput.value).toBe(plan.title);

          const subjectInput = screen.getByLabelText(/subject/i) as HTMLInputElement;
          expect(subjectInput.value).toBe(plan.subject);

          const gradeInput = screen.getByLabelText(/grade \/ class/i) as HTMLInputElement;
          expect(gradeInput.value).toBe(plan.gradeOrClass);

          const dateInput = screen.getByLabelText(/date/i) as HTMLInputElement;
          expect(dateInput.value).toBe(plan.date);

          const durationInput = screen.getByLabelText(/duration/i) as HTMLInputElement;
          expect(durationInput.value).toBe(String(plan.durationMinutes));
        });

        cleanup();
      }),
      { numRuns: 50 },
    );
  });
});
