(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const targets=[...document.querySelectorAll('[data-doing-admin-entry]')];
if(!targets.length)return;
const style=document.createElement('style');
style.textContent='[data-doing-admin-entry]{position:relative;user-select:none;-webkit-user-select:none}[data-doing-admin-entry].doing-entry-holding{outline:3px solid rgba(47,143,139,.28);outline-offset:3px;border-radius:16px}[data-doing-admin-entry] img{object-fit:contain}';
document.head.appendChild(style);
let timer=null,pointer=null,origin=null,target=null,opened=false;
const tenant=()=>String(new URL(location.href).searchParams.get('tenant')||document.body.dataset.tenant||'').trim().toLowerCase();
function clear(){if(timer)clearTimeout(timer);timer=null;pointer=null;origin=null;target?.classList.remove('doing-entry-holding');target=null}
function enter(){const t=tenant();opened=true;clear();if(t){location.href='admin.html?tenant='+encodeURIComponent(t)+'&from='+encodeURIComponent(location.pathname.split('/').pop().replace('.html','')||'page');return}const u=new URL(API+'/auth/line/start');u.searchParams.set('mode','platform');u.searchParams.set('tenant','platform');location.href=u.toString()}
document.addEventListener('pointerdown',e=>{const el=e.target.closest?.('[data-doing-admin-entry]');if(!el||(e.pointerType==='mouse'&&e.button!==0))return;clear();opened=false;pointer=e.pointerId;origin={x:e.clientX,y:e.clientY};target=el;el.classList.add('doing-entry-holding');timer=setTimeout(enter,3000)},true);
document.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||!origin||!target)return;const r=target.getBoundingClientRect();if(Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>12||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)clear()},true);
['pointerup','pointercancel','lostpointercapture'].forEach(name=>document.addEventListener(name,clear,true));
document.addEventListener('click',e=>{if(opened&&e.target.closest?.('[data-doing-admin-entry]')){e.preventDefault();e.stopImmediatePropagation();opened=false}},true);
document.addEventListener('contextmenu',e=>{if(e.target.closest?.('[data-doing-admin-entry]'))e.preventDefault()},true);
})();
