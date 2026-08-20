import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=name=>fs.readFileSync(name,'utf8');
const worker=read('worker.js');
const workerMirror=read('worker.txt');
const admin=read('admin.html');
const member=read('member-panel.html');
const register=read('register.html');
const workspace=read('workspace.html');
const workspaceGuard=read('supabase_workspace_v20_guard.sql');
const tree=JSON.parse(read('doing-world-tree-v20.json'));

assert.equal(worker,workerMirror,'Worker 正式鏡像未同步');
assert.ok(admin.includes('id="bookingRosterList"')&&admin.includes('function renderBookingRoster()'),'租戶後台缺少可直接操作的正式預約表');
assert.ok(admin.includes('registrations＋timeslots＋booking_calendars'),'預約表必須清楚沿用同一份正式資料');
assert.ok(register.includes('getAvailableStartsPublic')&&register.includes('selectDynamicBookingSlot'),'顧客預約表沒有接上正式空檔計算');
assert.ok(worker.includes("case 'getBookingCalendarAdmin'")&&worker.includes("case 'getAvailableStartsPublic'"),'預約月曆與顧客空檔 API 不完整');
assert.ok(worker.includes("provider=eq.line")&&worker.includes('lineAlreadyLinked:true')&&worker.includes('memberEmail===contactEmail'),'已綁定 LINE 的正式會員仍可能在重新申請時卡住');
assert.ok(read('doing-smart-activation.js').includes("localStorage.getItem('doing_member_token')")&&read('doing-smart-activation.js').includes('if(d.lineVerified)'),'智慧申請沒有沿用已驗證會員身分');

for(const marker of [
  'TENANT_PORTABLE_TABLES',
  "case 'exportTenantData'",
  "owner: new Set(['saveTenantModuleProfile','exportTenantData'",
  'platformApprovalRequired:false',
  'availableWhenLocked:true',
  "'booking_calendars'",
  "'availability_rules'",
  "'registrations'",
  "'payments'",
  "'refunds'",
  "'audit_logs'"
])assert.ok(worker.includes(marker),'租戶完整資料下載缺少契約：'+marker);
assert.ok(!worker.includes("帳號已鎖定，無法下載資料，請先續費"),'帳號鎖定不得阻止租戶取回自己的資料');
assert.ok(admin.includes('下載我的全部營運資料')&&admin.includes("action:'exportTenantData'"),'租戶後台缺少一鍵完整資料下載');

assert.ok(member.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),'會員總覽桌機版必須一行三格');
assert.ok(member.includes('member-operational-layout-v20')&&member.includes('background-image:none!important'),'會員總覽仍可能出現粉紅漸層');
assert.ok(member.includes('overflow-wrap:anywhere')&&member.includes('.actions .btn{white-space:normal'),'會員總覽缺少文字不破框保護');
assert.ok(!member.includes('<div class="wide grid"><article class="card">'),'會員總覽仍使用造成錯排的巢狀兩欄');

for(const file of ['admin.html','member-panel.html','workspace.html','register.html','worker.js']){
  assert.ok(!read(file).includes('我的紀錄'),file+' 仍顯示舊正式名稱「我的紀錄」');
}
assert.equal(tree.moduleArchitecture?.model,'shared_core_with_pluggable_work_modes','世界樹缺少插件式共用核心契約');
assert.equal(tree.moduleArchitecture?.noDuplicateRoot,true,'模組不得建立第二套資料根');
assert.equal(tree.dataPortability?.ownerSelfService,true,'世界樹缺少租戶資料可攜權');
assert.equal(tree.dataPortability?.availableWhenTenantLocked,true,'鎖定帳號仍須允許資料下載');
assert.ok(workspace.includes('getTenantModuleProfile')&&workspace.includes('approvedFlags'),'工作平台沒有依正式模組核准資料載入');
for(const fn of ['doing_guard_single_owned_workspace','doing_guard_workspace_application'])assert.ok(workspaceGuard.includes(`revoke all on function public.${fn}() from public, anon, authenticated`),'SECURITY DEFINER trigger 函式不可對外提供 RPC：'+fn);

console.log(JSON.stringify({
  result:'PASS',
  moduleArchitecture:'shared_core_with_pluggable_work_modes',
  bookingCalendar:'calendar_and_roster_same_ssot',
  tenantDataExport:'owner_self_service_even_when_locked',
  memberOverview:'desktop_three_columns_and_no_text_overflow',
  canonicalRegistrationName:'我的報名',
  productionWrites:0
},null,2));
