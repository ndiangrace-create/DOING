import fs from 'node:fs';
import vm from 'node:vm';

const pages=['index.html','register.html','member.html','admin.html','onsite.html','platform.html','about.html','photo.html'];
const read=file=>fs.readFileSync(file,'utf8');
const worker=read('worker.js');

function fail(message){throw new Error(message);}
function requireText(source,text,label){if(!source.includes(text))fail(`缺少全系統驗收項目：${label}`);}

for(const file of pages){
  const source=read(file);let count=0;
  for(const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){
    if(match[1].trim())new vm.Script(match[1],{filename:`${file}#script${++count}`});
  }
}
const admin=read('admin.html');
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
console.log(`全系統靜態驗收通過：${pages.length} 頁、${frontendActions.size} 個前端 API 動作、後台按鈕函式完整。`);
