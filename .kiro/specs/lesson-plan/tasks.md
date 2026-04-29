# Implementation Plan: Lesson Plan Feature

## Overview

Implement the full lesson plan feature end-to-end: D1 schema, Hono controller, React Query hooks, UI components, route files, sidebar nav, and GlobalHeader entry. The backend is a Cloudflare Worker using Drizzle ORM + Hono. The frontend uses TanStack Router, TanStack Query, react-hook-form + Zod, and the project's neomorphic design system.

## Tasks

- [x] 1. Backend — Drizzle schema for `lesson_plans` table
  - Create `server-cf/src/schema/lesson-plans.ts` with the `lessonPlans` table definition
  - Columns: `id` (UUID PK), `staff_id` (FK → staff), `institution_id` (FK → institutions), `title`, `subject`, `grade_or_class`, `date` (ISO string), `duration_minutes`, `status` (enum: draft/ready/completed, default draft), optional pedagogical text columns (`learning_objectives`, `materials_needed`, `introduction`, `main_activity`, `conclusion`, `assessment_method`, `homework_notes`), optional FK columns `grade_book_id` (→ gradeBooks) and `chapter_id` (→ chapters), `is_deleted` (integer, default 0), `created_at`, `updated_at`
  - Export `lessonPlans` from the schema file
  - Re-export from `server-cf/src/schema/books.ts` barrel or import directly in the controller — whichever matches the existing pattern
  - _Requirements: 10.1_

- [x] 2. Backend — Hono lesson-plan controller
  - Create `server-cf/src/modules/admin/lesson-plan-controller.ts` following the same structure as `class-controller.ts`
  - Apply `adminAuth` middleware to all routes
  - Implement `GET /` — list plans scoped by role: teacher sees own plans (`staffId = user.id`); admin sees plans for their institution filtered by optional `teacherId` query param; super_admin additionally accepts `institutionId` query param. Support `status`, `year`, `month`, `page`, `limit` query params. Exclude soft-deleted rows (`is_deleted = 0`)
  - Implement `POST /` — create plan; set `status = "draft"` regardless of payload; validate required fields (title, subject, gradeOrClass, date, durationMinutes); generate UUID v4 id; set `staffId` and `institutionId` from authenticated user; return 201
  - Implement `GET /:id` — fetch single plan; verify ownership (teacher: own; admin: same institution; super_admin: any)
  - Implement `PATCH /:id` — update plan fields; allow all `CreateLessonPlanPayload` fields; block edits if caller is admin/super_admin (read-only); return updated plan
  - Implement `PATCH /:id/status` — update `status` field only; validate value is one of `draft | ready | completed`; same ownership rules as PATCH
  - Implement `DELETE /:id` — soft-delete (`is_deleted = 1`); verify ownership; return success message
  - Use `BadRequestError` / `ForbiddenError` from `../../lib/errors/` for error cases
  - _Requirements: 10.1, 10.2, 9.1, 9.2, 9.3, 9.4, 3.3, 6.2, 7.2_

- [x] 3. Backend — Register controller in admin-router
  - In `server-cf/src/modules/admin/admin-router.ts`, import `lessonPlanController` from `./lesson-plan-controller`
  - Add `adminBaseRouter.route("/lesson-plans", lessonPlanController)` following the existing registration pattern
  - _Requirements: 10.1_

- [x] 4. Frontend — TypeScript types file
  - Create `client/src/pages/lesson-plans/types.ts`
  - Define and export: `PlanStatus` union type (`"draft" | "ready" | "completed"`), `LessonPlan` interface (all fields from the schema including optional populated FK objects for `gradeBookId` and `chapterId`), `CreateLessonPlanPayload`, `UpdateLessonPlanPayload`, `LessonPlanFormValues`, `GroupedLessonPlans` (with `key`, `label`, `plans` fields)
  - Export the Zod validation schema (`lessonPlanSchema`) for use in the form and property tests
  - Export pure utility functions `groupByMonth(plans: LessonPlan[]): GroupedLessonPlans[]` and `groupByWeek(plans: LessonPlan[]): GroupedLessonPlans[]` — these must be pure functions with no React dependencies so they can be tested directly
  - _Requirements: 3.1, 3.2, 2.3, 2.4_

- [x] 5. Frontend — React Query hooks
  - Create `client/src/pages/lesson-plans/hooks/useLessonPlans.ts` — `useQuery` with key `['lesson-plans', params]`, calls `GET /admin/lesson-plans` with query params; returns `LessonPlan[]`
  - Create `client/src/pages/lesson-plans/hooks/useLessonPlan.ts` — `useQuery` with key `['lesson-plan', id]`, calls `GET /admin/lesson-plans/:id`; enabled only when `id` is truthy
  - Create `client/src/pages/lesson-plans/hooks/useCreateLessonPlan.ts` — `useMutation` calling `POST /admin/lesson-plans`; on success invalidates `['lesson-plans']`; calls `toast.success` / `toast.error` from `sonner`
  - Create `client/src/pages/lesson-plans/hooks/useUpdateLessonPlan.ts` — `useMutation` calling `PATCH /admin/lesson-plans/:id` or `PATCH /admin/lesson-plans/:id/status`; implement optimistic update for status-only changes (cancel queries → set cache → return previous for rollback); on error revert and `toast.error`; on settled invalidate both `['lesson-plans']` and `['lesson-plan', id]`
  - Create `client/src/pages/lesson-plans/hooks/useDeleteLessonPlan.ts` — `useMutation` calling `DELETE /admin/lesson-plans/:id`; on success invalidates `['lesson-plans']` and removes `['lesson-plan', id]` from cache; calls `toast.success` / `toast.error`
  - _Requirements: 10.1, 10.2, 10.4, 7.2_

- [x] 6. Frontend — `LessonPlanStatusBadge` component
  - Create `client/src/pages/lesson-plans/components/LessonPlanStatusBadge.tsx`
  - Accept props `{ status: PlanStatus; size?: 'sm' | 'md' }`
  - Render a `<Badge>` (from `@/components/ui/badge`) with variant/className driven by status: `draft` → neutral grey (`bg-slate-100 text-slate-600 border-slate-300`), `ready` → indigo/blue (`bg-indigo-100 text-indigo-700 border-indigo-300`), `completed` → green (`bg-emerald-100 text-emerald-700 border-emerald-300`)
  - Capitalise the status label
  - _Requirements: 7.3, 7.4, 7.5, 4.2_

  - [x] 6.1 Write property test for `LessonPlanStatusBadge` — status badge variant mapping
    - Install `fast-check` as a dev dependency in `client/` if not already present
    - Create `client/src/pages/lesson-plans/__tests__/LessonPlanStatusBadge.test.tsx`
    - Use `@testing-library/react` + `vitest` + `fast-check`
    - **Property 9: Status badge variant mapping** — for every `PlanStatus` value, the rendered badge must contain the correct colour class
    - Tag: `// Feature: lesson-plan, Property 9: Status badge variant mapping`
    - **Validates: Requirements 7.3, 7.4, 7.5**

- [x] 7. Frontend — `LessonPlanCard` component
  - Create `client/src/pages/lesson-plans/components/LessonPlanCard.tsx`
  - Accept props matching `LessonPlanCardProps` from the design: `plan`, `onEdit`, `onDelete`, `onStatusChange`, `readOnly?`
  - Render using `neo-card neo-card-hover` classes
  - Display: title, subject, gradeOrClass, date (formatted), durationMinutes, and `<LessonPlanStatusBadge>`
  - Include a `DropdownMenu` (three-dot menu) with actions: Edit, Change Status (sub-menu with the three status values), Delete — all hidden/disabled when `readOnly` is true
  - _Requirements: 2.6, 5.1, 6.1, 7.2_

  - [x] 7.1 Write property test for `LessonPlanCard` — list card displays all required fields
    - Create `client/src/pages/lesson-plans/__tests__/LessonPlanCard.test.tsx`
    - Use `fast-check` to generate arbitrary `LessonPlan` objects
    - **Property 6: List card displays required fields** — for any `LessonPlan`, the rendered card must include title, subject, gradeOrClass, date, and status
    - Tag: `// Feature: lesson-plan, Property 6: List card displays required fields`
    - **Validates: Requirements 2.6**

- [x] 8. Frontend — `LessonPlanFormDialog` component
  - Create `client/src/pages/lesson-plans/components/LessonPlanFormDialog.tsx`
  - Accept props matching `LessonPlanFormDialogProps`: `open`, `onOpenChange`, `mode` (`'create' | 'edit'`), `initialValues?`, `planId?`
  - Use `react-hook-form` with the exported Zod `lessonPlanSchema` via `@hookform/resolvers/zod`
  - Layout: two-column grid on desktop for (Title, Subject, Grade/Class, Date, Duration) and (Learning Objectives, Materials, Assessment, Homework); full-width textareas for Introduction, Main Activity, Conclusion; full-width curriculum link `Select`
  - Populate curriculum options from `GET /admin/filtered-curriculum` (existing endpoint) using a `useQuery` inside the dialog
  - On submit in `create` mode: call `useCreateLessonPlan`; on success close dialog and navigate to the new plan's detail page
  - On submit in `edit` mode: call `useUpdateLessonPlan`; on success close dialog and show success toast
  - Show inline field-level validation errors below each input using the `neo-input` focus style matching `ClassFormDialog.tsx`
  - When `mode === 'edit'` and `initialValues.status === 'completed'`, show a confirmation `AlertDialog` before opening the edit form (Requirement 5.4)
  - Track `formState.isDirty`; add a `beforeunload` listener and a TanStack Router `onBeforeNavigate` guard that prompt "You have unsaved changes. Leave anyway?" when dirty
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4, 8.1, 8.2, 10.3_

  - [x] 8.1 Write property test for form validation — required-field rejection
    - Create `client/src/pages/lesson-plans/__tests__/validation.test.ts`
    - Use `fast-check` to generate payloads with at least one required field missing
    - **Property 3: Required-field validation rejects incomplete payloads** — Zod schema must reject any payload missing title, subject, gradeOrClass, date, or durationMinutes
    - Tag: `// Feature: lesson-plan, Property 3: Required-field validation rejects incomplete payloads`
    - **Validates: Requirements 3.4, 5.3**

  - [x] 8.2 Write property test for `LessonPlanFormDialog` — edit form pre-population
    - Create `client/src/pages/lesson-plans/__tests__/LessonPlanFormDialog.test.tsx`
    - Use `fast-check` to generate arbitrary `LessonPlan` objects with status `draft` or `ready`
    - **Property 12: Edit form pre-population** — every form field must be pre-populated with the plan's current stored values
    - Tag: `// Feature: lesson-plan, Property 12: Edit form pre-population`
    - **Validates: Requirements 5.1**

- [-] 9. Frontend — `LessonPlanListView` component
  - Create `client/src/pages/lesson-plans/components/LessonPlanListView.tsx`
  - Accept props matching `LessonPlanListViewProps`: `plans`, `viewMode`, `readOnly?`, `onPlanClick`, `onEdit`, `onDelete`, `onStatusChange`
  - Call `groupByMonth` or `groupByWeek` (from `types.ts`) based on `viewMode`
  - Render each group with a section heading (e.g. "June 2025" or "Week 23, 2025") followed by a list of `<LessonPlanCard>` components
  - When `plans` is empty, render `<LessonPlanEmptyState>` (a simple inline component with an empty-state message and a "New Lesson Plan" CTA button)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [~] 9.1 Write property tests for grouping utilities — month-view and week-view invariants
    - Create `client/src/pages/lesson-plans/__tests__/grouping.test.ts`
    - Use `fast-check` to generate arbitrary arrays of `LessonPlan` objects with random ISO date strings
    - **Property 4: Month-view grouping invariant** — every plan in a group has a `date` in that group's calendar month; groups are ordered chronologically
    - **Property 5: Week-view grouping invariant** — every plan in a group has a `date` in that group's ISO week; groups are ordered chronologically
    - Tags: `// Feature: lesson-plan, Property 4: Month-view grouping invariant` and `// Feature: lesson-plan, Property 5: Week-view grouping invariant`
    - **Validates: Requirements 2.3, 2.4**

- [~] 10. Checkpoint — Ensure all tests pass
  - Run `cd client && npm test` and confirm all property and unit tests pass
  - Fix any failures before proceeding
  - Ask the user if questions arise

- [~] 11. Frontend — `LessonPlansPage` (list page)
  - Create `client/src/pages/lesson-plans/LessonPlansPage.tsx`
  - Use `py-8 px-5 sm:px-8 max-w-screen-2xl mx-auto` wrapper matching `MyClassesPage`
  - Page header: "Lesson Plans" title + "New Lesson Plan" button (opens `LessonPlanFormDialog` in create mode)
  - Admin selectors: mirror the institution + teacher selector pattern from `MyClassesPage` exactly — institution selector (super_admin only) and teacher selector (admin + super_admin); use the same `useQuery` for institutions list and the existing `useStaffList` hook for teachers
  - View toggle: `neo-tab-list` / `neo-tab-trigger` tabs for Month / Week; default to Month
  - Status filter: `Select` component with options All / Draft / Ready / Completed
  - Period navigation: `ChevronLeft` / `ChevronRight` buttons + current period label; "Today" / "This Month" jump button
  - Pass all filter state to `useLessonPlans` hook; pass results to `<LessonPlanListView>`
  - Wire `onPlanClick` to navigate to `/lesson-plans/:id`; wire `onEdit` to open `LessonPlanFormDialog` in edit mode; wire `onDelete` to open `DeleteConfirmDialog`; wire `onStatusChange` to `useUpdateLessonPlan`
  - When admin is viewing another teacher's plans, pass `readOnly={true}` to `LessonPlanListView` (Requirement 9.4)
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.6, 9.1, 9.2, 9.3, 9.4_

- [~] 12. Frontend — `LessonPlanDetailPage`
  - Create `client/src/pages/lesson-plans/LessonPlanDetailPage.tsx`
  - Read `id` from route params via `useParams` / `Route.useParams()`
  - Fetch plan with `useLessonPlan(id)`; show skeleton while loading; show inline error with retry on failure
  - Layout matches the design wireframe: back link, title + status badge, meta row (subject · gradeOrClass · date · duration), then sections for Learning Objectives, Materials Needed, Lesson Structure (three-column grid: Introduction / Main Activity / Conclusion), Assessment Method, Homework Notes, Curriculum Link
  - Status badge in detail view: for teachers render as a `Select` dropdown allowing inline status change (calls `useUpdateLessonPlan` with status only); for admins render as a read-only `<LessonPlanStatusBadge>`
  - Curriculum link: if `gradeBookId` is populated, render a clickable chip navigating to `/curriculum?gradeBookId=...`; if the item is unavailable (string ID but no title), show "Curriculum item unavailable" notice
  - Action buttons (teacher only): "Edit Plan" opens `LessonPlanFormDialog` in edit mode; "Delete" opens `DeleteConfirmDialog`
  - After successful delete, navigate back to `/lesson-plans`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.4, 6.1, 6.2, 6.3, 6.4, 7.2, 8.2, 8.3, 8.4_

- [~] 13. Frontend — Route files
  - Create `client/src/routes/lesson-plans/index.tsx`
    - `createFileRoute('/lesson-plans/')` with a `beforeLoad` guard: read stored token and user role from `localStorage` (`auth-storage` key, same pattern as `__root.tsx`); if no token throw `redirect({ to: '/' })`; if role is `staff` throw `redirect({ to: '/dashboard' })`
    - Set `component: LessonPlansPage`
  - Create `client/src/routes/lesson-plans/$id.tsx`
    - `createFileRoute('/lesson-plans/$id')` with `component: LessonPlanDetailPage`
  - _Requirements: 1.3, 1.4_

- [~] 14. Frontend — Sidebar nav item
  - In `client/src/modules/sidebar.tsx`, add a new entry to the `navItems` array:
    ```ts
    { name: 'Lesson Plans', path: '/lesson-plans', icon: <BookMarked className="w-5 h-5" />, roles: ['teacher', 'admin', 'super_admin'] }
    ```
  - Import `BookMarked` from `lucide-react` alongside the existing icon imports
  - Position the entry after "My Classes" and before "Students" (or wherever it fits the logical flow)
  - _Requirements: 1.1, 1.2_

  - [~] 14.1 Write property test for sidebar role-based visibility
    - Create `client/src/pages/lesson-plans/__tests__/sidebar.test.tsx`
    - Use `fast-check` to generate arbitrary role strings
    - **Property 1: Role-based sidebar visibility** — "Lesson Plans" nav item is visible if and only if role is `teacher`, `admin`, or `super_admin`; any other role (including `staff`) must not see it
    - Tag: `// Feature: lesson-plan, Property 1: Role-based sidebar visibility`
    - **Validates: Requirements 1.1, 1.2**

- [~] 15. Frontend — `GlobalHeader` PAGE_TITLES entry
  - In `client/src/components/GlobalHeader.tsx`, add an entry to the `PAGE_TITLES` array:
    ```ts
    { path: "/lesson-plans", title: "Lesson Plans", subtitle: "Plan and track your teaching sessions" }
    ```
  - _Requirements: 2.1_

- [~] 16. Final checkpoint — Ensure all tests pass
  - Run `cd client && npm test` and confirm all tests pass
  - Verify TypeScript compiles without errors: `cd client && npx tsc --noEmit`
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The grouping utilities (`groupByMonth`, `groupByWeek`) are exported as pure functions from `types.ts` to keep them directly testable without DOM rendering
- The Zod validation schema is exported from `types.ts` and tested independently of the form component
- Property tests use `fast-check` (install as dev dependency in `client/` if not already present: `npm install --save-dev fast-check`)
- Admin read-only enforcement is handled at two levels: the backend rejects mutations from non-owner roles, and the frontend hides action buttons when `readOnly` is true
- Optimistic status updates are implemented in `useUpdateLessonPlan` and revert automatically on API failure (Property 11)
