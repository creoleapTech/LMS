ALTER TABLE `student_groups` ADD `leader_id` text REFERENCES students(id);--> statement-breakpoint
CREATE INDEX `student_groups_leader_id_idx` ON `student_groups` (`leader_id`);