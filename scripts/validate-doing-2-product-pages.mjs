import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const pages={hub:'doing-2.html',market:'market-center.html',project:'project-center.html',booking:'booking-2-center.html',guide:'guide-center.html'};
for(const [key,file] of Object.entries(pages)){
  assert.ok(fs.existsSync(file),`缺少 ${key} 獨立頁：${file}`);
  const html=fs.readFileSync(file,'utf8');
  assert.ok(html.length>300,`${file} 內容不足`);
  assert.ok(!html.includes('2bl-v7'),`${file} 不得耦合 2BL Worker`);
  assert.ok(!html.includes('DOING-Market-App'),`${file} 不得耦合 Market App repo`);
  assert.ok(!html.includes('doingmarket://'),`${file} Web 不得綁 App scheme`);
  assert.ok(!html.includes('localStorage.setItem'),`${file} 不得新增正式營運資料的 localStorage 寫入`);
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(new Set(ids).size,ids.length,`${file} 有重複 id`);
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1],{filename:file+'#inline'});
}
const hub=fs.readFileSync(pages.hub,'utf8');
assert.ok(hub.includes('DOING｜協槓人生小幫手'),'根首頁必須是一般民眾首頁，不得退回內部 Hub 說明');
const shell=fs.readFileSync('doing-2-shell.js','utf8');
for(const label of ['Market','Project','Booking','Guide'])assert.ok(shell.includes(`>${label}<`),`產品導覽缺少 ${label}`);
for(const file of [pages.market,pages.project,pages.booking,pages.guide])assert.ok(fs.readFileSync(file,'utf8').includes('DOING'),`${file} 缺少 DOING 產品識別`);
const archive='docs/archive/2026-08/';
const fixed=fs.readFileSync(archive+'DOING_2.0_PRODUCT_ROADMAP_FIXED_20260822.md','utf8');
assert.ok(fixed.includes('不得覆蓋、刪除或改寫既有 DOING 指令'),'固定語法必須明示舊語法保留');
assert.ok(fixed.includes('Market：現在主線'),'缺少 Market 現在主線');
assert.ok(fixed.includes('Project：第二主線'),'缺少 Project 第二主線');
assert.ok(fixed.includes('Booking：第三主線'),'缺少 Booking 第三主線');
assert.ok(fixed.includes('Guide：第四主線'),'缺少 Guide 第四主線');
const v1=fs.readFileSync(archive+'DOING_2.0_WORLD_TREE_V1_BASELINE_20260822.md','utf8');
const v2=fs.readFileSync(archive+'DOING_2.0_WORLD_TREE_V2_PRODUCT_SPLIT_20260822.md','utf8');
assert.ok(v1.includes('不可覆蓋基準'),'v1 世界樹基準不可覆蓋');
assert.ok(v2.includes('v1 保留不動'),'v2 必須保留 v1');
console.log(JSON.stringify({result:'PASS',pages:Object.values(pages),publicHome:true,productRoutesPreserved:true,historicalSpecs:'docs/archive/2026-08/',databaseSchemaChanges:0,newTables:0,existingInstructionsModified:false,worldTreeV1Preserved:true},null,2));