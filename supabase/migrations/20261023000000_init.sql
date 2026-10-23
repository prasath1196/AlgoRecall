-- AlgoRecall cloud sync: initial schema (see docs/sync-contract.md, "Database").
-- Postgres 17 / Supabase. Safe to re-run where reasonable.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone     text not null default 'UTC',
  created_at   timestamptz not null default now()
);

create table if not exists public.problems (
  user_id           uuid not null default auth.uid()
                      references auth.users (id) on delete cascade,
  url               text not null,
  title             text,
  platform          text,
  difficulty        text,            -- free text ('Easy' | 'Medium' | 'Hard' | ...)
  pattern_tags      text[] not null default '{}',
  code              text,
  language          text,
  description       text,
  notes             text,
  "interval"        integer not null default 0,
  repetition_count  integer not null default 0,
  ease_factor       real not null default 2.5,
  next_review_at    timestamptz,
  created_at        timestamptz not null default now(),
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),  -- server-set by trigger
  deleted_at        timestamptz,
  extra             jsonb not null default '{}'::jsonb,
  primary key (user_id, url)
);

create table if not exists public.reviews (
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  url         text not null,
  reviewed_at timestamptz not null,
  quality     smallint not null check (quality between 0 and 5),
  created_at  timestamptz not null default now(),
  primary key (user_id, url, reviewed_at)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists problems_user_updated_at_idx
  on public.problems (user_id, updated_at);

create index if not exists problems_user_next_review_at_idx
  on public.problems (user_id, next_review_at)
  where deleted_at is null;

create index if not exists reviews_user_created_at_idx
  on public.reviews (user_id, created_at);

create index if not exists reviews_user_reviewed_at_idx
  on public.reviews (user_id, reviewed_at);

-- ---------------------------------------------------------------------------
-- Server-set updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

-- NOTE: "create or replace trigger" (PG14+) instead of drop+create: the
-- "drop trigger if exists ...; create trigger ..." form timed out through the
-- Supabase MCP apply_migration tool (see supabase/APPLY_NOTES.md).
create or replace trigger problems_set_updated_at
  before insert or update on public.problems
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Signup trigger: create profile row
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(pg_catalog.split_part(coalesce(new.email, ''), '@', 1), '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.problems enable row level security;
alter table public.reviews  enable row level security;

revoke all on public.profiles from anon, public;
revoke all on public.problems from anon, public;
revoke all on public.reviews  from anon, public;

revoke all on public.profiles from authenticated;
revoke all on public.problems from authenticated;
revoke all on public.reviews  from authenticated;

grant select, update                 on public.profiles to authenticated;
grant select, insert, update, delete on public.problems to authenticated;
grant select, insert, delete         on public.reviews  to authenticated;

-- profiles: select / update own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- problems: select / insert / update / delete own rows
drop policy if exists "problems_select_own" on public.problems;
create policy "problems_select_own" on public.problems
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "problems_insert_own" on public.problems;
create policy "problems_insert_own" on public.problems
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "problems_update_own" on public.problems;
create policy "problems_update_own" on public.problems
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "problems_delete_own" on public.problems;
create policy "problems_delete_own" on public.problems
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- reviews: select / insert / delete own rows (append-only: no update)
drop policy if exists "reviews_select_own" on public.reviews;
create policy "reviews_select_own" on public.reviews
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own" on public.reviews
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'problems'
    ) then
      alter publication supabase_realtime add table public.problems;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reviews'
    ) then
      alter publication supabase_realtime add table public.reviews;
    end if;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_my_stats(tz)
-- ---------------------------------------------------------------------------

create or replace function public.get_my_stats(tz text default 'UTC')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid           uuid := auth.uid();
  v_tz            text;
  v_today         date;
  v_day_end       timestamptz;
  v_current       integer := 0;
  v_longest       integer := 0;
  v_total         integer := 0;
  v_last30        integer := 0;
  v_due           integer := 0;
  v_retention     numeric;
  v_active_days   jsonb;
  v_patterns      jsonb;
  v_weakest       jsonb;
begin
  -- Validate the time zone name, fall back to UTC.
  select n.name into v_tz
  from pg_catalog.pg_timezone_names n
  where n.name = tz
  limit 1;
  v_tz := coalesce(v_tz, 'UTC');

  v_today   := (pg_catalog.now() at time zone v_tz)::date;
  -- Start of tomorrow in tz (exclusive end of today).
  v_day_end := ((v_today + 1)::timestamp) at time zone v_tz;

  -- Totals
  select
    pg_catalog.count(*)::integer,
    (pg_catalog.count(*) filter (where r.reviewed_at >= pg_catalog.now() - interval '30 days'))::integer,
    pg_catalog.round(
      pg_catalog.avg(case when r.quality >= 3 then 1.0 else 0.0 end), 4)
  into v_total, v_last30, v_retention
  from public.reviews r
  where r.user_id = v_uid;

  -- Due today
  select pg_catalog.count(*)::integer into v_due
  from public.problems p
  where p.user_id = v_uid
    and p.deleted_at is null
    and p.next_review_at is not null
    and p.next_review_at < v_day_end;

  -- Streaks (gaps and islands over distinct review days in tz)
  with days as (
    select distinct (r.reviewed_at at time zone v_tz)::date as day
    from public.reviews r
    where r.user_id = v_uid
  ),
  numbered as (
    select d.day,
           d.day - (pg_catalog.row_number() over (order by d.day))::integer as grp
    from days d
  ),
  islands as (
    select pg_catalog.count(*)::integer as len,
           pg_catalog.max(n.day) as last_day
    from numbered n
    group by n.grp
  )
  select
    coalesce(pg_catalog.max(i.len), 0),
    coalesce(pg_catalog.max(i.len) filter (where i.last_day >= v_today - 1), 0)
  into v_longest, v_current
  from islands i;

  -- Active days (last 365 days, including today)
  select coalesce(
           pg_catalog.jsonb_agg(
             pg_catalog.jsonb_build_object('day', a.day, 'count', a.cnt)
             order by a.day),
           '[]'::jsonb)
  into v_active_days
  from (
    select pg_catalog.to_char((r.reviewed_at at time zone v_tz)::date, 'YYYY-MM-DD') as day,
           pg_catalog.count(*)::integer as cnt
    from public.reviews r
    where r.user_id = v_uid
      and (r.reviewed_at at time zone v_tz)::date > v_today - 365
      and (r.reviewed_at at time zone v_tz)::date <= v_today
    group by 1
  ) a;

  -- Per-pattern stats (non-deleted problems only)
  with ps as (
    select
      t.pattern,
      pg_catalog.count(distinct p.url)::integer as problems,
      pg_catalog.count(r.reviewed_at)::integer as reviews,
      pg_catalog.round(pg_catalog.avg(r.quality::numeric), 2) as avg_quality,
      pg_catalog.round(
        pg_catalog.avg(case when r.quality >= 3 then 1.0
                            when r.quality is not null then 0.0 end), 4) as retention
    from public.problems p
    cross join lateral (
      select distinct x as pattern from pg_catalog.unnest(p.pattern_tags) as x
    ) t
    left join public.reviews r
      on r.user_id = p.user_id and r.url = p.url
    where p.user_id = v_uid
      and p.deleted_at is null
    group by t.pattern
  ),
  weak as (
    select s.*
    from ps s
    where s.problems >= 2
    order by s.retention asc nulls last, s.avg_quality asc nulls last, s.pattern
    limit 3
  )
  select
    coalesce((
      select pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'pattern', s.pattern, 'problems', s.problems, 'reviews', s.reviews,
                 'avg_quality', s.avg_quality, 'retention', s.retention)
               order by s.reviews desc, s.pattern)
      from ps s), '[]'::jsonb),
    coalesce((
      select pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'pattern', w.pattern, 'problems', w.problems, 'reviews', w.reviews,
                 'avg_quality', w.avg_quality, 'retention', w.retention)
               order by w.retention asc nulls last, w.avg_quality asc nulls last, w.pattern)
      from weak w), '[]'::jsonb)
  into v_patterns, v_weakest;

  return pg_catalog.jsonb_build_object(
    'current_streak',  v_current,
    'longest_streak',  v_longest,
    'total_reviews',   v_total,
    'reviews_last_30d', v_last30,
    'due_today',       v_due,
    'retention_rate',  v_retention,
    'active_days',     v_active_days,
    'patterns',        v_patterns,
    'weakest_patterns', v_weakest
  );
end;
$$;

revoke all on function public.get_my_stats(text) from public, anon;
grant execute on function public.get_my_stats(text) to authenticated;
