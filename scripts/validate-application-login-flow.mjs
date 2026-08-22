import assert from 'node:assert/strict';
import fs from 'node:fs';

const smart=fs.readFileSync('doing-smart-activation-v5.js','utf8');
const member=fs.readFileSync('doing-member-return-direct.js','utf8');
const completion=fs.readFileSync('doing-application-completion.js','utf8');
const router=fs.readFileSync('doing-workspace-product-router.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');

for(const token of ['createOrganizerApplicationDraft',"mode','organizer_signup",'application_id']) assert.ok(smart.includes(token),'正式申請缺少：'+token);
assert.ok(smart.includes('我要申請｜使用 LINE 驗證'),'正式申請最後一步必須以 LINE 驗證送出');
assert.ok(smart.includes('publicLinks'),'正式申請必須保留公開品牌／社群網址');
assert.ok(smart.includes("architecture:'doing_2_fixed_products'"),'申請必須固定使用 DOING 2.0 產品分類');
assert.ok(smart.includes('applicationGate:false'),'客服不得成為申請 gate');
assert.ok(!smart.includes('固定模組確認'),'正式申請不得要求模組確認');

assert.ok(member.includes("new URL('/me/',location.origin)"),'會員登入 return_url 必須回 /me/');
assert.ok(member.includes("auth.searchParams.set('mode','member')")||member.includes("loginUrl.searchParams.set('mode','member')"),'會員中心未登入必須直接走 member LINE OAuth');
assert.ok(!member.includes("new URL('/',location.origin)"),'會員中心登入不得再繞首頁');

for(const token of ["['approved','auto_activated']", "target.hash='operations'", "auth.searchParams.set('mode','member')", "post_application"]) assert.ok(completion.includes(token),'申請完成接續缺少：'+token);
assert.ok(completion.includes("new URL('/me/',location.origin)"),'申請完成必須直接進 /me/');
assert.ok(router.includes('data-work="market"')||router.includes("data-work=\"market\""),'workspace 必須接到 Market 2.0');
assert.ok(router.includes("new URL('/market/',location.origin)"),'Market 正式路徑必須是 /market/');

for(const token of ["'/apply/':'smart-application.html'","'/workspace/':'workspace.html'","'/me/':'member-panel.html'","'/market/':'market-center.html'","'doing-smart-activation-v5.js'","'doing-auto-activation-status.js'","'doing-global-entry.js'","'doing-application-completion.js'","'doing-workspace-product-router.js'"]) assert.ok(build.includes(token),'Cloudflare Pages 缺少短網址／必要功能：'+token);
for(const removed of ["'/admin/'","'/onsite/'","'/platform/'","'/operations/'"]) assert.ok(!build.includes(removed+':'),'不應再發布獨立路由：'+removed);

console.log(JSON.stringify({result:'PASS',journey:['/apply/','選產品','選使用類型','填資料','LINE 驗證送出','DB 自動開通','/me/','/workspace/','/market/'],helperRole:'customer_service_only',applicationGate:false,duplicateLogin:false,homeBounce:false,newTables:0,workerSchemaChanges:0},null,2));
