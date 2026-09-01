/**
 * Training logger — logs training button clicks and training progress
 * to both browser console and Cloudflare Worker observability (via /api/admin/training-log).
 * Prefix [training] makes wrangler tail filtering easy:
 *   wrangler tail --format pretty | grep "\[training\]"
 */
import { _axios } from "./axios";

type TrainingButtonEvent = {
  action: string; // e.g. "train_click" | "train_cancel" | "train_retry"
  model?: string; // e.g. "image-classifier"
  label?: string;
  extra?: Record<string, unknown>;
};

type TrainingProgressEvent = {
  epoch?: number;
  step?: number;
  totalSteps?: number;
  accuracy?: number;
  loss?: number;
  status: "start" | "progress" | "complete" | "error" | "cancel";
  message?: string;
  extra?: Record<string, unknown>;
};

// fire-and-forget beacon to worker logs (shows in wrangler tail + Workers Observability)
async function beacon(payload: Record<string, unknown>) {
  try {
    // Use _axios if available, fallback to fetch to avoid circular deps in tests
    if (_axios) {
      _axios.post("/admin/training-log", payload).catch(() => {});
    } else {
      fetch("/api/admin/training-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch {
    // ignore beacon failures — console log is primary
  }
}

export function logTrainingButton(event: TrainingButtonEvent) {
  const payload = {
    kind: "training_button",
    ts: new Date().toISOString(),
    ...event,
  };
  console.log("[training][button]", payload);
  beacon(payload);
}

export function logTrainingProgress(event: TrainingProgressEvent) {
  const payload = {
    kind: "training_progress",
    ts: new Date().toISOString(),
    ...event,
  };
  // console.log for local dev, console.info for progress so it stands out
  console.log("[training][progress]", payload);
  beacon(payload);
}

export function logTrainingError(error: unknown, context?: Record<string, unknown>) {
  const payload = {
    kind: "training_error",
    ts: new Date().toISOString(),
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    ...context,
  };
  console.error("[training][error]", payload);
  beacon(payload);
}

/**
 * Safe wrapper for Element.setPointerCapture — prevents
 * `NotFoundError: No active pointer with the given id`.
 * Use in drag handlers instead of direct el.setPointerCapture(e.pointerId).
 */
export function safeSetPointerCapture(
  el: Element | null,
  pointerId: number | undefined,
  context?: string
) {
  if (!el || pointerId == null || typeof (el as HTMLElement).setPointerCapture !== "function") {
    console.warn("[training][pointer] skip setPointerCapture — missing el/pointerId", { pointerId, context });
    return false;
  }
  try {
    // hasPointerCapture check avoids InvalidPointerId on some browsers
    const has = (el as HTMLElement).hasPointerCapture?.(pointerId);
    if (has) return true;
    (el as HTMLElement).setPointerCapture(pointerId);
    console.log("[training][pointer] setPointerCapture ok", { pointerId, context });
    return true;
  } catch (err) {
    console.warn("[training][pointer] setPointerCapture failed", { pointerId, context, err });
    logTrainingError(err, { context: "setPointerCapture", pointerId, where: context });
    return false;
  }
}
