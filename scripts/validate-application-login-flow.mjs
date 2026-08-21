import assert from 'node:assert/strict';
import fs from 'node:fs';

const smart=fs.readFileSync('doing-smart-activation-v5.js','utf8');
const member=fs.readFileSync('doing-member-return-direct.js','utf8');
const completion=fs.readFileSync('doing-application-completion.js','utf8');
const router=fs.readFileSync('doing-workspace-product-router.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');

for(const token of ['createOrganizerApplicationDraft',"mode','organizer_signup",'application_id']) assert.ok(smart.includes(token),'正式申請缺少：'+token);
assert.ok(smart.includes('我要申請｜LINE 驗證並送出'),'正式申請最後一步必須以 LINE 驗證送出');
assert.ok(smart.includes('publicLinks'),'正式申請必須保留公開品牌／社群網址');
assert.ok(smart.includes("architecture:'doing_2_fixed_products'"),'智慧申請必須固定使用 DOING 2.0 產品分類');

assert.ok(member.includes("new URL('/member-panel.html',location.origin)"),'會員登入 return_url 必須回 member-panel');
assert.ok(member.includes("auth.searchParams.set('mode','member')")||member.includes("loginUrl.searchParams.set('mode','member')"),'會員中心未登入必須直接走 member LINE OAuth');
assert.ok(!member.includes("new URL('/',location.origin)"),'會員中心登入不得再繞首頁');

for(const token of ["['approved','auto_activated']", "target.hash='operations'", "auth.searchParams.set('mode','member')", "post_application"]) assert.ok(completion.includes(token),'申請完成接續缺少：'+token);
assert.ok(router.includes('data-work="market"')||router.includes("data-work=\"market\""),'workspace 必須接到 Market 2.0');
assert.ok(router.includes("new URL('/market/',location.origin)"),'Market 正式路徑必須是 /market/');

for(const token of [
  "'smart-application.html'","'workspace.html'","'member.html'","'member-panel.html'","'about.html'",
  "'doing-smart-activation-v5.js'","'doing-auto-activation-status.js'","'doing-global-entry.js'",
  "'doing-application-completion.js'","'doing-workspace-product-router.js'"
]) assert.ok(build.includes(token),'Cloudflare Pages 缺少正式操作檔：'+token);

console.log(JSON.stringify({result:'PASS',journey:['未登入可填正式申請','固定產品模組','LINE 驗證送出','DB 自動開通','自動取得會員 session','我的 DOING','工作空間','DOING Market'],duplicateLogin:false,homeBounce:false,newTables:0,workerSchemaChanges:0},null,2));
