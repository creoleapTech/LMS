ALTER TABLE `report_submissions` ADD `admin_approval` text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `report_submissions` ADD `admin_comment` text;--> statement-breakpoint
ALTER TABLE `report_submissions` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `report_submissions` ADD `reviewed_by` text;