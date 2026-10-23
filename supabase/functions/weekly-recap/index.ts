// weekly-recap: invoked weekly by pg_cron/pg_net (verify_jwt = false; guarded by x-cron-secret).
// Sends each profile with weekly_recap = true a Brevo transactional email.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const CTA_URL = "https://leetcode.com";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function safeTz(tz: string | null): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC" });
    return tz || "UTC";
  } catch {
    return "UTC";
  }
}

function dayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function weekdayShort(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
}

type Review = { reviewed_at: string; quality: number };

function buildParams(
  profile: { display_name: string | null; timezone: string | null },
  stats: any,
  reviews: Review[],
) {
  const tz = safeTz(profile.timezone);
  const now = Date.now();
  const weekStart = now - 7 * 864e5;
  const thisWeek = reviews.filter((r) => new Date(r.reviewed_at).getTime() > weekStart);
  const prevWeek = reviews.length - thisWeek.length;

  // Last 7 calendar days (in the user's tz), oldest first, ending today.
  const days: { key: string; label: string; n: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 864e5);
    days.push({ key: dayKey(d, tz), label: weekdayShort(d, tz), n: 0 });
  }
  for (const r of thisWeek) {
    const k = dayKey(new Date(r.reviewed_at), tz);
    const slot = days.find((x) => x.key === k);
    if (slot) slot.n++;
  }

  const weekRetention = thisWeek.length
    ? thisWeek.filter((r) => r.quality >= 3).length / thisWeek.length
    : stats?.retention_rate ?? null;
  const delta = thisWeek.length - prevWeek;
  const weakest = (stats?.weakest_patterns ?? [])[0] ?? null;

  return {
    name: profile.display_name?.trim() || "there",
    reviews_week: thisWeek.length,
    current_streak: stats?.current_streak ?? 0,
    retention_pct: weekRetention == null ? 0 : Math.round(Number(weekRetention) * 100),
    reviews_delta_text: `${delta >= 0 ? "+" : ""}${delta} vs last week (${prevWeek})`,
    weakest_pattern: weakest?.pattern ?? "",
    weakest_retention_pct: weakest?.retention == null ? 0 : Math.round(Number(weakest.retention) * 100),
    due_count: stats?.due_today ?? 0,
    day_counts: days.map((d) => `${d.label} ${d.n}`).join(" · "),
    cta_url: CTA_URL,
  };
}

function fallbackHtml(p: ReturnType<typeof buildParams>): string {
  const focus = p.weakest_pattern
    ? `<p style="margin:16px 0;padding:12px 16px;background:#fff7ed;border-radius:8px;">Focus this week: <b>${esc(p.weakest_pattern)}</b> (${p.weakest_retention_pct}% retention)</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:12px;padding:28px;">
<h2 style="margin:0 0 4px;">Your week in AlgoRecall</h2>
<p style="margin:0 0 16px;color:#52525b;">Hi ${esc(p.name)}, here is how your last 7 days went.</p>
<table role="presentation" width="100%" style="border-collapse:collapse;text-align:center;">
<tr>
<td style="padding:12px;"><div style="font-size:28px;font-weight:700;">${p.reviews_week}</div><div style="color:#71717a;font-size:12px;">reviews</div></td>
<td style="padding:12px;"><div style="font-size:28px;font-weight:700;">${p.current_streak}</div><div style="color:#71717a;font-size:12px;">day streak</div></td>
<td style="padding:12px;"><div style="font-size:28px;font-weight:700;">${p.retention_pct}%</div><div style="color:#71717a;font-size:12px;">retention</div></td>
</tr></table>
<p style="color:#52525b;font-size:13px;">${esc(p.reviews_delta_text)}<br>${esc(p.day_counts)}</p>
${focus}
<p style="margin:16px 0;">${p.due_count} problem${p.due_count === 1 ? "" : "s"} due today.</p>
<p><a href="${esc(p.cta_url)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;">Start reviewing</a></p>
<p style="color:#a1a1aa;font-size:12px;margin-top:24px;">Turn this email off in AlgoRecall Settings, Weekly recap.</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET");
  const given = req.headers.get("x-cron-secret");
  if (!cronSecret || !given || given !== cronSecret) return json({ error: "unauthorized" }, 401);

  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoKey) return json({ error: "not_configured", detail: "BREVO_API_KEY" }, 500);
  const templateId = Number(Deno.env.get("BREVO_RECAP_TEMPLATE_ID"));
  const useTemplate = Number.isFinite(templateId) && templateId > 0;
  const sender = Deno.env.get("RECAP_SENDER_EMAIL");
  if (!useTemplate && !sender) return json({ error: "not_configured", detail: "RECAP_SENDER_EMAIL" }, 500);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, display_name, timezone, email")
    .eq("weekly_recap", true)
    .not("email", "is", null);
  if (error) return json({ error: "db_error", detail: error.message }, 500);

  let sent = 0, skipped = 0, failed = 0;
  const since = new Date(Date.now() - 14 * 864e5).toISOString();

  for (const p of profiles ?? []) {
    try {
      const tz = safeTz(p.timezone);
      const { data: stats, error: sErr } = await admin.rpc("_stats_for", { p_uid: p.id, tz });
      if (sErr) throw new Error(sErr.message);
      if (!stats || stats.total_reviews === 0) { skipped++; continue; }

      const { data: reviews, error: rErr } = await admin
        .from("reviews")
        .select("reviewed_at, quality")
        .eq("user_id", p.id)
        .gte("reviewed_at", since);
      if (rErr) throw new Error(rErr.message);

      const params = buildParams(p, stats, (reviews ?? []) as Review[]);
      const to = [{ email: p.email as string, name: params.name }];
      const body = useTemplate
        ? { templateId, to, params }
        : {
          sender: { email: sender, name: "AlgoRecall" },
          to,
          subject: `Your week in AlgoRecall: ${params.reviews_week} reviews, ${params.current_streak}-day streak`,
          htmlContent: fallbackHtml(params),
          tags: ["weekly-recap"],
        };

      const res = await fetch(BREVO_URL, {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
      sent++;
    } catch (e) {
      failed++;
      console.error("recap failed for", p.id, e instanceof Error ? e.message : e);
    }
  }
  return json({ ok: true, sent, skipped, failed });
});
