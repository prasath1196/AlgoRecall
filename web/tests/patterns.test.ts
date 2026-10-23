import { describe, expect, it } from "vitest";
import { pct, sortPatterns } from "@/lib/patterns";

const p = (pattern: string, retention: number | null, reviews = 1) => ({
  pattern, problems: 1, reviews, avg_quality: 3, retention,
});

describe("sortPatterns", () => {
  it("sorts by retention desc, nulls last, without mutating", () => {
    const input = [p("b", 0.5), p("n", null), p("a", 0.9), p("c", 0.5, 5)];
    const out = sortPatterns(input).map((x) => x.pattern);
    expect(out).toEqual(["a", "c", "b", "n"]);
    expect(input[0].pattern).toBe("b");
  });
  it("formats pct", () => {
    expect(pct(0.784)).toBe("78%");
    expect(pct(null)).toBe("—");
  });
});
