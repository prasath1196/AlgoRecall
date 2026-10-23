import { describe, expect, it } from "vitest";
import { buildHeatGrid, levelFor, monthLabels } from "@/lib/heatmap";

describe("buildHeatGrid", () => {
  const today = new Date("2026-10-23T10:00:00Z"); // Friday
  it("is 53 columns x 7 rows with future cells null", () => {
    const g = buildHeatGrid([], today);
    expect(g).toHaveLength(53);
    g.forEach((c) => expect(c).toHaveLength(7));
    const last = g[52];
    expect(last[5]?.date).toBe("2026-10-23");
    expect(last[6]).toBeNull();
    expect(g[0][0]?.date).toBe("2025-10-19");
    expect(g[0][0]?.date && new Date(g[0][0].date + "T00:00:00Z").getUTCDay()).toBe(0);
  });
  it("maps counts to levels", () => {
    const g = buildHeatGrid(
      [
        { day: "2026-10-23", count: 8 },
        { day: "2026-10-22", count: 5 },
        { day: "2026-10-21", count: 3 },
        { day: "2026-10-20", count: 1 },
      ],
      today,
    );
    expect(g[52][5]?.level).toBe(4);
    expect(g[52][4]?.level).toBe(3);
    expect(g[52][3]?.level).toBe(2);
    expect(g[52][2]?.level).toBe(1);
    expect(g[52][1]?.level).toBe(0);
  });
  it("levelFor handles zero", () => {
    expect(levelFor(0, 0)).toBe(0);
    expect(levelFor(1, 100)).toBe(1);
  });
  it("labels months once per change", () => {
    const l = monthLabels(buildHeatGrid([], today)).filter(Boolean);
    expect(l.length).toBeGreaterThanOrEqual(12);
  });
});
