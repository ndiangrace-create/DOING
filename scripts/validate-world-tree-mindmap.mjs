import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('world-tree.html','utf8');
const data=JSON.parse(fs.readFileSync('doing-world-tree-current.json','utf8'));
const allowed=new Set(['done','progress','verify','todo','blocked']);

for(const token of ['overall-grid','side','trunk','overall-svg','market-map','market-center','lane','lane-root','path-node','path-svg']) assert.ok(html.includes(token),'世界樹缺少真正圖形心智圖結構：'+token);
assert.ok(html.includes('每一個方塊都是獨立節點，線就是實際操作順序'),'2BL 路徑必須以節點＋連線呈現');
assert.ok(html.includes('手機可左右滑動查看完整心智圖'),'手機版必須可橫向查看完整心智圖');
assert.ok(html.includes('尚未做'),'世界樹必須明確顯示尚未做狀態');
assert.ok(!html.includes('substepsHtml')&&!html.includes('detailSubsteps'),'不得再把 2BL 路徑塞成文字子清單');
assert.ok(!html.includes('wt-summary')&&!html.includes('wt-stat'),'不得回到卡片式進度儀表板');

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
const admin=market.children.find(x=>x.id==='market-admin-path');
for(const title of ['場次設定','待辦','審核','付款確認','排位／設備','退款','財務結案']) assert.ok(admin.children.some(x=>x.title===title),'2BL 後台主辦路徑缺少：'+title);
const loop=market.children.find(x=>x.id==='market-close-loop');
for(const title of ['按鈕／操作','Core／API','Supabase SSOT','重讀正式資料','畫面同步']) assert.ok(loop.children.some(x=>x.title===title),'2BL 系統閉環缺少：'+title);
assert.ok(data.branches.some(x=>x.status==='todo')||data.branches.some(x=>x.children?.some(c=>c.status==='todo')),'世界樹必須保留尚未做項目，不得把未驗證工作冒充完成');
const roles=data.branches.find(x=>x.id==='roles');
assert.equal(roles.children.length,5,'角色／權限必須保留 5 類角色');
const shared=data.branches.find(x=>x.id==='shared-modules');
assert.equal(shared.children.length,10,'共用模組必須保留 10 項固定模組');

console.log(JSON.stringify({result:'PASS',layout:'graphical-mindmap-with-connected-nodes',version:data.version,criticalMarketNodes:7,twoBL:{frontNodes:7,adminNodes:7,closeLoopNodes:5},roles:5,sharedModules:10,todoProtected:true,textListFallback:false,mobile:'horizontal-pan'},null,2));
