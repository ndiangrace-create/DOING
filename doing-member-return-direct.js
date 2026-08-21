(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const TOKEN_KEY='doing_member_token';
const u=new URL(location.href);
const hasIncoming=u.searchParams.has('member_token');
let hasStored=false;
try{hasStored=!!localStorage.getItem(TOKEN_KEY)}catch(_){}
const inlineLogin=document.getElementById('lineLogin');
if(inlineLogin) inlineLogin.remove();
if(!hasIncoming&&!hasStored){
  const returnUrl=new URL('/member-panel.html',location.origin);
  for(const key of ['staff_invite','registration_invite']){
    const value=u.searchParams.get(key);
    if(value)returnUrl.searchParams.set(key,value);
  }
  returnUrl.hash=u.hash||'#account';
  const loginUrl=new URL(API+'/auth/line/start');
  loginUrl.searchParams.set('mode','member');
  loginUrl.searchParams.set('return_url',returnUrl.toString());
  location.replace(loginUrl.toString());
}
})();
