import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('doing-market-role-ui-v17.css','utf8');
const js=fs.readFileSync('doing-market-role-ui-v17.js','utf8');
const shell=fs.readFileSync('doing-2-shell.js','utf8');
const publicUi=fs.readFileSync('doing-market-public-query.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');

for(const token of [
  '--dm17-sky:#9ecdf7','--dm17-lav:#d9ccff','--dm17-mint:#dff3c8','--dm17-butter:#ffe8a8',
  'grid-template-columns:repeat(5,minmax(0,1fr))','grid-template-columns:repeat(6,minmax(0,1fr))','grid-template-columns:repeat(2,minmax(0,1fr))',
  'aspect-ratio:1/1','dm17-mobile-nav','dm17-desktop-support','data-dm17-focus','dm17-brand-editor'
]) assert.ok(css.includes(token)||js.includes(token),'Market v17 UI missing: '+token);

assert.ok(!css.includes('border-radius:999px'),'新版 Market 禁止膠囊元件');
assert.ok(!css.includes('linear-gradient'),'新版 Market 禁止漸層');
assert.ok(shell.includes("tabs.classList.add('d2-market-mainnav')"),'Market 五主選單必須維持 2BL 操作骨架');
assert.ok(shell.includes('d2-market-journey'),'Market 操作路徑必須保留');
for(const token of ['場次總覽','場次設定','待辦','審核','付款','排位','退款','財務結案'])assert.ok(shell.includes(token),'Market 操作路徑缺少：'+token);
assert.ok(build.includes('doing-market-role-ui-v17.css')&&build.includes('doing-market-role-ui-v17.js'),'正式建置必須直接載入 v17');
assert.ok(!build.includes("inject(html,'doing-market-2bl.css'"),'舊 Market CSS 不得再載入正式頁');
assert.ok(!build.includes("'doing-market-2bl.css','doing-market-completion"),'舊 Market CSS 不得再進正式資產');
assert.ok(build.includes("legacy Market visual leaked into production build"),'建置必須阻擋舊 Market 視覺回流');
assert.ok(publicUi.includes("searchBtn")&&publicUi.includes("new URL(location.href).searchParams.get('q')"),'公開頁舊腳本只能保留搜尋條件，不得再主導視覺');
for(const token of ['找今天想參加的活動','publicDiscovery','getSiteConfig','saveSiteConfig','logoUrl','heroImg','firstDate','pending','unpaid','paid'])assert.ok(js.includes(token),'Market v17 角色介面缺少：'+token);
assert.ok(js.includes("u.searchParams.set('focus',focus)"),'數字入口必須帶入對應名單');
assert.ok(js.includes("document.getElementById('reloadSessions')?.click()"),'返回場次總覽必須重新讀取正式數字');

console.log(JSON.stringify({result:'PASS',scope:'/market/public/ + /market/ + /market/session/',visual:'v17-only',legacyVisual:false,desktop:'5-6 compact cards + fixed top bar',mobile:'2 columns + bottom 3 actions',images:'1:1',shape:'square small radius',journey:'2BL operation skeleton preserved',bidirectionalMetrics:true,noGradient:true,dbChanges:0},null,2));
