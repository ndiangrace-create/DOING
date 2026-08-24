import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const data=JSON.parse(fs.readFileSync('doing-world-tree-current.json','utf8'));
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const allowed=new Set(['done','progress','verify','todo','blocked']);
assert.ok(build.includes("'/world-tree/':'DOING World Tree'"),'CURRENT 世界樹正式網址必須保留 /world-tree/');

const expected=['Market','Project','Booking','Guide','會員／我的紀錄','申請','我的 DOING／工作空間','DOING 公開平台','角色／權限','共用模組','共用核心'];
for(const title of expected)assert.ok(data.branches.some(x=>x.title===title),'第一層世界樹缺少：'+title);
function validateNode(node,path){
  assert.ok(allowed.has(node.status),'節點狀態不合法：'+path+' / '+node.title);
  if(node.children){assert.ok(Array.isArray(node.children),'children 必須為陣列：'+path+' / '+node.title);for(const child of node.children)validateNode(child,path+' / '+node.title)}
}
for(const b of data.branches){assert.ok(['left','right'].includes(b.side),'分支必須指定左右位置：'+b.title);validateNode(b,'root')}

const market=data.branches.find(x=>x.title==='Market');
for(const id of ['market-front-path','market-admin-path','market-close-loop','market-main-tabs','market-session','market-public','market-settings'])assert.ok(market.children.some(x=>x.id===id),'Market 世界樹缺少：'+id);
const front=market.children.find(x=>x.id==='market-front-path');
for(const title of ['活動探索','會員／登入','報名','付款','排位／設備','現場','歷史紀錄'])assert.ok(front.children.some(x=>x.title===title),'Market 前台主線缺少：'+title);
const admin=market.children.find(x=>x.id==='market-admin-path');
for(const title of ['後台入口','場次總覽','場次設定','待辦','審核','付款確認','排位／設備','退款','財務結案'])assert.ok(admin.children.some(x=>x.title===title),'Market 後台主線缺少：'+title);
assert.equal(admin.children.filter(x=>x.id!=='admin-support').length,9,'Market 後台主操作骨架必須維持 9 步');
const loop=market.children.find(x=>x.id==='market-close-loop');
for(const title of ['按鈕／操作','Core／API','Supabase SSOT','重讀正式資料','畫面同步'])assert.ok(loop.children.some(x=>x.title===title),'系統閉環缺少：'+title);

const roles=data.branches.find(x=>x.id==='roles');assert.equal(roles.children.length,5,'角色／權限必須保留 5 類角色');
const shared=data.branches.find(x=>x.id==='shared-modules');assert.equal(shared.children.length,10,'共用模組必須保留 10 項固定模組');
let hasTodo=false;function scan(n){if(n.status==='todo'||n.status==='verify'||n.status==='blocked')hasTodo=true;for(const c of n.children||[])scan(c)}for(const b of data.branches)scan(b);assert.ok(hasTodo,'世界樹必須保留未完成／待驗證狀態，不得全部冒充完成');

execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
const built=fs.readFileSync('.doing-2-site/world-tree/index.html','utf8');
assert.ok(built.includes('data-doing-ui-state="rebuild-shell"'),'世界樹 UI 尚未重新製作時必須維持安全重建殼');
for(const bad of ['<form','<button','tobeloved-api','supabase.co','localStorage','sessionStorage'])assert.ok(!built.includes(bad),'世界樹重建殼不得發布舊操作：'+bad);

console.log(JSON.stringify({result:'PASS',authority:'doing-world-tree-current.json',route:'/world-tree/',uiState:'rebuild-shell',version:data.version,market:{frontMain:7,adminMain:9,closeLoopMain:5},roles:5,sharedModules:10,incompleteStatesProtected:true,productionWrites:0},null,2));
