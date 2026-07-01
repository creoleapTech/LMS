CREATE TABLE `batch_students` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`student_id` text NOT NULL,
	`enrolled_at` text,
	`is_active` integer DEFAULT 1,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `batch_students_batch_id_idx` ON `batch_students` (`batch_id`);--> statement-breakpoint
CREATE INDEX `batch_students_student_id_idx` ON `batch_students` (`student_id`);