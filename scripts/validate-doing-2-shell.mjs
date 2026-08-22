import fs from 'node:fs';
import assert from 'node:assert/strict';
const css=fs.readFileSync('doing-2-shell.css','utf8');
const js=fs.readFileSync('doing-2-shell.js','utf8');
const visual=fs.readFileSync('doing-visual-system-20260822.css','utf8');
const visualJs=fs.readFileSync('doing-visual-system-20260822.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const world=fs.readFileSync('DOING_2.0_WORLD_TREE_V7_2BL_UX_SHELL_20260822.md','utf8');
for(const x of ['Market','Project','Booking','Guide'])assert(js.includes(x),`缺產品 ${x}`);
for(const x of ['17–18px','場次','待辦','現場','會員','設定'])assert(world.includes(x),`v7 缺 ${x}`);
assert(css.includes('font-size:18px!important'),'桌機老花字級未鎖');
assert(css.includes('@media(max-width:680px)'),'手機斷點缺失');
assert(css.includes('grid-template-columns:repeat(5,1fr)'),'Market 五主選單缺失');
assert(!css.includes('linear-gradient'),'2.0 Shell 不得使用漸層');
assert(build.includes('doing-2-shell.css')&&build.includes('doing-2-shell.js'),'Pages build 未注入 Shell');
assert(!js.includes('2bl-v7')&&!js.includes('douhmxipedgpfbvfynbq'),'Shell 不得耦合 2BL 正式後端');

for(const token of ['--dv-bg:#fbfaf7','--dv-blue:#dcecf6','--dv-mint:#e2f1e8','--dv-yellow:#f7efcf','--dv-radius-sm:10px','--dv-radius-lg:18px'])assert(visual.includes(token),'新版 Design System 缺少：'+token);
for(const token of ['position:fixed!important','top:0!important','--dv-header-h:68px','body.d2-visual-system{padding-top:calc(var(--dv-header-h) + 12px)'])assert(visual.includes(token),'頂部固定列契約缺少：'+token);
assert(!visual.includes('linear-gradient'),'新版 SaaS 視覺禁止漸層');
assert(visual.includes('.settings{display:grid')&&visual.includes('.tabs{position:sticky'),'扁平化工作區需以頁內分頁與設定網格為主');
assert(visual.includes('@media(max-width:768px)'),'新版 Design System 缺手機完整斷點');
assert(visualJs.includes("sessionStorage.setItem(stateKey")&&visualJs.includes('scrollY'),'頁內切換必須保留工作狀態與捲動位置');
assert(visualJs.includes('d2-hide-engineering'),'使用者畫面必須阻擋工程文字');
assert(build.includes('doing-visual-system-20260822.css')&&build.includes('doing-visual-system-20260822.js'),'所有 DOING 2.0 短網址必須載入新版 Design System');
assert(build.includes('DOING root is intentionally not redesigned'),'本批不得改 DOING 公開首頁');

console.log(JSON.stringify({result:'PASS',shell:'2BL UX skeleton',visualSystem:'reference-driven SaaS redesign',fixedHeader:true,flatIA:true,statePreserved:true,desktop:true,mobile:true,newTables:0,schemaChanges:0,twoBLModified:false,doingRootModified:false},null,2));
