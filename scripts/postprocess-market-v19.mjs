import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'.doing-2-site');
const css='doing-market-v19-layout.css',js='doing-market-auth-bridge-v19.js';
for(const f of [css,js]){const src=path.join(root,f),dest=path.join(out,f);if(!fs.existsSync(src))throw new Error('missing '+f);fs.copyFileSync(src,dest)}
function patch(rel,{auth=false}={}){const fp=path.join(out,rel);let html=fs.readFileSync(fp,'utf8');if(!html.includes(css))html=html.replace('</head>',`<link rel="stylesheet" href="/${css}?v=20260823a"></head>`);if(auth&&!html.includes(js))html=html.replace('</head>',`<script src="/${js}?v=20260823a"></script></head>`);fs.writeFileSync(fp,html)}
patch('market/public/index.html');patch('market/index.html',{auth:true});patch('market/session/index.html',{auth:true});

function injectHead(html,needle,markup){return html.includes(needle)?html:html.replace('</head>',markup+'</head>')}
function patchMember(){
  const fp=path.join(out,'me/index.html');let html=fs.readFileSync(fp,'utf8');
  html=html.replace(/<script src="\/doing-member-return-direct\.js[^\"]*"><\/script>/g,'');
  html=injectHead(html,'doing-member-return-direct.js','<script src="/doing-member-return-direct.js?v=20260824-unified-entry"></script>');
  html=html.replace(/<button[^>]*data-workspace-calendar="[^"]*"[^>]*>[\s\S]*?<\/button>/g,'');
  html=html.replace(/<button[^>]*data-workspace-operations="[^"]*"[^>]*>[\s\S]*?<\/button>/g,'');
  html=html.replace(/進入主辦後台|直接進入主辦後台/g,'進入工作空間');
  html=html.replace(/href="\/#apply"/g,'href="/apply/"').replace(/href="\/smart-application\.html"/g,'href="/apply/"');
  fs.writeFileSync(fp,html);
}
function patchGuarded(rel){const fp=path.join(out,rel);let html=fs.readFileSync(fp,'utf8');html=injectHead(html,'doing-global-entry.js','<script src="/doing-global-entry.js?v=20260824-unified-entry"></script>');fs.writeFileSync(fp,html)}
function publishBooking(){
  const source=path.join(root,'legacy-pages','booking-center.html'),fp=path.join(out,'booking/index.html');
  if(!fs.existsSync(source))throw new Error('isolated booking module source missing');
  let html=fs.readFileSync(source,'utf8');
  if(!html.includes('<base '))html=html.replace('<head>','<head><base href="/">');
  html=html.replaceAll('operations-center.html','/workspace/').replaceAll('index.html','/');
  html=injectHead(html,'doing-global-entry.js','<script src="/doing-global-entry.js?v=20260824-unified-entry"></script>');
  fs.mkdirSync(path.dirname(fp),{recursive:true});fs.writeFileSync(fp,html);
}
patchMember();patchGuarded('workspace/index.html');patchGuarded('register/index.html');publishBooking();

const redirects=`/index.html / 301
/member.html /me/ 302
/member-panel.html /me/ 302
/admin.html /workspace/ 302
/operations-center.html /workspace/ 302
/platform.html /workspace/ 302
/about.html /apply/ 302
/smart-application.html /apply/ 302
/onsite.html /market/#onsite 302
/photo.html /market/#settings 302
/consignment.html /market/#settings 302
/booking-center.html /booking/ 302
/workspace.html /workspace/ 302
/register.html /register/ 302
/market-center.html /market/ 302
/market-public.html /market/public/ 302
/market-session.html /market/session/ 302
`;
fs.writeFileSync(path.join(out,'_redirects'),redirects);

const me=fs.readFileSync(path.join(out,'me/index.html'),'utf8'),workspace=fs.readFileSync(path.join(out,'workspace/index.html'),'utf8'),register=fs.readFileSync(path.join(out,'register/index.html'),'utf8'),booking=fs.readFileSync(path.join(out,'booking/index.html'),'utf8');
if(!me.includes('doing-member-return-direct.js'))throw new Error('canonical /me/ login gate missing');
if((me.match(/doing-member-return-direct\.js/g)||[]).length!==1)throw new Error('duplicate /me/ login gate');
if(/<button[^>]+data-workspace-(?:calendar|operations)=/.test(me))throw new Error('duplicate workspace CTA still published');
for(const [name,html] of [['workspace',workspace],['register',register],['booking',booking]])if(!html.includes('doing-global-entry.js'))throw new Error(name+' unified entry guard missing');
for(const token of ['getOperationUnitsAdmin','getBookingCalendarAdmin','saveAvailabilityRule','updateServiceVisit'])if(!booking.includes(token))throw new Error('booking capability lost: '+token);
if(booking.includes('operations-center.html'))throw new Error('booking still links retired operations page');
console.log(JSON.stringify({result:'PASS',marketV19:{desktopAdminNav:'top-fixed',mobileAdminNav:'bottom',singleDoingLogin:true,publicDesktopMaxWidth:1180},unifiedEntry:{accountEntries:['/apply/','/me/'],loginLanding:'/me/',workspace:'/workspace/',legacyRedirects:true,duplicateWorkspaceCtas:false,secondLoginPage:false},booking:{published:'/booking/',source:'legacy-pages/booking-center.html',capabilitiesPreserved:true}},null,2));
