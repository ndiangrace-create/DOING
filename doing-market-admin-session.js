(()=>{
'use strict';
const KEY='doing_market_admin_session';
const MEMBER_KEY='doing_member_token';
const u=new URL(location.href),tenant=String(u.searchParams.get('tenant')||'').trim().toLowerCase(),admin=String(u.searchParams.get('admin_token')||u.searchParams.get('token')||'').trim(),incomingMember=String(u.searchParams.get('member_token')||'').trim();
function payload(token){try{const raw=String(token||'').split('.')[1];if(!raw)return null;const s=raw.replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(decodeURIComponent(escape(atob(s+'='.repeat((4-s.length%4)%4)))))}catch(_){return null}}
function valid(row){if(!row||!row.tenant||!row.adminToken)return false;const p=payload(row.adminToken),exp=Number(p?.expires_at||0);return !!p&&(!exp||exp>Date.now()+60000)&&(!p.tenant_id||String(p.tenant_id).toLowerCase()===String(row.tenant).toLowerCase())}
function save(row){try{localStorage.setItem(KEY,JSON.stringify(row))}catch(_){}}
function clear(){try{localStorage.removeItem(KEY)}catch(_){}}
if(tenant&&admin){const p=payload(admin);save({tenant,adminToken:admin,expiresAt:Number(p?.expires_at||0),savedAt:Date.now()})}
else if(!incomingMember){let row=null;try{row=JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){}if(valid(row)){const next=new URL('/market/',location.origin);next.searchParams.set('tenant',row.tenant);next.searchParams.set('admin_token',row.adminToken);location.replace(next.toString());return}else if(row)clear()}
document.addEventListener('click',e=>{const t=e.target?.closest?.('#marketLogout,#marketRelogin');if(!t)return;clear();if(t.id==='marketLogout'){try{localStorage.removeItem(MEMBER_KEY)}catch(_){}}},true);
window.DOING_MARKET_ADMIN_SESSION={clear};
})();
