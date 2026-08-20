import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const worker=read('worker.js'),sql=read('supabase_operational_closeout_v21.sql'),member=read('member-panel.html'),admin=read('admin.html'),ops=read('operations-center.html'),consignment=read('consignment.html'),caps=JSON.parse(read('doing-capabilities.json'));
const fail=m=>{throw new Error(m)},has=(body,needle,label)=>{if(!body.includes(needle))fail(label||`缺少 ${needle}`)};

for(const table of ['vendor_sales_reports','consignment_periods','consignment_applications','consignment_products','pos_sales','pos_sale_items','inventory_movements','membership_plans','membership_subscriptions','service_visits','marketing_automations','marketing_automation_runs']){
  has(sql,`create table if not exists public.${table}`,`${table} 未建立正式資料表`);
  has(sql,`alter table public.${table} enable row level security`,`${table} 未開啟 RLS`);
}
has(sql,'guard_vendor_sales_amount','攤商營業額未設不可覆寫保護');
has(sql,'record_consignment_pos_sale','寄賣 POS 缺少原子交易');
has(sql,"'consignment_sale'",'寄賣銷售未接正式財務流水');
has(sql,'revoke all on table public.vendor_sales_reports','新營運表未封鎖瀏覽器直連');
has(worker,'hSubmitVendorSalesReport','攤商營業額 API 未完成');
has(worker,'deposit_refund_eligible','營業額回報未啟動保證金可退流程');
has(worker,'hRecordPosSale','POS API 未完成');
has(worker,'hIssueMembershipPlan','會員方案未接既有錢包');
has(worker,'hUpdateServiceVisit','服務到店流程 API 未完成');
has(worker,'runWaitlistAutomation','自動候補未加入排程');
has(worker,'runMarketingAutomations','自動通知未加入排程');
has(worker,'hCheckTenantDomain','自有網域驗證未完成');
has(worker,'hGenerateSessionVisual','AI 活動主視覺既有核心遺失');
has(worker,"'vendor_sales_reports','consignment_periods','consignment_applications','consignment_products','pos_sales','pos_sale_items','inventory_movements'",'租戶完整下載未涵蓋新營運資料');
has(worker,'hGetMyConsignment','寄賣者無法讀取自己的正式申請與商品');
has(member,'回報當日營業額','會員中心沒有營業額入口');
has(member,'送出後不可由主辦修改','會員端沒有不可覆寫告知');
if(/NT\$\s*0[^\n]{0,40}(快速|按鈕|button)/i.test(member))fail('不得提供 NT$0 快速選項');
has(admin,'完整營運中心','主辦後台沒有完整營運入口');
has(ops,'grid-template-columns:repeat(3,minmax(0,1fr))','桌機操作中心不是一列三格');
has(ops,'overflow-wrap:anywhere','操作中心文字沒有防破框');
has(consignment,'applyConsignment','寄賣申請頁未串正式 API');
has(consignment,'getMyConsignment','寄賣者看不到自己的申請進度');
has(consignment,'saveConsignmentProduct','寄賣審核通過後無法建立商品與庫存');
for(const label of ['攤商填寫當日營業額','寄賣檔期設定','租戶自有網域與代設定','自動候補與遞補期限','套票、次數券與會員方案','美類服務功能表與顧客到店／開始／完成操作','AI活動主視覺生成','自動化行銷流程']){
  const feature=caps.modules.flatMap(m=>m.features||[]).find(f=>f.label===label);if(!feature)fail(`能力清單缺少：${label}`);
}
console.log('正式營運收尾契約：PASS（資料結構、權限、API、主辦與會員入口、排版防破框；productionWrites=0）');
