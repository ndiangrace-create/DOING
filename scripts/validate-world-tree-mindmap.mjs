import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('world-tree.html','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const data=JSON.parse(fs.readFileSync('doing-world-tree-current.json','utf8'));
const allowed=new Set(['done','progress','verify','todo','blocked']);

for(const token of ['overall-grid','side','trunk','overall-svg','market-map','market-center','lane','lane-root','path-node','path-stack','deep-branch','deep-node','path-svg']) assert.ok(html.includes(token),'世界樹缺少真正圖形心智圖結構：'+token);
assert.ok(html.includes('前台七步主線、後台九步操作骨架與系統閉環完整展開'),'Market 前後台操作路徑必須完整展開');
assert.ok(html.includes('手機可左右滑動查看完整心智圖'),'手機版必須可橫向查看完整心智圖');
assert.ok(html.includes('尚未做'),'世界樹必須明確顯示尚未做狀態');
assert.ok(!html.includes('substepsHtml')&&!html.includes('detailSubsteps'),'不得回到舊文字子清單');
assert.ok(!html.includes('wt-summary')&&!html.includes('wt-stat'),'不得回到卡片式進度儀表板');
for(const token of ['applyWorldTreeTrafficLight','world-tree-traffic-light','綠燈｜已完成','黃燈｜進行中／待確認','紅燈｜阻擋／有問題']) assert.ok(build.includes(token),'正式世界樹缺少紅黃綠燈顯示：'+token);

const expected=['Market','Project','Booking','Guide','會員／我的紀錄','申請','我的 DOING／工作空間','DOING 公開平台','角色／權限','共用模組','共用核心'];
for(const title of expected) assert.ok(data.branches.some(x=>x.title===title),'第一層世界樹缺少：'+title);
function validateNode(node,path){
  assert.ok(allowed.has(node.status),'節點狀態不合法：'+path+' / '+node.title);
  if(node.children){
    assert.ok(Array.isArray(node.children),'children 必須為陣列：'+path+' / '+node.title);
    for(const child of node.children) validateNode(child,path+' / '+node.title);
  }
}
for(const b of data.branches){
  assert.ok(['left','right'].includes(b.side),'分支必須指定左右位置：'+b.title);
  validateNode(b,'root');
}
const market=data.branches.find(x=>x.title==='Market');
for(const id of ['market-front-path','market-admin-path','market-close-loop','market-main-tabs','market-session','market-public','market-settings']) assert.ok(market.children.some(x=>x.id===id),'Market 世界樹缺少：'+id);
const front=market.children.find(x=>x.id==='market-front-path');
for(const title of ['活動探索','會員／登入','報名','付款','排位／設備','現場','歷史紀錄']) assert.ok(front.children.some(x=>x.title===title),'2BL 前台攤商路徑缺少：'+title);
const frontDiscovery=front.children.find(x=>x.id==='front-discovery');
for(const title of ['首頁／活動列表／日曆','活動／場次卡','場次詳情']) assert.ok(frontDiscovery.children.some(x=>x.title===title),'前台探索下層缺少：'+title);
const frontRegistration=front.children.find(x=>x.id==='front-registration');
for(const title of ['報名表','合約','送出','我的報名']) assert.ok(frontRegistration.children.some(x=>x.title===title),'前台報名下層缺少：'+title);
const frontOnsite=front.children.find(x=>x.id==='front-onsite');
for(const title of ['行前通知／大群組','活動當日報到','撤場／押金']) assert.ok(frontOnsite.children.some(x=>x.title===title),'前台現場下層缺少：'+title);

const admin=market.children.find(x=>x.id==='market-admin-path');
for(const title of ['後台入口','場次總覽','場次設定','待辦','審核','付款確認','排位／設備','退款','財務結案']) assert.ok(admin.children.some(x=>x.title===title),'2BL 後台主辦操作骨架缺少：'+title);
assert.equal(admin.children.filter(x=>x.id!=='admin-support').length,9,'後台主操作骨架必須維持 9 步');
const adminEntry=admin.children.find(x=>x.id==='admin-entry');
for(const title of ['從工作空間進入 Market','確認主辦權限']) assert.ok(adminEntry.children.some(x=>x.title===title),'後台入口下層缺少：'+title);
const adminOverview=admin.children.find(x=>x.id==='admin-overview');
for(const title of ['全部場次','進入單場工作']) assert.ok(adminOverview.children.some(x=>x.title===title),'場次總覽下層缺少：'+title);
const adminSession=admin.children.find(x=>x.id==='admin-session');
for(const title of ['場次基本資料','費用與設備','報名規則','報名排程／分波錄取']) assert.ok(adminSession.children.some(x=>x.title===title),'後台場次設定下層缺少：'+title);
const adminPayment=admin.children.find(x=>x.id==='admin-payment');
for(const title of ['付款待確認','確認付款','已繳費／行前']) assert.ok(adminPayment.children.some(x=>x.title===title),'後台付款下層缺少：'+title);
const adminRefund=admin.children.find(x=>x.id==='admin-refund');
for(const title of ['取消／退款','轉場／活動金','不可抗力']) assert.ok(adminRefund.children.some(x=>x.title===title),'後台退款下層缺少：'+title);

const loop=market.children.find(x=>x.id==='market-close-loop');
for(const title of ['按鈕／操作','Core／API','Supabase SSOT','重讀正式資料','畫面同步']) assert.ok(loop.children.some(x=>x.title===title),'2BL 系統閉環缺少：'+title);
const loopDb=loop.children.find(x=>x.id==='loop-db');
for(const title of ['會員資料','活動／場次','報名紀錄','付款／退款','財務／結案','每日營運／排位','錯誤／稽核']) assert.ok(loopDb.children.some(x=>x.title===title),'系統閉環資料層缺少：'+title);

assert.ok(data.branches.some(x=>x.status==='todo')||data.branches.some(x=>x.children?.some(c=>c.status==='todo')),'世界樹必須保留尚未做項目，不得把未驗證工作冒充完成');
const roles=data.branches.find(x=>x.id==='roles');
assert.equal(roles.children.length,5,'角色／權限必須保留 5 類角色');
const shared=data.branches.find(x=>x.id==='shared-modules');
assert.equal(shared.children.length,10,'共用模組必須保留 10 項固定模組');

console.log(JSON.stringify({result:'PASS',layout:'graphical-mindmap-with-connected-deep-nodes',statusDisplay:'traffic-light-green-yellow-red',version:data.version,twoBL:{frontMain:7,adminMain:9,closeLoopMain:5,deepPaths:true},roles:5,sharedModules:10,todoProtected:true,mobile:'horizontal-pan'},null,2));
