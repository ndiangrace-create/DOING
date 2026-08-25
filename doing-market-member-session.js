(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const TOKEN_KEY='doing_member_token';
let cached=null,loading=null;
function token(){try{return String(new URL(location.href).searchParams.get('member_token')||localStorage.getItem(TOKEN_KEY)||'').trim()}catch(_){return String(new URL(location.href).searchParams.get('member_token')||'').trim()}}
function persistIncoming(){const u=new URL(location.href),t=String(u.searchParams.get('member_token')||'').trim();if(!t)return;try{localStorage.setItem(TOKEN_KEY,t)}catch(_){}for(const k of['member_token','member_status','member_login_error','login_error'])u.searchParams.delete(k);history.replaceState({},'',u.pathname+u.search+u.hash)}
function clear(){try{localStorage.removeItem(TOKEN_KEY)}catch(_){}cached=null;loading=null}
function isAuthError(status,msg){return status===401||/登入已失效|重新.*登入|token.*(?:失效|過期|invalid|expired)/i.test(String(msg||''))}
function returnUrl(){const u=new URL(location.href);for(const k of['member_token','member_status','member_login_error','login_error'])u.searchParams.delete(k);return u.toString()}
function startLine(){const u=new URL(API+'/auth/line/start');u.searchParams.set('mode','member');u.searchParams.set('return_url',returnUrl());location.assign(u.toString())}
async function load(force=false){const t=token();if(!t)return null;if(cached&&!force)return cached;if(loading&&!force)return loading;loading=(async()=>{const u=new URL(API);u.searchParams.set('action','getPlatformMemberProfile');u.searchParams.set('member_token',t);let r,d;try{r=await fetch(u,{cache:'no-store'});d=await r.json().catch(()=>({}))}catch(e){throw e}if(!r.ok||d?.ok===false||d?.error){const msg=d?.error||'會員狀態讀取失敗';if(isAuthError(r.status,msg)){clear();const e=Error(msg);e.authExpired=true;throw e}throw Error(msg)}cached=d?.data??d?.result??d;return cached})().finally(()=>{loading=null});return loading}
window.doingMemberToken=token;
window.doingMemberProfile=()=>cached?.profile||cached?.member||null;
window.doingMemberBrands=()=>Array.isArray(cached?.brands)?cached.brands:[];
window.doingMemberSessionData=()=>cached;
window.doingRequireMember=async function(){if(!token()){startLine();return false}try{await load();return true}catch(e){if(e?.authExpired){startLine();return false}const msg='登入狀態還在，但目前連線失敗。請稍後再按一次，不需要重新驗證 LINE。';if(typeof window.showMessage==='function')window.showMessage(msg);else if(typeof window.toast==='function')window.toast(msg);else console.warn(msg,e);return false}};
window.doingRefreshMemberSession=()=>load(true);
window.doingMemberLogout=function(){clear()};
persistIncoming();
if(token())load().catch(()=>{});
})();
