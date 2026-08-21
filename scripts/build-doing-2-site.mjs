import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'.doing-2-site');
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

const copyFiles=[
  'doing-2.html','market-center.html','market-public.html','market-session.html',
  'project-center.html','booking-2-center.html','guide-center.html',
  'admin.html','onsite.html','member-panel.html','index.html','register.html',
  'doing-system.css','doing-logo.png','doing-attribution.js','doing-home-refresh.js','doing-home-refresh.css',
  'manifest.webmanifest','pwa-icon-192.png'
];
for(const file of copyFiles){
  const src=path.join(root,file);
  if(fs.existsSync(src))fs.copyFileSync(src,path.join(out,file));
}

// doing.2b-love.com 根目錄固定使用 DOING 2.0 Hub；不修改原本 index.html。
fs.copyFileSync(path.join(root,'doing-2.html'),path.join(out,'index.html'));

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
console.log(JSON.stringify({result:'PASS',output:'.doing-2-site',root:'doing-2.html',routes:Object.keys(routeMap)},null,2));
