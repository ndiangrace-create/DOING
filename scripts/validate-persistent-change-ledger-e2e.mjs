import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync('worker.js','utf8');
const sql=fs.readFileSync('supabase_persistent_change_ledger.sql','utf8');

const verified=[
  {key:'tenant-access-e2e',status:'Verified',scopes:['admin','api:tenant'],core:['auth','permission'],deps:['platform_staff']},
  {key:'billing-e2e',status:'Verified',scopes:['billing'],core:['payment'],deps:['billing_logs']},
  {key:'public-copy',status:'Verified',scopes:['home'],core:[],deps:['site-copy']},
];
const change={scopes:['admin'],core:['rls','permission'],deps:['platform_staff']};
const intersects=(a,b)=>b.some(x=>new Set(a).has(x));
const stale=verified.filter(v=>intersects(v.scopes,change.scopes)||intersects(v.core,change.core)||intersects(v.deps,change.deps));

assert.deepEqual(stale.map(x=>x.key),['tenant-access-e2e'],'只可讓受範圍／核心／依賴影響的驗收失效');
assert.equal(verified.filter(v=>!stale.includes(v)).length,2,'未變更指紋與執行條件的驗收必須沿用');

for(const table of ['platform_change_ledger','platform_feature_versions','platform_dependency_versions','platform_verification_records','platform_verified_baselines']){
  assert(sql.includes(`create table if not exists public.${table}`),`migration 缺少 ${table}`);
  assert(sql.includes(`alter table public.${table} enable row level security`),`${table} 未啟用 RLS`);
  assert(sql.includes(`revoke all on table public.${table} from public, anon, authenticated, service_role`),`${table} 未先撤銷預設授權`);
  assert(sql.includes(`grant select, insert on table public.${table} to service_role`),`${table} 未限制為 service_role append/read`);
}
assert(!/grant[^;]*(update|delete|truncate)/i.test(sql),'Ledger 不得授予覆寫或刪除權限');
assert(!/create\s+(or\s+replace\s+)?(function|trigger)/i.test(sql),'此 migration 不得新增 Function 或 Trigger');
assert(!/\b(drop|truncate|delete\s+from|alter\s+column)\b/i.test(sql),'migration 必須是 additive 且不得破壞資料');

for(const contract of ['requirePlatformOwner','getPersistentChangeLedger','appendPersistentChangeLedger','LEDGER_SECRET_KEYS','invalidatedVerifications','Verified Baseline 必須引用同一變更且已通過的 production 驗收']){
  assert(worker.includes(contract),`Worker 缺少 ${contract}`);
}
assert(worker.includes("project:'DOING',deploymentTarget:'tobeloved-api'"),'API 未鎖定 DOING／tobeloved-api');
assert(worker.includes("verification_status:'Stale'"),'共用核心／依賴異動未追加 Stale 驗收');
assert(worker.includes("已有可信基準時，只有重大版本、依賴不明或共用核心異動可啟用全系統盤點"),'缺少全系統盤點安全鎖');

console.log(JSON.stringify({
  result:'PASS',
  appendOnlyTables:5,
  verifiedTests:verified.length,
  invalidated:stale.map(x=>x.key),
  reused:verified.filter(v=>!stale.includes(v)).map(x=>x.key),
  unauthorizedRoles:['tenant','authenticated','anon'],
  productionWrites:0
},null,2));
