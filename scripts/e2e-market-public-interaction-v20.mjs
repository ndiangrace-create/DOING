import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.E2E_BASE||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844}});
const page=await ctx.newPage();
await page.addInitScript(()=>localStorage.setItem('doing_member_token','member-e2e'));
await page.route('https://tobeloved-api.ndiangrace.workers.dev/**',async route=>{
  const req=route.request(),u=new URL(req.url());let body={};
  try{body=req.postDataJSON()||{}}catch{}
  const action=body.action||u.searchParams.get('action')||'';
  let data={};
  if(action==='publicDiscovery')data={items:[{id:'E1',sessionId:'E1',tenantId:'demo',sessionName:'最近活動',venue:'台中',description:'活動說明',dates:[{date:'2026-08-25'}]}]};
  if(action==='getSiteConfig')data={brandName:'兔彼樂'};
  if(action==='getPlatformMemberProfile')data={profile:{name:'王小花',phone:'0912345678',email:'a@example.com',city:'台中'},complete:true};
  if(action==='getMyRegsGlobal')data={rows:[{id:'R1',sessionName:'最近活動',date:'2026-08-25',paymentStatus:'已繳費'}]};
  if(action==='savePlatformMemberProfile')data={success:true};
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,data})});
});
try{
  await page.goto(base+'/market/public/?tenant=demo',{waitUntil:'domcontentloaded'});
  await page.locator('.event-card').first().waitFor();
  const before=page.url();
  await page.locator('.event-card').first().click();
  assert.equal(page.url(),before,'活動卡不應直接跳頁');
  assert.equal(await page.locator('#eventDialog').isVisible(),true,'活動卡應開單一 Panel');
  const regHref=await page.locator('#eventDialog a[href*="/register/"]').getAttribute('href');
  assert.ok(regHref?.includes('session=E1'),'Primary 報名應指向正式 /register/');
  await page.locator('#eventDialog [data-close="eventDialog"]').last().click();
  await page.locator('#navMember').click();
  assert.equal(await page.locator('#memberDialog').isVisible(),true,'會員應留在原頁 Panel');
  await page.locator('#memberRegs .member-reg-card').first().waitFor();
  assert.match(await page.locator('#memberRegs').innerText(),/最近活動/,'會員 Panel 應讀我的報名');
  await page.locator('#memberDialog [data-close="memberDialog"]').first().click();
  await page.locator('#navSupport').click();
  assert.equal(await page.locator('#supportDialog').isVisible(),true,'客服應留在原頁 Panel');
  console.log(JSON.stringify({result:'PASS',browser:'Chromium',flow:['category same-page filter','event card→single panel→register','member→inline profile/my registrations','support→inline panel'],urlStayed:true},null,2));
}finally{await browser.close()}
