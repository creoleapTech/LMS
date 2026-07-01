CREATE TABLE `batches` (
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
CREATE INDEX `batches_course_id_idx` ON `batches` (`course_id`);--> statement-breakpoint
CREATE INDEX `batches_instructor_id_idx` ON `batches` (`instructor_id`);--> statement-breakpoint
CREATE INDEX `batches_is_deleted_idx` ON `batches` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `batches_is_active_idx` ON `batches` (`is_active`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`thumbnail` text,
	`level` text,
	`duration` text,
	`fees` integer DEFAULT 0,
	`status` text DEFAULT 'Active',
	`start_date` text,
	`institution_id` text,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `courses_institution_id_idx` ON `courses` (`institution_id`);--> statement-breakpoint
CREATE INDEX `courses_is_deleted_idx` ON `courses` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `courses_is_active_idx` ON `courses` (`is_active`);--> statement-breakpoint
CREATE INDEX `courses_code_idx` ON `courses` (`code`);