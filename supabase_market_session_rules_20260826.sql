-- DOING Market session rules parity with current 2BL operating contract.
-- Additive only: existing sessions/registrations remain untouched.
alter table public.sessions add column if not exists type text;
alter table public.sessions add column if not exists portals_json jsonb not null default '[]'::jsonb;
alter table public.sessions add column if not exists registration_schedule_json jsonb not null default '{}'::jsonb;
alter table public.sessions add column if not exists multi_day_tiers_json jsonb not null default '[]'::jsonb;

comment on column public.sessions.type is 'Market entry/category type used with portals_json';
comment on column public.sessions.portals_json is 'Public entry categories/portals for this session';
comment on column public.sessions.registration_schedule_json is 'Up to three formal registration open/close phases based on Asia/Taipei and first activity date';
comment on column public.sessions.multi_day_tiers_json is 'Multi-day per-stall-per-day price tiers; equipment/deposit excluded from discount';
