(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const TOKEN_KEY='doing_member_token';
const u=new URL(location.href);
const status=String(u.searchParams.get('application_status')||'').trim().toLowerCase();
if(!['approved','auto_activated'].includes(status)) return;

const applicationId=String(u.searchParams.get('application_id')||'').trim();
const tenantId=String(u.searchParams.get('tenant_id')||'').trim();
const incoming=String(u.searchParams.get('member_token')||'').trim();
if(incoming) localStorage.setItem(TOKEN_KEY,incoming);
const memberToken=incoming||localStorage.getItem(TOKEN_KEY)||'';

const target=new URL('/member-panel.html',location.origin);
if(applicationId) target.searchParams.set('application_id',applicationId);
if(tenantId) target.searchParams.set('tenant_id',tenantId);
target.searchParams.set('post_application','1');
target.hash='operations';

function showProgress(text){
  const box=document.getElementById('doingAutoActivationStatus');
  if(!box) return;
  const span=box.querySelector('span');
  if(span) span.textContent=text;
  const link=box.querySelector('a');
  if(link){link.textContent='正在進入我的 DOING…';link.href=target.toString();}
}

if(memberToken){
  showProgress('工作空間已建立，正在帶你進入「我的 DOING」。');
  setTimeout(()=>location.replace(target.toString()),350);
  return;
}

// organizer_signup 的 LINE 驗證已完成工作空間建立，但舊 callback 沒把 member_token 帶回 Web。
// 這裡自動補一次會員 session 交換；LINE 已完成授權時通常不需再人工操作。
const onceKey='doing_post_application_member_login:'+applicationId;
if(sessionStorage.getItem(onceKey)==='1'){
  showProgress('工作空間已建立。若登入沒有自動完成，請點「進入我的 DOING」繼續。');
  return;
}
sessionStorage.setItem(onceKey,'1');
showProgress('工作空間已建立，正在完成主辦帳號登入並進入「我的 DOING」。');
const auth=new URL(API+'/auth/line/start');
auth.searchParams.set('mode','member');
auth.searchParams.set('return_url',target.toString());
setTimeout(()=>location.replace(auth.toString()),350);
})();
