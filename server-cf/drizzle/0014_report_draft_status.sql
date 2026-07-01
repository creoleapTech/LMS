-- Update report_submissions status to allow 'draft' in addition to 'submitted'
-- SQLite doesn't support ALTER COLUMN, so we recreate the table
CREATE TABLE IF NOT EXISTS `report_submissions_new` (
  `id` text PRIMARY KEY NOT NULL,
  `staff_id` text NOT NULL REFERENCES `staff`(`id`),
  `institution_id` text NOT NULL REFERENCES `institutions`(`id`),
  `year` integer NOT NULL,
  `month` integer NOT NULL,
  `status` text DEFAULT 'submitted',
  `report_data` text,
  `docx_key` text,
  `submitted_at` text,
  `is_deleted` integer DEFAULT 0,
  `created_at` text,
  `updated_at` text
);

INSERT INTO `report_submissions_new` (`id`, `staff_id`, `institution_id`, `year`, `month`, `status`, `report_data`, `docx_key`, `submitted_at`, `is_deleted`, `created_at`, `updated_at`)
SELECT `id`, `staff_id`, `institution_id`, `year`, `month`, `status`, `report_data`, `docx_key`, `submitted_at`, `is_deleted`, `created_at`, `updated_at`
FROM `report_submissions`;

DROP TABLE IF EXISTS `report_submissions`;

ALTER TABLE `report_submissions_new` RENAME TO `report_submissions`;

CREATE UNIQUE INDEX IF NOT EXISTS `report_submissions_staff_year_month_idx` ON `report_submissions` (`staff_id`, `year`, `month`);
CREATE INDEX IF NOT EXISTS `report_submissions_institution_id_idx` ON `report_submissions` (`institution_id`);
CREATE INDEX IF NOT EXISTS `report_submissions_staff_id_idx` ON `report_submissions` (`staff_id`);
