# AlgoRecall cloud sync — contract

Local-first: IndexedDB (`db.js`, store `problems`, keyPath `url`) stays the source of truth for the UI.
When signed in, a sync engine mirrors data to Supabase project `xqzgcvayyzuvbtlcgibe`.

## Local problem record (existing shape)
url (key), title, platform, difficulty ('Easy'|'Medium'|'Hard'|...), pattern_tag (string[]), code, language,
description, notes, interval, repetition_count, ease_factor, next_review_at (ISO), created_at (ISO),
review_history: [{ date: ISO, quality: 0-5 }], local_saved_at, last_updated_at (ISO).
New local-only sync fields: `_dirty` (boolean), `_deleted_at` (ISO|null; tombstone, hidden from UI).

## Database (public schema, RLS: owner-only via auth.uid())
- profiles(id uuid pk -> auth.users, display_name text, timezone text default 'UTC', created_at timestamptz) — row auto-created on signup.
- problems(user_id uuid default auth.uid(), url text, title text, platform text, difficulty text,
  pattern_tags text[] default '{}', code text, language text, description text, notes text,
  interval int default 0, repetition_count int default 0, ease_factor real default 2.5,
  next_review_at timestamptz, created_at timestamptz, client_updated_at timestamptz not null,
  updated_at timestamptz not null default now() (server-set by trigger on insert/update),
  deleted_at timestamptz null, extra jsonb default '{}', PRIMARY KEY (user_id, url)).
- reviews(user_id uuid default auth.uid(), url text, reviewed_at timestamptz, quality smallint 0..5,
  created_at timestamptz default now(), PRIMARY KEY (user_id, url, reviewed_at)). Append-only (no update/delete policy except owner delete).
- Realtime enabled on problems and reviews.
- RPC `get_my_stats(tz text default 'UTC') returns jsonb`:
  { current_streak int, longest_streak int, total_reviews int, reviews_last_30d int, due_today int,
    retention_rate numeric (0..1, share of reviews with quality>=3, null if none),
    active_days: [{ day: 'YYYY-MM-DD', count int }] (last 365 days),
    patterns: [{ pattern text, problems int, reviews int, avg_quality numeric, retention numeric }],
    weakest_patterns: [ same shape, lowest retention then avg_quality, only patterns with >=2 problems, top 3 ] }
  Streak = consecutive days (in tz) with >=1 review ending today or yesterday.

## Sync algorithm (src/sync/sync.js)
1. Push: local records with `_dirty` -> upsert problems (map pattern_tag->pattern_tags, last_updated_at->client_updated_at,
   _deleted_at->deleted_at, unknown fields -> extra). Insert every review_history entry into reviews with ON CONFLICT DO NOTHING.
   Clear `_dirty` only for records whose last_updated_at is unchanged since push started.
2. Pull: problems where updated_at > cursor (chrome.storage.local `sync_cursor`), plus reviews where created_at > reviews cursor.
   Merge: last-writer-wins by client_updated_at vs local last_updated_at; deleted_at -> local tombstone.
   review_history = union of local + remote by (date, quality) sorted by date.
3. First sign-in on a device: push everything local, then pull everything.
Triggers: on save/delete (debounced 2s), chrome.alarms every 5 min, on startup, and on Realtime change events.

## Module API (other code depends on these exact names)
- src/sync/supabaseClient.js: `getSupabase()` singleton, auth storage backed by chrome.storage.local, persistSession, autoRefreshToken.
- src/sync/auth.js: `sendEmailCode(email)`, `verifyEmailCode(email, code)`, `signOut()`, `getSession()`, `onAuthChange(cb) -> unsubscribe`.
- src/sync/sync.js: `syncNow({ full?: boolean }) -> Promise<{ pushed, pulled }>`, `getSyncStatus() -> Promise<{ state: 'signed_out'|'idle'|'syncing'|'error'|'offline', lastSyncedAt: ISO|null, error: string|null, email: string|null }>`, `scheduleSync()` (debounced).
- src/sync/stats.js: `fetchStats(tz) -> Promise<Stats|null>` (null when signed out).
- Messages to background: `{ type: 'SYNC_NOW' }` -> `{ status }`, `{ type: 'GET_SYNC_STATUS' }` -> status object.
  Background broadcasts `{ type: 'SYNC_STATUS_CHANGED', status }` and `{ type: 'PROBLEMS_CHANGED' }` after a pull changes data.
