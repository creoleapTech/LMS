CREATE TABLE `report_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`institution_id` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`status` text DEFAULT 'submitted',
	`report_data` text,
	`docx_key` text,
	`submitted_at` text,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_submissions_staff_year_month_idx` ON `report_submissions` (`staff_id`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `report_submissions_institution_id_idx` ON `report_submissions` (`institution_id`);--> statement-breakpoint
CREATE INDEX `report_submissions_staff_id_idx` ON `report_submissions` (`staff_id`);--> statement-breakpoint
ALTER TABLE `staff` ADD `signature_key` text;--> statement-breakpoint
ALTER TABLE `students` ADD `username` text;--> statement-breakpoint
ALTER TABLE `students` ADD `password` text;--> statement-breakpoint
CREATE UNIQUE INDEX `students_username_unique` ON `students` (`username`);--> statement-breakpoint
ALTER TABLE `timetable_topics_covered` ADD `chapter_id` text;--> statement-breakpoint
ALTER TABLE `timetable_topics_covered` ADD `content_id` text;--> statement-breakpoint
CREATE INDEX `timetable_topics_covered_chapter_id_idx` ON `timetable_topics_covered` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `timetable_topics_covered_content_id_idx` ON `timetable_topics_covered` (`content_id`);--> statement-breakpoint
ALTER TABLE `leaplab_credentials` ADD `is_unlimited` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `timetable_entries` ADD `additional_class_id` text;