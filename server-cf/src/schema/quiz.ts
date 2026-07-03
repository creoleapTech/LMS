import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { institutions } from "./admin";

// ─── Institution Quizzes ───────────────────────────────────────
export const institutionQuizzes = sqliteTable(
  "institution_quizzes",
  {
    id: text("id").primaryKey(),
    institutionId: text("institution_id").notNull().references(() => institutions.id),
    title: text("title").notNull(),
    description: text("description"),
    createdBy: text("created_by").notNull(),

    // Scoring
    totalPoints: integer("total_points").default(0),
    passingPoints: integer("passing_points").default(0),

    // Timing (all optional)
    startDate: text("start_date"),
    endDate: text("end_date"),
    timeLimitMinutes: integer("time_limit_minutes"),
    retakeAllowed: integer("retake_allowed").default(0),
    maxRetakes: integer("max_retakes").default(0),

    // Status
    isPublished: integer("is_published").default(0),
    isActive: integer("is_active").default(1),
    isDeleted: integer("is_deleted").default(0),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (table) => [
    index("institution_quizzes_institution_id_idx").on(table.institutionId),
    index("institution_quizzes_is_deleted_idx").on(table.isDeleted),
    index("institution_quizzes_is_published_idx").on(table.isPublished),
  ],
);

// ─── Quiz Questions ────────────────────────────────────────────
export const institutionQuizQuestions = sqliteTable(
  "institution_quiz_questions",
  {
    id: text("id").primaryKey(),
    quizId: text("quiz_id").notNull().references(() => institutionQuizzes.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    questionMediaUrl: text("question_media_url"),
    questionMediaType: text("question_media_type"), // "image" | "video"
    answerType: text("answer_type").notNull().default("multiple_choice"), // multiple_choice | true_false
    correctAnswer: text("correct_answer"), // option index or value
    explanation: text("explanation"),
    points: integer("points").default(1),
    order: integer("order").default(0),
    isDeleted: integer("is_deleted").default(0),
    createdAt: text("created_at"),
    updatedAt: text("updated_at"),
  },
  (table) => [
    index("institution_quiz_questions_quiz_id_idx").on(table.quizId),
  ],
);

// ─── Quiz Question Options ─────────────────────────────────────
export const institutionQuizQuestionOptions = sqliteTable(
  "institution_quiz_question_options",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id").notNull().references(() => institutionQuizQuestions.id, { onDelete: "cascade" }),
    text: text("text"),
    mediaUrl: text("media_url"),
    mediaType: text("media_type"), // "image" | "video"
    order: integer("order").default(0),
    isDeleted: integer("is_deleted").default(0),
  },
  (table) => [
    index("institution_quiz_question_options_question_id_idx").on(table.questionId),
  ],
);

// ─── Quiz Attempts ─────────────────────────────────────────────
export const institutionQuizAttempts = sqliteTable(
  "institution_quiz_attempts",
  {
    id: text("id").primaryKey(),
    quizId: text("quiz_id").notNull().references(() => institutionQuizzes.id),
    studentId: text("student_id").notNull(),
    score: real("score").default(0),
    maxScore: real("max_score").default(0),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    timeTakenSeconds: integer("time_taken_seconds"),
    attemptNumber: integer("attempt_number").default(1),
    isDeleted: integer("is_deleted").default(0),
    createdAt: text("created_at"),
  },
  (table) => [
    index("institution_quiz_attempts_quiz_id_idx").on(table.quizId),
    index("institution_quiz_attempts_student_id_idx").on(table.studentId),
    uniqueIndex("institution_quiz_attempts_quiz_student_attempt_idx")
      .on(table.quizId, table.studentId, table.attemptNumber),
  ],
);

// ─── Quiz Attempt Answers ──────────────────────────────────────
export const institutionQuizAttemptAnswers = sqliteTable(
  "institution_quiz_attempt_answers",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull().references(() => institutionQuizAttempts.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull().references(() => institutionQuizQuestions.id),
    selectedAnswer: text("selected_answer"),
    isCorrect: integer("is_correct"),
    pointsAwarded: real("points_awarded").default(0),
  },
  (table) => [
    index("institution_quiz_attempt_answers_attempt_id_idx").on(table.attemptId),
  ],
);
