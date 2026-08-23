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
async function assertStableOperations(page,{postApplication=false}={}){
  await page.waitForTimeout(300);
  const u=new URL(page.url());
  assert.equal(u.pathname,'/me/','完成後必須穩定停在我的 DOING');
  assert.equal(u.hash,'#operations','完成後必須開啟我的營運');
  if(postApplication)assert.equal(u.searchParams.get('post_application'),'1','申請完成後必須保留 post_application checkpoint');
  return u;
}
function completedMember(extra={}){
  return {ok:true,complete:true,profile:{name:'王小明',email:'formal@example.com',phone:'0912345678',city:'台中市'},linkedProviders:['line'],roles:[],platformAccess:null,applications:[],workspaces:[],brands:[],...extra};
}

async function fillApplication(page,suffix='desktop'){
  await page.goto(`${BASE}/apply/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-p="market"]').click();
  await page.locator('#nx').click();
  await page.locator('[data-k="market"][value="market"]').check();
  await page.locator('#nx').click();
  await page.locator('#unit').fill(`閉環測試品牌-${suffix}`);
  await page.locator('#owner').fill('王小明');
  await page.locator('#phone').fill('0912345678');
  await page.locator('#email').fill(`formal-${suffix}@example.com`);
  await page.locator('#region').selectOption({label:'台中市'});
  await page.locator('#link1').fill('https://example.com/brand');
}

async function firstTimeScenario(browser,name,viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const token=fakeLineToken(`U_${name.toUpperCase()}`);
  const state={authStarts:0,profileSaves:0,drafts:0,profilePayload:null,draftPayload:null,errors:[]};
  page.on('pageerror',e=>state.errors.push(String(e)));
  await page.route(`${API}/**`,async route=>{
    const req=route.request(),url=new URL(req.url()),action=url.searchParams.get('action')||'';
    if(url.pathname.endsWith('/auth/line/start')){
      state.authStarts++;
      assert.equal(url.searchParams.get('mode'),'member','第一次申請只允許 LINE member 驗證');
      const ret=new URL(url.searchParams.get('return_url'));
      assert.equal(ret.origin,BASE,'LINE 必須回原 DOING 正式申請站來源');
      assert.equal(ret.pathname,'/apply/','LINE 必須回 /apply/');
      assert.equal(ret.searchParams.get('doing_application_resume'),'1','LINE 回跳必須標記續接申請');
      ret.searchParams.set('member_token',token);ret.searchParams.set('member_status','profile_required');
      return route.fulfill({status:302,headers:{location:ret.toString()},body:''});
    }
    if(action==='savePlatformMemberProfile'){
      state.profileSaves++;
      const body=JSON.parse(req.postData()||'{}');state.profilePayload=body;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});
    }
    if(action==='createOrganizerApplicationDraft'){
      state.drafts++;
      const body=JSON.parse(req.postData()||'{}');state.draftPayload=body;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,applicationId:`APP_${name}`,lineVerified:true,status:'approved',tenantId:`tenant-${name}`})});
    }
    if(action==='getPlatformMemberProfile')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(completedMember({workspaces:[{id:`tenant-${name}`,tenant_id:`tenant-${name}`,name:`閉環測試品牌-${name}`,role:'owner'}]}))});
    if(action==='getMyRegsGlobal')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    if(action==='getMyOperationalTasks'||action==='getBrandAccessRequests')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(action==='getMyOperationalTasks'?{registrations:[],salesReports:[],serviceVisits:[]}:[])});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});
  });

  await fillApplication(page,name);
  const reached=waitForOperationsNavigation(page,{postApplication:true});
  await page.locator('#nx').click();
  const frame=await reached,checkpoint=new URL(frame.url());
  assert.equal(checkpoint.searchParams.get('application_id'),`APP_${name}`,'我的 DOING checkpoint 必須保留正式申請編號');
  assert.equal(checkpoint.searchParams.get('tenant_id'),`tenant-${name}`,'我的 DOING checkpoint 必須保留已建立 tenant');
  const settled=await assertStableOperations(page,{postApplication:true});
  assert.equal(settled.searchParams.get('application_id'),`APP_${name}`,'穩定頁必須保留正式申請編號');
  assert.equal(settled.searchParams.get('tenant_id'),`tenant-${name}`,'穩定頁必須保留已建立 tenant');
  await page.screenshot({path:`artifacts/formal-application-closure-${name}.png`,fullPage:true});
  assert.equal(state.authStarts,1,'第一次申請只能做一次 LINE member 驗證');
  assert.equal(state.profileSaves,1,'LINE 回來後必須先寫回同一會員主檔');
  assert.equal(state.drafts,1,'正式申請只能建立一次');
  assert.equal(state.profilePayload?.member_token,token,'會員主檔必須使用同一 member_token');
  assert.equal(state.profilePayload?.name,'王小明');
  assert.equal(state.profilePayload?.phone,'0912345678');
  assert.equal(state.profilePayload?.email,`formal-${name}@example.com`);
  assert.equal(state.draftPayload?.member_token,token,'正式申請必須沿用同一 member_token');
  assert.ok(!('admin_token' in (state.draftPayload||{})),'申請不得自行帶 admin_token');
  assert.equal(state.errors.length,0,`瀏覽器 JS error: ${state.errors.join(' | ')}`);
  await context.close();
  return state;
}

async function existingWorkspaceScenario(browser){
  const token=fakeLineToken('U_EXISTING');
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(t=>localStorage.setItem('doing_member_token',t),token);
  const page=await context.newPage();let drafts=0,authStarts=0;
  await page.route(`${API}/**`,async route=>{
    const req=route.request(),url=new URL(req.url()),action=url.searchParams.get('action')||'';
    if(url.pathname.endsWith('/auth/line/start')){authStarts++;return route.abort()}
    if(action==='createOrganizerApplicationDraft'){drafts++;return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})}
    if(action==='getPlatformMemberProfile')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(completedMember({workspaces:[{id:'tenant-existing',tenant_id:'tenant-existing',name:'既有工作空間',role:'owner'}]}))});
    if(action==='getMyRegsGlobal')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    if(action==='getMyOperationalTasks'||action==='getBrandAccessRequests')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(action==='getMyOperationalTasks'?{registrations:[],salesReports:[],serviceVisits:[]}:[])});
    return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
  });
  await page.goto(`${BASE}/apply/`,{waitUntil:'domcontentloaded'});
  await page.getByText('你的工作空間已經開通').waitFor({timeout:8000});
  await page.screenshot({path:'artifacts/formal-application-existing-workspace-mobile.png',fullPage:true});
  const reached=waitForOperationsNavigation(page);
  await page.getByRole('button',{name:'進入我的 DOING'}).click();
  await reached;await assertStableOperations(page);
  assert.equal(drafts,0,'已有工作空間不得再建立申請');
  assert.equal(authStarts,0,'已有有效 LINE member token 不得重複登入');
  await context.close();
}

async function pendingApplicationScenario(browser){
  const token=fakeLineToken('U_PENDING');
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(t=>localStorage.setItem('doing_member_token',t),token);
  const page=await context.newPage();let drafts=0,authStarts=0,profileSaves=0;
  await page.route(`${API}/**`,async route=>{
    const req=route.request(),url=new URL(req.url()),action=url.searchParams.get('action')||'';
    if(url.pathname.endsWith('/auth/line/start')){authStarts++;return route.abort()}
    if(action==='getPlatformMemberProfile')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(completedMember({applications:[{id:'APP_PENDING',status:'pending',unitName:'既有申請'}]}))});
    if(action==='savePlatformMemberProfile'){profileSaves++;return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})}
    if(action==='createOrganizerApplicationDraft'){drafts++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({error:'此會員已有進行中的營運申請'})})}
    if(action==='getMyRegsGlobal')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    if(action==='getMyOperationalTasks'||action==='getBrandAccessRequests')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(action==='getMyOperationalTasks'?{registrations:[],salesReports:[],serviceVisits:[]}:[])});
    return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
  });
  await fillApplication(page,'pending');
  const reached=waitForOperationsNavigation(page,{postApplication:true,timeout:10000});
  await page.locator('#nx').click();
  await reached;await assertStableOperations(page,{postApplication:true});
  assert.equal(profileSaves,1);
  assert.equal(drafts,1,'進行中申請檢查只允許一次正式 create 呼叫');
  assert.equal(authStarts,0,'已有有效 LINE member token 不得再登入');
  await context.close();
}

const browser=await chromium.launch({headless:true});
try{
  const desktop=await firstTimeScenario(browser,'desktop',{width:1440,height:1000});
  const mobile=await firstTimeScenario(browser,'mobile',{width:390,height:844});
  await existingWorkspaceScenario(browser);
  await pendingApplicationScenario(browser);
  console.log(JSON.stringify({
    result:'PASS',
    desktop:{authStarts:desktop.authStarts,profileSaves:desktop.profileSaves,drafts:desktop.drafts},
    mobile:{authStarts:mobile.authStarts,profileSaves:mobile.profileSaves,drafts:mobile.drafts},
    existingWorkspace:'no duplicate application',
    pendingApplication:'resume existing application state',
    lineMode:'member',
    memberTokenIsNotAdminToken:true,
    productionWrites:0
  },null,2));
}finally{await browser.close()}
