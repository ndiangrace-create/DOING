import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync(new URL('../doing-home-refresh.css',import.meta.url),'utf8');
const homeScript=fs.readFileSync(new URL('../doing-home-refresh.js',import.meta.url),'utf8');
const homeCore=fs.existsSync(new URL('../doing-home-refresh-core.js',import.meta.url))?fs.readFileSync(new URL('../doing-home-refresh-core.js',import.meta.url),'utf8'):'';
const homeProductScript=homeCore||homeScript;
const tokens=fs.readFileSync(new URL('../doing-design-tokens.css',import.meta.url),'utf8');
const pageStyles=fs.readFileSync(new URL('../doing-pastel-pages.css',import.meta.url),'utf8');
const rules=fs.readFileSync(new URL('../DOING_首頁視覺基準.md',import.meta.url),'utf8');
const capabilities=JSON.parse(fs.readFileSync(new URL('../doing-capabilities.json',import.meta.url),'utf8'));
const pages=['member-panel.html','register.html','about.html','admin.html','platform.html','onsite.html','photo.html'];
assert(home.includes('.price-card.primary .price-label')&&home.includes('color:#173943!important'),'收費方案白色標題膠囊必須使用深色文字，避免標題消失');
assert(!homeProductScript.includes('doing-proof-section')&&!homeProductScript.includes('doingSupportMount'),'首頁不得保留重複流程說明或另一套客服面板');
assert(homeProductScript.includes('id="doingPublicSupportFab"')&&homeProductScript.includes('function openPublicSupport()'),'首頁客服必須進入獨立的 DOING 民眾智慧小幫手');
assert(home.includes('DOING_HOME_FRAME_HIERARCHY_V1'),'首頁缺少大型區塊、內容卡與操作元件的統一形狀契約');
assert.match(home,/\.doing-public-support-fab\{[\s\S]*?background:#ffe16a!important/,'客服浮動按鈕必須使用 DOING LOGO 黃色');
assert.match(home,/\.doing-public-hero,[\s\S]*?border-radius:28px!important/,'首頁大型區塊必須統一 28px 圓角');
assert.match(home,/\.doing-hero-console,[\s\S]*?border-radius:16px!important/,'首頁內容卡必須統一 16px 圓角');
assert(homeProductScript.includes('<h1><span>找活動、報名、預約，</span><span>進度都在 DOING。</span></h1>'),'首頁主標題必須使用兩個完整語意行，禁止拆開「預約」');
assert(!homeProductScript.includes('<h1>找活動、報名、預約，<br>'),'首頁主標題不得用可造成單字破碎的 br 舊版排法');
assert(homeProductScript.includes('class="doing-public-section doing-slash-scenes"')&&homeProductScript.includes('平常是設計師、跑現場監工，假日又是手作老師。')&&homeProductScript.includes('辦市集，也辦活動、手作與體驗')&&homeProductScript.includes('美甲老師要服務客人，也會開課'),'首頁缺少直接可見的多角色斜槓人生情境');
assert(!homeProductScript.includes('<button type="button" data-public-support-open>報名／預約客服</button>'),'頁尾不得重複出現造成奇怪方框的客服按鈕');
assert(homeScript.includes('doing-home-refresh-core.js')||!homeCore,'登入路由層必須明確載入完整首頁核心');
assert.match(home,/首頁互動元件形狀契約[\s\S]*?\.doing-carousel-arrow[\s\S]*?border-radius:12px!important/);
assert.match(home,/\.doing-member-close,[\s\S]*?border-radius:10px!important/);
assert.match(home,/body\.doing-app \.doing-public-app button,[\s\S]*?border-radius:12px!important/);

const palette={
  ink:'#363341',muted:'#756f7d',paper:'#fffdfd',pink:'#efa2c9',pinkStrong:'#d86eab',
  blue:'#91d7f4',blueStrong:'#5db7dc',yellow:'#ffe16a',yellowStrong:'#ffc53e',
  mint:'#ccefa8',purple:'#cdb8f4'
};

for(const [name,color] of Object.entries(palette)){
  assert.ok(home.toLowerCase().includes(color),`首頁缺少已定案色票 ${name} ${color}`);
  assert.ok(tokens.toLowerCase().includes(color),`設計 Token 缺少 ${name} ${color}`);
}

assert.match(rules,/DOING Sky Mint v2/);
assert.match(rules,/天空藍與薄荷綠是全站主色/);
assert.match(rules,/粉紅不得作為全站主色/);
assert.match(rules,/小型資料格、功能格、數字格、圖示格固定使用圓角方形或圓角矩形/);
assert.match(rules,/小型格子禁止使用 `50%` 或 `999px` 圓角/);
assert.match(tokens,/--doing-brand-small-tile-radius:14px/);
assert.match(pageStyles,/body\.doing-member/);
assert.match(pageStyles,/body\.doing-register/);
assert.match(pageStyles,/body\.doing-about-refresh/);
assert.match(pageStyles,/body\.doing-admin/);
assert.match(pageStyles,/body\.doing-platform/);
assert.match(pageStyles,/body\.doing-onsite/);
assert.match(pageStyles,/body\.doing-photo/);
assert.match(pageStyles,/body\.doing-app \.metric,[\s\S]*?border-radius:var\(--doing-brand-small-tile-radius\)!important/);
assert.match(pageStyles,/Navigation and status may be pills\. Content tiles may not/);

for(const page of pages){
  const source=fs.readFileSync(new URL('../'+page,import.meta.url),'utf8');
  const tokensAt=source.indexOf('doing-design-tokens.css');
  const pageStylesAt=source.indexOf('doing-pastel-pages.css');
  assert.ok(tokensAt>=0,`${page} 尚未載入首頁設計 Token`);
  assert.ok(pageStylesAt>tokensAt,`${page} 的逐頁視覺層載入順序錯誤`);
}
const memberCompat=fs.readFileSync(new URL('../member.html',import.meta.url),'utf8');
assert.match(memberCompat,/member-panel\.html/,'member.html 必須只負責相容轉址至內部會員面板');
assert.doesNotMatch(memberCompat,/doing-design-tokens\.css/,'相容轉址頁不應再載入舊完整視覺資源');

const visual=capabilities.modules.find(module=>module.id==='platform-visual');
assert.ok(visual,'世界樹缺少 DOING 平台視覺基準');
assert.ok(visual.features.some(feature=>feature.status==='done'&&feature.label.includes('天空藍與薄荷綠主色')));
assert.ok(visual.features.some(feature=>feature.status==='done'&&feature.label.includes('逐頁套用')),'七個核心頁面完成套用後必須同步世界樹');

assert.match(tokens,/--doing-brand-primary:#91d7f4/);
assert.match(tokens,/--doing-brand-secondary:#ccefa8/);
assert.doesNotMatch(pageStyles,/body\.doing-member\{[^}]*doing-brand-pink/);
assert.doesNotMatch(pageStyles,/body\.doing-photo\{[^}]*doing-brand-pink/);

console.log(JSON.stringify({result:'PASS',standard:'DOING Sky Mint v2',primary:'sky-blue',secondary:'mint',pink:'accent-only',paletteColors:Object.keys(palette).length,pagesApplied:pages.length,memberCompat:true,smallTiles:'rounded-square-only',worldTreeStatus:'all_core_pages_done'},null,2));
