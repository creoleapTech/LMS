# Requirements Document

## Introduction

The Lesson Plan feature is a teacher-facing module in the Creoleap LMS that enables teachers to create, manage, and track structured lesson plans. Teachers can author plans with rich pedagogical detail (objectives, materials, lesson structure, assessment), organize them by week or month, optionally link them to existing curriculum content, and track each plan through a draft → ready → completed lifecycle. Admins and super_admins can view lesson plans across their institution. The feature is surfaced as a new sidebar navigation item visible only to teachers, admins, and super_admins.

## Glossary

- **Lesson_Plan**: A structured document authored by a teacher that describes the intent, content, and flow of a single class session.
- **Lesson_Plan_Manager**: The frontend module responsible for creating, listing, editing, and deleting lesson plans.
- **Plan_Status**: The lifecycle state of a lesson plan — one of `draft`, `ready`, or `completed`.
- **Lesson_Structure**: The three-part breakdown of a lesson: Introduction, Main_Activity, and Conclusion.
- **Curriculum_Item**: An existing piece of curriculum content (grade book, chapter, or content node) stored in the LMS that a lesson plan may optionally reference.
- **Teacher**: A user with the role `teacher`.
- **Admin**: A user with the role `admin` or `super_admin`.
- **Institution**: The school or organisation a user belongs to, identified by `institutionId`.
- **Week_View**: A calendar display mode that groups lesson plans by ISO week.
- **Month_View**: A calendar display mode that groups lesson plans by calendar month.

---

## Requirements

### Requirement 1: Role-Based Access to Lesson Plans

**User Story:** As a teacher, I want a dedicated Lesson Plans section in the sidebar, so that I can quickly navigate to my lesson planning workspace without it being visible to students or staff.

#### Acceptance Criteria

1. THE Lesson_Plan_Manager SHALL display a "Lesson Plans" navigation item in the sidebar only when the authenticated user's role is `teacher`, `admin`, or `super_admin`.
2. WHEN a user with role `staff` is authenticated, THE Lesson_Plan_Manager SHALL NOT render the "Lesson Plans" sidebar item.
3. WHEN an unauthenticated request is made to any lesson plan route, THE Lesson_Plan_Manager SHALL redirect the user to the login page.
4. WHEN an authenticated user with role `staff` navigates directly to `/lesson-plans`, THE Lesson_Plan_Manager SHALL redirect the user to the dashboard.

---

### Requirement 2: List and Organise Lesson Plans

**User Story:** As a teacher, I want to view all my lesson plans organised by week or month, so that I can quickly find and manage plans for any given period.

#### Acceptance Criteria

1. THE Lesson_Plan_Manager SHALL display a list of the authenticated teacher's lesson plans on the `/lesson-plans` page.
2. THE Lesson_Plan_Manager SHALL support a Month_View and a Week_View toggle for organising the lesson plan list.
3. WHEN the user selects Month_View, THE Lesson_Plan_Manager SHALL group and display lesson plans by calendar month, ordered chronologically.
4. WHEN the user selects Week_View, THE Lesson_Plan_Manager SHALL group and display lesson plans by ISO week, ordered chronologically.
5. WHEN no lesson plans exist for the selected period, THE Lesson_Plan_Manager SHALL display an empty-state message and a prompt to create a new plan.
6. THE Lesson_Plan_Manager SHALL display each plan's title, subject, grade/class, date, and Plan_Status in the list view.
7. WHEN an Admin views the lesson plans page, THE Lesson_Plan_Manager SHALL allow the Admin to filter plans by teacher within their institution.

---

### Requirement 3: Create a Lesson Plan

**User Story:** As a teacher, I want to create a new lesson plan with all relevant pedagogical details, so that I have a complete record of my teaching intent for each session.

#### Acceptance Criteria

1. WHEN the user activates the "New Lesson Plan" action, THE Lesson_Plan_Manager SHALL present a creation form with the following required fields: title, subject, grade/class, date, and duration (in minutes).
2. THE Lesson_Plan_Manager SHALL include the following optional fields in the creation form: learning objectives, materials needed, Introduction text, Main_Activity text, Conclusion text, assessment method, and homework/follow-up notes.
3. WHEN the user submits the creation form with all required fields populated, THE Lesson_Plan_Manager SHALL persist the new Lesson_Plan with an initial Plan_Status of `draft`.
4. WHEN the user submits the creation form with one or more required fields missing, THE Lesson_Plan_Manager SHALL display a field-level validation error for each missing required field and SHALL NOT persist the plan.
5. WHERE curriculum linking is enabled, THE Lesson_Plan_Manager SHALL allow the user to optionally associate the lesson plan with one Curriculum_Item from the institution's curriculum.
6. WHEN a Lesson_Plan is successfully created, THE Lesson_Plan_Manager SHALL display a success notification and navigate the user to the detail view of the newly created plan.

---

### Requirement 4: View a Lesson Plan

**User Story:** As a teacher, I want to view the full details of a lesson plan, so that I can review everything I have prepared before a class.

#### Acceptance Criteria

1. WHEN the user selects a lesson plan from the list, THE Lesson_Plan_Manager SHALL navigate to a detail view displaying all fields of the selected Lesson_Plan.
2. THE Lesson_Plan_Manager SHALL display the Plan_Status prominently in the detail view using a visual badge.
3. WHEN the Lesson_Plan has an associated Curriculum_Item, THE Lesson_Plan_Manager SHALL display the curriculum link with the item's title and a navigation affordance to the curriculum content.
4. THE Lesson_Plan_Manager SHALL display the Lesson_Structure sections (Introduction, Main_Activity, Conclusion) in a clearly delineated layout in the detail view.

---

### Requirement 5: Edit a Lesson Plan

**User Story:** As a teacher, I want to edit an existing lesson plan, so that I can refine my preparation as the lesson date approaches.

#### Acceptance Criteria

1. WHEN the user activates the edit action on a Lesson_Plan with Plan_Status `draft` or `ready`, THE Lesson_Plan_Manager SHALL present an edit form pre-populated with the plan's current field values.
2. WHEN the user submits the edit form with all required fields populated, THE Lesson_Plan_Manager SHALL persist the updated Lesson_Plan and display a success notification.
3. WHEN the user submits the edit form with one or more required fields missing, THE Lesson_Plan_Manager SHALL display a field-level validation error and SHALL NOT persist the changes.
4. WHEN the user activates the edit action on a Lesson_Plan with Plan_Status `completed`, THE Lesson_Plan_Manager SHALL display a confirmation dialog before allowing edits, informing the user that the plan is marked as completed.

---

### Requirement 6: Delete a Lesson Plan

**User Story:** As a teacher, I want to delete a lesson plan I no longer need, so that my workspace stays organised.

#### Acceptance Criteria

1. WHEN the user activates the delete action on a Lesson_Plan, THE Lesson_Plan_Manager SHALL display a confirmation dialog before proceeding.
2. WHEN the user confirms deletion, THE Lesson_Plan_Manager SHALL permanently remove the Lesson_Plan and display a success notification.
3. WHEN the user cancels the confirmation dialog, THE Lesson_Plan_Manager SHALL take no action and dismiss the dialog.
4. WHEN a Lesson_Plan is successfully deleted, THE Lesson_Plan_Manager SHALL return the user to the lesson plan list view.

---

### Requirement 7: Status Tracking

**User Story:** As a teacher, I want to update the status of a lesson plan, so that I can track which plans are still being prepared, which are ready to deliver, and which have been taught.

#### Acceptance Criteria

1. THE Lesson_Plan_Manager SHALL support exactly three Plan_Status values: `draft`, `ready`, and `completed`.
2. WHEN the user changes the Plan_Status of a Lesson_Plan, THE Lesson_Plan_Manager SHALL persist the new status and update the visual badge in both the list view and the detail view.
3. WHEN a Lesson_Plan's Plan_Status is `draft`, THE Lesson_Plan_Manager SHALL render the status badge with a neutral/grey visual style.
4. WHEN a Lesson_Plan's Plan_Status is `ready`, THE Lesson_Plan_Manager SHALL render the status badge with an indigo/blue visual style.
5. WHEN a Lesson_Plan's Plan_Status is `completed`, THE Lesson_Plan_Manager SHALL render the status badge with a green visual style.
6. THE Lesson_Plan_Manager SHALL allow the user to filter the lesson plan list by Plan_Status.

---

### Requirement 8: Optional Curriculum Linking

**User Story:** As a teacher, I want to optionally link a lesson plan to a curriculum item, so that my planning is connected to the official course content.

#### Acceptance Criteria

1. WHERE curriculum linking is enabled, THE Lesson_Plan_Manager SHALL present a searchable dropdown of Curriculum_Items available to the teacher's institution during plan creation and editing.
2. WHEN the user selects a Curriculum_Item, THE Lesson_Plan_Manager SHALL store the reference and display the item's title in the plan detail view.
3. WHEN the user removes a curriculum link from a Lesson_Plan, THE Lesson_Plan_Manager SHALL persist the removal and no longer display the curriculum reference in the detail view.
4. IF the referenced Curriculum_Item is no longer available, THEN THE Lesson_Plan_Manager SHALL display a "Curriculum item unavailable" notice in place of the link without preventing the plan from being viewed or edited.

---

### Requirement 9: Admin Visibility

**User Story:** As an admin, I want to view lesson plans created by teachers in my institution, so that I can monitor curriculum delivery and support my staff.

#### Acceptance Criteria

1. WHEN an Admin accesses the lesson plans page, THE Lesson_Plan_Manager SHALL display a teacher selector filtered to teachers within the Admin's institution.
2. WHEN an Admin selects a teacher, THE Lesson_Plan_Manager SHALL display that teacher's lesson plans in the same list and calendar views available to teachers.
3. WHEN a super_admin accesses the lesson plans page, THE Lesson_Plan_Manager SHALL display an institution selector followed by a teacher selector.
4. WHILE an Admin is viewing another teacher's lesson plans, THE Lesson_Plan_Manager SHALL render all plan actions (create, edit, delete) as read-only for the Admin.

---

### Requirement 10: Data Persistence and API

**User Story:** As a teacher, I want my lesson plans to be saved reliably on the server, so that I can access them from any device.

#### Acceptance Criteria

1. THE Lesson_Plan_Manager SHALL persist all lesson plan data to the backend API and SHALL NOT rely solely on client-side storage.
2. WHEN the backend API returns an error during a create, update, or delete operation, THE Lesson_Plan_Manager SHALL display a descriptive error notification to the user and SHALL NOT leave the UI in an inconsistent state.
3. WHEN the user navigates away from an unsaved edit form, THE Lesson_Plan_Manager SHALL display a confirmation prompt warning that unsaved changes will be lost.
4. THE Lesson_Plan_Manager SHALL use optimistic updates for Plan_Status changes to provide immediate visual feedback, and SHALL revert the optimistic update IF the API call fails.
