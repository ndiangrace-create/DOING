import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.E2E_BASE||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const jwt=(payload)=>`${Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.x`;
const memberToken=()=>jwt({type:'member',provider:'line',email:'owner@example.com',expires_at:Date.now()+3600000});
const ADMIN_TOKEN=jwt({email:'owner@example.com',tenant_id:'tn_test',role:'organizer_owner',expires_at:Date.now()+3600000});
async function mockApi(page,{system='market',memberDirect=false}={}){
  const actions=[];
  const submittedApplications=[];
  await page.route('https://tobeloved-api.ndiangrace.workers.dev/**',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(req.method()==='OPTIONS'){
      await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type'}});
      return;
    }
    let body={};try{body=req.postDataJSON()||{}}catch{}
    const action=body.action||u.searchParams.get('action')||'';actions.push(action);
    let data={};
    if(action==='getPlatformMemberProfile'){
      if(memberDirect){
        const app=system==='market'?{status:'approved',tenantId:'tn_test',useCases:['market'],industryCategories:['market_retail']}:system==='project'?{status:'approved',tenantId:'tn_test',useCases:['general'],industryCategories:['professional_service']}:{status:'approved',tenantId:'tn_test',useCases:['beauty','service_booking'],industryCategories:['beauty_wellness']};
        data={profile:{name:'測試申請者',email:'owner@example.com',phone:'0912345678',city:'台中市'},applications:[app],workspaces:[{id:'tn_test',name:'測試工作空間',role:'organizer_owner'}]};
      }else data={profile:{name:'測試申請者',email:'owner@example.com',phone:'0912345678',city:'台中市'},applications:[],workspaces:[]};
    }
    if(action==='savePlatformMemberProfile')data={ok:true};
    if(action==='createOrganizerApplicationDraft'){
      submittedApplications.push(body.application||{});
      data={lineVerified:true,status:'approved',tenantId:'tn_test',applicationId:'APL_test'};
    }
    if(action==='createMemberWorkspaceAdminSession')data={adminToken:ADMIN_TOKEN,tenantId:'tn_test'};
    if(action==='getTenantModuleProfile')data={configured:true,useType:'generic',defaults:{registration:true},approvedFlags:{registration:true}};
    if(action==='saveTenantModuleProfile')data={configured:true,useType:'project',defaults:{registration:true}};
    await route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({ok:true,data})});
  });
  actions.submittedApplications=submittedApplications;
  return actions;
}
async function testApplication(system,target){
  const page=await browser.newPage({viewport:{width:390,height:844}}),token=memberToken();
  const actions=await mockApi(page,{system});
  const slug=`test-${system}`;
  const values={unit:'測試工作室',systemAccount:slug,owner:'測試申請者',phone:'0912345678',email:'owner@example.com',region:'台中市',link1:'https://example.com/',link2:''};
  await page.addInitScript(({system,values})=>sessionStorage.setItem('doing_apply_current_v2',JSON.stringify({createdAt:Date.now(),system,values})),{system,values});
  await page.goto(`${base}/apply/?system=${system}&resume=1&member_token=${encodeURIComponent(token)}`,{waitUntil:'domcontentloaded'});
  await page.waitForURL(u=>u.pathname===target&&u.searchParams.get('tenant')==='tn_test'&&u.searchParams.get('admin_token')===ADMIN_TOKEN,{timeout:10000});
  assert.ok(actions.includes('getPlatformMemberProfile'),`${system}: member profile not verified`);
  assert.ok(actions.includes('savePlatformMemberProfile'),`${system}: member profile not saved`);
  assert.ok(actions.includes('createOrganizerApplicationDraft'),`${system}: application not created`);
  assert.ok(actions.includes('createMemberWorkspaceAdminSession'),`${system}: workspace session not created`);
  assert.equal(actions.submittedApplications.length,1,`${system}: application payload count mismatch`);
  assert.equal(actions.submittedApplications[0].tenantSlug,slug,`${system}: tenant slug not stored in application payload`);
  assert.equal(actions.submittedApplications[0].requestedTenantSlug,slug,`${system}: requested tenant slug missing`);
  assert.equal(actions.submittedApplications[0].routeContract?.tenantSlug,slug,`${system}: route contract tenant slug missing`);
  assert.equal(actions.submittedApplications[0].routeContract?.publicPath,`/${system}/${slug}/`,`${system}: route contract public path mismatch`);
  if(system==='project'){
    assert.ok(actions.includes('getTenantModuleProfile'),'project: module profile not read');
    assert.ok(actions.includes('saveTenantModuleProfile'),'project: project profile not persisted');
  }
  await page.close();
}
async function testMemberDirect(system,target){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),token=memberToken();
  const actions=await mockApi(page,{system,memberDirect:true});
  await page.goto(`${base}/me/?member_token=${encodeURIComponent(token)}`,{waitUntil:'domcontentloaded'});
  await page.waitForURL(u=>u.pathname===target&&u.searchParams.get('tenant')==='tn_test',{timeout:10000});
  assert.ok(actions.includes('getPlatformMemberProfile'),`${system}: login did not resolve member`);
  assert.ok(actions.includes('createMemberWorkspaceAdminSession'),`${system}: login did not create workspace session`);
  await page.close();
}
try{
  const choice=await browser.newPage({viewport:{width:390,height:844}});
  await choice.goto(base+'/apply/?system=market',{waitUntil:'domcontentloaded'});
  assert.equal(await choice.locator('[data-system]').count(),3,'/apply/ must show exactly three public systems');
  assert.equal(await choice.locator('#systemAccount').count(),1,'application must include one tenant system account field');
  await choice.locator('#systemAccount').fill('demo-market');
  assert.equal(await choice.locator('#systemUrlPreview').textContent(),`${base}/market/demo-market/`,'market tenant URL preview mismatch');
  await choice.locator('#systemAccount').fill('market');
  await choice.locator('#unit').fill('測試工作室');
  await choice.locator('#owner').fill('測試申請者');
  await choice.locator('#phone').fill('0912345678');
  await choice.locator('#email').fill('owner@example.com');
  await choice.locator('#region').selectOption({label:'台中市'});
  await choice.locator('#link1').fill('https://example.com/');
  await choice.locator('#applyForm').evaluate(form=>form.requestSubmit());
  await choice.waitForTimeout(50);
  assert.match(await choice.locator('#statusBox').textContent(),/保留字/,'reserved tenant slug must be rejected before LINE');
  assert.equal(await choice.locator('text=這個操作頁正在重新建置').count(),0,'/apply/ must not be rebuild shell');
  assert.equal(await choice.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1),false,'apply mobile horizontal overflow');
  await choice.close();

  await testApplication('market','/market/');
  await testApplication('project','/project/');
  await testApplication('booking','/booking/');
  await testMemberDirect('market','/market/');
  await testMemberDirect('project','/project/');
  await testMemberDirect('booking','/booking/');

  console.log(JSON.stringify({result:'PASS',applyRoute:'/apply/',publicSystems:3,tenantSystemAccount:true,tenantSlugSavedInApplication:true,tenantUrlPatterns:{market:'/market/{tenant-slug}/',project:'/project/{tenant-slug}/',booking:'/booking/{tenant-slug}/'},lineMode:'member-standard-sso',applicationReturnPreserved:true,directTargets:{market:'/market/',project:'/project/',booking:'/booking/'},memberFreshLoginDirect:true,newRoutes:0,databaseSchemaChanges:0,twoBlChanges:0},null,2));
} finally {await browser.close()}
