import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const out=path.join(root,'.doing-2-site');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

const sourceRoutes={
  '/':'home-current.html',
  '/market/':'market-current.html',
  '/market/session/':'market-session-current.html',
  '/project/':'project-current.html',
  '/booking/':'booking-current.html',
  '/workspace/':'workspace-current.html',
  '/me/':'member-current.html',
  '/apply/':'apply-current.html',
};
function withBase(html){return html.includes('<base href="/">')?html:html.replace('<head>','<head>\n<base href="/">')}
function injectHead(html,chunk){return html.replace('</head>',`${chunk}\n</head>`)}
function injectBodyEnd(html,chunk){return html.replace('</body>',`${chunk}\n</body>`)}
function transformSource(route,html){
  if(route==='/market/')return injectBodyEnd(html,'<script src="/doing-market-admin-session.js?v=20260826-1"></script>\n<script src="/doing-market-entry-current.js?v=20260825-2"></script>\n<script src="/doing-market-branding-upload.js?v=20260826-1"></script>');
  if(route==='/me/')return injectBodyEnd(html,'<script src="/doing-member-workspace-fix.js?v=20260825-1"></script>');
  return html;
}
function registerTransform(html){return injectHead(withBase(html),'<script src="/doing-market-member-session.js?v=20260826-1"></script>')}
function marketPublicTransform(html){
  let x=withBase(html);
  x=injectHead(x,'<link rel="stylesheet" href="/doing-kawaii-current.css?v=20260825-1">\n<link rel="stylesheet" href="/doing-market-current.css?v=20260825-2">\n<link rel="stylesheet" href="/doing-market-2bl-parity.css?v=20260825-1">\n<script src="/doing-market-member-session.js?v=20260826-1"></script>\n<script src="/doing-market-public-2bl.js?v=20260825-3"></script>');
  x=x.replace('<body class="doing-app doing-register">','<body class="doing-app doing-register market-2bl-front">');
  const tenantGuard="if(!urlTenant)throw new Error('無法辨識主辦空間，請從主辦提供的活動連結進入');";
  const tenantPatch="if(!urlTenant&&document.body.classList.contains('market-2bl-front'))return window.doingMarketGlobalBootstrap();\n    if(!urlTenant)throw new Error('無法辨識主辦空間，請從主辦提供的活動連結進入');";
  const tenantGuardCount=x.split(tenantGuard).length-1;
  if(!tenantGuardCount)throw new Error('market public tenant guard source changed');
  x=x.replaceAll(tenantGuard,tenantPatch);
  const deepLink="if(hit)setTimeout(()=>openSession(hit),50);";
  const deepPatch="if(hit)setTimeout(()=>new URL(location.href).searchParams.get('market_autoreg')==='1'?openRegistration(hit.id):openSession(hit),50);";
  const deepLinkCount=x.split(deepLink).length-1;
  if(!deepLinkCount)throw new Error('market public deep-link source changed');
  x=x.replaceAll(deepLink,deepPatch);
  if((x.split("return window.doingMarketGlobalBootstrap()").length-1)!==tenantGuardCount)throw new Error('market public bootstrap patch count mismatch');
  if((x.split("market_autoreg')==='1'?openRegistration").length-1)!==deepLinkCount)throw new Error('market public deep-link patch count mismatch');
  return x;
}
const transformedRoutes={
  '/market/public/':{source:'register.html',transform:marketPublicTransform},
  '/register/':{source:'register.html',transform:registerTransform},
};
const shellRoutes={
  '/guide/':'DOING Guide',
  '/world-tree/':'DOING World Tree',
};
const legacyRedirects=[
  ['/doing-2.html','/'],['/index.html','/'],['/market-center.html','/market/'],['/market-public.html','/market/public/'],['/market-session.html','/market/session/'],['/project-center.html','/project/'],['/booking-2-center.html','/booking/'],['/booking-center.html','/booking/'],['/guide-center.html','/guide/'],['/workspace.html','/workspace/'],['/member.html','/me/'],['/member-panel.html','/me/'],['/smart-application.html','/apply/'],['/register.html','/register/'],['/admin.html','/market/'],['/onsite.html','/market/'],['/platform.html','/workspace/'],['/operations-center.html','/workspace/'],['/photo.html','/market/'],['/consignment.html','/market/'],['/about.html','/']
];
function routeFile(route){return route==='/'?path.join(out,'index.html'):path.join(out,route.replace(/^\//,''),'index.html')}
function writeRoute(route,html){const file=routeFile(route);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,html,'utf8')}
function shell(route,title){const safe=route.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');return `<!doctype html><html lang="zh-Hant" data-doing-ui-state="rebuild-shell"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${title}</title><style>:root{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;color:#303947;background:#fff9f6}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 10% 10%,#e8f7ff,transparent 32%),radial-gradient(circle at 90% 12%,#ffe7f1,transparent 32%),linear-gradient(135deg,#fff9fb,#fffaf0)}main{width:min(560px,100%);border:3px solid #fff;background:#ffffffdc;padding:34px 28px;border-radius:28px;box-shadow:0 16px 36px rgba(191,176,222,.25)}h1{margin:0 0 12px;font-size:30px;color:#6658bc}p{margin:8px 0;line-height:1.7;color:#65707c;font-weight:700}.route{margin-top:20px;font:12px/1.5 ui-monospace,monospace;color:#85808f}</style></head><body><main><h1>DOING</h1><p>這個操作頁正在重新建置。</p><p>網址、Core、API 與正式資料都已保留。</p><div class="route">${safe}</div></main></body></html>`}

for(const [route,source] of Object.entries(sourceRoutes)){
  const file=path.join(root,source);if(!fs.existsSync(file))throw new Error(`missing source: ${source}`);writeRoute(route,transformSource(route,fs.readFileSync(file,'utf8')));
}
for(const [route,spec] of Object.entries(transformedRoutes)){
  const file=path.join(root,spec.source);if(!fs.existsSync(file))throw new Error(`missing source: ${spec.source}`);writeRoute(route,spec.transform(fs.readFileSync(file,'utf8')));
}
for(const [route,title] of Object.entries(shellRoutes))writeRoute(route,shell(route,title));

for(const asset of ['doing-kawaii-current.css','doing-home-v4.css','doing-home-current.js','doing-logo-current.webp','doing-market-current.css','doing-market-2bl-parity.css','doing-market-entry-current.js','doing-market-public-2bl.js','doing-market-member-session.js','doing-market-admin-session.js','doing-market-branding-upload.js','doing-member-workspace-fix.js','doing-system.css','doing-home-refresh.css','doing-home-refresh.js','doing-design-tokens.css','doing-pastel-pages.css','doing-attribution.js']){
  const src=path.join(root,asset);if(!fs.existsSync(src))throw new Error(`missing asset: ${asset}`);fs.copyFileSync(src,path.join(out,asset));
}

const logoDir=path.join(root,'.assets','doing-logo-new');
const logoParts=['part0.txt','part1.txt','part2.txt','p3c0.txt','p3c1a.txt','p3c1b0a.txt','p3c1b0b0.txt','p3c1b0b1.txt','p3c1b1.txt','p3c2.txt','p3c3.txt','p3c4.txt','part4.txt','part5.txt'];
const logoBase64=logoParts.map(name=>{const p=path.join(logoDir,name);if(!fs.existsSync(p))throw new Error(`missing logo source part: ${p}`);return fs.readFileSync(p,'utf8').trim()}).join('');
const logoBytes=Buffer.from(logoBase64,'base64');
const logoHash=crypto.createHash('sha256').update(logoBytes).digest('hex');
const logoWidth=logoBytes.length>=24?logoBytes.readUInt32BE(16):0;
const logoHeight=logoBytes.length>=24?logoBytes.readUInt32BE(20):0;
const expectedLogoHash='f3db93bf278cc2880e8f863eea97dba20b4d7fb44525ab3d658e2c5362149817';
if(logoBytes.length!==63375||logoBytes[0]!==0x89||logoBytes[1]!==0x50||logoBytes[2]!==0x4e||logoBytes[3]!==0x47||logoWidth!==1056||logoHeight!==412||logoHash!==expectedLogoHash)throw new Error(`invalid DOING logo reconstruction: bytes=${logoBytes.length} size=${logoWidth}x${logoHeight} sha256=${logoHash}`);
fs.writeFileSync(path.join(out,'doing-logo.png'),logoBytes);

fs.writeFileSync(path.join(out,'_headers'),`/*\n  Cache-Control: no-store, max-age=0\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`, 'utf8');
fs.writeFileSync(path.join(out,'_redirects'),legacyRedirects.map(([a,b])=>`${a} ${b} 301`).join('\n')+'\n','utf8');

const allRoutes=[...Object.keys(sourceRoutes),...Object.keys(transformedRoutes),...Object.keys(shellRoutes)];
const expectedHtml=allRoutes.map(r=>path.relative(out,routeFile(r)).replaceAll(path.sep,'/')).sort();
const actualHtml=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const fp=path.join(dir,e.name);if(e.isDirectory())walk(fp);else if(e.name.endsWith('.html'))actualHtml.push(path.relative(out,fp).replaceAll(path.sep,'/'))}}walk(out);actualHtml.sort();
if(JSON.stringify(actualHtml)!==JSON.stringify(expectedHtml))throw new Error(`unexpected html: ${JSON.stringify(actualHtml)}`);

for(const route of Object.keys(shellRoutes)){
  const html=fs.readFileSync(routeFile(route),'utf8');
  if(!html.includes('data-doing-ui-state="rebuild-shell"'))throw new Error(`shell marker missing: ${route}`);
  for(const bad of ['<script','<form','<button','tobeloved-api','supabase.co','localStorage','sessionStorage','2bl-v7'])if(html.includes(bad))throw new Error(`old interactive content leaked: ${route} -> ${bad}`);
}
for(const route of [...Object.keys(sourceRoutes),...Object.keys(transformedRoutes)]){
  const html=fs.readFileSync(routeFile(route),'utf8');
  if(html.includes('2bl-v7')||html.includes('supabase.co'))throw new Error(`forbidden direct dependency: ${route}`);
  if(route==='/'&&!html.includes('doing-home-v4.css'))throw new Error(`homepage visual missing: ${route}`);
}
for(const route of ['/market/','/market/session/','/market/public/']){const html=fs.readFileSync(routeFile(route),'utf8');if(!html.includes('doing-market-current.css'))throw new Error(`market visual missing: ${route}`)}
const market=fs.readFileSync(path.join(out,'market/index.html'),'utf8');for(const token of ['getSessionsAdmin','getTodos','getMembers','financeOverview','/market/session/','doing-market-entry-current.js','doing-market-admin-session.js','doing-market-branding-upload.js'])if(!market.includes(token))throw new Error(`market admin contract missing: ${token}`);
for(const token of ['uploadCover','saveSiteConfig','brandLogoUpload','DOING_RESIZE_LOGO_FOR_TEST'])if(!fs.readFileSync(path.join(out,'doing-market-branding-upload.js'),'utf8').includes(token))throw new Error(`market logo upload contract missing: ${token}`);
const marketPublic=fs.readFileSync(path.join(out,'market/public/index.html'),'utf8');for(const token of ['frontBootstrap','openRegistration','bottom-nav','market-2bl-front','doing-market-public-2bl.js','doing-market-member-session.js','doing-market-2bl-parity.css','getMyRegs','register'])if(!marketPublic.includes(token))throw new Error(`market public contract missing: ${token}`);if(marketPublic.includes('registerUrl(')||marketPublic.includes('href="/register/'))throw new Error('market public regressed to second registration page');const marketPublicUx=fs.readFileSync(path.join(out,'doing-market-public-2bl.js'),'utf8');for(const token of ['doingMarketGlobalBootstrap','publicDiscovery','/market/public/','立即報名','getConsignmentPeriodsPublic','applyConsignment','marketPortal'])if(!marketPublicUx.includes(token))throw new Error(`market public UX contract missing: ${token}`);const memberSession=fs.readFileSync(path.join(out,'doing-market-member-session.js'),'utf8');for(const token of ['doingMemberToken','doingRequireMember','getPlatformMemberProfile','localStorage'])if(!memberSession.includes(token))throw new Error(`member session contract missing: ${token}`);if(!fs.existsSync(path.join(out,'doing-market-2bl-parity.css')))throw new Error('market 2BL parity stylesheet missing');
const marketSession=fs.readFileSync(path.join(out,'market/session/index.html'),'utf8');for(const token of ['getSessionRegistrations','updateRegStatus','confirmPayment','adminSeatBoard','adminAssignSeat','adminUnassignSeat','runBatchAssign','getSessionEquipmentDetails','sendNotify','sendPaymentReminder','checkin','getRefundSuggestion','confirmRefund','financeReport','updateSession'])if(!marketSession.includes(token))throw new Error(`market session contract missing: ${token}`);
const register=fs.readFileSync(path.join(out,'register/index.html'),'utf8');for(const token of ['<base href="/">','tobeloved-api','member_token','register','付款回報','doing-market-member-session.js'])if(!register.includes(token))throw new Error(`register contract missing: ${token}`);if(register.includes('data-doing-ui-state="rebuild-shell"'))throw new Error('register route regressed to rebuild shell');
const home=fs.readFileSync(path.join(out,'index.html'),'utf8');for(const token of ['市集活動系統','室內設計進度系統','美類預約系統','斜槓人生小幫手','申請市集活動系統','申請室內設計系統','申請美類預約系統','/apply/?system=market','/apply/?system=project','/apply/?system=booking','/me/','doing-home-v4.css'])if(!home.includes(token))throw new Error(`home contract missing: ${token}`);
for(const removed of ['doingSearch','jelly-search','搜尋市集、工程進度、美類預約','benefit-grid','benefit-card','系統亮點','看圖就知道 DOING 幫你省掉哪些麻煩','audience-strip','audience-card','一個帳號，多種身分','共用同一','資料只留一份','需要什麼再加什麼','手機與電腦同一套'])if(home.includes(removed))throw new Error(`private/removed homepage copy leaked: ${removed}`);
const member=fs.readFileSync(path.join(out,'me/index.html'),'utf8');for(const token of ['auth/line/start','getPlatformMemberProfile','createMemberWorkspaceAdminSession','doing-member-workspace-fix.js'])if(!member.includes(token))throw new Error(`member auth contract missing: ${token}`);
const apply=fs.readFileSync(path.join(out,'apply/index.html'),'utf8');for(const token of ['data-system="market"','data-system="project"','data-system="booking"','createOrganizerApplicationDraft','auth/line/start','createMemberWorkspaceAdminSession','/market/','/project/','/booking/'])if(!apply.includes(token))throw new Error(`application contract missing: ${token}`);if(apply.includes('data-doing-ui-state="rebuild-shell"'))throw new Error('application route regressed to rebuild shell');
const workspace=fs.readFileSync(path.join(out,'workspace/index.html'),'utf8');for(const token of ['getTenantModuleProfile','adminMe','市集活動系統','室內設計系統','美類預約系統'])if(!workspace.includes(token))throw new Error(`workspace contract missing: ${token}`);

console.log(JSON.stringify({result:'PASS',mode:'market-remembered-auth-logo-upload',routeCount:allRoutes.length,liveRoutes:[...Object.keys(sourceRoutes),...Object.keys(transformedRoutes)],shellRoutes:Object.keys(shellRoutes),marketEntries:['/market/public/','/market/'],marketPublicSinglePage:true,marketRegistrationInline:true,marketRememberedMemberLogin:true,marketRememberedAdminSession:true,marketLogoUploadOnly:true,marketLogoAutoResize:true,market2blLayoutParity:true,consignmentCoreBacked:true,legacyRegisterInternal:true,databaseWrites:0,workerChangeScope:'none',twoBlChanges:0,logo:{bytes:logoBytes.length,width:logoWidth,height:logoHeight,sha256:logoHash}},null,2));