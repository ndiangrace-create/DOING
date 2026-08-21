import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('market-center.html','utf8');
const session=fs.readFileSync('market-session.html','utf8');
assert.match(html,/DOING Market/,'缺少正式產品名稱');
for(const label of ['場次','待辦','現場','會員','設定'])assert.ok(html.includes(label),`缺少主入口：${label}`);
for(const label of ['當日名單','該場次全名單','搜尋名字／品牌','一鍵報到'])assert.ok(html.includes(label),`缺少現場過渡流程：${label}`);
for(const label of ['報名','審核','錄取','繳費','排位設備','行前','現場','結案'])assert.ok(html.includes(label),`缺少 Market 主流程：${label}`);
assert.ok(html.includes('QR'),'缺少 QR 完整能力說明');
for(const action of ["api('getSessionsAdmin')","api('getTodos')","api('getMembers')","api('getSessionRegistrations'","api('checkin'"])assert.ok(html.includes(action),`Market 主頁缺少正式 API：${action}`);
assert.ok(html.includes('market-session.html'),'場次卡必須可進 DOING Market 單場工作台');
for(const label of ['總覽','報名審核','付款','排位設備','通知','現場','結案'])assert.ok(session.includes(label),`單場工作台缺少：${label}`);
for(const action of ["api('getSessionDashboard'","api('getSessionRegistrations'","api('approveReg'","api('confirmPayment'","api('checkin'"])assert.ok(session.includes(action),`單場工作台缺少正式 API：${action}`);
assert.ok(session.includes('admin.html'),'排位、財務等進階能力必須沿用既有正式後台');
for(const bad of ['2bl-v7','DOING-Market-App','doingmarket://','localStorage.setItem']){assert.ok(!html.includes(bad),`Market 2.0 Web 不得耦合：${bad}`);assert.ok(!session.includes(bad),`Market 單場工作台不得耦合：${bad}`)}
for(const [name,source] of [['market-center.html',html],['market-session.html',session]]){
 const ids=[...source.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length,`${name} 存在重複 id`);
 for(const m of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){if(m[1].trim())new vm.Script(m[1],{filename:name+'#inline'});}
}
const base=fs.readFileSync('DOING_2.0_WORLD_TREE_V1_BASELINE_20260822.md','utf8');
const v3=fs.readFileSync('DOING_2.0_WORLD_TREE_V3_MARKET_EXECUTION_20260822.md','utf8');
const v4=fs.readFileSync('DOING_2.0_WORLD_TREE_V4_MARKET_OPERATIONS_20260822.md','utf8');
assert.ok(base.includes('不可覆蓋基準'),'缺少 2.0 v1 不可覆蓋世界樹基準');
assert.ok(base.includes('同功能資料必須沿用現有正式資料表名稱'),'缺少 SSOT 防重建規則');
assert.ok(v3.includes('單場工作台')&&v3.includes('本次新增資料表：0'),'v3 Market 執行世界樹未同步');
assert.ok(v4.includes('getTodos')&&v4.includes('getMembers')&&v4.includes('新資料表：0'),'v4 Market 日常營運世界樹未同步');
const log=fs.readFileSync('DOING_2.0_CHANGELOG.md','utf8');assert.ok(log.includes('只追加'),'ChangeLog 必須只追加');
console.log(JSON.stringify({result:'PASS',product:'DOING Market',tabs:5,sessionWorkbench:7,sessionApi:'getSessionsAdmin',todoRead:'getTodos',memberRead:'getMembers',registrationRead:'getSessionRegistrations',reviewWrite:'approveReg',paymentWrite:'confirmPayment',onsiteWrite:'checkin',worldTreeBaseline:'LOCKED',worldTreeExecution:'v4',databaseChanges:0,newTables:0},null,2));
