import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s,'utf8');
function replaceOnce(text,oldText,newText,label){
  const n=text.split(oldText).length-1;
  if(n!==1)throw new Error(`${label}: expected exactly 1 match, got ${n}`);
  return text.replace(oldText,newText);
}

const workerJs=read('worker.js');
const workerTxt=read('worker.txt');
if(workerJs!==workerTxt)throw new Error('worker.js / worker.txt baseline mismatch');
let worker=workerJs;
worker=replaceOnce(
  worker,
  "const params=new URLSearchParams({response_type:'code',client_id:env.LINE_LOGIN_CHANNEL_ID,redirect_uri:lineRedirectUri(env,url),state,scope,nonce,bot_prompt:'normal'});",
  "const params=new URLSearchParams({response_type:'code',client_id:env.LINE_LOGIN_CHANNEL_ID,redirect_uri:lineRedirectUri(env,url),state,scope,nonce,bot_prompt:'normal',initial_amr_display:'lineqr',ui_locales:'zh-TW'});",
  'LINE authorize params'
);
worker=replaceOnce(
  worker,
  "if(url.searchParams.get('error'))return fail('line_cancelled');",
  "if(url.searchParams.get('error')){const lineError=String(url.searchParams.get('error')||'').toUpperCase();return fail(lineError==='ACCESS_DENIED'?'line_cancelled':(lineError==='LOGIN_REQUIRED'||lineError==='INTERACTION_REQUIRED')?'line_login_required':'line_login_failed')};",
  'LINE callback error mapping'
);
write('worker.js',worker);
write('worker.txt',worker);

let member=read('member-current.html');
member=replaceOnce(
  member,
  "async function apiGet(action,params={}){const u=new URL(API);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});const r=await fetch(u,{cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false||d.error)throw Error(d.error||'載入失敗');return d.data??d.result??d}",
  "async function apiGet(action,params={}){const u=new URL(API);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});const r=await fetch(u,{cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false||d.error){const e=Error(d.error||'載入失敗');e.status=r.status;throw e}return d.data??d.result??d}",
  'member apiGet status propagation'
);
member=replaceOnce(
  member,
  "function showExpired(e){localStorage.removeItem(TOKEN_KEY);token='';setAuthChecking(false,'登入已失效，請重新使用 LINE 登入。');if(e&&e.message&&e.message!=='載入失敗')$('loginMessage').textContent=e.message}",
  "function isAuthExpired(e){const m=String(e&&e.message||'');return Number(e&&e.status)===401||/登入已失效|請重新登入|token.*(失效|過期|invalid|expired)/i.test(m)}\nfunction handleLoadError(e){if(isAuthExpired(e)){localStorage.removeItem(TOKEN_KEY);token='';setAuthChecking(false,'登入已失效，請重新使用 LINE 登入。');return}authChecking=false;setAuthChecking(false,'LINE 登入已保留，但工作空間暫時載入失敗。請按「重新確認」，不需要再登入 LINE。');const btn=$('lineLogin');if(btn)btn.textContent='重新確認'}",
  'member transient-load handling'
);
member=replaceOnce(member,"load().then(()=>{authChecking=false}).catch(showExpired)","load().then(()=>{authChecking=false}).catch(handleLoadError)",'member retry catch');
member=replaceOnce(member,"try{await load();authChecking=false}catch(e){showExpired(e)}","try{await load();authChecking=false}catch(e){handleLoadError(e)}",'member init catch');
write('member-current.html',member);

let e2e=read('scripts/e2e-home-kawaii.mjs');
const insertion=`\n  // A transient profile/workspace API failure must not destroy a valid member token or restart LINE OAuth.\n  const transientPage=await browser.newPage({viewport:{width:1440,height:1000}});\n  let transientOauthStarts=0;\n  transientPage.on('request',req=>{if(req.url().includes('/auth/line/start'))transientOauthStarts++});\n  await transientPage.addInitScript(()=>localStorage.setItem('doing_member_token','existing-member-token'));\n  await transientPage.route('https://tobeloved-api.ndiangrace.workers.dev/**',async route=>{\n    const u=new URL(route.request().url());\n    if((u.searchParams.get('action')||'')==='getPlatformMemberProfile'){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'暫時無法讀取工作空間'})});return}\n    await route.abort();\n  });\n  await transientPage.goto(base+'/me/',{waitUntil:'domcontentloaded'});\n  await transientPage.locator('#loginMessage').waitFor();\n  await transientPage.waitForFunction(()=>document.getElementById('loginMessage')?.textContent?.includes('工作空間暫時載入失敗'));\n  const tokenAfterTransient=await transientPage.evaluate(()=>localStorage.getItem('doing_member_token'));\n  if(tokenAfterTransient!=='existing-member-token')throw new Error('auth: transient API failure incorrectly cleared member token');\n  if(transientOauthStarts!==0)throw new Error('auth: transient API failure incorrectly restarted LINE OAuth');\n  const retryText=await transientPage.locator('#lineLogin').textContent();\n  if(!String(retryText||'').includes('重新確認'))throw new Error('auth: transient API failure did not offer in-place retry');\n  await transientPage.close();\n`;
const marker="  await authPage.close();\n\n  console.log(JSON.stringify({result:'PASS'";
if(!e2e.includes(marker))throw new Error('E2E insertion marker not found');
e2e=e2e.replace(marker,"  await authPage.close();\n"+insertion+"\n  console.log(JSON.stringify({result:'PASS'");
e2e=e2e.replace("duplicateLineOAuthRace:false,horizontalOverflow:false","duplicateLineOAuthRace:false,transientMemberLoadKeepsToken:true,horizontalOverflow:false");
write('scripts/e2e-home-kawaii.mjs',e2e);

execFileSync('node',['--check','worker.js'],{stdio:'inherit'});
execFileSync('node',['--check','scripts/e2e-home-kawaii.mjs'],{stdio:'inherit'});
console.log(JSON.stringify({result:'PASS',lineInteractiveDefault:'qr',autoLoginPreserved:true,transientMemberLoadKeepsToken:true,workerMirror:read('worker.js')===read('worker.txt')},null,2));
