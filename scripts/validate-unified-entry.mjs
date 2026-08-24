import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const read=f=>fs.readFileSync(f,'utf8');
const build=read('scripts/build-doing-2-site.mjs');
const home=read('home-current.html');
const member=read('member-current.html');
const workspace=read('workspace-current.html');
const legacy=['index.html','member.html','admin.html','onsite.html','platform.html','operations-center.html','photo.html','consignment.html','about.html','booking-center.html'];
for(const f of legacy)assert.equal(fs.existsSync(f),false,`已退休頁面不得留在正式 root：${f}`);
assert.equal(fs.existsSync('legacy-pages'),false,'退休頁不得重新出現');
assert.equal(fs.existsSync('tests/uat'),false,'歷史 UAT HTML 快照不得重新出現');

for(const token of ["'/':'home-current.html'","'/market/':'market-current.html'","'/project/':'project-current.html'","'/booking/':'booking-current.html'","'/workspace/':'workspace-current.html'","'/me/':'member-current.html'"])assert.ok(build.includes(token),`CURRENT 正式短網址缺少：${token}`);
for(const token of ["'/apply/':'DOING Apply'","'/register/':'DOING Register'","'/world-tree/':'DOING World Tree'"])assert.ok(build.includes(token),`重建保留網址缺少：${token}`);
for(const token of ['市集活動系統','室內設計進度系統','美類預約系統','href="/me/"','href="/apply/"'])assert.ok(home.includes(token),`首頁 CURRENT 入口缺少：${token}`);
assert.equal((member.match(/\/auth\/line\/start/g)||[]).length,1,'/me/ 只能有一個 LINE OAuth 啟動點');
for(const token of ["u.searchParams.set('mode','member')","new URL('/me/',location.origin)","localStorage.setItem(TOKEN_KEY,incoming)",'getPlatformMemberProfile','createMemberWorkspaceAdminSession','isAuthExpired','handleLoadError'])assert.ok(member.includes(token),`CURRENT /me/ 登入契約缺少：${token}`);
for(const token of ['getTenantModuleProfile','adminMe','市集活動系統','室內設計系統','美類預約系統'])assert.ok(workspace.includes(token),`CURRENT /workspace/ 契約缺少：${token}`);

if(!fs.existsSync('.doing-2-site/me/index.html'))execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
const builtMe=read('.doing-2-site/me/index.html');
const builtWorkspace=read('.doing-2-site/workspace/index.html');
const builtApply=read('.doing-2-site/apply/index.html');
const redirects=read('.doing-2-site/_redirects');
assert.ok(builtMe.includes('登入你的 DOING')&&builtMe.includes('createMemberWorkspaceAdminSession'),'正式 /me/ 必須發布 CURRENT 會員登入與工作空間入口');
assert.ok(builtWorkspace.includes('getTenantModuleProfile')&&builtWorkspace.includes('adminMe'),'正式 /workspace/ 必須保留權限與模組讀取');
assert.ok(builtApply.includes('data-doing-ui-state="rebuild-shell"'),'尚未重建的 /apply/ 必須維持非互動重建殼，不得復活舊申請 UI');
for(const bad of ['<form','tobeloved-api','supabase.co','localStorage','sessionStorage'])assert.ok(!builtApply.includes(bad),`/apply/ 重建殼不得含舊互動能力：${bad}`);
for(const line of ['/member.html /me/ 301','/admin.html /market/ 301','/about.html / 301','/booking-center.html /booking/ 301'])assert.ok(redirects.includes(line),`缺少 CURRENT 舊網址相容轉址：${line}`);

console.log(JSON.stringify({result:'PASS',architecture:'current-rebuild-routes',publicAccountEntries:['/apply/','/me/'],memberLogin:'/me/',workspace:'/workspace/',lineLoginCount:1,staleTokenReauthGuard:true,nonAuthLoadFailureKeepsToken:true,applyRoute:'rebuild-shell',legacyRootPages:0,productionWrites:0},null,2));
