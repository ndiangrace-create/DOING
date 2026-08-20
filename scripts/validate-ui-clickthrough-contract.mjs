import fs from 'node:fs';

const read=f=>fs.readFileSync(f,'utf8');
const exists=f=>fs.existsSync(f);
const issues=[];
const check=(v,m)=>{if(!v)issues.push(m)};
const pages=['index.html','smart-application.html','member-panel.html','workspace.html','admin.html','register.html','onsite.html','platform.html','about.html','photo.html'];
for(const p of pages)check(exists(p),`缺少正式頁面：${p}`);

const home=read('doing-home-refresh.js')+(exists('doing-home-refresh-core.js')?read('doing-home-refresh-core.js'):'');
const global=read('doing-global-entry.js');
const member=read('member-panel.html');
const workspace=read('workspace.html');
const admin=read('admin.html');
const register=read('register.html');
const onsite=read('onsite.html');
const platform=read('platform.html');
const smart=read('doing-smart-activation.js');
const smartPage=read('smart-application.html');

check(home.includes("const REGISTRATION_FLOW='registrations'"),'首頁缺少「我的報名」獨立流程');
check(home.includes("memberTarget(token,'activities'"),'「我的報名」未固定回報名紀錄');
check(home.includes("location.href=applicationTarget().toString()"),'申請營運帳號未使用獨立智慧申請入口');
check(!home.includes("if(stored){handoffToWorkspace(stored,'ready')"),'我的報名又被工作空間分流攔截');
check(global.includes('smart-application.html'),'共同申請入口未指向唯一智慧申請頁');
check(global.includes("if(overlay)overlay.remove()"),'智慧申請浮層可能重用舊 iframe');
check(!global.includes('doing-smart-overlay-frame'),'智慧申請仍有第二層外框');

check(smartPage.includes("window.top!==window.self"),'智慧申請未檢查 iframe');
check(smartPage.includes("window.top.location.replace"),'智慧申請未在 OAuth 前跳回頂層');
check(smart.includes("mode','organizer_signup"),'智慧申請缺少 LINE organizer_signup');

check(smart.includes('saFacebook')&&smart.includes('saInstagram'),'智慧申請缺少 FB／IG 欄位');
check(smart.includes('Facebook 粉專或 Instagram 至少一個'),'智慧申請缺少 FB／IG 必填阻擋');
check(!smart.includes('saNoPublic'),'智慧申請仍存在「沒有公開頁面」勾選');
check(!smart.includes('目前確實尚未建立公開頁面'),'智慧申請仍顯示舊例外文案');

check(global.includes('DOING_APPLICATION_INDUSTRY_LABELS'),'會員營運申請缺少產業代碼→白話中文轉換層');
check(global.includes('translateApplicationIndustryText'),'會員營運申請缺少前台中文轉換執行器');
check(global.includes('rewriteLegacyApplicationLinks'),'會員頁缺少舊申請連結退休處理');
check(global.includes("a.href='smart-application.html'"),'會員舊申請入口沒有統一改到 smart-application.html');
check(global.includes('installCleanMemberProfileSubmit'),'帳號設定缺少 V20 正式資料儲存接管');
check(global.includes("API+'?action=savePlatformMemberProfile'"),'V20 帳號設定未直接呼叫正式會員資料 API');
check(!global.includes('systemApplication:app?'),'V20 清理層不得重新寫入舊 systemApplication');

for(const p of ['member-panel.html','workspace.html','admin.html','onsite.html','platform.html','about.html','photo.html'])check(read(p).includes('index.html'),`${p} 缺少回首頁路徑`);
for(const p of ['member-panel.html','admin.html','onsite.html','platform.html','about.html','photo.html'])check(read(p).includes('doing-global-entry.js'),`${p} 未載入共同入口邏輯`);

check(member.includes('我的營運')||member.includes('operations'),'會員頁缺少我的營運內容');
check(member.includes('帳號設定')||member.includes('account'),'會員頁缺少帳號設定內容');
check(member.includes('我的品牌')||member.includes('brands'),'會員頁缺少我的品牌內容');
check(workspace.includes('calendar')||workspace.includes('工作日曆'),'工作空間缺少日曆入口');
check(admin.includes('switchPage')||admin.includes('data-page'),'主辦後台缺少頁面切換處理');
check(register.includes('member_token'),'報名頁缺少會員登入／身分串接');
check(onsite.includes('報到')||onsite.includes('checkin'),'現場頁缺少報到功能');
check(platform.includes('applications')&&platform.includes('tenants'),'平台總管缺少申請／租戶入口');

const about=read('doing-about-refresh.js');
check(about.includes('smart-application.html'),'about 未轉向唯一智慧申請頁');
check(global.includes('retireLegacyAboutApplication'),'about 歷史申請 DOM 缺少正式退休處理');
check(global.includes("document.querySelectorAll('#applicationPanel,#apply')"),'about 舊申請區塊沒有從 live DOM 移除');

console.log(JSON.stringify({result:issues.length?'FAIL':'PASS',pages:pages.length,issues,rules:['routing','oauth','application','social','member-labels','legacy-write','legacy-route','legacy-retirement']},null,2));
if(issues.length)throw new Error(`UI click-through contract found ${issues.length} issue(s)`);
