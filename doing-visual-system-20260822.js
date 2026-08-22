(()=>{
'use strict';
const body=document.body;if(!body)return;
body.classList.add('d2-visual-system');
const p=location.pathname.replace(/\/+$/,'')||'/';
const cls=p==='/'?'home':p.startsWith('/market/session')?'market-session':p.startsWith('/market/public')?'market-public':p.startsWith('/market')?'market':p.startsWith('/project')?'project':p.startsWith('/booking')?'booking':p.startsWith('/guide')?'guide':p.startsWith('/workspace')?'workspace':p.startsWith('/me')?'me':p.startsWith('/apply')?'apply':p.startsWith('/register')?'register':'page';
body.classList.add('d2-page-'+cls);

// Stable page states: never leave the user with a blank screen.
const main=document.querySelector('main,.shell,.app');
if(main&&!main.children.length){const box=document.createElement('section');box.className='empty';box.dataset.state='error';box.textContent='畫面暫時無法載入，請重新整理後再試。';main.appendChild(box)}

// Preserve shallow-navigation UI state on back/forward within the same workspace.
const stateKey='doing2:view:'+p;
const tabs=[...document.querySelectorAll('.tab[data-tab],.tab[data-page]')];
const read=()=>{try{return JSON.parse(sessionStorage.getItem(stateKey)||'{}')}catch(_){return{}}};
const save=(extra={})=>{try{sessionStorage.setItem(stateKey,JSON.stringify({...read(),scrollY:window.scrollY,...extra}))}catch(_){}};
if(tabs.length){tabs.forEach(tab=>tab.addEventListener('click',()=>{const key=tab.dataset.tab||tab.dataset.page||'';if(key)save({tab:key})}));const wanted=read().tab;if(wanted){const hit=tabs.find(x=>(x.dataset.tab||x.dataset.page)===wanted);if(hit&&!hit.classList.contains('on')&&!hit.classList.contains('active'))setTimeout(()=>hit.click(),0)}}
window.addEventListener('pagehide',()=>save());
window.addEventListener('pageshow',e=>{const y=Number(read().scrollY||0);if(e.persisted&&y>0)setTimeout(()=>scrollTo(0,y),0)});

// Inline feedback semantics for common state containers.
document.querySelectorAll('.empty').forEach(el=>{if(!el.dataset.state)el.dataset.state='empty'});
document.querySelectorAll('.loading').forEach(el=>el.dataset.state='loading');

// Prevent engineering-only copy from leaking into user-facing pages.
const forbidden=/tenant_id|tenant id|Supabase|資料表|API\/?|Worker\b|productionWrites|debug|工程代碼|內部路徑/i;
document.querySelectorAll('.note,.muted,.sub,.help').forEach(el=>{const t=(el.textContent||'').trim();if(t&&forbidden.test(t))el.classList.add('d2-hide-engineering')});

// Market completion layer: same UI language across discovery, registration, member history and organizer session work.
if(['market','market-public','market-session','me','register'].includes(cls)){
  if(!document.querySelector('link[data-market-completion]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/doing-market-completion-v16.css?v=20260822-v16';l.dataset.marketCompletion='1';document.head.appendChild(l)}
  if(!document.querySelector('script[data-market-completion]')){const s=document.createElement('script');s.src='/doing-market-completion-v16.js?v=20260822-v16';s.defer=true;s.dataset.marketCompletion='1';document.body.appendChild(s)}
}
})();
