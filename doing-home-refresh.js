(()=>{
'use strict';

// V20.2 login router: keep the existing homepage engine intact in
// doing-home-refresh-core.js, but make the public "My DOING" login a single
// OAuth -> member token -> workspace handoff. This prevents the homepage and
// member.html from acting as two competing login controllers.
const API='https://tobeloved-api.ndiangrace.workers.dev';
const FLOW_KEY='doing_login_flow';
const FLOW_VALUE='workspace';
const CORE='doing-home-refresh-core.js?v=20260819-login-router1';
const bootUrl=new URL(location.href);
const incomingToken=bootUrl.searchParams.get('member_token')||'';
const incomingStatus=bootUrl.searchParams.get('member_status')||'';
const incomingError=bootUrl.searchParams.get('member_login_error')||bootUrl.searchParams.get('login_error')||'';
const incomingFlow=bootUrl.searchParams.get(FLOW_KEY)||'';

function memberTarget(token,hash='home',status=''){
  const u=new URL('member.html',location.href);
  if(token)u.searchParams.set('member_token',token);
  if(status)u.searchParams.set('member_status',status);
  if(hash)u.hash=hash;
  return u;
}
function workspaceTarget(tenantId,adminToken){
  const u=new URL('workspace.html',location.href);
  u.searchParams.set('tenant',String(tenantId||'').trim().toLowerCase());
  u.searchParams.set('admin_token',adminToken||'');
  u.searchParams.set('from','member');
  return u;
}
async function getProfile(token){
  const u=new URL(API);u.searchParams.set('action','getPlatformMemberProfile');u.searchParams.set('member_token',token);
  const r=await fetch(u,{cache:'no-store'}),d=await r.json().catch(()=>({}));
  if(!r.ok||d.ok===false)throw new Error(d.error||'會員資料讀取失敗');
  return d.data??d.result??d;
}
async function createWorkspaceSession(token,tenantId){
  const r=await fetch(API+'?action=createMemberWorkspaceAdminSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({member_token:token,tenantId})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.ok===false)throw new Error(d.error||'無法進入工作空間');
  return d.data??d.result??d;
}
async function handoffToWorkspace(token,status){
  if(!token)return false;
  try{localStorage.setItem('doing_member_token',token)}catch(_){}
  const profile=await getProfile(token);
  if(!profile.complete){location.replace(memberTarget(token,'account',status||'profile_required').toString());return true;}
  const spaces=Array.isArray(profile.workspaces)?profile.workspaces:[];
  if(spaces.length===1){
    const tenantId=String(spaces[0]?.id||spaces[0]?.tenantId||spaces[0]?.tenant_id||'').trim().toLowerCase();
    if(tenantId){const session=await createWorkspaceSession(token,tenantId);location.replace(workspaceTarget(session.tenantId||tenantId,session.adminToken||'').toString());return true;}
  }
  location.replace(memberTarget(token,spaces.length>1?'operations':'home',status||'ready').toString());
  return true;
}
function startMyDoingLineLogin(){
  const returnUrl=new URL(location.href);
  ['member_token','member_status','member_login_error','login_error','member_linked'].forEach(k=>returnUrl.searchParams.delete(k));
  returnUrl.searchParams.set(FLOW_KEY,FLOW_VALUE);
  const u=new URL(API+'/auth/line/start');
  u.searchParams.set('mode','member');
  u.searchParams.set('return_url',returnUrl.toString());
  location.assign(u.toString());
}
function installLoginCapture(){
  document.addEventListener('click',e=>{
    const target=e.target.closest?.('[data-my-action="login"],#globalMyNavBtn');
    if(!target)return;
    let stored='';try{stored=localStorage.getItem('doing_member_token')||''}catch(_){}
    if(stored)return; // Existing valid/invalid token remains handled by the core UI.
    e.preventDefault();e.stopImmediatePropagation();
    startMyDoingLineLogin();
  },true);
}
async function loadCore(){
  const response=await fetch(CORE,{cache:'no-store'});
  if(!response.ok)throw new Error('首頁功能載入失敗');
  const source=await response.text();
  (0,eval)(source+'\n//# sourceURL='+CORE);
}

(async()=>{
  // LINE callback for the unified My DOING entry is handled before the old
  // homepage member state can consume/clean the member_token query string.
  if(incomingFlow===FLOW_VALUE&&incomingToken){
    try{await handoffToWorkspace(incomingToken,incomingStatus);return}catch(error){
      console.error('DOING workspace handoff failed',error);
      location.replace(memberTarget(incomingToken,'operations',incomingStatus||'ready').toString());return;
    }
  }
  // A failed callback must stop and show the normal login error; never restart
  // OAuth automatically from this router.
  if(incomingFlow===FLOW_VALUE&&incomingError){
    bootUrl.searchParams.delete(FLOW_KEY);
    history.replaceState({},'',bootUrl.pathname+bootUrl.search+bootUrl.hash);
  }
  try{await loadCore();installLoginCapture()}catch(error){console.error(error);}
})();
})();
