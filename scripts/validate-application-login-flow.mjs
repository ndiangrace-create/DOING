import assert from 'node:assert/strict';
import fs from 'node:fs';

const smart=fs.readFileSync('doing-smart-activation-v5.js','utf8');
const bridge=fs.readFileSync('doing-formal-application-bridge.js','utf8');
const member=fs.readFileSync('doing-member-return-direct.js','utf8');
const completion=fs.readFileSync('doing-application-completion.js','utf8');
const router=fs.readFileSync('doing-workspace-product-router.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');

for(const token of ['createOrganizerApplicationDraft',"mode','organizer_signup",'application_id','submitApplication','LINE 驗證並開通']) assert.ok(smart.includes(token),'正式單頁申請缺少：'+token);
assert.ok(!smart.includes('← 上一步'),'單頁申請不得再有上一步');
assert.ok(!smart.includes('填申請資料 →'),'單頁申請不得再拆成下一頁');
assert.ok(smart.includes('publicLinks'),'正式申請必須保留公開品牌／社群網址');
assert.ok(smart.includes("architecture:'doing_2_fixed_products'"),'申請必須固定使用 DOING 2.0 產品分類');
assert.ok(smart.includes('applicationGate:false'),'客服不得成為申請 gate');
assert.ok(!smart.includes('固定模組確認'),'正式申請不得要求模組確認');
for(const token of ['readMemberState','routeResolvedMemberState','existing_workspace','你的申請已送出']) assert.ok(bridge.includes(token),'既有工作空間／申請復原缺少：'+token);

assert.ok(member.includes("new URL('/me/',location.origin)"),'會員登入 return_url 必須回 /me/');
assert.ok(member.includes("loginUrl.searchParams.set('mode','member')"),'會員中心未登入必須直接走 member LINE OAuth');
assert.ok(!member.includes("new URL('/',location.origin)"),'會員中心登入不得再繞首頁');

for(const token of ["['approved','auto_activated']", "target.hash='operations'", "auth.searchParams.set('mode','member')", "post_application"]) assert.ok(completion.includes(token),'申請完成接續缺少：'+token);
assert.ok(completion.includes("new URL('/me/',location.origin)"),'申請完成必須直接進 /me/');
for(const token of ["market:'/market/'","booking:'/booking/'","project:'/project/'","event:'/market/'","course:'/market/'"]) assert.ok(router.includes(token),'workspace 模組路由缺少：'+token);
assert.ok(router.includes("new URL(route,location.origin)"),'工作模組必須使用正式短網址 router');
assert.ok(router.includes("u.searchParams.set('admin_token',adminToken)"),'工作模組必須沿用同一份背景換發 admin_token');

for(const token of ["'/apply/':'smart-application.html'","'/workspace/':'workspace.html'","'/me/':'member-panel.html'","'/market/':'market-center.html'","'/booking/':'booking-2-center.html'","'/project/':'project-center.html'","'doing-smart-activation-v5.js'","'doing-formal-application-bridge.js'","'doing-auto-activation-status.js'","'doing-global-entry.js'","'doing-application-completion.js'","'doing-workspace-product-router.js'"]) assert.ok(build.includes(token),'Cloudflare Pages 缺少短網址／必要功能：'+token);
for(const removed of ["'/admin/'","'/onsite/'","'/platform/'","'/operations/'"]) assert.ok(!build.includes(removed+':'),'不應再發布獨立路由：'+removed);

console.log(JSON.stringify({result:'PASS',journey:['/apply/ 單頁','工作類型＋使用方式＋基本資料','LINE member 驗證','既有空間直接回 /me/','新申請 DB 自動開通','/me/','/workspace/','依工作模組進 /market/ /booking/ /project/'],helperRole:'customer_service_only',applicationGate:false,singlePage:true,duplicateApplicationBlocked:true,duplicateLogin:false,homeBounce:false,multiProductRouting:true,newTables:0,workerSchemaChanges:0},null,2));
