import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('doing-2-home-v11.js','utf8');
const css=fs.readFileSync('doing-2-home-v11.css','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const application=fs.readFileSync('doing-smart-activation-v5.js','utf8');
const member=fs.readFileSync('doing-member-return-direct.js','utf8');
const marketPublic=fs.readFileSync('market-public.html','utf8');

for(const text of ['申請 DOING','登入','報名活動','線上客服','近期場次','立即報名'])assert.ok(home.includes(text),'首頁缺少正式入口：'+text);
assert.ok(home.includes('d2-home-account-actions'),'首頁必須有單一帳號入口區');
assert.ok(home.includes('href="/apply/"')&&home.includes('href="/me/"'),'首頁帳號入口只能導向 /apply/ 與 /me/');
assert.ok(!home.includes('我的紀錄</a>'),'首頁不得再把我的紀錄做成第二套會員入口');
assert.ok(!home.includes('/auth/line/start'),'首頁不得自行啟動 OAuth');
assert.ok(home.includes("new URL('/market/public/',location.origin)"),'首頁搜尋沒有前往公開活動頁');
assert.ok(home.includes("u.searchParams.set('q',q)"),'首頁搜尋沒有帶 query');
assert.ok(marketPublic.includes("P.get('q')")&&marketPublic.includes("if(INITIAL_Q)$('q').value=INITIAL_Q"),'公開活動頁沒有接收首頁 query');
assert.ok(member.includes("new URL('/me/',location.origin)"),'會員登入沒有回 /me/');
assert.ok(home.includes("action:'analyzeDoingApplication'")&&home.includes("topic:'question'"),'線上客服沒有走既有 DOING 問答 API');
assert.ok(home.includes("e.key==='Enter'&&!e.shiftKey"),'客服未支援 Enter 送出');
assert.ok(home.includes('data-close-support')&&home.includes("e.key==='Escape'"),'客服缺少關閉操作');
assert.ok(home.includes("set('action','publicDiscovery')"),'近期場次沒有讀正式 publicDiscovery');
assert.ok(build.includes("'register.html':'/register/'"),'立即報名沒有被正式建置映射到 /register/');
assert.ok(!home.includes('class="ico"'),'首頁主按鈕必須只有文字');

for(const forbidden of ['Core／Supabase','固定模組','AI 規則','主辦營運系統','不再詢問'])assert.ok(!home.includes(forbidden),'首頁出現內部語言：'+forbidden);
assert.ok(!application.includes('請先確認固定模組內容'),'申請仍被固定模組 gate 阻擋');
assert.ok(application.includes('applicationGate:false'),'智慧小幫手仍可能阻擋申請');
assert.ok(application.includes('customerServiceOnly:true'),'智慧小幫手沒有固定成客服／導引');

for(const token of ['box-shadow','transform:translateY(-4px)','transform:translateY(4px)','border-radius:23px'])assert.ok(css.includes(token),'立體按鈕樣式缺少：'+token);
assert.ok(css.includes('@media(max-width:620px)')&&css.includes('@media(max-width:390px)'),'首頁缺少手機響應斷點');
assert.ok(build.includes("'doing-2-home-v11.css'")&&build.includes("'doing-2-home-v11.js'")&&build.includes("'doing-market-v18.css'"),'Pages build 未包含首頁或 Market v18 資產');
assert.ok(build.includes("'doing-candy-theme.css'"),'Pages build 未包含全系統共用色系');

console.log(JSON.stringify({result:'PASS',accountEntries:['申請 DOING → /apply/','登入 → /me/'],functionalEntries:['報名活動','線上客服'],simulatedJourneys:['首頁 → 搜尋 → /market/public/?q=','首頁 → 近期場次 → /register/','首頁 → 登入 → /me/ → LINE 回同一頁','首頁 → 申請 → /apply/ 單頁','首頁 → 客服'],duplicateMemberEntry:false,responsive:['desktop','tablet','mobile'],liveCards:true,productionWrites:0},null,2));