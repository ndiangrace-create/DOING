import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const shell=fs.readFileSync('doing-2-shell.js','utf8');
const memberReturn=fs.readFileSync('doing-member-return-direct.js','utf8');
const appDone=fs.readFileSync('doing-application-completion.js','utf8');
const market=fs.readFileSync('market-center.html','utf8');

const keep=['/market/','/market/public/','/market/session/','/project/','/booking/','/guide/','/workspace/','/me/','/apply/','/register/'];
for(const route of keep)assert(build.includes(`'${route}'`),`缺少正式短網址 ${route}`);

const removed=['/admin/','/onsite/','/platform/','/operations/','/photo/','/consignment/','/about/','/member/'];
for(const route of removed)assert(!build.includes(`'${route}':`),`多餘獨立網址仍存在 ${route}`);

for(const old of ['admin.html','onsite.html','platform.html','operations-center.html','photo.html','consignment.html']){
  assert(build.includes(`'${old}'`),`缺少舊頁歸屬規則 ${old}`);
}
assert(build.includes("'admin.html':'/market/'"),'後台設定沒有回到 Market 主頁');
assert(build.includes("'onsite.html':'/market/#onsite'"),'現場沒有回到 Market 內部現場分頁');
assert(build.includes("'platform.html':'/workspace/#platform'"),'平台管理沒有回到 Workspace 層級');
assert(build.includes("'operations-center.html':'/workspace/#operations'"),'營運空間沒有回到 Workspace 層級');

assert(shell.includes("keep('/me/#activities')"),'我的紀錄仍未固定到 /me/#activities');
assert(shell.includes("keep('/apply/')"),'我要申請仍未固定到 /apply/');
assert(shell.includes("keep('/workspace/')"),'我的 DOING 仍未固定到 /workspace/');
assert(shell.includes('data-setting-key'),'Market 設定仍在外跳獨立後台頁');
assert(!shell.includes('/admin/'),'Shell 仍暴露獨立 admin 路由');

assert(memberReturn.includes("new URL('/me/',location.origin)"),'LINE 會員登入回跳不是 /me/');
assert(appDone.includes("new URL('/me/',location.origin)"),'申請完成回跳不是 /me/');
assert(market.includes('data-tab="settings"'),'Market 主頁缺少內部設定分頁');
assert(market.includes('data-tab="onsite"'),'Market 主頁缺少內部現場分頁');

assert(build.includes('legacyRedirects:0'),'舊長網址不應保留 redirect');
assert(build.includes('non-short html published'),'建置缺少禁止額外 html 頁面的硬性檢查');
assert(build.includes('legacy page reference leaked'),'建置缺少舊頁引用硬性檢查');

console.log(JSON.stringify({
  result:'PASS',
  keep,
  removed,
  hierarchy:{market:['sessions','tasks','onsite','members','settings','session'],workspace:['platform','operations'],member:'/me/',apply:'/apply/'},
  redirects:0,
  productionWrites:0
},null,2));
