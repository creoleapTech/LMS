-- Fix: username and password columns already added manually
-- Fix: Create batches table (from 0014_busy_pretty_boy.sql, never applied to D1)
CREATE TABLE IF NOT EXISTS `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`course_id` text NOT NULL,
	`instructor_id` text,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'Upcoming',
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instructor_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `batches_course_id_idx` ON `batches` (`course_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `batches_instructor_id_idx` ON `batches` (`instructor_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `batches_is_deleted_idx` ON `batches` (`is_deleted`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `batches_is_active_idx` ON `batches` (`is_active`);
--> statement-breakpoint
-- Fix: Create batch_students table (from 0015_charming_excalibur.sql, never applied to D1)
CREATE TABLE IF NOT EXISTS `batch_students` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`student_id` text NOT NULL,
	`enrolled_at` text,
	`is_active` integer DEFAULT 1,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `batch_students_batch_id_idx` ON `batch_students` (`batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `batch_students_student_id_idx` ON `batch_students` (`student_id`);
