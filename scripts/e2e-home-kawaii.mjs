import { chromium } from 'playwright';

const base=process.env.E2E_BASE||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:390,height:844,name:'mobile'},{width:1440,height:1000,name:'desktop'}]){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
    await page.goto(base+'/',{waitUntil:'networkidle'});
    await page.locator('text=斜槓人生小幫手').waitFor();
    await page.locator('text=DOING 工作系統').waitFor();
    await page.locator('text=市集活動系統').first().waitFor();
    await page.locator('text=室內設計進度系統').first().waitFor();
    await page.locator('text=美類預約系統').first().waitFor();

    const bodyText=await page.locator('body').innerText();
    for(const forbidden of [
      '協援人生小幫手',
      '一個帳號，多種身分',
      '共用同一',
      '資料只留一份',
      '需要什麼再加什麼',
      '手機與電腦同一套',
      '系統亮點',
      '看圖就知道 DOING 幫你省掉哪些麻煩',
      '我是來參加活動的',
      '我是使用 DOING 的店家／主辦／團隊'
    ]){
      if(bodyText.includes(forbidden))throw new Error(`${viewport.name}: private/removed homepage copy leaked: ${forbidden}`);
    }
    if(await page.locator('#doingSearch').count()!==0||await page.locator('.jelly-search').count()!==0)throw new Error(`${viewport.name}: homepage search leaked`);
    if(await page.locator('.benefit-card').count()!==0||await page.locator('.benefit-grid').count()!==0)throw new Error(`${viewport.name}: old benefit grid leaked`);
    if(await page.locator('.audience-card').count()!==0||await page.locator('.audience-strip').count()!==0)throw new Error(`${viewport.name}: old audience split leaked`);

    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    if(overflow)throw new Error(`${viewport.name}: horizontal overflow`);

    const heroLogo=page.locator('.brand-logo-hero');
    const logoBox=await heroLogo.boundingBox();
    const taglineBox=await page.locator('.brand-tagline').boundingBox();
    if(!logoBox||!taglineBox)throw new Error(`${viewport.name}: logo/tagline missing`);
    const minLogoWidth=viewport.name==='mobile'?340:900;
    if(logoBox.width<minLogoWidth)throw new Error(`${viewport.name}: hero logo too small (${logoBox.width})`);
    const logoGap=taglineBox.y-(logoBox.y+logoBox.height);
    if(logoGap>18)throw new Error(`${viewport.name}: excess gap below logo (${logoGap})`);

    const cards=page.locator('.system-card');
    if(await cards.count()!==3)throw new Error(`${viewport.name}: public system card count mismatch`);
    for(let i=0;i<3;i++){
      const features=cards.nth(i).locator('.system-feature-list li');
      if(await features.count()!==4)throw new Error(`${viewport.name}: system ${i+1} feature count mismatch`);
      const action=cards.nth(i).locator('.card-action');
      if(await action.getAttribute('href')!=='/apply/')throw new Error(`${viewport.name}: system ${i+1} must apply independently`);
    }

    const bottom=page.locator('.bottom-jelly');
    if(await bottom.count()!==3)throw new Error(`${viewport.name}: bottom jelly nav count mismatch`);
    const hrefs=await bottom.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
    for(const expected of ['/market/public/','/me/','#support'])if(!hrefs.includes(expected))throw new Error(`${viewport.name}: missing nav ${expected}`);

    if(viewport.name==='desktop'){
      const heights=[];
      const actionBottoms=[];
      for(let i=0;i<3;i++){
        const cardBox=await cards.nth(i).boundingBox();
        const actionBox=await cards.nth(i).locator('.card-action').boundingBox();
        if(!cardBox||!actionBox)throw new Error(`desktop: missing card/action box ${i}`);
        heights.push(cardBox.height);
        actionBottoms.push(actionBox.y+actionBox.height);
      }
      if(Math.max(...heights)-Math.min(...heights)>2)throw new Error(`desktop: system card heights not aligned ${heights.join(',')}`);
      if(Math.max(...actionBottoms)-Math.min(...actionBottoms)>2)throw new Error(`desktop: system action baseline not aligned ${actionBottoms.join(',')}`);
    }

    await page.goto(base+'/me/',{waitUntil:'domcontentloaded'});
    await page.locator('#lineLogin').waitFor({state:'visible'});
    const meOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    if(meOverflow)throw new Error(`${viewport.name}: member page overflow`);
    await page.close();
  }

  // Regression for the reported race: an existing member token must lock the LINE button
  // immediately while profile verification is in flight. It must never start a second OAuth navigation.
  const authPage=await browser.newPage({viewport:{width:1440,height:1000}});
  let oauthStarts=0;
  authPage.on('request',req=>{if(req.url().includes('/auth/line/start'))oauthStarts++});
  await authPage.addInitScript(()=>localStorage.setItem('doing_member_token','existing-member-token'));
  await authPage.route('https://tobeloved-api.ndiangrace.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    const action=u.searchParams.get('action')||'';
    if(action==='getPlatformMemberProfile'){
      await new Promise(r=>setTimeout(r,350));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{profile:{name:'測試租戶'},workspaces:[]}})});
      return;
    }
    await route.abort();
  });
  await authPage.goto(base+'/me/',{waitUntil:'domcontentloaded'});
  await authPage.waitForTimeout(80);
  const loginButtonLocked=await authPage.locator('#lineLogin').evaluate(el=>el.classList.contains('hidden')||el.disabled);
  if(!loginButtonLocked)throw new Error('auth: existing token did not lock LINE login immediately');
  if(oauthStarts!==0)throw new Error(`auth: duplicate LINE OAuth started while token verification was pending (${oauthStarts})`);
  await authPage.locator('#appView:not(.hidden)').waitFor();
  await authPage.locator('text=測試租戶，歡迎回來').waitFor();
  if(oauthStarts!==0)throw new Error(`auth: LINE OAuth started after member identity resolved (${oauthStarts})`);
  await authPage.close();

  // A transient profile/workspace API failure must not destroy a valid member token or restart LINE OAuth.
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
  await transientPage.locator('#loginMessage').waitFor();
  await transientPage.waitForFunction(()=>document.getElementById('loginMessage')?.textContent?.includes('工作空間暫時載入失敗'));
  const tokenAfterTransient=await transientPage.evaluate(()=>localStorage.getItem('doing_member_token'));
  if(tokenAfterTransient!=='existing-member-token')throw new Error('auth: transient API failure incorrectly cleared member token');
  if(transientOauthStarts!==0)throw new Error('auth: transient API failure incorrectly restarted LINE OAuth');
  const retryText=await transientPage.locator('#lineLogin').textContent();
  if(!String(retryText||'').includes('重新確認'))throw new Error('auth: transient API failure did not offer in-place retry');
  await transientPage.close();

  console.log(JSON.stringify({result:'PASS',viewports:['390x844','1440x1000'],tagline:'斜槓人生小幫手',homepageSearchRemoved:true,latestLogo:true,logoGapChecked:true,publicSystemCount:3,independentApplication:true,benefitsRemoved:true,audienceSplitRemoved:true,bottomNav:true,memberLoginEntry:true,duplicateLineOAuthRace:false,transientMemberLoadKeepsToken:true,horizontalOverflow:false}));
} finally {
  await browser.close();
}
