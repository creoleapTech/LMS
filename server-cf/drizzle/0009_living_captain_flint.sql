CREATE TABLE `leaplab_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`mode` text NOT NULL,
	`file_key` text,
	`thumbnail_key` text,
	`metadata` text,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leaplab_projects_institution_id_idx` ON `leaplab_projects` (`institution_id`);--> statement-breakpoint
CREATE INDEX `leaplab_projects_credential_id_idx` ON `leaplab_projects` (`credential_id`);--> statement-breakpoint
CREATE INDEX `leaplab_projects_mode_idx` ON `leaplab_projects` (`mode`);--> statement-breakpoint
CREATE INDEX `leaplab_projects_is_deleted_idx` ON `leaplab_projects` (`is_deleted`);