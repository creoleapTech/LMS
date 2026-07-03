CREATE TABLE `institution_quiz_attempt_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_answer` text,
	`is_correct` integer,
	`points_awarded` real DEFAULT 0,
	FOREIGN KEY (`attempt_id`) REFERENCES `institution_quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `institution_quiz_questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `institution_quiz_attempt_answers_attempt_id_idx` ON `institution_quiz_attempt_answers` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `institution_quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`student_id` text NOT NULL,
	`score` real DEFAULT 0,
	`max_score` real DEFAULT 0,
	`started_at` text,
	`completed_at` text,
	`time_taken_seconds` integer,
	`attempt_number` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	FOREIGN KEY (`quiz_id`) REFERENCES `institution_quizzes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `institution_quiz_attempts_quiz_id_idx` ON `institution_quiz_attempts` (`quiz_id`);--> statement-breakpoint
CREATE INDEX `institution_quiz_attempts_student_id_idx` ON `institution_quiz_attempts` (`student_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `institution_quiz_attempts_quiz_student_attempt_idx` ON `institution_quiz_attempts` (`quiz_id`,`student_id`,`attempt_number`);--> statement-breakpoint
CREATE TABLE `institution_quiz_question_options` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`text` text,
	`media_url` text,
	`media_type` text,
	`order` integer DEFAULT 0,
	`is_deleted` integer DEFAULT 0,
	FOREIGN KEY (`question_id`) REFERENCES `institution_quiz_questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `institution_quiz_question_options_question_id_idx` ON `institution_quiz_question_options` (`question_id`);--> statement-breakpoint
CREATE TABLE `institution_quiz_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`question_text` text NOT NULL,
	`question_media_url` text,
	`question_media_type` text,
	`answer_type` text DEFAULT 'multiple_choice' NOT NULL,
	`correct_answer` text,
	`explanation` text,
	`points` integer DEFAULT 1,
	`order` integer DEFAULT 0,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`quiz_id`) REFERENCES `institution_quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `institution_quiz_questions_quiz_id_idx` ON `institution_quiz_questions` (`quiz_id`);--> statement-breakpoint
CREATE TABLE `institution_quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_by` text NOT NULL,
	`total_points` integer DEFAULT 0,
	`passing_points` integer DEFAULT 0,
	`start_date` text,
	`end_date` text,
	`time_limit_minutes` integer,
	`retake_allowed` integer DEFAULT 0,
	`max_retakes` integer DEFAULT 0,
	`is_published` integer DEFAULT 0,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `institution_quizzes_institution_id_idx` ON `institution_quizzes` (`institution_id`);--> statement-breakpoint
CREATE INDEX `institution_quizzes_is_deleted_idx` ON `institution_quizzes` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `institution_quizzes_is_published_idx` ON `institution_quizzes` (`is_published`);