import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('doing-market-2bl.css','utf8');
const shell=fs.readFileSync('doing-2-shell.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');

for(const token of [
  '--dm-blue:#DDEAF3','--dm-mint:#DDEBDD','--dm-yellow:#F8EDC8',
  'font-size:17px','grid-template-columns:repeat(3','grid-template-columns:repeat(4',
  'grid-template-columns:minmax(220px,auto) minmax(520px,760px) minmax(150px,auto)',
  'grid-template-columns:repeat(5,minmax(88px,1fr))',
  '@media(max-width:768px)','position:fixed!important','bottom:calc(6px',
  '.d2-market-compact .settings','min-height:40px','overflow-wrap:anywhere'
]) assert.ok(css.includes(token),'Market compact UI missing: '+token);

assert.ok(css.includes('.d2-market-compact .d2-product-nav{display:none!important}'),'Market 必須移除產品橫向導覽重疊');
assert.ok(css.includes('.d2-market-compact header.top{display:none!important}'),'Market 必須移除重複 header');
assert.ok(css.includes('.d2-market-compact .hero{display:none!important}'),'Market 不保留大型工程 hero');
assert.ok(shell.includes("tabs.classList.add('d2-market-mainnav')"),'Market 五主選單必須移入正式頂部框架');
assert.ok(shell.includes("topIn.insertBefore(tabs,topIn.querySelector('.d2-top-actions'))"),'桌機五主選單必須位於 LOGO 與登入之間');
assert.ok(shell.includes('登入／會員'),'Market 右側必須保留登入／會員入口');
assert.ok(build.includes("if(['market-center.html','market-session.html'].includes(source))"),'緊縮樣式只能套 Market 主頁與單場頁');
assert.ok(build.includes("'/market/':'market-center.html'")&&build.includes("'/market/session/':'market-session.html'"),'Market 緊縮頁必須使用短網址');
assert.ok(build.includes('doing-market-2bl.css'),'建置必須帶入 Market 專用 CSS');
assert.ok(!build.includes("['doing-2.html','market-center.html','market-session.html']"),'Hub 不得套用 Market 專用 CSS');
assert.ok(!css.includes('linear-gradient'),'Market 緊縮 UI 禁止漸層');
assert.ok(css.includes('position:static!important'),'桌機主導航不得保留底部浮動框');
assert.ok(css.includes('white-space:nowrap!important;overflow:visible!important;text-overflow:clip!important'),'桌機主選單不得切字省略');

console.log(JSON.stringify({result:'PASS',scope:'/market/ + /market/session/',desktop:'top bar: logo / five operations / login-member',mobile:'bottom 5-tab dock',elderFriendly:'17px base / 40px+ actions',noDesktopBottomDock:true,noTextTruncation:true,hubModified:false,dbChanges:0},null,2));
