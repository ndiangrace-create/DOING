import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const about=read('about.html');
const platform=read('platform.html');
const admin=read('admin.html');
const worker=read('worker.js');
const member=read('member.html');
const homeRefresh=read('doing-home-refresh.js');
const aboutRefresh=read('doing-about-refresh.js');
const flow=read('DOING_美類營運流程.md');

const requireText=(source,text,label)=>{if(!source.includes(text))throw new Error(`美類驗收缺少：${label}`)};

requireText(about,'value="beauty_wellness"><span><b>美類</b>','問卷產業統稱美類');
requireText(about,'value="beauty"><span><b>我提供美類或到店服務</b>','問卷以工作方式統稱美類');
requireText(platform,"beauty:'美類服務／預約'",'平台審核使用相同名稱');
requireText(platform,"beauty_wellness:'美類'",'平台產業統計使用相同名稱');
requireText(worker,"if(useCases.includes('beauty'))add({payment:true,workshopSlots:true,service:true,resource:true,customFields:true,addons:true,agreement:true,invoice:true,checkin:true,googleCalendar:true,i18n:{enabled:true",'美類完整初始模組位於後端');
requireText(admin,"beauty:{title:'美類'",'主辦美類預設');
requireText(admin,'<option value="beauty">美類服務</option>','營運項目可選美類');
requireText(worker,"'booking','beauty','workshop'",'Worker 接受美類營運項目');
requireText(member,'<option>美類</option>','會員品牌問卷統稱美類');
requireText(homeRefresh,"'手作體驗','美類','場地／攝影棚'",'首頁營運問卷統稱美類');
requireText(aboutRefresh,"beauty:{badge:'招募審核｜",'首頁改以跨產業工作方式呈現，且保留美類申請能力');
for(const text of ['服務人員','顧客到店','開始服務','完成服務','指定服務券','次數券／套票','儲值金','不得以猜測方式寫死資料規則'])requireText(flow,text,text);

if(/固定稱為美甲師|只支援美甲師/.test(flow))throw new Error('美類流程不得把服務人員寫死為美甲師');
if(/美業工作室|美業服務/.test(member+homeRefresh))throw new Error('會員問卷不得殘留舊稱美業');

console.log('美類問卷、初始模組、營運情境與完整操作順序驗證通過');
