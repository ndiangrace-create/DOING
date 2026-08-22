(()=>{
'use strict';
const p=new URL(location.href).searchParams;
const keep=(path)=>{const u=new URL(path,location.origin);for(const k of ['tenant','admin_token','token']){const v=p.get(k);if(v)u.searchParams.set(k,v)}return u.toString()};
const path=location.pathname;
const isPublicHome=path==='/'||/\/doing-2\.html$/.test(path);
const body=document.body;if(!body)return;
if(isPublicHome){
  body.classList.add('d2-public-home');
  if(!document.querySelector('.d2-topbar')){
    const top=document.createElement('header');
    top.className='d2-topbar d2-home-desktop-topbar';
    top.innerHTML=`<div class="d2-topbar-in"><a class="d2-brand" href="${keep('/')}"><div class="d2-brand-copy"><div class="d2-brand-title">DOING</div><div class="d2-brand-sub">協槓人生小幫手</div></div></a><div class="d2-top-actions"><a href="${keep('/')}">首頁</a><a href="${keep('/market/public/')}">報名活動</a><a href="${keep('/me/#activities')}">我的紀錄</a><a href="${keep('/apply/')}">我要申請</a></div></div>`;
    body.prepend(top);
    const sync=()=>{const desktop=matchMedia('(min-width:621px)').matches;top.style.setProperty('display',desktop?'block':'none','important');if(desktop){top.style.setProperty('position','fixed','important');top.style.setProperty('top','0','important');top.style.setProperty('left','0','important');top.style.setProperty('right','0','important');top.style.setProperty('z-index','1000','important');requestAnimationFrame(()=>document.body.style.setProperty('padding-top',top.offsetHeight+'px','important'))}else document.body.style.removeProperty('padding-top')};
    sync();const mq=matchMedia('(min-width:621px)');if(mq.addEventListener)mq.addEventListener('change',sync);else if(mq.addListener)mq.addListener(sync);addEventListener('resize',()=>requestAnimationFrame(sync),{passive:true});
  }
  return;
}
const product=path.includes('/market')?'market':path.includes('/project')?'project':path.includes('/booking')?'booking':path.includes('/guide')?'guide':'hub';
if(document.querySelector('.d2-topbar'))return;
const applyLink=`<a href="${keep('/apply/')}">我要申請</a>`;
const marketActions=`${applyLink}<a href="${keep('/me/#account')}">登入／會員</a>`;
const defaultActions=`${applyLink}<a class="optional" href="${keep('/market/public/')}">找活動</a><a href="${keep('/me/#activities')}">我的紀錄</a><a href="${keep('/workspace/')}">我的 DOING</a>`;
const top=document.createElement('header');top.className='d2-topbar';
top.innerHTML=`<div class="d2-topbar-in"><a class="d2-brand" href="${keep('/workspace/')}"><img src="/doing-logo.png" alt="DOING"><div class="d2-brand-copy"><div class="d2-brand-title">${product==='market'?'DOING Market':'DOING 2.0'}</div><div class="d2-brand-sub">${product==='market'?'市集營運':product==='project'?'室內設計':product==='booking'?'預約服務':product==='guide'?'導覽預約':'工作入口'}</div></div></a><div class="d2-top-actions">${product==='market'?marketActions:defaultActions}</div></div><nav class="d2-product-nav"><a class="${product==='market'?'active':''}" href="${keep('/market/')}">Market</a><a class="${product==='project'?'active':''}" href="${keep('/project/')}">Project</a><a class="${product==='booking'?'active':''}" href="${keep('/booking/')}">Booking</a><a class="${product==='guide'?'active':''}" href="${keep('/guide/')}">Guide</a></nav>`;
body.prepend(top);
if(product==='market'){
  const tabs=document.querySelector('.tabs'),topIn=document.querySelector('.d2-topbar-in');if(tabs&&topIn){tabs.classList.add('d2-market-mainnav');topIn.insertBefore(tabs,topIn.querySelector('.d2-top-actions'))}
  const settings=document.querySelector('#settings .settings');
  if(settings){settings.innerHTML=[['付款資訊','銀行／既有付款方式／收款設定','payment'],['合約管理','報名前同意條款與版本','agreement'],['信件／通知模板','錄取／補件／付款／行前通知','notification'],['工作人員／權限','主辦／財務／現場與場次權限','team'],['公司／品牌資料','營運名稱、聯絡與品牌資訊','brand'],['首頁顯示','公告、封面、LINE 與前台顯示','front'],['主題活動','系列／活動主題與首頁精選','theme'],['常用場地圖','保存、重用場地圖與攤位','map'],['活動拍照框','活動框、行銷與名單','photo'],['現場通行碼','現場人員快速操作入口','onsite'],['系統異常／稽核','錯誤紀錄與查修依據','audit']].map(([a,b,key])=>`<a href="#settings" data-setting-key="${key}">${a}<small>${b}</small></a>`).join('')}
  addMarketJourney();
}
document.querySelectorAll('.note').forEach(el=>{if(/不重建資料庫|QR 功能保留完整|正式資料仍由/.test(el.textContent||''))el.classList.add('d2-hide-engineering')});
for(const el of document.querySelectorAll('.hero p,.muted')){const t=(el.textContent||'').trim();if(t.includes('正式資料仍由 DOING API')||t.includes('第一開發主線')||t.includes('第二開發主線')||t.includes('第三開發主線')||t.includes('第四開發主線'))el.classList.add('d2-hide-engineering')}
function addMarketJourney(){
  if(document.querySelector('.d2-market-journey'))return;
  const hero=document.querySelector('.hero'),main=document.querySelector('main.shell');if(!main)return;
  const session=/\/market\/session\/?$/.test(path);
  const items=session?[['場次總覽','/market/'],['場次設定','#overview'],['待辦','/market/#tasks'],['審核','#registrations'],['付款','#payments'],['排位','#seat'],['退款','#closeout'],['財務結案','#closeout']]:[['後台入口','/workspace/'],['場次總覽','#sessions'],['場次設定','#sessions'],['待辦','#tasks'],['審核','#sessions'],['付款','#sessions'],['排位','#sessions'],['退款','#sessions'],['財務結案','#sessions']];
  const nav=document.createElement('nav');nav.className='d2-market-journey';nav.setAttribute('aria-label','Market 操作路徑');nav.innerHTML=items.map(([label,target],i)=>`<a href="${target.startsWith('/')?keep(target):target}" class="d2-market-journey-step ${i===0?'done':''}">${label}</a>`).join('');
  (hero||main.firstElementChild)?.insertAdjacentElement(hero?'afterend':'beforebegin',nav);
  const st=document.createElement('style');st.textContent='.d2-market-journey{display:flex;gap:7px;overflow:auto;margin:10px 0 14px;padding:2px 1px 7px;scrollbar-width:none}.d2-market-journey::-webkit-scrollbar{display:none}.d2-market-journey-step{flex:0 0 auto;min-height:40px;padding:8px 12px;border-radius:14px;border:1px solid #e8def2;background:#fff;color:#67529a;text-decoration:none;font-weight:900;box-shadow:0 4px 10px rgba(90,70,120,.08)}.d2-market-journey-step.done{background:#dff0b0;border-color:#c6dc7b;color:#53681d}@media(max-width:620px){.d2-market-journey{margin:8px 0 10px}.d2-market-journey-step{min-height:36px;padding:7px 10px;font-size:12px}}';document.head.appendChild(st);
  nav.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const id=a.getAttribute('href').slice(1);const tab=document.querySelector(`[data-tab="${CSS.escape(id)}"]`);if(tab){e.preventDefault();tab.click();history.replaceState(null,'','#'+id);document.querySelector('.panel.on')?.scrollIntoView({block:'start',behavior:'smooth'})}}));
}
})();
