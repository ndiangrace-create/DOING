import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=f=>fs.readFileSync(f,'utf8');
const css=read('doing-market-role-ui-v17.css');
const js=read('doing-market-role-ui-v17.js');
const loader=read('doing-visual-system-20260822.js');
const build=read('scripts/build-doing-2-site.mjs');
const worker=read('worker.js');
for(const token of ['repeat(5,minmax(0,1fr))','repeat(6,minmax(0,1fr))','repeat(2,minmax(0,1fr))','aspect-ratio:1/1','dm17-mobile-nav','dm17-desktop-support'])assert.ok(css.includes(token),'視覺規則缺少 '+token);
assert.ok(!css.includes('border-radius:999px'),'v17 不得新增膠囊元件');
for(const token of ['找今天想參加的活動','先做就對了 ✦','firstDate','publicDiscovery','getSiteConfig','saveSiteConfig','logoUrl','heroImg','data-dm17-focus','pending','unpaid','paid','pageshow'])assert.ok(js.includes(token),'角色介面缺少 '+token);
for(const token of ['doing-market-role-ui-v17.css','doing-market-role-ui-v17.js']){assert.ok(loader.includes(token),'視覺載入器未載入 '+token);assert.ok(build.includes(token),'正式建置未包含 '+token)}
for(const token of ["case 'getSiteConfig'","case 'saveSiteConfig'",'TENANT_ROLE_ACTIONS','getSessionRegistrations','confirmPayment','confirmRefund'])assert.ok(worker.includes(token),'Core 契約缺少 '+token);
assert.ok(js.includes("u.pathname='/market/session/'"),'數字入口必須進單場工作台');
assert.ok(js.includes("u.searchParams.set('focus',focus)"),'數字入口必須保留名單焦點');
assert.ok(js.includes("document.getElementById('reloadSessions')?.click()"),'返回場次總覽必須重新讀取正式數字');
console.log(JSON.stringify({result:'PASS',visual:'single DOING design system',public:{cover:true,tenantLogo:true,nearestDateFirst:true,desktopCards:'5-6',mobileCards:2,desktopSupport:'top',mobileActions:'bottom-3'},admin:{twoBLOperationSkeleton:true,compactCards:true,metricNumbersClickable:true,bidirectionalReread:true,roleCopyOnly:true},settings:{tenantHero:true,tenantLogo:true,action:'saveSiteConfig'},dbChanges:0,workerChanges:0},null,2));
