ALTER TABLE `institution_quiz_questions` ADD `chapter_id` text;--> statement-breakpoint
ALTER TABLE `institution_quiz_questions` ADD `bloom_taxonomy` text;--> statement-breakpoint
CREATE INDEX `institution_quiz_questions_chapter_id_idx` ON `institution_quiz_questions` (`chapter_id`);