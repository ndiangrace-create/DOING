import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const platform=read('platform.html'),worker=read('worker.js'),admin=read('admin.html'),home=read('doing-home-refresh.js'),member=read('member.html');

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

const sharedPages=['platform.html','admin.html','member.html','about.html','onsite.html','photo.html'];
for(const file of sharedPages){
  const html=read(file);
  assert(html.includes('doing-logo.png'),`${file} 左上角未使用首頁 DOING LOGO`);
  assert(html.includes('data-doing-admin-entry'),`${file} 缺少相同總管長按入口`);
  assert(html.includes('doing-global-entry.js'),`${file} 未載入共同總管入口邏輯`);
  assert(html.includes('index.html'),`${file} 缺少回到首頁`);
}
for(const file of ['platform.html','admin.html','about.html','onsite.html','photo.html','register.html']){
  assert(read(file).includes('我的 DOING'),`${file} 缺少回到我的 DOING`);
}
assert(read('index.html').includes("hiddenAdminSelector='#brandHoldTarget,.doing-nav-brand'"),'首頁總管入口條件遺失');
assert(read('register.html').includes('setTimeout(()=>{cancelAdminHold();'),'活動頁總管入口條件遺失');
assert(read('doing-global-entry.js').includes('setTimeout(enter,3000)'),'共同入口不是 3 秒長按');
assert(home.includes("spaces.length===1?`admin.html?tenant=${encodeURIComponent(spaces[0].id)}&from=tenant#calendar`:'member.html#operations'"),'租戶會員入口未依單一／多營運空間正確分流');
assert(home.includes("tenantTop.textContent=memberAuth.complete?(memberAuth.workspaces.length===1?'營運管理':'我的 DOING'):'LINE 登入'"),'租戶登入按鈕未清楚顯示營運入口');
assert(member.includes('安排預約日曆')&&member.includes('&from=member#calendar'),'會員中心缺少預約日曆直達入口');
assert(admin.includes("if(from==='tenant'&&tenant)return {href:'index.html?tenant='+encodeURIComponent(tenant)"),'租戶後台缺少回到原營運首頁的路徑');
assert(admin.includes("const ADMIN_HASH_PAGES=new Set(['sessions','calendar'")&&admin.includes("if(page==='calendar')loadUnifiedCalendar()"),'主辦後台的日曆深連結未接到正式日曆');

console.log('navigation actions: OK');
