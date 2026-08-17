import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const recordPath=path.join(root,'doing-test-records.json');
const excluded=new Set(['doing-test-records.json']);
const includedExtensions=new Set(['.html','.css','.js','.json','.sql','.mjs','.yml','.yaml']);
function filesIn(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    if(entry.name.startsWith('.')&&entry.name!=='.github')return [];
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())return filesIn(full);
    const relative=path.relative(root,full).replaceAll(path.sep,'/');
    return includedExtensions.has(path.extname(entry.name))&&!excluded.has(relative)?[relative]:[];
  });
}
function fingerprint(){
  const hash=crypto.createHash('sha256');
  for(const relative of filesIn(root).sort())hash.update(relative).update('\0').update(fs.readFileSync(path.join(root,relative))).update('\0');
  return hash.digest('hex');
}

const record=JSON.parse(fs.readFileSync(recordPath,'utf8'));
const productRules=fs.readFileSync(path.join(root,'DOING_產品規則與更新紀錄.md'),'utf8');
for(const required of ['需求累積與單次發布規則','這批一起發布','確認一次發布','禁止推送正式分支','取代先前「驗證成功即可直接部署」'])assert.ok(productRules.includes(required),'DOING 專案缺少整批單次發布固定規則：'+required);
assert.equal(record.schemaVersion,1);
assert.equal(record.deploymentTarget,'tobeloved-api');
assert.equal(record.forbiddenTarget,'2bl-v7');
assert.equal(record.productionWrites,0);
assert.ok(Array.isArray(record.tests)&&record.tests.length>=15,'每一類測試都必須留下紀錄');
assert.ok(record.tests.every(test=>test.id&&test.command&&test.scope&&test.result==='PASS'),'測試履歷不可缺少指令、範圍或 PASS 結果');
assert.equal(new Set(record.tests.map(test=>test.id)).size,record.tests.length,'測試類型不可重複');
const current=fingerprint();
if(process.argv.includes('--fingerprint')){
  console.log(current);
  process.exit(0);
}
assert.equal(record.sourceFingerprint,current,'程式已有變動，舊測試紀錄不可沿用；請重跑測試並更新 sourceFingerprint');
console.log(JSON.stringify({result:'PASS',reusable:true,recordedAt:record.recordedAt,sourceFingerprint:current,testTypes:record.tests.length,productionWrites:record.productionWrites},null,2));
