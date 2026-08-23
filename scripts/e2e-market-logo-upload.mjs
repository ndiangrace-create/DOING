import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const base=process.env.E2E_BASE||'http://127.0.0.1:4173';
const api='https://tobeloved-api.ndiangrace.workers.dev/';
const token='eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({email:'owner@example.com',tenant_id:'demo'})).toString('base64url')+'.x';
const originalLogo='https://example.com/original-logo.png';
const uploadedLogo='https://example.com/uploaded-logo.png';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
fs.mkdirSync('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true});

async function verifyLogoUpload(width,height,label){
  const context=await browser.newContext({viewport:{width,height}});
  const page=await context.newPage();
  const posts=[];
  let storedLogo=originalLogo;
  page.on('dialog',dialog=>dialog.dismiss());
  await page.route(api+'**',async route=>{
    const req=route.request();
    const url=new URL(req.url());
    let body={};
    try{body=req.postDataJSON()||{}}catch{}
    const action=body.action||url.searchParams.get('action')||'';
    if(req.method()==='POST')posts.push({action,body});
    let data={};
    if(action==='getSiteConfig')data={logoUrl:storedLogo,heroImg:'',infoText:'',brandName:'測試主辦'};
    else if(action==='getSessionsAdmin')data=[];
    else if(action==='uploadCover'){
      assert.match(String(body.image||''),/^data:image\/png;base64,/,'應將選取的 PNG 轉為 data URL 送到既有 uploadCover');
      data={url:uploadedLogo};
    }else if(action==='saveSiteConfig'){
      if(Object.prototype.hasOwnProperty.call(body,'logoUrl'))storedLogo=body.logoUrl;
      data={success:true};
    }
    await route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({ok:true,data})});
  });

  const response=await page.goto(base+`/market/?tenant=demo&admin_token=${encodeURIComponent(token)}`,{waitUntil:'domcontentloaded'});
  assert.ok(response&&response.ok(),'Market 後台應可開啟');
  await page.locator('.admin-nav [data-page="settings"]').waitFor({timeout:8000});
  await page.locator('.admin-nav [data-page="settings"]').click();
  const fileInput=page.locator('#brandLogoFile');
  await fileInput.waitFor({state:'visible'});
  assert.equal(await fileInput.getAttribute('accept'),'image/png,image/jpeg,image/webp');
  await fileInput.setInputFiles({name:'logo.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(url=>document.querySelector('#brandLogo')?.value===url,uploadedLogo,{timeout:8000});

  const preview=page.locator('#brandLogoPreview');
  assert.equal(await preview.isVisible(),true,'上傳後應立即顯示 Logo 預覽');
  assert.equal(await preview.getAttribute('src'),uploadedLogo,'預覽應使用 Storage 回傳的正式 URL');
  assert.ok(posts.some(x=>x.action==='uploadCover'),'應呼叫既有 uploadCover');
  assert.ok(posts.some(x=>x.action==='saveSiteConfig'&&x.body.logoUrl===uploadedLogo),'應將正式 Logo URL 寫回 saveSiteConfig');
  assert.equal(storedLogo,uploadedLogo,'重新讀取設定時應取得剛儲存的 Logo URL');

  const screenshot=`artifacts/market-logo-upload-${label}.png`;
  await page.screenshot({path:screenshot,fullPage:true});
  await context.close();
  return {label,width,height,uploadCalls:posts.filter(x=>x.action==='uploadCover').length,saveCalls:posts.filter(x=>x.action==='saveSiteConfig').length,screenshot};
}

try{
  const desktop=await verifyLogoUpload(1440,1000,'desktop');
  const mobile=await verifyLogoUpload(390,844,'mobile');
  console.log(JSON.stringify({result:'PASS',browser:'Chromium',feature:'Market 後台前台 Logo 圖片上傳',storageContract:'uploadCover -> URL -> saveSiteConfig',productionWrites:0,checks:[desktop,mobile]},null,2));
}finally{
  await browser.close();
}
