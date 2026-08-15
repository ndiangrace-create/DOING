-- DOING 的瀏覽器只連 Cloudflare Worker；資料庫 RPC 僅允許 Worker 使用的 service_role。
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- 固定函式搜尋路徑，避免同名物件被置換。
alter function public.billing_norm_person_id(text) set search_path = public;
alter function public.billing_norm_tax_id(text) set search_path = public;
alter function public.billing_session_end_at(jsonb) set search_path = public;
alter function public.claim_timeslot_capacity(text,text,integer) set search_path = public;
alter function public.create_bundle_registrations_atomic(text,text,jsonb) set search_path = public;
alter function public.purge_error_logs(integer) set search_path = public;
alter function public.release_timeslot_capacity(text,text,integer) set search_path = public;
alter function public.short_link_hit(text) set search_path = public;
alter function public.touch_support_thread_from_message() set search_path = public;
