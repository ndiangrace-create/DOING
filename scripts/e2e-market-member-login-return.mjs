import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base=process.env.E2E_GITHUB_BASE||'http://127.0.0.1:4174';
const RETURN_KEY='doing_market_member_return';
const root=process.cwd();
const wrapper=fs.readFileSync(root+'/market/public/index.html','utf8');
const home=fs.readFileSync(root+'/doing-home-refresh.js','utf8');
for(const token of [RETURN_KEY,'member_token','member_login_error','market/public/'])assert.ok(wrapper.includes(token),'Market 公開入口缺少回跳保護：'+token);
for(const token of [RETURN_KEY,'handoffToPendingMarket','clearMarketMemberReturn','startRegistrationsLineLogin'])assert.ok(home.includes(token),'DOING 首頁缺少 Market member 回跳保護：'+token);

const browser=await chromium.launch({headless:true});
const results=[];
async function mock(page){
  await page.route('https://tobeloved-api.ndiangrace.workers.dev/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.endsWith('/auth/line/start'))return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>LINE mock</title><body>LINE Login Mock</body>'});
    let body={};try{body=req.postDataJSON()||{}}catch{}
    const action=body.action||url.searchParams.get('action')||'';
    let data={};
    if(action==='publicDiscovery')data={items:[]};
    if(action==='getSiteConfig')data={brandName:'測試主辦',logoUrl:'',heroImg:'',infoText:'測試前台'};
    if(action==='getPlatformMemberProfile')data={profile:{name:'測試會員',phone:'0912345678',email:'member@example.com',city:'台中'}};
    if(action==='getMyRegsGlobal')data=[];
    await route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({ok:true,data})});
  });
}
async function run(label,width,height){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  await mock(page);
  await page.goto(base+'/market/public/?tenant=demo',{waitUntil:'domcontentloaded'});
  await page.waitForURL(u=>u.pathname.endsWith('/market-public.html')&&u.searchParams.get('tenant')==='demo',{timeout:8000});
  const pending=await page.evaluate(key=>localStorage.getItem(key),RETURN_KEY);
  assert.ok(pending,'進入 Market 前台時必須留下短效回跳標記');
  const parsed=JSON.parse(pending);
  assert.ok(new URL(parsed.url).pathname.endsWith('/market/public/'),'回跳目標必須是 Market 公開前台');
  assert.ok(Date.now()-Number(parsed.createdAt)<60_000,'回跳標記必須是本次瀏覽建立');

  // 模擬 LINE Callback 錯誤落到 DOING 根首頁；首頁必須立即把一般 member 帶回原 Market 前台。
  await page.goto(base+'/?member_token=participant-token&member_status=ready',{waitUntil:'domcontentloaded'});
  await page.waitForURL(u=>u.pathname.endsWith('/market-public.html')&&u.searchParams.get('tenant')==='demo',{timeout:8000});
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>localStorage.getItem('doing_member_token')),'participant-token','member_token 必須回到 Market 前台並保存');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),RETURN_KEY),null,'成功回前台後必須清除短效回跳標記');
  assert.ok(!/member-panel\.html|workspace\.html|admin/.test(page.url()),'一般報名者不得被送進會員管理／主辦工作空間');
  fs.mkdirSync('artifacts',{recursive:true});
  const screenshot=`artifacts/market-member-return-${label}.png`;
  await page.screenshot({path:screenshot,fullPage:true});
  results.push({label,width,height,finalUrl:page.url(),storedMemberToken:true,pendingReturnCleared:true,screenshot});
  await context.close();
}
try{
  await run('desktop',1440,1000);
  await run('mobile',390,844);
  console.log(JSON.stringify({result:'PASS',browser:'Chromium',feature:'Market participant LINE return',wrongLandingSimulated:'DOING root',expectedLanding:'Market frontstage',memberTokenIsNotAdminToken:true,productionWrites:0,checks:results},null,2));
}finally{await browser.close()}
