export interface Question {
  questionText: string;
  questionMedia?: { type: "image" | "video"; url: string };
  answerType:
    | "multiple_choice"
    | "fill_blank"
    | "paragraph"
    | "match_following";
  options?: string[];
  correctAnswer?: number;
  correctTextAnswer?: string;
  matchPairs?: { left: string; right: string }[];
  explanation?: string;
  points?: number;
}
