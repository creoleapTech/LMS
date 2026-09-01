import { useCallback, useRef, useState } from "react";
import {
  logTrainingButton,
  logTrainingProgress,
  logTrainingError,
  safeSetPointerCapture,
} from "@/lib/trainingLogger";

type Node = { id: string; x: number; y: number; label: string };

/**
 * ImageClassifierPanel — fixed setPointerCapture + training logging
 * Original bug: `el.setPointerCapture(e.pointerId)` threw
 * `NotFoundError: No active pointer with the given id` because
 * handler was onMouseDown (no pointerId) or pointerId was stale.
 * Fix: use onPointerDown + safeSetPointerCapture guard + try/catch.
 *
 * Also logs:
 * - training button clicks via logTrainingButton()
 * - training progress (epoch/loss/accuracy) via logTrainingProgress()
 * So `wrangler tail | grep "\[training\]"` shows full flow.
 */
export function ImageClassifierPanel() {
  const [nodes, setNodes] = useState<Node[]>([
    { id: "1", x: 80, y: 80, label: "Class A" },
    { id: "2", x: 220, y: 140, label: "Class B" },
  ]);
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const startNodeDrag = useCallback((e: React.PointerEvent<HTMLDivElement>, node: Node) => {
    // Fix: use PointerEvent + safe wrapper, log drag start
    console.log("[training][drag] start", { nodeId: node.id, pointerId: e.pointerId, pointerType: e.pointerType });
    logTrainingButton({ action: "drag_start", model: "image-classifier", label: node.id });
    const el = e.currentTarget as HTMLElement;
    safeSetPointerCapture(el, e.pointerId, `startNodeDrag:${node.id}`);

    const rect = el.parentElement?.getBoundingClientRect();
    dragRef.current = {
      id: node.id,
      offsetX: e.clientX - (rect ? node.x + rect.left : e.clientX),
      offsetY: e.clientY - (rect ? node.y + rect.top : e.clientY),
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const parentRect = el.parentElement?.getBoundingClientRect();
      if (!parentRect) return;
      const x = ev.clientX - parentRect.left - dragRef.current.offsetX;
      const y = ev.clientY - parentRect.top - dragRef.current.offsetY;
      setNodes((prev) => prev.map((n) => (n.id === dragRef.current!.id ? { ...n, x, y } : n)));
    };
    const onUp = (ev: PointerEvent) => {
      console.log("[training][drag] end", { nodeId: node.id, pointerId: ev.pointerId });
      try {
        if (el.hasPointerCapture?.(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
      } catch {}
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const handleTrain = useCallback(async () => {
    if (isTraining) return;
    setIsTraining(true);
    setProgress(0);
    logTrainingButton({ action: "train_click", model: "image-classifier", label: "train-model" });
    logTrainingProgress({ status: "start", message: "Training started", extra: { nodes } });

    try {
      // Simulate training — replace with real train() call
      for (let epoch = 1; epoch <= 5; epoch++) {
        await new Promise((r) => setTimeout(r, 600));
        const accuracy = 0.6 + epoch * 0.07 + Math.random() * 0.05;
        const loss = 1.2 - epoch * 0.15;
        const p = Math.round((epoch / 5) * 100);
        setProgress(p);
        logTrainingProgress({
          status: "progress",
          epoch,
          totalSteps: 5,
          step: epoch,
          accuracy: Number(accuracy.toFixed(3)),
          loss: Number(loss.toFixed(3)),
          message: `Epoch ${epoch}/5`,
        });
        console.log(`[training][progress] epoch ${epoch}/5 accuracy=${accuracy.toFixed(3)} loss=${loss.toFixed(3)}`);
      }
      logTrainingProgress({ status: "complete", message: "Training complete" });
      console.log("[training] complete");
    } catch (err) {
      logTrainingError(err, { where: "handleTrain" });
      logTrainingProgress({ status: "error", message: String(err) });
    } finally {
      setIsTraining(false);
    }
  }, [isTraining, nodes]);

  return (
    <div className="p-4 border rounded-xl bg-card">
      <h3 className="font-bold mb-3">Image Classifier</h3>

      {/* Draggable nodes — use onPointerDown not onMouseDown */}
      <div className="relative h-[300px] bg-muted rounded-lg overflow-hidden mb-4">
        {nodes.map((n) => (
          <div
            key={n.id}
            // FIX: onPointerDown gives reliable pointerId, safeSetPointerCapture guards throw
            onPointerDown={(e) => startNodeDrag(e, n)}
            // Also support mouse fallback without capture (no-op)
            onMouseDown={() => {
              // Fallback for non-pointer devices — don't call setPointerCapture at all
              console.log("[training][drag] mouse fallback", { nodeId: n.id });
            }}
            style={{ left: n.x, top: n.y }}
            className="absolute px-3 py-2 bg-primary text-primary-foreground rounded-lg cursor-grab active:cursor-grabbing select-none touch-none"
          >
            {n.label}
          </div>
        ))}
        <div className="absolute bottom-2 left-2 text-xs text-muted-foreground">
          Drag nodes to arrange classes — logs to [training][drag]
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleTrain}
          disabled={isTraining}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 font-medium"
        >
          {isTraining ? `Training ${progress}%` : "Train Model"}
        </button>
        {isTraining && <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Logs: browser console <code>[training][button]</code> / <code>[training][progress]</code> and worker tail <code>wrangler tail | grep "\[training\]"</code> via <code>POST /api/admin/training-log</code>.
      </p>
    </div>
  );
}

export default ImageClassifierPanel;
