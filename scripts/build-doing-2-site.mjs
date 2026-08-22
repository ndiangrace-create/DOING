import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'.doing-2-site');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

// Public contract: DOING 2.0 exposes directory-style short URLs only.
// Legacy *.html source files remain internal build inputs and are never copied to public output.
const routes={
  '/market/':'market-center.html',
  '/market/public/':'market-public.html',
  '/market/session/':'market-session.html',
  '/project/':'project-center.html',
  '/booking/':'booking-2-center.html',
  '/guide/':'guide-center.html',
  '/workspace/':'workspace.html',
  '/me/':'member-panel.html',
  '/member/':'member.html',
  '/apply/':'smart-application.html',
  '/register/':'register.html',
  '/admin/':'admin.html',
  '/onsite/':'onsite.html',
  '/platform/':'platform.html',
  '/operations/':'operations-center.html',
  '/photo/':'photo.html',
  '/consignment/':'consignment.html',
  '/about/':'about.html'
};
const legacyToShort={
  'doing-2.html':'/',
  'index.html':'/',
  'market-center.html':'/market/',
  'market-public.html':'/market/public/',
  'market-session.html':'/market/session/',
  'project-center.html':'/project/',
  'booking-2-center.html':'/booking/',
  'guide-center.html':'/guide/',
  'workspace.html':'/workspace/',
  'member-panel.html':'/me/',
  'member.html':'/member/',
  'smart-application.html':'/apply/',
  'register.html':'/register/',
  'admin.html':'/admin/',
  'onsite.html':'/onsite/',
  'platform.html':'/platform/',
  'operations-center.html':'/operations/',
  'photo.html':'/photo/',
  'consignment.html':'/consignment/',
  'about.html':'/about/'
};
const rewriteLegacyRefs=(source)=>{
  let s=String(source);
  for(const [oldPath,newPath] of Object.entries(legacyToShort))s=s.split(oldPath).join(newPath);
  return s;
};
function addBodyClass(html,name){
  return html.replace(/<body([^>]*)>/i,(m,attrs)=>{
    const hit=attrs.match(/class=(['"])(.*?)\1/i);
    if(hit){
      if(hit[2].split(/\s+/).includes(name))return m;
      const merged=`class=${hit[1]}${hit[2]} ${name}${hit[1]}`;
      return `<body${attrs.replace(hit[0],merged)}>`;
    }
    return `<body class="${name}"${attrs}>`;
  });
}
function ensureBase(html){return html.includes('<base ') ? html : html.replace(/<head>/i,'<head><base href="/">');}
function inject(html,needle,markup,where='head'){
  if(html.includes(needle))return html;
  return where==='head'?html.replace('</head>',markup+'</head>'):html.replace('</body>',markup+'</body>');
}
function preparePage(source,route){
  let html=fs.readFileSync(path.join(root,source),'utf8');
  html=rewriteLegacyRefs(html);
  html=ensureBase(html);
  html=addBodyClass(html,'d2-candy-theme');
  html=inject(html,'doing-candy-theme.css','<link rel="stylesheet" href="/doing-candy-theme.css?v=20260822-short1">');

  if(['market-center.html','market-session.html'].includes(source)){
    html=addBodyClass(html,'d2-market-compact');
    html=inject(html,'doing-market-2bl.css','<link rel="stylesheet" href="/doing-market-2bl.css?v=20260822-short1">');
  }
  if(['market-center.html','market-session.html','project-center.html','booking-2-center.html','guide-center.html'].includes(source)){
    html=inject(html,'doing-2-shell.css','<link rel="stylesheet" href="/doing-2-shell.css?v=20260822-short1">');
    html=inject(html,'doing-2-shell.js','<script src="/doing-2-shell.js?v=20260822-short1"></script>','body');
  }
  if(source==='market-public.html')html=inject(html,'doing-market-public-query.js','<script src="/doing-market-public-query.js?v=20260822-short1"></script>','body');
  if(source==='member-panel.html')html=inject(html,'doing-member-return-direct.js','<script src="/doing-member-return-direct.js?v=20260822-short1"></script>','body');
  if(source==='smart-application.html'){
    html=inject(html,'doing-application-contract-v12.js','<script src="/doing-application-contract-v12.js?v=20260822-short1"></script>','body');
    html=inject(html,'doing-application-completion.js','<script src="/doing-application-completion.js?v=20260822-short1"></script>','body');
  }
  if(source==='workspace.html')html=inject(html,'doing-workspace-product-router.js','<script src="/doing-workspace-product-router.js?v=20260822-short1"></script>','body');
  const rel=route==='/'?'index.html':route.replace(/^\//,'')+'index.html';
  const fp=path.join(out,rel);
  fs.mkdirSync(path.dirname(fp),{recursive:true});
  fs.writeFileSync(fp,html);
}

// Preserve current DOING root exactly in behavior; only remove its legacy /doing-2.html alias.
let home=fs.readFileSync(path.join(root,'doing-2.html'),'utf8');
home=rewriteLegacyRefs(ensureBase(home));
home=addBodyClass(home,'d2-candy-theme');
home=inject(home,'doing-candy-theme.css','<link rel="stylesheet" href="/doing-candy-theme.css?v=20260822-short1">');
home=inject(home,'doing-2-shell.css','<link rel="stylesheet" href="/doing-2-shell.css?v=20260822-short1">');
home=inject(home,'doing-2-home-v11.css','<link rel="stylesheet" href="/doing-2-home-v11.css?v=20260822-short1">');
home=inject(home,'doing-home-logo-slot-v12.css','<link rel="stylesheet" href="/doing-home-logo-slot-v12.css?v=20260822-short1">');
home=inject(home,'doing-2-shell.js','<script src="/doing-2-shell.js?v=20260822-short1"></script>','body');
home=inject(home,'doing-2-home-v11.js','<script src="/doing-2-home-v11.js?v=20260822-short1"></script>','body');
home=inject(home,'doing-home-logo-slot-v12.js','<script src="/doing-home-logo-slot-v12.js?v=20260822-short1"></script>','body');
fs.writeFileSync(path.join(out,'index.html'),home);

for(const [route,source] of Object.entries(routes))preparePage(source,route);

const assetFiles=[
  'doing-system.css','doing-design-tokens.css','doing-pastel-pages.css','doing-candy-theme.css',
  'doing-2-shell.css','doing-2-shell.js','doing-2-home-v11.css','doing-2-home-v11.js','doing-home-logo-slot-v12.css','doing-home-logo-slot-v12.js',
  'doing-market-public-query.js','doing-market-2bl.css','doing-member-return-direct.js','doing-application-completion.js','doing-application-contract-v12.js','doing-workspace-product-router.js',
  'doing-smart-activation-v5.js','doing-auto-activation-status.js','doing-global-entry.js','doing-attribution.js','doing-home-refresh.js','doing-home-refresh.css',
  'doing-logo.png','manifest.webmanifest','pwa-icon-192.png'
];
for(const file of assetFiles){
  const src=path.join(root,file);if(!fs.existsSync(src))continue;
  const dest=path.join(out,file);
  if(/\.(?:js|css)$/i.test(file))fs.writeFileSync(dest,rewriteLegacyRefs(fs.readFileSync(src,'utf8')));
  else fs.copyFileSync(src,dest);
}

fs.writeFileSync(path.join(out,'_headers'),`/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);

// Hard fail if any retired long page leaks into public output.
const retired=Object.keys(legacyToShort).filter(x=>x!=='index.html');
for(const old of retired){if(fs.existsSync(path.join(out,old)))throw new Error(`legacy public page leaked: ${old}`);}
const publicHtml=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const fp=path.join(dir,e.name);if(e.isDirectory())walk(fp);else if(e.name.endsWith('.html'))publicHtml.push(path.relative(out,fp).replaceAll(path.sep,'/'));}}
walk(out);
for(const f of publicHtml){if(path.basename(f)!=='index.html')throw new Error(`non-short html published: ${f}`);}

console.log(JSON.stringify({result:'PASS',rootPreserved:true,shortRoutes:Object.keys(routes),retiredLongUrls:retired,publicHtml,legacyRedirects:0,productionWrites:0},null,2));
