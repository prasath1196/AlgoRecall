# AlgoRecall feature wave 2 — contract

Builds on docs/sync-contract.md. Supabase project `xqzgcvayyzuvbtlcgibe`.
Every agent follows these names exactly.

## Database additions (migration `supabase/migrations/20261023010000_features.sql`)
- `profiles` add: `username text unique` (lowercase, `^[a-z0-9_-]{3,30}$`), `is_public boolean not null default false`,
  `weekly_recap boolean not null default false`, `email text` (copied from auth.users on signup for recap emails; not readable by others).
- RPC `set_profile(p_username text, p_is_public boolean, p_weekly_recap boolean) returns jsonb` — security invoker, updates caller's own row,
  validates username format, returns `{ ok, error? }` (`error: 'username_taken' | 'invalid_username'`).
- RPC `get_my_profile() returns jsonb` — `{ username, is_public, weekly_recap, display_name }`.
- RPC `get_public_profile(p_username text) returns jsonb` — SECURITY DEFINER, callable by `anon`; returns null unless that profile
  `is_public`. Shape: `{ username, display_name, member_since, stats: <same shape as get_my_stats but computed for that user, tz 'UTC'> }`.
  Never returns code, notes, urls, email. Pattern list only (no problem titles).
- Table `hint_usage(user_id uuid, day date, count int, primary key(user_id, day))` — RLS select own; writes only by edge function (service role).

## Edge functions (supabase/functions/*), verify_jwt = true unless noted
- `hint` POST `{ url, title, pattern_tags, difficulty, description?, user_code?, level: 1|2|3 }` →
  `{ hint: string, remaining_today: number }` or `{ error: 'limit_reached' | 'not_configured' | 'bad_request' }`.
  Level 1 = nudge toward pattern, 2 = key insight, 3 = step outline. Never returns full code. Daily cap 20/user (HINT_DAILY_LIMIT env).
  Uses secret `ANTHROPIC_API_KEY` (Claude API, small fast model). Saved solution code is NOT sent unless the user typed `user_code`.
- `weekly-recap` (verify_jwt = false, guarded by header `x-cron-secret` == secret `CRON_SECRET`) — for each profile with weekly_recap=true,
  compute last-7-day stats and send an email via Brevo transactional API (secret `BREVO_API_KEY`, sender from `RECAP_SENDER_EMAIL`).
  Scheduled weekly (Monday 14:00 UTC) via pg_cron + pg_net in the migration, only if extensions available; document manual setup otherwise.

## Extension: background messages (background.js handles; UI sends)
- `{ type: 'GET_LOCAL_SUMMARY' }` → `{ total, due }` (local IndexedDB counts, excludes tombstones).
- `{ type: 'SET_REMINDER', enabled: boolean, time: 'HH:MM' }` → `{ ok }`; stored in chrome.storage.local `reminder` `{ enabled, time }`.
  Background schedules chrome.alarms `algorecall-reminder` daily at that local time; on fire, if due > 0 show chrome.notifications
  "N problems due today" (click opens dashboard). Re-schedule on startup/install.
- `{ type: 'GET_REMINDER' }` → `{ enabled, time }` (default `{ enabled: false, time: '09:00' }`).
- `{ type: 'IMPORT_LEETCODE', limit?: number }` → `{ ok, imported, skipped, error? }` (`error: 'not_logged_in' | 'network' | ...`).
  Uses the user's existing leetcode.com session (fetch from extension with credentials) to read accepted submissions,
  creates problems (url `https://leetcode.com/problems/<slug>`, title, difficulty, pattern_tag from topic tags, code + language of latest AC,
  next_review_at = now, interval 0, repetition_count 0, ease_factor 2.5, review_history []). Never overwrites existing problems' schedule.
  Broadcasts `{ type: 'IMPORT_PROGRESS', done, total }` during import and `PROBLEMS_CHANGED` at the end.
- `{ type: 'SIGN_IN_GITHUB' }` → `{ ok, error? }` — chrome.identity.launchWebAuthFlow with supabase `signInWithOAuth({ provider: 'github',
  options: { redirectTo: chrome.identity.getRedirectURL(), skipBrowserRedirect: true } })`, then exchange code (PKCE) for session.
  Error `provider_not_enabled` when Supabase GitHub provider is off.

## Extension: sync/auth additions
- `src/sync/auth.js` add `signInWithGitHub()` (UI calls background via SIGN_IN_GITHUB because identity flow should run in background).
- `src/sync/profile.js` (new): `getMyProfile()`, `setProfile({ username, isPublic, weeklyRecap })`, `requestHint(payload)` (functions.invoke('hint')).

## Dashboard
- `MockInterviewView` (src/dashboard/mock/MockInterviewView.jsx): props `{ problems, weakPatterns: string[], onExit, onSaveRating(problem, quality) }`.
  Self-contained: config (count 3/5, minutes per problem 15/25/45), weighted random pick (weak patterns ×3, overdue ×2), timer,
  reveal solution, self-score 0-5 per problem, summary screen with score and per-pattern breakdown.
- Public page URL: `${PUBLIC_SITE_URL}/u/<username>`; `PUBLIC_SITE_URL` exported from src/sync/config.js (default to the Vercel URL once known; placeholder 'https://algorecall.vercel.app').
