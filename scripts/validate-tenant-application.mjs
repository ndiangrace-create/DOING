import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const worker=read('worker.js'),about=read('about.html'),platform=read('platform.html'),admin=read('admin.html'),member=read('member.html');
const requiredKeys=['registration','review','payment','equipment','seatSelection','checkin','invoice','workshopSlots','service','resource','participants','customFields','addons','agreement','i18n','googleCalendar'];

for(const key of requiredKeys){
  if(!worker.includes(`${key}: true`))throw new Error(`Worker 核准模組缺少 ${key}`);
  if(!platform.includes(`${key}:`))throw new Error(`平台模組標籤缺少 ${key}`);
}
for(const marker of ['signupModulePreview','applicationModuleDefaults','confirmations.confirmReal','module_flags','approvedModuleFlags']){
  if(!(about+worker+platform).includes(marker))throw new Error(`申請流程缺少 ${marker}`);
}
if(!platform.includes('data-application-module'))throw new Error('平台審核沒有可調整的模組勾選');
if(!platform.includes("post('approveApply',{apply_id:selectedApplication.id,module_flags})"))throw new Error('平台核准未傳遞模組設定');
if(!worker.includes('normalizeApprovedModuleFlags(b.module_flags,suggestedFlags)'))throw new Error('Worker 未套用平台核准模組');
if(!worker.includes('if(approvedFlags[key]===false)defaults[key]=false'))throw new Error('未阻擋未核准模組進入主辦預設');
if(!admin.includes('系統會直接帶入已核准的常用功能'))throw new Error('主辦新增場次沒有說明核准模組預設');
if(!member.includes('申請營運帳號'))throw new Error('會員中心缺少營運帳號入口');

// 模擬：市集申請 → 平台移除付款 → 主辦預設不得重新開啟付款。
const questionnaire={registration:true,review:true,payment:true,equipment:true,seatSelection:true,checkin:true,customFields:true};
const platformChoice={...questionnaire,payment:false};
const approved=Object.fromEntries(requiredKeys.map(k=>[k,k==='registration'?true:platformChoice[k]===true]));
const organizerDefaults={...questionnaire};
for(const key of requiredKeys)if(approved[key]===false)organizerDefaults[key]=false;
if(!approved.registration||!approved.seatSelection||!approved.customFields)throw new Error('申請建議模組沒有正確通過');
if(approved.payment||organizerDefaults.payment)throw new Error('平台關閉的模組仍能進入主辦預設');

console.log('營運帳號申請 → 平台核准 → 主辦預設：流程驗證通過');
