CREATE TABLE `class_session_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`staff_id` text,
	`action` text NOT NULL,
	`status_from` text,
	`status_to` text,
	`timestamp` text NOT NULL,
	`duration_minutes` integer,
	`remarks` text,
	`topics_covered` text,
	`ip_address` text,
	`user_agent` text,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `class_session_logs_session_id_idx` ON `class_session_logs` (`session_id`);--> statement-breakpoint
CREATE INDEX `class_session_logs_staff_id_idx` ON `class_session_logs` (`staff_id`);--> statement-breakpoint
ALTER TABLE `class_sessions` ADD `paused_at` text;--> statement-breakpoint
ALTER TABLE `class_sessions` ADD `total_paused_ms` integer DEFAULT 0;