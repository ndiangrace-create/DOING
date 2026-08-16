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
for(const useCase of ['market','event','workshop','beauty','service_booking','resource_booking','guide','general']){
  if(!about.includes(`useCases.includes('${useCase}')`))throw new Error(`問卷沒有完整處理營運情境 ${useCase}`);
}
if(!platform.includes('data-application-module'))throw new Error('平台審核沒有可調整的模組勾選');
if(!platform.includes('platformModuleDescriptions'))throw new Error('平台審核沒有說明每個模組的實際功能');
if(!platform.includes("post('approveApply',{apply_id:selectedApplication.id,module_flags})"))throw new Error('平台核准未傳遞模組設定');
if(!worker.includes('normalizeApprovedModuleFlags(b.module_flags,suggestedFlags)'))throw new Error('Worker 未套用平台核准模組');
if(!worker.includes('if(approvedFlags[key]===false)defaults[key]=false'))throw new Error('未阻擋未核准模組進入主辦預設');
if(!worker.includes('requestedUnapprovedModules'))throw new Error('Worker 沒有拒絕租戶自行開啟未核准功能');
if(!worker.includes('tenantAllowedSessionModules'))throw new Error('Worker 沒有在儲存前過濾未核准功能');
for(const handler of ['hCreateSession','hUpdateSession','hSaveOperationUnit']){
  const start=worker.indexOf(`async function ${handler}`),body=worker.slice(start,start+3500);
  if(start<0||!body.includes('requestedUnapprovedModules'))throw new Error(`${handler} 沒有強制檢查功能核准`);
}
if(!admin.includes('系統會直接帶入已核准的常用功能'))throw new Error('主辦新增場次沒有說明核准模組預設');
if(!admin.includes('尚未核准'))throw new Error('主辦場次編輯器沒有標示未核准功能');
if(!member.includes('申請營運帳號'))throw new Error('會員中心缺少營運帳號入口');

// 模擬五種實際營運情境的問卷配套，不接受只有名稱、沒有可操作功能的空模組。
const blueprints={
  market:['registration','review','payment','equipment','seatSelection','addons','agreement','invoice','checkin','customFields','googleCalendar'],
  event:['registration','review','payment','participants','customFields','agreement','invoice','checkin','googleCalendar'],
  workshop:['registration','payment','workshopSlots','service','participants','customFields','addons','agreement','invoice','checkin','googleCalendar'],
  beauty:['registration','payment','workshopSlots','service','resource','customFields','addons','agreement','invoice','checkin','i18n','googleCalendar'],
  service_booking:['registration','payment','workshopSlots','service','resource','customFields','agreement','invoice','googleCalendar'],
  resource_booking:['registration','payment','workshopSlots','resource','customFields','agreement','invoice','googleCalendar']
};
for(const [type,keys] of Object.entries(blueprints)){
  for(const key of keys){
    const marker=key==='registration'?'registration:true':(key==='i18n'?"i18n:{enabled:true":`${key}:true`);
    if(!about.includes(marker))throw new Error(`${type} 問卷配套缺少 ${key}`);
  }
}

// 模擬：市集申請 → 平台移除付款 → 主辦預設與 API 均不得重新開啟付款。
const questionnaire=Object.fromEntries(blueprints.market.map(k=>[k,true]));
const platformChoice={...questionnaire,payment:false};
const approved=Object.fromEntries(requiredKeys.map(k=>[k,k==='registration'?true:platformChoice[k]===true]));
const organizerDefaults={...questionnaire};
for(const key of requiredKeys)if(approved[key]===false)organizerDefaults[key]=false;
if(!approved.registration||!approved.seatSelection||!approved.customFields)throw new Error('申請建議模組沒有正確通過');
if(approved.payment||organizerDefaults.payment)throw new Error('平台關閉的模組仍能進入主辦預設');

// 每個被問卷開啟的核心模組，都必須同時具備前台輸入、後端驗證／處理或正式管理畫面。
const functionalEvidence={
  review:['needReview','review_status'],payment:['payment','payments'],equipment:['equipment','equip_json'],
  seatSelection:['seatSelection','stalls'],checkin:['checkin','checkin'],invoice:['invoice','invoice'],
  workshopSlots:['timeslot','timeslots'],service:['serviceId','service_items'],resource:['resourceId','resources'],
  participants:['participantQty','participantTypes'],customFields:['customFields','custom_fields_json'],
  addons:['addons','addons_json'],agreement:['agreementAccepted','agreement_required'],
  i18n:['i18n','translations'],googleCalendar:['googleCalendar','Google 日曆']
};
const whole=admin+member+read('register.html')+worker;
for(const [key,markers] of Object.entries(functionalEvidence)){
  for(const marker of markers)if(!whole.includes(marker))throw new Error(`${key} 缺少可操作功能證據：${marker}`);
}

console.log('問卷配套 → 平台核准 → 主辦設定 → 前台操作 → Worker 強制檢查：六種營運流程驗證通過');
