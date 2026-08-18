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

// V20.1: 首頁 -> LINE -> 工作空間。會員中心保留為工作空間內的帳號/品牌/報名設定入口，
// 但不再成為登入後必經頁，也不顯示第二個內部登入畫面。
if(/(?:^|\/)member\.html$/i.test(location.pathname)){
 const TOKEN_KEY='doing_member_token';
 const memberToken=()=>sessionStorage.getItem(TOKEN_KEY)||localStorage.getItem(TOKEN_KEY)||'';
 const explicitMemberSection=()=>/^#(?:activities|brands|account)$/i.test(location.hash||'');
 const inviteMode=()=>new URL(location.href).searchParams.has('staff_invite')||new URL(location.href).searchParams.has('registration_invite');
 let autoOpening=false;
 function startMemberLineLogin(){
   const u=new URL(API+'/auth/line/start');u.searchParams.set('mode','member');u.searchParams.set('return_url',new URL('member.html',location.href).toString());location.replace(u.toString());
 }
 async function openV20Workspace(id){
   if(autoOpening)return;autoOpening=true;
   const token=memberToken(),tenantId=String(id||'').trim().toLowerCase();
   if(!token||!tenantId){autoOpening=false;return;}
   const r=await fetch(API+'?action=createMemberWorkspaceAdminSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({member_token:token,tenantId})});
   const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false){autoOpening=false;throw new Error(d.error||'無法進入工作空間')}
   const data=d.data??d.result??d,u=new URL('workspace.html',location.href);u.searchParams.set('tenant',data.tenantId||tenantId);u.searchParams.set('admin_token',data.adminToken||'');u.searchParams.set('from','member');location.replace(u.toString());
 }
 function applyMemberV20(){
   const newBtn=document.getElementById('newOperationBtn');if(newBtn)newBtn.classList.add('hidden');
   document.querySelectorAll('.tab[data-page="operations"]').forEach(x=>x.textContent='工作空間');
   document.querySelectorAll('[data-panel="operations"] h2').forEach(x=>x.textContent='工作空間');
   document.querySelectorAll('[data-workspace-admin]').forEach(x=>x.textContent='進入工作空間');
   document.querySelectorAll('[data-workspace-calendar]').forEach(x=>{x.textContent='開啟工作日曆';x.dataset.v20Calendar='1'});
   document.querySelectorAll('[data-workspace-admin],[data-workspace-calendar]').forEach(x=>x.setAttribute('data-v20-workspace',x.dataset.workspaceAdmin||x.dataset.workspaceCalendar||''));
   if(memberToken()&&!explicitMemberSection()&&!inviteMode()&&!autoOpening){
     const ids=[...new Set([...document.querySelectorAll('[data-v20-workspace]')].map(x=>x.getAttribute('data-v20-workspace')).filter(Boolean))];
     if(ids.length===1)openV20Workspace(ids[0]).catch(()=>{autoOpening=false});
   }
 }
 // 沒有 token 的一般進入，直接啟動 LINE，不再顯示 member.html 的第二層登入頁。
 // 邀請流程例外，仍留在會員中心以顯示邀請語意與錯誤。
 if(!memberToken()&&!inviteMode()&&!new URL(location.href).searchParams.get('member_token')&&!new URL(location.href).searchParams.get('member_login_error')){
   startMemberLineLogin();return;
 }
 const mo=new MutationObserver(applyMemberV20);mo.observe(document.documentElement,{childList:true,subtree:true});applyMemberV20();
 document.addEventListener('click',e=>{const el=e.target.closest?.('[data-v20-workspace]');if(!el)return;const id=el.getAttribute('data-v20-workspace');if(!id)return;e.preventDefault();e.stopImmediatePropagation();el.disabled=true;openV20Workspace(id).catch(err=>{alert(err.message||'無法進入工作空間');el.disabled=false;autoOpening=false})},true);
}
})();
