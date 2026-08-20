-- DOING V20｜每日暫存資料清理排程
-- pg_cron 在此 Supabase 專案可用但目前未安裝；發布 migration 時一併啟用。
create extension if not exists pg_cron with schema extensions;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='doing-transient-cleanup-daily' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'doing-transient-cleanup-daily',
    '17 3 * * *',
    'select public.doing_cleanup_transient_data(1000);'
  );
end $$;
