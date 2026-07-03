import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/quizzes/")({
  component: lazyRouteComponent(() => import("@/pages/quizzes/QuizzesPage"), "default"),
});
