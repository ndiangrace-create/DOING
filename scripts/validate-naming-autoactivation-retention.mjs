import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const names=JSON.parse(read('doing-naming-ssot.json'));
const world=JSON.parse(read('doing-operational-world-tree.json'));
const member=read('member-panel.html');
const helper=read('doing-smart-activation.js');
const smartPage=read('smart-application.html');
const statusUi=read('doing-auto-activation-status.js');
const migration=read('supabase_auto_activation_retention_v20.sql');
const cron=read('supabase_retention_cron_v20.sql');
const worker=read('worker.js');

const reg=names.contracts.find(x=>x.key==='my-registrations');
assert.ok(reg,'名稱 SSOT 缺少 my-registrations');
assert.equal(reg.userFacingName,'我的報名');
assert.equal(reg.primaryApi,'getMyRegsGlobal');
assert.equal(reg.primaryHandler,'hGetMyRegsGlobal');
assert.equal(reg.primaryTable,'registrations');
assert.match(member,/>我的報名</);
assert.doesNotMatch(member,/>我的紀錄</);
assert.match(worker,/「我的報名」跨主辦查詢/,'正式會員報名 API 必須以「我的報名」為名稱');
assert.match(worker,/async function hGetMyRegsGlobal/,'我的報名不得另開第二套主資料 API');
for(const phrase of ['我的紀錄'])assert.doesNotMatch(helper,new RegExp(phrase),'智慧申請／客服不得使用舊名稱 '+phrase);

assert.match(migration,/doing_auto_activate_workspace/);
assert.match(migration,/after update of status on public\.tenant_apply_logs/);
assert.match(migration,/status='approved'/);
assert.match(migration,/approved_by='system:auto'/);
assert.match(migration,/platform_risk_cases/);
assert.match(migration,/module_flags_json/);
assert.match(migration,/tenant_settings/);
assert.match(migration,/billing_entity_tenants/);
assert.match(migration,/doing_single_owned_workspace_guard|organizer_owner/);
assert.match(statusUi,/一般申請不需要等待人工審核/);
assert.match(smartPage,/doing-auto-activation-status\.js/);

assert.match(migration,/interval '90 days'/);
assert.match(migration,/tenant_id is null/);
assert.match(migration,/registration_id is null/);
assert.match(migration,/formalBusinessDataDeleted',0/);
for(const formal of ['registrations','payments','refunds','tenants','staff'])assert.match(migration,new RegExp(formal));
assert.match(cron,/pg_cron/);
assert.match(cron,/doing-transient-cleanup-daily/);
assert.match(cron,/doing_cleanup_transient_data\(1000\)/);
assert.match(migration,/drop index if exists public\.idx_tenant_apply_logs_status_created_v2/,'重複索引必須合併');
assert.match(migration,/idx_platform_attribution_events_occurred_anonymous/);
for(const fn of ['doing_auto_activate_workspace()','doing_cleanup_transient_data(integer)']){
  assert.ok(migration.includes(`revoke all on function public.${fn} from public, anon, authenticated`));
  assert.ok(migration.includes(`grant execute on function public.${fn} to service_role`));
}
assert.match(migration,/doing_naming_contract/);
assert.match(migration,/doing_data_retention_policy/);
assert.match(migration,/doing_workspace_activation_policy/);

const flow=world.journeys?.find(x=>x.id==='smart-application');
assert.ok(flow,'營運世界樹缺少營運申請主流程');
assert.ok(flow.steps.some(x=>x.id==='line-verification'));
assert.ok(flow.steps.some(x=>x.id==='provisioning'&&/自動/.test(x.label+x.completion)),'營運世界樹仍未標記自動開通');
assert.ok(!flow.steps.some(x=>x.label==='平台審核'),'平台審核不可再是一般申請必經節點');
assert.equal(world.namingSSOT?.myRegistrations,'我的報名');
assert.equal(world.retentionPolicy?.transientDays,90);
assert.equal(world.retentionPolicy?.formalBusinessDataPreserved,true);

console.log(JSON.stringify({result:'PASS',canonicalRegistrationName:'我的報名',primaryTable:'registrations',autoActivation:'line_verified_then_workspace',manualReview:'exceptions_only',transientRetentionDays:90,formalBusinessDataPreserved:true,dailyCleanup:true},null,2));
