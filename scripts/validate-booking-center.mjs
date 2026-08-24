import fs from 'node:fs';
import vm from 'node:vm';

const sourceFile='modules/booking/booking-center.html';
const builtFile='.doing-2-site/booking/index.html';
const source=fs.readFileSync(sourceFile,'utf8');
const html=fs.readFileSync(builtFile,'utf8');
const router=fs.readFileSync('doing-workspace-product-router.js','utf8');
const post=fs.readFileSync('scripts/postprocess-market-v19.mjs','utf8');
const fail=m=>{throw new Error(m)};

for(const s of [
  'DOING｜預約中心','通用預約模組','getOperationUnitsAdmin','getBookingCalendarAdmin','getAvailabilityAdmin',
  'saveOperationUnit','saveBookingCalendar','saveAvailabilityRule','saveAvailabilityException',
  'getAvailableStartsPublic','updateServiceVisit','operation_units','booking_calendars','availability_rules','availability_exceptions'
]) if(!html.includes(s)) fail('missing booking contract: '+s);

for(const s of ['DOING-Market-App','doingmarket://','2bl-v7','localStorage.setItem']) if(html.includes(s)) fail('forbidden booking coupling: '+s);
if(!html.includes('@media(max-width:560px)')) fail('mobile breakpoint missing');
if(!html.includes('min-height:44px')) fail('tap target contract missing');
if(!html.includes('不綁定單一產業')) fail('universal wording missing');
if(!html.includes('服務人員／空間／設備')) fail('generic resource wording missing');
if(html.includes('operations-center.html')) fail('canonical booking must not link retired operations page');
if(!html.includes('doing-global-entry.js')) fail('booking must use unified entry guard');
if(!router.includes("booking:'/booking/'")) fail('workspace booking route must be /booking/');
if(!post.includes("'modules','booking','booking-center.html'")||!post.includes("booking/index.html")) fail('booking module source must publish only to /booking/');
if(fs.existsSync('booking-center.html')) fail('retired root booking page must stay removed');
if(fs.existsSync('legacy-pages')) fail('retired legacy-pages directory must stay removed');

const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
if(!scripts.length) fail('inline script missing');
for(const [i,src] of scripts.entries()) new vm.Script(src,{filename:builtFile+'#script'+(i+1)});
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
if(dup.length) fail('duplicate DOM ids: '+[...new Set(dup)].join(','));

console.log(JSON.stringify({route:'/booking/',source:sourceFile,sourcePreserved:source.length>1000,syntax:'PASS',contracts:'PASS',mobile:'PASS',workspaceEntry:'PASS',singleLogin:'PASS',retiredRoot:false,forbiddenCoupling:'PASS',domIds:'PASS',productionWrites:0},null,2));
