import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const QuizDetailPage = lazy(() => import("@/pages/quizzes/QuizDetailPage"));

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
