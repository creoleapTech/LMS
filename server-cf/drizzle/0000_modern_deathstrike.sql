CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`mobile_number` text,
	`password` text NOT NULL,
	`last_login` text,
	`last_ip` text,
	`last_user_agent` text,
	`name` text,
	`salutation` text,
	`role` text,
	`institution_id` text,
	`profile_image` text,
	`fcm_token` text,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_email_unique` ON `admins` (`email`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`grade` text,
	`section` text NOT NULL,
	`year` text,
	`institution_id` text NOT NULL,
	`department_id` text,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`institution_id` text,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `institutions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`address` text,
	`contact_incharge_person` text,
	`contact_mobile` text,
	`contact_email` text,
	`contact_office_phone` text,
	`logo` text,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `institutions_name_unique` ON `institutions` (`name`);--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`salutation` text,
	`email` text NOT NULL,
	`mobile_number` text,
	`password` text NOT NULL,
	`type` text,
	`joining_date` text,
	`profile_image` text,
	`institution_id` text,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`last_login` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_email_unique` ON `staff` (`email`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`roll_number` text,
	`admission_number` text,
	`email` text,
	`mobile_number` text,
	`parent_name` text,
	`parent_mobile` text,
	`parent_email` text,
	`date_of_birth` text,
	`gender` text,
	`address` text,
	`admission_date` text,
	`profile_image` text,
	`class_id` text NOT NULL,
	`institution_id` text NOT NULL,
	`is_active` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapter_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`video_url` text,
	`file_url` text,
	`embed_code` text,
	`duration_minutes` integer,
	`youtube_url` text,
	`text_content` text,
	`project_instructions` text,
	`submission_type` text DEFAULT 'none',
	`is_free` integer DEFAULT 0,
	`order` integer,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_contents_chapter_order_idx` ON `chapter_contents` (`chapter_id`,`order`);--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`grade_book_id` text NOT NULL,
	`title` text,
	`chapter_number` integer,
	`description` text,
	`duration_minutes` integer,
	`is_free` integer DEFAULT 0,
	`order` integer,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`grade_book_id`) REFERENCES `grade_books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_gradebook_order_idx` ON `chapters` (`grade_book_id`,`order`);--> statement-breakpoint
CREATE TABLE `curricula` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`description` text,
	`thumbnail` text,
	`banner` text,
	`is_published` integer DEFAULT 0,
	`order` integer,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `curricula_name_unique` ON `curricula` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `curricula_slug_unique` ON `curricula` (`slug`);--> statement-breakpoint
CREATE TABLE `grade_books` (
	`id` text PRIMARY KEY NOT NULL,
	`curriculum_id` text NOT NULL,
	`grade` integer,
	`book_title` text,
	`subtitle` text,
	`cover_image` text,
	`description` text,
	`total_chapters` integer DEFAULT 0,
	`total_videos` integer DEFAULT 0,
	`total_activities` integer DEFAULT 0,
	`is_published` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grade_books_curriculum_grade_idx` ON `grade_books` (`curriculum_id`,`grade`);--> statement-breakpoint
CREATE TABLE `academic_year_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`academic_year_id` text NOT NULL,
	`label` text,
	`start_date` text,
	`end_date` text,
	FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `class_session_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`topic` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `class_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `class_student_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`student_id` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `class_teacher_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`staff_id` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `curriculum_grades` (
	`id` text PRIMARY KEY NOT NULL,
	`curriculum_id` text NOT NULL,
	`grade` integer NOT NULL,
	FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `curriculum_levels` (
	`id` text PRIMARY KEY NOT NULL,
	`curriculum_id` text NOT NULL,
	`level` text NOT NULL,
	FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `curriculum_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`curriculum_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `grading_scale_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`settings_id` text NOT NULL,
	`grade` text,
	`label` text,
	`min_percentage` real,
	`max_percentage` real,
	FOREIGN KEY (`settings_id`) REFERENCES `institution_settings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `institution_accessible_gradebooks` (
	`id` text PRIMARY KEY NOT NULL,
	`access_id` text NOT NULL,
	`grade_book_id` text NOT NULL,
	FOREIGN KEY (`access_id`) REFERENCES `institution_curriculum_access`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grade_book_id`) REFERENCES `grade_books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `institution_admin_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`admin_id` text NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `institution_curriculum_access` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`curriculum_id` text NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`curriculum_id`) REFERENCES `curricula`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `institution_staff_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`staff_id` text NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `period_config_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`period_config_id` text NOT NULL,
	`period_number` integer NOT NULL,
	`label` text,
	`start_time` text,
	`end_time` text,
	`is_break` integer DEFAULT 0,
	FOREIGN KEY (`period_config_id`) REFERENCES `period_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `period_config_working_days` (
	`id` text PRIMARY KEY NOT NULL,
	`period_config_id` text NOT NULL,
	`day` integer NOT NULL,
	FOREIGN KEY (`period_config_id`) REFERENCES `period_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quiz_match_pairs` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`left_item` text,
	`right_item` text,
	`order` integer,
	FOREIGN KEY (`question_id`) REFERENCES `quiz_questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quiz_question_options` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`label` text,
	`value` text,
	`order` integer,
	FOREIGN KEY (`question_id`) REFERENCES `quiz_questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`question_text` text,
	`question_media` text,
	`answer_type` text,
	`correct_answer` text,
	`explanation` text,
	`points` integer DEFAULT 1,
	`order` integer,
	FOREIGN KEY (`content_id`) REFERENCES `chapter_contents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `staff_assigned_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`class_id` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `staff_subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`subject` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `student_completed_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`progress_id` text NOT NULL,
	`content_id` text NOT NULL,
	FOREIGN KEY (`progress_id`) REFERENCES `student_progress`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `student_quiz_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`progress_id` text NOT NULL,
	`quiz_id` text,
	`score` real,
	`max_score` real,
	`attempted_at` text,
	FOREIGN KEY (`progress_id`) REFERENCES `student_progress`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `teaching_progress_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`teaching_progress_id` text NOT NULL,
	`content_id` text,
	`chapter_id` text,
	`is_completed` integer DEFAULT 0,
	`completed_at` text,
	`video_timestamp` real,
	`pdf_page` integer,
	`last_accessed_at` text,
	FOREIGN KEY (`teaching_progress_id`) REFERENCES `teaching_progress`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `timetable_topics_covered` (
	`id` text PRIMARY KEY NOT NULL,
	`timetable_entry_id` text NOT NULL,
	`topic` text NOT NULL,
	FOREIGN KEY (`timetable_entry_id`) REFERENCES `timetable_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `academic_years` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`label` text,
	`start_date` text,
	`end_date` text,
	`is_active` integer DEFAULT 0,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `academic_years_institution_label_idx` ON `academic_years` (`institution_id`,`label`);--> statement-breakpoint
CREATE TABLE `institution_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text,
	`language` text DEFAULT 'en',
	`timezone` text,
	`date_format` text,
	`currency` text DEFAULT 'INR',
	`enable_student_portal` integer DEFAULT 0,
	`enable_parent_portal` integer DEFAULT 0,
	`passing_marks` integer,
	`notify_email` integer DEFAULT 1,
	`notify_sms` integer DEFAULT 0,
	`notify_push` integer DEFAULT 1,
	`notify_attendance_alerts` integer DEFAULT 1,
	`notify_grade_updates` integer DEFAULT 1,
	`session_timeout` integer DEFAULT 30,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `institution_settings_institution_id_unique` ON `institution_settings` (`institution_id`);--> statement-breakpoint
CREATE TABLE `otp_counts` (
	`id` text PRIMARY KEY NOT NULL,
	`month` integer,
	`year` integer,
	`count` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `period_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `period_configs_institution_id_unique` ON `period_configs` (`institution_id`);--> statement-breakpoint
CREATE TABLE `timetable_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text,
	`staff_id` text,
	`class_id` text,
	`grade_book_id` text,
	`period_number` integer,
	`day_of_week` integer,
	`is_recurring` integer DEFAULT 1,
	`specific_date` text,
	`notes` text,
	`status` text DEFAULT 'scheduled',
	`completed_at` text,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_model` text NOT NULL,
	`institution_id` text,
	`language` text,
	`theme` text DEFAULT 'system',
	`notify_email` integer DEFAULT 1,
	`notify_sms` integer DEFAULT 0,
	`notify_push` integer DEFAULT 1,
	`notify_attendance_alerts` integer DEFAULT 1,
	`notify_grade_updates` integer DEFAULT 1,
	`is_deleted` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_user_model_idx` ON `user_preferences` (`user_id`,`user_model`);--> statement-breakpoint
CREATE TABLE `class_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text,
	`institution_id` text,
	`class_id` text,
	`course_id` text,
	`start_time` text,
	`end_time` text,
	`duration_minutes` integer,
	`remarks` text,
	`status` text DEFAULT 'ongoing',
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teaching_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text,
	`class_id` text,
	`grade_book_id` text,
	`institution_id` text,
	`overall_percentage` real DEFAULT 0,
	`last_accessed_content_id` text,
	`last_accessed_at` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teaching_progress_staff_class_gradebook_idx` ON `teaching_progress` (`staff_id`,`class_id`,`grade_book_id`);--> statement-breakpoint
CREATE TABLE `student_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`curriculum_id` text,
	`grade` integer,
	`chapter_id` text,
	`last_watched_at` text,
	`progress_percentage` real DEFAULT 0,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_progress_user_curriculum_grade_idx` ON `student_progress` (`user_id`,`curriculum_id`,`grade`);