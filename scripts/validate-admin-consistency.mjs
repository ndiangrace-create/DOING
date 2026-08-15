import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin=fs.readFileSync(new URL('../admin.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const workerCopy=fs.readFileSync(new URL('../worker.txt',import.meta.url),'utf8');

assert.equal(worker,workerCopy,'worker.js 與 worker.txt 必須同步');
for(const marker of [
  '.doing-admin .tabs .tab{background:#ffffff!important',
  '.doing-admin .tabs .tab.active{background-color:#e1f1f5!important;background-image:none!important',
  '.doing-admin #sessionList .session-date-equip-list .chip,',
  '.doing-admin #page-finance #financeRefreshBtn{width:auto!important',
  '.doing-admin #sessionList .session3-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important',
  '.doing-admin #page-calendar .cal-days{grid-auto-rows:126px!important',
  'height:126px!important;min-height:126px!important',
  'const totalCells=Math.ceil((start+days)/7)*7',
  '第一步：先看每一場賺多少'
])assert(admin.includes(marker),`缺少後台一致性標記：${marker}`);

assert(!/linear-gradient|radial-gradient/i.test(admin),'主辦後台不得包含任何漸層');
for(const color of ['#f7f2e5','#dfd3b8','#d3ad47','#fffdf9','#f7f6f1','#f4f0ea','#fbf8f1']){
  assert(!admin.toLowerCase().includes(color),`主辦後台不得殘留混濁米褐色：${color}`);
}

const financeFunction=admin.slice(admin.indexOf('async function loadFinanceReports'),admin.indexOf('function openFinanceEntryForm'));
assert(financeFunction.indexOf('第一步：先看每一場賺多少')<financeFunction.indexOf("financeStatement('現金流量'"),'單場損益必須先於月彙總顯示');
for(const marker of [
  "if(period!=='all')sessions=sessions.filter(s=>_finInRange(_sessionFirstDate(s),bounds))",
  'const sessionTimeline={}',
  'sessionTimeline[bucket].income+=safeNum(row.operatingIncome)',
  '先依每個場次彙整完整生命週期'
])assert(worker.includes(marker),`缺少場次優先財務標記：${marker}`);

console.log('後台一致性驗收通過：淺色極簡、無漸層與米褐色、純色方格、按鈕不溢位、等尺寸月曆、單場先結算再按場次日期彙總。');
