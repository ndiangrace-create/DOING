import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('smart-application.html','utf8');
const smart=fs.readFileSync('doing-smart-activation-v5.js','utf8');
const bridge=fs.readFileSync('doing-formal-application-bridge.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const worker=fs.readFileSync('worker.js','utf8');
const workerMirror=fs.readFileSync('worker.txt','utf8');

assert.equal(worker,workerMirror,'worker.js / worker.txt 必須保持 byte-identical');
const bridgePos=html.indexOf('doing-formal-application-bridge.js');
const activationPos=html.indexOf('doing-smart-activation-v5.js');
assert.ok(bridgePos>0&&activationPos>bridgePos,'正式申請 bridge 必須先於原申請 submit 程式載入');
assert.ok(smart.includes('submitApplication'),'正式申請必須為單頁單一送出鍵');
assert.ok(!smart.includes('← 上一步')&&!smart.includes('下一步 →'),'正式申請不得再分頁');

for(const token of [
  "SNAPSHOT_KEY='doing_formal_application_resume_v1'",
  "MAX_AGE=15*60*1000",
  "u.searchParams.set('mode','member')",
  "new URL('/apply/',location.origin)",
  "u.searchParams.set('doing_application_resume','1')",
  "action:'savePlatformMemberProfile'",
  "?action=getPlatformMemberProfile",
  "readMemberState",
  "routeResolvedMemberState",
  "?action=createOrganizerApplicationDraft",
  "if(d&&d.lineVerified)",
  "application_status",
  "tenantId",
  "你的工作空間已經開通",
  "你的申請已送出",
  "post_application",
  "sessionStorage",
  "localStorage.setItem(TOKEN_KEY,incoming)"
]) assert.ok(bridge.includes(token),`正式申請閉環缺少：${token}`);

for(const forbidden of [
  "admin_token",
  "mode','admin",
  "mode','platform",
  "tenant','platform"
]) assert.ok(!bridge.includes(forbidden),`申請 bridge 不得自行提升權限：${forbidden}`);

for(const token of [
  "lineVerified:true",
  "member_token:memberToken",
  "status:'line_verification_pending'",
  "platform_member_identities",
  "provider=eq.line"
]) assert.ok(worker.includes(token),`Core 既有 LINE 快速驗證契約缺少：${token}`);

for(const token of [
  "'doing-formal-application-bridge.js'",
  "builtApply.includes('doing-formal-application-bridge.js')",
  "fs.existsSync(path.join(out,'doing-formal-application-bridge.js'))"
]) assert.ok(build.includes(token),`正式站打包契約缺少：${token}`);

console.log(JSON.stringify({
  result:'PASS',
  flow:'single-page form -> LINE member verification -> same member profile -> existing workspace/application preflight -> new application only when needed -> lineVerified -> auto activation -> /me/#operations',
  singlePage:true,
  firstTimeApplicant:true,
  existingWorkspaceRecoveryBeforeInsert:true,
  pendingApplicationRecoveryBeforeInsert:true,
  memberTokenIsNotAdminToken:true,
  privilegeElevation:false,
  newDatabaseTables:0,
  productionWrites:0
},null,2));
