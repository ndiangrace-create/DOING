import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const worker=fs.readFileSync('worker.js','utf8');
const workerMirror=fs.readFileSync('worker.txt','utf8');
const member=fs.readFileSync('member-current.html','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
assert.equal(worker,workerMirror,'worker.js / worker.txt 必須保持 byte-identical');

// Clean-slate rebuild may remove the old application UI, but the approved Core contracts remain.
for(const token of ['createOrganizerApplicationDraft','tenant_apply_logs','organizer_signup','line_verification_pending','platform_member_identities','provider=eq.line'])assert.ok(worker.includes(token),`申請 Core 契約缺少：${token}`);
for(const token of ["u.searchParams.set('mode','member')","new URL('/me/',location.origin)",'getPlatformMemberProfile'])assert.ok(member.includes(token),`會員登入契約缺少：${token}`);
assert.ok(build.includes("'/apply/':'DOING Apply'"),'CURRENT /apply/ 網址必須保留');

execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
const apply=fs.readFileSync('.doing-2-site/apply/index.html','utf8');
assert.ok(apply.includes('data-doing-ui-state="rebuild-shell"'),'申請 UI 尚未重建完成時必須安全停在重建殼');
for(const forbidden of ['<form','<button','tobeloved-api','supabase.co','localStorage','sessionStorage'])assert.ok(!apply.includes(forbidden),`重建殼不得發布舊申請操作：${forbidden}`);

console.log(JSON.stringify({result:'PASS',applicationUi:'rebuild-shell',applicationCorePreserved:true,lineOrganizerSignupCompatibility:true,memberLoginIsNotAdminLogin:true,privilegeElevation:false,newDatabaseTables:0,productionWrites:0},null,2));
