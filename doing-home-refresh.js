(()=>{
  const byId=id=>document.getElementById(id);
  const esc2=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function reorderNav(){
    const nav=byId('doingGlobalFixedNav');if(!nav)return;
    const search=byId('globalSearchNavBtn'),my=byId('globalMyNavBtn'),support=byId('globalSupportNavBtn');
    const pricing=nav.querySelector('a[href*="#pricing"]'),apply=nav.querySelector('a[href*="#apply"]');
    [search,my,support,pricing,apply].filter(Boolean).forEach(x=>nav.appendChild(x));
  }
  function getSearchOverlay(){return document.querySelector('.doing-search-overlay')}
  function goToSearch(){
    try{if(typeof setPage==='function')setPage('sessions')}catch(e){}
    const overlay=getSearchOverlay();if(!overlay)return;
    const top=window.scrollY+overlay.getBoundingClientRect().top-105;
    window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
    setTimeout(()=>byId('doingGlobalSearchInput')?.focus({preventScroll:true}),480);
  }
  function ensureInlineResults(){
    let box=byId('doingHomeInlineResults');if(box)return box;
    const stage=document.querySelector('.doing-svg-stage');if(!stage)return null;
    box=document.createElement('section');box.id='doingHomeInlineResults';box.className='doing-home-inline-results hidden';box.setAttribute('aria-live','polite');
    box.innerHTML='<div class="doing-home-inline-head"><b id="doingHomeInlineTitle">搜尋結果</b><button type="button" class="doing-home-inline-close" aria-label="關閉">×</button></div><div id="doingHomeInlineGrid" class="doing-home-inline-grid"></div>';
    box.querySelector('.doing-home-inline-close').onclick=()=>box.classList.add('hidden');stage.appendChild(box);return box;
  }
  function dateText(rows){const a=Array.isArray(rows)?rows:[];if(!a.length)return '日期待公告';const d=a[0];return String((d&&typeof d==='object'?(d.label||d.date):d)||'日期待公告')}
  function runInlineSearch(){
    const input=byId('doingGlobalSearchInput');if(!input)return;
    const q=String(input.value||'').trim().toLowerCase();
    let rows=[];try{rows=(typeof state!=='undefined'&&Array.isArray(state.discoveryItems))?state.discoveryItems:[]}catch(e){}
    const hit=!q?rows:rows.filter(x=>[x.sessionName,x.eventTitle,x.tenantName,x.venue,x.description].join(' ').toLowerCase().includes(q));
    const box=ensureInlineResults(),grid=byId('doingHomeInlineGrid'),title=byId('doingHomeInlineTitle');if(!box||!grid||!title)return;
    title.textContent=q?`找到 ${hit.length} 筆「${q}」`:`最近可以參加的活動`;
    grid.innerHTML=hit.length?hit.slice(0,20).map(x=>`<a class="doing-home-result" href="?tenant=${encodeURIComponent(x.tenantId||'')}&session=${encodeURIComponent(x.sessionId||'')}"><div class="doing-home-result-cover">${x.cover?`<img src="${esc2(x.cover)}" alt="">`:''}</div><div><b>${esc2(x.sessionName||'活動')}</b><span>${esc2(x.tenantName||'')} · ${esc2(dateText(x.dates))} · ${esc2(x.venue||'地點待公告')}</span></div><em>查看</em></a>`).join(''):'<div class="doing-home-noresult">目前沒有符合的活動，換個關鍵字試試看。</div>';
    box.classList.remove('hidden');
    const top=window.scrollY+box.getBoundingClientRect().top-105;window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
  }
  function wire(){
    reorderNav();
    const input=byId('doingGlobalSearchInput');if(input){input.placeholder='搜尋活動、課程、體驗或地點';input.setAttribute('autocomplete','off');}
    const navBtn=byId('globalSearchNavBtn');if(navBtn)navBtn.onclick=goToSearch;
    const go=byId('doingGlobalSearchGo');if(go)go.onclick=runInlineSearch;
    if(input)input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();runInlineSearch()}};
    ensureInlineResults();
    // 公開首頁不應出現「主辦空間」類提示；只有 tenant 模式才需要主辦識別。
    const originalToast=(typeof toast==='function')?toast:null;
    if(originalToast&&typeof window!=='undefined'){
      window.doingPublicToast=(msg)=>{const t=String(msg||'');if(!new URL(location.href).searchParams.get('tenant')&&/無法辨識主辦空間|主辦提供的活動連結/.test(t))return;originalToast(msg)};
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();
