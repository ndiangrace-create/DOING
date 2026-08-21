import fs from 'node:fs';
import vm from 'node:vm';

const file='booking-center.html';
const html=fs.readFileSync(file,'utf8');
const operations=fs.readFileSync('operations-center.html','utf8');
const fail=(m)=>{throw new Error(m)};

for(const s of [
  'DOING｜預約中心','通用預約模組','getOperationUnitsAdmin','getBookingCalendarAdmin','getAvailabilityAdmin',
  'saveOperationUnit','saveBookingCalendar','saveAvailabilityRule','saveAvailabilityException',
  'getAvailableStartsPublic','updateServiceVisit','operation_units','booking_calendars','availability_rules','availability_exceptions'
]) if(!html.includes(s)) fail('missing booking contract: '+s);

for(const s of ['DOING-Market-App','doingmarket://','2bl-v7','localStorage.setItem']) if(html.includes(s)) fail('forbidden booking-center coupling: '+s);

if(!html.includes('@media(max-width:560px)')) fail('mobile breakpoint missing');
if(!html.includes('min-height:44px')) fail('tap target contract missing');
if(!html.includes('不綁定單一產業')) fail('universal wording missing');
if(!html.includes('服務人員／空間／設備')) fail('generic resource wording missing');

for(const s of ['id="bookingCenterLink"','booking-center.html?tenant=','admin_token']) if(!operations.includes(s)) fail('operations-center booking entry missing: '+s);

const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
if(!scripts.length) fail('inline script missing');
for(const [i,src] of scripts.entries()) new vm.Script(src,{filename:file+'#script'+(i+1)});

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
if(dup.length) fail('duplicate DOM ids: '+[...new Set(dup)].join(','));

console.log(JSON.stringify({file,syntax:'PASS',contracts:'PASS',mobile:'PASS',entryIntegration:'PASS',forbiddenCoupling:'PASS',domIds:'PASS'},null,2));
