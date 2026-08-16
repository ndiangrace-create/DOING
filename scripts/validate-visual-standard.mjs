import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync(new URL('../doing-home-refresh.css',import.meta.url),'utf8');
const tokens=fs.readFileSync(new URL('../doing-design-tokens.css',import.meta.url),'utf8');
const pageStyles=fs.readFileSync(new URL('../doing-pastel-pages.css',import.meta.url),'utf8');
const rules=fs.readFileSync(new URL('../DOING_首頁視覺基準.md',import.meta.url),'utf8');
const capabilities=JSON.parse(fs.readFileSync(new URL('../doing-capabilities.json',import.meta.url),'utf8'));
const pages=['member.html','register.html','about.html','admin.html','platform.html','onsite.html','photo.html'];

const palette={
  ink:'#363341',muted:'#756f7d',paper:'#fffdfd',pink:'#efa2c9',pinkStrong:'#d86eab',
  blue:'#91d7f4',blueStrong:'#5db7dc',yellow:'#ffe16a',yellowStrong:'#ffc53e',
  mint:'#ccefa8',purple:'#cdb8f4'
};

for(const [name,color] of Object.entries(palette)){
  assert.ok(home.toLowerCase().includes(color),`首頁缺少已定案色票 ${name} ${color}`);
  assert.ok(tokens.toLowerCase().includes(color),`設計 Token 缺少 ${name} ${color}`);
}

assert.match(rules,/DOING Homepage Pastel v1/);
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

const visual=capabilities.modules.find(module=>module.id==='platform-visual');
assert.ok(visual,'世界樹缺少 DOING 平台視覺基準');
assert.ok(visual.features.some(feature=>feature.status==='done'&&feature.label.includes('首頁粉彩色系')));
assert.ok(visual.features.some(feature=>feature.status==='done'&&feature.label.includes('逐頁套用')),'七個核心頁面完成套用後必須同步世界樹');

console.log(JSON.stringify({result:'PASS',standard:'DOING Homepage Pastel v1',paletteColors:Object.keys(palette).length,pagesApplied:pages.length,smallTiles:'rounded-square-only',worldTreeStatus:'all_core_pages_done'},null,2));
