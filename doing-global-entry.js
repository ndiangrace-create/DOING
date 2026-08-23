(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const TOKEN_KEY='doing_member_token';
function memberToken(){try{return localStorage.getItem(TOKEN_KEY)||sessionStorage.getItem(TOKEN_KEY)||''}catch(_){return''}}
function clearMemberToken(){try{localStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(TOKEN_KEY)}catch(_){}}
function tenantOf(el){return String(el?.dataset?.workspaceAdmin||el?.dataset?.workspaceCalendar||el?.dataset?.workspaceOperations||el?.dataset?.v20Workspace||'').trim().toLowerCase()}
async function openWorkspace(tenantId,button){
  const token=memberToken(),id=String(tenantId||'').trim().toLowerCase();
  if(!token){location.href='/me/#operations';return}
  if(!id)return;
  if(button)button.disabled=true;
  try{
    const r=await fetch(API+'?action=createMemberWorkspaceAdminSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({member_token:token,tenantId:id})});
    const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||'無法進入工作空間');
    const data=d.data??d.result??d,u=new URL('/workspace/',location.origin);u.searchParams.set('tenant',data.tenantId||id);u.searchParams.set('admin_token',data.adminToken||'');location.href=u.toString();
  }catch(e){alert(e.message||'無法進入工作空間');if(button)button.disabled=false}
}
function normalizeMemberHub(){
  if(!/\/me\/?$/.test(location.pathname)&&!/member-panel\.html$/i.test(location.pathname))return;
  document.querySelectorAll('[data-workspace-calendar],[data-workspace-operations]').forEach(el=>el.remove());
  document.querySelectorAll('[data-workspace-admin]').forEach(el=>{el.textContent='進入工作空間';el.setAttribute('data-unified-workspace','1')});
  document.querySelectorAll('a[href*="about.html#apply"],a[href*="index.html#apply"],a[href="/#apply"],a[href*="smart-application.html"]').forEach(a=>a.href='/apply/');
  const logout=document.getElementById('logout');if(logout)logout.textContent='登出';
}
function normalizeWorkspace(){
  if(!/\/workspace\/?$/.test(location.pathname)&&!/workspace\.html$/i.test(location.pathname))return;
  const q=new URL(location.href).searchParams,tenant=String(q.get('tenant')||'').trim(),adminToken=String(q.get('admin_token')||q.get('token')||'').trim();
  if(!tenant||!adminToken){location.replace('/me/#operations');return}
  const advanced=document.getElementById('admin');if(advanced)advanced.remove();
  const my=document.getElementById('my');if(my){my.textContent='我的 DOING';my.onclick=e=>{e.preventDefault();location.href='/me/'}}
}
document.addEventListener('click',e=>{
  const apply=e.target.closest?.('[data-doing-smart-apply],a[href*="#apply"],a[href*="smart-application.html"]');
  if(apply){e.preventDefault();e.stopImmediatePropagation();location.href='/apply/';return}
  const w=e.target.closest?.('[data-workspace-admin],[data-unified-workspace]');
  if(w){const id=tenantOf(w);if(id){e.preventDefault();e.stopImmediatePropagation();openWorkspace(id,w);return}}
  const logout=e.target.closest?.('#logout,[data-doing-logout]');
  if(logout){e.preventDefault();e.stopImmediatePropagation();clearMemberToken();location.replace('/')}
},true);
const apply=()=>{normalizeMemberHub();normalizeWorkspace()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
})();
