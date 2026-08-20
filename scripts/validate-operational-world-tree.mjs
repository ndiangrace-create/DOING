import fs from 'node:fs';
import vm from 'node:vm';

const need=(ok,msg)=>{if(!ok)throw new Error(msg)};
const read=file=>fs.readFileSync(file,'utf8');
const tree=JSON.parse(read('doing-operational-world-tree.json'));
const capabilities=JSON.parse(read('doing-capabilities.json'));
const catalog=JSON.parse(read('doing-data-sources.json'));
const ws=read('workspace.html');
const ge=read('doing-global-entry.js');
const home=read('doing-home-refresh.js');
const homeCore=read('doing-home-refresh-core.js');
const memberCompat=read('member.html');
const member=read('member-panel.html');
const about=read('about.html');
const platform=read('platform.html');
const sql=read('supabase_workspace_v20_guard.sql');
const settings=JSON.parse(read('doing-settings-ssot.json'));
const actionSources=[read('worker.js'),read('index.html'),read('register.html'),member,ws,read('admin.html'),read('onsite.html'),platform,read('doing-smart-activation.js')].join('\n');
const tableNames=new Set((catalog.tables||[]).map(table=>table.name));

need(Number(tree.version)===21&&Number(tree.schemaVersion)===1,'營運世界樹版本契約錯誤');
need(tree.title==='DOING 營運世界樹','正式名稱必須是 DOING 營運世界樹');
need(tree.authority?.businessData==='Supabase DOING_SaaS/public'&&tree.authority?.api==='tobeloved-api','正式資料權威或 Worker 錯誤');
need(tree.authority?.capabilityInventory==='doing-capabilities.json','功能盤點必須與營運世界樹分離');
need(Array.isArray(capabilities.modules)&&capabilities.modules.length===21,'既有功能盤點不得因重作營運世界樹遺失');
need(Array.isArray(tree.layers)&&tree.layers.map(x=>x.id).join(',')==='role,journey,support,verification','營運世界樹必須固定四層');
need(Array.isArray(tree.roles)&&tree.roles.length===6,'營運世界樹必須包含六角色');
need(Array.isArray(tree.journeys)&&tree.journeys.length===9,'營運世界樹必須包含九條主幹');

const allowedStatus=new Set(['done','verify','blocked','later','human_uat']);
const roleIds=new Set(tree.roles.map(role=>role.id));
const journeyIds=new Set(tree.journeys.map(journey=>journey.id));
for(const id of ['public-registration','member-brand','smart-application','workspace-modules-calendar','tenant-admin-operations','onsite','platform-admin','data-authority','legacy-retirement'])need(journeyIds.has(id),'營運世界樹缺少主幹：'+id);
for(const journey of tree.journeys){
  need(journey.id&&journey.name&&journey.summary&&journey.entry&&journey.completion,'旅程摘要不完整：'+journey.id);
  need(allowedStatus.has(journey.status),'旅程狀態不合法：'+journey.id);
  need(Array.isArray(journey.roleIds)&&journey.roleIds.length,'旅程缺少角色：'+journey.id);
  for(const roleId of journey.roleIds)need(roleIds.has(roleId),'旅程引用不存在角色：'+journey.id+' -> '+roleId);
  need(Array.isArray(journey.steps)&&journey.steps.length>=2,'旅程缺少完整步驟：'+journey.id);
  need(Array.isArray(journey.humanUAT)&&Array.isArray(journey.blockers),'旅程缺少真人驗證或阻斷欄位：'+journey.id);
  for(const step of journey.steps){
    for(const key of ['id','label','page','button','permission','state','completion','next','back','status'])need(step[key]!==undefined&&step[key]!==null&&step[key]!=='','營運步驟缺少 '+key+'：'+journey.id+'/'+step.id);
    need(Array.isArray(step.actions)&&Array.isArray(step.tables)&&Array.isArray(step.evidence)&&step.evidence.length,'營運步驟缺少 API、Supabase 或驗證依據：'+journey.id+'/'+step.id);
    need(allowedStatus.has(step.status),'營運步驟狀態不合法：'+journey.id+'/'+step.id);
    for(const action of step.actions)if(action&&!action.includes(' ')&&!['dbGet','dbInsert','dbUpdate','dbDelete'].includes(action))need(actionSources.includes(action),'營運世界樹引用不存在的正式 action：'+journey.id+'/'+step.id+' -> '+action);
    for(const table of step.tables)if(table!=='Supabase public schema')need(tableNames.has(table),'營運世界樹引用未盤點的 Supabase 資料表：'+journey.id+'/'+step.id+' -> '+table);
  }
}
need(!JSON.stringify(tree).match(/Market App|手機板APP|mobile app/i),'DOING 營運世界樹不得再納入 Market App');
need(tree.workspaceRule?.ownedWorkspacePerMember===1&&tree.workspaceRule?.collaborationAcrossOtherWorkspaces===true,'工作空間唯一性契約錯誤');
need(tree.namingSSOT?.myRegistrations==='我的報名'&&tree.namingSSOT?.primaryApi==='getMyRegsGlobal'&&tree.namingSSOT?.primaryTable==='registrations','我的報名固定契約錯誤');
need(tree.retentionPolicy?.transientDays===90&&tree.retentionPolicy?.formalBusinessDataPreserved===true,'90 天清理安全契約錯誤');
need(tree.moduleArchitecture?.model==='shared_core_with_pluggable_work_modes'&&tree.moduleArchitecture?.noDuplicateRoot===true,'插件式共用核心契約錯誤');
need(tree.moduleArchitecture?.workModules?.length===5&&tree.moduleArchitecture?.sharedModules?.length===10,'5 工作模組與 10 共用模組契約錯誤');
need(tree.dataPortability?.ownerSelfService===true&&tree.dataPortability?.availableWhenTenantLocked===true,'租戶資料可攜權契約錯誤');
need(tree.safety?.forbiddenTarget==='2bl-v7'&&tree.safety?.deploymentTarget==='tobeloved-api'&&tree.safety?.billingChangeAllowed===false,'發布安全邊界錯誤');
need(tree.safety?.productionWritesDuringAutomatedValidation===0,'自動驗證必須 productionWrites=0');
need(settings.browserStorage?.formalSettingsAllowed===false&&catalog.browserStorage?.businessDataAllowed===false,'正式設定或營運資料不得存瀏覽器');

need(platform.includes('DOING 營運世界樹')&&platform.includes('doing-operational-world-tree.json'),'平台總管未載入正式營運世界樹');
need(platform.includes('data-world-role')&&platform.includes('data-world-status'),'營運世界樹缺少角色與狀態篩選');
for(const label of ['頁面','按鈕／操作','權限','API','Supabase','狀態變化','完成判準','下一步／返回','驗證依據'])need(platform.includes(label),'營運世界樹畫面缺少欄位：'+label);
need(!platform.includes('功能世界樹')&&!platform.includes('DOING 系統世界地圖'),'平台仍顯示舊功能清單式世界樹名稱');
need(!platform.includes('renderCapabilityMap')&&!platform.includes("fetch('doing-capabilities.json"),'平台世界樹仍直接渲染功能盤點');
need(platform.includes('overflow-wrap:anywhere')&&platform.includes('.world-step-grid{display:grid'),'營運世界樹缺少文字防破框或響應式步驟格');

need(tree.singleSurfaceRule?.formalApplicationPage==='smart-application.html'&&tree.singleSurfaceRule?.maxPrimaryFramesPerFlow===1,'唯一正式畫面規則錯誤');
need(about.includes("isApply?'smart-application.html':'index.html'")&&about.length<5000,'about 相容轉址錯誤');
need(memberCompat.includes("new URL('member-panel.html'")&&memberCompat.length<5000,'member 相容轉址錯誤');
for(const text of ['預約','課程','活動','市集','專案'])need(ws.includes(text),'工作空間缺少工作模組：'+text);
for(const text of ['商品／票券','QR 報到／核銷','收款／訂金','優惠券／回訪','通知提醒','團隊／排班','進階財務','照片／檔案','電子簽名','Google／Apple 日曆'])need(ws.includes(text),'工作空間缺少共用模組：'+text);
need(ws.includes('data-view="month"')&&ws.includes('data-view="week"')&&ws.includes('data-view="list"'),'工作日曆視圖不完整');
need(ws.includes('getTenantModuleProfile')&&ws.includes('approvedFlags'),'工作空間未依核准模組載入');
need(!/localStorage|sessionStorage/.test(ws),'工作空間不可保存營運資料');
need(sql.includes('doing_single_owned_workspace_guard')&&sql.includes('doing_single_workspace_application_guard'),'工作空間資料庫防重線缺失');

new vm.Script(ge,{filename:'doing-global-entry.js'});
new vm.Script(home,{filename:'doing-home-refresh.js'});
for(const [name,src] of [['workspace',ws],['member-panel',member],['platform',platform]]){let scripts=0;for(const m of src.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){if(!m[1].trim())continue;new vm.Script(m[1],{filename:name+'#script'+(++scripts)});}need(scripts>0,name+' 缺少可執行腳本');}

const stepCounts=Object.fromEntries([...allowedStatus].map(status=>[status,tree.journeys.flatMap(j=>j.steps).filter(step=>step.status===status).length]));
console.log(JSON.stringify({result:'PASS',title:tree.title,roles:tree.roles.length,journeys:tree.journeys.length,steps:tree.journeys.flatMap(j=>j.steps).length,statuses:stepCounts,capabilityInventory:`${capabilities.modules.length} modules kept separate`,productionWrites:0},null,2));
