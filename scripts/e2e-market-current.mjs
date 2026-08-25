import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.E2E_BASE||'http://127.0.0.1:4173';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const adminToken=`${b64({alg:'none',typ:'JWT'})}.${b64({email:'admin@example.com',normalized_role:'superadmin'})}.x`;
const writes=[];
const reads=[];
const session={id:'S1',name:'測試市集',dates:[{date:'2026-09-01',label:'2026-09-01'}],venue:'測試場地',fee:500,deposit:500,limit:30,status:'open',desc:'測試說明',modules:{registration:true,quantityMode:'stall',review:true,equipment:true,seatSelection:true,agreement:true,payment:true,checkin:true},equip:{table:{name:'桌子',label:'桌子',price:100,open:true}}};
const sessions=[{...session,registrationCount:4,pendingCount:1,paidCount:2,refundCount:1}];
const regs=[
  {id:'R1',sessionId:'S1',brand:'品牌甲',name:'王小明',phone:'0900000001',email:'a@example.com',reviewStatus:'已錄取',paymentStatus:'未繳費',checkinStatus:'未報到',refundStatus:''},
  {id:'R2',sessionId:'S1',brand:'品牌乙',name:'李小華',phone:'0900000002',email:'b@example.com',reviewStatus:'待審核',paymentStatus:'付款待確認',checkinStatus:'未報到',refundStatus:'待退款'},
  {id:'R3',sessionId:'S1',brand:'品牌丙',name:'陳小美',phone:'0900000003',email:'c@example.com',reviewStatus:'已錄取',paymentStatus:'已繳費',checkinStatus:'已報到',stallNumber:'A02',refundStatus:''},
  {id:'R4',sessionId:'S1',brand:'品牌丁',name:'林小安',phone:'0900000004',email:'d@example.com',reviewStatus:'已錄取',paymentStatus:'已繳費',checkinStatus:'未報到',refundStatus:''}
];
function payload(action){
  switch(action){
    case 'getSessionsAdmin': return sessions;
    case 'getAdminSessionsDashboard': return sessions;
    case 'getTodos': return [{title:'審核品牌乙',sessionId:'S1',sessionName:'測試市集',kind:'review'},{title:'確認付款',sessionId:'S1',sessionName:'測試市集',kind:'payment'}];
    case 'getMembers': return [{brand:'品牌甲',name:'王小明',phone:'0900000001',email:'a@example.com'}];
    case 'financeOverview': return {summary:{incomeTotal:3000,refundTotal:500,expenseTotal:700,netTotal:1800}};
    case 'getSiteConfig': return {brandName:'測試主辦',logoUrl:'/doing-logo.png',heroImg:'',infoText:'測試介紹'};
    case 'getSessionRegistrations': return regs;
    case 'getSessionDashboard': return {session};
    case 'adminSeatBoard': return {seats:[{stallCode:'A01'},{stallCode:'A02',registrationId:'R3',brandName:'品牌丙'}]};
    case 'getSessionEquipmentDetails': return {rows:[{name:'桌子',quantity:1}]};
    case 'financeReport': return {summary:{incomeTotal:3000,refundTotal:500,expenseTotal:700,netTotal:1800}};
    case 'getRefundSuggestion': return {refundAmount:500};
    case 'publicDiscovery': return {items:[{tenantId:'demo',sessionId:'S1',sessionName:'測試市集',dates:[{date:'2026-09-01',label:'2026-09-01'}],venue:'測試場地',description:'測試活動',cover:'',status:'open'}]};
    case 'frontBootstrap': return {tenant:{id:'demo',name:'測試主辦',infoText:'測試介紹',i18n:{enabled:false,languages:['zh-TW'],defaultLanguage:'zh-TW'}},events:[],sessions:[session],operationUnits:[],announcements:[]};
    case 'getSession': return session;
    case 'getBundlesPublic': return [];
    case 'getPlatformMemberProfile': return {profile:{name:'王小明',phone:'0900000001',email:'a@example.com',city:'台中市'},workspaces:[{tenantId:'demo',tenantName:'測試主辦',status:'active',role:'owner'}],applications:[{tenantId:'demo',status:'approved',useCases:['market']}]};
    case 'getMyRegs': return regs;
    case 'getMyRewards': return {balance:0,rows:[]};
    case 'getMyNotifications': return [];
    case 'getMyCustomerWallets': return [];
    default: return {ok:true,success:true,id:action==='createSession'?'S2':undefined,sent:1,skipped:0,count:1};
  }
}
function requestAction(req){try{if(req.method()==='POST')return String(req.postDataJSON?.()?.action||'');return String(new URL(req.url()).searchParams.get('action')||'')}catch(_){return''}}
async function waitAction(page,action,trigger,method='POST'){const responsePromise=page.waitForResponse(res=>res.request().method()===method&&requestAction(res.request())===action,{timeout:10000});await trigger();const response=await responsePromise;assert.equal(response.ok(),true,`${action} response not ok`);return response}
async function waitEnabled(page,id){await page.waitForFunction(key=>{const el=document.getElementById(key);return !!el&&!el.disabled},id,{timeout:10000})}
async function installMock(page){
  await page.route(`${API}/**`,async route=>{
    const req=route.request();
    if(req.url().includes('/auth/line/start')){reads.push('auth/line/start');return route.fulfill({status:200,contentType:'text/html',body:'<html><body>LINE LOGIN MOCK</body></html>'})}
    let action='';
    if(req.method()==='POST'){
      const body=req.postDataJSON?.()||{};action=body.action||'';writes.push({action,body});
      if(action==='createMemberWorkspaceAdminSession')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{adminToken,tenantId:'demo'}})});
    }else{const u=new URL(req.url());action=u.searchParams.get('action')||'';reads.push(action)}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:payload(action)})});
  });
}
function watchErrors(page){const errors=[];page.on('pageerror',e=>errors.push(String(e)));return()=>assert.deepEqual(errors,[],`browser errors: ${errors.join('\n')}`)}
async function directAdminLoginJourney(browser,viewport){
  const page=await browser.newPage({viewportSize:viewport});await installMock(page);const assertNoErrors=watchErrors(page);
  await page.goto(`${BASE}/market/`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#marketLineLogin');assert.match(await page.locator('.mk-login-card').innerText(),/不需要重新申請/);
  await page.goto(`${BASE}/market/?member_token=member-test-token`,{waitUntil:'domcontentloaded'});await page.waitForURL(/\/market\/\?tenant=demo&admin_token=/,{timeout:10000});await page.waitForSelector('#sessionList .mk-card');assert.equal(await page.locator('a[href="/apply/"]').count(),0);assertNoErrors();await page.close();
}
async function adminJourney(browser,viewport){
  const page=await browser.newPage({viewportSize:viewport});await installMock(page);const assertNoErrors=watchErrors(page);page.on('dialog',d=>d.accept());
  await page.goto(`${BASE}/market/?tenant=demo&admin_token=${encodeURIComponent(adminToken)}`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#sessionList .mk-card');
  assert.equal(await page.locator('.mk-nav button').count(),8);if(viewport.width>=1025){const box=await page.locator('.mk-nav').boundingBox();assert.ok(box&&box.x<40,'desktop nav should be left rail')}
  for(const name of ['todos','onsite','members','events','finance','consignment','settings','sessions']){await page.locator(`.mk-nav button[data-page="${name}"]`).click();assert.equal(await page.locator(`#${name}`).evaluate(e=>e.classList.contains('active')),true)}
  await page.locator('[data-onsite-session="S1"]').click();await page.waitForSelector('#onsiteList .mk-row');
  await page.locator('.mk-nav button[data-page="sessions"]').click();await page.locator('#newSession').click();assert.equal(await page.locator('#newSessionDialog').evaluate(e=>e.open),true);await page.locator('[data-close="newSessionDialog"]').first().click();
  await page.goto(`${BASE}/market/session/?tenant=demo&admin_token=${encodeURIComponent(adminToken)}&sessionId=S1`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#kpis .mk-stat');assert.equal(await page.locator('.mk-session-tabs button').count(),8);
  for(const name of ['registrations','payments','seat','notice','onsite','closeout','settings','overview']){await page.locator(`.mk-session-tabs button[data-tab="${name}"]`).click();assert.equal(await page.locator(`#${name}`).evaluate(e=>e.classList.contains('active')),true)}
  await page.locator('[data-tab="registrations"]').click();await waitAction(page,'updateRegStatus',()=>page.locator('[data-status="已錄取"]').first().click());
  await page.locator('[data-tab="payments"]').click();if(await page.locator('[data-confirm-pay]').count()){await waitAction(page,'confirmPayment',()=>page.locator('[data-confirm-pay]').first().click());await page.waitForTimeout(0)}if(await page.locator('[data-remind]').count())await waitAction(page,'sendPaymentReminder',()=>page.locator('[data-remind]').first().click());
  await waitAction(page,'adminSeatBoard',()=>page.locator('[data-tab="seat"]').click(),'GET');await page.waitForFunction(()=>!!document.querySelector('#assignReg option[value="R4"]')&&!!document.querySelector('#assignStall option[value="A01"]'));await page.locator('#assignReg').selectOption('R4');await page.locator('#assignStall').selectOption('A01');await waitAction(page,'adminAssignSeat',()=>page.locator('#assignSeat').click());await waitEnabled(page,'assignSeat');await waitAction(page,'runBatchAssign',()=>page.locator('#batchSeat').click());await waitEnabled(page,'batchSeat');if(await page.locator('[data-unassign]').count())await waitAction(page,'adminUnassignSeat',()=>page.locator('[data-unassign]').first().click());await page.locator('#addEquip').click();await waitAction(page,'updateSession',()=>page.locator('#saveEquip').click());await waitEnabled(page,'saveEquip');
  await page.locator('[data-tab="notice"]').click();await page.locator('#noticeContent').fill('測試行前通知');await waitAction(page,'sendNotify',()=>page.locator('#sendNotice').click());await waitEnabled(page,'sendNotice');const unpaidPromise=page.waitForResponse(res=>res.request().method()==='POST'&&requestAction(res.request())==='sendPaymentReminder',{timeout:10000});await page.locator('#remindUnpaid').click();assert.equal((await unpaidPromise).ok(),true);await waitEnabled(page,'remindUnpaid');
  await page.locator('[data-tab="onsite"]').click();if(await page.locator('[data-checkin]').count())await waitAction(page,'checkin',()=>page.locator('[data-checkin]').first().click());await page.locator('[data-tab="closeout"]').click();await page.waitForTimeout(50);if(await page.locator('[data-refund]').count())await waitAction(page,'confirmRefund',()=>page.locator('[data-refund]').first().click());await page.locator('[data-tab="settings"]').click();await page.locator('#setName').fill('測試市集更新');await waitAction(page,'updateSession',()=>page.locator('#saveSession').click());await waitEnabled(page,'saveSession');
  assertNoErrors();await page.close();
}
async function publicJourney(browser,viewport){
  const page=await browser.newPage({viewportSize:viewport});await installMock(page);const browserErrors=[];page.on('pageerror',e=>browserErrors.push(String(e)));page.on('console',msg=>{if(msg.type()==='error')browserErrors.push(`console: ${msg.text()}`)});
  await page.goto(`${BASE}/market/public/`,{waitUntil:'domcontentloaded',timeout:15000});await page.waitForTimeout(1500);
  const cardCount=await page.locator('#sessionGrid [data-global-market="S1"]').count();if(!cardCount){const debug=await page.evaluate(()=>({bodyClass:document.body.className,grid:document.getElementById('sessionGrid')?.innerText||'',helper:typeof window.doingMarketGlobalBootstrap,bar:!!document.getElementById('marketViewBar'),ready:document.readyState,url:location.href}));throw new Error(`public global card missing: ${JSON.stringify({debug,reads:[...reads],browserErrors})}`)}
  assert.equal(await page.locator('body.market-2bl-front').count(),1);assert.equal(await page.locator('.bottom-nav button').count(),3);assert.match(await page.locator('.bottom-nav').innerText(),/報名/);assert.match(await page.locator('.bottom-nav').innerText(),/我的紀錄/);assert.match(await page.locator('.bottom-nav').innerText(),/客服/);assert.equal(await page.locator('a[href*="/register/"]').count(),0);assert.ok(reads.includes('publicDiscovery'),'global public front must use formal publicDiscovery');
  await page.locator('#marketCalBtn').click();await page.waitForSelector('#marketCalendar:not(.hidden)');assert.ok(await page.locator('[data-cal-session="S1"]').count());await page.locator('#marketListBtn').click();await page.waitForSelector('#sessionGrid [data-global-market="S1"]');
  const before=new URL(page.url()).pathname;await page.locator('[data-global-register="S1"]').click();await page.waitForURL(/\/market\/public\/\?tenant=demo&session=S1&market_autoreg=1/,{timeout:10000});await page.waitForSelector('#sessionModal.show',{timeout:10000});assert.equal(new URL(page.url()).pathname,before,'registration must stay in the same public page');assert.equal(await page.locator('a[href*="/register/"]').count(),0);await page.locator('#sessionModal [data-close]').first().click();
  await page.evaluate(()=>localStorage.setItem('doing_member_token','member-test-token'));await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.locator('.bottom-nav button[data-page="my"]').click();await page.waitForTimeout(50);assert.equal(await page.locator('#pageMy').evaluate(e=>e.classList.contains('active')),true);await page.locator('.bottom-nav button[data-page="support"]').click();assert.equal(await page.locator('#pageSupport').evaluate(e=>e.classList.contains('active')),true);
  assert.deepEqual(browserErrors,[],`browser errors: ${browserErrors.join('\n')}`);await page.close();
}
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){await directAdminLoginJourney(browser,viewport);await adminJourney(browser,viewport);await publicJourney(browser,viewport)}
  const required=['createMemberWorkspaceAdminSession','updateRegStatus','confirmPayment','sendPaymentReminder','adminAssignSeat','runBatchAssign','adminUnassignSeat','updateSession','sendNotify','checkin','confirmRefund'];const seen=new Set(writes.map(x=>x.action));for(const action of required)assert(seen.has(action),`missing write contract: ${action}`);
  for(const w of writes.filter(x=>['updateRegStatus','confirmPayment','adminAssignSeat','runBatchAssign','adminUnassignSeat','updateSession','sendNotify','sendPaymentReminder','checkin','confirmRefund'].includes(x.action))){assert.equal(w.body.tenant,'demo',`${w.action} tenant missing`);assert.equal(w.body.token,adminToken,`${w.action} admin token missing`);assert.equal(w.body.email,'admin@example.com',`${w.action} email missing`)}
  console.log(JSON.stringify({result:'PASS',desktop:true,mobile:true,marketEntries:2,adminNavigation:8,sessionTabs:8,publicNavigation:3,publicGlobalNoTenant:true,publicSinglePage:true,registrationInline:true,directLineAdminLogin:true,reapplyPrompt:false,writeContracts:[...seen].sort(),databaseWrites:0,workerChanges:0,twoBlChanges:0},null,2));
}finally{await browser.close()}
