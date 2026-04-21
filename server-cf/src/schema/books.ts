import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

// ─── curricula ──────────────────────────────────────
export const curricula = sqliteTable("curricula", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").unique(),
  description: text("description"),
  thumbnail: text("thumbnail"),
  banner: text("banner"),
  isPublished: integer("is_published").default(0),
  order: integer("order"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// ─── grade_books ────────────────────────────────────
export const gradeBooks = sqliteTable("grade_books", {
  id: text("id").primaryKey(),
  curriculumId: text("curriculum_id").notNull().references(() => curricula.id),
  grade: integer("grade"),
  bookTitle: text("book_title"),
  subtitle: text("subtitle"),
  coverImage: text("cover_image"),
  description: text("description"),
  totalChapters: integer("total_chapters").default(0),
  totalVideos: integer("total_videos").default(0),
  totalActivities: integer("total_activities").default(0),
  isPublished: integer("is_published").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  uniqueIndex("grade_books_curriculum_grade_idx").on(table.curriculumId, table.grade),
]);

// ─── chapters ───────────────────────────────────────
export const chapters = sqliteTable("chapters", {
  id: text("id").primaryKey(),
  gradeBookId: text("grade_book_id").notNull().references(() => gradeBooks.id),
  title: text("title"),
  chapterNumber: integer("chapter_number"),
  description: text("description"),
  learningObjectives: text("learning_objectives"),
  thumbnail: text("thumbnail"),
  durationMinutes: integer("duration_minutes"),
  isFree: integer("is_free").default(0),
  order: integer("order"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  uniqueIndex("chapters_gradebook_order_idx").on(table.gradeBookId, table.order),
]);

// ─── chapter_contents ───────────────────────────────
export const chapterContents = sqliteTable("chapter_contents", {
  id: text("id").primaryKey(),
  chapterId: text("chapter_id").notNull().references(() => chapters.id),
  type: text("type", {
    enum: ["video", "youtube", "ppt", "pdf", "activity", "quiz", "project", "note", "text"],
  }).notNull(),
  title: text("title"),
  videoUrl: text("video_url"),
  fileUrl: text("file_url"),
  embedCode: text("embed_code"),
  durationMinutes: integer("duration_minutes"),
  youtubeUrl: text("youtube_url"),
  textContent: text("text_content"),
  projectInstructions: text("project_instructions"),
  submissionType: text("submission_type", {
    enum: ["file", "text", "link", "none"],
  }).default("none"),
  isFree: integer("is_free").default(0),
  order: integer("order"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (table) => [
  uniqueIndex("chapter_contents_chapter_order_idx").on(table.chapterId, table.order),
]);
