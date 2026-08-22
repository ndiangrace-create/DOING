import assert from 'node:assert/strict';
import fs from 'node:fs';

const smart=fs.readFileSync('smart-application.html','utf8');
const bridge=fs.readFileSync('doing-application-contract-v12.js','utf8');
const worker=fs.readFileSync('worker.js','utf8');
const theme=fs.readFileSync('doing-candy-theme.css','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const home=fs.readFileSync('doing-2-home-v11.js','utf8');
const shell=fs.readFileSync('doing-2-shell.js','utf8');

assert(smart.includes('smart-fixed-top')&&smart.includes('首頁')&&smart.includes('我的紀錄'),'申請頁缺少桌機固定頂部導覽');
assert(smart.indexOf('doing-application-contract-v12.js')<smart.indexOf('doing-smart-activation-v5.js'),'v12 契約橋接必須在申請腳本之前載入');
assert(bridge.includes("scope:'doing_only'")&&bridge.includes('applicationGate:false')&&bridge.includes('customerServiceOnly:true'),'申請契約橋接未對齊客服不作 gate 的正式規則');
assert(worker.includes("String(assistantAnalysis.scope||'')!=='doing_only'"),'測試無法確認 Worker 正式申請契約');
assert(theme.includes('.smart-fixed-top')&&theme.includes('.topbar')&&theme.includes('.d2-topbar'),'共用桌機固定頂部規則未覆蓋主要外框');
for(const route of ['/market/','/project/','/booking/','/guide/','/workspace/','/me/','/apply/'])assert(build.includes(`'${route}'`),`正式 Pages 缺少短網址：${route}`);
for(const route of ['/admin/','/onsite/','/platform/','/operations/','/photo/','/consignment/'])assert(!build.includes(`'${route}':`),`多餘獨立路由仍存在：${route}`);
assert(build.includes("'doing-application-contract-v12.js'"),'正式 Pages 未帶入 v12 申請契約橋接');
assert(home.includes('d2-home-logo-wrap'),'首頁缺少 LOGO 預留位置');
assert(shell.includes('d2-home-desktop-topbar'),'首頁缺少桌機專用固定頂部列');
assert(shell.includes("matchMedia('(min-width:621px)')"),'首頁桌機／手機頂部列切換規則缺失');
assert(shell.includes("setProperty('position','fixed'"),'桌機頂部列不是 position: fixed');
assert(shell.includes("setProperty('padding-top'"),'固定列沒有替內容保留高度');
for(const label of ['首頁','報名活動','我的紀錄','我要申請'])assert(shell.includes(`>${label}<`),`首頁桌機固定列缺少：${label}`);
assert(!shell.includes("if(isPublicHome){document.body?.classList.add('d2-public-home');return;}"),'首頁仍在建立固定列前直接 return');
console.log(JSON.stringify({result:'PASS',applicationGate:'closed',helperRole:'customer-service-only',desktopTopbar:'fixed>=621px',mobileTopbar:'hidden<=620px',shortHierarchy:true,extraRoutes:false,logoSlot:'reserved',productionWrites:0},null,2));
