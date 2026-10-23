# Manual SQL checks

Run in the Supabase SQL editor (or `psql`) after applying
`migrations/20261023000000_init.sql`. Replace the UUIDs with two real
`auth.users` ids (user A, user B). Everything is wrapped in a transaction and
rolled back.

## 1. RLS isolation between two users

```sql
begin;

-- As user A: insert a problem and a review
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<USER_A_UUID>","role":"authenticated"}', true);

insert into public.problems (url, title, pattern_tags, client_updated_at, next_review_at)
values ('https://leetcode.com/problems/two-sum/', 'Two Sum', '{hash-map,array}', now(), now());
insert into public.reviews (url, reviewed_at, quality)
values ('https://leetcode.com/problems/two-sum/', now(), 4);

select count(*) as a_problems from public.problems;   -- expect 1
select count(*) as a_reviews  from public.reviews;    -- expect 1

-- As user B: must see nothing and be unable to write as A
select set_config('request.jwt.claims', '{"sub":"<USER_B_UUID>","role":"authenticated"}', true);

select count(*) as b_problems from public.problems;   -- expect 0
select count(*) as b_reviews  from public.reviews;    -- expect 0
select count(*) as b_profiles from public.profiles where id = '<USER_A_UUID>'; -- expect 0

update public.problems set title = 'hacked';           -- expect UPDATE 0
delete from public.problems;                           -- expect DELETE 0

-- expect ERROR: new row violates row-level security policy
insert into public.problems (user_id, url, client_updated_at)
values ('<USER_A_UUID>', 'https://x.test/', now());

rollback;
```

```sql
-- Reviews are append-only: update is denied (expect UPDATE 0 / permission denied)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<USER_A_UUID>","role":"authenticated"}', true);
update public.reviews set quality = 0;
rollback;

-- anon has no access (expect permission denied)
begin;
set local role anon;
select * from public.problems;
rollback;
```

## 2. Server-set updated_at and signup profile

```sql
-- updated_at is overwritten by the trigger even if the client sends a value
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<USER_A_UUID>","role":"authenticated"}', true);
insert into public.problems (url, client_updated_at, updated_at)
values ('https://t.test/1', now(), '2000-01-01');
select updated_at > now() - interval '1 minute' as server_set   -- expect true
from public.problems where url = 'https://t.test/1';
rollback;

-- every auth user has a profile row (expect 0)
select count(*) from auth.users u
left join public.profiles p on p.id = u.id where p.id is null;
```

## 3. get_my_stats

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<USER_A_UUID>","role":"authenticated"}', true);

-- Seed: 3 problems (2 share the tag "dp"; one soft-deleted), reviews on consecutive days
insert into public.problems (url, title, pattern_tags, client_updated_at, next_review_at, deleted_at) values
  ('u1', 'P1', '{dp,array}', now(), now() - interval '1 day', null),
  ('u2', 'P2', '{dp}',       now(), now() + interval '5 days', null),
  ('u3', 'P3', '{graph}',    now(), now() - interval '1 day', now());   -- deleted: ignored
insert into public.reviews (url, reviewed_at, quality) values
  ('u1', now(),                     5),
  ('u1', now() - interval '1 day',  2),
  ('u2', now() - interval '2 days', 4),
  ('u2', now() - interval '10 days',3);   -- gap: longest_streak = 3

select jsonb_pretty(public.get_my_stats('UTC'));
-- expect: current_streak 3, longest_streak 3, total_reviews 4, reviews_last_30d 4,
--         due_today 1 (u3 is deleted), retention_rate 0.75,
--         patterns: dp (2 problems, 4 reviews), array (1 problem, 2 reviews); no "graph",
--         weakest_patterns: only dp (>= 2 problems)

select public.get_my_stats('Not/AZone')->>'current_streak';   -- falls back to UTC, no error
select public.get_my_stats('Asia/Kolkata')->'active_days';    -- days bucketed in that tz

-- Isolation: user B sees an empty result (arrays, not null)
select set_config('request.jwt.claims', '{"sub":"<USER_B_UUID>","role":"authenticated"}', true);
select public.get_my_stats('UTC');
-- expect: zero counts, retention_rate null, active_days/patterns/weakest_patterns = []

rollback;
```
