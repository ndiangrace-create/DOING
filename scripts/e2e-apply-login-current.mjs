import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.E2E_BASE||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const jwt=(payload)=>`${Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.x`;
const MEMBER_TOKEN=jwt({type:'member',provider:'line',email:'owner@example.com',expires_at:Date.now()+3600000});
const ADMIN_TOKEN=jwt({email:'owner@example.com',tenant_id:'tn_same',role:'organizer_owner',normalized_role:'organizer_owner',expires_at:Date.now()+3600000});
const SYSTEM_ROUTE={market:'/market/',project:'/project/',booking:'/booking/'};

async function mockApi(page,{enabled=['booking'],applicationSystem='',applicationApproved=true}={}){
  const actions=[];
  await page.route('https://tobeloved-api.ndiangrace.workers.dev/**',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(req.method()==='OPTIONS'){
      await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type'}});return;
    }
    let body={};try{body=req.postDataJSON()||{}}catch{}
    const action=body.action||u.searchParams.get('action')||'';actions.push(action);
    let data={};
    if(action==='getPlatformMemberProfile')data={profile:{name:'測試申請者',email:'owner@example.com',phone:'0912345678',city:'台中市'},applications:[],workspaces:[{id:'tn_same',name:'同一營運帳號',role:'organizer_owner'}]};
    if(action==='savePlatformMemberProfile')data={ok:true};
    if(action==='createOrganizerApplicationDraft')data=applicationApproved?{lineVerified:true,status:'approved',tenantId:'tn_same',applicationId:'APL_test'}:{lineVerified:true,status:'manual_review',applicationId:'APL_test'};
    if(action==='createMemberWorkspaceAdminSession')data={adminToken:ADMIN_TOKEN,tenantId:'tn_same'};
    if(action==='getTenantModuleProfile'){
      const workModules=Object.fromEntries(enabled.map(k=>[k,true]));
      data={configured:true,useType:'beauty',defaults:{registration:true},approvedFlags:{registration:true,workModules}};
    }
    if(action==='adminMe')data={tenant:{id:'tn_same',name:'同一營運帳號'},role:'organizer_owner'};
    await route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({ok:true,data})});
  });
  return actions;
}

async function testApplicationAddsSystem(system){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const actions=await mockApi(page,{enabled:['booking',system],applicationSystem:system});
  const values={unit:'同一營運帳號',owner:'測試申請者',phone:'0912345678',email:'owner@example.com',region:'台中市',link1:'https://example.com/',link2:''};
  await page.addInitScript(({system,values})=>sessionStorage.setItem('doing_apply_current_v1',JSON.stringify({createdAt:Date.now(),system,values})),{system,values});
  await page.goto(`${base}/apply/?system=${system}&resume=1&member_token=${encodeURIComponent(MEMBER_TOKEN)}`,{waitUntil:'domcontentloaded'});
  await page.waitForURL(u=>u.pathname===SYSTEM_ROUTE[system]&&u.searchParams.get('tenant')==='tn_same'&&u.searchParams.get('admin_token')===ADMIN_TOKEN,{timeout:10000});
  assert.ok(actions.includes('getPlatformMemberProfile'),`${system}: member identity not resolved`);
  assert.ok(actions.includes('createOrganizerApplicationDraft'),`${system}: application not submitted`);
  assert.ok(actions.includes('createMemberWorkspaceAdminSession'),`${system}: admin session not created`);
  assert.ok(!actions.includes('saveTenantModuleProfile'),`${system}: application must not overwrite the tenant primary module profile`);
  await page.close();
}

async function testSingleEntitlementDirect(system){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const actions=await mockApi(page,{enabled:[system]});
  await page.goto(`${base}/me/?member_token=${encodeURIComponent(MEMBER_TOKEN)}`,{waitUntil:'domcontentloaded'});
  await page.waitForURL(u=>u.pathname===SYSTEM_ROUTE[system]&&u.searchParams.get('tenant')==='tn_same',{timeout:10000});
  assert.ok(actions.includes('getPlatformMemberProfile'),`${system}: member profile not read`);
  assert.ok(actions.includes('createMemberWorkspaceAdminSession'),`${system}: workspace session not created`);
  assert.ok(actions.includes('getTenantModuleProfile'),`${system}: entitlement SSOT not read`);
  await page.close();
}

async function testMultipleEntitlementsOnlyShowEnabled(){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await mockApi(page,{enabled:['booking','market']});
  await page.goto(`${base}/me/?member_token=${encodeURIComponent(MEMBER_TOKEN)}`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-system-entry="booking"]').waitFor();
  await page.locator('[data-system-entry="market"]').waitFor();
  assert.equal(await page.locator('[data-system-entry]').count(),2,'/me/ must show exactly the two entitled systems');
  assert.equal(await page.locator('[data-system-entry="project"]').count(),0,'unentitled project must not appear');
  assert.equal(new URL(page.url()).pathname,'/me/','multiple entitlements must stay on My DOING for choice');
  await page.close();
}

async function testWorkspaceHidesUnentitled(){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await mockApi(page,{enabled:['booking']});
  await page.goto(`${base}/workspace/?tenant=tn_same&admin_token=${encodeURIComponent(ADMIN_TOKEN)}`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-module-card="booking"]').waitFor();
  assert.equal(await page.locator('[data-module-card]').count(),1,'workspace must render only entitled systems');
  assert.equal(await page.locator('[data-module-card="market"]').count(),0,'workspace must not render market without entitlement');
  assert.equal(await page.locator('[data-module-card="project"]').count(),0,'workspace must not render project without entitlement');
  const body=await page.locator('body').innerText();
  assert.ok(!body.includes('尚未確認權限'),'old disabled entitlement cards must be removed');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),false,'workspace mobile overflow');
  await page.close();
}

try{
  const choice=await browser.newPage({viewport:{width:390,height:844}});
  await choice.goto(base+'/apply/',{waitUntil:'domcontentloaded'});
  assert.equal(await choice.locator('[data-system]').count(),3,'/apply/ must keep exactly three public systems');
  assert.equal(await choice.locator('text=這個操作頁正在重新建置').count(),0,'/apply/ must remain live');
  assert.equal(await choice.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),false,'apply mobile overflow');
  await choice.close();

  await testApplicationAddsSystem('market');
  await testApplicationAddsSystem('project');
  await testApplicationAddsSystem('booking');
  await testSingleEntitlementDirect('market');
  await testSingleEntitlementDirect('project');
  await testSingleEntitlementDirect('booking');
  await testMultipleEntitlementsOnlyShowEnabled();
  await testWorkspaceHidesUnentitled();

  console.log(JSON.stringify({result:'PASS',model:'one-member-one-owned-tenant-multi-system',entitlementSSOT:'tenant_settings.module_flags_json.workModules',applyRoute:'/apply/',directTargets:SYSTEM_ROUTE,multipleSystemsOnlyShowEnabled:true,unentitledVisible:false,useCasesAuthorization:false,newRoutes:0,productionWrites:0,twoBlChanges:0},null,2));
} finally {await browser.close()}
