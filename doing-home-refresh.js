(()=>{
  const byId=id=>document.getElementById(id);
  const esc2=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));
  let searchStageTimer=null,searchStageIndex=0,searchPaused=false,searchTouchY=null;

  function navParts(){
    const nav=byId('doingGlobalFixedNav');if(!nav)return{};
    const links=[...nav.querySelectorAll('a,button')];
    const search=byId('globalSearchNavBtn');
    const my=byId('globalMyNavBtn');
    const support=byId('globalSupportNavBtn');
    const pricing=links.find(x=>/費用|功能/.test((x.textContent||'').trim())||/pricing/.test(x.getAttribute('href')||''));
    const apply=links.find(x=>/營運帳號申請/.test((x.textContent||'').trim())||/apply/.test(x.getAttribute('href')||''));
    if(pricing)pricing.classList.add('doing-nav-pricing');
    if(apply)apply.classList.add('doing-nav-apply');
    return{nav,search,my,support,pricing,apply};
  }
  function preserveOriginalNavOrder(){
    const p=navParts();if(!p.nav)return;
    /* Canva 原始順序：營運帳號申請｜搜尋活動｜費用／功能｜客服中心｜我的報名 */
    [p.apply,p.search,p.pricing,p.support,p.my].filter(Boolean).forEach(x=>p.nav.appendChild(x));
  }
  function smoothTo(el,focusEl){if(!el)return;const top=window.scrollY+el.getBoundingClientRect().top-88;window.scrollTo({top:Math.max(0,top),behavior:'smooth'});if(focusEl)setTimeout(()=>focusEl.focus({preventScroll:true}),450)}
  function getSearchOverlay(){return document.querySelector('.doing-search-overlay')}
  function goToSearch(){smoothTo(getSearchOverlay(),byId('doingGlobalSearchInput'))}

  function suppressTenantOnlyToastOnGlobalHome(){
    if(new URL(location.href).searchParams.get('tenant'))return;
    const toast=byId('toast');if(!toast)return;
    const clean=()=>{
      const text=String(toast.textContent||'');
      if(/無法辨識主辦空間|請從主辦提供的活動連結進入|主辦提供的活動連結/.test(text)){
        toast.classList.remove('show');
        toast.textContent='';
        toast.style.display='none';
        setTimeout(()=>{toast.style.display=''},50);
      }
    };
    clean();
    new MutationObserver(clean).observe(toast,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  }

  function realRows(){let a=[],b=[];try{a=Array.isArray(state.discoveryItems)?state.discoveryItems:[];b=Array.isArray(state.exposureItems)?state.exposureItems:[]}catch(e){}const seen=new Set(),out=[];[...a,...b].forEach(x=>{const k=String(x.sessionId||x.id||'');if(!k||seen.has(k))return;seen.add(k);out.push(x)});return out}
  function dateText(rows){const a=Array.isArray(rows)?rows:[];if(!a.length)return '日期待公告';const d=a[0];return String((d&&typeof d==='object'?(d.label||d.date):d)||'日期待公告')}
  function searchCardPos(stage,items){if(!stage||!items.length)return;stage.querySelectorAll('.doing-search-3d-card').forEach((el,i)=>{let d=i-searchStageIndex,n=items.length;if(d>n/2)d-=n;if(d<-n/2)d+=n;let c='off';if(d===0)c='pos0';else if(d===-1)c='posm1';else if(d===1)c='pos1';else if(d===-2)c='posm2';else if(d===2)c='pos2';el.className='doing-search-3d-card '+c})}
  function renderSearchStage(items,q){
    const stage=byId('doingExposureStage');if(!stage)return;clearInterval(searchStageTimer);
    if(!items.length){stage.innerHTML='<div class="doing-stage-caption">搜尋結果</div><div class="doing-exposure-empty">找不到符合的活動，換個關鍵字試試看。</div>';return}
    stage.innerHTML=`<div class="doing-stage-caption">${q?`搜尋「${esc2(q)}」`:'最近可以參加'}</div>`+items.map((x,i)=>`<article class="doing-search-3d-card off" data-i="${i}" tabindex="0" role="link"><div class="x-cover">${x.cover?`<img src="${esc2(x.cover)}" alt="">`:''}</div><div class="x-body"><div class="x-brand">${esc2(x.tenantName||'DOING')}</div><div class="x-title">${esc2(x.sessionName||x.eventTitle||'活動')}</div><div class="x-meta">${esc2(dateText(x.dates))} · ${esc2(x.venue||'地點待公告')}</div><div class="x-cta">查看活動 →</div></div></article>`).join('');
    const cards=[...stage.querySelectorAll('.doing-search-3d-card')];cards.forEach(el=>{const open=()=>{const x=items[Number(el.dataset.i)];if(x&&x.tenantId&&x.sessionId)location.href=`?tenant=${encodeURIComponent(x.tenantId)}&session=${encodeURIComponent(x.sessionId)}`};el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
    searchStageIndex=0;searchCardPos(stage,items);if(items.length>=3)searchStageTimer=setInterval(()=>{if(!searchPaused){searchStageIndex=(searchStageIndex+1)%items.length;searchCardPos(stage,items)}},4800);
    stage.onmouseenter=()=>searchPaused=true;stage.onmouseleave=()=>searchPaused=false;stage.ontouchstart=e=>{searchPaused=true;searchTouchY=e.touches[0]?.clientY??null};stage.ontouchend=e=>{const y=e.changedTouches[0]?.clientY??null;if(searchTouchY!=null&&y!=null&&Math.abs(y-searchTouchY)>28){searchStageIndex=(searchStageIndex+(y<searchTouchY?1:-1)+items.length)%items.length;searchCardPos(stage,items)}searchTouchY=null;setTimeout(()=>searchPaused=false,1000)};stage.onwheel=e=>{e.preventDefault();searchStageIndex=(searchStageIndex+(e.deltaY>0?1:-1)+items.length)%items.length;searchCardPos(stage,items)};
  }
  function runHomeSearch(){const input=byId('doingGlobalSearchInput');if(!input)return;const raw=String(input.value||'').trim(),q=raw.toLowerCase(),rows=realRows();const hit=!q?rows:rows.filter(x=>[x.sessionName,x.eventTitle,x.tenantName,x.venue,x.description].join(' ').toLowerCase().includes(q));renderSearchStage(hit.slice(0,30),raw);smoothTo(byId('doingExposureStage'))}

  function createSinglePageSections(){
    const sessions=byId('pageSessions'),art=byId('doingGlobalArtHome');if(!sessions||!art)return;
    let wrap=byId('doingSinglePageSections');if(wrap)return wrap;
    wrap=document.createElement('div');wrap.id='doingSinglePageSections';wrap.className='doing-single-page-sections';
    wrap.innerHTML=`<section id="doingHomePricing" class="doing-home-section doing-home-pricing"><div class="doing-section-kicker">費用／功能</div><h2>要正式開放時，再啟用就好。</h2><p class="doing-section-lead">只是來找活動、報名或預約的人完全不用付這些費用。這裡是給主辦、品牌、工作室與服務提供者看的。</p><div class="doing-price-grid"><article><span>單次活動／場次</span><strong>NT$200</strong><p>市集、講座、展演、單次工作坊。每個可獨立報名的場次開通一次。</p></article><article><span>持續接預約</span><strong>NT$888／月</strong><p>工作室、美業、導覽、場地或固定時段服務。</p></article></div><div class="doing-rule-note"><b>先設定，確定要開放再啟用。</b> 活動延期可沿用原本的啟用資格；主辦自行取消時，已啟用的平台服務費不退。</div></section><section id="doingHomeApply" class="doing-home-section doing-home-apply"><div class="doing-section-kicker">給營運者</div><h2>你正在辦活動、開課、做體驗或接預約嗎？</h2><p class="doing-section-lead">只有想用 DOING 經營自己活動或服務的人才需要申請。一般參加者不用申請營運帳號。</p><div class="doing-apply-flow"><span>① 填基本資料</span><span>② DOING 審核</span><span>③ 通過後開始設定</span><span>④ 要開放時再啟用</span></div><button type="button" class="doing-main-action" id="doingInlineApplyBtn">開始申請營運帳號</button><div id="doingInlineApplyFrameWrap" class="doing-inline-frame-wrap hidden"><iframe id="doingInlineApplyFrame" title="DOING 營運帳號申請" loading="lazy"></iframe></div></section>`;
    art.after(wrap);
    const my=byId('pageMy'),support=byId('pageSupport');if(my){my.classList.remove('page');my.classList.add('doing-home-section','doing-public-panel');my.id='doingHomeMy';wrap.appendChild(my)}if(support){support.classList.remove('page');support.classList.add('doing-home-section','doing-public-panel');support.id='doingHomeSupport';wrap.appendChild(support)}
    const applyBtn=byId('doingInlineApplyBtn');if(applyBtn)applyBtn.onclick=()=>{const fw=byId('doingInlineApplyFrameWrap'),fr=byId('doingInlineApplyFrame');if(fr&&!fr.src)fr.src='about.html?embed=1#apply';fw?.classList.remove('hidden');applyBtn.classList.add('hidden');setTimeout(()=>smoothTo(fw),80)};return wrap;
  }
  function wireSinglePageNav(){const p=navParts();if(p.search)p.search.onclick=goToSearch;if(p.my)p.my.onclick=()=>smoothTo(byId('doingHomeMy'));if(p.support)p.support.onclick=()=>smoothTo(byId('doingHomeSupport'));if(p.pricing){p.pricing.removeAttribute('href');p.pricing.setAttribute('role','button');p.pricing.onclick=e=>{e.preventDefault();smoothTo(byId('doingHomePricing'))}}if(p.apply){p.apply.removeAttribute('href');p.apply.setAttribute('role','button');p.apply.onclick=e=>{e.preventDefault();smoothTo(byId('doingHomeApply'))}}}
  function wire(){
    preserveOriginalNavOrder();
    createSinglePageSections();
    wireSinglePageNav();
    suppressTenantOnlyToastOnGlobalHome();
    const input=byId('doingGlobalSearchInput');
    if(input){
      input.placeholder='';
      input.removeAttribute('placeholder');
      input.setAttribute('aria-label','搜尋活動、課程、體驗或地點');
      input.setAttribute('autocomplete','off');
      input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();runHomeSearch()}};
    }
    const go=byId('doingGlobalSearchGo');if(go)go.onclick=runHomeSearch;
    const modal=byId('globalSearchModal');if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();
