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
