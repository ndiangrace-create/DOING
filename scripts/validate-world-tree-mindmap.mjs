import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('world-tree.html','utf8');
const data=JSON.parse(fs.readFileSync('doing-world-tree-current.json','utf8'));

for(const token of ['tree-grid','side left','side right','trunk','connectors','branch status-','detail-list']) assert.ok(html.includes(token),'世界樹缺少真正心智圖結構：'+token);
assert.ok(html.includes('DOING 2.0 世界樹'),'缺中央主幹標題');
assert.ok(html.includes('可左右滑動查看整棵樹'),'手機版必須可橫向查看整棵樹');
assert.ok(!html.includes('wt-summary')&&!html.includes('wt-stat'),'不得回到卡片式進度儀表板');

const expected=['Market','Project','Booking','Guide','會員／我的紀錄','申請','共用核心'];
for(const title of expected) assert.ok(data.branches.some(x=>x.title===title),'第一層世界樹缺少：'+title);
for(const b of data.branches){
  assert.ok(['left','right'].includes(b.side),'分支必須指定左右位置：'+b.title);
  assert.ok(['done','progress','verify','blocked'].includes(b.status),'分支狀態不合法：'+b.title);
  assert.ok(Array.isArray(b.children),'分支缺少 children：'+b.title);
}
const market=data.branches.find(x=>x.title==='Market');
for(const title of ['主工作頁','單場工作頁','公開活動','設定／現場']) assert.ok(market.children.some(x=>x.title===title),'Market 世界樹缺少：'+title);

console.log(JSON.stringify({result:'PASS',layout:'central-trunk-left-right-mindmap',version:data.version,branches:data.branches.length,mobile:'horizontal-pan',dashboardCards:false},null,2));
