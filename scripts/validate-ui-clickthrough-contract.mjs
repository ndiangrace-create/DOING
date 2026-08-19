import fs from 'node:fs';

const read=f=>fs.readFileSync(f,'utf8');
const assert=(v,m)=>{if(!v)throw new Error(m)};
const exists=f=>fs.existsSync(f);
const pages=['index.html','smart-application.html','member-panel.html','workspace.html','admin.html','register.html','onsite.html','platform.html','about.html','photo.html'];
for(const p of pages)assert(exists(p),`缺少正式頁面：${p}`);

const index=read('index.html');
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
const worker=read('worker.js');

// 首頁／會員入口不能互相串錯。
assert(home.includes("const REGISTRATION_FLOW='registrations'"),'首頁缺少「我的報名」獨立流程');
assert(home.includes("memberTarget(token,'activities'"),'「我的報名」未固定回報名紀錄');
assert(home.includes("location.href=applicationTarget().toString()"),'申請營運帳號未使用獨立智慧申請入口');
assert(!home.includes("if(stored){handoffToWorkspace(stored,'ready')"),'我的報名又被工作空間分流攔截');
assert(global.includes('smart-application.html'),'共同申請入口未指向唯一智慧申請頁');
assert(global.includes("if(overlay)overlay.remove()"),'智慧申請浮層可能重用舊 iframe');
assert(!global.includes('doing-smart-overlay-frame'),'智慧申請仍有第二層外框');

// 第三方 OAuth 不得在 iframe 內執行。
assert(smartPage.includes("window.top!==window.self"),'智慧申請未檢查 iframe');
assert(smartPage.includes("window.top.location.replace"),'智慧申請未在 OAuth 前跳回頂層');
assert(smart.includes("mode','organizer_signup"),'智慧申請缺少 LINE organizer_signup');

// 正式申請規則：FB/IG 至少一個；不可有無公開頁面例外。
assert(smart.includes('saFacebook')&&smart.includes('saInstagram'),'智慧申請缺少 FB／IG 欄位');
assert(smart.includes('Facebook 粉專或 Instagram 至少一個'),'智慧申請缺少 FB／IG 必填阻擋');
assert(!smart.includes('saNoPublic'),'智慧申請仍存在「沒有公開頁面」勾選');
assert(!smart.includes('目前確實尚未建立公開頁面'),'智慧申請仍顯示舊例外文案');

// 會員頁前台不得直接顯示內部產業代碼。
const internalCodes=['beauty_wellness','space_studio','market_retail','professional_service','event_exhibition','education','tour_outdoor','craft_experience'];
for(const code of internalCodes)assert(!member.includes(`>${code}<`),`會員頁直接硬編碼內部代碼：${code}`);

// 主要正式頁必須有回首頁路徑。
for(const p of ['member-panel.html','workspace.html','admin.html','onsite.html','platform.html','about.html','photo.html'])assert(read(p).includes('index.html'),`${p} 缺少回首頁路徑`);
for(const p of ['member-panel.html','admin.html','onsite.html','platform.html','about.html','photo.html'])assert(read(p).includes('doing-global-entry.js'),`${p} 未載入共同入口邏輯`);

// 關鍵頁面內容契約。
assert(member.includes('我的營運')||member.includes('operations'),'會員頁缺少我的營運內容');
assert(member.includes('帳號設定')||member.includes('account'),'會員頁缺少帳號設定內容');
assert(member.includes('我的品牌')||member.includes('brands'),'會員頁缺少我的品牌內容');
assert(workspace.includes('calendar')||workspace.includes('工作日曆'),'工作空間缺少日曆入口');
assert(admin.includes('switchPage')||admin.includes('data-page'),'主辦後台缺少頁面切換處理');
assert(register.includes('member_token'),'報名頁缺少會員登入／身分串接');
assert(onsite.includes('報到')||onsite.includes('checkin'),'現場頁缺少報到功能');
assert(platform.includes('applications')&&platform.includes('tenants'),'平台總管缺少申請／租戶入口');

// 前端 action 必須在 Worker 有正式路由。
const actionRe=/action\s*[:=]\s*['\"]([A-Za-z0-9_]+)['\"]/g;
const htmlJs=pages.filter(exists).map(read).join('\n')+'\n'+[home,global,smart].join('\n');
const actions=new Set([...htmlJs.matchAll(actionRe)].map(m=>m[1]));
const missing=[];
for(const a of actions){
  if(!worker.includes(`action==='${a}'`)&&!worker.includes(`action === '${a}'`)&&!worker.includes(`action==\"${a}\"`)&&!worker.includes(`action === \"${a}\"`))missing.push(a);
}
assert(missing.length===0,`前端 action 缺少 Worker 路由：${missing.join(', ')}`);

// 舊申請入口不得重新成為正式路徑。
const about=read('doing-about-refresh.js');
assert(about.includes('smart-application.html'),'about 未轉向唯一智慧申請頁');
assert(about.includes('applicationPanel')&&about.includes('.remove()'),'about 歷史申請 DOM 未在 live DOM 退休');

console.log(JSON.stringify({result:'PASS',pages:pages.length,frontendActions:actions.size,rules:['routing','oauth','application','social','internal-code','worker-route','legacy-retirement']},null,2));
