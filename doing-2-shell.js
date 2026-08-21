(()=>{
'use strict';
const p=new URL(location.href).searchParams;
const keep=(path)=>{const u=new URL(path,location.origin);for(const k of ['tenant','admin_token','token']){const v=p.get(k);if(v)u.searchParams.set(k,v)}return u.toString()};
const path=location.pathname;
const product=path.includes('market')?'market':path.includes('project')?'project':path.includes('booking')?'booking':path.includes('guide')?'guide':'hub';
const body=document.body;
if(!body||document.querySelector('.d2-topbar'))return;
const top=document.createElement('header');top.className='d2-topbar';
top.innerHTML=`<div class="d2-topbar-in"><a class="d2-brand" href="${keep('/')}"><img src="/doing-logo.png" alt="DOING"><div class="d2-brand-copy"><div class="d2-brand-title">DOING 2.0</div><div class="d2-brand-sub">${product==='market'?'市集營運':product==='project'?'室內設計':product==='booking'?'預約服務':product==='guide'?'導覽預約':'工作入口'}</div></div></a><div class="d2-top-actions"><a class="optional" href="${keep('/market/public/')}">找活動</a><a href="${keep('/member-panel.html#activities')}">我的報名</a><a href="${keep('/')}">首頁</a></div></div><nav class="d2-product-nav"><a class="${product==='market'?'active':''}" href="${keep('/market/')}">Market</a><a class="${product==='project'?'active':''}" href="${keep('/project/')}">Project</a><a class="${product==='booking'?'active':''}" href="${keep('/booking/')}">Booking</a><a class="${product==='guide'?'active':''}" href="${keep('/guide/')}">Guide</a></nav>`;
body.prepend(top);
if(product==='hub'){
  const main=document.querySelector('main.shell');
  if(main){
    main.innerHTML=`<section class="d2-hub-hero"><div class="d2-hub-main"><div style="font-weight:950;color:#5f8c80;margin-bottom:6px">DOING 2.0</div><h1>今天要做什麼？</h1><p>從同一個 DOING 入口，進入你現在要工作的系統。每個系統各自獨立操作，但會員、權限、資料與 Core 都共用同一套正式來源。</p></div><div class="d2-hub-side"><b>目前先完成 Market</b><span>市集／活動／體驗先做到可直接營運；其他系統入口已保留。</span></div></section><section class="d2-hub-grid"><a class="d2-product-card active-product" href="${keep('/market/')}"><h2>DOING Market</h2><p>市集、活動、體驗。場次、待辦、現場、會員、設定。</p><div class="d2-cta">進入 Market →</div></a><a class="d2-product-card" href="${keep('/project/')}"><h2>DOING Project</h2><p>室內設計與工程專案管理。</p><div class="d2-cta">進入 Project →</div></a><a class="d2-product-card" href="${keep('/booking/')}"><h2>DOING Booking</h2><p>美類與一般服務預約。</p><div class="d2-cta">進入 Booking →</div></a><a class="d2-product-card" href="${keep('/guide/')}"><h2>DOING Guide</h2><p>導覽員與導覽預約。</p><div class="d2-cta">進入 Guide →</div></a></section>`;
  }
}
// 移除工程用說明文字，保留真正操作標籤。
document.querySelectorAll('.note').forEach(el=>{if(/不重建資料庫|QR 功能保留完整|正式資料仍由/.test(el.textContent||''))el.classList.add('d2-hide-engineering')});
for(const el of document.querySelectorAll('.hero p,.muted')){
  const t=(el.textContent||'').trim();
  if(t.includes('正式資料仍由 DOING API')||t.includes('第一開發主線')||t.includes('第二開發主線')||t.includes('第三開發主線')||t.includes('第四開發主線'))el.classList.add('d2-hide-engineering');
}
})();
