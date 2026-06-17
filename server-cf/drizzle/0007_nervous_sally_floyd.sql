CREATE TABLE `leaplab_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leaplab_credentials_institution_username_idx` ON `leaplab_credentials` (`institution_id`,`username`);--> statement-breakpoint
CREATE INDEX `leaplab_credentials_institution_id_idx` ON `leaplab_credentials` (`institution_id`);--> statement-breakpoint
CREATE INDEX `leaplab_credentials_is_deleted_idx` ON `leaplab_credentials` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `leaplab_credentials_is_active_idx` ON `leaplab_credentials` (`is_active`);