(()=>{
  const byId=id=>document.getElementById(id);
  const esc2=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let searchStageTimer=null,searchStageIndex=0,searchPaused=false,searchTouchY=null;

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
    const top=window.scrollY+overlay.getBoundingClientRect().top-90;
    window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
    setTimeout(()=>byId('doingGlobalSearchInput')?.focus({preventScroll:true}),450);
  }
  function realRows(){
    let a=[],b=[];
    try{a=Array.isArray(state.discoveryItems)?state.discoveryItems:[];b=Array.isArray(state.exposureItems)?state.exposureItems:[]}catch(e){}
    const seen=new Set(),out=[];
    [...a,...b].forEach(x=>{const k=String(x.sessionId||x.id||'');if(!k||seen.has(k))return;seen.add(k);out.push(x)});
    return out;
  }
  function dateText(rows){const a=Array.isArray(rows)?rows:[];if(!a.length)return '日期待公告';const d=a[0];return String((d&&typeof d==='object'?(d.label||d.date):d)||'日期待公告')}
  function searchCardPos(stage,items){
    if(!stage||!items.length)return;
    stage.querySelectorAll('.doing-search-3d-card').forEach((el,i)=>{
      let d=i-searchStageIndex,n=items.length;if(d>n/2)d-=n;if(d<-n/2)d+=n;
      let c='off';if(d===0)c='pos0';else if(d===-1)c='posm1';else if(d===1)c='pos1';else if(d===-2)c='posm2';else if(d===2)c='pos2';
      el.className='doing-search-3d-card '+c;
    });
  }
  function renderSearchStage(items,q){
    const stage=byId('doingExposureStage');if(!stage)return;
    clearInterval(searchStageTimer);
    if(!items.length){
      stage.innerHTML=`<div class="doing-stage-caption">搜尋結果</div><div class="doing-exposure-empty">找不到符合的活動，換個關鍵字試試看。</div>`;
      return;
    }
    stage.innerHTML=`<div class="doing-stage-caption">${q?`搜尋「${esc2(q)}」`:'最近可以參加'}</div>`+items.map((x,i)=>`<article class="doing-search-3d-card off" data-i="${i}" tabindex="0" role="link"><div class="x-cover">${x.cover?`<img src="${esc2(x.cover)}" alt="">`:''}</div><div class="x-body"><div class="x-brand">${esc2(x.tenantName||'DOING')}</div><div class="x-title">${esc2(x.sessionName||x.eventTitle||'活動')}</div><div class="x-meta">${esc2(dateText(x.dates))} · ${esc2(x.venue||'地點待公告')}</div><div class="x-cta">查看活動 →</div></div></article>`).join('');
    const cards=[...stage.querySelectorAll('.doing-search-3d-card')];
    cards.forEach(el=>{const open=()=>{const x=items[Number(el.dataset.i)];if(x&&x.tenantId&&x.sessionId)location.href=`?tenant=${encodeURIComponent(x.tenantId)}&session=${encodeURIComponent(x.sessionId)}`};el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
    searchStageIndex=0;searchCardPos(stage,items);
    if(items.length>=3)searchStageTimer=setInterval(()=>{if(!searchPaused){searchStageIndex=(searchStageIndex+1)%items.length;searchCardPos(stage,items)}},4800);
    stage.onmouseenter=()=>searchPaused=true;stage.onmouseleave=()=>searchPaused=false;
    stage.ontouchstart=e=>{searchPaused=true;searchTouchY=e.touches[0]?.clientY??null};
    stage.ontouchend=e=>{const y=e.changedTouches[0]?.clientY??null;if(searchTouchY!=null&&y!=null&&Math.abs(y-searchTouchY)>28){searchStageIndex=(searchStageIndex+(y<searchTouchY?1:-1)+items.length)%items.length;searchCardPos(stage,items)}searchTouchY=null;setTimeout(()=>searchPaused=false,1000)};
    stage.onwheel=e=>{e.preventDefault();searchStageIndex=(searchStageIndex+(e.deltaY>0?1:-1)+items.length)%items.length;searchCardPos(stage,items)};
  }
  function runHomeSearch(){
    const input=byId('doingGlobalSearchInput');if(!input)return;
    const raw=String(input.value||'').trim(),q=raw.toLowerCase(),rows=realRows();
    const hit=!q?rows:rows.filter(x=>[x.sessionName,x.eventTitle,x.tenantName,x.venue,x.description].join(' ').toLowerCase().includes(q));
    renderSearchStage(hit.slice(0,30),raw);
    const stage=byId('doingExposureStage');if(stage){const top=window.scrollY+stage.getBoundingClientRect().top-105;window.scrollTo({top:Math.max(0,top),behavior:'smooth'})}
  }
  function polishPublicPanels(){
    const my=byId('pageMy'),support=byId('pageSupport');
    if(my)my.classList.add('doing-public-panel');if(support)support.classList.add('doing-public-panel');
  }
  function wire(){
    reorderNav();polishPublicPanels();
    const input=byId('doingGlobalSearchInput');if(input){input.placeholder='搜尋活動、課程、體驗或地點';input.setAttribute('autocomplete','off')}
    const navBtn=byId('globalSearchNavBtn');if(navBtn)navBtn.onclick=goToSearch;
    const go=byId('doingGlobalSearchGo');if(go)go.onclick=runHomeSearch;
    if(input)input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();runHomeSearch()}};
    const modal=byId('globalSearchModal');if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();
