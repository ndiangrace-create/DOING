(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const TOKEN_KEY='doing_member_token';
const SNAPSHOT_KEY='doing_formal_application_resume_v1';
const MAX_AGE=15*60*1000;
const originalFetch=window.fetch.bind(window);
const NEVER=new Promise(()=>{});

function parseJwt(token){
  try{
    const p=String(token||'').split('.');if(p.length!==3)return null;
    const s=p[1].replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(s+'='.repeat((4-s.length%4)%4));
    const text=decodeURIComponent(Array.from(raw,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));
    return JSON.parse(text);
  }catch(_){return null}
}
function usableLineMemberToken(token){
  const p=parseJwt(token);return !!(p&&p.type==='member'&&p.provider==='line'&&(!p.expires_at||Number(p.expires_at)>Date.now()+30000));
}
function readSnapshot(){
  try{const v=JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY)||'null');if(!v||!v.payload||Date.now()-Number(v.createdAt||0)>MAX_AGE){sessionStorage.removeItem(SNAPSHOT_KEY);return null}return v}catch(_){return null}
}
function saveSnapshot(payload){sessionStorage.setItem(SNAPSHOT_KEY,JSON.stringify({payload,createdAt:Date.now()}))}
function clearSnapshot(){sessionStorage.removeItem(SNAPSHOT_KEY)}
function cleanApplicationUrl(){
  const u=new URL(location.href);for(const k of ['member_token','member_status','member_login_error','login_error'])u.searchParams.delete(k);history.replaceState(null,'',u.toString());
}
function memberOperations(extra={}){const u=new URL('/me/',location.origin);Object.entries(extra).forEach(([k,v])=>u.searchParams.set(k,String(v)));u.hash='operations';return u}
function resumeReturnUrl(){const u=new URL('/apply/',location.origin);u.searchParams.set('doing_application_resume','1');return u}
function startLineVerification(){
  const u=new URL(API+'/auth/line/start');u.searchParams.set('mode','member');u.searchParams.set('return_url',resumeReturnUrl().toString());location.replace(u.toString());return NEVER;
}
function responseError(message){return new Response(JSON.stringify({error:String(message||'申請資料保存失敗')}),{status:200,headers:{'Content-Type':'application/json'}})}
function applicationContact(app){return {name:String(app.ownerName||app.contactName||'').trim(),email:String(app.contactEmail||app.email||'').trim(),phone:String(app.phone||'').trim(),city:String(app.region||'').trim()}}
async function saveMemberContact(token,app){
  const c=applicationContact(app);
  const r=await originalFetch(API+'?action=savePlatformMemberProfile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'savePlatformMemberProfile',member_token:token,name:c.name,email:c.email,phone:c.phone,city:c.city})});
  const d=await r.json().catch(()=>({}));return {r,d};
}
function normalizeMemberState(raw){
  const data=raw?.data??raw?.result??raw??{},workspaces=Array.isArray(data.workspaces)?data.workspaces:[],applications=Array.isArray(data.applications)?data.applications:[];
  const pending=applications.find(a=>['line_verification_pending','pending','manual_review','supplement_required'].includes(String(a?.status||'')))||null;
  return {workspaces,applications,pending};
}
async function readMemberState(token){
  try{const r=await originalFetch(API+'?action=getPlatformMemberProfile&member_token='+encodeURIComponent(token),{cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok||d.error||d.ok===false)return null;return normalizeMemberState(d)}catch(_){return null}
}
function isAuthExpired(message){return /會員登入已失效|重新登入|member.*expired|invalid.*member/i.test(String(message||''))}
function isExistingWorkspace(message){return /此會員已是正式營運方|已有自己的 DOING 工作空間/.test(String(message||''))}
function isPendingApplication(message){return /此會員已有進行中的營運申請|已有進行中的工作空間申請/.test(String(message||''))}
function routeKnownApplicationState(message){
  if(isExistingWorkspace(message)){clearSnapshot();location.replace(memberOperations({application_status:'existing_workspace'}).toString());return true}
  if(isPendingApplication(message)){clearSnapshot();location.replace(memberOperations({post_application:'1'}).toString());return true}
  return false;
}
function routeResolvedMemberState(state){
  if(state?.workspaces?.length){clearSnapshot();location.replace(memberOperations({application_status:'existing_workspace'}).toString());return true}
  if(state?.pending){clearSnapshot();location.replace(memberOperations({post_application:'1',application_id:state.pending.id||''}).toString());return true}
  return false;
}
async function submitVerifiedPayload(payload,requestInput,requestInit){
  const token=String(payload.member_token||payload.memberToken||localStorage.getItem(TOKEN_KEY)||'').trim();
  if(!usableLineMemberToken(token)){saveSnapshot({...payload,member_token:''});return startLineVerification()}
  saveSnapshot({...payload,member_token:''});
  const profile=await saveMemberContact(token,payload.application||{});
  if(profile.d&&profile.d.error){if(isAuthExpired(profile.d.error)){localStorage.removeItem(TOKEN_KEY);return startLineVerification()}if(routeKnownApplicationState(profile.d.error))return NEVER;return responseError(profile.d.error)}
  const state=await readMemberState(token);if(routeResolvedMemberState(state))return NEVER;
  const nextPayload={...payload,member_token:token};
  const init={...(requestInit||{}),method:(requestInit&&requestInit.method)||'POST',headers:{...((requestInit&&requestInit.headers)||{}),'Content-Type':'application/json'},body:JSON.stringify(nextPayload)};
  const r=await originalFetch(requestInput,init),d=await r.clone().json().catch(()=>({}));
  if(d&&d.error){if(routeKnownApplicationState(d.error))return NEVER;return r}
  if(d&&d.existingWorkspace){clearSnapshot();location.replace(memberOperations({application_status:'existing_workspace'}).toString());return NEVER}
  if(d&&d.existingApplication){clearSnapshot();location.replace(memberOperations({post_application:'1',application_id:d.applicationId||''}).toString());return NEVER}
  if(d&&d.lineVerified){clearSnapshot();return r}
  if(d&&d.applicationId){const u=new URL(API+'/auth/line/start');u.searchParams.set('mode','organizer_signup');u.searchParams.set('application_id',String(d.applicationId));location.replace(u.toString());return NEVER}
  return r;
}
function isCreateDraftRequest(input,init){
  try{const u=new URL(typeof input==='string'?input:input.url,location.href);if(u.searchParams.get('action')==='createOrganizerApplicationDraft')return true;const b=JSON.parse(String(init&&init.body||'{}'));return b.action==='createOrganizerApplicationDraft'}catch(_){return false}
}
window.fetch=function(input,init){
  if(!isCreateDraftRequest(input,init))return originalFetch(input,init);
  let payload;try{payload=JSON.parse(String(init&&init.body||'{}'))}catch(_){return originalFetch(input,init)}
  return submitVerifiedPayload(payload,input,init);
};
function statusCard(title,text,button,onclick,secondary){
  const form=document.getElementById('signupForm');if(!form)return;
  form.innerHTML=`<div id="d2a"><style>#d2a{display:grid;gap:10px;color:#24343a}#d2a .h,#d2a .c{background:#fff;border:1px solid #dce8e9;border-radius:14px;padding:14px}#d2a .h{background:#eef7f8}#d2a h2{margin:2px 0 5px;font-size:23px}#d2a p{margin:0;color:#687680;line-height:1.6;font-size:15px}.b{min-height:42px;border:0;border-radius:8px;padding:8px 14px;font-size:15px;font-weight:900}.pri{background:#4f8f9d;color:#fff}.alt{background:#fff;border:1px solid #dce8e9;margin-left:8px}</style><section class="h"><small>DOING 營運帳號</small><h2>${title}</h2><p>${text}</p></section><section class="c"><button class="b pri" id="formalPrimary" type="button">${button}</button>${secondary?'<button class="b alt" id="formalSecondary" type="button">重新填寫</button>':''}</section></div>`;
  document.getElementById('formalPrimary').onclick=onclick;if(secondary)document.getElementById('formalSecondary').onclick=()=>{clearSnapshot();const u=new URL('/apply/',location.origin);location.replace(u.toString())};
}
async function resumeAfterLine(){
  const u=new URL(location.href),resume=u.searchParams.get('doing_application_resume')==='1';if(!resume)return false;
  const incoming=String(u.searchParams.get('member_token')||'').trim(),err=String(u.searchParams.get('member_login_error')||u.searchParams.get('login_error')||'').trim();
  if(incoming)localStorage.setItem(TOKEN_KEY,incoming);cleanApplicationUrl();
  const snap=readSnapshot();if(!snap){statusCard('申請資料已逾時','請重新填寫申請資料，再完成 LINE 驗證。','重新填寫',()=>{location.replace(new URL('/apply/',location.origin).toString())});return true}
  if(err||!incoming){statusCard('LINE 驗證尚未完成','申請資料已保留，不用重填；重新完成 LINE 驗證即可。','重新驗證',()=>startLineVerification(),true);return true}
  statusCard('LINE 驗證完成','正在確認你的 DOING 營運空間。','正在確認…',()=>{});
  const payload={...snap.payload,member_token:incoming};
  const profile=await saveMemberContact(incoming,payload.application||{});
  if(profile.d&&profile.d.error){if(routeKnownApplicationState(profile.d.error))return true;if(isAuthExpired(profile.d.error)){localStorage.removeItem(TOKEN_KEY);statusCard('LINE 登入已失效','申請資料仍保留，重新驗證即可。','重新驗證',()=>startLineVerification(),true);return true}statusCard('會員資料無法完成',String(profile.d.error),'回到我的 DOING',()=>location.replace(memberOperations().toString()),true);return true}
  const state=await readMemberState(incoming);if(routeResolvedMemberState(state))return true;
  const r=await originalFetch(API+'?action=createOrganizerApplicationDraft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),d=await r.json().catch(()=>({}));
  if(!r.ok||d.error){if(routeKnownApplicationState(d.error))return true;statusCard('申請尚未完成',String(d.error||'申請資料保存失敗'),'重新驗證',()=>startLineVerification(),true);return true}
  if(d.existingWorkspace){clearSnapshot();location.replace(memberOperations({application_status:'existing_workspace'}).toString());return true}
  if(d.existingApplication){clearSnapshot();location.replace(memberOperations({post_application:'1',application_id:d.applicationId||''}).toString());return true}
  if(!d.lineVerified){if(d.applicationId){const auth=new URL(API+'/auth/line/start');auth.searchParams.set('mode','organizer_signup');auth.searchParams.set('application_id',String(d.applicationId));location.replace(auth.toString());return true}statusCard('申請尚未完成','LINE 身分已登入，但正式申請驗證沒有完成。','重新驗證',()=>startLineVerification(),true);return true}
  clearSnapshot();const done=new URL('/apply/',location.origin);done.searchParams.set('application_status',String(d.status||'pending'));done.searchParams.set('application_id',String(d.applicationId||''));if(d.tenantId)done.searchParams.set('tenant_id',String(d.tenantId));location.replace(done.toString());return true;
}
async function existingWorkspacePreflight(){
  const u=new URL(location.href);if(u.searchParams.get('doing_application_resume')==='1'||['application_status','application_id','member_token','member_login_error','login_error'].some(k=>u.searchParams.has(k)))return;
  const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)return;
  const state=await readMemberState(token);if(!state)return;
  if(state.workspaces.length){statusCard('你的工作空間已經開通','這個會員已經有自己的 DOING 工作空間，不需要重新申請。','進入我的 DOING',()=>location.replace(memberOperations().toString()));return}
  if(state.pending){statusCard('你的申請已送出','這個會員已有申請紀錄，不需要重新填寫或重複送出。','查看我的 DOING',()=>location.replace(memberOperations({post_application:'1',application_id:state.pending.id||''}).toString()));return}
}
setTimeout(async()=>{const resumed=await resumeAfterLine();if(!resumed)await existingWorkspacePreflight()},0);
})();
