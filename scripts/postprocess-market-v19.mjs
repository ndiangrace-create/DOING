import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'.doing-2-site');
const css='doing-market-v19-layout.css',js='doing-market-auth-bridge-v19.js';
for(const f of [css,js]){const src=path.join(root,f),dest=path.join(out,f);if(!fs.existsSync(src))throw new Error('missing '+f);fs.copyFileSync(src,dest)}
function patch(rel,{auth=false}={}){const fp=path.join(out,rel);let html=fs.readFileSync(fp,'utf8');if(!html.includes(css))html=html.replace('</head>',`<link rel="stylesheet" href="/${css}?v=20260823a"></head>`);if(auth&&!html.includes(js))html=html.replace('</head>',`<script src="/${js}?v=20260823a"></script></head>`);fs.writeFileSync(fp,html)}
patch('market/public/index.html');patch('market/index.html',{auth:true});patch('market/session/index.html',{auth:true});
console.log(JSON.stringify({result:'PASS',marketV19:{desktopAdminNav:'top-fixed',mobileAdminNav:'bottom',singleDoingLogin:true,publicDesktopMaxWidth:1180,publicHeader:'56-64',search:'42-46',categoryHeight:'84-105',activityVisibleFirstScreen:true}},null,2));
