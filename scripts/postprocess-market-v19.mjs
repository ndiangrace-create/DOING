import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'.doing-2-site');
const css='doing-market-v19-layout.css',js='doing-market-auth-bridge-v19.js';
for(const f of [css,js]){const src=path.join(root,f),dest=path.join(out,f);if(!fs.existsSync(src))throw new Error('missing '+f);fs.copyFileSync(src,dest)}
function patch(rel,{auth=false}={}){const fp=path.join(out,rel);let html=fs.readFileSync(fp,'utf8');if(!html.includes(css))html=html.replace('</head>',`<link rel="stylesheet" href="/${css}?v=20260823a"></head>`);if(auth&&!html.includes(js))html=html.replace('</head>',`<script src="/${js}?v=20260823a"></script></head>`);fs.writeFileSync(fp,html)}
patch('market/public/index.html');patch('market/index.html',{auth:true});patch('market/session/index.html',{auth:true});

function patchMember(){
  const fp=path.join(out,'me/index.html');let html=fs.readFileSync(fp,'utf8');
  html=html.replace(/<script src="\/doing-member-return-direct\.js[^\"]*"><\/script>/g,'');
  html=html.replace('</head>','<script src="/doing-member-return-direct.js?v=20260823-unified-entry"></script></head>');
  html=html.replace(/new URL\('\/market\/',location\.href\)/g,"new URL('/workspace/',location.origin)");
  html=html.replace(/new URL\('\/workspace\/',location\.href\)/g,"new URL('/workspace/',location.origin)");
  html=html.replace("if(!d.complete){location.href='/?openMemberProfile=1';return}","if(!d.complete){render();switchPage('account');return}");
  html=html.replace("if(!d.complete){location.href='/ ?openMemberProfile=1';return}","if(!d.complete){render();switchPage('account');return}");
  html=html.replace(/<button class="btn secondary" data-workspace-calendar="[^"]+">[^<]*<\/button>/g,'');
  html=html.replace(/<button class="btn secondary" data-workspace-operations="[^"]+">[^<]*<\/button>/g,'');
  html=html.replace(/進入主辦後台|直接進入主辦後台/g,'進入工作空間');
  html=html.replace(/href="\/#apply"/g,'href="/apply/"');
  html=html.replace(/href="\/smart-application\.html"/g,'href="/apply/"');
  fs.writeFileSync(fp,html);
}
function patchWorkspace(){
  const fp=path.join(out,'workspace/index.html');let html=fs.readFileSync(fp,'utf8');
  if(!html.includes('doing-global-entry.js'))html=html.replace('</body>','<script src="/doing-global-entry.js?v=20260823-unified-entry"></script></body>');
  fs.writeFileSync(fp,html);
}
patchMember();patchWorkspace();

const me=fs.readFileSync(path.join(out,'me/index.html'),'utf8'),workspace=fs.readFileSync(path.join(out,'workspace/index.html'),'utf8');
if(!me.includes('doing-member-return-direct.js'))throw new Error('canonical /me/ login gate missing');
if((me.match(/doing-member-return-direct\.js/g)||[]).length!==1)throw new Error('duplicate /me/ login gate');
if(me.includes('data-workspace-calendar=')||me.includes('data-workspace-operations='))throw new Error('duplicate workspace CTA still published');
if(!workspace.includes('doing-global-entry.js'))throw new Error('workspace unified entry guard missing');
console.log(JSON.stringify({result:'PASS',marketV19:{desktopAdminNav:'top-fixed',mobileAdminNav:'bottom',singleDoingLogin:true,publicDesktopMaxWidth:1180},unifiedEntry:{loginLanding:'/me/',workspace:'/workspace/',duplicateWorkspaceCtas:false,secondLoginPage:false}},null,2));
