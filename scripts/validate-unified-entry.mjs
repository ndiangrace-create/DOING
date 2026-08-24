import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const read=f=>fs.readFileSync(f,'utf8');
const home=read('doing-2-home-v11.js');
const shell=read('doing-2-shell.js');
const memberGate=read('doing-member-return-direct.js');
const globalEntry=read('doing-global-entry.js');
const router=read('doing-workspace-product-router.js');
const build=read('scripts/build-doing-2-site.mjs');
const legacy=['index.html','member.html','admin.html','onsite.html','platform.html','operations-center.html','photo.html','consignment.html','about.html','booking-center.html'];
for(const f of legacy)assert.equal(fs.existsSync(f),false,`已退休頁面不得留在正式 root：${f}`);
for(const f of fs.readdirSync('.').filter(x=>/^uat-application-.*\.html$/.test(x)))assert.fail(`UAT 頁不得留在正式 root：${f}`);
assert.ok(fs.existsSync('tests/uat'),'UAT 頁必須隔離在 tests/uat');
assert.ok(fs.existsSync('legacy-pages'),'歷史頁必須隔離在 legacy-pages');

for(const token of ['d2-home-account-actions','申請 DOING','id="d2HomeLogin"','href="/apply/"','href="/me/"'])assert.ok(home.includes(token),`首頁缺少唯一帳號入口：${token}`);
assert.ok(!home.includes('/auth/line/start'),'首頁不得自己啟動第二套 OAuth；登入統一交給 /me/');
assert.ok(!home.includes('我的紀錄</a>'),'首頁不得把我的紀錄當第二套登入入口');
for(const token of ['data-account-entry="apply"','data-account-entry="login"','href="/apply/"','href="/me/"'])assert.ok(shell.includes(token),`頂部導覽缺少統一入口：${token}`);

assert.equal((memberGate.match(/\/auth\/line\/start/g)||[]).length,1,'/me/ 只能有一個 LINE 登入啟動點');
for(const token of ["loginUrl.searchParams.set('mode','member')","new URL('/me/',location.origin)","localStorage.setItem(TOKEN_KEY,incoming)","if(!token){startLine();return}",'getPlatformMemberProfile','DOING_MEMBER_REAUTH'])assert.ok(memberGate.includes(token),`/me/ 登入契約缺少：${token}`);
assert.ok(!memberGate.includes('wireRetry'),'/me/ 不得再存在登入重試中繼頁');
assert.ok(!memberGate.includes('/workspace/'),'登入完成不得由登入 gate 自動跳工作空間');
for(const forbidden of ['directMemberPanelHandoff',"mode','platform","location.href='member.html'","location.replace('member.html'","location.href='operations-center.html'","location.href='about.html#apply'"])assert.ok(!globalEntry.includes(forbidden),`統一入口仍殘留舊自動分流：${forbidden}`);
assert.ok(globalEntry.includes('a[href*="member.html"]'),'相容層應攔截舊 member 連結並改寫，而不是重新發布舊頁');
for(const token of ['進入工作空間','createMemberWorkspaceAdminSession',"new URL('/workspace/',location.origin)","location.replace('/me/#operations')",'adminGoogleBtn','adminLineBtn'])assert.ok(globalEntry.includes(token),`統一入口契約缺少：${token}`);
assert.ok(globalEntry.includes("clearMemberToken();location.replace('/')"),'登出必須清除 member token 並回首頁');
for(const token of ["market:'/market/'","booking:'/booking/'","project:'/project/'"])assert.ok(router.includes(token),`工作模組路由缺少：${token}`);
for(const token of ["'/me/':'member-panel.html'","'/workspace/':'workspace.html'","'/apply/':'smart-application.html'"])assert.ok(build.includes(token),`正式短網址缺少：${token}`);
assert.ok(build.includes('removeMemberLoginInterstitial'),'建置必須移除 /me/ 登入中繼畫面');

if(!fs.existsSync('.doing-2-site/me/index.html')){
  execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
  execFileSync(process.execPath,['scripts/postprocess-market-v19.mjs'],{stdio:'inherit'});
}
const builtMe=read('.doing-2-site/me/index.html'),builtWorkspace=read('.doing-2-site/workspace/index.html'),builtRegister=read('.doing-2-site/register/index.html'),builtBooking=read('.doing-2-site/booking/index.html'),redirects=read('.doing-2-site/_redirects');
assert.ok(builtMe.includes('doing-member-return-direct.js'),'正式 /me/ 缺少唯一登入 gate');
assert.equal((builtMe.match(/doing-member-return-direct\.js/g)||[]).length,1,'正式 /me/ 不得重複載入登入 gate');
assert.ok(!builtMe.includes('把參加、品牌與營運放在一起'),'正式 /me/ 不得再發布登入中繼文案');
assert.ok(!builtMe.includes('<section id="loginView" class="hero"'),'正式 /me/ 不得再發布登入中繼 hero');
assert.ok(builtMe.indexOf('doing-member-return-direct.js')<builtMe.indexOf('<body'),'正式 /me/ 必須先驗證登入再顯示 body');
assert.ok(!/<button[^>]+data-workspace-(?:calendar|operations)=/.test(builtMe),'正式 /me/ 同一 workspace 只能有一個進入按鈕');
assert.ok(builtWorkspace.includes('doing-global-entry.js'),'正式 /workspace/ 缺少統一權限入口');
assert.ok(builtRegister.includes('doing-global-entry.js'),'正式 /register/ 必須移除第二套 admin 登入');
assert.ok(builtBooking.includes('doing-global-entry.js'),'正式 /booking/ 缺少統一權限入口');
for(const token of ['getOperationUnitsAdmin','getBookingCalendarAdmin','saveAvailabilityRule','updateServiceVisit'])assert.ok(builtBooking.includes(token),`正式 /booking/ 遺失能力：${token}`);
assert.ok(!builtBooking.includes('operations-center.html'),'正式 /booking/ 不得回舊營運頁');
for(const line of ['/member.html /me/ 302','/admin.html /workspace/ 302','/about.html /apply/ 302','/booking-center.html /booking/ 302'])assert.ok(redirects.includes(line),`缺少舊網址相容轉址：${line}`);

console.log(JSON.stringify({result:'PASS',publicAccountEntries:['申請 DOING','登入'],loginLanding:'/me/',memberHub:'/me/',workspace:'/workspace/',loginCount:1,loggedOutInterstitial:false,automaticWorkspaceBounce:false,duplicateWorkspaceButtons:false,legacyRootPages:0,uatRootPages:0,legacyRedirects:true,legacySelectors:'intercept-only',bookingCapabilitiesPreserved:true,productionWrites:0},null,2));