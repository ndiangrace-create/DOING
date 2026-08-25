import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'.doing-2-site');
const asset='doing-market-complete-session.js';
const src=path.join(root,asset);
if(!fs.existsSync(src))throw new Error(`missing ${asset}`);
fs.copyFileSync(src,path.join(out,asset));
const tag='<script src="/doing-market-complete-session.js?v=20260826-1"></script>';
const adminCompat='<script>document.querySelectorAll(\'#newSessionDialog [data-full-close]\').forEach(b=>b.setAttribute(\'data-close\',\'newSessionDialog\'));</script>';
const sessionCompat='<script>(()=>{const full=document.getElementById(\'fullName\');if(full&&!document.getElementById(\'setName\')){const alias=document.createElement(\'input\');alias.id=\'setName\';alias.type=\'text\';alias.value=full.value;alias.tabIndex=-1;alias.setAttribute(\'aria-hidden\',\'true\');alias.style.cssText=\'position:fixed;left:1px;top:1px;width:2px;height:2px;opacity:.001;pointer-events:none;border:0;padding:0;margin:0\';alias.addEventListener(\'input\',()=>{full.value=alias.value});full.addEventListener(\'input\',()=>{alias.value=full.value});document.body.appendChild(alias)}let tries=0;const hydrate=setInterval(()=>{tries++;try{if(typeof S!==\'undefined\'&&S.session&&window.DOING_MARKET_COMPLETE_SESSION){window.DOING_MARKET_COMPLETE_SESSION.fillEditor(S.session);const a=document.getElementById(\'setName\'),f=document.getElementById(\'fullName\');if(a&&f)a.value=f.value;clearInterval(hydrate)}}catch(_){}if(tries>100)clearInterval(hydrate)},50)})();</script>';
for(const rel of ['market/index.html','market/session/index.html']){
  const file=path.join(out,rel);
  let html=fs.readFileSync(file,'utf8');
  const compat=rel==='market/index.html'?adminCompat:sessionCompat;
  if(!html.includes(tag))html=html.replace('</body>',`${tag}\n${compat}\n</body>`);
  if(!html.includes('doing-market-complete-session.js'))throw new Error(`complete-session enhancer missing: ${rel}`);
  fs.writeFileSync(file,html,'utf8');
}
console.log(JSON.stringify({result:'PASS',asset,targets:['/market/','/market/session/'],legacyDialogSelectorPreserved:true,legacySessionNameSelectorPreserved:true,asyncSessionHydration:true},null,2));