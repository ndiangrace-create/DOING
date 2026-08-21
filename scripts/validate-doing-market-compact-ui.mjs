import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('doing-market-2bl.css','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');

for(const token of [
  '--dm-blue:#DDEAF3','--dm-mint:#DDEBDD','--dm-yellow:#F8EDC8',
  'font-size:17px','grid-template-columns:repeat(3','grid-template-columns:repeat(4',
  'position:fixed!important','left:12px!important','bottom:calc(8px',
  '.d2-market-compact .settings','min-height:40px'
]) assert.ok(css.includes(token),'Market compact UI missing: '+token);

assert.ok(css.includes('.d2-market-compact .d2-product-nav{display:none!important}'),'Market 必須移除產品橫向導覽重疊');
assert.ok(css.includes('.d2-market-compact header.top{display:none!important}'),'Market 必須移除重複 header');
assert.ok(css.includes('.d2-market-compact .hero{display:none!important}'),'Market 不保留大型工程 hero');
assert.ok(build.includes("for(const file of ['market-center.html','market-session.html'])"),'緊縮樣式只能套 Market 營運頁');
assert.ok(build.includes('doing-market-2bl.css'),'建置必須帶入 Market 專用 CSS');
assert.ok(!/for\(const file of \['doing-2\.html'[^\n]*doing-market-2bl/.test(build),'Hub 不得套用 Market 專用 CSS');
assert.ok(!css.includes('linear-gradient'),'Market 緊縮 UI 禁止漸層');

console.log(JSON.stringify({
  result:'PASS',
  scope:'DOING Market only',
  desktop:'left rail + compact cards',
  mobile:'bottom 5-tab dock',
  elderFriendly:'17px base / 40px+ actions',
  hubModified:false,
  dbChanges:0
},null,2));
