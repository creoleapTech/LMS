import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const StudentProfilePage = lazyWithRetry(
  () => import("@/pages/students/StudentProfilePage").then((m) => ({ default: m.StudentProfilePage })),
  "StudentProfilePage"
);

export const Route = createFileRoute("/students/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading student profile...</div>}>
      <StudentProfilePage id={id} />
    </Suspense>
  );
}
