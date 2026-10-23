-- Weekly recap schedule: Monday 14:00 UTC -> edge function `weekly-recap`.
-- PREREQUISITE (manual, one-time): create the Vault secret used for the x-cron-secret header,
-- with the SAME value as the edge-function secret CRON_SECRET:
--   select vault.create_secret('<your-random-secret>', 'cron_secret');
-- No secret is stored in this file. Until the vault secret exists, the job sends an
-- empty header and the function answers 401 (harmless).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'weekly-recap',
  '0 14 * * 1',
  $job$
  select net.http_post(
    url := 'https://xqzgcvayyzuvbtlcgibe.supabase.co/functions/v1/weekly-recap',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
