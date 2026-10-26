-- Gọi /api/cron/nag mỗi 30 phút từ chính Supabase (pg_cron + pg_net).
-- Dùng cách này nếu deploy Vercel gói Hobby (Vercel Cron gói free chỉ chạy 1 lần/ngày).
-- Chạy 1 lần trong SQL Editor sau khi thay <APP_URL> và <CRON_SECRET>.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'nag-every-30m',
  '*/30 * * * *',
  $$
  select net.http_get(
    url     := '<APP_URL>/api/cron/nag',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);
-- Gỡ: select cron.unschedule('nag-every-30m');
