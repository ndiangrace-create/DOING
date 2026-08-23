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
const inlineLogin=document.getElementById('lineLogin');if(inlineLogin)inlineLogin.remove();
if(!token&&!loginError){
  const returnUrl=new URL('/me/',location.origin);
  for(const key of ['staff_invite','registration_invite']){const value=u.searchParams.get(key);if(value)returnUrl.searchParams.set(key,value)}
  returnUrl.hash=u.hash||'#home';
  const loginUrl=new URL(API+'/auth/line/start');
  loginUrl.searchParams.set('mode','member');
  loginUrl.searchParams.set('return_url',returnUrl.toString());
  location.replace(loginUrl.toString());
}
})();
