(()=>{
'use strict';
const p=new URL(location.href).searchParams;
const tenant=String(p.get('tenant')||'').trim();
const adminToken=String(p.get('admin_token')||p.get('token')||'').trim();
function marketUrl(){
  const u=new URL('/market/',location.origin);
  if(tenant) u.searchParams.set('tenant',tenant);
  if(adminToken) u.searchParams.set('admin_token',adminToken);
  return u.toString();
}
function apply(){
  document.querySelectorAll('[data-work="market"]').forEach(a=>{
    a.href=marketUrl();
    a.dataset.doingProductRoute='market';
  });
}
apply();
new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
})();
