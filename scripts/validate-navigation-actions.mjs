import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const platform=read('platform.html'),worker=read('worker.js'),admin=read('admin.html');

for(const key of ['membersAll','membersComplete','membersVendor','tenants','activeTenants','sessions','operationUnits','registrations','platformRevenue','startupCredit']){
  assert(platform.includes(`'${key}'`),`平台數字卡缺少對應鍵：${key}`);
}
assert(platform.includes('data-platform-metric='),'平台數字卡不是明確的 metric action');
assert(!platform.includes('data-platform-target='),'仍存在舊的粗略導頁按鈕');
assert(platform.includes("function openPlatformMetric(key)"),'缺少數字卡路由器');
assert(platform.includes("get('getPlatformMetricDetails',{kind})"),'缺少平台明細 API 呼叫');
assert(worker.includes('async function hGetPlatformMetricDetails'),'Worker 缺少平台明細 handler');
assert(worker.includes("action==='getPlatformMetricDetails'"),'Worker 缺少平台明細路由');
assert(platform.includes('租戶轉帳收款設定')&&platform.includes('platformPaymentSettingsJump'),'總帳後台缺少清楚的轉帳收款入口');
assert(platform.includes('收款與計費設定'),'平台導覽未清楚標示收款與計費設定');
assert(platform.includes('metric-detail-list{display:grid;grid-template-columns:repeat(8'),'桌機／平板明細未設定每排 8 張迷你小卡');
assert(platform.includes('.metric-detail-list{grid-template-columns:repeat(4'),'手機明細未設定每排 4 張迷你小卡');
assert(platform.includes('租戶：')&&platform.includes('renderPlatformMetricCard'),'明細小卡未直接標示租戶名稱');
assert(!platform.includes('>查看租戶</button>'),'資料小卡仍會跳去租戶頁');
assert(platform.includes('backFromPlatformRecords')&&platform.includes("switchPlatformPage('world')"),'明細缺少不跳頁的站內上一頁');
assert(platform.includes('const platformMetricRoutes={'),'平台數字卡缺少唯一對應路由表');
for(const contract of [
  "membersAll:{panel:'members',filter:'all'",
  "membersComplete:{panel:'members',filter:'complete'",
  "membersVendor:{panel:'members',filter:'vendor'",
  "tenants:{panel:'tenants'",
  "activeTenants:{panel:'records',kind:'activeTenants'",
  "sessions:{panel:'records',kind:'sessions'",
  "operationUnits:{panel:'records',kind:'operationUnits'",
  "registrations:{panel:'records',kind:'registrations'",
  "platformRevenue:{panel:'records',kind:'platformRevenue'",
  "startupCredit:{panel:'records',kind:'startupCredit'"
])assert(platform.includes(contract),`平台數字卡路由契約錯誤：${contract}`);
assert(platform.includes("String(d.kind||'')!==kind"),'平台明細未阻擋 API 類型錯接');
assert(platform.includes('requestNo!==platformMetricRequestNo'),'平台明細未阻擋舊請求覆蓋新畫面');
assert(platform.includes('id="platformMetricSearch"'),'平台明細缺少關鍵字搜尋');
assert(platform.includes('id="platformMetricTenantFilter"'),'平台明細缺少租戶名稱篩選');
assert(platform.includes('const pageSize=24'),'平台明細未限制每頁 24 筆');
assert(platform.includes('platformMetricPage')&&platform.includes('changePlatformMetricPage'),'平台明細缺少分頁控制');
assert(platform.includes("rawTenantName!==tenantId")&&platform.includes("'租戶名稱待設定'"),'平台明細未阻止租戶代碼冒充名稱');
assert(!platform.includes("tenantName+'（'+tenantId+'）'"),'平台明細仍顯示內部租戶代碼');
assert(worker.includes("'tenants','select=id,name,status,is_locked,created_at&limit=1000'"),'平台明細未從租戶主檔取得正常名稱');
const metricHandler=worker.slice(worker.indexOf('async function hGetPlatformMetricDetails'),worker.indexOf('async function hGetPlatformMembersAdmin'));
assert(!metricHandler.includes('owner_email'),'平台明細租戶查詢仍帶入不存在欄位，會使名稱整批失效');

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

console.log('navigation actions: OK');
