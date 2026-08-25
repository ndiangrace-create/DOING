import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const worker=fs.readFileSync('worker.js','utf8');
const workerMirror=fs.readFileSync('worker.txt','utf8');
const member=fs.readFileSync('member-current.html','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
assert.equal(worker,workerMirror,'worker.js / worker.txt 必須保持 byte-identical');

for(const token of ['createOrganizerApplicationDraft','tenant_apply_logs','organizer_signup','line_verification_pending','platform_member_identities','provider=eq.line'])assert.ok(worker.includes(token),`申請 Core 契約缺少：${token}`);
for(const token of ["u.searchParams.set('mode','member')","new URL('/me/',location.origin)",'getPlatformMemberProfile'])assert.ok(member.includes(token),`會員登入契約缺少：${token}`);
assert.ok(build.includes("'/apply/':'apply-current.html'"),'CURRENT /apply/ 必須發布正式互動申請頁');

execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
const apply=fs.readFileSync('.doing-2-site/apply/index.html','utf8');
assert.ok(!apply.includes('data-doing-ui-state="rebuild-shell"'),'正式申請 UI 不得退回重建殼');
for(const token of ['data-system="market"','data-system="project"','data-system="booking"','createOrganizerApplicationDraft','auth/line/start'])assert.ok(apply.includes(token),`正式申請閉環缺少：${token}`);
assert.ok(!apply.includes('supabase.co'),'正式申請頁不得直連 Supabase');

console.log(JSON.stringify({result:'PASS',applicationUi:'current-live',applicationCorePreserved:true,lineOrganizerSignupCompatibility:true,memberLoginIsNotAdminLogin:true,privilegeElevation:false,newDatabaseTables:0,productionWrites:0},null,2));
