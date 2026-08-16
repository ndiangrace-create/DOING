import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
const platform=read('platform.html'),worker=read('worker.js'),admin=read('admin.html');

for(const key of ['membersAll','membersComplete','membersVendor','tenants','activeTenants','sessions','operationUnits','registrations','platformRevenue','startupCredit']){
  assert(platform.includes(`'${key}'`),`平台數字卡缺少對應鍵：${key}`);
}
assert(platform.includes('data-platform-metric='),'平台數字卡不是明確的 metric action');
assert(!platform.includes('data-platform-target='),'仍存在舊的粗略導頁按鈕');
assert(platform.includes("function openPlatformMetric(kind)"),'缺少數字卡路由器');
assert(platform.includes("get('getPlatformMetricDetails',{kind})"),'缺少平台明細 API 呼叫');
assert(worker.includes('async function hGetPlatformMetricDetails'),'Worker 缺少平台明細 handler');
assert(worker.includes("action==='getPlatformMetricDetails'"),'Worker 缺少平台明細路由');
assert(platform.includes('租戶轉帳收款設定')&&platform.includes('platformPaymentSettingsJump'),'總帳後台缺少清楚的轉帳收款入口');
assert(platform.includes('收款與計費設定'),'平台導覽未清楚標示收款與計費設定');
assert(platform.includes('.metric-detail-list{display:grid;gap:8px'),'資料明細未保留逐筆橫向資料列');
assert(platform.includes('租戶：')&&platform.includes('renderPlatformMetricRow'),'資料列右側未直接標示租戶名稱');
assert(platform.includes('.metric-detail-row .tenant-name{display:inline-flex'),'租戶名稱未使用迷你小卡');
assert(!platform.includes('>查看租戶</button>'),'資料小卡仍會跳去租戶頁');
assert(!platform.includes('platformBackBtn')&&!platform.includes('goBackPlatformPage'),'仍存在誤加的跨分頁上一頁串接');

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
