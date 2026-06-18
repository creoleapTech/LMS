ALTER TABLE `leaplab_projects` ADD `is_shared` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `leaplab_projects` ADD `share_id` text;--> statement-breakpoint
ALTER TABLE `leaplab_projects` ADD `share_permission` text;--> statement-breakpoint
CREATE UNIQUE INDEX `leaplab_projects_share_id_idx` ON `leaplab_projects` (`share_id`) WHERE "share_id" IS NOT NULL;