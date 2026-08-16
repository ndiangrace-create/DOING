-- Keep tenant-selected brand themes as JSON objects, never double-encoded JSON strings.
update public.tenant_settings
set theme_json = case
  when jsonb_typeof(theme_json) = 'string' then (theme_json #>> '{}')::jsonb
  when coalesce(theme_json->>'key', '') = '' then jsonb_build_object('key', 'cute_pastel', 'updatedAt', now())
  else theme_json
end,
updated_at = now()
where jsonb_typeof(theme_json) = 'string'
   or coalesce(theme_json->>'key', '') = '';
