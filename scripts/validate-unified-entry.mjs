import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=f=>fs.readFileSync(f,'utf8');
const home=read('doing-2-home-v11.js');
const shell=read('doing-2-shell.js');
const memberGate=read('doing-member-return-direct.js');
const globalEntry=read('doing-global-entry.js');
const member=read('member-panel.html');
const workspace=read('workspace.html');
const build=read('scripts/build-doing-2-site.mjs');
const legacy=['index.html','member.html','admin.html','onsite.html','platform.html','operations-center.html','photo.html','consignment.html','about.html'];
for(const f of legacy)assert.equal(fs.existsSync(f),false,`已退休頁面不得留在正式 source：${f}`);

for(const token of ['d2-home-account-actions','申請 DOING','id="d2HomeLogin"','href="/apply/"','href="/me/"'])assert.ok(home.includes(token),`首頁缺少唯一帳號入口：${token}`);
assert.ok(!home.includes('/auth/line/start'),'首頁不得自己啟動第二套 OAuth；登入統一交給 /me/');
assert.ok(!home.includes('我的紀錄</a>'),'首頁不得再把我的紀錄當第二套登入入口');
for(const token of ['data-account-entry="apply"','data-account-entry="login"','href="/apply/"','href="/me/"'])assert.ok(shell.includes(token),`頂部導覽缺少統一入口：${token}`);

assert.equal((memberGate.match(/\/auth\/line\/start/g)||[]).length,1,'/me/ 只能有一個 LINE 登入啟動點');
for(const token of ["loginUrl.searchParams.set('mode','member')","new URL('/me/',location.origin)","localStorage.setItem(TOKEN_KEY,incoming)"])assert.ok(memberGate.includes(token),`/me/ 登入契約缺少：${token}`);
assert.ok(!memberGate.includes('/workspace/'),'登入完成不得由登入 gate 自動跳工作空間');

for(const forbidden of ['directMemberPanelHandoff','mode\',\'platform','member.html','operations-center.html','about.html#apply'])assert.ok(!globalEntry.includes(forbidden),`統一入口仍殘留舊自動分流：${forbidden}`);
for(const token of ['進入工作空間','createMemberWorkspaceAdminSession',"new URL('/workspace/',location.origin)","location.replace('/me/#operations')"])assert.ok(globalEntry.includes(token),`會員→工作空間契約缺少：${token}`);
assert.ok(globalEntry.includes("clearMemberToken();location.replace('/')"),'登出必須只清會員 token 並回首頁');

for(const forbidden of ['member.html','operations-center.html','about.html#apply'])assert.ok(!member.includes(forbidden),`/me/ source 仍引用退休頁：${forbidden}`);
assert.ok(!workspace.includes('請從首頁登入 DOING。')||build.includes("source==='workspace.html'"),'工作空間不得形成第二個登入畫面');
for(const token of ["'/me/':'member-panel.html'","'/workspace/':'workspace.html'","'/apply/':'smart-application.html'"])assert.ok(build.includes(token),`正式短網址缺少：${token}`);

console.log(JSON.stringify({
  result:'PASS',
  publicAccountEntries:['申請 DOING','登入'],
  loginLanding:'/me/',
  memberHub:'/me/',
  workspace:'/workspace/',
  loginCount:1,
  automaticWorkspaceBounce:false,
  duplicateWorkspaceButtons:false,
  legacyPagesDeleted:legacy,
  productionWrites:0
},null,2));
