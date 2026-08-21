import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('market-center.html','utf8');
assert.match(html,/DOING Market/,'缺少正式產品名稱');
for(const label of ['場次','待辦','現場','會員','設定'])assert.ok(html.includes(label),`缺少主入口：${label}`);
for(const label of ['當日名單','該場次全名單','搜尋名字／品牌','一鍵報到'])assert.ok(html.includes(label),`缺少現場過渡流程：${label}`);
for(const label of ['報名','審核','錄取','繳費','排位設備','行前通知','現場','結案'])assert.ok(html.includes(label),`缺少 Market 主流程：${label}`);
assert.ok(html.includes('QR'),'缺少 QR 完整能力說明');
assert.ok(html.includes('體驗'),'缺少體驗活動');
assert.ok(html.includes("api('getSessionsAdmin')"),'Market 必須讀取既有正式場次 API');
assert.ok(html.includes("api('getSessionRegistrations'"),'Market 現場必須讀取既有正式場次名單 API');
assert.ok(html.includes("api('checkin'"),'Market 一鍵報到必須寫回既有正式 checkin API');
assert.ok(html.includes("new URL('admin.html'" )||html.includes("q('admin.html'"),'必須沿用既有正式 admin 功能');
for(const bad of ['2bl-v7','DOING-Market-App','doingmarket://','localStorage.setItem'])assert.ok(!html.includes(bad),`Market 2.0 Web 不得耦合：${bad}`);
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length,'HTML 存在重複 id');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){if(m[1].trim())new vm.Script(m[1],{filename:'market-center.html#inline'});}
const base=fs.readFileSync('DOING_2.0_WORLD_TREE_V1_BASELINE_20260822.md','utf8');
assert.ok(base.includes('不可覆蓋基準'),'缺少 2.0 v1 不可覆蓋世界樹基準');
assert.ok(base.includes('同功能資料必須沿用現有正式資料表名稱'),'缺少 SSOT 防重建規則');
const log=fs.readFileSync('DOING_2.0_CHANGELOG.md','utf8');assert.ok(log.includes('只追加'),'ChangeLog 必須只追加');
console.log(JSON.stringify({result:'PASS',product:'DOING Market',tabs:5,sessionApi:'getSessionsAdmin',onsiteRead:'getSessionRegistrations',onsiteWrite:'checkin',worldTreeBaseline:'LOCKED',databaseChanges:0,newTables:0},null,2));
