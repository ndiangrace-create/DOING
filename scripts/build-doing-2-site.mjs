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
  '/market/public/':'market-public-current.html',
  '/market/session/':'market-session-current.html',
  '/project/':'project-current.html',
  '/booking/':'booking-current.html',
  '/workspace/':'workspace-current.html',
  '/me/':'member-current.html',
};
const shellRoutes={
  '/guide/':'DOING Guide',
  '/apply/':'DOING Apply',
  '/register/':'DOING Register',
  '/world-tree/':'DOING World Tree',
};
const legacyRedirects=[
  ['/doing-2.html','/'],['/index.html','/'],['/market-center.html','/market/'],['/market-public.html','/market/public/'],['/market-session.html','/market/session/'],['/project-center.html','/project/'],['/booking-2-center.html','/booking/'],['/booking-center.html','/booking/'],['/guide-center.html','/guide/'],['/workspace.html','/workspace/'],['/member.html','/me/'],['/member-panel.html','/me/'],['/smart-application.html','/apply/'],['/register.html','/register/'],['/admin.html','/market/'],['/onsite.html','/market/'],['/platform.html','/workspace/'],['/operations-center.html','/workspace/'],['/photo.html','/market/'],['/consignment.html','/market/'],['/about.html','/']
];
function routeFile(route){return route==='/'?path.join(out,'index.html'):path.join(out,route.replace(/^\//,''),'index.html')}
function writeRoute(route,html){const file=routeFile(route);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,html,'utf8')}
function shell(route,title){const safe=route.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');return `<!doctype html><html lang="zh-Hant" data-doing-ui-state="rebuild-shell"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${title}</title><style>:root{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;color:#303947;background:#fff9f6}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 10% 10%,#e8f7ff,transparent 32%),radial-gradient(circle at 90% 12%,#ffe7f1,transparent 32%),linear-gradient(135deg,#fff9fb,#fffaf0)}main{width:min(560px,100%);border:3px solid #fff;background:#ffffffdc;padding:34px 28px;border-radius:28px;box-shadow:0 16px 36px rgba(191,176,222,.25)}h1{margin:0 0 12px;font-size:30px;color:#6658bc}p{margin:8px 0;line-height:1.7;color:#65707c;font-weight:700}.route{margin-top:20px;font:12px/1.5 ui-monospace,monospace;color:#85808f}</style></head><body><main><h1>DOING</h1><p>這個操作頁正在重新建置。</p><p>網址、Core、API 與正式資料都已保留。</p><div class="route">${safe}</div></main></body></html>`}

for(const [route,source] of Object.entries(sourceRoutes)){
  const file=path.join(root,source);if(!fs.existsSync(file))throw new Error(`missing source: ${source}`);writeRoute(route,fs.readFileSync(file,'utf8'));
}
for(const [route,title] of Object.entries(shellRoutes))writeRoute(route,shell(route,title));

for(const asset of ['doing-kawaii-current.css','doing-home-v4.css','doing-home-current.js','doing-logo-current.webp','doing-market-current.css']){
  const src=path.join(root,asset);if(!fs.existsSync(src))throw new Error(`missing asset: ${asset}`);fs.copyFileSync(src,path.join(out,asset));
}

const logoDir=path.join(root,'.assets','doing-logo-new');
const logoParts=['part0.txt','part1.txt','part2.txt','p3c0.txt','p3c1a.txt','p3c1b0a.txt','p3c1b0b0.txt','p3c1b0b1.txt','p3c1b1.txt','p3c2.txt','p3c3.txt','p3c4.txt','part4.txt','part5.txt'];
const logoBase64=logoParts.map(name=>{
  const p=path.join(logoDir,name);
  if(!fs.existsSync(p))throw new Error(`missing logo source part: ${p}`);
  return fs.readFileSync(p,'utf8').trim();
}).join('');
const logoBytes=Buffer.from(logoBase64,'base64');
const logoHash=crypto.createHash('sha256').update(logoBytes).digest('hex');
const logoWidth=logoBytes.length>=24?logoBytes.readUInt32BE(16):0;
const logoHeight=logoBytes.length>=24?logoBytes.readUInt32BE(20):0;
const expectedLogoHash='f3db93bf278cc2880e8f863eea97dba20b4d7fb44525ab3d658e2c5362149817';
if(logoBytes.length!==63375||logoBytes[0]!==0x89||logoBytes[1]!==0x50||logoBytes[2]!==0x4e||logoBytes[3]!==0x47||logoWidth!==1056||logoHeight!==412||logoHash!==expectedLogoHash)throw new Error(`invalid DOING logo reconstruction: bytes=${logoBytes.length} size=${logoWidth}x${logoHeight} sha256=${logoHash}`);
fs.writeFileSync(path.join(out,'doing-logo.png'),logoBytes);

fs.writeFileSync(path.join(out,'_headers'),`/*\n  Cache-Control: no-store, max-age=0\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`, 'utf8');
fs.writeFileSync(path.join(out,'_redirects'),legacyRedirects.map(([a,b])=>`${a} ${b} 301`).join('\n')+'\n','utf8');

const allRoutes=[...Object.keys(sourceRoutes),...Object.keys(shellRoutes)];
const expectedHtml=allRoutes.map(r=>path.relative(out,routeFile(r)).replaceAll(path.sep,'/')).sort();
const actualHtml=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const fp=path.join(dir,e.name);if(e.isDirectory())walk(fp);else if(e.name.endsWith('.html'))actualHtml.push(path.relative(out,fp).replaceAll(path.sep,'/'))}}walk(out);actualHtml.sort();
if(JSON.stringify(actualHtml)!==JSON.stringify(expectedHtml))throw new Error(`unexpected html: ${JSON.stringify(actualHtml)}`);

for(const route of Object.keys(shellRoutes)){
  const html=fs.readFileSync(routeFile(route),'utf8');
  if(!html.includes('data-doing-ui-state="rebuild-shell"'))throw new Error(`shell marker missing: ${route}`);
  for(const bad of ['<script','<form','<button','tobeloved-api','supabase.co','localStorage','sessionStorage','2bl-v7'])if(html.includes(bad))throw new Error(`old interactive content leaked: ${route} -> ${bad}`);
}
for(const route of Object.keys(sourceRoutes)){
  const html=fs.readFileSync(routeFile(route),'utf8');
  if(html.includes('2bl-v7')||html.includes('supabase.co'))throw new Error(`forbidden direct dependency: ${route}`);
  if(route==='/'&&!html.includes('doing-home-v4.css'))throw new Error(`homepage visual missing: ${route}`);
  if(route!=='/'&&!html.includes('doing-kawaii-current.css'))throw new Error(`kawaii visual missing: ${route}`);
  if(route.startsWith('/market')&&!html.includes('doing-market-current.css'))throw new Error(`market CURRENT visual missing: ${route}`);
}
const home=fs.readFileSync(path.join(out,'index.html'),'utf8');
for(const token of ['市集活動系統','室內設計進度系統','美類預約系統','斜槓人生小幫手','申請市集活動系統','申請室內設計系統','申請美類預約系統','/me/','/apply/','doing-home-v4.css'])if(!home.includes(token))throw new Error(`home contract missing: ${token}`);
for(const removed of ['doingSearch','jelly-search','搜尋市集、工程進度、美類預約','benefit-grid','benefit-card','系統亮點','看圖就知道 DOING 幫你省掉哪些麻煩','audience-strip','audience-card','一個帳號，多種身分','共用同一','資料只留一份','需要什麼再加什麼','手機與電腦同一套'])if(home.includes(removed))throw new Error(`private/removed homepage copy leaked: ${removed}`);
const member=fs.readFileSync(path.join(out,'me/index.html'),'utf8');for(const token of ['auth/line/start','getPlatformMemberProfile','createMemberWorkspaceAdminSession'])if(!member.includes(token))throw new Error(`member auth contract missing: ${token}`);
const workspace=fs.readFileSync(path.join(out,'workspace/index.html'),'utf8');for(const token of ['getTenantModuleProfile','adminMe','市集活動系統','室內設計系統','美類預約系統'])if(!workspace.includes(token))throw new Error(`workspace contract missing: ${token}`);
const market=fs.readFileSync(path.join(out,'market/index.html'),'utf8');for(const token of ['getSessionsAdmin','getTodos','getMembers','getSessionRegistrations','checkin','createSession','saveSiteConfig','場次','待辦','現場','會員','活動','財務','寄賣','設定'])if(!market.includes(token))throw new Error(`market organizer contract missing: ${token}`);
const marketPublic=fs.readFileSync(path.join(out,'market/public/index.html'),'utf8');for(const token of ['publicDiscovery','getSiteConfig','/register/','getPlatformMemberProfile','getMyRegsGlobal','savePlatformMemberProfile','auth/line/start'])if(!marketPublic.includes(token))throw new Error(`market public contract missing: ${token}`);
const marketSession=fs.readFileSync(path.join(out,'market/session/index.html'),'utf8');for(const token of ['getSessionDashboard','getSessionRegistrations','approveReg','confirmPayment','sendPaymentReminder','adminSeatBoard','adminAssignSeat','getAnnouncements','saveAnnouncement','checkin','getRefundSuggestion','confirmRefund','getOperationalCloseout','updateSession','overview','registrations','payments','seat','notice','onsite','closeout','settings'])if(!marketSession.includes(token))throw new Error(`market session contract missing: ${token}`);

console.log(JSON.stringify({result:'PASS',mode:'market-current-operations',routeCount:allRoutes.length,liveRoutes:Object.keys(sourceRoutes),shellRoutes:Object.keys(shellRoutes),tenantLogin:true,homepageSearch:false,tagline:'斜槓人生小幫手',publicSystemsOnly:true,publicSystemCount:3,market:{organizer:true,public:true,session:true,sessionTabs:8},logo:{bytes:logoBytes.length,width:logoWidth,height:logoHeight,sha256:logoHash},databaseWrites:0,workerChanges:0,twoBlChanges:0},null,2));
