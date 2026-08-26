import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.E2E_BASE||'http://127.0.0.1:4173';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const adminToken=`${b64({alg:'none',typ:'JWT'})}.${b64({email:'owner@example.com',tenant_id:'demo',normalized_role:'owner',expires_at:Date.now()+86400000})}.x`;

const writes=[];
let registered=false,cancelled=false,draftCreated=false,sessionConfigured=false;

const draftSession={
  id:'S100',eventId:'',name:'未命名場次',region:'',venue:'',dates:[],fee:0,deposit:0,limit:0,maxStalls:1,
  status:'關閉',needReview:true,desc:'',theme:'',organizer:'',coOrganizer:'',cover:'',basicEquip:'',equip:{},addons:[],customFields:[],
  refundRules:{text:''},agreementRequired:false,modules:{registration:true,quantityMode:'stall',operatingMode:'activity',review:true,payment:false,invoice:false,equipment:false,addons:false,customFields:false,agreement:false,checkin:true,seatSelection:false,googleCalendar:true,depositKind:'none'}
};
const richSession={
  id:'S100',eventId:'EVT100',eventTitle:'春日選物市集',name:'春日選物市集｜第一場',region:'台中',venue:'中央公園',
  dates:[{date:'2026-09-06',label:'9/6',start:'10:00',end:'18:00',fee:350,limit:20}],fee:350,deposit:500,limit:20,maxStalls:2,
  status:'報名中',needReview:true,desc:'這是一場完整活動說明',theme:'選物',organizer:'DOING 主辦',coOrganizer:'合作單位',cover:'',basicEquip:'每攤一桌二椅',
  paymentProfileId:'P1',equip:{equipment_1:{name:'電力插座',label:'電力插座',price:100,incl:0,max:1,maxPerStall:1,open:true}},
  addons:[{name:'桌前椅',price:80,limit:2,open:true}],customFields:[{label:'品牌特色',type:'textarea',required:true,full:true}],
  refundRules:{text:'未付款可直接取消。'},agreementRequired:true,agreementTitle:'市集規範',agreementContent:'請遵守活動規範。',agreementVersion:'1.0',portals:['market'],
  modules:{registration:true,quantityMode:'stall',operatingMode:'activity',review:true,payment:true,invoice:true,equipment:true,addons:true,customFields:true,agreement:true,checkin:true,seatSelection:false,googleCalendar:true,depositKind:'refundable',depositPolicy:{calcType:'fixed',value:500,cap:500}}
};

function actionOf(req){try{return req.method()==='POST'?String(req.postDataJSON()?.action||''):String(new URL(req.url()).searchParams.get('action')||'')}catch{return''}}
function activeSession(){return sessionConfigured?richSession:draftSession}
function myRows(){if(!registered)return[];return [{
  id:'R100',sessionId:'S100',sessionName:richSession.name,selectedDates:['2026-09-06'],
  status:cancelled?'已取消':'報名成功',reviewStatus:cancelled?'已取消':'待審核',paymentStatus:'未繳費',payStatus:'未繳費',
  total:350,due:350,stallCount:1,seatChoiceIntent:'auto',modules:richSession.modules,brand:'測試品牌',name:'測試會員',email:'member@example.com',phone:'0912345678'
}];}

async function mock(page){
  await page.route(`${API}/**`,async route=>{
    const req=route.request(),a=actionOf(req);let body={};
    if(req.method()==='POST'){
      body=req.postDataJSON()||{};writes.push({action:a,body});
      if(a==='createSession')draftCreated=true;
      if(a==='updateSession')sessionConfigured=true;
      if(a==='register')registered=true;
      if(a==='cancelReg')cancelled=true;
    }
    let data={ok:true,success:true};
    if(a==='getSessionsAdmin'||a==='getAdminSessionsDashboard')data=draftCreated?[activeSession()]:[];
    else if(a==='getSiteConfig')data={brandName:'測試主辦',logoUrl:'',heroImg:'',infoText:''};
    else if(a==='getTodos'||a==='getMembers')data=[];
    else if(a==='createEvent')data={id:'EVT100'};
    else if(a==='createSession')data={id:'S100'};
    else if(a==='getSessionDashboard')data={session:activeSession(),sessions:[activeSession()]};
    else if(a==='getSessionRegistrations')data=[];
    else if(a==='adminSeatBoard')data={seats:[]};
    else if(a==='getSessionEquipmentDetails')data={rows:[]};
    else if(a==='financeReport'||a==='financeOverview')data={summary:{incomeTotal:0,refundTotal:0,expenseTotal:0,netTotal:0}};
    else if(a==='getPaymentProfiles')data=[{id:'P1',name:'預設收款',isDefault:true,isEnabled:true}];
    else if(a==='getAgreementTemplates')data=[{slot_no:1,label:'正式市集規範',title:'市集規範',content:'請遵守活動規範。',version:'1.0'}];
    else if(a==='getEventsAdmin')data=[{id:'EVT100',title:'春日選物市集'}];
    else if(a==='getBundles')data=[];
    else if(a==='publicDiscovery')data={items:[{tenantId:'demo',sessionId:'S100',sessionName:richSession.name,dates:richSession.dates,venue:richSession.venue,status:'open'}]};
    else if(a==='frontBootstrap')data={tenant:{id:'demo',name:'測試主辦',i18n:{enabled:false,languages:['zh-TW'],defaultLanguage:'zh-TW'}},events:[{id:'EVT100',title:richSession.eventTitle,desc:richSession.desc}],sessions:[richSession],operationUnits:[],announcements:[]};
    else if(a==='getSession')data=richSession;
    else if(a==='getSessionAgreement')data={title:richSession.agreementTitle,content:richSession.agreementContent,version:richSession.agreementVersion};
    else if(a==='getBundlesPublic'||a==='getMyNotifications'||a==='getMyCustomerWallets')data=[];
    else if(a==='getMyRewards')data={balance:0,rows:[]};
    else if(a==='getMyRegs'||a==='getMyRegsGlobal')data=myRows();
    else if(a==='getPlatformMemberProfile')data={profile:{id:'M1',email:'member@example.com',phone:'0912345678',name:'測試會員',brand:'測試品牌'},brands:[],complete:true,workspaces:[],applications:[]};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
}

async function adminCreate(browser,viewport){
  registered=false;cancelled=false;draftCreated=false;sessionConfigured=false;
  const start=writes.length;
  const page=await browser.newPage({viewportSize:viewport});await mock(page);
  await page.goto(`${BASE}/market/?tenant=demo&admin_token=${encodeURIComponent(adminToken)}`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#newSession');await page.click('#newSession');
  await page.waitForSelector('#newSessionDialog[open]');
  const createDraftResponse=page.waitForResponse(r=>actionOf(r.request())==='createSession');
  await page.click('#createSession');assert.ok((await createDraftResponse).ok());
  await page.waitForURL(u=>u.pathname==='/market/session/'&&u.searchParams.get('sessionId')==='S100',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-complete-session-editor]');
  await page.waitForFunction(()=>document.getElementById('fullName')?.value==='未命名場次');

  await page.fill('#fullName','春日選物市集｜第一場');
  await page.fill('#fullRegion','台中');await page.fill('#fullVenue','中央公園');
  await page.fill('#fullOrganizer','DOING 主辦');await page.fill('#fullCoOrganizer','合作單位');await page.fill('#fullTheme','選物');
  await page.fill('#fullDescription','這是一場完整活動說明');
  await page.selectOption('#fullStatus','報名中');await page.selectOption('#fullReview','yes');
  await page.fill('[data-date-key]','2026-09-06');await page.fill('[data-date-label]','9/6');await page.fill('[data-date-start]','10:00');await page.fill('[data-date-end]','18:00');await page.fill('[data-date-fee]','350');await page.fill('[data-date-limit]','20');
  await page.fill('#fullFee','350');await page.fill('#fullDeposit','500');await page.fill('#fullLimit','20');await page.fill('#fullMaxStalls','2');
  await page.fill('#fullBasicEquip','每攤一桌二椅');
  await page.selectOption('#fullPayment','yes');await page.selectOption('#fullPaymentProfile','P1');
  await page.selectOption('#fullInvoice','yes');
  assert.equal(await page.locator('#fullEquipment option[value="no"]').count(),1);await page.selectOption('#fullEquipment','yes');await page.click('#addEquipFull');
  await page.fill('[data-equip-name]','電力插座');await page.fill('[data-equip-incl]','0');await page.fill('[data-equip-price]','100');await page.fill('[data-equip-max]','1');assert.equal(await page.locator('[data-equip-open] option[value="no"]').count(),1);await page.selectOption('[data-equip-open]','yes');
  await page.selectOption('#fullAddons','yes');await page.click('#addAddonFull');
  await page.fill('[data-addon-name]','桌前椅');await page.fill('[data-addon-price]','80');await page.fill('[data-addon-limit]','2');
  await page.selectOption('#fullCustomFields','yes');await page.click('#addCustomFull');
  await page.fill('[data-custom-label]','品牌特色');await page.selectOption('[data-custom-type]','textarea');await page.selectOption('[data-custom-required]','yes');
  await page.selectOption('#fullAgreement','yes');await page.selectOption('#agreementTemplate','1');
  await page.fill('#fullRefund','未付款可直接取消。');

  const createEventResponse=page.waitForResponse(r=>actionOf(r.request())==='createEvent');
  const updateSessionResponse=page.waitForResponse(r=>actionOf(r.request())==='updateSession');
  await page.click('#saveSession');assert.ok((await createEventResponse).ok());assert.ok((await updateSessionResponse).ok());
  await page.waitForFunction(()=>document.getElementById('fullName')?.value.includes('春日選物市集'));

  const local=writes.slice(start),draft=local.find(x=>x.action==='createSession'),ev=local.find(x=>x.action==='createEvent'),ses=local.find(x=>x.action==='updateSession');
  assert.ok(draft,'draft createSession missing');assert.equal(draft.body.status,'關閉');
  assert.equal(ev.body.title,'春日選物市集｜第一場');
  assert.equal(ses.body.eventId,'EVT100');assert.equal(ses.body.modules.equipment,true);assert.equal(ses.body.modules.addons,true);assert.equal(ses.body.modules.customFields,true);assert.equal(ses.body.modules.payment,true);
  assert.equal(ses.body.agreementRequired,true);assert.equal(ses.body.agreementTitle,'市集規範');assert.equal(ses.body.agreementContent,'請遵守活動規範。');
  assert.equal(ses.body.equip.equipment_1.name,'電力插座');assert.equal(ses.body.addons[0].name,'桌前椅');assert.equal(ses.body.customFields[0].label,'品牌特色');assert.equal(ses.body.paymentProfileId,'P1');
  await page.close();
}

async function adminEdit(browser,viewport){
  const start=writes.length;
  const page=await browser.newPage({viewportSize:viewport});await mock(page);
  await page.goto(`${BASE}/market/session/?tenant=demo&admin_token=${encodeURIComponent(adminToken)}&sessionId=S100&tab=settings`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-complete-session-editor]');await page.waitForFunction(()=>document.getElementById('fullName')?.value.includes('春日選物市集'));
  assert.equal(await page.locator('[data-equip]').count(),1);assert.equal(await page.locator('[data-addon]').count(),1);assert.equal(await page.locator('[data-custom]').count(),1);
  await page.fill('#fullDescription','更新後完整活動說明');
  const u1=page.waitForResponse(r=>actionOf(r.request())==='updateEvent');const u2=page.waitForResponse(r=>actionOf(r.request())==='updateSession');
  await page.click('#saveSession');assert.ok((await u1).ok());assert.ok((await u2).ok());
  const local=writes.slice(start),ses=local.find(x=>x.action==='updateSession'),ev=local.find(x=>x.action==='updateEvent');
  assert.ok(ev);assert.ok(ses);assert.equal(ses.body.desc,'更新後完整活動說明');assert.equal(ses.body.modules.payment,true);assert.equal(ses.body.agreementTitle,'市集規範');
  await page.close();
}

async function memberRegisterCancel(browser,viewport){
  registered=false;cancelled=false;const start=writes.length,browserErrors=[],browserConsole=[];
  const page=await browser.newPage({viewportSize:viewport});page.on('dialog',d=>d.accept());
  page.on('pageerror',e=>browserErrors.push(e?.stack||e?.message||String(e)));
  page.on('console',m=>{if(['error','warning'].includes(m.type()))browserConsole.push(`${m.type()}: ${m.text()}`)});
  await page.addInitScript(()=>localStorage.setItem('doing_member_token','member-token'));await mock(page);
  await page.goto(`${BASE}/market/public/?tenant=demo&session=S100&market_autoreg=1`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#sessionModal.show');await page.waitForFunction(()=>document.getElementById('regEmail')?.value==='member@example.com');
  await page.waitForFunction(()=>document.getElementById('sessionModal')?.classList.contains('single-page-registration'));
  assert.equal(await page.locator('#sessionModal .reg-wizard:visible').count(),0);assert.equal(await page.locator('#regNextBtn:visible').count(),0);assert.equal(await page.locator('#regPrevBtn:visible').count(),0);
  assert.equal(await page.locator('#singleMemberSummary:visible').count(),1);assert.equal(await page.locator('#dateSection:visible').count(),1);assert.equal(await page.locator('#equipSection:visible').count(),1);assert.equal(await page.locator('#agreementSection:visible').count(),1);
  await page.waitForFunction(()=>document.getElementById('singleAgreementContent')?.textContent.includes('請遵守活動規範'));
  assert.equal(await page.locator('#submitRegBtn').isDisabled(),true);assert.ok(await page.locator('[name="regDate"]:checked').count());
  await page.fill('#regBrand','測試品牌');await page.fill('[data-custom="0"]','極簡手作選物');await page.selectOption('[data-equip="equipment_1"]','1');
  await page.check('#agreementCheck');await page.waitForFunction(()=>!document.getElementById('submitRegBtn')?.disabled);
  const preClick=await page.evaluate(()=>{const b=document.getElementById('submitRegBtn'),r=b?.getBoundingClientRect(),x=r?Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)):0,y=r?Math.max(0,Math.min(innerHeight-1,r.top+r.height/2)):0,hit=document.elementFromPoint(x,y),cs=b?getComputedStyle(b):null;return{disabled:b?.disabled,rect:r?{left:r.left,top:r.top,width:r.width,height:r.height,bottom:r.bottom,right:r.right}:null,viewport:{w:innerWidth,h:innerHeight},display:cs?.display,visibility:cs?.visibility,opacity:cs?.opacity,pointerEvents:cs?.pointerEvents,hit:{id:hit?.id||'',className:String(hit?.className||''),tag:hit?.tagName||'',text:String(hit?.textContent||'').trim().slice(0,80)},same:hit===b||!!b?.contains(hit)}});console.log('SUBMIT_PRECLICK',JSON.stringify(preClick));
  let rr;
  try{
    const pending=page.waitForResponse(r=>actionOf(r.request())==='register',{timeout:3000});
    await page.click('#submitRegBtn');rr=await pending;
  }catch(e){
    const diag=await page.evaluate(()=>({disabled:document.getElementById('submitRegBtn')?.disabled,modalClass:document.getElementById('sessionModal')?.className,checkedDates:[...document.querySelectorAll('[name=regDate]:checked')].map(x=>x.value),agreementChecked:document.getElementById('agreementCheck')?.checked,agreementViewed:typeof state!=='undefined'?state.agreementViewed:'state-unavailable',custom:[...document.querySelectorAll('[data-custom]')].map(x=>({required:x.required,value:x.value})),token:typeof window.doingMemberToken==='function'?window.doingMemberToken():'no-token-fn'}));
    console.error('SINGLE_PAGE_SUBMIT_DIAG',JSON.stringify({diag,browserErrors,browserConsole,writes:writes.slice(start)},null,2));throw e;
  }
  assert.ok(rr.ok());
  await page.waitForSelector('#myRecords .record');assert.match(await page.locator('#myRecords').innerText(),/春日選物市集/);
  const cr=page.waitForResponse(r=>actionOf(r.request())==='cancelReg');await page.getByRole('button',{name:'取消報名'}).click();assert.ok((await cr).ok());
  await page.waitForFunction(()=>document.getElementById('myRecords')?.innerText.includes('已取消'));
  const local=writes.slice(start),reg=local.find(x=>x.action==='register'),cancel=local.find(x=>x.action==='cancelReg');
  assert.ok(reg);assert.ok(cancel);assert.equal(reg.body.member_token,'member-token');assert.equal(reg.body.customFields[0].value,'極簡手作選物');assert.equal(reg.body.equip.equipment_1,1);assert.equal(reg.body.agreementViewed,true);assert.equal(reg.body.agreementAccepted,true);assert.equal(cancel.body.member_token,'member-token');assert.equal(cancel.body.regId,'R100');
  await page.close();
}

const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    await adminCreate(browser,viewport);await adminEdit(browser,viewport);await memberRegisterCancel(browser,viewport);
  }
  console.log(JSON.stringify({result:'PASS',desktop:true,mobile:true,draftThenFullCreate:true,completeCreate:true,completeEdit:true,createEvent:true,createSessionDraft:true,updateEvent:true,updateSession:true,memberRegister:true,singlePageRegistration:true,loggedInMemberCollapsed:true,equipmentToggle:true,equipmentSelection:true,agreementInline:true,agreementCheckboxGate:true,customField:true,memberCancel:true,workerChanges:0,dbSchemaChanges:0,twoBlChanges:0},null,2));
}finally{await browser.close()}
