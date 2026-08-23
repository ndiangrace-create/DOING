(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const TOKEN_KEY='doing_member_token';
const u=new URL(location.href);
const incoming=String(u.searchParams.get('member_token')||'').trim();
const loginError=String(u.searchParams.get('member_login_error')||u.searchParams.get('login_error')||'').trim();
if(incoming){
  try{localStorage.setItem(TOKEN_KEY,incoming);sessionStorage.setItem(TOKEN_KEY,incoming)}catch(_){}
  for(const key of ['member_token','member_status','member_login_error','login_error'])u.searchParams.delete(key);
  history.replaceState(null,'',u.pathname+u.search+(u.hash||'#home'));
}
let token='';try{token=localStorage.getItem(TOKEN_KEY)||sessionStorage.getItem(TOKEN_KEY)||''}catch(_){}
function canonicalReturn(){const ret=new URL('/me/',location.origin);for(const key of ['staff_invite','registration_invite']){const value=u.searchParams.get(key);if(value)ret.searchParams.set(key,value)}ret.hash=u.hash||'#home';return ret}
function startLine(){const loginUrl=new URL(API+'/auth/line/start');loginUrl.searchParams.set('mode','member');loginUrl.searchParams.set('return_url',canonicalReturn().toString());location.replace(loginUrl.toString())}
function wireRetry(){const btn=document.getElementById('lineLogin');if(!btn)return;btn.textContent=loginError?'重新使用 LINE 登入':'使用 LINE 登入';btn.onclick=e=>{e.preventDefault();startLine()}}
if(!token&&!loginError){startLine();return}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wireRetry,{once:true});else wireRetry();
})();
