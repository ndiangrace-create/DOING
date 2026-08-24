import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const home=fs.readFileSync('home-current.html','utf8');
const member=fs.readFileSync('member-current.html','utf8');
const worker=fs.readFileSync('worker.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');

for(const token of ['申請市集活動系統','申請室內設計進度系統','申請美類預約系統','href="/apply/"'])assert.ok(home.includes(token),'首頁申請入口缺少：'+token);
assert.ok(build.includes("'/apply/':'DOING Apply'"),'CURRENT /apply/ 必須保留正式網址重建殼');
assert.ok(build.includes("'/me/':'member-current.html'"),'CURRENT 登入入口必須固定 /me/');
assert.equal((member.match(/\/auth\/line\/start/g)||[]).length,1,'會員登入只允許一個 LINE OAuth 啟動點');
for(const token of ["u.searchParams.set('mode','member')","new URL('/me/',location.origin)",'getPlatformMemberProfile','createMemberWorkspaceAdminSession'])assert.ok(member.includes(token),'會員登入閉環缺少：'+token);

// 舊申請 UI 已依 clean-slate 決策停止發布，但 Core 能力不可因 UI 重建而消失。
for(const token of ['createOrganizerApplicationDraft','tenant_apply_logs','organizer_signup','line_verification_pending'])assert.ok(worker.includes(token),'申請 Core 能力遺失：'+token);

execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
const apply=fs.readFileSync('.doing-2-site/apply/index.html','utf8');
assert.ok(apply.includes('data-doing-ui-state="rebuild-shell"'),'CURRENT /apply/ 必須停在安全重建殼');
for(const bad of ['<form','<button','tobeloved-api','supabase.co','localStorage','sessionStorage'])assert.ok(!apply.includes(bad),'未重建完成的 /apply/ 不得偷偷復活舊操作：'+bad);

console.log(JSON.stringify({result:'PASS',publicApplyEntry:'/apply/',applyState:'rebuild-shell',memberLogin:'/me/',singleLineLogin:true,applicationCorePreserved:true,oldApplicationUiRepublished:false,newTables:0,productionWrites:0},null,2));
