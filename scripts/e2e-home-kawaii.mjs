import { chromium } from 'playwright';

const base=process.env.E2E_BASE||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:390,height:844,name:'mobile'},{width:1440,height:1000,name:'desktop'}]){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
    await page.goto(base+'/',{waitUntil:'networkidle'});
    await page.locator('text=DOING 可以幫你什麼？').waitFor();
    await page.locator('text=市集活動').first().waitFor();
    await page.locator('text=室內設計進度').first().waitFor();
    await page.locator('text=美類預約').first().waitFor();
    await page.locator('text=看圖就知道 DOING 幫你省掉哪些麻煩').waitFor();

    const bodyText=await page.locator('body').innerText();
    for(const forbidden of ['手機與電腦同一套','系統可以跟著你長大','需要什麼再加什麼']){
      if(bodyText.includes(forbidden))throw new Error(`${viewport.name}: forbidden misleading highlight leaked: ${forbidden}`);
    }

    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    if(overflow)throw new Error(`${viewport.name}: horizontal overflow`);

    const heroLogo=page.locator('.brand-logo-hero');
    const logoBox=await heroLogo.boundingBox();
    if(!logoBox)throw new Error(`${viewport.name}: hero logo missing`);
    const minLogoWidth=viewport.name==='mobile'?350:1100;
    if(logoBox.width<minLogoWidth)throw new Error(`${viewport.name}: hero logo too small (${logoBox.width})`);

    const benefits=page.locator('.benefit-card');
    const visuals=page.locator('.benefit-visual');
    if(await benefits.count()!==6)throw new Error(`${viewport.name}: benefit card count mismatch`);
    if(await visuals.count()!==6)throw new Error(`${viewport.name}: infographic visual count mismatch`);

    const bottom=page.locator('.bottom-jelly');
    if(await bottom.count()!==3)throw new Error(`${viewport.name}: bottom jelly nav count mismatch`);
    const hrefs=await bottom.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
    for(const expected of ['/market/public/','/me/','#support'])if(!hrefs.includes(expected))throw new Error(`${viewport.name}: missing nav ${expected}`);

    if(viewport.name==='desktop'){
      const cards=page.locator('.system-card');
      if(await cards.count()!==3)throw new Error('desktop: system card count mismatch');
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

    const input=page.locator('#doingSearch');
    await input.fill('室內');
    const hidden=await page.locator('[data-search-hidden="1"]').count();
    if(hidden<2)throw new Error(`${viewport.name}: search filtering failed`);
    await page.locator('#clearSearch').click();
    if(await page.locator('[data-search-hidden="1"]').count()!==0)throw new Error(`${viewport.name}: clear search failed`);

    await page.goto(base+'/me/',{waitUntil:'domcontentloaded'});
    await page.locator('#lineLogin').waitFor({state:'visible'});
    const meOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    if(meOverflow)throw new Error(`${viewport.name}: member page overflow`);
    await page.close();
  }

  // Regression for the reported race: an existing member token must lock the LINE button
  // immediately while profile verification is in flight. The page may show the member name,
  // but it must never start a second OAuth navigation.
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
  const loginButtonHidden=await authPage.locator('#lineLogin').evaluate(el=>el.classList.contains('hidden')||el.disabled);
  if(!loginButtonHidden)throw new Error('auth: existing token did not lock LINE login immediately');
  if(oauthStarts!==0)throw new Error(`auth: duplicate LINE OAuth started while token verification was pending (${oauthStarts})`);
  await authPage.locator('#appView:not(.hidden)').waitFor();
  await authPage.locator('text=測試租戶，歡迎回來').waitFor();
  if(oauthStarts!==0)throw new Error(`auth: LINE OAuth started after member identity resolved (${oauthStarts})`);
  await authPage.close();

  console.log(JSON.stringify({result:'PASS',viewports:['390x844','1440x1000'],homeIntro:true,logoDominant:true,alignedSystemCards:true,infographicHighlights:6,misleadingHighlightsRemoved:true,homeSearch:true,bottomNav:true,memberLoginEntry:true,duplicateLineOAuthRace:false,horizontalOverflow:false}));
} finally {
  await browser.close();
}
