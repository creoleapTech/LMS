-- Add signature_key column to staff table
ALTER TABLE staff ADD COLUMN signature_key TEXT;

-- Create report_submissions table
CREATE TABLE `report_submissions` (
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

CREATE UNIQUE INDEX `report_submissions_staff_year_month_idx` ON `report_submissions` (`staff_id`, `year`, `month`);
CREATE INDEX `report_submissions_institution_id_idx` ON `report_submissions` (`institution_id`);
CREATE INDEX `report_submissions_staff_id_idx` ON `report_submissions` (`staff_id`);
