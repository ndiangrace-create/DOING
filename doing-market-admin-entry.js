(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const HOLD_MS=3000;
const FLOW='market_admin';
const OFFICIAL_ORIGIN='https://doing.2b-love.com';
const P=new URL(location.href).searchParams;
const tenant=String(P.get('tenant')||'').trim().toLowerCase();
const logo=document.getElementById('tenantLogo');
if(!logo)return;

const localPreview=/^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
const siteOrigin=localPreview?location.origin:OFFICIAL_ORIGIN;
let timer=null,pointerId=null,origin=null,holding=false,suppressClick=false;

function clearHold(){
  if(timer)clearTimeout(timer);
  timer=null;pointerId=null;origin=null;holding=false;
  logo.classList.remove('doing-market-admin-holding');
}
function cleanFlow(){
  const u=new URL(location.href);
  ['member_token','member_status','member_login_error','login_error','doing_login_flow','market_admin_tenant'].forEach(k=>u.searchParams.delete(k));
  history.replaceState({},'',u.toString());
}
function adminReturnUrl(targetTenant){
  const u=new URL('/market/public/',siteOrigin);
  u.searchParams.set('tenant',targetTenant);
  u.searchParams.set('doing_login_flow',FLOW);
  u.searchParams.set('market_admin_tenant',targetTenant);
  return u;
}
function startAdminLogin(){
  clearHold();
  if(!tenant){alert('這個前台尚未指定營運空間，請從該營運空間的正式前台進入後台。');return}
  suppressClick=true;
  const u=new URL(API+'/auth/line/start');
  u.searchParams.set('mode','member');
  u.searchParams.set('return_url',adminReturnUrl(tenant).toString());
  location.assign(u.toString());
}
async function exchangeAdminSession(){
  if(P.get('doing_login_flow')!==FLOW)return;
  const targetTenant=String(P.get('market_admin_tenant')||tenant||'').trim().toLowerCase();
  const loginError=P.get('member_login_error')||P.get('login_error')||'';
  if(loginError){cleanFlow();alert('主辦登入未完成，請重新長按 LOGO 3 秒登入。');return}
  const memberToken=String(P.get('member_token')||'').trim();
  if(!targetTenant||!memberToken){cleanFlow();alert('主辦登入資料不完整，請重新長按 LOGO 3 秒登入。');return}
  try{
    const r=await fetch(API+'?action=createMemberWorkspaceAdminSession',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'createMemberWorkspaceAdminSession',member_token:memberToken,tenantId:targetTenant})
    });
    const raw=await r.json().catch(()=>({}));
    if(!r.ok||raw.ok===false||raw.error)throw new Error(raw.error||'這個帳號沒有此營運空間的管理權限');
    const data=raw.data??raw.result??raw;
    if(data.locked)throw new Error(data.lockedReason||'這個營運空間目前未開放後台操作');
    const adminToken=String(data.adminToken||data.admin_token||'').trim();
    if(!adminToken)throw new Error('主辦登入授權建立失敗');
    const dest=new URL('/market/',siteOrigin);
    dest.searchParams.set('tenant',String(data.tenantId||targetTenant));
    dest.searchParams.set('admin_token',adminToken);
    location.replace(dest.toString());
  }catch(err){
    cleanFlow();
    alert(err&&err.message?err.message:'這個帳號目前不能進入此營運空間後台');
  }
}

const style=document.createElement('style');
style.textContent='#tenantLogo{user-select:none;-webkit-user-select:none}.doing-market-admin-holding{outline:3px solid rgba(47,143,139,.28);outline-offset:3px;border-radius:10px}';
document.head.appendChild(style);

logo.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  clearHold();suppressClick=false;pointerId=e.pointerId;origin={x:e.clientX,y:e.clientY};holding=true;
  logo.classList.add('doing-market-admin-holding');
  timer=setTimeout(startAdminLogin,HOLD_MS);
});
logo.addEventListener('pointermove',e=>{
  if(!holding||e.pointerId!==pointerId||!origin)return;
  const r=logo.getBoundingClientRect();
  if(Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>12||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)clearHold();
});
['pointerup','pointercancel','lostpointercapture'].forEach(name=>logo.addEventListener(name,clearHold));
logo.addEventListener('contextmenu',e=>e.preventDefault());
logo.closest('a')?.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false}},true);

exchangeAdminSession();
})();
