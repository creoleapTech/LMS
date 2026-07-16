DROP INDEX `class_sessions_status_idx`;--> statement-breakpoint
CREATE INDEX `class_sessions_status_updated_at_idx` ON `class_sessions` (`status`,`updated_at`);--> statement-breakpoint
DROP INDEX `curriculum_grades_curriculum_id_idx`;--> statement-breakpoint
CREATE INDEX `curriculum_grades_curriculum_id_idx` ON `curriculum_grades` (`curriculum_id`,`grade`);--> statement-breakpoint
DROP INDEX `curriculum_levels_curriculum_id_idx`;--> statement-breakpoint
CREATE INDEX `curriculum_levels_curriculum_id_idx` ON `curriculum_levels` (`curriculum_id`,`level`);--> statement-breakpoint
DROP INDEX `institution_accessible_gradebooks_access_id_idx`;--> statement-breakpoint
CREATE INDEX `institution_accessible_gradebooks_access_id_idx` ON `institution_accessible_gradebooks` (`access_id`,`grade_book_id`);--> statement-breakpoint
CREATE INDEX `timetable_entries_staff_recurring_deleted_date_idx` ON `timetable_entries` (`staff_id`,`is_recurring`,`is_deleted`,`specific_date`);