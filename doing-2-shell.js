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
    top.innerHTML=`<div class="d2-topbar-in"><a class="d2-brand" href="${keep('/')}"><div class="d2-brand-copy"><div class="d2-brand-title">DOING</div><div class="d2-brand-sub">協槓人生小幫手</div></div></a><div class="d2-top-actions"><a href="${keep('/')}">首頁</a><a href="${keep('/market/public/')}">報名活動</a><a href="${keep('/member-panel.html#activities')}">我的紀錄</a><a href="${keep('/smart-application.html')}">我要申請</a></div></div>`;
    body.prepend(top);
    const sync=()=>{
      const desktop=matchMedia('(min-width:621px)').matches;
      top.style.setProperty('display',desktop?'block':'none','important');
      top.style.setProperty('position',desktop?'fixed':'','important');
      top.style.setProperty('top',desktop?'0':'','important');
      top.style.setProperty('left',desktop?'0':'','important');
      top.style.setProperty('right',desktop?'0':'','important');
      top.style.setProperty('width',desktop?'100%':'','important');
      top.style.setProperty('z-index',desktop?'1000':'','important');
      if(desktop){
        requestAnimationFrame(()=>body.style.setProperty('padding-top',`${top.offsetHeight}px`,'important'));
      }else{
        body.style.removeProperty('padding-top');
      }
    };
    sync();
    const mq=matchMedia('(min-width:621px)');
    if(mq.addEventListener)mq.addEventListener('change',sync);else if(mq.addListener)mq.addListener(sync);
    addEventListener('resize',sync,{passive:true});
  }
  return;
}
const product=path.includes('market')?'market':path.includes('project')?'project':path.includes('booking')?'booking':path.includes('guide')?'guide':'hub';
if(document.querySelector('.d2-topbar'))return;
const applyLink=`<a href="${keep('/smart-application.html')}">我要申請</a>`;
const marketActions=`${applyLink}<a href="${keep('/member-panel.html#account')}">登入／會員</a>`;
const defaultActions=`${applyLink}<a class="optional" href="${keep('/market/public/')}">找活動</a><a href="${keep('/member-panel.html#activities')}">我的報名</a><a href="${keep('/')}">首頁</a>`;
const top=document.createElement('header');top.className='d2-topbar';
top.innerHTML=`<div class="d2-topbar-in"><a class="d2-brand" href="${keep('/')}"><img src="/doing-logo.png" alt="DOING"><div class="d2-brand-copy"><div class="d2-brand-title">${product==='market'?'DOING Market':'DOING 2.0'}</div><div class="d2-brand-sub">${product==='market'?'市集營運':product==='project'?'室內設計':product==='booking'?'預約服務':product==='guide'?'導覽預約':'工作入口'}</div></div></a><div class="d2-top-actions">${product==='market'?marketActions:defaultActions}</div></div><nav class="d2-product-nav"><a class="${product==='market'?'active':''}" href="${keep('/market/')}">Market</a><a class="${product==='project'?'active':''}" href="${keep('/project/')}">Project</a><a class="${product==='booking'?'active':''}" href="${keep('/booking/')}">Booking</a><a class="${product==='guide'?'active':''}" href="${keep('/guide/')}">Guide</a></nav>`;
body.prepend(top);
if(product==='market'){
  const tabs=document.querySelector('.tabs'),topIn=document.querySelector('.d2-topbar-in');if(tabs&&topIn){tabs.classList.add('d2-market-mainnav');topIn.insertBefore(tabs,topIn.querySelector('.d2-top-actions'))}
  const settings=document.querySelector('#settings .settings');if(settings){const to=keep('/admin.html#settings');settings.innerHTML=[['付款資訊','銀行／既有付款方式／收款設定'],['合約管理','報名前同意條款與版本'],['信件／通知模板','錄取／補件／付款／行前通知'],['工作人員／權限','主辦／財務／現場與場次權限'],['公司／品牌資料','營運名稱、聯絡與品牌資訊'],['首頁顯示','公告、封面、LINE 與前台顯示'],['主題活動','系列／活動主題與首頁精選'],['常用場地圖','保存、重用場地圖與攤位'],['活動拍照框','活動框、行銷與名單'],['現場通行碼','現場人員快速操作入口'],['系統異常／稽核','錯誤紀錄與查修依據']].map(([a,b])=>`<a href="${to}">${a}<small>${b}</small></a>`).join('')}
}
document.querySelectorAll('.note').forEach(el=>{if(/不重建資料庫|QR 功能保留完整|正式資料仍由/.test(el.textContent||''))el.classList.add('d2-hide-engineering')});
for(const el of document.querySelectorAll('.hero p,.muted')){const t=(el.textContent||'').trim();if(t.includes('正式資料仍由 DOING API')||t.includes('第一開發主線')||t.includes('第二開發主線')||t.includes('第三開發主線')||t.includes('第四開發主線'))el.classList.add('d2-hide-engineering')}
})();