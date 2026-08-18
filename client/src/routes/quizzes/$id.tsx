import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const QuizDetailPage = lazyWithRetry(() => import("@/pages/quizzes/QuizDetailPage"), "QuizDetailPage");

export const Route = createFileRoute("/quizzes/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Suspense
      fallback={<div className="p-8 text-center text-slate-400">Loading quiz...</div>}
    >
      <QuizDetailPage />
    </Suspense>
  );
}
