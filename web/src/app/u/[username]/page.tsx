import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CTAButton, Footer, Header } from "@/components/Chrome";
import { Heatmap } from "@/components/Heatmap";
import { RetentionRing } from "@/components/RetentionRing";
import { pct, sortPatterns } from "@/lib/patterns";
import { getPublicProfile } from "@/lib/supabase";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) return { title: "Profile not found — AlgoRecall", robots: { index: false } };
  const name = profile.display_name || profile.username;
  return {
    title: `${name}'s AlgoRecall progress`,
    description: `${profile.stats.current_streak}-day streak, ${profile.stats.total_reviews} reviews, ${pct(profile.stats.retention_rate)} retention on AlgoRecall.`,
  };
}

function memberSince(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 text-3xl font-bold">{children}</div>
    </div>
  );
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  const { stats } = profile;
  const name = profile.display_name || profile.username;
  const since = memberSince(profile.member_since);
  const patterns = sortPatterns(stats.patterns ?? []);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          <p className="text-muted">
            <span className="font-mono">@{profile.username}</span>
            {since ? ` · Member since ${since}` : ""}
          </p>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
          <Stat label="Current streak">
            <span aria-hidden>🔥 </span>
            {stats.current_streak}
            <span className="text-base font-medium text-muted"> days</span>
          </Stat>
          <Stat label="Longest streak">
            {stats.longest_streak}
            <span className="text-base font-medium text-muted"> days</span>
          </Stat>
          <Stat label="Total reviews">{stats.total_reviews.toLocaleString("en-US")}</Stat>
          <div className="flex items-center justify-center rounded-2xl border border-line bg-card p-3">
            <RetentionRing value={stats.retention_rate} />
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-line bg-card p-5" aria-labelledby="h-activity">
          <h2 id="h-activity" className="mb-4 font-semibold">Activity, last 12 months</h2>
          <Heatmap activeDays={stats.active_days ?? []} />
        </section>

        <section className="mt-6 rounded-2xl border border-line bg-card p-5" aria-labelledby="h-patterns">
          <h2 id="h-patterns" className="mb-4 font-semibold">Pattern mastery</h2>
          {patterns.length === 0 ? (
            <p className="text-sm text-muted">No patterns reviewed yet.</p>
          ) : (
            <ul className="space-y-3">
              {patterns.map((p) => (
                <li key={p.pattern}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{p.pattern}</span>
                    <span className="shrink-0 text-muted">
                      {pct(p.retention)} · {p.problems} problem{p.problems === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${p.pattern} retention`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round((p.retention ?? 0) * 100)}
                    className="h-2 overflow-hidden rounded-full bg-[var(--h0)]"
                  >
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.round((p.retention ?? 0) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glow mt-8 rounded-3xl border border-line bg-card px-6 py-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Start your own streak</h2>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Turn every solved problem into long-term memory with spaced repetition.
          </p>
          <div className="mt-5">
            <CTAButton>Add AlgoRecall to Chrome</CTAButton>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
