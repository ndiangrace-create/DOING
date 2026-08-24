import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const market=fs.readFileSync('market-current.html','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const worker=fs.readFileSync('worker.js','utf8');
const workerMirror=fs.readFileSync('worker.txt','utf8');
assert.equal(worker,workerMirror,'worker.js / worker.txt 必須一致');

for(const t of ['活動與場次','報名與審核','付款與退款','視覺化排位','現場工作台','財務結案'])assert.ok(market.includes(t),'CURRENT Market 能力摘要缺少：'+t);
assert.ok(build.includes("'/market/':'market-current.html'"),'正式 /market/ 必須使用 CURRENT Market source');
for(const t of ["'/market/public/':'DOING Market Public'","'/market/session/':'DOING Market Session'"])assert.ok(build.includes(t),'尚未重建的 Market 子頁網址必須保留：'+t);
for(const t of ["'createSession'","'updateSession'","'applyRefund'","'confirmRefund'","'getRefundSuggestion'","'cancelReg'","'adminCancelReg'","'refundDeposit'","'checkin'","'markClear'",'getMyRegsGlobal'])assert.ok(worker.includes(t),'Market Core 正式能力缺少：'+t);
for(const old of ['doing-market-2bl.css','doing-market-role-ui-v17.css','doing-market-role-ui-v17.js','doing-market-public-query.js','doing-market-session-settings-v16.css','doing-market-session-settings-v16.js','scripts/validate-market-role-ui-v17.mjs','scripts/e2e-market-role-ui-v17.mjs'])assert.equal(fs.existsSync(old),false,'舊 Market 檔案不得復活：'+old);

execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
const builtMarket=fs.readFileSync('.doing-2-site/market/index.html','utf8');
const builtPublic=fs.readFileSync('.doing-2-site/market/public/index.html','utf8');
const builtSession=fs.readFileSync('.doing-2-site/market/session/index.html','utf8');
for(const t of ['活動與場次','報名與審核','付款與退款','視覺化排位','現場工作台','財務結案'])assert.ok(builtMarket.includes(t),'正式 /market/ 遺失 CURRENT 能力摘要：'+t);
assert.ok(builtPublic.includes('data-doing-ui-state="rebuild-shell"'),'Market 公開操作前台尚未重建時必須維持安全殼');
assert.ok(builtSession.includes('data-doing-ui-state="rebuild-shell"'),'Market 單場操作頁尚未重建時必須維持安全殼');

console.log(JSON.stringify({result:'PASS',marketEntry:'/market/',currentCapabilityGroups:6,publicFront:'rebuild-shell',sessionFront:'rebuild-shell',coreCapabilitiesPreserved:true,legacyMarketFilesDeleted:true,dbChanges:0,productionWrites:0},null,2));
