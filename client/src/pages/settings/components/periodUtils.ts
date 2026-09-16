import type { IPeriodSlot } from "@/types/timetable";

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/** Parse "HH:MM" (or "HH:MM:SS") to minutes since midnight. Null when invalid. */
export function parseTimeToMinutes(t: unknown): number | null {
  if (typeof t !== "string") return null;
  const m = t.trim().match(TIME_RE);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

/** Format "HH:MM" as 12-hour string with a fully-visible AM/PM suffix. */
export function formatTime12h(t: unknown): string {
  const mins = parseTimeToMinutes(t);
  if (mins === null) return typeof t === "string" && t ? t : "--:--";
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Short range label, e.g. "08:00 AM – 08:45 AM". */
export function formatTimeRange12h(startTime: unknown, endTime: unknown): string {
  return `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
}

export interface PeriodConflict {
  indexA: number;
  indexB: number;
}

/**
 * Find overlapping time slots. Two slots overlap when
 * max(startA, startB) < min(endA, endB) — touching edges (end == start)
 * are adjacent, not overlapping. Invalid/missing times are skipped.
 * Order-independent: works regardless of list order.
 */
export function findPeriodConflicts(periods: Pick<IPeriodSlot, "startTime" | "endTime">[]): PeriodConflict[] {
  const ranges = periods.map((p) => {
    const s = parseTimeToMinutes(p.startTime);
    const e = parseTimeToMinutes(p.endTime);
    if (s === null || e === null || s >= e) return null;
    return { s, e };
  });
  const conflicts: PeriodConflict[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const a = ranges[i];
    if (!a) continue;
    for (let j = i + 1; j < ranges.length; j++) {
      const b = ranges[j];
      if (!b) continue;
      if (Math.max(a.s, b.s) < Math.min(a.e, b.e)) {
        conflicts.push({ indexA: i, indexB: j });
      }
    }
  }
  return conflicts;
}

/** Set of row indexes involved in any conflict — handy for highlighting. */
export function conflictedIndexes(periods: Pick<IPeriodSlot, "startTime" | "endTime">[]): Set<number> {
  const out = new Set<number>();
  for (const c of findPeriodConflicts(periods)) {
    out.add(c.indexA);
    out.add(c.indexB);
  }
  return out;
}

/**
 * Live display numbers in current list order: teaching slots get
 * sequential 1..N, breaks show "B". Recomputed on every render so
 * delete / drag-reorder updates numbers immediately (no save needed).
 */
export function displayNumbers(periods: Pick<IPeriodSlot, "isBreak">[]): (number | "B")[] {
  let counter = 0;
  return periods.map((p) => {
    if (p.isBreak) return "B";
    counter += 1;
    return counter;
  });
}

/**
 * Payload numbers for save: teaching slots sequential 1..N in current
 * order; breaks get high sentinel numbers (10000+) so they never clash
 * with teaching period numbers.
 */
export function payloadNumbers(periods: Pick<IPeriodSlot, "isBreak">[]): number[] {
  let counter = 0;
  let breakCounter = 0;
  return periods.map((p) => {
    if (!p.isBreak) {
      counter += 1;
      return counter;
    }
    breakCounter += 1;
    return 10000 + breakCounter;
  });
}
