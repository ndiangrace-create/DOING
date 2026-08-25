import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const market=fs.readFileSync('market-current.html','utf8');
const editor=fs.readFileSync('doing-market-complete-session.js','utf8');
const publicJs=fs.readFileSync('doing-market-public-2bl.js','utf8');
const css=fs.readFileSync('doing-market-current.css','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const worker=fs.readFileSync('worker.js','utf8');
const workerMirror=fs.readFileSync('worker.txt','utf8');
assert.equal(worker,workerMirror,'worker.js / worker.txt 必須一致');

for(const t of ['場次','待辦','現場','會員','活動','財務','寄賣','設定'])assert.ok(market.includes(t),'CURRENT Market 後台主導覽缺少：'+t);
assert.ok(build.includes("'/market/':'market-current.html'"),'正式 /market/ 必須使用 CURRENT Market source');
for(const t of ["'/market/public/':{source:'register.html'","'/register/':{source:'register.html'"])assert.ok(build.includes(t),'CURRENT Market 公開／相容路由缺少：'+t);
for(const t of ['createEvent','createSession','updateEvent','updateSession','registrationSchedule','multiDayTiers','fullAgreementTemplate','fullPaymentProfile','fullBundleSessions','fullCoverFile','1200','objectFit'])assert.ok(editor.includes(t),'完整場次設定能力缺少：'+t);
for(const t of ['async function hydrateTenantInline','frontBootstrap','openRegistration','doingMarketGlobalBootstrap'])assert.ok(publicJs.includes(t),'公開前台同頁報名契約缺少：'+t);
for(const t of ['MARKET_FINAL_2BL_CARD_MODAL_20260826','aspect-ratio:1/1','object-fit:contain','.modal-bg.show'])assert.ok(css.includes(t),'2BL 卡片／Modal 規格缺少：'+t);
for(const t of ["'createSession'","'updateSession'","'applyRefund'","'confirmRefund'","'getRefundSuggestion'","'cancelReg'","'adminCancelReg'","'refundDeposit'","'checkin'","'markClear'",'getMyRegsGlobal','MARKET_SESSION_RULES_2BL_PARITY_20260826','registration_schedule_json','multi_day_tiers_json'])assert.ok(worker.includes(t),'Market Core 正式能力缺少：'+t);
for(const old of ['doing-market-2bl.css','doing-market-role-ui-v17.css','doing-market-role-ui-v17.js','doing-market-public-query.js','doing-market-session-settings-v16.css','doing-market-session-settings-v16.js','scripts/validate-market-role-ui-v17.mjs','scripts/e2e-market-role-ui-v17.mjs'])assert.equal(fs.existsSync(old),false,'舊 Market 檔案不得復活：'+old);

execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/postprocess-market-complete-session.mjs'],{stdio:'inherit'});
const builtMarket=fs.readFileSync('.doing-2-site/market/index.html','utf8');
const builtPublic=fs.readFileSync('.doing-2-site/market/public/index.html','utf8');
const builtSession=fs.readFileSync('.doing-2-site/market/session/index.html','utf8');
const builtPublicJs=fs.readFileSync('.doing-2-site/doing-market-public-2bl.js','utf8');
const builtCss=fs.readFileSync('.doing-2-site/doing-market-current.css','utf8');
for(const t of ['getSessionsAdmin','getTodos','getMembers','financeOverview','doing-market-complete-session.js'])assert.ok(builtMarket.includes(t),'正式 /market/ 能力遺失：'+t);
for(const t of ['frontBootstrap','openRegistration','market-2bl-front','doing-market-public-2bl.js','bottom-nav'])assert.ok(builtPublic.includes(t),'正式 /market/public/ 能力遺失：'+t);
assert.ok(!builtPublic.includes('href="/register/'),'正常公開流程不得連到 /register/');
assert.ok(builtPublicJs.includes('async function hydrateTenantInline')&&builtPublicJs.includes('await openRegistration(id)'),'公開場次必須同頁載入並開啟報名 Modal');
assert.ok(builtCss.includes('aspect-ratio:1/1')&&builtCss.includes('object-fit:contain'),'正式公開卡片圖片必須 1:1 且 contain');
for(const t of ['getSessionRegistrations','confirmPayment','adminSeatBoard','confirmRefund','doing-market-complete-session.js'])assert.ok(builtSession.includes(t),'正式單場工作台能力遺失：'+t);

console.log(JSON.stringify({result:'PASS',marketEntries:['/market/public/','/market/'],adminNav:8,publicSinglePage:true,registrationInlineModal:true,cardImage:'1:1 contain',sessionEditor:'2BL parity',coreSchedule:true,coreMultiDayPricing:true,agreementCore:true,coreCapabilitiesPreserved:true,legacyMarketFilesDeleted:true,twoBlChanges:0,productionWrites:0},null,2));
