CREATE TABLE `examinations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_by` text NOT NULL,
	`institution_id` text NOT NULL,
	`selected_class_ids` text NOT NULL DEFAULT '[]',
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `examination_columns` (
	`id` text PRIMARY KEY NOT NULL,
	`examination_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`formula` text,
	`order` integer NOT NULL DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`examination_id`) REFERENCES `examinations`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `examination_cells` (
	`id` text PRIMARY KEY NOT NULL,
	`examination_id` text NOT NULL,
	`student_id` text NOT NULL,
	`column_id` text NOT NULL,
	`value` text NOT NULL DEFAULT '',
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`examination_id`) REFERENCES `examinations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`column_id`) REFERENCES `examination_columns`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `idx_exam_columns_examination_id` ON `examination_columns` (`examination_id`);
CREATE INDEX `idx_exam_cells_examination_id` ON `examination_cells` (`examination_id`);
CREATE INDEX `idx_exam_cells_student_id` ON `examination_cells` (`student_id`);
CREATE UNIQUE INDEX `idx_exam_cells_unique` ON `examination_cells` (`examination_id`, `student_id`, `column_id`);
