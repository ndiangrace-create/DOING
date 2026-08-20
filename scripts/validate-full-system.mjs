import fs from 'node:fs';
import vm from 'node:vm';

const pages=['index.html','register.html','member-panel.html','admin.html','onsite.html','platform.html','about.html','photo.html'];
const read=file=>fs.readFileSync(file,'utf8');
const worker=read('worker.js');

function fail(message){throw new Error(message);}
function requireText(source,text,label){if(!source.includes(text))fail(`缺少全系統驗收項目：${label}`);}

for(const file of pages){
  const source=read(file);let count=0;
  if(/長按.{0,20}(LOGO|logo|圖示)|進入總管|總管入口|隱藏入口/.test(source))fail(`${file} 暴露隱藏總管入口操作提示`);
  for(const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
    if(match[1].trim())new vm.Script(match[1],{filename:`${file}#script${++count}`});
  }
}
const memberCompat=read('member.html');
requireText(memberCompat,'member-panel.html','舊 member 相容入口必須導向內部會員面板');
requireText(memberCompat,'index.html','舊 member 相容入口必須回到新版首頁流程');
if(/<section[^>]+id=["']loginView["']/.test(memberCompat))fail('舊 member.html 仍殘留完整登入 UI');
const admin=read('admin.html');
const sessionCardSource=admin.match(/function renderSessionCard\(s\)\{([\s\S]*?)\n\}\n\nasync function copySessionAction/)?.[1]||'';
if(!sessionCardSource||/\bm\s*\./.test(sessionCardSource))fail('營運項目卡片仍引用未定義的會員變數 m');
const definitions=new Set([...admin.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(x=>x[1]));
for(const match of admin.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g))definitions.add(match[1]);
const ignoredHandlers=new Set(['add','open','stopPropagation','getElementById','confirm','prompt','alert','setTimeout','clearTimeout']);
const missingHandlers=new Set();
for(const attr of admin.matchAll(/on(?:click|change|input|submit|load|error)=["']([^"']+)["']/g)){
  for(const call of attr[1].matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)){
    if(!definitions.has(call[1])&&!ignoredHandlers.has(call[1]))missingHandlers.add(call[1]);
  }
}
if(missingHandlers.size)fail(`後台按鈕呼叫不存在的函式：${[...missingHandlers].sort().join('、')}`);

for(const fn of ['sessionDates','sessionDate','sessionAddons','sessionEquip','sessionInvoiceTax','sessionBool','sessionEventOptionsHtml','renderSessionDateRows','collectSessionDates','sessionEquipFormHtml','collectSessionEquip','collectCoorgValues','agreementTemplateOptionsHtml','syncAgreementTemplateSelection','attendanceDialog','closePanel','financeMoneyStat']){
  if(!definitions.has(fn))fail(`後台核心函式不存在：${fn}`);
}
for(const id of ['set_name','set_region','set_venue','set_eventId','set_organizer','set_coorg','set_status','set_desc','set_cover','set_paymentProfileId','set_agreementContent'])requireText(admin,`id="${id}"`,`場次設定欄位 ${id}`);
requireText(worker,'equip: safeJson(s.equip_json, {})','場次設備由資料庫讀回後台');
requireText(admin,"agreementContent:$('set_agreementContent')?.value||''",'所選合約正文寫回場次');
requireText(worker,"status=in.(%E5%A0%B1%E5%90%8D%E4%B8%AD,%E9%96%8B%E6%94%BE%E4%B8%AD,%E9%96%8B%E6%94%BE)&select=*",'租戶首頁接受報名中、開放中與開放三種正式公開狀態');
requireText(worker,'status=in.(報名中,開放中,開放)&select=*','場次清單接受報名中、開放中與開放三種正式公開狀態');
requireText(worker,"isPaidOperatingSession(s)||activityEntitled(T,s.id)",'公開探索接受事後按實收計費的收費活動');
requireText(worker,'if(isPaidOperatingSession(s))return true','租戶前台接受事後按實收計費的收費活動');
requireText(worker,"isPaidOperatingUnit(u)||unitEntitled(T,u.id)",'公開探索接受事後按實收計費的收費營運項目');
requireText(worker,'if(isPaidOperatingUnit(u))return true','租戶前台接受事後按實收計費的收費營運項目');
requireText(worker,'function publicCatalogRow(row)','公開首頁必須統一辨識並排除測試資料');
requireText(worker,'if(!publicCatalogRow(s))continue','跨租戶公開搜尋不得顯示測試場次');
requireText(worker,'visibleEventRows=eventRows.filter(publicCatalogRow),visibleSessionRows=sessionRows.filter(publicCatalogRow),visibleUnitRows=unitRows.filter(publicCatalogRow)','租戶公開頁不得顯示測試活動、場次或營運項目');

const routeActions=new Set([...worker.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)].map(x=>x[1]));
for(const m of worker.matchAll(/\b(?:action|act)\s*={2,3}\s*['"]([^'"]+)['"]/g))routeActions.add(m[1]);
const frontendActions=new Set();
for(const file of pages){
  const source=read(file);
  for(const m of source.matchAll(/\b(?:apiGet|apiPost)\(\s*['"]([^'"]+)['"]/g))frontendActions.add(m[1]);
  if(['platform.html','onsite.html'].includes(file))for(const m of source.matchAll(/(?<![.\w])(?:get|post)\(\s*['"]([^'"]+)['"]/g))frontendActions.add(m[1]);
  for(const m of source.matchAll(/\baction\s*:\s*['"]([^'"]+)['"]/g))frontendActions.add(m[1]);
}
const nonRoutePayloadActions=new Set(['admin_assign','admin_unassign']);
const missingRoutes=[...frontendActions].filter(x=>!routeActions.has(x)&&!nonRoutePayloadActions.has(x)).sort();
if(missingRoutes.length)fail(`前台呼叫但 Worker 沒有路由：${missingRoutes.join('、')}`);

if(read('worker.txt')!==worker)fail('worker.js 與正式部署副本 worker.txt 不一致');
const platformPage=read('platform.html'),memberPage=read('member-panel.html'),adminPage=read('admin.html'),indexPage=read('index.html');
requireText(indexPage,'function fallbackPublicImages(root=document)','公開活動圖片失效時必須顯示安全替代內容');
const homeRefresh=read('doing-home-refresh.js'),homeRefreshCss=read('doing-home-refresh.css');
requireText(homeRefresh,'openMemberWorkspaceAdmin(spaces[0],true)','單一營運空間必須先換發指定租戶憑證再進入預約日曆');
requireText(memberPage,'createMemberWorkspaceAdminSession','會員功能面板必須先換發指定租戶憑證再進入後台');
requireText(memberPage,'安排預約日曆','會員功能面板可直接進入預約日曆');
requireText(adminPage,"if(from==='tenant'&&tenant)return {href:'index.html?tenant='+encodeURIComponent(tenant)",'租戶後台可回到原營運首頁');
if(homeRefreshCss.includes('@media(max-width:820px){#doingGlobalFixedNav'))fail('手機樣式會把隱藏的全平台導覽錯誤顯示在租戶頁');
for(const page of ['world','access','applications','tenants','billing','exposure','support','members']){
  if(!platformPage.includes(`data-platform-page="${page}"`))fail(`平台切頁缺少入口：${page}`);
  if(!platformPage.includes(`data-platform-panel="${page}"`))fail(`平台切頁缺少內容：${page}`);
}
if(platformPage.includes('scrollIntoView({behavior:\'smooth\''))fail('平台仍存在舊式長頁捲動導覽');
if(memberPage.includes('查看品牌'))fail('會員功能面板仍存在語意不明的重複品牌跳頁');
if((memberPage.match(/data-page="brands"/g)||[]).length!==1||(memberPage.match(/data-panel="brands"/g)||[]).length!==1)fail('會員功能面板必須只有一個正式「我的品牌」分頁與內容面板');
for(const field of ['approvedAt','paymentReportedAt','paidAt','checkinAt','refundedAt','participants','addonQty'])if(!worker.includes(field))fail(`會員活動回傳缺少欄位：${field}`);
for(const marker of ['application_created','application_submitted','application_approved','supplement_requested','application_rejected'])if(!worker.includes(marker))fail(`申請時間軸缺少事件：${marker}`);
if(!adminPage.includes('admin-final-responsive-fix'))fail('主辦後台缺少最終響應式修正');
for(const marker of [
  'position:fixed!important;top:0!important;right:0!important;left:0!important;z-index:90!important;',
  'position:fixed!important;top:var(--admin-topbar-height)!important;right:24px!important;left:24px!important;z-index:80!important;',
  'grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))!important;',
  'function keepAdminNavigationPinned()',
  'observer.observe(topbar);observer.observe(tabs)'
])requireText(adminPage,marker,`主辦後台頂部操作列固定 ${marker}`);
for(const marker of [
  '.doing-admin .tabs{\n    position:relative!important;',
  'position:relative!important;',
  'inset:auto!important;',
  'top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;',
  'clear:both!important;'
])requireText(adminPage,marker,`主辦後台導覽與內容不重疊 ${marker}`);
for(const marker of [
  'font-size:17px!important',
  'font-size:18px!important',
  'min-height:48px!important',
  "setTodoFilter(\\'payment\\')",
  "switchPage(\\'finance\\')",
  'renderDoingCommandCenter(all)',
  'adminPageFromHash()'
])requireText(adminPage,marker,`主辦營運待辦可讀可操作 ${marker}`);
const capabilityMap=JSON.parse(read('doing-capabilities.json'));
for(const module of capabilityMap.modules||[]){
  if(module.area!=='未來擴充'&&!module.route)fail(`功能盤點模組缺少對應操作頁：${module.title}`);
}
for(const marker of ['DOING 營運世界樹','data-world-role','data-world-status','下一步／返回'])requireText(platformPage,marker,`營運世界樹缺少可操作導航 ${marker}`);
console.log(`全系統靜態驗收通過：${pages.length} 個正式功能頁＋member 相容轉址、${frontendActions.size} 個前端 API 動作、後台按鈕函式完整。`);
await import('./validate-ui-clickthrough-contract.mjs');
