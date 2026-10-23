import type { ActiveDay } from "./types";

export interface HeatCell {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export type HeatGrid = (HeatCell | null)[][]; // [column][row], 53 x 7, row 0 = Sunday

const DAY = 86_400_000;

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Level thresholds scale with the busiest day so sparse and heavy users both look sensible. */
export function levelFor(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const r = count / max;
  if (r > 0.75) return 4;
  if (r > 0.5) return 3;
  if (r > 0.25) return 2;
  return 1;
}

/**
 * Build a GitHub-style grid: 53 week-columns (Sun..Sat) ending with the week containing `today` (UTC).
 * Cells after `today` are null.
 */
export function buildHeatGrid(
  activeDays: ActiveDay[],
  today: Date = new Date(),
): HeatGrid {
  const todayUTC = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const dow = new Date(todayUTC).getUTCDay();
  const lastColStart = todayUTC - dow * DAY;
  const start = lastColStart - 52 * 7 * DAY;

  const counts = new Map<string, number>();
  let max = 0;
  for (const { day, count } of activeDays) {
    counts.set(day, (counts.get(day) ?? 0) + count);
  }
  for (const c of counts.values()) max = Math.max(max, c);

  const grid: HeatGrid = [];
  for (let col = 0; col < 53; col++) {
    const column: (HeatCell | null)[] = [];
    for (let row = 0; row < 7; row++) {
      const t = start + (col * 7 + row) * DAY;
      if (t > todayUTC) {
        column.push(null);
        continue;
      }
      const date = toISODate(new Date(t));
      const count = counts.get(date) ?? 0;
      column.push({ date, count, level: levelFor(count, max) });
    }
    grid.push(column);
  }
  return grid;
}

export const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

/** Month label per column (only where the month changes). */
export function monthLabels(grid: HeatGrid): (string | null)[] {
  let prev = -1;
  return grid.map((col) => {
    const first = col.find((c) => c);
    if (!first) return null;
    const m = Number(first.date.slice(5, 7)) - 1;
    if (m === prev) return null;
    prev = m;
    return MONTHS[m];
  });
}
