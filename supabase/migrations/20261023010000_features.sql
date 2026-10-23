-- AlgoRecall feature wave 2 (see docs/features-contract.md, "Database additions").
-- Applied via MCP in logical chunks; semantics identical to this file.

-- ---------------------------------------------------------------------------
-- 1. profiles: new columns
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists is_public boolean not null default false;
alter table public.profiles add column if not exists weekly_recap boolean not null default false;
alter table public.profiles add column if not exists email text;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles
      add constraint profiles_username_format check (username ~ '^[a-z0-9_-]{3,30}$');
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'profiles_username_key') then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;
end
$$;

-- Column-level update grants: clients may not write profiles.email (spam vector
-- for recap emails) or id/created_at. Table-level UPDATE is replaced.
revoke update on public.profiles from authenticated;
grant update (display_name, timezone, username, is_public, weekly_recap)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. hint_usage (daily cap counter; written only by the edge function / service role)
-- ---------------------------------------------------------------------------

create table if not exists public.hint_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.hint_usage enable row level security;
revoke all on public.hint_usage from anon, public, authenticated;
grant select on public.hint_usage to authenticated;

drop policy if exists "hint_usage_select_own" on public.hint_usage;
create policy "hint_usage_select_own" on public.hint_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 3. Internal stats helper (reused by get_public_profile). get_my_stats is unchanged.
-- ---------------------------------------------------------------------------

create or replace function public._stats_for(p_uid uuid, tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid           uuid := p_uid;
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



revoke all on function public._stats_for(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Profile RPCs
-- ---------------------------------------------------------------------------

-- p_username: null = keep current, '' = clear. p_is_public / p_weekly_recap: null = keep.
create or replace function public.set_profile(p_username text, p_is_public boolean, p_weekly_recap boolean)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text;
  v_cur  text;
  v_pub  boolean;
begin
  if v_uid is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select p.username, p.is_public into v_cur, v_pub
  from public.profiles p where p.id = v_uid;

  if p_username is null then
    v_name := v_cur;
  else
    v_name := nullif(pg_catalog.lower(pg_catalog.btrim(p_username)), '');
  end if;

  if v_name is not null and v_name !~ '^[a-z0-9_-]{3,30}$' then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_username');
  end if;
  if coalesce(p_is_public, v_pub, false) and v_name is null then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'invalid_username');
  end if;

  begin
    update public.profiles p
    set username = v_name,
        is_public = coalesce(p_is_public, p.is_public),
        weekly_recap = coalesce(p_weekly_recap, p.weekly_recap)
    where p.id = v_uid;
  exception when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'error', 'username_taken');
  end;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'username', p.username,
    'is_public', p.is_public,
    'weekly_recap', p.weekly_recap,
    'display_name', p.display_name)
  from public.profiles p
  where p.id = (select auth.uid());
$$;

-- The ONLY anon path to profile data. SECURITY DEFINER; explicitly filters is_public;
-- returns no code / notes / urls / email / problem titles.
create or replace function public.get_public_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_p public.profiles%rowtype;
begin
  select * into v_p
  from public.profiles p
  where p.username = pg_catalog.lower(pg_catalog.btrim(p_username))
    and p.is_public = true;
  if not found then
    return null;
  end if;
  return pg_catalog.jsonb_build_object(
    'username', v_p.username,
    'display_name', v_p.display_name,
    'member_since', v_p.created_at,
    'stats', public._stats_for(v_p.id, 'UTC')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------

revoke all on function public.set_profile(text, boolean, boolean) from public, anon;
grant execute on function public.set_profile(text, boolean, boolean) to authenticated;
revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Signup trigger function: also copy email; backfill existing rows
-- (trigger on_auth_user_created already points at this function)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(pg_catalog.split_part(coalesce(new.email, ''), '@', 1), '')
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null and u.email is not null;
