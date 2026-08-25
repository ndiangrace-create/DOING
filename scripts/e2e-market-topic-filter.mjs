import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.E2E_BASE||'http://127.0.0.1:4173';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const sessions=[
  {id:'S2',eventId:'E2',name:'九月品牌場',dates:[{date:'2026-09-01',start:'13:00',end:'18:00'}],venue:'B場地',fee:350,status:'open',modules:{registration:true}},
  {id:'S1',eventId:'E1',name:'八月週末場',dates:[{date:'2026-08-28',start:'10:00',end:'16:00'}],venue:'A場地',fee:0,status:'open',modules:{registration:true}},
  {id:'S3',eventId:'E1',name:'最近場次',dates:[{date:'2026-08-27',start:'09:00',end:'15:00'}],venue:'C場地',fee:200,status:'open',modules:{registration:true}}
];
const events=[{id:'E1',title:'週末市集'},{id:'E2',title:'品牌企劃'},{id:'E3',title:'沒有開放場次'}];
function actionOf(req){try{return req.method()==='POST'?String(req.postDataJSON()?.action||''):String(new URL(req.url()).searchParams.get('action')||'')}catch{return''}}
async function mock(page){await page.route(`${API}/**`,async route=>{const a=actionOf(route.request());let data={ok:true};
  if(a==='frontBootstrap')data={tenant:{id:'demo',name:'DOING 測試主辦',i18n:{enabled:false,languages:['zh-TW'],defaultLanguage:'zh-TW'}},events,sessions,operationUnits:[],announcements:[]};
  else if(a==='publicDiscovery')data={items:sessions.map(s=>({tenantId:'demo',sessionId:s.id,sessionName:s.name,eventId:s.eventId,dates:s.dates,venue:s.venue,fee:s.fee,status:s.status}))};
  else if(a==='getPlatformMemberProfile')data={profile:{id:'M1',name:'測試會員',email:'member@example.com',phone:'0912345678'},complete:true,brands:[],workspaces:[],applications:[]};
  else if(a==='getSession')data=sessions.find(s=>s.id==='S3')||sessions[0];
  else if(a==='getBundlesPublic'||a==='getMyRegs'||a==='getMyNotifications'||a==='getMyCustomerWallets')data=[];
  else if(a==='getMyRewards')data={balance:0,rows:[]};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
});}
async function run(viewport){const browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewportSize:viewport});await mock(page);await page.addInitScript(()=>localStorage.setItem('doing_member_token','member-test-token'));await page.goto(`${BASE}/market/public/?tenant=demo`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.market-topic-chips');
  assert.equal(await page.locator('#eventSection .event-card').count(),0,'主題活動不得再是大卡片');
  const chips=await page.locator('[data-topic-id]').allTextContents();assert.deepEqual(chips,['全部','週末市集','品牌企劃'],'只顯示有公開場次的主題分類');
  const order=await page.locator('#sessionGrid [data-topic-session]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-topic-session')));assert.deepEqual(order,['S3','S1','S2'],'全場次必須依最近活動日期排序');
  const box=await page.locator('#sessionGrid [data-topic-session="S3"] .cover').boundingBox();assert.ok(box&&Math.abs(box.width-box.height)<2,'場次主圖必須固定 1:1');
  await page.locator('[data-topic-id="E2"]').click();await page.waitForFunction(()=>document.querySelectorAll('#sessionGrid [data-topic-session]').length===1);assert.equal(await page.locator('#sessionGrid [data-topic-session="S2"]').count(),1,'主題按鈕必須直接篩選下方場次');
  await page.locator('[data-topic-id=""]').click();await page.waitForFunction(()=>document.querySelectorAll('#sessionGrid [data-topic-session]').length===3);
  const before=new URL(page.url()).pathname;await page.locator('[data-topic-register="S3"]').click();await page.waitForSelector('#sessionModal.show');assert.equal(new URL(page.url()).pathname,before,'立即報名必須留在原頁 Modal');
  await page.close();return true
}finally{await browser.close()}}
for(const viewport of[{width:1440,height:1000},{width:390,height:844}])await run(viewport);
console.log(JSON.stringify({result:'PASS',desktop:true,mobile:true,topicAsFilter:true,largeEventCards:false,allSessionsPrimary:true,nearestDateFirst:true,cardImage:'1:1',registration:'inline-modal'},null,2));