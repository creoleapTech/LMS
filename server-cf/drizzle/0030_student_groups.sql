CREATE TABLE `student_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`class_id` text NOT NULL,
	`institution_id` text NOT NULL,
	`created_by` text,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `student_groups_class_id_idx` ON `student_groups` (`class_id`);--> statement-breakpoint
CREATE INDEX `student_groups_institution_id_idx` ON `student_groups` (`institution_id`);--> statement-breakpoint
CREATE INDEX `student_groups_is_deleted_idx` ON `student_groups` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `student_groups_is_active_idx` ON `student_groups` (`is_active`);--> statement-breakpoint
CREATE INDEX `student_groups_name_idx` ON `student_groups` (`name`);--> statement-breakpoint
CREATE TABLE `student_group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`student_id` text NOT NULL,
	`added_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `student_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `student_group_members_group_id_idx` ON `student_group_members` (`group_id`);--> statement-breakpoint
CREATE INDEX `student_group_members_student_id_idx` ON `student_group_members` (`student_id`);