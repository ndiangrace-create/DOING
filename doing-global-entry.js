(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const targets=[...document.querySelectorAll('[data-doing-admin-entry]')];
const style=document.createElement('style');
style.textContent='[data-doing-admin-entry]{position:relative;user-select:none;-webkit-user-select:none}[data-doing-admin-entry].doing-entry-holding{outline:3px solid rgba(47,143,139,.28);outline-offset:3px;border-radius:16px}[data-doing-admin-entry] img{object-fit:contain}';
document.head.appendChild(style);
let timer=null,pointer=null,origin=null,target=null,opened=false;
const tenant=()=>String(new URL(location.href).searchParams.get('tenant')||document.body.dataset.tenant||'').trim().toLowerCase();
function clear(){if(timer)clearTimeout(timer);timer=null;pointer=null;origin=null;target?.classList.remove('doing-entry-holding');target=null}
function enter(){const t=tenant();opened=true;clear();if(t){location.href='admin.html?tenant='+encodeURIComponent(t)+'&from='+encodeURIComponent(location.pathname.split('/').pop().replace('.html','')||'page');return}const u=new URL(API+'/auth/line/start');u.searchParams.set('mode','platform');u.searchParams.set('tenant','platform');location.href=u.toString()}
if(targets.length){
 document.addEventListener('pointerdown',e=>{const el=e.target.closest?.('[data-doing-admin-entry]');if(!el||(e.pointerType==='mouse'&&e.button!==0))return;clear();opened=false;pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};target=el;el.classList.add('doing-entry-holding');timer=setTimeout(enter,3000)},true);
 document.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||!origin||!target)return;const r=target.getBoundingClientRect();if(Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>12||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)clear()},true);
 ['pointerup','pointercancel','lostpointercapture'].forEach(name=>document.addEventListener(name,clear,true));
 document.addEventListener('click',e=>{if(opened&&e.target.closest?.('[data-doing-admin-entry]')){e.preventDefault();e.stopImmediatePropagation();opened=false}},true);
 document.addEventListener('contextmenu',e=>{if(e.target.closest?.('[data-doing-admin-entry]'))e.preventDefault()},true);
}

// V20.2: member.html is a callback/compatibility layer, not an OAuth loop.
// LINE may only be auto-started by an explicit ?login=1 request. A callback,
// error, direct URL, or workspace fallback never re-launches OAuth by itself.
if(/(?:^|\/)member\.html$/i.test(location.pathname)){
 const TOKEN_KEY='doing_member_token';
 const params=()=>new URL(location.href).searchParams;
 const memberToken=()=>sessionStorage.getItem(TOKEN_KEY)||localStorage.getItem(TOKEN_KEY)||'';
 const explicitMemberSection=()=>/^#(?:activities|brands|account|operations)$/i.test(location.hash||'');
 const inviteMode=()=>params().has('staff_invite')||params().has('registration_invite');
 const loginRequested=()=>params().get('login')==='1';
 let autoOpening=false,autoOpenAttempted=false,lineStartAttempted=false;
 function startMemberLineLogin(){
   if(lineStartAttempted)return;lineStartAttempted=true;
   const returnUrl=new URL('member.html',location.href);returnUrl.searchParams.delete('login');
   const u=new URL(API+'/auth/line/start');u.searchParams.set('mode','member');u.searchParams.set('return_url',returnUrl.toString());location.replace(u.toString());
 }
 async function openV20Workspace(id,{automatic=false}={}){
   if(autoOpening)return;autoOpening=true;if(automatic)autoOpenAttempted=true;
   const token=memberToken(),tenantId=String(id||'').trim().toLowerCase();
   if(!token||!tenantId){autoOpening=false;return;}
   try{
     const r=await fetch(API+'?action=createMemberWorkspaceAdminSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({member_token:token,tenantId})});
     const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||'無法進入工作空間');
     const data=d.data??d.result??d,u=new URL('workspace.html',location.href);u.searchParams.set('tenant',data.tenantId||tenantId);u.searchParams.set('admin_token',data.adminToken||'');u.searchParams.set('from','member');location.replace(u.toString());
   } finally {autoOpening=false;}
 }
 function applyMemberV20(){
   const newBtn=document.getElementById('newOperationBtn');if(newBtn)newBtn.classList.add('hidden');
   document.querySelectorAll('.tab[data-page="operations"]').forEach(x=>x.textContent='工作空間');
   document.querySelectorAll('[data-panel="operations"] h2').forEach(x=>x.textContent='工作空間');
   document.querySelectorAll('[data-workspace-admin]').forEach(x=>x.textContent='進入工作空間');
   document.querySelectorAll('[data-workspace-calendar]').forEach(x=>{x.textContent='開啟工作日曆';x.dataset.v20Calendar='1'});
   document.querySelectorAll('[data-workspace-admin],[data-workspace-calendar]').forEach(x=>x.setAttribute('data-v20-workspace',x.dataset.workspaceAdmin||x.dataset.workspaceCalendar||''));
   if(memberToken()&&!explicitMemberSection()&&!inviteMode()&&!autoOpening&&!autoOpenAttempted){
     const ids=[...new Set([...document.querySelectorAll('[data-v20-workspace]')].map(x=>x.getAttribute('data-v20-workspace')).filter(Boolean))];
     if(ids.length===1)openV20Workspace(ids[0],{automatic:true}).catch(()=>{});
   }
 }
 const incoming=params().get('member_token'),loginError=params().get('member_login_error')||params().get('login_error');
 if(loginRequested()&&!memberToken()&&!inviteMode()&&!incoming&&!loginError){startMemberLineLogin();return;}
 const mo=new MutationObserver(applyMemberV20);mo.observe(document.documentElement,{childList:true,subtree:true});applyMemberV20();
 document.addEventListener('click',e=>{const el=e.target.closest?.('[data-v20-workspace]');if(!el)return;const id=el.getAttribute('data-v20-workspace');if(!id)return;e.preventDefault();e.stopImmediatePropagation();el.disabled=true;openV20Workspace(id).catch(err=>{alert(err.message||'無法進入工作空間');el.disabled=false})},true);
}
})();
