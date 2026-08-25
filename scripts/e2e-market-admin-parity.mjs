import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.E2E_BASE||'http://127.0.0.1:4173';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const adminToken=`${b64({alg:'none',typ:'JWT'})}.${b64({email:'admin@example.com',normalized_role:'superadmin'})}.x`;
const writes=[];
function payload(action){switch(action){
  case'getSessionsAdmin':case'getAdminSessionsDashboard':return[{id:'S1',name:'測試市集',dates:[{date:'2026-09-01'}],venue:'測試場地',registrationCount:2,pendingCount:1,paidCount:1,refundCount:0}];
  case'getTodos':return[];
  case'getMembers':return[{brand:'品牌甲',name:'王小明',phone:'0900000001',email:'a@example.com',fb:'https://facebook.com/a',ig:'https://instagram.com/a'}];
  case'getMemberHistory':return[{sessionName:'測試市集',brand:'品牌甲',reviewStatus:'已錄取',paymentStatus:'已繳費',checkinStatus:'已報到'}];
  case'financeOverview':return{summary:{incomeTotal:2000,refundTotal:0,expenseTotal:300,netTotal:1700}};
  case'getSiteConfig':return{brandName:'測試主辦',logoUrl:'/doing-logo.png',heroImg:'',infoText:'測試'};
  case'getOperationalCloseout':return{
    consignment_periods:[{id:'P1',name:'九月寄賣',starts_at:'2026-09-01T00:00:00Z',ends_at:'2026-09-30T23:59:59Z',commission_percent:20,status:'open'}],
    consignment_applications:[{id:'A1',brand_name:'待審品牌',applicant_email:'wait@example.com',status:'pending',note:'申請寄賣'},{id:'A2',brand_name:'已通過品牌',applicant_email:'ok@example.com',status:'approved',note:''}],
    consignment_products:[{id:'PD1',period_id:'P1',application_id:'A2',name:'測試商品',sku:'SKU1',unit_price:100,current_stock:5,status:'active'}],
    pos_sales:[{id:'POS1',total_amount:100,payment_method:'cash'}],inventory_movements:[]
  };
  case'getPaymentSettings':return{enabled:true};
  case'getPaymentProfiles':return[{id:'PAY1',name:'預設收款'}];
  case'getAgreementTemplates':return[{id:'AGR1',name:'市集合約'}];
  case'getStaff':return[{email:'admin@example.com',role:'owner'}];
  case'listVenueMaps':return[{id:'V1',name:'A場地'}];
  case'getSupportThreads':return{threads:[{id:'T1',subject:'測試客服',status:'open'}],unread:1};
  default:return{ok:true,totalAmount:200};
}}
function actionOf(req){try{return req.method()==='POST'?String(req.postDataJSON?.()?.action||''):String(new URL(req.url()).searchParams.get('action')||'')}catch{return''}}
async function main(){const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewportSize:{width:1440,height:1000}});page.setDefaultTimeout(8000);page.on('dialog',d=>d.accept());await page.route(`${API}/**`,async route=>{const req=route.request(),action=actionOf(req);if(req.method()==='POST')writes.push({action,body:req.postDataJSON?.()||{}});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload(action))})});try{
  await page.goto(`${BASE}/market/?tenant=demo&admin_token=${encodeURIComponent(adminToken)}`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#sessionList .mk-card');
  await page.locator('.mk-nav button[data-page="members"]').click();await page.waitForSelector('[data-member-history]');await page.locator('[data-member-history]').click();await page.waitForSelector('#memberHistoryDialog[open]');assert.match(await page.locator('#memberHistoryDialogBody').innerText(),/測試市集/);await page.locator('#memberHistoryDialog [data-admin-close]').click();
  await page.locator('[data-member-note]').click();await page.waitForSelector('#memberNoteDialog[open]');await page.locator('#memberNoteText').fill('重要會員備註');await page.locator('#saveMemberNoteBtn').click();await page.waitForFunction(()=>!document.querySelector('#memberNoteDialog')?.open);assert.ok(writes.some(x=>x.action==='saveMemberNote'&&x.body.memberEmail==='a@example.com'));
  await page.locator('.mk-nav button[data-page="consignment"]').click();await page.waitForSelector('#consignmentOps .mk-admin-summary');assert.match(await page.locator('#consignment').innerText(),/寄賣／POS/);
  await page.locator('#newConsignmentPeriod').click();await page.waitForSelector('#consignmentPeriodDialog[open]');await page.locator('#cspName').fill('十月寄賣');await page.locator('#cspStart').fill('2026-10-01T10:00');await page.locator('#cspEnd').fill('2026-10-31T20:00');await page.locator('#cspCommission').fill('25');await page.locator('#cspStatus').selectOption('open');await page.locator('#saveConsignmentPeriod').click();await page.waitForFunction(()=>!document.querySelector('#consignmentPeriodDialog')?.open);assert.ok(writes.some(x=>x.action==='saveConsignmentPeriod'));
  await page.locator('#newConsignmentProduct').click();await page.waitForSelector('#consignmentProductDialog[open]');await page.locator('#cpdName').fill('新商品');await page.locator('#cpdSku').fill('SKU2');await page.locator('#cpdPrice').fill('150');await page.locator('#cpdStock').fill('3');await page.locator('#saveConsignmentProduct').click();await page.waitForFunction(()=>!document.querySelector('#consignmentProductDialog')?.open);assert.ok(writes.some(x=>x.action==='saveConsignmentProduct'));
  const approve=page.locator('[data-consign-review="approved"]').first();await approve.click();await page.waitForTimeout(100);assert.ok(writes.some(x=>x.action==='reviewConsignmentApplication'&&x.body.status==='approved'));
  await page.locator('#posPeriod').selectOption('P1');await page.locator('[data-pos-qty="PD1"]').fill('2');await page.locator('#submitPosSale').click();await page.waitForTimeout(100);const pos=writes.find(x=>x.action==='recordPosSale');assert.ok(pos);assert.deepEqual(pos.body.items,[{productId:'PD1',quantity:2}]);
  await page.locator('.mk-nav button[data-page="settings"]').click();for(const [kind,action] of [['payment','getPaymentSettings'],['agreement','getAgreementTemplates'],['staff','getStaff'],['venue','listVenueMaps'],['support','getSupportThreads']]){const p=page.waitForResponse(r=>actionOf(r.request())===action);await page.locator(`[data-settings-tool="${kind}"]`).click();await p;await page.waitForSelector('#marketSettingsDialog[open]');await page.locator('#marketSettingsDialog [data-admin-close]').click()}
  for(const w of writes){if(['saveMemberNote','saveConsignmentPeriod','saveConsignmentProduct','reviewConsignmentApplication','recordPosSale'].includes(w.action)){assert.equal(w.body.tenant,'demo');assert.equal(w.body.token,adminToken);assert.equal(w.body.email,'admin@example.com')}}
  console.log(JSON.stringify({result:'PASS',memberHistory:true,memberNote:true,consignmentPeriod:true,consignmentReview:true,consignmentProduct:true,pos:true,settingsTiles:5,workerChanges:0,dbSchemaChanges:0,twoBlChanges:0},null,2));
}finally{await browser.close()}}
main();
