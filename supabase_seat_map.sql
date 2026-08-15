begin;

alter table public.stalls
  add column if not exists map_rotation numeric not null default 0;

comment on column public.stalls.map_rotation is
  'DOING 場地圖桌位旋轉角度（0–359 度），由已驗證的主辦後台經 Worker 寫入。';

commit;
