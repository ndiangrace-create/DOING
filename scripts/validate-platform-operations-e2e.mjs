import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync('worker.js','utf8');
const platform=fs.readFileSync('platform.html','utf8');
const admin=fs.readFileSync('admin.html','utf8');

const tenants=[{id:'tenant-a',name:'日光工作室',is_locked:false},{id:'tenant-b',name:'山角市集',is_locked:true,locked_reason:'付款逾期'}];
const sessions=[{id:'session-a',tenant_id:'tenant-a',name:'親子手作',status:'開放',venue:'',dates_json:[]},{id:'session-b',tenant_id:'tenant-b',name:'週末市集',status:'開放',venue:'中央廣場',dates_json:[{date:'2026-09-01'}]}];
const registrations=[{id:'reg-a',tenant_id:'tenant-a',session_id:'session-a',payment_status:'待確認',amount:0,payment_method:''}];

const detected=[];
const add=(source_key,tenant_id,session_id='',registration_id='')=>detected.push({source_key,tenant_id,session_id,registration_id,status:'open'});
for(const t of tenants)if(t.is_locked)add(`tenant_locked|${t.id}`,t.id);
for(const s of sessions){if(!s.venue)add(`session_venue|${s.id}`,s.tenant_id,s.id);if(!JSON.parse(JSON.stringify(s.dates_json)).length)add(`session_dates|${s.id}`,s.tenant_id,s.id)}
for(const r of registrations)if(r.payment_status==='待確認'&&Number(r.amount)<=0)add(`finance|${r.id}|付款待確認但金額為 0 或缺失`,r.tenant_id,r.session_id,r.id);

assert.equal(new Set(detected.map(x=>x.source_key)).size,detected.length,'問題來源鍵不可重複');
assert.equal(detected.filter(x=>x.tenant_id==='tenant-a').length,3,'租戶問題數彙整錯誤');
assert(detected.some(x=>x.registration_id==='reg-a'),'訂單／預約問題沒有保留 registrationId');

const target=new URL('https://example.test/admin.html');
target.searchParams.set('tenant','tenant-a');target.searchParams.set('from','platform');target.searchParams.set('platform_issue','issue-a');target.searchParams.set('issue_session','session-a');target.searchParams.set('issue_registration','reg-a');target.hash='finance';
assert.equal(target.searchParams.get('issue_session'),'session-a');
assert.equal(target.searchParams.get('issue_registration'),'reg-a');
assert.equal(target.hash,'#finance');

for(const contract of ['platform_issue_records','getPlatformOperationsCenter','updatePlatformIssueStatus','platformEnterTenant'])assert(worker.includes(contract),`Worker 缺少 ${contract}`);
for(const contract of ['openPlatformIssueTarget','markPlatformIssueResolved',"window.open('about:blank','_blank')"])assert(platform.includes(contract),`平台頁缺少 ${contract}`);
for(const contract of ['openPlatformIssueDeepLink','openSessionList','openRegDetail','returnFromAdmin'])assert(admin.includes(contract),`租戶後台缺少 ${contract}`);
assert(worker.includes("status:'resolved',resolved_at:now,resolved_by:'system:auto'"),'來源恢復正常時沒有自動完成問題');
assert(worker.includes("'update_platform_issue_status'"),'人工處理問題沒有稽核紀錄');

console.log(JSON.stringify({result:'PASS',tenants:tenants.length,detectedIssues:detected.length,directTarget:'tenant/session/registration',keepsPlatformPage:true,productionWrites:0},null,2));
