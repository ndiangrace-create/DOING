import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'.doing-2-site');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

const sourceRoutes={
  '/':'home-current.html',
  '/market/':'market-current.html',
  '/project/':'project-current.html',
  '/booking/':'booking-current.html',
  '/workspace/':'workspace-current.html',
  '/me/':'member-current.html',
};
const shellRoutes={
  '/market/public/':'DOING Market Public',
  '/market/session/':'DOING Market Session',
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

for(const asset of ['doing-kawaii-current.css','doing-home-current.js','doing-logo.png']){
  const src=path.join(root,asset);if(!fs.existsSync(src))throw new Error(`missing asset: ${asset}`);fs.copyFileSync(src,path.join(out,asset));
}

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
  if(!html.includes('doing-kawaii-current.css'))throw new Error(`kawaii visual missing: ${route}`);
}
const home=fs.readFileSync(path.join(out,'index.html'),'utf8');
for(const token of ['市集活動','室內設計進度','美類預約','/me/','/apply/','doingSearch'])if(!home.includes(token))throw new Error(`home contract missing: ${token}`);
const member=fs.readFileSync(path.join(out,'me/index.html'),'utf8');for(const token of ['auth/line/start','getPlatformMemberProfile','createMemberWorkspaceAdminSession'])if(!member.includes(token))throw new Error(`member auth contract missing: ${token}`);
const workspace=fs.readFileSync(path.join(out,'workspace/index.html'),'utf8');for(const token of ['getTenantModuleProfile','adminMe','市集活動系統','室內設計系統','美類預約系統'])if(!workspace.includes(token))throw new Error(`workspace contract missing: ${token}`);

console.log(JSON.stringify({result:'PASS',mode:'kawaii-home-v1',routeCount:allRoutes.length,liveRoutes:Object.keys(sourceRoutes),shellRoutes:Object.keys(shellRoutes),tenantLogin:true,systemCategories:['market-activity','interior-project','beauty-booking'],databaseWrites:0,workerChanges:0,twoBlChanges:0},null,2));
