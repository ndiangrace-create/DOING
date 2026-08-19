import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const homeRouter=read('doing-home-refresh.js'),home=fs.existsSync('doing-home-refresh-core.js')?read('doing-home-refresh-core.js'):homeRouter;
const platform=read('platform.html'),worker=read('worker.js'),admin=read('admin.html'),member=read('member-panel.html'),memberCompat=read('member.html'),register=read('register.html');
const globalEntry=read('doing-global-entry.js'),smartApplication=read('smart-application.html');

for(const target of ['billing','issues','tenants','applications'])assert(platform.includes(`'${target}'`),`營運 KPI 缺少明確對應：${target}`);
assert(platform.includes('id="platformOperationsDashboard"'),'平台缺少營運總覽');
assert(platform.includes('function openOperationsKpi(target)'),'營運 KPI 缺少路由器');
assert(platform.includes("get('getPlatformOperationsCenter')"),'缺少營運中心 API 呼叫');
assert(worker.includes('async function hGetPlatformOperationsCenter'),'Worker 缺少營運中心 handler');
assert(worker.includes("action==='getPlatformOperationsCenter'"),'Worker 缺少營運中心路由');
assert(worker.includes("dbUpsert(env,'platform_issue_records'"),'問題沒有寫入正式處理紀錄');
assert(platform.includes('openPlatformIssueTarget'),'問題缺少直達處理動作');
assert(platform.includes("u.searchParams.set('issue_session'"),'問題未帶入指定場次');
assert(platform.includes("u.searchParams.set('issue_registration'"),'問題未帶入指定訂單／預約');
assert(admin.includes('openPlatformIssueDeepLink'),'租戶後台沒有接住平台問題深連結');
assert(platform.includes("window.open('about:blank','_blank')"),'進入租戶未保留總管頁');
assert(!platform.includes("$('enterBtn').onclick")||!platform.slice(platform.indexOf("$('enterBtn').onclick"),platform.indexOf("$('enterBtn').onclick")+800).includes('location.href=u.toString()'),'進入租戶仍會讓總管整頁離開');
assert(platform.includes('租戶轉帳收款設定')&&platform.includes('platformPaymentSettingsJump'),'總帳後台缺少清楚的轉帳收款入口');
assert(platform.includes('總營收與收款'),'平台導覽未清楚標示總營收與收款');
assert(platform.includes('id="platformIssueSearch"')&&platform.includes('id="platformIssueTenant"'),'問題中心缺少搜尋與租戶篩選');
assert(platform.includes('id="platformTenantHealth"'),'缺少租戶健康狀態');
assert(!platform.includes("tenantName+'（'+tenantId+'）'"),'平台畫面仍顯示內部租戶代碼');
assert(admin.includes("apiPost({action:'saveTenantTheme',themeKey:key})")&&worker.includes('async function hSaveTenantTheme'),'五套模板未提供租戶自由切換');
assert(admin.includes('自由選擇你的品牌模板')&&admin.includes('onclick="saveTenantTheme'),'品牌模板仍被平台鎖定');
assert(admin.includes('data-advanced-feature="i18n"')&&admin.includes('data-advanced-feature="photoFrames"'),'進階功能未標示平台開通');

for(const [label,target] of [['進行中場次',"switchPage(\\'sessions\\')"],['全部待辦',"setTodoFilter(\\'all\\')"],['待審核',"setTodoFilter(\\'pending\\')"],['付款處理',"setTodoFilter(\\'payment\\')"],['退款處理',"setTodoFilter(\\'refund\\')"],['實際已收',"switchPage(\\'finance\\')"]]){
  assert(admin.includes(label)&&admin.includes(target),`租戶後台 KPI 對應遺失：${label}`);
}

const sharedPages=['platform.html','admin.html','member-panel.html','about.html','onsite.html','photo.html'];
for(const file of sharedPages){
  const html=read(file);
  assert(html.includes('doing-logo.png'),`${file} 左上角未使用首頁 DOING LOGO`);
  assert(html.includes('data-doing-admin-entry'),`${file} 缺少相同總管長按入口`);
  assert(html.includes('doing-global-entry.js'),`${file} 未載入共同總管入口邏輯`);
  assert(html.includes('index.html'),`${file} 缺少回到首頁`);
}
assert(memberCompat.includes('member-panel.html')&&memberCompat.includes('index.html'),'member.html 相容轉址路徑不完整');
assert(!memberCompat.includes('doing-logo.png'),'member.html 相容轉址不得再承載舊完整頁面框架');
for(const file of ['platform.html','admin.html','about.html','onsite.html','photo.html','register.html'])assert(read(file).includes('我的 DOING'),`${file} 缺少回到我的 DOING`);
assert(read('index.html').includes("hiddenAdminSelector='#brandHoldTarget,.doing-nav-brand'"),'首頁總管入口條件遺失');
assert(register.includes('setTimeout(()=>{cancelAdminHold();'),'活動頁總管入口條件遺失');
assert(register.includes("u.searchParams.set('tenant',urlTenant)"),'活動頁沒有把網址租戶帶入 frontBootstrap，會讀錯主辦空間');
assert(register.includes("String(state.tenant||new URL(location.href).searchParams.get('tenant')"),'活動頁總管入口沒有使用目前租戶');
assert(!register.includes('String(S.tenant||'),'活動頁仍引用不存在的租戶狀態變數');
assert(globalEntry.includes('setTimeout(enter,3000)'),'共同入口不是 3 秒長按');
assert(home.includes('openMemberWorkspaceAdmin(spaces[0],true)')||homeRouter.includes('openMemberWorkspaceAdmin(spaces[0],true)'),'租戶會員入口未換發指定租戶的後台憑證');
assert(home.includes("tenantTop.textContent=memberAuth.complete?(memberAuth.workspaces.length===1?'營運管理':'我的 DOING'):'LINE 登入'"),'租戶登入按鈕未清楚顯示營運入口');
if(homeRouter!==home){
  assert(homeRouter.includes('createMemberWorkspaceAdminSession'),'首頁單一路由未換發工作空間憑證');
  assert(homeRouter.includes('handoffToWorkspace'),'首頁單一路由未直接交棒我的 DOING');
  assert(homeRouter.includes('doing-home-refresh-core.js'),'首頁登入路由未載入完整首頁核心');
  assert(homeRouter.includes("const REGISTRATION_FLOW='registrations'"),'首頁缺少「我的報名」獨立登入流程');
  assert(homeRouter.includes("memberTarget(token,'activities'"),'「我的報名」沒有固定回會員報名紀錄');
  assert(homeRouter.includes('startRegistrationsLineLogin'),'「我的報名」未使用獨立 LINE 回跳流程');
  assert(!homeRouter.includes("if(stored){handoffToWorkspace(stored,'ready')"),'「我的報名」又被串回工作空間／申請營運帳號');
  assert(homeRouter.includes("location.href=applicationTarget().toString()"),'申請營運帳號沒有維持獨立智慧申請入口');
}
assert(globalEntry.includes("u.searchParams.set('embed','1')"),'智慧申請浮層未使用單層 embed 模式');
assert(globalEntry.includes("if(overlay)overlay.remove()"),'智慧申請浮層仍重用舊 iframe，發布後可能顯示舊版');
assert(!globalEntry.includes('doing-smart-overlay-head'),'智慧申請仍保留第二層舊標題框架');
assert(globalEntry.includes('doing-smart-overlay-frame'),'智慧申請缺少單一浮層容器');
assert(smartApplication.includes("get('embed')==='1'"),'智慧申請頁未辨識嵌入模式');
assert(smartApplication.includes('html.is-embedded .smart-top')&&smartApplication.includes('display:none!important'),'嵌入智慧申請仍顯示第二層頁首框架');
assert(member.includes('安排預約日曆')&&member.includes('data-workspace-calendar'),'會員功能面板缺少安全的預約日曆直達入口');
assert(member.includes('createMemberWorkspaceAdminSession')&&member.includes('data-workspace-admin'),'會員功能面板仍可能沿用其他租戶的後台登入');
assert(worker.includes("if(action==='createMemberWorkspaceAdminSession')"),'Worker 缺少會員指定租戶後台憑證交換');
assert(worker.includes("crossTenantTokenDenied(p,TENANT)")&&worker.includes("crossTenantTokenDenied(b,TENANT)"),'GET／POST 缺少後台憑證與指定租戶不一致的共同阻擋');
assert(admin.includes('營運空間不一致，已阻擋載入其他租戶資料'),'後台未阻擋網址租戶與登入租戶不一致');
assert(admin.includes("ADMIN_PAGE_STATE_KEY+':'+(AdminState.tenantId||'unknown')"),'後台頁面記憶未依租戶隔離');
assert(admin.includes("if(from==='tenant'&&tenant)return {href:'index.html?tenant='+encodeURIComponent(tenant)"),'租戶後台缺少回到原營運首頁的路徑');
assert(admin.includes("const ADMIN_HASH_PAGES=new Set(['sessions','calendar'")&&admin.includes("if(page==='calendar')loadUnifiedCalendar()"),'主辦後台的日曆深連結未接到正式日曆');

console.log('navigation actions: OK');
