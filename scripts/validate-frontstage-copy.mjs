import assert from 'node:assert/strict';
import fs from 'node:fs';

const pages=['index.html','register.html','member.html','about.html','onsite.html','photo.html'];
const forbidden=[
  '系統會在背景比對',
  'Worker 依',
  '資料庫設定重新計算',
  '另依資料庫計算',
  '系統會依帳號辨識',
  '未經簡訊驗證的電話',
  '正在整理你的多重身分',
  '系統會自動判斷場次',
  '由系統持續自動',
  '依系統條件直接取消',
  '系統會先為你開啟這些功能'
];

for(const page of pages){
  const source=fs.readFileSync(new URL('../'+page,import.meta.url),'utf8');
  for(const phrase of forbidden)assert.equal(source.includes(phrase),false,`${page} 不得出現前台內部說明：${phrase}`);
}

const member=fs.readFileSync(new URL('../member.html',import.meta.url),'utf8');
assert.match(member,/我的報名/);
assert.match(member,/function goPage\(page\)/);
assert.match(member,/if\(rows\.length===1\)openBrandForm\(rows\[0\]\)/);
assert.doesNotMatch(member,/>我的活動</);

const register=fs.readFileSync(new URL('../register.html',import.meta.url),'utf8');
assert.match(register,/第一次申請可直接填寫/);
assert.doesNotMatch(register,/系統會在背景比對/);

const worker=fs.readFileSync(new URL('../worker.js',import.meta.url),'utf8');
assert.match(worker,/function isQaApplication\(row\)/);
assert.match(worker,/applicationRows\.filter\(x=>!isQaApplication\(x\)/);
assert.match(worker,/jsonOk\(rows\.filter\(row=>!isQaApplication\(row\)\)\)/);

console.log(JSON.stringify({result:'PASS',pages:pages.length,rules:forbidden.length,directBrandEdit:true,myRegistrationsLabel:true,qaApplicationsHiddenFromFormalLists:true},null,2));
