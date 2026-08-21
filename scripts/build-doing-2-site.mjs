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
  'doing-system.css','doing-design-tokens.css','doing-pastel-pages.css',
  'doing-2-shell.css','doing-2-shell.js','doing-market-2bl.css',
  'doing-member-return-direct.js','doing-application-completion.js','doing-workspace-product-router.js',
  'doing-smart-activation.js','doing-smart-result-visual.js','doing-auto-activation-status.js','doing-global-entry.js',
  'doing-logo.png','doing-attribution.js','doing-home-refresh.js','doing-home-refresh.css',
  'manifest.webmanifest','pwa-icon-192.png'
];
for(const file of copyFiles){
  const src=path.join(root,file);
  if(fs.existsSync(src))fs.copyFileSync(src,path.join(out,file));
}

const shellTargets=[
  'doing-2.html','market-center.html','market-session.html',
  'project-center.html','booking-2-center.html','guide-center.html'
];
const injectShell=(file)=>{
  const fp=path.join(out,file);if(!fs.existsSync(fp))return;
  let html=fs.readFileSync(fp,'utf8');
  if(!html.includes('doing-2-shell.css'))html=html.replace('</head>','<link rel="stylesheet" href="/doing-2-shell.css?v=20260822-2blux"></head>');
  if(!html.includes('doing-2-shell.js'))html=html.replace('</body>','<script src="/doing-2-shell.js?v=20260822-2blux"></script></body>');
  fs.writeFileSync(fp,html);
};
shellTargets.forEach(injectShell);

// Market 只套自己的 2BL 緊縮營運外框；不修改 Hub／Project／Booking／Guide。
for(const file of ['market-center.html','market-session.html']){
  const fp=path.join(out,file);if(!fs.existsSync(fp))continue;
  let html=fs.readFileSync(fp,'utf8');
  if(!html.includes('doing-market-2bl.css'))html=html.replace('</head>','<link rel="stylesheet" href="/doing-market-2bl.css?v=20260822-compact1"></head>');
  html=html.replace('<body>','<body class="d2-market-compact">');
  fs.writeFileSync(fp,html);
}

// 會員中心單一登入：未登入直接 LINE OAuth，成功後回原 member-panel 分頁，不繞首頁。
{
  const fp=path.join(out,'member-panel.html');
  if(fs.existsSync(fp)){
    let html=fs.readFileSync(fp,'utf8');
    if(!html.includes('doing-member-return-direct.js'))html=html.replace('</body>','<script src="/doing-member-return-direct.js?v=20260822-direct-return2"></script></body>');
    fs.writeFileSync(fp,html);
  }
}

// 正式營運申請：LINE 驗證 → DB 自動開通 → 自動完成會員 session → 回我的 DOING。
{
  const fp=path.join(out,'smart-application.html');
  if(fs.existsSync(fp)){
    let html=fs.readFileSync(fp,'utf8');
    if(!html.includes('doing-application-completion.js'))html=html.replace('</body>','<script src="/doing-application-completion.js?v=20260822-application-flow1"></script></body>');
    fs.writeFileSync(fp,html);
  }
}

// 工作空間進入市集時使用 DOING Market 2.0，不再掉回舊 admin#sessions。
{
  const fp=path.join(out,'workspace.html');
  if(fs.existsSync(fp)){
    let html=fs.readFileSync(fp,'utf8');
    if(!html.includes('doing-workspace-product-router.js'))html=html.replace('</body>','<script src="/doing-workspace-product-router.js?v=20260822-product-router1"></script></body>');
    fs.writeFileSync(fp,html);
  }
}

// doing.2b-love.com 根目錄固定使用 DOING 2.0 Hub；不修改 Repo 原本 index.html。
fs.copyFileSync(path.join(out,'doing-2.html'),path.join(out,'index.html'));

const routeMap={
  'market/index.html':'market-center.html',
  'market/public/index.html':'market-public.html',
  'market/session/index.html':'market-session.html',
  'project/index.html':'project-center.html',
  'booking/index.html':'booking-2-center.html',
  'guide/index.html':'guide-center.html'
};
const redirect=(target)=>`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>const u=new URL('${target}',location.href);u.search=location.search;u.hash=location.hash;location.replace(u.toString());<\/script></head><body></body></html>`;
for(const [rel,targetFile] of Object.entries(routeMap)){
  const dir=path.dirname(path.join(out,rel));
  fs.mkdirSync(dir,{recursive:true});
  const depth=rel.split('/').length-1;
  const prefix='../'.repeat(depth);
  fs.writeFileSync(path.join(out,rel),redirect(prefix+targetFile));
}

fs.writeFileSync(path.join(out,'_headers'),`/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
console.log(JSON.stringify({
  result:'PASS',output:'.doing-2-site',root:'doing-2.html',routes:Object.keys(routeMap),shell:shellTargets,
  marketCompact:['market-center.html','market-session.html'],memberDirectReturn:true,
  applicationFlow:true,workspaceMarketRouter:true
},null,2));
