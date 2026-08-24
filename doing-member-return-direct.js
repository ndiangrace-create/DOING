(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const TOKEN_KEY='doing_member_token';
const u=new URL(location.href);
const incoming=String(u.searchParams.get('member_token')||'').trim();
const loginError=String(u.searchParams.get('member_login_error')||u.searchParams.get('login_error')||'').trim();
document.documentElement.style.visibility='hidden';
function clearToken(){try{localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_KEY)}catch(_){}}
function canonicalReturn(){const ret=new URL('/me/',location.origin);for(const key of ['staff_invite','registration_invite']){const value=u.searchParams.get(key);if(value)ret.searchParams.set(key,value)}ret.hash=u.hash||'#home';return ret}
function startLine(){clearToken();const loginUrl=new URL(API+'/auth/line/start');loginUrl.searchParams.set('mode','member');loginUrl.searchParams.set('return_url',canonicalReturn().toString());location.replace(loginUrl.toString())}
window.DOING_MEMBER_REAUTH=startLine;
if(incoming){
  try{localStorage.setItem(TOKEN_KEY,incoming);sessionStorage.setItem(TOKEN_KEY,incoming)}catch(_){}
  for(const key of ['member_token','member_status','member_login_error','login_error'])u.searchParams.delete(key);
  history.replaceState(null,'',u.pathname+u.search+(u.hash||'#home'));
}
if(loginError){clearToken();const home=new URL('/',location.origin);home.searchParams.set('login_error',loginError);location.replace(home.toString());return}
let token='';try{token=localStorage.getItem(TOKEN_KEY)||sessionStorage.getItem(TOKEN_KEY)||''}catch(_){}
if(!token){startLine();return}
(async()=>{
  try{
    const check=new URL(API);check.searchParams.set('action','getPlatformMemberProfile');check.searchParams.set('member_token',token);
    const r=await fetch(check.toString(),{cache:'no-store'}),d=await r.json().catch(()=>({}));
    if(!r.ok||d?.error||d?.ok===false)throw new Error(d?.error||'member_session_invalid');
    document.documentElement.style.visibility='';
  }catch(_){startLine()}
})();
})();
