import { chromium } from 'playwright';

const base=process.env.E2E_BASE||'http://127.0.0.1:4173';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const browser=await chromium.launch({headless:true});
const sessions=[
  {id:'s1',name:'八月夏日市集',dates:[{date:'2026-08-30',label:'2026-08-30'}],venue:'台中測試場',status:'開放中',registrationCount:12,pendingCount:3,paidCount:6,paymentPendingCount:2,unpaidCount:1,checkedInCount:4,refundCount:1},
  {id:'s2',name:'九月公益市集',dates:[{date:'2026-09-19',label:'2026-09-19'}],venue:'高雄測試場',status:'開放中',registrationCount:8,pendingCount:1,paidCount:4,paymentPendingCount:1,unpaidCount:2,checkedInCount:0,refundCount:0}
];
const regs=[
  {id:'r1',brand:'貓咪手作',name:'小安',phone:'0911000001',email:'a@example.com',reviewStatus:'待審核',paymentStatus:'未繳費',checkinStatus:'未報到'},
  {id:'r2',brand:'午後甜點',name:'小美',phone:'0911000002',email:'b@example.com',reviewStatus:'已錄取',paymentStatus:'待確認付款',checkinStatus:'未報到'},
  {id:'r3',brand:'花花生活',name:'小花',phone:'0911000003',email:'c@example.com',reviewStatus:'已錄取',paymentStatus:'已繳費',checkinStatus:'已報到'},
  {id:'r4',brand:'木作日常',name:'小木',phone:'0911000004',email:'d@example.com',reviewStatus:'已錄取',paymentStatus:'已繳費',checkinStatus:'未報到',refundStatus:'退款申請'}
];
const todos=[
  {title:'審核 貓咪手作',sessionName:'八月夏日市集',sessionId:'s1',kind:'review'},
  {title:'確認付款 午後甜點',sessionName:'八月夏日市集',sessionId:'s1',kind:'payment'}
];
const members=[{brand:'貓咪手作',name:'小安',phone:'0911000001',email:'a@example.com'},{brand:'午後甜點',name:'小美',phone:'0911000002',email:'b@example.com'}];
const discovery={items:[
  {id:'s1',sessionId:'s1',tenantId:'demo',sessionName:'八月夏日市集',tenantName:'測試主辦',dates:[{date:'2026-08-30',label:'8/30'}],venue:'台中測試場',description:'好逛好玩的市集',type:'market'},
  {id:'s2',sessionId:'s2',tenantId:'demo',sessionName:'九月公益市集',tenantName:'測試主辦',dates:[{date:'2026-09-19',label:'9/19'}],venue:'高雄測試場',description:'公益活動',type:'event'}
]};

function actionFrom(req){const u=new URL(req.url());if(req.method()==='POST'){try{return JSON.parse(req.postData()||'{}').action||u.searchParams.get('action')||''}catch{return u.searchParams.get('action')||''}}return u.searchParams.get('action')||''}
function payloadFrom(req){if(req.method()!=='POST')return Object.fromEntries(new URL(req.url()).searchParams.entries());try{return JSON.parse(req.postData()||'{}')}catch{return{}}}
async function fulfillApi(route,postLog=[]){const req=route.request(),action=actionFrom(req),payload=payloadFrom(req);if(req.method()==='POST')postLog.push({action,payload});let data={};
  if(action==='getSessionsAdmin')data=sessions;
  else if(action==='getSiteConfig')data={brandName:'測試主辦',infoText:'測試公開介紹'};
  else if(action==='getTodos')data=todos;
  else if(action==='getMembers')data=members;
  else if(action==='getSessionRegistrations')data=regs;
  else if(action==='getSessionDashboard')data={session:{...sessions[0],fee:800,deposit:500,limit:30,needReview:true,description:'單場說明',equip:{桌子:{price:100},電力:{price:200}}}};
  else if(action==='adminSeatBoard')data={stalls:[{id:'A1',name:'A1'},{id:'A2',name:'A2'}],assignments:[{stallId:'A1',registrationId:'r3',brand:'花花生活'}]};
  else if(action==='getAnnouncements')data=[{id:'a1',title:'行前提醒',content:'記得準時報到',createdAt:'2026-08-25T00:00:00Z'}];
  else if(action==='getOperationalCloseout')data={totalIncome:10000,totalExpense:3000,totalRefund:500,distributable:6500,status:'進行中'};
  else if(action==='getRefundSuggestion')data={refundAmount:500};
  else if(action==='publicDiscovery')data=discovery;
  else if(action==='getPlatformMemberProfile')data={profile:{name:'測試會員',phone:'0911000001',email:'m@example.com',city:'台中'},workspaces:[]};
  else if(action==='getMyRegsGlobal')data={rows:[{sessionName:'八月夏日市集',date:'2026-08-30',status:'已報名'}]};
  else if(['approveReg','confirmPayment','sendPaymentReminder','checkin','adminAssignSeat','saveAnnouncement','confirmRefund','updateSession','createSession','saveSiteConfig','savePlatformMemberProfile','uploadCover'].includes(action))data=action==='createSession'?{id:'s-new'}:action==='uploadCover'?{url:'https://example.com/logo.png'}:{ok:true};
  else return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false,error:`unmocked ${action}`})});
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})});
}

try{
  for(const viewport of [{width:390,height:844,name:'mobile'},{width:1440,height:1000,name:'desktop'}]){
    const postLog=[];
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
    await page.route(`${API}/**`,r=>fulfillApi(r,postLog));
    await page.goto(`${base}/market/?tenant=demo&admin_token=test-admin`,{waitUntil:'networkidle'});
    await page.locator('text=今天要處理的市集工作，都在這裡').waitFor();
    if(await page.locator('.mk-nav-btn').count()!==8)throw new Error(`${viewport.name}: organizer nav must have 8 items`);
    await page.waitForFunction(()=>document.querySelectorAll('.mk-session-card').length===2);
    if(await page.locator('.mk-session-card').count()!==2)throw new Error(`${viewport.name}: expected 2 session cards`);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1))throw new Error(`${viewport.name}: organizer horizontal overflow`);
    await page.locator('[data-page="todos"]').click();await page.locator('text=審核 貓咪手作').waitFor();
    await page.locator('[data-page="members"]').click();await page.locator('text=貓咪手作').waitFor();
    await page.locator('[data-page="onsite"]').click();await page.selectOption('#onsiteSession','s1');await page.locator('#onsiteResults').locator('text=貓咪手作').waitFor();
    await page.locator('#newSession').click();await page.locator('#sessionDialog').waitFor({state:'visible'});await page.locator('[data-close="sessionDialog"]').first().click();
    await page.close();

    const publicPage=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});await publicPage.route(`${API}/**`,r=>fulfillApi(r,[]));
    await publicPage.goto(`${base}/market/public/?tenant=demo`,{waitUntil:'networkidle'});await publicPage.locator('text=八月夏日市集').waitFor();
    if(await publicPage.locator('.mk-event-card').count()!==2)throw new Error(`${viewport.name}: expected 2 public event cards`);
    await publicPage.locator('.mk-event-card').first().click();await publicPage.locator('#eventDialog').waitFor({state:'visible'});
    const regHref=await publicPage.locator('#eventPanel a[href*="/register/"]').getAttribute('href');if(!regHref||!regHref.includes('tenant=demo')||!regHref.includes('session=s1'))throw new Error(`${viewport.name}: registration URL contract broken`);
    if(await publicPage.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1))throw new Error(`${viewport.name}: public horizontal overflow`);
    await publicPage.close();

    const sessionPosts=[];const sessionPage=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});await sessionPage.route(`${API}/**`,r=>fulfillApi(r,sessionPosts));
    await sessionPage.goto(`${base}/market/session/?tenant=demo&admin_token=test-admin&sessionId=s1`,{waitUntil:'networkidle'});await sessionPage.locator('text=八月夏日市集').first().waitFor();
    if(await sessionPage.locator('.mk-tab').count()!==8)throw new Error(`${viewport.name}: session must have 8 tabs`);
    await sessionPage.locator('[data-tab="registrations"]').click();await sessionPage.locator('[data-action="approve"]').waitFor();
    await sessionPage.locator('[data-tab="payments"]').click();await sessionPage.locator('[data-action="confirmPayment"]').waitFor();
    await sessionPage.locator('[data-tab="seat"]').click();await sessionPage.locator('[data-stall="A2"]').waitFor();await sessionPage.locator('[data-stall="A2"]').click();await sessionPage.locator('#assignDialog').waitFor({state:'visible'});await sessionPage.locator('[data-close="assignDialog"]').click();
    await sessionPage.locator('[data-tab="notice"]').click();await sessionPage.locator('text=行前提醒').waitFor();
    await sessionPage.locator('[data-tab="onsite"]').click();await sessionPage.locator('[data-action="checkin"]').waitFor();
    await sessionPage.locator('[data-tab="closeout"]').click();await sessionPage.locator('text=NT$ 10,000').waitFor();
    await sessionPage.locator('[data-tab="settings"]').click();if(await sessionPage.locator('#setName').inputValue()!=='八月夏日市集')throw new Error(`${viewport.name}: session settings not hydrated`);
    if(await sessionPage.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1))throw new Error(`${viewport.name}: session horizontal overflow`);
    await sessionPage.close();
  }

  const gate=await browser.newPage({viewport:{width:390,height:844}});await gate.goto(`${base}/market/`,{waitUntil:'domcontentloaded'});await gate.locator('text=請從「我的 DOING」進入').waitFor();await gate.close();

  const transient=await browser.newPage({viewport:{width:390,height:844}});await transient.addInitScript(()=>localStorage.setItem('doing_member_token','existing-member-token'));let oauthStarts=0;transient.on('request',r=>{if(r.url().includes('/auth/line/start'))oauthStarts++});await transient.route(`${API}/**`,async route=>{const action=actionFrom(route.request());if(action==='getPlatformMemberProfile')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'暫時無法讀取'})});return fulfillApi(route,[])});await transient.goto(`${base}/market/public/?tenant=demo`,{waitUntil:'networkidle'});await transient.locator('#memberBtn').click();await transient.waitForFunction(()=>document.getElementById('memberLoginMessage')?.textContent?.includes('登入仍保留'));const kept=await transient.evaluate(()=>localStorage.getItem('doing_member_token'));if(kept!=='existing-member-token')throw new Error('public member transient failure cleared valid token');if(oauthStarts!==0)throw new Error('public member transient failure restarted LINE OAuth');await transient.close();

  console.log(JSON.stringify({result:'PASS',viewports:['390x844','1440x1000'],organizerSections:8,sessionTabs:8,publicDiscovery:true,registrationDeepLink:true,memberTransientTokenPreserved:true,missingAdminSafeGate:true,seatBoardRendered:true,financeRendered:true,destructiveWrites:'mock-only',productionWrites:0},null,2));
} finally {await browser.close();}
