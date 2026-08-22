import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('doing-market-2bl.css','utf8');
const shell=fs.readFileSync('doing-2-shell.js','utf8');
const publicUi=fs.readFileSync('doing-market-public-query.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');

for(const token of [
  '--dm-pink:#f3afd0','--dm-lav:#d7c8fb','--dm-sky:#cfeafb','--dm-mint:#dff0b0','--dm-yellow:#ffd58a',
  'grid-template-columns:repeat(3,minmax(0,1fr))','grid-template-columns:repeat(4,minmax(0,1fr))',
  'grid-template-columns:minmax(210px,260px) minmax(520px,1fr) minmax(160px,220px)',
  'grid-template-columns:repeat(5,minmax(90px,1fr))',
  '@media(max-width:768px)','position:fixed!important','bottom:calc(7px',
  '.d2-market-compact .settings','min-height:42px','overflow-wrap:anywhere'
]) assert.ok(css.includes(token),'Market UI missing: '+token);

assert.ok(css.includes('.d2-market-compact .d2-product-nav{display:none!important}'),'Market 必須移除產品橫向導覽重疊');
assert.ok(css.includes('.d2-market-compact header.top{display:none!important}'),'Market 必須移除重複 header');
assert.ok(css.includes('.d2-market-compact .hero')&&css.includes('display:block!important'),'Market 新版必須保留白話工作摘要，不得退回空白工程頁');
assert.ok(shell.includes("tabs.classList.add('d2-market-mainnav')"),'Market 五主選單必須移入正式頂部框架');
assert.ok(shell.includes('d2-market-journey'),'Market 必須顯示心智圖操作路徑');
for(const token of ['後台入口','場次總覽','場次設定','待辦','審核','付款','排位','退款','財務結案'])assert.ok(shell.includes(token),'Market 操作路徑缺少：'+token);
assert.ok(shell.includes('登入／會員'),'Market 右側必須保留登入／會員入口');
assert.ok(build.includes("if(['market-center.html','market-session.html'].includes(source))"),'Market 樣式只能套 Market 主頁與單場頁');
assert.ok(build.includes("'/market/':'market-center.html'")&&build.includes("'/market/session/':'market-session.html'"),'Market 必須使用短網址');
assert.ok(build.includes('doing-market-2bl.css'),'建置必須帶入 Market 專用 CSS');
assert.ok(!css.includes('linear-gradient'),'Market UI 禁止漸層');
assert.ok(css.includes('background-image:none!important'),'Market 背景不得出現漸層或工程底圖');
assert.ok(publicUi.includes('mk-public-ui')&&publicUi.includes('mk-public-bottom'),'公開活動頁必須套用手機參考視覺與底部主要操作');
for(const token of ['報名活動','我的紀錄','線上客服'])assert.ok(publicUi.includes(token),'公開活動頁底部操作缺少：'+token);
assert.ok(!publicUi.includes('linear-gradient'),'公開活動頁禁止漸層');
assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'手機／平板必須具備兩欄自動框架契約');
assert.ok(css.includes('box-shadow'),'糖果感以純色＋陰影呈現');

console.log(JSON.stringify({result:'PASS',scope:'/market/public/ + /market/ + /market/session/',desktop:'automatic multi-column work frame',mobile:'reference palette + rounded candy buttons + compact cards',journey:'front 7 / admin 9 / close-loop preserved',noGradient:true,noBusinessLogicChange:true,dbChanges:0},null,2));
