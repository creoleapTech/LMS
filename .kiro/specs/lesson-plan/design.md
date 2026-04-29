# Design Document: Lesson Plan Feature

## Overview

The Lesson Plan feature adds a teacher-facing planning workspace to the Creoleap LMS. Teachers can create, manage, and track structured lesson plans with rich pedagogical detail, organised by week or month. Plans follow a `draft → ready → completed` lifecycle and can optionally link to existing curriculum content. Admins and super_admins can view plans across their institution in a read-only capacity.

The feature is surfaced as a new sidebar navigation item (visible only to `teacher`, `admin`, and `super_admin` roles) and lives at the `/lesson-plans/` route prefix.

### Key Design Decisions

- **D1/Drizzle for persistence** — lesson plans are stored in the Cloudflare D1 SQLite database using the same Drizzle ORM schema pattern as `chapter_contents` in `server-cf/src/schema/books.ts`.
- **Hono controller pattern** — a new `lesson-plan-controller.ts` is added to `server-cf/src/modules/admin/` and registered in `admin-router.ts`, matching every existing controller.
- **TanStack Query for server state** — all API interactions go through React Query hooks; local component state handles form inputs and UI toggles.
- **Optimistic updates for status changes** — status badge updates are applied immediately in the UI and rolled back on API failure, matching the UX expectation in Requirement 10.4.
- **File-based routing** — two route files under `client/src/routes/lesson-plans/`: `index.tsx` (list) and `$id.tsx` (detail/edit).

---

## Architecture

```mermaid
graph TD
    subgraph Client
        A[sidebar.tsx] -->|nav item| B[/lesson-plans/ route]
        B --> C[LessonPlansPage]
        B --> D[/lesson-plans/$id route]
        D --> E[LessonPlanDetailPage]
        C --> F[LessonPlanListView]
        C --> G[LessonPlanFormDialog]
        E --> H[LessonPlanDetailView]
        E --> I[LessonPlanFormDialog edit mode]
        F --> J[useLessonPlans hook]
        G --> K[useCreateLessonPlan hook]
        H --> L[useLessonPlan hook]
        I --> M[useUpdateLessonPlan hook]
        J & K & L & M --> N[_axios / React Query]
    end

    subgraph Server - Cloudflare Worker
        N -->|HTTP| O[Hono admin-router]
        O --> P[lesson-plan-controller]
        P --> Q[D1 SQLite via Drizzle]
    end
```

### Data Flow

1. The client authenticates via JWT (stored in `localStorage` as `token`, injected by the `_axios` interceptor).
2. All lesson plan API calls go to `/admin/lesson-plans/*` on the Cloudflare Worker.
3. The controller reads `user` from the Hono context (set by `adminAuth` middleware) to scope queries by `staffId` or `institutionId`.
4. Responses follow the existing `{ success: true, data: ... }` envelope.

---

## Components and Interfaces

### Route Files

```
client/src/routes/lesson-plans/
  index.tsx          — list page route
  $id.tsx            — detail/edit page route
```

### Page Components

```
client/src/pages/lesson-plans/
  LessonPlansPage.tsx          — list page (month/week toggle, admin selectors)
  LessonPlanDetailPage.tsx     — detail/edit page
  components/
    LessonPlanListView.tsx     — grouped list (month or week)
    LessonPlanCard.tsx         — single plan card in list
    LessonPlanFormDialog.tsx   — create/edit form (Dialog)
    LessonPlanStatusBadge.tsx  — status badge with colour variants
    LessonPlanEmptyState.tsx   — empty state with CTA
    DeleteConfirmDialog.tsx    — delete confirmation (reuses AlertDialog)
  hooks/
    useLessonPlans.ts          — list query with filters
    useLessonPlan.ts           — single plan query
    useCreateLessonPlan.ts     — create mutation
    useUpdateLessonPlan.ts     — update mutation (fields + status)
    useDeleteLessonPlan.ts     — delete mutation
```

### Component Interfaces

```typescript
// LessonPlanCard props
interface LessonPlanCardProps {
  plan: LessonPlan;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PlanStatus) => void;
  readOnly?: boolean;
}

// LessonPlanFormDialog props
interface LessonPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: Partial<LessonPlanFormValues>;
  planId?: string;
}

// LessonPlanStatusBadge props
interface LessonPlanStatusBadgeProps {
  status: PlanStatus;
  size?: 'sm' | 'md';
}

// LessonPlanListView props
interface LessonPlanListViewProps {
  plans: LessonPlan[];
  viewMode: 'month' | 'week';
  readOnly?: boolean;
  onPlanClick: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PlanStatus) => void;
}
```

### API Hook Signatures

```typescript
// List with filters
function useLessonPlans(params: {
  teacherId?: string;
  institutionId?: string;
  status?: PlanStatus;
  year?: number;
  month?: number;
}): UseQueryResult<LessonPlan[]>

// Single plan
function useLessonPlan(id: string): UseQueryResult<LessonPlan>

// Mutations
function useCreateLessonPlan(): UseMutationResult<LessonPlan, Error, CreateLessonPlanPayload>
function useUpdateLessonPlan(): UseMutationResult<LessonPlan, Error, { id: string } & Partial<UpdateLessonPlanPayload>>
function useDeleteLessonPlan(): UseMutationResult<void, Error, string>
```

---

## Data Models

### Drizzle Schema — `server-cf/src/schema/lesson-plans.ts`

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { staff, institutions } from "./admin";
import { gradeBooks, chapters } from "./books";

export const lessonPlans = sqliteTable("lesson_plans", {
  id:               text("id").primaryKey(),                          // UUID v4
  staffId:          text("staff_id").notNull().references(() => staff.id),
  institutionId:    text("institution_id").notNull().references(() => institutions.id),

  // Required fields
  title:            text("title").notNull(),
  subject:          text("subject").notNull(),
  gradeOrClass:     text("grade_or_class").notNull(),                 // e.g. "Grade 5 - Section A"
  date:             text("date").notNull(),                           // ISO date string YYYY-MM-DD
  durationMinutes:  integer("duration_minutes").notNull(),

  // Status lifecycle
  status:           text("status", {
                      enum: ["draft", "ready", "completed"],
                    }).notNull().default("draft"),

  // Optional pedagogical fields
  learningObjectives: text("learning_objectives"),
  materialsNeeded:    text("materials_needed"),
  introduction:       text("introduction"),
  mainActivity:       text("main_activity"),
  conclusion:         text("conclusion"),
  assessmentMethod:   text("assessment_method"),
  homeworkNotes:      text("homework_notes"),

  // Optional curriculum link
  gradeBookId:      text("grade_book_id").references(() => gradeBooks.id),
  chapterId:        text("chapter_id").references(() => chapters.id),

  // Soft delete + timestamps
  isDeleted:        integer("is_deleted").default(0),
  createdAt:        text("created_at"),
  updatedAt:        text("updated_at"),
});
```

### TypeScript Types — `client/src/pages/lesson-plans/types.ts`

```typescript
export type PlanStatus = "draft" | "ready" | "completed";

export interface LessonPlan {
  id: string;
  _id: string;                    // alias normalised by _axios interceptor
  staffId: string;
  institutionId: string;
  title: string;
  subject: string;
  gradeOrClass: string;
  date: string;                   // YYYY-MM-DD
  durationMinutes: number;
  status: PlanStatus;
  learningObjectives?: string;
  materialsNeeded?: string;
  introduction?: string;
  mainActivity?: string;
  conclusion?: string;
  assessmentMethod?: string;
  homeworkNotes?: string;
  gradeBookId?: string | { id: string; bookTitle: string; grade: number } | null;
  chapterId?: string | { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonPlanPayload {
  title: string;
  subject: string;
  gradeOrClass: string;
  date: string;
  durationMinutes: number;
  learningObjectives?: string;
  materialsNeeded?: string;
  introduction?: string;
  mainActivity?: string;
  conclusion?: string;
  assessmentMethod?: string;
  homeworkNotes?: string;
  gradeBookId?: string | null;
  chapterId?: string | null;
}

export type UpdateLessonPlanPayload = Partial<CreateLessonPlanPayload> & {
  status?: PlanStatus;
};

export interface LessonPlanFormValues {
  title: string;
  subject: string;
  gradeOrClass: string;
  date: string;
  durationMinutes: number;
  learningObjectives: string;
  materialsNeeded: string;
  introduction: string;
  mainActivity: string;
  conclusion: string;
  assessmentMethod: string;
  homeworkNotes: string;
  gradeBookId: string;
  chapterId: string;
}

// Grouping helpers
export interface GroupedLessonPlans {
  key: string;          // "2025-W23" for week, "2025-06" for month
  label: string;        // "Week 23, 2025" or "June 2025"
  plans: LessonPlan[];
}
```

### API Endpoints

All endpoints are mounted under `/admin/lesson-plans` in `admin-router.ts`.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/admin/lesson-plans` | List plans (teacher: own; admin: by teacher) | teacher/admin/super_admin |
| `POST` | `/admin/lesson-plans` | Create a new plan | teacher |
| `GET` | `/admin/lesson-plans/:id` | Get single plan | teacher (own) / admin |
| `PATCH` | `/admin/lesson-plans/:id` | Update plan fields | teacher (own, non-completed) |
| `PATCH` | `/admin/lesson-plans/:id/status` | Update status only | teacher (own) |
| `DELETE` | `/admin/lesson-plans/:id` | Soft-delete plan | teacher (own) |

**Query parameters for `GET /admin/lesson-plans`:**
- `teacherId` — filter by teacher (admin/super_admin only)
- `institutionId` — filter by institution (super_admin only)
- `status` — filter by `draft | ready | completed`
- `year` — filter by year (integer)
- `month` — filter by month 1–12 (integer)
- `page`, `limit` — pagination

---

## Route Structure

```
client/src/routes/lesson-plans/
  index.tsx
    Route = createFileRoute('/lesson-plans/')({
      beforeLoad: ({ context }) => {
        // redirect staff and unauthenticated users
      },
      component: LessonPlansPage,
    })

  $id.tsx
    Route = createFileRoute('/lesson-plans/$id')({
      component: LessonPlanDetailPage,
    })
```

The `beforeLoad` guard in `index.tsx` reads the stored token and user role. If the user is unauthenticated it throws `redirect({ to: '/' })`. If the role is `staff` it throws `redirect({ to: '/dashboard' })`. This mirrors the pattern in `__root.tsx`.

### Sidebar Integration

A new entry is added to the `navItems` array in `client/src/modules/sidebar.tsx`:

```typescript
{
  name: 'Lesson Plans',
  path: '/lesson-plans',
  icon: <BookMarked className="w-5 h-5" />,
  roles: ['teacher', 'admin', 'super_admin'],
}
```

`BookMarked` is imported from `lucide-react` (already a dependency).

---

## State Management Approach

### Server State — React Query

All remote data is managed through React Query hooks. Query keys follow the pattern:

```typescript
['lesson-plans', filters]          // list
['lesson-plan', id]                // single
```

Cache invalidation strategy:
- After `create`: invalidate `['lesson-plans']`
- After `update` or `status change`: invalidate `['lesson-plans']` and `['lesson-plan', id]`
- After `delete`: invalidate `['lesson-plans']`, remove `['lesson-plan', id]`

### Optimistic Updates for Status Changes

The `useUpdateLessonPlan` hook applies an optimistic update for status-only changes:

```typescript
onMutate: async ({ id, status }) => {
  await queryClient.cancelQueries({ queryKey: ['lesson-plans'] });
  const previous = queryClient.getQueryData(['lesson-plan', id]);
  queryClient.setQueryData(['lesson-plan', id], (old) => ({ ...old, status }));
  return { previous };
},
onError: (_err, { id }, context) => {
  queryClient.setQueryData(['lesson-plan', id], context?.previous);
  toast.error('Failed to update status');
},
onSettled: (_data, _err, { id }) => {
  queryClient.invalidateQueries({ queryKey: ['lesson-plan', id] });
  queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
},
```

### Local State

- `viewMode: 'month' | 'week'` — stored in component state (not persisted; defaults to `'month'`)
- `currentPeriod: { year, month }` — current calendar period for navigation
- Form state — managed by `react-hook-form` with Zod validation schema
- Dialog open/close state — `useState` in the parent page component

### Unsaved Changes Guard

The edit form uses `react-hook-form`'s `formState.isDirty`. A `beforeunload` event listener and a TanStack Router `onBeforeNavigate` guard (using `router.subscribe`) prompt the user when `isDirty` is true and the user attempts to navigate away.

---

## UI Layout

### List Page (`/lesson-plans/`)

```
┌─────────────────────────────────────────────────────────┐
│  Lesson Plans                          [+ New Plan]      │
│                                                          │
│  [Admin only: Institution selector] [Teacher selector]   │
│                                                          │
│  [Month ▾] [Week]   [Status: All ▾]   ← Jun 2025 →      │
│                                                          │
│  ── June 2025 ──────────────────────────────────────     │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📄 Introduction to Fractions    [draft]  ⋮       │   │
│  │    Maths · Grade 5A · 12 Jun · 45 min            │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📄 Photosynthesis Deep Dive     [ready]  ⋮       │   │
│  │    Science · Grade 6B · 18 Jun · 60 min          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ── July 2025 ──────────────────────────────────────     │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

- The page header uses the same `py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto` wrapper as `MyClassesPage`.
- The view toggle uses `neo-tab-list` / `neo-tab-trigger` classes.
- Each plan card uses `neo-card neo-card-hover` with a three-dot `DropdownMenu` for Edit / Change Status / Delete actions.
- The status filter uses a `Select` component.
- Month/week navigation uses `ChevronLeft` / `ChevronRight` buttons matching the `MyClassesPage` calendar header style.
- Admin selectors (institution + teacher) mirror the `MyClassesPage` admin selector pattern exactly.

### Detail Page (`/lesson-plans/:id`)

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Lesson Plans                                  │
│                                                          │
│  Introduction to Fractions              [draft ▾]        │
│  Maths · Grade 5A · 12 Jun 2025 · 45 min                │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Learning Objectives                              │    │
│  │ Students will understand numerator/denominator   │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Materials Needed                                 │    │
│  │ Fraction tiles, whiteboard                       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Lesson Structure                                        │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Intro    │  │ Main Activity│  │ Conclusion   │      │
│  │ 10 min   │  │ 25 min       │  │ 10 min       │      │
│  └──────────┘  └──────────────┘  └──────────────┘      │
│                                                          │
│  Curriculum Link: Chapter 3 — Fractions (Grade 5)  →    │
│                                                          │
│                              [Edit Plan]  [Delete]       │
└─────────────────────────────────────────────────────────┘
```

- The status badge in the detail view is a `Select`-style dropdown allowing inline status changes (teacher only; read-only for admins).
- The three lesson structure sections are displayed as a three-column `neo-card-flat` grid on desktop, stacked on mobile.
- The curriculum link renders as a clickable chip that navigates to `/curriculum?gradeBookId=...`.

### Create/Edit Form Dialog

The form is a `Dialog` (Radix UI via shadcn/ui) using `neo-dialog` class. Fields are laid out in a two-column grid on desktop:

- **Column 1**: Title, Subject, Grade/Class, Date, Duration
- **Column 2**: Learning Objectives, Materials Needed, Assessment Method, Homework Notes
- **Full width**: Introduction, Main Activity, Conclusion (each a `Textarea`)
- **Full width**: Curriculum Link (searchable `Select` populated from `/admin/filtered-curriculum`)

Validation is handled by `react-hook-form` + Zod. Required field errors appear inline below each field using the existing `neo-input` focus style.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Role-based sidebar visibility

*For any* authenticated user, the "Lesson Plans" sidebar item should be visible if and only if the user's role is `teacher`, `admin`, or `super_admin`.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: New plans always start as draft

*For any* valid lesson plan creation payload (all required fields present), the plan persisted by the system should have `status = "draft"` regardless of the payload content.

**Validates: Requirements 3.3**

---

### Property 3: Required-field validation rejects incomplete payloads

*For any* lesson plan creation or update payload that is missing at least one required field (title, subject, gradeOrClass, date, or durationMinutes), the validation layer should reject the payload and no plan should be created or modified.

**Validates: Requirements 3.4, 5.3**

---

### Property 4: Month-view grouping invariant

*For any* non-empty list of lesson plans, grouping them into month-view should produce groups where every plan in a group has a `date` falling within that group's calendar month, and the groups are ordered chronologically by month.

**Validates: Requirements 2.3**

---

### Property 5: Week-view grouping invariant

*For any* non-empty list of lesson plans, grouping them into week-view should produce groups where every plan in a group has a `date` falling within that group's ISO week, and the groups are ordered chronologically by week.

**Validates: Requirements 2.4**

---

### Property 6: List card displays all required fields

*For any* lesson plan, the rendered list card should include the plan's title, subject, gradeOrClass, date, and status — none of these fields should be absent from the rendered output.

**Validates: Requirements 2.6**

---

### Property 7: Status update round-trip

*For any* lesson plan and any valid status value (`draft`, `ready`, `completed`), updating the plan's status via the API should result in the plan being retrievable with that exact status value.

**Validates: Requirements 7.2**

---

### Property 8: Status filter correctness

*For any* set of lesson plans and any status filter value, the filtered list should contain only plans whose `status` matches the filter value — no plans with a different status should appear.

**Validates: Requirements 7.6**

---

### Property 9: Status badge variant mapping

*For any* `PlanStatus` value, the `LessonPlanStatusBadge` component should render with the correct visual variant: `draft` → neutral/grey, `ready` → indigo/blue, `completed` → green.

**Validates: Requirements 7.3, 7.4, 7.5**

---

### Property 10: Deletion removes plan from list

*For any* lesson plan that exists in the system, after a successful delete operation the plan should no longer appear in the teacher's lesson plan list.

**Validates: Requirements 6.2**

---

### Property 11: Optimistic status update reverts on failure

*For any* lesson plan status change where the API call fails, the displayed status in the UI should revert to the status the plan had before the change was attempted.

**Validates: Requirements 10.4**

---

### Property 12: Edit form pre-population

*For any* lesson plan with status `draft` or `ready`, opening the edit form should pre-populate every form field with the plan's current stored values.

**Validates: Requirements 5.1**

---

## Error Handling

### API Errors

All mutations use `onError` callbacks that call `toast.error(message)` from `sonner` (already used throughout the app). The error message is extracted from the Axios error response (`error.response?.data?.message`) with a generic fallback.

| Scenario | Behaviour |
|----------|-----------|
| Create/update/delete API error | Toast error notification; form/dialog remains open |
| Status update API error | Optimistic update reverted; toast error |
| Fetch error (list/detail) | Inline error state with retry button |
| 401 Unauthorized | Handled globally by `_axios` interceptor (redirect to login) |
| Curriculum item unavailable | "Curriculum item unavailable" notice in detail view; plan remains editable |

### Form Validation Errors

Validation runs on submit via `react-hook-form` + Zod. Each required field shows an inline error message below the input using the pattern already established in `ClassFormDialog.tsx` and `CourseFormDialog.tsx`.

### Unsaved Changes

When `formState.isDirty` is true and the user attempts to navigate away (browser back, sidebar link, or programmatic navigation), a browser `beforeunload` event and a TanStack Router navigation guard both fire a confirmation prompt: *"You have unsaved changes. Leave anyway?"*

---

## Testing Strategy

### Unit Tests (Vitest + Testing Library)

Focus on pure logic and component rendering:

- `LessonPlanStatusBadge` — verify correct CSS variant for each status value (covers Property 9)
- `groupByMonth` / `groupByWeek` utility functions — verify grouping and ordering invariants (covers Properties 4, 5)
- `LessonPlanCard` — verify all required fields are rendered (covers Property 6)
- Form validation schema (Zod) — verify required-field rejection (covers Property 3)
- Sidebar `navItems` filter — verify role-based visibility (covers Property 1)

### Property-Based Tests (fast-check via Vitest)

Property-based testing is appropriate here because the feature contains pure transformation functions (grouping, filtering, validation) with large input spaces where edge cases matter.

**Library**: [`fast-check`](https://github.com/dubzzz/fast-check) — install as `fast-check` dev dependency.

Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: lesson-plan, Property N: <property text>`

| Property | Test file | What varies |
|----------|-----------|-------------|
| P1: Role-based sidebar visibility | `sidebar.test.tsx` | User role (arbitrary string) |
| P2: New plans start as draft | `lesson-plan-api.test.ts` | All valid creation payloads |
| P3: Validation rejects incomplete payloads | `validation.test.ts` | Subsets of required fields |
| P4: Month-view grouping invariant | `grouping.test.ts` | Arbitrary arrays of plans with random dates |
| P5: Week-view grouping invariant | `grouping.test.ts` | Arbitrary arrays of plans with random dates |
| P6: List card displays required fields | `LessonPlanCard.test.tsx` | Arbitrary LessonPlan objects |
| P7: Status update round-trip | `lesson-plan-api.test.ts` | Any plan × any valid status |
| P8: Status filter correctness | `useLessonPlans.test.ts` | Arbitrary plan arrays × status filter |
| P9: Status badge variant mapping | `LessonPlanStatusBadge.test.tsx` | All three status values |
| P10: Deletion removes plan from list | `lesson-plan-api.test.ts` | Any existing plan |
| P11: Optimistic update reverts on failure | `useUpdateLessonPlan.test.ts` | Any plan × any status × simulated API failure |
| P12: Edit form pre-population | `LessonPlanFormDialog.test.tsx` | Arbitrary LessonPlan objects |

### Integration Tests

- `POST /admin/lesson-plans` → verify D1 row created with `status = "draft"`
- `PATCH /admin/lesson-plans/:id/status` → verify status persisted
- `DELETE /admin/lesson-plans/:id` → verify soft-delete (`is_deleted = 1`)
- Admin scoping: verify teacher A cannot read/modify teacher B's plans

### Testing Notes

- The grouping utilities (`groupByMonth`, `groupByWeek`) are pure functions extracted from the page component — this makes them directly testable without DOM rendering.
- The Zod validation schema is exported from `types.ts` and tested independently of the form component.
- API integration tests use Miniflare (Cloudflare Workers local runtime) with an in-memory D1 instance.
