import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'.doing-2-site');
const asset='doing-market-complete-session.js';
const src=path.join(root,asset);
if(!fs.existsSync(src))throw new Error(`missing ${asset}`);
fs.copyFileSync(src,path.join(out,asset));
const tag='<script src="/doing-market-complete-session.js?v=20260826-1"></script>';
for(const rel of ['market/index.html','market/session/index.html']){
  const file=path.join(out,rel);
  let html=fs.readFileSync(file,'utf8');
  if(!html.includes(tag))html=html.replace('</body>',`${tag}\n</body>`);
  if(!html.includes('doing-market-complete-session.js'))throw new Error(`complete-session enhancer missing: ${rel}`);
  fs.writeFileSync(file,html,'utf8');
}
console.log(JSON.stringify({result:'PASS',asset,targets:['/market/','/market/session/']},null,2));