(()=>{
'use strict';
const params=new URL(location.href).searchParams,path=location.pathname,body=document.body;if(!body)return;
const publicUrl=path=>new URL(path,location.origin).toString();
const workUrl=path=>{const u=new URL(path,location.origin);for(const k of ['tenant','admin_token','token']){const v=params.get(k);if(v)u.searchParams.set(k,v)}return u.toString()};
const hasMember=()=>{try{return !!(localStorage.getItem('doing_member_token')||sessionStorage.getItem('doing_member_token'))}catch(_){return false}};
const style=document.createElement('style');style.textContent=`
.d2-home-account-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:0 auto 24px}.d2-home-account{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:9px 18px;border-radius:10px;text-decoration:none;font-weight:950;border:1px solid #d6e4e7;box-shadow:0 3px 0 #d5e1e4}.d2-home-account.apply{background:#fff;color:#48606a}.d2-home-account.login{background:#bfe9e6;color:#23484a;border-color:#9ed5d1}.d2-home-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important;max-width:760px}.d2-home-action{min-height:66px!important;font-size:20px!important;border-radius:16px!important}.d2-top-actions a[data-account-entry]{font-weight:950}.d2-top-actions a[data-account-entry="login"]{background:#dff2ef}
@media(max-width:620px){.d2-home-account-actions{margin-bottom:16px}.d2-home-account{min-height:42px;padding:8px 14px}.d2-home-actions{grid-template-columns:1fr 1fr!important}.d2-home-action{min-height:54px!important;font-size:16px!important}}
`;document.head.appendChild(style);
const isPublicHome=path==='/'||/\/doing-2\.html$/.test(path);
if(isPublicHome){
  body.classList.add('d2-public-home');
  if(!document.querySelector('.d2-topbar')){
    const top=document.createElement('header');top.className='d2-topbar d2-home-desktop-topbar';
    top.innerHTML=`<div class="d2-topbar-in"><a class="d2-brand" href="/"><div class="d2-brand-copy"><div class="d2-brand-title">DOING</div><div class="d2-brand-sub">協槓人生小幫手</div></div></a><div class="d2-top-actions"><a data-account-entry="apply" href="/apply/">申請 DOING</a><a data-account-entry="login" href="/me/">${hasMember()?'我的 DOING':'登入'}</a></div></div>`;
    body.prepend(top);
    const sync=()=>{const desktop=matchMedia('(min-width:621px)').matches;top.style.setProperty('display',desktop?'block':'none','important');if(desktop){top.style.setProperty('position','fixed','important');top.style.setProperty('top','0','important');top.style.setProperty('left','0','important');top.style.setProperty('right','0','important');top.style.setProperty('z-index','1000','important');requestAnimationFrame(()=>document.body.style.setProperty('padding-top',top.offsetHeight+'px','important'))}else document.body.style.removeProperty('padding-top')};
    sync();const mq=matchMedia('(min-width:621px)');if(mq.addEventListener)mq.addEventListener('change',sync);else if(mq.addListener)mq.addListener(sync);addEventListener('resize',()=>requestAnimationFrame(sync),{passive:true});
  }
  return;
}
const product=path.includes('/market')?'market':path.includes('/project')?'project':path.includes('/booking')?'booking':path.includes('/guide')?'guide':'hub';
if(document.querySelector('.d2-topbar'))return;
const top=document.createElement('header');top.className='d2-topbar';
top.innerHTML=`<div class="d2-topbar-in"><a class="d2-brand" href="${publicUrl('/')}"><img src="/doing-logo.png" alt="DOING"><div class="d2-brand-copy"><div class="d2-brand-title">${product==='market'?'DOING Market':'DOING'}</div><div class="d2-brand-sub">${product==='market'?'市集營運':product==='project'?'室內設計':product==='booking'?'預約服務':product==='guide'?'導覽預約':'工作空間'}</div></div></a><div class="d2-top-actions"><a href="/">首頁</a><a data-account-entry="login" href="/me/">我的 DOING</a></div></div><nav class="d2-product-nav"><a class="${product==='market'?'active':''}" href="${workUrl('/market/')}">Market</a><a class="${product==='project'?'active':''}" href="${workUrl('/project/')}">Project</a><a class="${product==='booking'?'active':''}" href="${workUrl('/booking/')}">Booking</a><a class="${product==='guide'?'active':''}" href="${workUrl('/guide/')}">Guide</a></nav>`;
body.prepend(top);
if(product==='market'){
  const tabs=document.querySelector('.tabs'),topIn=document.querySelector('.d2-topbar-in');if(tabs&&topIn){tabs.classList.add('d2-market-mainnav');topIn.insertBefore(tabs,topIn.querySelector('.d2-top-actions'))}
  const settings=document.querySelector('#settings .settings');
  if(settings){settings.innerHTML=[['付款資訊','銀行／既有付款方式／收款設定','payment'],['合約管理','報名前同意條款與版本','agreement'],['信件／通知模板','錄取／補件／付款／行前通知','notification'],['工作人員／權限','主辦／財務／現場與場次權限','team'],['公司／品牌資料','營運名稱、聯絡與品牌資訊','brand'],['首頁顯示','公告、封面、LINE 與前台顯示','front'],['主題活動','系列／活動主題與首頁精選','theme'],['常用場地圖','保存、重用場地圖與攤位','map'],['活動拍照框','活動框、行銷與名單','photo'],['現場通行碼','現場人員快速操作入口','onsite'],['系統異常／稽核','錯誤紀錄與查修依據','audit']].map(([a,b,key])=>`<a href="#settings" data-setting-key="${key}">${a}<small>${b}</small></a>`).join('')}
  addMarketJourney();
}
document.querySelectorAll('.note').forEach(el=>{if(/不重建資料庫|QR 功能保留完整|正式資料仍由/.test(el.textContent||''))el.classList.add('d2-hide-engineering')});
function addMarketJourney(){
  if(document.querySelector('.d2-market-journey'))return;const hero=document.querySelector('.hero'),main=document.querySelector('main.shell');if(!main)return;
  const session=/\/market\/session\/?$/.test(path),items=session?[['場次總覽','/market/'],['場次設定','#overview'],['待辦','/market/#tasks'],['審核','#registrations'],['付款','#payments'],['排位','#seat'],['退款','#closeout'],['財務結案','#closeout']]:[['工作空間','/workspace/'],['場次總覽','#sessions'],['場次設定','#sessions'],['待辦','#tasks'],['審核','#sessions'],['付款','#sessions'],['排位','#sessions'],['退款','#sessions'],['財務結案','#sessions']];
  const nav=document.createElement('nav');nav.className='d2-market-journey';nav.setAttribute('aria-label','Market 操作路徑');nav.innerHTML=items.map(([label,target],i)=>`<a href="${target.startsWith('/')?workUrl(target):target}" class="d2-market-journey-step ${i===0?'done':''}">${label}</a>`).join('');(hero||main.firstElementChild)?.insertAdjacentElement(hero?'afterend':'beforebegin',nav);
  const st=document.createElement('style');st.textContent='.d2-market-journey{display:flex;gap:7px;overflow:auto;margin:10px 0 14px;padding:2px 1px 7px;scrollbar-width:none}.d2-market-journey-step{flex:0 0 auto;min-height:40px;padding:8px 12px;border-radius:12px;border:1px solid #dfe8ea;background:#fff;color:#53636d;text-decoration:none;font-weight:900}.d2-market-journey-step.done{background:#e6f4ed;color:#3d674d}@media(max-width:620px){.d2-market-journey-step{min-height:36px;padding:7px 10px;font-size:12px}}';document.head.appendChild(st);
  nav.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const id=a.getAttribute('href').slice(1),tab=document.querySelector(`[data-tab="${CSS.escape(id)}"]`);if(tab){e.preventDefault();tab.click();history.replaceState(null,'','#'+id)}}));
}
})();
