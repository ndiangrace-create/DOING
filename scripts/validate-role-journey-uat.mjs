import fs from 'node:fs';

const read=f=>fs.readFileSync(f,'utf8');
const need=(ok,msg)=>{if(!ok)throw new Error(msg)};
const uat=read('DOING_UAT_CLICKTHROUGH_V20.md');
const tree=JSON.parse(read('doing-operational-world-tree.json'));
const home=read('doing-home-refresh.js')+(fs.existsSync('doing-home-refresh-core.js')?read('doing-home-refresh-core.js'):'');
const member=read('member-panel.html');
const smart=read('doing-smart-activation.js');
const smartPage=read('smart-application.html');
const workspace=read('workspace.html');
const admin=read('admin.html');
const onsite=read('onsite.html');
const platform=read('platform.html');
const worker=read('worker.js');

const roleHeadings=[
  '角色 1｜一般使用者／報名者',
  '角色 2｜品牌使用者',
  '角色 3｜營運申請者',
  '角色 4｜租戶擁有者／主辦管理員',
  '角色 5｜現場工作人員／實際出攤者',
  '角色 6｜平台總管'
];
for(const h of roleHeadings)need(uat.includes(h),'真人 UAT 清單缺少角色：'+h);
for(const marker of ['入口 → 按鈕 → 頁面 → 權限 → API → Supabase → 完成狀態 → 下一步／返回','程式級 PASS 不等於真人瀏覽器 PASS','真人 UAT：'])need(uat.includes(marker),'UAT 契約缺少：'+marker);

const flows=new Map((tree.journeys||[]).map(x=>[x.id,x]));
for(const id of ['public-registration','member-brand','smart-application','workspace-modules-calendar','tenant-admin-operations','onsite','platform-admin']){
  const f=flows.get(id);need(f,'營運世界樹缺少角色旅程：'+id);need(['done','verify','human_uat'].includes(f.status),'角色旅程存在真正阻斷或未排入目前範圍：'+id);need(Array.isArray(f.steps)&&f.steps.length>=3,'角色旅程操作鏈不足：'+id);need(f.completion,'角色旅程缺少完成判準：'+id);need(Array.isArray(f.humanUAT),'角色旅程缺少真人 UAT 標記：'+id);
}

// 角色 1：活動 → 報名 → 我的報名 → 狀態／返回。
need(home.includes("const REGISTRATION_FLOW='registrations'"),'一般使用者流程缺少「我的報名」獨立入口');
need(home.includes("memberTarget(token,'activities'"),'我的報名沒有固定回 member-panel#activities');
need(member.includes("getMyRegsGlobal"),'我的報名沒有讀取正式 registrations 查詢 API');
for(const marker of ['approvedAt','paymentReportedAt','paidAt','checkinAt','refundedAt'])need(member.includes(marker),'我的報名狀態鏈缺少：'+marker);
need(worker.includes('getMyRegsGlobal'),'Worker 缺少我的報名正式 action');

// 角色 2：品牌建立／編輯 → 加入 → 管理者確認 → 權限生效。
for(const marker of ['saveMemberBrand','getBrandAccessRequests','resolveBrandAccessRequest'])need(member.includes(marker),'品牌旅程缺少前端動作：'+marker);
for(const marker of ['saveMemberBrand','getBrandAccessRequests','resolveBrandAccessRequest'])need(worker.includes(marker),'品牌旅程缺少 Worker 動作：'+marker);

// 角色 3：智慧申請 → 正式資料 → FB/IG → LINE top-level → 工作空間／例外複核。
for(const marker of ['saFacebook','saInstagram','organizer_signup','createOrganizerApplicationDraft'])need(smart.includes(marker),'營運申請旅程缺少：'+marker);
need(smartPage.includes('window.top.location.replace'),'LINE OAuth 未保證 top-level');
for(const marker of ['tenant_apply_logs','platform_risk_cases','module_flags_json'])need(worker.includes(marker),'申請開通／例外複核鏈缺少：'+marker);

// 角色 4：工作空間 → 核准模組 → 日曆 → 主辦營運 → 財務／結案 → 返回原租戶。
for(const marker of ['getTenantModuleProfile','approvedFlags','data-view="month"','data-view="week"','data-view="list"'])need(workspace.includes(marker),'工作空間旅程缺少：'+marker);
for(const marker of ['getSessionRegistrations','approveReg','confirmRefund','getSessionCashbook','financeReport'])need(admin.includes(marker),'主辦完整營運旅程缺少：'+marker);
need(admin.includes("from==='tenant'&&tenant"),'主辦後台缺少返回原租戶路徑');

// 角色 5：現場授權場次 → 搜尋 → 報到／狀態 → 撤場／完成。
for(const marker of ['onsiteShiftList','onsiteRegs','onsiteMark'])need(onsite.includes(marker)||worker.includes(marker),'現場旅程缺少：'+marker);
need(worker.includes('staff_session_permissions'),'現場權限未綁定正式場次授權');
need(member.includes('teardownStatus')||member.includes('申請撤場'),'撤場結果沒有回到我的報名');

// 角色 6：平台登入 → 例外／風險 → 租戶／問題 → 深連結 → 稽核 → 保持平台身份。
for(const marker of ['platform_risk_cases','platform_issue_records','audit_logs'])need(worker.includes(marker),'平台總管閉環缺少資料根：'+marker);
for(const marker of ['applications','tenants','support','members'])need(platform.includes(marker),'平台總管頁缺少入口：'+marker);
need(platform.includes('data-platform-page')&&platform.includes('data-platform-panel'),'平台總管缺少固定分頁契約');

// 所有角色：正式資料來源、單層 UI、舊頁退休、安全邊界。
need(tree.authority?.businessData==='Supabase DOING_SaaS/public','正式資料 SSOT 不是 Supabase');
need(tree.singleSurfaceRule?.maxPrimaryFramesPerFlow===1,'正式流程不是單層主框架');
need(tree.safety?.forbiddenTarget==='2bl-v7'&&tree.safety?.deploymentTarget==='tobeloved-api','部署安全邊界錯誤');
need(read('worker.txt')===worker,'worker.js / worker.txt 不同步');

console.log(JSON.stringify({result:'PASS',roles:6,operationalJourneys:7,realBrowserUAT:'pending_by_contract',flow:['入口','按鈕','頁面','權限','API','Supabase','完成狀態','下一步／返回'],productionWrites:0},null,2));
