# Applying the init schema via Supabase MCP (project xqzgcvayyzuvbtlcgibe)

## Root cause of the apply_migration timeouts
- The `''` (empty string literal) hypothesis is REFUTED. `select ''`, `comment on table public.profiles is ''`
  (apply_migration `probe_comment_empty`) and `set search_path = ''` functions all work, via both execute_sql
  and apply_migration (`init_updated_at_function`, `init_new_user_function`, `init_get_my_stats`).
- The one reproducible hang in this session: apply_migration with `drop trigger if exists problems_set_updated_at on public.problems;
  create trigger ...` timed out at 60s and rolled back (no trigger, no migration row, no active/blocked sessions afterwards).
  The same `create trigger` via execute_sql ran instantly, and `create or replace trigger ...` via apply_migration succeeded.
  Cause not conclusively identified (appears to be the drop+create trigger form in the MCP/migration path, or intermittent
  tool/proxy flakiness: the earlier function-only timeouts did not reproduce). Workaround: `create or replace trigger`, one
  logical object per migration.
- Triggers on auth.users do NOT hang (`init_new_user_trigger` succeeded).
- Logs were not queried (query_logs not needed once state was verified).

## Applied migrations (in order)
init_tables; init_rls_policies (incl. realtime publication for problems, reviews); probe_fn (bare set_updated_at);
probe_comment_nonempty / probe_comment_empty (diagnostic only, harmless; profiles comment is now unset);
init_updated_at_function (set_updated_at with `set search_path = ''`); init_updated_at_trigger (problems_set_updated_at);
init_new_user_function (handle_new_user, security definer, `set search_path = ''`); init_new_user_revoke;
init_new_user_trigger (on_auth_user_created on auth.users); init_get_my_stats; init_get_my_stats_grants.
Note: one extra identical `create or replace function set_updated_at` was run via execute_sql (no migration row) before
init_updated_at_function recorded it.

## Verification
- get_my_stats() as authenticated (sub 0000...): zeros, `retention_rate` null, empty `patterns`/`active_days`/`weakest_patterns`.
- Triggers enabled: problems_set_updated_at (BEFORE INSERT OR UPDATE, row), on_auth_user_created (AFTER INSERT, row).
- Functions have `search_path=""`; handle_new_user is security definer, no execute for anon/authenticated;
  get_my_stats executable by authenticated only.
- Security advisors: none. Performance advisors: INFO unused_index on problems_user_updated_at_idx and
  reviews_user_created_at_idx (expected on an empty DB; they serve the sync contract's incremental pull): 
  https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

## Docs consulted (search_docs)
- Database Advisor lint 0011_function_search_path_mutable - recommends `set search_path = ''` with fully qualified references:
  https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0011_function_search_path_mutable
- Users / managing user data (profiles trigger on auth.users, security definer, `set search_path = ''`):
  https://supabase.com/docs/guides/auth/users
- Subscribing to Database Changes / Postgres Changes / Realtime Postgres Changes Troubleshooting (table must be in the
  supabase_realtime publication; RLS applies):
  https://supabase.com/docs/guides/realtime/subscribing-to-database-changes ,
  https://supabase.com/docs/guides/realtime/postgres-changes ,
  https://supabase.com/docs/guides/troubleshooting/realtime-postgres-changes-troubleshooting
- Supabase MCP Server (tool list; no documented apply_migration timeout limits): https://supabase.com/docs/guides/ai-tools/mcp

# Wave 2 (features) - applied to xqzgcvayyzuvbtlcgibe

## Migrations applied (MCP), in order
features_profile_columns (username/is_public/weekly_recap/email); features_profile_constraints (username format check + unique);
features_profile_grants (column-level UPDATE grant on profiles: display_name, timezone, username, is_public, weekly_recap; `email` is NOT client-writable);
features_hint_usage (table + RLS select-own, no client writes); features_stats_for (`public._stats_for(uuid, tz)`, security definer, execute revoked from public/anon/authenticated; service_role keeps it);
features_set_profile (set_profile + get_my_profile); features_get_public_profile; features_grants; features_new_user_email (handle_new_user copies email + backfill);
weekly_cron_extensions (pg_cron, pg_net); weekly_cron_schedule (job `weekly-recap`, `0 14 * * 1`).
- The first attempt, one combined apply_migration with columns+constraints+grants+table, timed out at 60s and rolled back fully (verified with execute_sql); splitting into small chunks worked.
- Repo files: `migrations/20261023010000_features.sql` and `migrations/20261023020000_weekly_cron.sql` mirror what was applied (semantically identical, but combined into single files).
- set_profile semantics: `p_username` null = keep, '' = clear; null booleans = keep; is_public=true requires a username (`invalid_username`).

## Edge functions
- `weekly-recap` deployed (verify_jwt=false, x-cron-secret vs CRON_SECRET): https://xqzgcvayyzuvbtlcgibe.supabase.co/functions/v1/weekly-recap
  Uses Brevo template when BREVO_RECAP_TEMPLATE_ID is set (params per docs/brevo-templates.md), else inline HTML (needs RECAP_SENDER_EMAIL).
- `hint`: NOT written or deployed (decision: no AI features for now). `hint_usage` table kept. No ANTHROPIC_API_KEY requested.

## Manual steps for the owner
1. Edge function secrets (Dashboard > Edge Functions > Secrets): BREVO_API_KEY, CRON_SECRET (random string), BREVO_RECAP_TEMPLATE_ID=1, RECAP_SENDER_EMAIL=prasath1196@gmail.com (only used by fallback).
   The create_edge_function_secret MCP calls timed out waiting for dashboard entry; they may still be pending.
2. Vault secret with the SAME value as CRON_SECRET (SQL editor): `select vault.create_secret('<same value>', 'cron_secret');`
   Until it exists the weekly job sends an empty header and gets 401.
3. Test: `curl -X POST -H "x-cron-secret: <value>" https://xqzgcvayyzuvbtlcgibe.supabase.co/functions/v1/weekly-recap`

## Verification / advisors
- get_public_profile('nobody') as anon in a rolled-back txn -> null. _stats_for not executable by anon/authenticated.
- Security advisors: WARN anon/authenticated_security_definer_function_executable on get_public_profile (intentional: the only anon path);
  WARN auth_leaked_password_protection (pre-existing dashboard setting, not ours). Performance: only the 2 INFO unused_index from wave 1.
