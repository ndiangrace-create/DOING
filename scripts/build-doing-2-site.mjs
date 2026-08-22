import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'.doing-2-site');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

const copyFiles=[
  'doing-2.html','market-center.html','market-public.html','market-session.html',
  'project-center.html','booking-2-center.html','guide-center.html',
  'smart-application.html','workspace.html','member.html','member-panel.html','about.html',
  'admin.html','onsite.html','index.html','register.html',
  'doing-system.css','doing-design-tokens.css','doing-pastel-pages.css','doing-candy-theme.css',
  'doing-2-shell.css','doing-2-shell.js','doing-2-home-v11.css','doing-2-home-v11.js','doing-market-public-query.js','doing-market-2bl.css',
  'doing-member-return-direct.js','doing-application-completion.js','doing-workspace-product-router.js',
  'doing-smart-activation-v5.js','doing-auto-activation-status.js','doing-global-entry.js',
  'doing-logo.png','doing-attribution.js','doing-home-refresh.js','doing-home-refresh.css',
  'manifest.webmanifest','pwa-icon-192.png'
];
for(const file of copyFiles){const src=path.join(root,file);if(fs.existsSync(src))fs.copyFileSync(src,path.join(out,file));}

const shellTargets=['doing-2.html','market-center.html','market-session.html','project-center.html','booking-2-center.html','guide-center.html'];
const injectShell=(file)=>{const fp=path.join(out,file);if(!fs.existsSync(fp))return;let html=fs.readFileSync(fp,'utf8');if(!html.includes('doing-2-shell.css'))html=html.replace('</head>','<link rel="stylesheet" href="/doing-2-shell.css?v=20260822-2blux"></head>');if(!html.includes('doing-2-shell.js'))html=html.replace('</body>','<script src="/doing-2-shell.js?v=20260822-2blux"></script></body>');fs.writeFileSync(fp,html);};
shellTargets.forEach(injectShell);

function addBodyClass(html,name){return html.replace(/<body([^>]*)>/i,(m,attrs)=>{const hit=attrs.match(/class=(['"])(.*?)\1/i);if(hit){if(hit[2].split(/\s+/).includes(name))return m;const merged=`class=${hit[1]}${hit[2]} ${name}${hit[1]}`;return `<body${attrs.replace(hit[0],merged)}>`;}return `<body class="${name}"${attrs}>`;});}
const candyTargets=['doing-2.html','market-center.html','market-public.html','market-session.html','project-center.html','booking-2-center.html','guide-center.html','smart-application.html','workspace.html','member-panel.html','register.html'];
for(const file of candyTargets){const fp=path.join(out,file);if(!fs.existsSync(fp))continue;let html=fs.readFileSync(fp,'utf8');if(!html.includes('doing-candy-theme.css'))html=html.replace('</head>','<link rel="stylesheet" href="/doing-candy-theme.css?v=20260822-candy1"></head>');html=addBodyClass(html,'d2-candy-theme');fs.writeFileSync(fp,html);}

{
  const fp=path.join(out,'doing-2.html');let html=fs.readFileSync(fp,'utf8');if(!html.includes('doing-2-home-v11.css'))html=html.replace('</head>','<link rel="stylesheet" href="/doing-2-home-v11.css?v=20260822-v11home2"></head>');if(!html.includes('doing-2-home-v11.js'))html=html.replace('</body>','<script src="/doing-2-home-v11.js?v=20260822-v11home2"></script></body>');fs.writeFileSync(fp,html);
}
{
  const fp=path.join(out,'market-public.html');if(fs.existsSync(fp)){let html=fs.readFileSync(fp,'utf8');if(!html.includes('doing-market-public-query.js'))html=html.replace('</body>','<script src="/doing-market-public-query.js?v=20260822-home-search"></script></body>');fs.writeFileSync(fp,html);}
}
for(const file of ['market-center.html','market-session.html']){const fp=path.join(out,file);if(!fs.existsSync(fp))continue;let html=fs.readFileSync(fp,'utf8');html=addBodyClass(html,'d2-market-compact');if(!html.includes('doing-market-2bl.css'))html=html.replace('</head>','<link rel="stylesheet" href="/doing-market-2bl.css?v=20260822-compact1"></head>');fs.writeFileSync(fp,html);}
{
  const fp=path.join(out,'member-panel.html');if(fs.existsSync(fp)){let html=fs.readFileSync(fp,'utf8');if(!html.includes('doing-member-return-direct.js'))html=html.replace('</body>','<script src="/doing-member-return-direct.js?v=20260822-direct-return2"></script></body>');fs.writeFileSync(fp,html);}
}
{
  const fp=path.join(out,'smart-application.html');if(fs.existsSync(fp)){let html=fs.readFileSync(fp,'utf8');if(!html.includes('doing-application-completion.js'))html=html.replace('</body>','<script src="/doing-application-completion.js?v=20260822-application-flow1"></script></body>');fs.writeFileSync(fp,html);}
}
{
  const fp=path.join(out,'workspace.html');if(fs.existsSync(fp)){let html=fs.readFileSync(fp,'utf8');if(!html.includes('doing-workspace-product-router.js'))html=html.replace('</body>','<script src="/doing-workspace-product-router.js?v=20260822-product-router1"></script></body>');fs.writeFileSync(fp,html);}
}

fs.copyFileSync(path.join(out,'doing-2.html'),path.join(out,'index.html'));
const routeMap={'market/index.html':'market-center.html','market/public/index.html':'market-public.html','market/session/index.html':'market-session.html','project/index.html':'project-center.html','booking/index.html':'booking-2-center.html','guide/index.html':'guide-center.html'};
const redirect=(target)=>`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>const u=new URL('${target}',location.href);u.search=location.search;u.hash=location.hash;location.replace(u.toString());<\/script></head><body></body></html>`;
for(const [rel,targetFile] of Object.entries(routeMap)){const dir=path.dirname(path.join(out,rel));fs.mkdirSync(dir,{recursive:true});const depth=rel.split('/').length-1,prefix='../'.repeat(depth);fs.writeFileSync(path.join(out,rel),redirect(prefix+targetFile));}
fs.writeFileSync(path.join(out,'_headers'),`/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
console.log(JSON.stringify({result:'PASS',output:'.doing-2-site',root:'doing-2.html',routes:Object.keys(routeMap),shell:shellTargets,candyTheme:candyTargets,homeV11:true,homeLiveCards:true,homeSearchToMarket:true,marketCompact:['market-center.html','market-session.html'],memberDirectReturn:true,applicationFlow:true,applicationFixedProducts:'v5',workspaceMarketRouter:true},null,2));
