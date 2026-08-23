(()=>{
'use strict';
const p=new URL(location.href).searchParams;
const tenant=String(p.get('tenant')||'').trim();
const adminToken=String(p.get('admin_token')||p.get('token')||'').trim();
const ROUTES={market:'/market/',event:'/market/',course:'/market/',booking:'/booking/',project:'/project/'};
function productUrl(kind){
  const route=ROUTES[kind]||'/workspace/',u=new URL(route,location.origin);
  if(tenant)u.searchParams.set('tenant',tenant);
  if(adminToken)u.searchParams.set('admin_token',adminToken);
  if(kind==='event'||kind==='course')u.searchParams.set('work',kind);
  return u.toString();
}
function apply(){
  document.querySelectorAll('[data-work]').forEach(a=>{
    const kind=String(a.dataset.work||'').trim().toLowerCase();if(!ROUTES[kind])return;
    a.href=productUrl(kind);a.dataset.doingProductRoute=kind;
  });
}
apply();
new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
})();
