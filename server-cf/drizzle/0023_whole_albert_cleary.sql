CREATE TABLE `leapblocks_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`exe_key` text NOT NULL,
	`latest_yml_key` text,
	`blockmap_key` text,
	`sha512` text,
	`release_notes` text,
	`is_latest` integer DEFAULT 1,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX `leapblocks_versions_is_latest_idx` ON `leapblocks_versions` (`is_latest`);