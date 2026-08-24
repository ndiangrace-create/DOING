import { chromium } from 'playwright';

const base=process.env.E2E_BASE||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:390,height:844,name:'mobile'},{width:1440,height:1000,name:'desktop'}]){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
    await page.goto(base+'/',{waitUntil:'networkidle'});
    await page.locator('text=DOING 是什麼？').waitFor();
    await page.locator('text=市集活動').first().waitFor();
    await page.locator('text=室內設計進度').first().waitFor();
    await page.locator('text=美類預約').first().waitFor();
    await page.locator('text=系統亮點').first().waitFor();

    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    if(overflow)throw new Error(`${viewport.name}: horizontal overflow`);

    const heroLogo=page.locator('.brand-logo-hero');
    const logoBox=await heroLogo.boundingBox();
    if(!logoBox)throw new Error(`${viewport.name}: hero logo missing`);
    const minLogoWidth=viewport.name==='mobile'?320:700;
    if(logoBox.width<minLogoWidth)throw new Error(`${viewport.name}: hero logo too small (${logoBox.width})`);

    const highlights=page.locator('.highlight-card');
    if(await highlights.count()!==6)throw new Error(`${viewport.name}: system highlight count mismatch`);

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

    await page.locator('a[href="/me/"]').first().click();
    await page.waitForURL(/\/me\/?$/);
    await page.locator('#lineLogin').waitFor();
    const meOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
    if(meOverflow)throw new Error(`${viewport.name}: member page overflow`);
    await page.close();
  }
  console.log(JSON.stringify({result:'PASS',viewports:['390x844','1440x1000'],homeIntro:true,largeLogo:true,alignedSystemCards:true,systemHighlights:6,homeSearch:true,bottomNav:true,memberLoginEntry:true,horizontalOverflow:false}));
} finally {
  await browser.close();
}
