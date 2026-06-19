ALTER TABLE `timetable_entries` ADD `additional_class_id` text;--> statement-breakpoint
ALTER TABLE `timetable_topics_covered` ADD `chapter_id` text;--> statement-breakpoint
ALTER TABLE `timetable_topics_covered` ADD `content_id` text;--> statement-breakpoint
CREATE INDEX `timetable_topics_covered_chapter_id_idx` ON `timetable_topics_covered` (`chapter_id`);--> statement-breakpoint
CREATE INDEX `timetable_topics_covered_content_id_idx` ON `timetable_topics_covered` (`content_id`);
