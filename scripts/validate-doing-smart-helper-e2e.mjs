import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('about.html','utf8');
const worker=fs.readFileSync('worker.js','utf8');
const mirror=fs.readFileSync('worker.txt','utf8');
const sql=fs.readFileSync('supabase_doing_helper_traces.sql','utf8');

for(const copy of ['DOING 智慧小幫手','DOING 線上智能客服','我只能協助 DOING 系統','scopeStatus:\'out_of_scope\'','dataPolicy:\'same_brand_customer_shared_work_records_separate\'']){
  assert(page.includes(copy)||worker.includes(copy),`缺少範圍或資料規則：${copy}`);
}
for(const value of ['team','appointment','deposit','shared_customers','multi_brand','one_brand_many_jobs','no_show','staff_mix'])assert(page.includes(`value="${value}"`),`問卷缺少 ${value}`);
assert(page.includes('data-helper-topic="data"')&&page.includes('data-helper-topic="billing"')&&page.includes('data-helper-topic="adjust"'),'缺少 DOING 範圍內的客服快問');
assert(page.includes('setupSmartApplicationFlow')&&page.includes("form.classList.add('is-smart-flow')"),'申請仍是舊式長問卷，未改成智慧引導頁');
assert(page.includes('跟著 DOING 智慧小幫手完成申請'),'缺少智慧申請頁標題');
assert(!page.includes('id="signupGoogleBtn"'),'公開申請不得顯示 Google 驗證');
assert(!page.includes('先回公開活動入口'),'智慧申請頁不得殘留舊返回按鈕');
assert(!page.includes('id="signupModulePreview"'),'首頁不得顯示內部功能清單');
assert(!page.includes('function applicationModuleDefaults'),'內部功能判斷不得留在公開頁面');
assert(!page.includes('const moduleLabels='),'公開頁面不得暴露功能名稱對照');
assert(worker.includes("if(action==='analyzeDoingApplication')return hAnalyzeDoingApplication(env,b)"),'缺少公開申請分析路由');
assert(worker.includes("type:'json_schema'")&&worker.includes("strict:true"),'AI 回覆未使用嚴格結構');
assert(worker.includes('不得回答一般知識、生活建議、其他品牌或其他系統'),'AI 缺少 DOING 內容鎖');
assert(worker.includes('doingHelperSafeReply'),'缺少回覆洩漏攔截');
assert(worker.includes('doingApplicationPlan'),'正式功能判斷未保留在後端');
assert(page.includes("localStorage.getItem('doing_member_token')")&&page.includes('member_token:memberToken'),'登入狀態未傳給小幫手');
assert(worker.includes('verifiedPlatformMember(env,token)')&&worker.includes("dbInsert(env,'member_helper_traces'"),'登入會員軌跡未經身分驗證後寫入');
assert(worker.includes('if(token)')&&worker.includes('let saved=false'),'未登入狀態不得寫入軌跡');
assert(sql.includes('alter table public.member_helper_traces enable row level security'),'個人軌跡未啟用 RLS');
assert(sql.includes('revoke all on table public.member_helper_traces from public, anon, authenticated, service_role'),'個人軌跡未撤銷預設權限');
assert(sql.includes('grant select, insert on table public.member_helper_traces to service_role'),'個人軌跡未限制為後端最小權限');
assert(!/grant[^;]*(update|delete|truncate)/i.test(sql),'個人軌跡不得允許覆寫或刪除');
assert.equal(worker,mirror,'worker.js 與 worker.txt 必須一致');

console.log(JSON.stringify({result:'PASS',questionnaire:'multi-select',assistantScope:'DOING only',publicModuleExposure:false,dataBoundary:'same brand shared identity; work records separated'},null,2));
