import { buildHeatGrid, monthLabels } from "@/lib/heatmap";
import type { ActiveDay } from "@/lib/types";

export function Heatmap({ activeDays, today }: { activeDays: ActiveDay[]; today?: Date }) {
  const grid = buildHeatGrid(activeDays, today);
  const labels = monthLabels(grid);
  const total = activeDays.reduce((a, d) => a + d.count, 0);
  const activeCount = activeDays.filter((d) => d.count > 0).length;
  const CELL = 12;
  const GAP = 3;
  const width = 53 * (CELL + GAP);

  return (
    <figure>
      <div className="overflow-x-auto pb-2">
        <div style={{ width }} className="mx-auto">
          <div className="relative mb-1 h-4 text-[10px] text-muted" aria-hidden>
            {labels.map((l, i) =>
              l ? (
                <span key={i} className="absolute" style={{ left: i * (CELL + GAP) }}>
                  {l}
                </span>
              ) : null,
            )}
          </div>
          <div
            role="img"
            aria-label={`Review activity over the last 12 months: ${total} reviews on ${activeCount} days`}
            className="flex"
            style={{ gap: GAP }}
          >
            {grid.map((col, ci) => (
              <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
                {col.map((cell, ri) =>
                  cell ? (
                    <div
                      key={ri}
                      className={`heat-${cell.level} rounded-[3px]`}
                      style={{ width: CELL, height: CELL }}
                      title={`${cell.count} review${cell.count === 1 ? "" : "s"} on ${cell.date}`}
                      aria-label={`${cell.count} reviews on ${cell.date}`}
                    />
                  ) : (
                    <div key={ri} style={{ width: CELL, height: CELL }} />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`heat-${l} inline-block h-3 w-3 rounded-[3px]`} />
        ))}
        More
      </figcaption>
    </figure>
  );
}
