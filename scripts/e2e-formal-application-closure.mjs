import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BASE=(process.env.E2E_BASE||'http://127.0.0.1:4173').replace(/\/$/,'');
const API='https://tobeloved-api.ndiangrace.workers.dev';
fs.mkdirSync('artifacts',{recursive:true});

function b64url(obj){return Buffer.from(JSON.stringify(obj)).toString('base64url')}
function fakeLineToken(subject='U_FORMAL_E2E'){
  return `${b64url({alg:'HS256',typ:'JWT'})}.${b64url({iss:'DOING',type:'member',sub:subject,provider:'line',provider_subject:subject,expires_at:Date.now()+3600_000})}.test`;
}
function waitForOperationsNavigation(page,{postApplication=false,timeout=15000}={}){
  return page.waitForEvent('framenavigated',{timeout,predicate:frame=>{
    if(frame!==page.mainFrame())return false;
    try{const u=new URL(frame.url());return u.pathname==='/me/'&&u.hash==='#operations'&&(!postApplication||u.searchParams.get('post_application')==='1')}catch(_){return false}
  }});
}
async function assertStableOperations(page){
  await page.waitForTimeout(250);const u=new URL(page.url());assert.equal(u.pathname,'/me/');assert.equal(u.hash,'#operations');return u;
}
async function stableShot(page,path){await page.screenshot({path,fullPage:false,animations:'disabled',timeout:10000})}
function completedMember(extra={}){
  return {ok:true,complete:true,profile:{name:'王小明',email:'formal@example.com',phone:'0912345678',city:'台中市'},linkedProviders:['line'],roles:[],platformAccess:null,applications:[],workspaces:[],brands:[],...extra};
}
async function fillApplication(page,suffix='desktop'){
  await page.goto(`${BASE}/apply/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-p="market"]').click();
  await page.locator('[data-k="market"][value="market"]').check();
  await page.locator('#unit').fill(`閉環測試品牌-${suffix}`);
  await page.locator('#owner').fill('王小明');
  await page.locator('#phone').fill('0912345678');
  await page.locator('#email').fill(`formal-${suffix}@example.com`);
  await page.locator('#region').selectOption({label:'台中市'});
  await page.locator('#link1').fill('https://example.com/brand');
  assert.equal(await page.locator('#submitApplication').count(),1,'單頁只能有一個正式送出鍵');
  assert.equal(await page.getByText('上一步',{exact:false}).count(),0,'單頁不得有上一步');
  assert.equal(await page.getByText('下一步',{exact:false}).count(),0,'單頁不得有下一步');
}

async function firstTimeScenario(browser,name,viewport){
  const context=await browser.newContext({viewport});const page=await context.newPage();const token=fakeLineToken(`U_${name.toUpperCase()}`);
  const state={authStarts:0,profileSaves:0,profileReads:0,drafts:0,profilePayload:null,draftPayload:null,errors:[]};page.on('pageerror',e=>state.errors.push(String(e)));
  await page.route(`${API}/**`,async route=>{
    const req=route.request(),url=new URL(req.url()),action=url.searchParams.get('action')||'';
    if(url.pathname.endsWith('/auth/line/start')){state.authStarts++;assert.equal(url.searchParams.get('mode'),'member');const ret=new URL(url.searchParams.get('return_url'));assert.equal(ret.pathname,'/apply/');assert.equal(ret.searchParams.get('doing_application_resume'),'1');ret.searchParams.set('member_token',token);ret.searchParams.set('member_status','profile_required');return route.fulfill({status:302,headers:{location:ret.toString()},body:''})}
    if(action==='savePlatformMemberProfile'){state.profileSaves++;state.profilePayload=JSON.parse(req.postData()||'{}');return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})}
    if(action==='getPlatformMemberProfile'){state.profileReads++;const data=state.drafts?completedMember({workspaces:[{id:`tenant-${name}`,tenant_id:`tenant-${name}`,name:`閉環測試品牌-${name}`,role:'owner'}]}):completedMember();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})}
    if(action==='createOrganizerApplicationDraft'){state.drafts++;state.draftPayload=JSON.parse(req.postData()||'{}');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,applicationId:`APP_${name}`,lineVerified:true,status:'approved',tenantId:`tenant-${name}`})})}
    if(action==='getMyRegsGlobal')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    if(action==='getMyOperationalTasks'||action==='getBrandAccessRequests')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(action==='getMyOperationalTasks'?{registrations:[],salesReports:[],serviceVisits:[]}:[])});
    return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
  });
  await fillApplication(page,name);await stableShot(page,`artifacts/formal-application-single-page-${name}.png`);
  const reached=waitForOperationsNavigation(page);await page.locator('#submitApplication').click();await reached;const settled=await assertStableOperations(page);
  assert.equal(settled.searchParams.get('application_id'),`APP_${name}`);assert.equal(settled.searchParams.get('tenant_id'),`tenant-${name}`);
  assert.equal(state.authStarts,1);assert.equal(state.profileSaves,1);assert.equal(state.drafts,1);assert.ok(state.profileReads>=1);
  assert.equal(state.profilePayload?.member_token,token);assert.equal(state.draftPayload?.member_token,token);assert.ok(!('admin_token' in (state.draftPayload||{})));assert.equal(state.errors.length,0,state.errors.join(' | '));
  await context.close();return state;
}

async function existingWorkspaceAfterLineScenario(browser){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const token=fakeLineToken('U_REAL_FAILURE_REPRO');
  const state={authStarts:0,profileSaves:0,profileReads:0,drafts:0,errors:[]};page.on('pageerror',e=>state.errors.push(String(e)));
  await page.route(`${API}/**`,async route=>{
    const req=route.request(),url=new URL(req.url()),action=url.searchParams.get('action')||'';
    if(url.pathname.endsWith('/auth/line/start')){state.authStarts++;const ret=new URL(url.searchParams.get('return_url'));ret.searchParams.set('member_token',token);ret.searchParams.set('member_status','ready');return route.fulfill({status:302,headers:{location:ret.toString()},body:''})}
    if(action==='savePlatformMemberProfile'){state.profileSaves++;return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})}
    if(action==='getPlatformMemberProfile'){state.profileReads++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(completedMember({workspaces:[{id:'tenant-existing',tenant_id:'tenant-existing',name:'既有營運空間',role:'owner'}]}))})}
    if(action==='createOrganizerApplicationDraft'){state.drafts++;return route.fulfill({status:500,contentType:'application/json',body:'{"error":"這一行不應被呼叫"}'})}
    if(action==='getMyRegsGlobal')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    if(action==='getMyOperationalTasks'||action==='getBrandAccessRequests')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(action==='getMyOperationalTasks'?{registrations:[],salesReports:[],serviceVisits:[]}:[])});
    return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
  });
  await fillApplication(page,'existing-after-line');const reached=waitForOperationsNavigation(page);await page.locator('#submitApplication').click();await reached;await assertStableOperations(page);
  assert.equal(state.authStarts,1,'需要先完成一次 LINE member 驗證');assert.equal(state.profileSaves,1,'LINE 回來後先保存同一會員資料');assert.ok(state.profileReads>=1,'必須先讀會員既有工作空間');assert.equal(state.drafts,0,'已有工作空間不得再呼叫建立申請 API');assert.equal(state.errors.length,0,state.errors.join(' | '));
  await context.close();return state;
}

async function existingWorkspaceAlreadyLoggedInScenario(browser){
  const token=fakeLineToken('U_EXISTING');const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(t=>localStorage.setItem('doing_member_token',t),token);const page=await context.newPage();let drafts=0,authStarts=0;
  await page.route(`${API}/**`,async route=>{const url=new URL(route.request().url()),action=url.searchParams.get('action')||'';if(url.pathname.endsWith('/auth/line/start')){authStarts++;return route.abort()}if(action==='createOrganizerApplicationDraft'){drafts++;return route.fulfill({status:500,body:'{}'})}if(action==='getPlatformMemberProfile')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(completedMember({workspaces:[{id:'tenant-existing',tenant_id:'tenant-existing',name:'既有工作空間',role:'owner'}]}))});if(action==='getMyRegsGlobal')return route.fulfill({status:200,contentType:'application/json',body:'[]'});if(action==='getMyOperationalTasks'||action==='getBrandAccessRequests')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(action==='getMyOperationalTasks'?{registrations:[],salesReports:[],serviceVisits:[]}:[])});return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})});
  await page.goto(`${BASE}/apply/`,{waitUntil:'domcontentloaded'});await page.getByText('你的工作空間已經開通').waitFor({timeout:8000});await stableShot(page,'artifacts/formal-application-existing-workspace-mobile.png');const reached=waitForOperationsNavigation(page);await page.getByRole('button',{name:'進入我的 DOING'}).click();await reached;await assertStableOperations(page);assert.equal(drafts,0);assert.equal(authStarts,0);await context.close();
}

async function pendingApplicationScenario(browser){
  const token=fakeLineToken('U_PENDING');const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(t=>localStorage.setItem('doing_member_token',t),token);const page=await context.newPage();let drafts=0;
  await page.route(`${API}/**`,async route=>{const url=new URL(route.request().url()),action=url.searchParams.get('action')||'';if(action==='getPlatformMemberProfile')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(completedMember({applications:[{id:'APP_PENDING',status:'pending',unitName:'既有申請'}]}))});if(action==='createOrganizerApplicationDraft'){drafts++;return route.fulfill({status:500,body:'{}'})}return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})});
  await page.goto(`${BASE}/apply/`,{waitUntil:'domcontentloaded'});await page.getByText('你的申請已送出').waitFor({timeout:8000});assert.equal(drafts,0,'進行中申請不得再建立第二份');await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  const desktop=await firstTimeScenario(browser,'desktop',{width:1440,height:1000});
  const mobile=await firstTimeScenario(browser,'mobile',{width:390,height:844});
  const realFailure=await existingWorkspaceAfterLineScenario(browser);
  await existingWorkspaceAlreadyLoggedInScenario(browser);await pendingApplicationScenario(browser);
  console.log(JSON.stringify({result:'PASS',singlePage:true,desktop:{authStarts:desktop.authStarts,profileSaves:desktop.profileSaves,drafts:desktop.drafts},mobile:{authStarts:mobile.authStarts,profileSaves:mobile.profileSaves,drafts:mobile.drafts},realFailureRegression:{authStarts:realFailure.authStarts,profileSaves:realFailure.profileSaves,drafts:realFailure.drafts,expected:'existing workspace -> /me/#operations'},existingWorkspaceAlreadyLoggedIn:'no duplicate application',pendingApplication:'no duplicate application',lineMode:'member',memberTokenIsNotAdminToken:true,productionWrites:0},null,2));
}finally{await browser.close()}
