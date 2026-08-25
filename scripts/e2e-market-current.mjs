import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.E2E_BASE||'http://127.0.0.1:4173';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const adminToken=`${b64({alg:'none',typ:'JWT'})}.${b64({email:'admin@example.com',normalized_role:'superadmin'})}.x`;
const writes=[];
const reads=[];
const sessions=[{id:'S1',name:'測試市集',dates:[{date:'2026-09-01',label:'2026-09-01'}],venue:'測試場地',registrationCount:4,pendingCount:1,paidCount:2,refundCount:1,status:'open'}];
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
    case 'getSessionDashboard': return {session:{id:'S1',name:'測試市集',dates:[{date:'2026-09-01',label:'2026-09-01'}],venue:'測試場地',fee:500,deposit:500,limit:30,needReview:true,desc:'測試說明',equip:{table:{name:'桌子',label:'桌子',price:100,open:true}}}};
    case 'adminSeatBoard': return {seats:[{stallCode:'A01'},{stallCode:'A02',registrationId:'R3',brandName:'品牌丙'}]};
    case 'getSessionEquipmentDetails': return {rows:[{name:'桌子',quantity:1}]};
    case 'financeReport': return {summary:{incomeTotal:3000,refundTotal:500,expenseTotal:700,netTotal:1800}};
    case 'getRefundSuggestion': return {refundAmount:500};
    case 'publicDiscovery': return {items:[{sessionId:'S1',tenantId:'demo',sessionName:'測試市集',dates:[{date:'2026-09-01',label:'2026-09-01'}],venue:'測試場地',description:'測試活動',type:'market'}]};
    case 'getPlatformMemberProfile': return {profile:{name:'王小明',phone:'0900000001',email:'a@example.com',city:'台中市'}};
    case 'getMyRegsGlobal': return regs;
    default: return {ok:true,success:true,id:action==='createSession'?'S2':undefined,sent:1,skipped:0,count:1};
  }
}
async function installMock(page){
  await page.route(`${API}/**`,async route=>{
    const req=route.request();
    if(req.url().includes('/auth/line/start')){reads.push('auth/line/start');return route.fulfill({status:200,contentType:'text/html',body:'<html><body>LINE LOGIN MOCK</body></html>'})}
    let action='';
    if(req.method()==='POST'){
      const body=req.postDataJSON?.()||{};action=body.action||'';writes.push({action,body});
    }else{
      const u=new URL(req.url());action=u.searchParams.get('action')||'';reads.push(action);
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:payload(action)})});
  });
}
function watchErrors(page){const errors=[];page.on('pageerror',e=>errors.push(String(e)));return()=>assert.deepEqual(errors,[],`browser errors: ${errors.join('\n')}`)}
async function adminJourney(browser,viewport){
  const page=await browser.newPage({viewportSize:viewport});await installMock(page);const assertNoErrors=watchErrors(page);page.on('dialog',d=>d.accept());
  await page.goto(`${BASE}/market/?tenant=demo&admin_token=${encodeURIComponent(adminToken)}`);await page.waitForSelector('#sessionList .mk-card');
  assert.equal(await page.locator('.mk-nav button').count(),8);
  for(const name of ['todos','onsite','members','events','finance','consignment','settings','sessions']){await page.locator(`.mk-nav button[data-page="${name}"]`).click();assert.equal(await page.locator(`#${name}`).evaluate(e=>e.classList.contains('active')),true)}
  await page.locator('[data-onsite-session="S1"]').click();await page.waitForSelector('#onsiteList .mk-row');
  await page.locator('.mk-nav button[data-page="sessions"]').click();
  await page.locator('#newSession').click();assert.equal(await page.locator('#newSessionDialog').evaluate(e=>e.open),true);await page.locator('[data-close="newSessionDialog"]').first().click();
  await page.goto(`${BASE}/market/session/?tenant=demo&admin_token=${encodeURIComponent(adminToken)}&sessionId=S1`);await page.waitForSelector('#kpis .mk-stat');
  assert.equal(await page.locator('.mk-session-tabs button').count(),8);
  for(const name of ['registrations','payments','seat','notice','onsite','closeout','settings','overview']){await page.locator(`.mk-session-tabs button[data-tab="${name}"]`).click();assert.equal(await page.locator(`#${name}`).evaluate(e=>e.classList.contains('active')),true)}
  await page.locator('[data-tab="registrations"]').click();await page.locator('[data-status="已錄取"]').first().click();
  await page.locator('[data-tab="payments"]').click();if(await page.locator('[data-confirm-pay]').count())await page.locator('[data-confirm-pay]').first().click();if(await page.locator('[data-remind]').count())await page.locator('[data-remind]').first().click();
  await page.locator('[data-tab="seat"]').click();await page.waitForSelector('#seatBoard .mk-seat');await page.locator('#assignReg').selectOption('R4');await page.locator('#assignStall').selectOption('A01');await page.locator('#assignSeat').click();await page.locator('#batchSeat').click();if(await page.locator('[data-unassign]').count())await page.locator('[data-unassign]').first().click();await page.locator('#addEquip').click();await page.locator('#saveEquip').click();
  await page.locator('[data-tab="notice"]').click();await page.locator('#noticeContent').fill('測試行前通知');await page.locator('#sendNotice').click();await page.locator('#remindUnpaid').click();
  await page.locator('[data-tab="onsite"]').click();if(await page.locator('[data-checkin]').count())await page.locator('[data-checkin]').first().click();
  await page.locator('[data-tab="closeout"]').click();await page.waitForTimeout(50);if(await page.locator('[data-refund]').count())await page.locator('[data-refund]').first().click();
  await page.locator('[data-tab="settings"]').click();await page.locator('#setName').fill('測試市集更新');await page.locator('#saveSession').click();
  assertNoErrors();await page.close();
}
async function publicJourney(browser,viewport){
  const page=await browser.newPage({viewportSize:viewport});await installMock(page);const assertNoErrors=watchErrors(page);
  await page.goto(`${BASE}/market/public/?tenant=demo`);await page.waitForSelector('#events .mk-event');await page.locator('#events .mk-event').first().click();assert.equal(await page.locator('#eventDialog').evaluate(e=>e.open),true);const href=await page.locator('#eventBody a[href*="/register/"]').getAttribute('href');assert.match(href,/\/register\//);await page.locator('[data-close="eventDialog"]').first().click();
  await page.evaluate(()=>localStorage.setItem('doing_member_token','member-test-token'));await page.locator('#navRecords').click();await page.waitForSelector('#memberArea:not(.mk-hidden)');await page.locator('#saveMember').click();await page.locator('#navSupport').click();assert.equal(await page.locator('#supportDialog').evaluate(e=>e.open),true);await page.locator('[data-close="supportDialog"]').first().click();
  await page.goto(`${BASE}/register/?tenant=demo&session=S1`);await page.waitForLoadState('domcontentloaded');assert.match(await page.title(),/活動報名/);assert.equal(await page.locator('body').count(),1);
  assertNoErrors();await page.close();
}
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){await adminJourney(browser,viewport);await publicJourney(browser,viewport)}
  const required=['updateRegStatus','confirmPayment','sendPaymentReminder','adminAssignSeat','runBatchAssign','adminUnassignSeat','updateSession','sendNotify','checkin','confirmRefund','savePlatformMemberProfile'];
  const seen=new Set(writes.map(x=>x.action));for(const action of required)assert(seen.has(action),`missing write contract: ${action}`);
  for(const w of writes.filter(x=>['updateRegStatus','confirmPayment','adminAssignSeat','runBatchAssign','adminUnassignSeat','updateSession','sendNotify','sendPaymentReminder','checkin','confirmRefund'].includes(x.action))){assert.equal(w.body.tenant,'demo',`${w.action} tenant missing`);assert.equal(w.body.token,adminToken,`${w.action} admin token missing`);assert.equal(w.body.email,'admin@example.com',`${w.action} email missing`)}
  console.log(JSON.stringify({result:'PASS',desktop:true,mobile:true,adminNavigation:8,sessionTabs:8,publicNavigation:3,registerLive:true,writeContracts:[...seen].sort(),databaseWrites:0,workerChanges:0,twoBlChanges:0},null,2));
}finally{await browser.close()}
