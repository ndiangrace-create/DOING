import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const must=(ok,message)=>{if(!ok)throw new Error(message)};
const index=read('index.html');
const homeJs=read('doing-home-refresh.js');
const homeCss=read('doing-home-refresh.css');
const member=read('member.html');
const admin=read('admin.html');
const worker=read('worker.js');
const map=JSON.parse(read('doing-capabilities.json'));

must(index.includes('id="platformHomeBtn"'),'租戶頁缺少回到全台活動入口');
must(index.includes('id="tenantFaqGroups"'),'租戶頁缺少自己的 FAQ 容器');
must(index.includes('renderTenantFaq(t)'),'租戶 FAQ 未接入前台');
must(homeJs.includes('&source=doing-platform'),'平台活動卡未保留來源');
must(homeJs.includes("location.href='about.html#apply'"),'會員入口未統一到正式申請問卷');
must(homeJs.includes('systemFieldset.remove()'),'首頁會員資料仍保留舊的簡化申請欄位');
must(homeJs.includes('systemApplication:{enabled:false}'),'首頁會員資料仍可能另建第二份系統申請');
must(!member.includes('href="index.html#apply"'),'會員中心仍指向舊的第二套申請入口');
must(member.includes('systemApplication:{enabled:false}'),'會員中心編輯資料仍可能改寫系統申請');
must(homeCss.includes('width:128px!important;min-width:128px!important;max-width:128px!important'),'桌機導覽按鈕未固定同寬');
must(member.includes('.hero-spark{display:none!important}'),'會員登出按鈕的裝飾遮擋未移除');
must(admin.includes('openTenantFaqSettings'),'租戶後台缺少 FAQ 管理');
must(admin.includes('openTenantThemeSettings'),'租戶後台缺少五套主題入口');
must(worker.includes('normalizeTenantFaqs'),'FAQ 未由後端正式保存');
must(worker.includes('faqs:     tc.faqs'),'前台 bootstrap 未回傳租戶 FAQ');
must(map.modules.some(m=>m.features.some(f=>/曝光、點擊與報名轉換統計/.test(f.label)&&f.status==='later')),'平台導流統計尚未登記');

console.log('平台／租戶／會員 UX 驗證通過');
