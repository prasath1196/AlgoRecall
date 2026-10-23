import type { PatternStat } from "./types";

/** Strongest retention first; null retention last; ties by reviews then name. */
export function sortPatterns(patterns: PatternStat[]): PatternStat[] {
  return [...patterns].sort((a, b) => {
    const ra = a.retention ?? -1;
    const rb = b.retention ?? -1;
    if (rb !== ra) return rb - ra;
    if (b.reviews !== a.reviews) return b.reviews - a.reviews;
    return a.pattern.localeCompare(b.pattern);
  });
}

export function pct(v: number | null | undefined): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}
