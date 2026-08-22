(()=>{'use strict';
const path=location.pathname.replace(/\/+$/,'')||'/';
if(!['/market','/market/public','/market/session'].includes(path))return;
document.body.classList.add('mk-ui');
if(path==='/market/public')document.body.classList.add('mk-public');
if(path==='/market')document.body.classList.add('mk-admin');
if(path==='/market/session')document.body.classList.add('mk-session');
const keep=(target)=>{const u=new URL(target,location.origin);const p=new URL(location.href).searchParams;for(const k of ['tenant','admin_token','token','sessionId','session_id']){const v=p.get(k);if(v&&!(target==='/market/public/'&&/^session/.test(k)))u.searchParams.set(k,v)}return u.toString()};
function addPath(){const hero=document.querySelector('.hero');if(!hero||document.querySelector('.mk-path'))return;let steps=[];
 if(path==='/market/public')steps=[['活動探索','done'],['會員／登入','done'],['報名',''],['付款',''],['排位／設備',''],['現場',''],['歷史紀錄','']];
 if(path==='/market')steps=[['後台入口','done'],['場次總覽','on','sessions'],['場次設定','','sessions'],['待辦','','tasks'],['審核','','sessions'],['付款','','sessions'],['排位','','sessions'],['退款','','sessions'],['財務結案','','sessions']];
 if(path==='/market/session')steps=[['場次總覽','', 'market'],['場次設定',''],['待辦','', 'market-tasks'],['審核','', 'registrations'],['付款','', 'payments'],['排位','', 'seat'],['退款','', 'closeout'],['財務結案','', 'closeout']];
 const nav=document.createElement('nav');nav.className='mk-path';nav.setAttribute('aria-label','Market 操作路徑');
 nav.innerHTML=steps.map(([t,cls,target])=>`<button type="button" class="mk-path-step ${cls||''}" data-target="${target||''}">${t}</button>`).join('');
 hero.insertAdjacentElement('afterend',nav);
 nav.querySelectorAll('[data-target]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.target,b)));
}
function go(target,b){if(!target)return;
 if(target==='market'){location.href=keep('/market/');return}
 if(target==='market-tasks'){const u=new URL(keep('/market/'));u.hash='tasks';location.href=u;return}
 const tab=document.querySelector(`[data-tab="${CSS.escape(target)}"]`);if(tab){tab.click();document.querySelector('.tabs')?.scrollIntoView({block:'start',behavior:'smooth'});document.querySelectorAll('.mk-path-step').forEach(x=>x.classList.toggle('on',x===b));return}
 if(target==='sessions'){document.querySelector('[data-tab="sessions"]')?.click();return}
}
function addMobileActions(){if(document.querySelector('.mk-mobile-actions'))return;const nav=document.createElement('nav');nav.className='mk-mobile-actions';nav.setAttribute('aria-label','主要功能');
 nav.innerHTML=`<a class="green" href="${keep('/market/public/')}">報名活動</a><button class="lavender" type="button" id="mkMyRecords">我的紀錄</button><a class="yellow" href="/?support=1">線上客服</a>`;
 document.body.appendChild(nav);
 nav.querySelector('#mkMyRecords').addEventListener('click',()=>{
   if(path==='/market/public'&&document.getElementById('myRegs')){document.getElementById('myRegs').click();return}
   let token='';try{token=localStorage.getItem('doing_member_token')||''}catch(_){}
   const u=new URL('/me/',location.origin);if(token)u.searchParams.set('member_token',token);u.hash='activities';location.href=u.toString();
 });
}
function openHashTab(){const h=location.hash.replace('#','');if(!h)return;const tab=document.querySelector(`[data-tab="${CSS.escape(h)}"]`);if(tab)setTimeout(()=>tab.click(),0)}
addPath();addMobileActions();openHashTab();
})();
