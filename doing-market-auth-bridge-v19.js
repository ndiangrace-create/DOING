(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const MEMBER_KEY='doing_member_token';
const p=new URL(location.href).searchParams;
const currentAdmin=String(p.get('admin_token')||p.get('token')||'').trim();
const currentTenant=String(p.get('tenant')||'').trim().toLowerCase();
const incomingMember=String(p.get('member_token')||'').trim();
let member='';
try{member=incomingMember||localStorage.getItem(MEMBER_KEY)||'';if(incomingMember)localStorage.setItem(MEMBER_KEY,incomingMember)}catch(_){member=incomingMember}
if(currentAdmin&&currentTenant){document.documentElement.classList.add('doing-market-auth-ready');return}
document.documentElement.classList.add('doing-market-auth-bridging');
function cleanUrl(){const u=new URL(location.href);u.searchParams.delete('member_token');return u}
function lineLogin(){const ret=cleanUrl();const u=new URL(API+'/auth/line/start');u.searchParams.set('mode','member');u.searchParams.set('return_url',ret.toString());location.replace(u.toString())}
async function json(url,opt){const r=await fetch(url,opt),d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false||d.error)throw new Error(d.error||'登入狀態確認失敗');return d.data??d.result??d}
function workspaceId(w){return String(w?.id||w?.tenantId||w?.tenant_id||'').trim().toLowerCase()}
async function resolve(){
  if(!member){lineLogin();return}
  try{
    let tenant=currentTenant;
    if(!tenant){
      const u=new URL(API);u.searchParams.set('action','getPlatformMemberProfile');u.searchParams.set('member_token',member);
      const d=await json(u,{cache:'no-store'});const rows=Array.isArray(d.workspaces)?d.workspaces:[];
      if(rows.length===1)tenant=workspaceId(rows[0]);
      else if(rows.length>1){
        const marketRows=rows.filter(w=>{const text=JSON.stringify(w).toLowerCase();return text.includes('market')||text.includes('市集')||text.includes('活動')});
        tenant=workspaceId(marketRows[0]||rows[0]);
      }
    }
    if(!tenant)throw new Error('no_workspace');
    const d=await json(API+'?action=createMemberWorkspaceAdminSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({member_token:member,tenantId:tenant})});
    const adminToken=String(d.adminToken||d.admin_token||'').trim(),resolvedTenant=String(d.tenantId||d.tenant_id||tenant).trim().toLowerCase();
    if(!adminToken||!resolvedTenant)throw new Error('session_failed');
    const u=cleanUrl();u.searchParams.set('tenant',resolvedTenant);u.searchParams.set('admin_token',adminToken);location.replace(u.toString());
  }catch(e){
    if(String(e?.message||'').includes('no_workspace')){location.replace('/me/#operations');return}
    try{localStorage.removeItem(MEMBER_KEY)}catch(_){}
    lineLogin();
  }
}
resolve();
})();
