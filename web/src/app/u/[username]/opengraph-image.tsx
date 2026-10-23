import { ImageResponse } from "next/og";
import { pct } from "@/lib/patterns";
import { getPublicProfile } from "@/lib/supabase";

export const alt = "AlgoRecall progress";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  const name = profile ? profile.display_name || profile.username : "AlgoRecall";
  const s = profile?.stats;

  const items: [string, string][] = s
    ? [
        ["Day streak", String(s.current_streak)],
        ["Reviews", s.total_reviews.toLocaleString("en-US")],
        ["Retention", pct(s.retention_rate)],
      ]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #09090b 0%, #1b1740 100%)",
          color: "#f4f4f5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, color: "#a99dff" }}>
          AlgoRecall
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, display: "flex" }}>{name}</div>
          <div style={{ fontSize: 32, color: "#a1a1aa", display: "flex", marginTop: 8 }}>
            {profile ? "DSA spaced repetition progress" : "Never forget a DSA pattern again"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 56 }}>
          {items.map(([label, value]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 84, fontWeight: 700, display: "flex" }}>{value}</div>
              <div style={{ fontSize: 28, color: "#a1a1aa", display: "flex" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
