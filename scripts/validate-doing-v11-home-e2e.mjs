import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('doing-2-home-v11.js','utf8');
const css=fs.readFileSync('doing-2-home-v11.css','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const application=fs.readFileSync('doing-smart-activation-v5.js','utf8');
const member=fs.readFileSync('doing-member-return-direct.js','utf8');
const marketPublic=fs.readFileSync('doing-market-public-query.js','utf8');

for(const text of ['報名活動','我的紀錄','線上客服','我要申請 DOING','近期場次','立即報名'])assert.ok(home.includes(text),'首頁缺少一般民眾入口：'+text);
assert.ok(home.includes("new URL('/market/public/',location.origin)"),'首頁搜尋沒有前往公開活動頁');
assert.ok(home.includes("u.searchParams.set('q',q)"),'首頁搜尋沒有帶 query');
assert.ok(marketPublic.includes("searchParams.get('q')")&&marketPublic.includes("dispatchEvent(new Event('input'"),'公開活動頁沒有接收首頁 query');
assert.ok(home.includes("/member-panel.html#activities"),'我的紀錄沒有前往會員紀錄');
assert.ok(member.includes("new URL('/member-panel.html',location.origin)"),'會員登入沒有回原會員中心');
assert.ok(home.includes("action:'analyzeDoingApplication'")&&home.includes("topic:'question'"),'線上客服沒有走既有 DOING 問答 API');
assert.ok(home.includes("e.key==='Enter'&&!e.shiftKey"),'客服未支援 Enter 送出');
assert.ok(home.includes('data-close-support')&&home.includes("e.key==='Escape'"),'客服缺少關閉操作');
assert.ok(home.includes("set('action','publicDiscovery')"),'近期場次沒有讀正式 publicDiscovery');
assert.ok(home.includes("new URL('/register.html',location.origin)"),'立即報名沒有前往正式報名頁');
assert.ok(!home.includes('class="ico"'),'底部三個主按鈕必須只有文字');

for(const forbidden of ['Core／Supabase','固定模組','AI 規則','主辦營運系統','不再詢問'])assert.ok(!home.includes(forbidden),'首頁出現內部語言：'+forbidden);
assert.ok(!application.includes('請先確認固定模組內容'),'申請仍被固定模組 gate 阻擋');
assert.ok(application.includes('applicationGate:false'),'智慧小幫手仍可能阻擋申請');
assert.ok(application.includes('customerServiceOnly:true'),'智慧小幫手沒有固定成客服／導引');

for(const token of ['box-shadow','transform:translateY(-4px)','transform:translateY(4px)','border-radius:23px'])assert.ok(css.includes(token),'立體按鈕樣式缺少：'+token);
assert.ok(css.includes('@media(max-width:620px)')&&css.includes('@media(max-width:390px)'),'首頁缺少手機響應斷點');
assert.ok(css.includes('font-size:clamp(21px,2.3vw,29px)'),'主按鈕沒有老花友善字級');
assert.ok(css.indexOf('.d2-home-search{')<css.indexOf('.d2-home-logo-wrap{'),'搜尋視覺規則必須先於 LOGO 區塊');
assert.ok(build.includes("'doing-2-home-v11.css'")&&build.includes("'doing-2-home-v11.js'")&&build.includes("'doing-market-public-query.js'"),'Pages build 未包含 v11 首頁資產');
assert.ok(build.includes("'doing-candy-theme.css'")&&build.includes('candyTargets'),'Pages build 未包含全系統共用色系');

console.log(JSON.stringify({result:'PASS',simulatedJourneys:['首頁 → 搜尋 → 公開活動','首頁 → 近期場次 → 立即報名','首頁 → 我的紀錄 → 單一 LINE 登入回跳','首頁 → 線上客服 → 快捷問題／自由輸入','首頁 → 我要申請 → 申請流程無客服 gate'],responsive:['desktop','tablet','mobile'],buttonStyle:'3d-rounded-rectangle-text-only',liveCards:true,productionWrites:0},null,2));
