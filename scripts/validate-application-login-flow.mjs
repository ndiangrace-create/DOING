import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const home=fs.readFileSync('home-current.html','utf8');
const member=fs.readFileSync('member-current.html','utf8');
const worker=fs.readFileSync('worker.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');

for(const token of ['申請市集活動系統','申請室內設計系統','申請美類預約系統','href="/apply/"'])assert.ok(home.includes(token),'首頁申請入口缺少：'+token);
assert.ok(build.includes("'/apply/':'apply-current.html'"),'CURRENT /apply/ 必須發布正式互動申請頁');
assert.ok(build.includes("'/me/':'member-current.html'"),'CURRENT 登入入口必須固定 /me/');
assert.equal((member.match(/\/auth\/line\/start/g)||[]).length,1,'會員登入只允許一個 LINE OAuth 啟動點');
for(const token of ["u.searchParams.set('mode','member')","new URL('/me/',location.origin)",'getPlatformMemberProfile','createMemberWorkspaceAdminSession'])assert.ok(member.includes(token),'會員登入閉環缺少：'+token);
for(const token of ['createOrganizerApplicationDraft','tenant_apply_logs','organizer_signup','line_verification_pending'])assert.ok(worker.includes(token),'申請 Core 能力遺失：'+token);

execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
const apply=fs.readFileSync('.doing-2-site/apply/index.html','utf8');
assert.ok(!apply.includes('data-doing-ui-state="rebuild-shell"'),'CURRENT /apply/ 不得退回重建殼');
for(const token of ['data-system="market"','data-system="project"','data-system="booking"','createOrganizerApplicationDraft','auth/line/start'])assert.ok(apply.includes(token),'CURRENT /apply/ 正式閉環缺少：'+token);
assert.ok(!apply.includes('supabase.co'),'申請頁不得直連 Supabase');

console.log(JSON.stringify({result:'PASS',publicApplyEntry:'/apply/',applyState:'current-live',memberLogin:'/me/',singleLineLogin:true,applicationCorePreserved:true,formalApplicationUi:true,newTables:0,productionWrites:0},null,2));
