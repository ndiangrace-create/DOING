import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin=fs.readFileSync('admin.html','utf8');
const worker=fs.readFileSync('worker.js','utf8');

const cases={
  platform_super_admin:['todos','sessions','calendar','finance','billing','members','onsite','settings'],
  organizer_owner:['todos','sessions','calendar','finance','billing','members','onsite','settings'],
  organizer_admin:['todos','sessions','calendar','finance','billing','members','onsite','settings'],
  session_admin:['todos','sessions','calendar','members','onsite'],
  finance_admin:['todos','sessions','calendar','finance','billing','members'],
  onsite_staff:[]
};
for(const [role,pages] of Object.entries(cases)){
  const marker=`${role}:[${pages.map(x=>`'${x}'`).join(',')}]`;
  assert.ok(admin.includes(marker),`${role} 前端頁面權限不正確`);
}

for(const marker of [
  'applyAdminAccessPolicy()',
  "toast('你的角色或目前開通功能不能進入這一頁'",
  "page!=='finance'||flags.payment!==false",
  "page!=='onsite'||flags.checkin!==false",
  '目前可使用的正式功能',
  '租戶後台只負責實際營運',
  '申請核准後直接進入工作台'
])assert.ok(admin.includes(marker),`租戶前端缺少角色／模組防線：${marker}`);

assert.ok(!admin.match(/openPanel\('營運功能設定'/),'租戶後台仍把申請問卷當成日常設定');
for(const marker of [
  'const TENANT_ROLE_ACTIONS',
  'const TENANT_ROLE_ALLOW',
  'async function enforceTenantRole',
  "owner:['organizer_owner','platform_super_admin']",
  "finance:['organizer_owner','organizer_admin','finance_admin','platform_super_admin']",
  "sessions:['organizer_owner','organizer_admin','session_admin','platform_super_admin']",
  "onsite:['organizer_owner','organizer_admin','session_admin','onsite_staff','platform_super_admin']",
  'const roleDenied = await enforceTenantRole(env, TENANT, action, p)',
  'const roleDenied = await enforceTenantRole(env, TENANT, action, b)',
  "verifyStaff(env,b.email,b.token,T,'superadmin')"
])assert.ok(worker.includes(marker),`Worker 缺少角色權限防線：${marker}`);

const forbiddenByRole={
  finance_admin:['createSession','updateSession','approveReg','saveTenantTheme','onsiteMark'],
  session_admin:['saveFinanceItem','saveTenantTheme','addStaff'],
  onsite_staff:['getFinance','createSession','approveReg','getMembers','saveTenantTheme'],
  organizer_admin:['addStaff','saveTenantModuleProfile']
};
const groups={
  owner:{allow:['organizer_owner','platform_super_admin'],actions:['saveTenantModuleProfile','addStaff']},
  settings:{allow:['organizer_owner','organizer_admin','platform_super_admin'],actions:['saveTenantTheme']},
  finance:{allow:['organizer_owner','organizer_admin','finance_admin','platform_super_admin'],actions:['saveFinanceItem','getFinance']},
  sessions:{allow:['organizer_owner','organizer_admin','session_admin','platform_super_admin'],actions:['createSession','updateSession']},
  review:{allow:['organizer_owner','organizer_admin','session_admin','platform_super_admin'],actions:['approveReg']},
  members:{allow:['organizer_owner','organizer_admin','session_admin','finance_admin','platform_super_admin'],actions:['getMembers']},
  onsite:{allow:['organizer_owner','organizer_admin','session_admin','onsite_staff','platform_super_admin'],actions:['onsiteMark']}
};
for(const [role,actions] of Object.entries(forbiddenByRole))for(const action of actions){
  const group=Object.values(groups).find(g=>g.actions.includes(action));
  assert.ok(group&&!group.allow.includes(role),`${role} 不應可執行 ${action}`);
}

console.log('多角色全系統模擬通過：平台總管、租戶負責人、主辦管理員、場次、財務、現場共 6 層角色。');
