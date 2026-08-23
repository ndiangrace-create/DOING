import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BASE=process.env.E2E_BASE||'http://127.0.0.1:4173';
const API='https://tobeloved-api.ndiangrace.workers.dev';
fs.mkdirSync('artifacts',{recursive:true});

async function open(browser,viewport,name,routeHandler){
  const page=await browser.newPage({viewportSize:viewport});
  const dialogs=[];
  page.on('dialog',async d=>{dialogs.push(d.message());await d.accept()});
  await page.route(`${API}/**`,routeHandler);
  await page.goto(`${BASE}/market/public/?tenant=demo`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#tenantLogo');
  return {page,dialogs,name};
}

async function holdLogo(page){
  const logo=page.locator('#tenantLogo');
  const box=await logo.boundingBox();
  assert.ok(box,'LOGO must be visible');
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.waitForTimeout(3150);
  await page.mouse.up();
}

const browser=await chromium.launch({headless:true});
try{
  const results=[];

  for(const spec of [
    {name:'desktop',viewport:{width:1440,height:1000}},
    {name:'mobile',viewport:{width:390,height:844}},
  ]){
    let startUrl='';
    const {page}=await open(browser,spec.viewport,spec.name,async route=>{
      const u=new URL(route.request().url());
      if(u.pathname==='/auth/line/start'){
        startUrl=u.toString();
        await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Mock LINE</title>'});
        return;
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{items:[]}})});
    });
    await holdLogo(page);
    await page.waitForTimeout(100);
    assert.ok(startUrl,'3 second LOGO hold must start LINE login');
    const start=new URL(startUrl);
    assert.equal(start.searchParams.get('mode'),'member','hidden admin entry must authenticate as member identity first');
    const ret=new URL(start.searchParams.get('return_url'));
    assert.equal(ret.pathname,'/market/public/');
    assert.equal(ret.searchParams.get('tenant'),'demo');
    assert.equal(ret.searchParams.get('doing_login_flow'),'market_admin');
    assert.equal(ret.searchParams.get('market_admin_tenant'),'demo');
    results.push({viewport:spec.name,longPressMs:3000,mode:start.searchParams.get('mode'),returnPath:ret.pathname,tenant:ret.searchParams.get('tenant')});
    await page.close();
  }

  {
    let exchangeBody=null;
    const page=await browser.newPage({viewportSize:{width:1440,height:1000}});
    page.on('dialog',d=>d.accept());
    await page.route(`${API}/**`,async route=>{
      const u=new URL(route.request().url());
      if(u.searchParams.get('action')==='createMemberWorkspaceAdminSession'){
        exchangeBody=route.request().postDataJSON();
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{adminToken:'admin-token-demo',tenantId:'demo',tenantName:'Demo',locked:false}})});
        return;
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{items:[]}})});
    });
    await page.goto(`${BASE}/market/public/?tenant=demo&doing_login_flow=market_admin&market_admin_tenant=demo&member_token=member-token-demo&member_status=ready`,{waitUntil:'domcontentloaded'});
    await page.waitForURL(u=>u.pathname==='/market/'&&u.searchParams.get('admin_token')==='admin-token-demo',{timeout:5000});
    assert.equal(exchangeBody?.member_token,'member-token-demo');
    assert.equal(exchangeBody?.tenantId,'demo');
    assert.equal(new URL(page.url()).searchParams.get('tenant'),'demo');
    assert.equal(new URL(page.url()).searchParams.get('admin_token'),'admin-token-demo');
    await page.screenshot({path:'artifacts/market-logo-admin-entry-desktop.png',fullPage:true});
    results.push({case:'authorized',memberTokenExchanged:true,adminTokenFromCore:true,tenant:'demo'});
    await page.close();
  }

  {
    const page=await browser.newPage({viewportSize:{width:390,height:844}});
    const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.accept()});
    await page.route(`${API}/**`,async route=>{
      const u=new URL(route.request().url());
      if(u.searchParams.get('action')==='createMemberWorkspaceAdminSession'){
        await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({ok:false,error:'你沒有這個營運空間的管理權限'})});return;
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{items:[]}})});
    });
    await page.goto(`${BASE}/market/public/?tenant=demo&doing_login_flow=market_admin&market_admin_tenant=demo&member_token=ordinary-member`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(250);
    assert.equal(new URL(page.url()).pathname,'/market/public/');
    assert.equal(new URL(page.url()).searchParams.has('admin_token'),false);
    assert.ok(dialogs.some(x=>x.includes('沒有這個營運空間的管理權限')));
    await page.screenshot({path:'artifacts/market-logo-admin-entry-denied-mobile.png',fullPage:true});
    results.push({case:'ordinary-member-denied',stayedPublic:true,adminToken:false});
    await page.close();
  }

  {
    const page=await browser.newPage({viewportSize:{width:390,height:844}});
    const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.accept()});
    await page.route(`${API}/**`,async route=>{
      const u=new URL(route.request().url());
      if(u.searchParams.get('action')==='createMemberWorkspaceAdminSession'){
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{adminToken:'must-not-enter',tenantId:'demo',locked:true,lockedReason:'營運空間目前暫停使用'}})});return;
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{items:[]}})});
    });
    await page.goto(`${BASE}/market/public/?tenant=demo&doing_login_flow=market_admin&market_admin_tenant=demo&member_token=locked-owner`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(250);
    assert.equal(new URL(page.url()).pathname,'/market/public/');
    assert.equal(new URL(page.url()).searchParams.has('admin_token'),false);
    assert.ok(dialogs.some(x=>x.includes('營運空間目前暫停使用')));
    results.push({case:'locked-tenant-denied',stayedPublic:true,adminToken:false});
    await page.close();
  }

  console.log(JSON.stringify({result:'PASS',feature:'Market public LOGO 3-second secure admin entry',identityLogin:'LINE member',authorization:'createMemberWorkspaceAdminSession',requiresActiveTenant:true,requiresActiveStaff:true,lockedTenantDenied:true,ordinaryMemberDenied:true,productionWrites:0,results},null,2));
} finally {
  await browser.close();
}
