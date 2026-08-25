import { chromium } from 'playwright';

const base=process.env.E2E_BASE||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:390,height:844,name:'mobile'},{width:1440,height:1000,name:'desktop'}]){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
    await page.goto(base+'/',{waitUntil:'networkidle'});
    await page.locator('text=斜槓人生小幫手').waitFor();
    for(const text of ['市集活動系統','室內設計進度系統','美類預約系統'])await page.locator(`text=${text}`).first().waitFor();

    const bodyText=await page.locator('body').innerText();
    for(const forbidden of ['協援人生小幫手','一個帳號，多種身分','共用同一','資料只留一份','需要什麼再加什麼','手機與電腦同一套','系統亮點','我是來參加活動的','我是使用 DOING 的店家／主辦／團隊']){
      if(bodyText.includes(forbidden))throw new Error(`${viewport.name}: private/removed homepage copy leaked: ${forbidden}`);
    }
    if(await page.locator('#doingSearch,.jelly-search,.benefit-card,.benefit-grid,.audience-card,.audience-strip').count()!==0)throw new Error(`${viewport.name}: removed homepage UI leaked`);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1))throw new Error(`${viewport.name}: horizontal overflow`);

    const heroLogo=page.locator('.hero-logo');
    const logoBox=await heroLogo.boundingBox();
    const logoNatural=await heroLogo.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));
    if(!logoBox)throw new Error(`${viewport.name}: logo missing`);
    if(logoNatural.width!==1056||logoNatural.height!==412)throw new Error(`${viewport.name}: logo source regression ${logoNatural.width}x${logoNatural.height}`);
    if(logoBox.width>logoNatural.width+1)throw new Error(`${viewport.name}: logo upscaled beyond native width (${logoBox.width})`);
    if(viewport.name==='mobile'&&logoBox.width<340)throw new Error(`mobile: logo too small (${logoBox.width})`);
    if(viewport.name==='desktop'&&logoBox.width<650)throw new Error(`desktop: logo too small (${logoBox.width})`);

    const cards=page.locator('.system-card');
    if(await cards.count()!==3)throw new Error(`${viewport.name}: public system card count mismatch`);
    const expectedApply=['/apply/?system=market','/apply/?system=project','/apply/?system=booking'];
    for(let i=0;i<3;i++){
      const action=cards.nth(i).locator('.system-action');
      if(await action.getAttribute('href')!==expectedApply[i])throw new Error(`${viewport.name}: system ${i+1} application target mismatch`);
    }

    const bottom=page.locator('.bottom-nav .jelly');
    if(await bottom.count()!==3)throw new Error(`${viewport.name}: bottom nav count mismatch`);
    const hrefs=await bottom.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
    for(const expected of ['/market/public/','/me/','#support'])if(!hrefs.includes(expected))throw new Error(`${viewport.name}: missing nav ${expected}`);

    if(viewport.name==='desktop'){
      const heights=[]; const actionBottoms=[];
      for(let i=0;i<3;i++){
        const cardBox=await cards.nth(i).boundingBox();
        const actionBox=await cards.nth(i).locator('.system-action').boundingBox();
        if(!cardBox||!actionBox)throw new Error(`desktop: missing card/action box ${i}`);
        heights.push(cardBox.height); actionBottoms.push(actionBox.y+actionBox.height);
      }
      if(Math.max(...heights)-Math.min(...heights)>2)throw new Error(`desktop: system card heights not aligned ${heights.join(',')}`);
      if(Math.max(...actionBottoms)-Math.min(...actionBottoms)>2)throw new Error(`desktop: system action baseline not aligned ${actionBottoms.join(',')}`);
    }

    await page.goto(base+'/me/',{waitUntil:'domcontentloaded'});
    await page.locator('#lineLogin').waitFor({state:'visible'});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1))throw new Error(`${viewport.name}: member page overflow`);
    await page.close();
  }

  const authPage=await browser.newPage({viewport:{width:1440,height:1000}});
  let oauthStarts=0;
  authPage.on('request',req=>{if(req.url().includes('/auth/line/start'))oauthStarts++});
  await authPage.addInitScript(()=>localStorage.setItem('doing_member_token','existing-member-token'));
  await authPage.route('https://tobeloved-api.ndiangrace.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    if((u.searchParams.get('action')||'')==='getPlatformMemberProfile'){
      await new Promise(r=>setTimeout(r,350));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{profile:{name:'測試租戶'},workspaces:[]}})}); return;
    }
    await route.abort();
  });
  await authPage.goto(base+'/me/',{waitUntil:'domcontentloaded'});
  await authPage.waitForTimeout(80);
  const loginButtonLocked=await authPage.locator('#lineLogin').evaluate(el=>el.classList.contains('hidden')||el.disabled);
  if(!loginButtonLocked)throw new Error('auth: existing token did not lock LINE login immediately');
  if(oauthStarts!==0)throw new Error(`auth: duplicate LINE OAuth started while token verification pending (${oauthStarts})`);
  await authPage.locator('#appView:not(.hidden)').waitFor();
  await authPage.locator('text=測試租戶，歡迎回來').waitFor();
  if(oauthStarts!==0)throw new Error(`auth: LINE OAuth started after identity resolved (${oauthStarts})`);
  await authPage.close();

  const transientPage=await browser.newPage({viewport:{width:1440,height:1000}});
  let transientOauthStarts=0;
  transientPage.on('request',req=>{if(req.url().includes('/auth/line/start'))transientOauthStarts++});
  await transientPage.addInitScript(()=>localStorage.setItem('doing_member_token','existing-member-token'));
  await transientPage.route('https://tobeloved-api.ndiangrace.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    if((u.searchParams.get('action')||'')==='getPlatformMemberProfile'){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'暫時無法讀取工作空間'})});return}
    await route.abort();
  });
  await transientPage.goto(base+'/me/',{waitUntil:'domcontentloaded'});
  await transientPage.waitForFunction(()=>document.getElementById('loginMessage')?.textContent?.includes('工作空間暫時載入失敗'));
  const tokenAfterTransient=await transientPage.evaluate(()=>localStorage.getItem('doing_member_token'));
  if(tokenAfterTransient!=='existing-member-token')throw new Error('auth: transient API failure incorrectly cleared member token');
  if(transientOauthStarts!==0)throw new Error('auth: transient API failure incorrectly restarted LINE OAuth');
  await transientPage.close();

  console.log(JSON.stringify({result:'PASS',viewports:['390x844','1440x1000'],homepage:'approved-three-system-layout',fixedApplicationLinks:true,logoNaturalSize:'1056x412',logoUpscale:false,publicSystemCount:3,bottomNav:true,memberLoginEntry:true,duplicateLineOAuthRace:false,transientMemberLoadKeepsToken:true,horizontalOverflow:false}));
} finally { await browser.close(); }
