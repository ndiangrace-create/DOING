(()=>{
'use strict';

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const url=new URL(location.href);
const isGlobal=!url.searchParams.get('tenant');
let carouselIndex=0;
let carouselTimer=null;
let carouselPaused=false;
let touchX=null;
let lastRowsKey='';

const demoActivities=[
  {id:'demo-1',sessionId:'demo-1',eventTitle:'幻日祭',sessionName:'幻日祭・夏日動漫特別場',tenantName:'兔彼樂共創活動',venue:'高雄車站',dates:[{label:'08/22（六）',start:'13:00',end:'20:00'}],type:'展演',isDemo:true},
  {id:'demo-2',sessionId:'demo-2',eventTitle:'LOOP 小角落',sessionName:'LOOP 小角落二手市集',tenantName:'小角落',venue:'高雄棧貳庫',dates:[{label:'08/29（六）',start:'15:00',end:'21:00'}],type:'市集',isDemo:true},
  {id:'demo-3',sessionId:'demo-3',eventTitle:'手作體驗',sessionName:'花藝十字架夜燈體驗',tenantName:'恩典之約禮物店',venue:'台中',dates:[{label:'09/05（六）',start:'14:00',end:'16:00'}],type:'體驗',isDemo:true},
  {id:'demo-4',sessionId:'demo-4',eventTitle:'親子課程',sessionName:'親子彩繪創作課',tenantName:'DOING 精選活動',venue:'台中大里',dates:[{label:'09/12（六）',start:'10:30',end:'12:00'}],type:'課程',isDemo:true},
  {id:'demo-5',sessionId:'demo-5',eventTitle:'預約體驗',sessionName:'週末療癒香氛工作坊',tenantName:'DOING 精選活動',venue:'高雄美麗島',dates:[{label:'09/19（六）',start:'15:00',end:'17:00'}],type:'預約',isDemo:true}
];

function navParts(){
  const nav=$('doingGlobalFixedNav');
  if(!nav)return{};
  const links=[...nav.querySelectorAll('a,button')];
  const search=$('globalSearchNavBtn');
  const my=$('globalMyNavBtn');
  const support=$('globalSupportNavBtn');
  const pricing=links.find(x=>/費用|功能|主辦方案/.test((x.textContent||'').trim())||/pricing/.test(x.getAttribute('href')||''));
  const apply=links.find(x=>/營運帳號申請|申請營運帳號/.test((x.textContent||'').trim())||/apply/.test(x.getAttribute('href')||''));
  return{nav,search,my,support,pricing,apply};
}

function buildHeader(){
  const p=navParts();
  if(!p.nav)return;
  let brand=p.nav.querySelector('.doing-nav-brand');
  let actions=p.nav.querySelector('.doing-nav-actions');
  if(!brand){
    brand=document.createElement('button');
    brand.type='button';
    brand.className='doing-nav-brand';
    brand.innerHTML='<span class="doing-nav-logo"><img src="doing-logo.png?v=20260815k" alt="DOING" onerror="this.hidden=true;this.parentElement.classList.add(\'fallback\')"></span><span><b>活動營運管理系統</b></span>';
    brand.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
    p.nav.prepend(brand);
  }
  if(!actions){
    actions=document.createElement('div');
    actions.className='doing-nav-actions';
    p.nav.appendChild(actions);
  }
  if(p.search)p.search.textContent='找活動';
  if(p.my)p.my.textContent='我的報名';
  if(p.support)p.support.textContent='客服';
  if(p.pricing){
    p.pricing.textContent='主辦方案';
    p.pricing.href='#doingOrganizerDetails';
    p.pricing.dataset.organizerTarget='pricing';
    p.pricing.classList.add('doing-organizer-nav');
  }
  if(p.apply){
    p.apply.textContent='申請營運帳號';
    p.apply.href='#doingOrganizerDetails';
    p.apply.dataset.organizerTarget='apply';
    p.apply.classList.add('doing-organizer-nav','primary');
  }
  [p.search,p.support,p.pricing,p.apply].filter(Boolean).forEach(x=>{
    x.classList.add('doing-nav-action');
    if(x.tagName==='BUTTON')x.type='button';
    actions.appendChild(x);
  });
  if(p.my){p.my.classList.add('doing-nav-action','doing-nav-member');p.my.type='button';p.nav.appendChild(p.my)}
}

function smoothTo(el,focus){
  if(!el)return;
  const header=document.querySelector('.doing-global-fixed-nav');
  const gap=(header?.offsetHeight||78)+16;
  const top=window.scrollY+el.getBoundingClientRect().top-gap;
  window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
  if(focus)setTimeout(()=>focus.focus({preventScroll:true}),420);
}

function suppressTenantToast(){
  if(!isGlobal)return;
  const toast=$('toast');
  if(!toast)return;
  const clean=()=>{
    const t=String(toast.textContent||'');
    if(/無法辨識主辦空間|請從主辦提供的活動連結進入|主辦提供的活動連結/.test(t)){
      toast.classList.remove('show');
      toast.textContent='';
      toast.style.display='none';
      setTimeout(()=>toast.style.display='',60);
    }
  };
  clean();
  new MutationObserver(clean).observe(toast,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
}

function realRows(){
  let discovery=[];
  let exposure=[];
  try{
    discovery=Array.isArray(state.discoveryItems)?state.discoveryItems:[];
    exposure=Array.isArray(state.exposureItems)?state.exposureItems:[];
  }catch(e){}
  const seen=new Set();
  const out=[];
  [...exposure,...discovery].forEach(x=>{
    const key=String(x.sessionId||x.id||'');
    if(!key||seen.has(key))return;
    seen.add(key);
    out.push(x);
  });
  return out;
}

function displayRows(){
  const rows=realRows();
  return rows.length?rows.slice(0,5):demoActivities;
}

function dateText(rows){
  const dates=Array.isArray(rows)?rows:[];
  if(!dates.length)return '日期待公告';
  const first=dates[0];
  if(first&&typeof first==='object'){
    const day=first.label||first.date||'日期待公告';
    const time=first.start&&first.end?`${first.start}–${first.end}`:'';
    return [day,time].filter(Boolean).join(' ');
  }
  return String(first||'日期待公告');
}

function itemType(x){
  const source=[x.sessionName,x.eventTitle,x.description,x.type,x.unitType].join(' ').toLowerCase();
  if(/市集|攤/.test(source))return '市集';
  if(/課程|講座|workshop|工作坊/.test(source))return '課程／講座';
  if(/預約|體驗|booking|美甲|美睫|美容/.test(source))return '體驗／預約';
  if(/展演|演出|表演/.test(source))return '展演';
  return '活動';
}

function setCarouselPositions(stage,items){
  if(!stage||!items.length)return;
  const track=stage.querySelector('.doing-activity-track');
  if(track)track.style.transform=`translate3d(-${carouselIndex*100}%,0,0)`;
  stage.querySelectorAll('.doing-activity-card').forEach((el,i)=>{
    const active=i===carouselIndex;
    el.classList.toggle('active',active);
    el.setAttribute('aria-hidden',active?'false':'true');
    el.tabIndex=active?0:-1;
  });
  document.querySelectorAll('#doingActivityDots button').forEach((dot,i)=>{
    const active=i===carouselIndex;
    dot.classList.toggle('active',active);
    dot.setAttribute('aria-current',active?'true':'false');
  });
  const count=$('doingActivityCount');
  if(count)count.textContent=`${carouselIndex+1} / ${items.length}`;
}

function openActivity(item){
  if(item?.isDemo){
    smoothTo($('doingPublicSearch'),$('doingPublicSearchInput'));
    return;
  }
  if(!item?.tenantId||!item?.sessionId)return;
  location.href=`?tenant=${encodeURIComponent(item.tenantId)}&session=${encodeURIComponent(item.sessionId)}`;
}

function renderActivities(items,query=''){
  const stage=$('doingPublicActivityStage');
  if(!stage)return;
  clearInterval(carouselTimer);
  const rows=(Array.isArray(items)?items:[]).slice(0,5);
  if(!rows.length){
    stage.innerHTML=`<div class="doing-empty-state"><b>${query?'找不到符合的活動':'目前沒有開放中的活動'}</b><p>${query?'換個關鍵字試試看。':'有新活動時會自動顯示。'}</p></div>`;
    const dots=$('doingActivityDots');if(dots)dots.innerHTML='';
    const count=$('doingActivityCount');if(count)count.textContent='0 / 0';
    return;
  }
  stage.innerHTML=`<div class="doing-activity-track">${rows.map((x,i)=>`
    <article class="doing-activity-card" data-i="${i}" role="link" aria-label="${esc(x.sessionName||x.eventTitle||'活動')}">
      <div class="doing-card-cover doing-cover-${(i%5)+1}">${x.cover?`<img src="${esc(x.cover)}" alt="" loading="lazy">`:`<span>${['市','課','體','親','約'][i%5]}</span>`}</div>
      <div class="doing-card-copy">
        <div class="doing-card-top"><span class="doing-type">${esc(itemType(x))}</span>${x.isDemo?'<span class="doing-demo-tag">模擬活動</span>':''}</div>
        <h3>${esc(x.sessionName||x.eventTitle||'活動')}</h3>
        <p class="doing-card-date">${esc(dateText(x.dates))}</p>
        <p class="doing-card-meta">${esc(x.tenantName||'DOING')}${x.venue?' · '+esc(x.venue):''}</p>
        <span class="doing-card-cta">${x.isDemo?'搜尋更多活動':'查看活動'} <b>→</b></span>
      </div>
    </article>`).join('')}</div>`;
  [...stage.querySelectorAll('.doing-activity-card')].forEach(el=>{
    const go=()=>openActivity(rows[Number(el.dataset.i)]);
    el.onclick=go;
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};
  });
  stage.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const cover=img.closest('.doing-card-cover'),card=img.closest('.doing-activity-card');if(cover){img.remove();cover.innerHTML=`<span>${['市','課','體','親','約'][Number(card?.dataset.i||0)%5]}</span>`}},{once:true}));
  carouselIndex=0;
  const dots=$('doingActivityDots');
  if(dots){
    dots.innerHTML=rows.map((x,i)=>`<button type="button" data-i="${i}" aria-label="切換到第 ${i+1} 個活動"></button>`).join('');
    dots.querySelectorAll('button').forEach(dot=>dot.onclick=()=>{
      carouselIndex=Number(dot.dataset.i)||0;
      setCarouselPositions(stage,rows);
      restartCarousel(stage,rows);
    });
  }
  setCarouselPositions(stage,rows);
  const move=direction=>{
    carouselIndex=(carouselIndex+direction+rows.length)%rows.length;
    setCarouselPositions(stage,rows);
    restartCarousel(stage,rows);
  };
  const prev=$('doingActivityPrev');if(prev)prev.onclick=()=>move(-1);
  const next=$('doingActivityNext');if(next)next.onclick=()=>move(1);
  stage.onmouseenter=()=>carouselPaused=true;
  stage.onmouseleave=()=>carouselPaused=false;
  stage.ontouchstart=e=>{carouselPaused=true;touchX=e.touches[0]?.clientX??null;};
  stage.ontouchend=e=>{
    const x=e.changedTouches[0]?.clientX??null;
    if(touchX!=null&&x!=null&&Math.abs(x-touchX)>26){
      move(x<touchX?1:-1);
    }
    touchX=null;
    setTimeout(()=>carouselPaused=false,850);
  };
  restartCarousel(stage,rows);
}

function renderActivityList(items,query=''){
  const host=$('doingPublicActivityList');
  if(!host)return;
  const rows=Array.isArray(items)?items:[];
  if(!rows.length){host.innerHTML=`<div class="doing-list-empty"><b>${query?'找不到符合的活動':'目前沒有開放中的活動'}</b><span>${query?'換個活動名稱、類型或地點試試看。':'有新活動時會顯示在這裡。'}</span></div>`;return}
  host.innerHTML=rows.map((x,i)=>`<article class="doing-list-card" data-i="${i}" tabindex="0" role="link"><div class="doing-list-cover doing-cover-${(i%5)+1}">${x.cover?`<img src="${esc(x.cover)}" alt="" loading="lazy">`:`<span>${['市','課','體','親','約'][i%5]}</span>`}</div><div class="doing-list-copy"><small>${esc(itemType(x))}</small><h3>${esc(x.sessionName||x.eventTitle||'活動')}</h3><p>${esc(dateText(x.dates))}${x.venue?' · '+esc(x.venue):''}</p><span data-default-label="查看活動">${host.classList.contains('is-first-use')?'選擇這場並建立資料':'查看活動'} <b>→</b></span></div></article>`).join('');
  host.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const cover=img.closest('.doing-list-cover');if(cover){img.remove();cover.innerHTML=`<span>${['市','課','體','親','約'][Number(cover.closest('.doing-list-card')?.dataset.i||0)%5]}</span>`}},{once:true}));
  host.querySelectorAll('.doing-list-card').forEach(card=>{const go=()=>openActivity(rows[Number(card.dataset.i)]);card.onclick=go;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}});
  setupInfiniteActivityStrip(host,rows);
}

function setupInfiniteActivityStrip(host,rows){
  if(!host||!matchMedia('(max-width:600px)').matches||host.children.length<2)return;
  const originals=[...host.children],count=originals.length;
  originals.forEach((card,i)=>{const clone=card.cloneNode(true);clone.dataset.i=String(i);clone.dataset.loopClone='true';host.appendChild(clone)});
  host.querySelectorAll('[data-loop-clone]').forEach(card=>{const go=()=>openActivity(rows[Number(card.dataset.i)]);card.onclick=go;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}});
  let wrapping=false;
  const reset=()=>{const firstClone=host.querySelector('[data-loop-clone]');if(!firstClone)return;const start=firstClone.offsetLeft-host.offsetLeft;if(host.scrollLeft>=start-4&&!wrapping){wrapping=true;host.classList.add('loop-restarted');host.scrollTo({left:0,behavior:'auto'});setTimeout(()=>{host.classList.remove('loop-restarted');wrapping=false},700)}};
  let timer;host.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(reset,90)},{passive:true});
}

function restartCarousel(stage,rows){
  clearInterval(carouselTimer);
  if(rows.length<2)return;
  carouselTimer=setInterval(()=>{
    if(!carouselPaused){
      carouselIndex=(carouselIndex+1)%rows.length;
      setCarouselPositions(stage,rows);
    }
  },4800);
}

function searchActivities(){
  const input=$('doingPublicSearchInput');
  if(!input)return;
  const raw=String(input.value||'').trim();
  const query=raw.toLowerCase();
  const rows=displayRows();
  const results=!query?rows:rows.filter(x=>[x.sessionName,x.eventTitle,x.tenantName,x.venue,x.description,itemType(x)].join(' ').toLowerCase().includes(query));
  const label=$('doingActivityLabel');
  if(label)label.textContent=query?`搜尋「${raw}」`:'近期開放活動';
  renderActivities(results.slice(0,5),raw);
  renderActivityList(results,raw);
  smoothTo($('doingPublicActivityList'));
}

function watchActivities(){
  let tries=0;
  renderActivities(displayRows());
  renderActivityList(realRows().length?realRows():demoActivities);
  const tick=()=>{
    tries++;
    const rows=realRows();
    const key=rows.map(x=>x.sessionId||x.id).join('|');
    if(rows.length&&key!==lastRowsKey){
      lastRowsKey=key;
      renderActivities(rows.slice(0,5));
      renderActivityList(rows);
      const label=$('doingActivityLabel');
      if(label)label.textContent='近期開放活動';
      return;
    }
    if(tries<60)setTimeout(tick,500);
    else if(!rows.length)renderActivities(demoActivities);
  };
  tick();
}

function publicAppHTML(){
  return `
  <div id="doingPublicApp" class="doing-public-app">
    <section class="doing-public-hero" id="doingPublicHero" aria-label="DOING 活動首頁">
      <span class="doing-hero-blob blob-a" aria-hidden="true"></span><span class="doing-hero-blob blob-b" aria-hidden="true"></span>
      <div class="doing-hero-copy" id="doingPublicSearch">
        <div class="doing-hero-logo" aria-label="DOING 活動預約營運管理系統"><img src="doing-logo.png?v=20260815k" alt="DOING 活動預約營運管理系統"></div>
        <h1>表單只收到報名，<br>DOING 幫你把活動做完。</h1>
        <p class="doing-hero-desc">從找活動、報名與付款，到主辦端的審核、通知、選位、現場報到、退款與財務結案，每一步都沿用同一筆正式資料，不必再整理五張表。</p>
        <div class="doing-search-box">
          <span class="doing-search-icon" aria-hidden="true"></span>
          <input id="doingPublicSearchInput" type="search" placeholder="搜尋活動、課程、體驗或地點" aria-label="搜尋活動、課程、體驗或地點" autocomplete="off">
          <button id="doingPublicSearchGo" type="button">搜尋</button>
        </div>
        <div class="doing-quick-tags" aria-label="活動快速分類">
          <button type="button" data-q="市集">市集</button><button type="button" data-q="課程">課程</button><button type="button" data-q="體驗">體驗</button><button type="button" data-q="預約">預約</button><button type="button" data-location>地點</button>
        </div>
      </div>
      <div class="doing-hero-console" aria-label="DOING 系統服務">
        <div class="doing-console-top"><span></span><span></span><span></span><b>DOING</b></div>
        <div class="doing-console-card featured"><small>一個入口完成</small><b>找活動 → 報名 → 付款</b><span>我的報名隨時查看進度</span></div>
        <div class="doing-console-grid">
          <div><i>♡</i><b>活動探索</b><span>查看近期內容</span></div>
          <div><i>✓</i><b>報名紀錄</b><span>狀態集中管理</span></div>
          <div><i>✦</i><b>行前提醒</b><span>資訊不漏接</span></div>
          <div><i>→</i><b>直接出發</b><span>時間地點一次看</span></div>
        </div>
        <button type="button" data-go="my">查看我的報名</button>
      </div>
    </section>

    <section class="doing-public-section doing-list-section" aria-label="所有開放活動">
      <div class="doing-list-head"><div><span class="doing-kicker">找活動</span><h2>所有開放活動</h2></div><span>左右滑動查看更多活動</span></div>
      <div id="doingPublicActivityList" class="doing-public-activity-list" aria-live="polite"></div>
    </section>

    <section class="doing-public-section doing-activities-section" id="doingPublicActivities" aria-label="活動快訊輪播">
      <div class="doing-section-title row">
        <div><span class="doing-kicker">活動快訊</span><h2 id="doingActivityLabel">近期精選活動</h2><p>看看最近有哪些活動、課程與體驗正在開放，點進去即可查看完整內容。</p></div>
        <span class="doing-ad-label">精選曝光</span>
      </div>
      <div class="doing-carousel-frame">
        <span class="doing-frame-title">DOING NOW</span>
        <button id="doingActivityPrev" class="doing-carousel-arrow prev" type="button" aria-label="上一個活動">‹</button>
        <div id="doingPublicActivityStage" class="doing-public-carousel" aria-live="polite"><div class="doing-empty-state"><b>正在讀取活動…</b></div></div>
        <button id="doingActivityNext" class="doing-carousel-arrow next" type="button" aria-label="下一個活動">›</button>
        <div class="doing-carousel-footer"><div id="doingActivityDots" class="doing-activity-dots" aria-label="活動頁數"></div><span id="doingActivityCount">1 / 5</span></div>
      </div>
    </section>

    <section class="doing-my-highlight" aria-label="快速報名功能亮點">
      <div class="doing-my-highlight-copy"><span class="doing-kicker">快速報名</span><h2>會員資料填一次，之後不用重新來。</h2><p>先使用 LINE 或 Google 登入；第一次使用會一次完成會員資料，之後才能報名任何活動。付款、審核與行前資訊也能集中查看。</p><div class="doing-my-highlight-actions"><button type="button" data-my-action="apply">首次申請</button><button type="button" class="secondary" data-my-action="login">登入會員</button></div></div>
      <div class="doing-my-highlight-points"><span><b>資料不用重填</b><small>後續報名快速帶入</small></span><span><b>付款與審核</b><small>最新狀態一次看</small></span><span><b>行前資訊</b><small>時間、地點與提醒集中查看</small></span></div>
    </section>

    <div id="doingMyMount"></div>

    <section class="doing-public-section doing-organizer-section">
      <div class="doing-organizer-icon">D</div>
      <div><span class="doing-kicker yellow">給主辦／營運者</span><h2>你不只參加，也正在做自己的事？</h2><p>DOING 把報名、會員、付款、預約、通知與現場管理整理在同一套系統。無論是單場活動或持續經營，都能從建立內容一路管理到現場與結案。</p></div>
      <div class="doing-organizer-actions"><a href="#doingOrganizerDetails" data-organizer-target="apply">申請營運帳號</a><a class="secondary" href="#doingOrganizerDetails" data-organizer-target="pricing">查看主辦方案</a></div>
    </section>

    <section class="doing-proof-section" aria-label="DOING 系統亮點">
      <header><span class="doing-kicker">為什麼主辦需要 DOING</span><h2>真正麻煩的，從來不是做一張報名表。</h2><p>而是報名送出以後，名單、款項、異動與現場資訊開始出現不同版本。DOING 把這些工作接成一條完整流程。</p></header>
      <div class="doing-proof-story">
        <article><span>01</span><div><small>一筆資料，跑完整場</small><h3>不再從表單搬到 Excel、付款表、位置表與簽到表。</h3><p>報名、審核、付款、設備、選位、通知、報到與結案都沿用同一筆正式資料；打開系統看到的，就是現在正確的版本。</p></div><b>少整理<br>多完成</b></article>
        <article><span>02</span><div><small>活動有變，也不用全部重來</small><h3>延期、取消、改期與退款，都接著原本紀錄處理。</h3><p>名單、付款、設備和位置不必重新複製，主辦可以沿著原資料完成通知與後續安排。</p></div><b>不怕異動<br>不漏處理</b></article>
        <article><span>03</span><div><small>不同工作方式，一個營運後台</small><h3>市集、課程、體驗、導覽與工作室預約，不必各養一套工具。</h3><p>流程可以不同，會員、日曆、通知、付款與財務仍集中管理；下一場也不用重新開始。</p></div><b>活動多元<br>營運不亂</b></article>
      </div>
    </section>

    <section id="doingOrganizerDetails" class="doing-organizer-details">
      <header class="doing-organizer-heading"><h2>主辦方案與營運情境</h2><p>情境、功能、費用與申請都直接顯示在這一頁。</p></header>
      <div id="doingOrganizerContent" class="doing-organizer-content"><div class="doing-organizer-loading">準備主辦方案…</div></div>
    </section>

    <div id="doingSupportMount"></div>

    <footer class="doing-public-footer">
      <div><b>DOING</b><span>活動營運管理系統</span></div>
      <nav><a href="#doingOrganizerDetails" data-organizer-target="scenes">關於 DOING</a><a href="#doingOrganizerDetails" data-organizer-target="pricing">主辦方案</a><a href="#doingOrganizerDetails" data-organizer-target="apply">申請營運帳號</a><a href="mailto:Ndiangrace@gmail.com">Email 客服</a></nav>
      <small>兔彼樂共創活動有限公司</small>
    </footer>
    <div id="doingMyEntryModal" class="doing-my-entry-modal" hidden>
      <div class="doing-my-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="doingMyEntryTitle">
        <button type="button" class="doing-my-entry-close" aria-label="關閉">×</button>
        <span class="doing-kicker">DOING 會員</span><h2 id="doingMyEntryTitle">登入會員，或完成首次申請。</h2><p>所有活動都必須先登入；若尚未建立完整資料，登入後會進入首次申請，一次填完再繼續報名。</p>
        <div><button type="button" data-my-action="login">登入會員</button><button type="button" class="secondary" data-my-action="apply">首次申請</button></div>
      </div>
    </div>
  </div>`;
}

let organizerLoadPromise=null;
async function loadOrganizerDetails(target='scenes',shouldScroll=true){
  const details=$('doingOrganizerDetails'),content=$('doingOrganizerContent');
  if(!details||!content)return;
  if(!organizerLoadPromise){
    organizerLoadPromise=fetch('about.html?fragment=1',{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error('主辦方案讀取失敗');
      const html=await response.text(),doc=new DOMParser().parseFromString(html,'text/html');
      const ids=['scenes','workflow','features','pricing','apply','support'];
      content.replaceChildren(...ids.map(id=>doc.getElementById(id)?.cloneNode(true)).filter(Boolean));
      content.querySelectorAll('a[href="index.html"]').forEach(a=>{a.href='#doingOrganizerDetails';a.onclick=e=>{e.preventDefault();smoothTo(details)}});
      const signupSource=[...doc.scripts].find(s=>s.textContent.includes("const API='https://tobeloved-api.ndiangrace.workers.dev'"));
      if(signupSource){const script=document.createElement('script');script.textContent=signupSource.textContent;document.body.appendChild(script);script.remove()}
      await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='doing-about-refresh.js?v=20260815c';script.onload=resolve;script.onerror=reject;document.body.appendChild(script)});
    }).catch(error=>{content.innerHTML='<div class="doing-organizer-loading">'+esc(error.message||'主辦方案讀取失敗，請稍後再試。')+'</div>';organizerLoadPromise=null});
  }
  await organizerLoadPromise;
  const section=content.querySelector('#'+CSS.escape(target))||content.querySelector('#scenes');
  if(shouldScroll)setTimeout(()=>smoothTo(section||details),60);
}
window.openDoingOrganizerDetails=loadOrganizerDetails;

function buildPublicApp(){
  if(!isGlobal)return;
  document.documentElement.classList.add('doing-public-refactor');
  document.body.classList.add('doing-global-mode','doing-public-refactor-body');
  const sessions=$('pageSessions');
  if(!sessions)return;
  let app=$('doingPublicApp');
  if(!app){
    const host=document.createElement('div');
    host.innerHTML=publicAppHTML();
    app=host.firstElementChild;
    sessions.prepend(app);
  }
  const oldArt=$('doingGlobalArtHome');if(oldArt)oldArt.classList.add('doing-legacy-public-hidden');
  const my=$('pageMy');
  if(my){
    my.classList.remove('page');my.classList.add('doing-public-native-panel','doing-my-panel');my.classList.remove('active');my.id='doingHomeMy';my.hidden=true;
    $('doingMyMount')?.replaceWith(my);
  }
  const support=$('pageSupport');
  if(support){
    support.classList.remove('page');support.classList.add('doing-public-native-panel','doing-support-panel');support.id='doingHomeSupport';
    $('doingSupportMount')?.replaceWith(support);
  }
  const oldSingle=$('doingSinglePageSections');if(oldSingle)oldSingle.remove();
  const oldModal=$('globalSearchModal');if(oldModal)oldModal.classList.remove('show');
  loadOrganizerDetails('scenes',false);
}

function openMyEntry(){if(memberAuth.complete){showMemberTree();return}const modal=$('doingMyEntryModal');if(modal){modal.hidden=false;document.body.style.overflow='hidden';modal.querySelector('[data-my-action="login"]')?.focus()}}
function closeMyEntry(){const modal=$('doingMyEntryModal');if(modal){modal.hidden=true;document.body.style.overflow=''}}
function openMyLogin(){closeMyEntry();if(memberAuth.complete)showMemberProfile();else openMemberGate()}
function startFirstApplication(){closeMyEntry();openMemberGate()}

const memberAuth={token:'',profile:null,complete:false,resume:null,provider:'',roles:[],applications:[],workspaces:[]};
function isLineBrowser(){return /\bLine\//i.test(navigator.userAgent)||/LIFF/i.test(navigator.userAgent)}
function memberReturnUrl(){const u=new URL(location.href);['member_token','member_status','member_login_error'].forEach(k=>u.searchParams.delete(k));return u.toString()}
function authStart(provider){
  const path=provider==='line'?'/auth/line/start':'/auth/google/start';
  const u=new URL(API+path);u.searchParams.set('return_url',memberReturnUrl());if(provider==='google')u.searchParams.set('mode','member');location.href=u.toString();
}
function memberGateHTML(){const vendorCats=['餐飲美食','手作設計','文創選物','服飾配件','生活用品','親子兒童','寵物相關','收藏娛樂','美業服務','體驗／服務','其他'];return `<div id="doingMemberGate" class="doing-member-gate" hidden><div class="doing-member-dialog" role="dialog" aria-modal="true"><button type="button" class="doing-member-close">×</button><section data-member-view="login"><span class="doing-kicker">DOING 會員</span><h2>登入後才能報名活動</h2><p>登入後會先查詢正式會員資料；第一次使用只需完整填寫一次。</p><button type="button" class="doing-line-login">使用 LINE 登入</button><button type="button" class="doing-google-login">使用 Google 登入</button><small class="doing-line-warning" hidden>LINE 內建瀏覽器無法直接使用 Google 登入；請使用 LINE 登入，或改用 Safari／Chrome 開啟。</small></section><section data-member-view="tree" hidden><span class="doing-kicker">DOING 會員中心</span><h2 data-member-welcome>已登入</h2><p data-member-account></p><div class="doing-member-tree" data-member-tree></div><div class="doing-member-tree-actions"><button type="button" data-member-edit>編輯會員資料</button><button type="button" class="secondary" data-member-logout>登出</button></div></section><form data-member-view="profile" hidden><span class="doing-kicker">會員資料</span><h2>一次完成，之後直接使用</h2><p>基本資料完成後才能報名；攤商登錄及系統申請可依需要一併建立。</p><fieldset><legend>一、基本資料（活動報名用）</legend><label>姓名 *<input name="name" required></label><label>Email *<input name="email" type="email" required></label><label>手機 *<input name="phone" inputmode="tel" required></label><label>LINE 帳號<input name="lineId"></label><label>所在縣市<input name="city"></label></fieldset><fieldset><legend><label><input type="checkbox" name="enableVendor"> 二、攤商登錄（品牌或公司）</label></legend><div data-vendor-fields hidden><label>品牌／公司名稱 *<input name="brandName"></label><label>品牌介紹 *<textarea name="brandIntro"></textarea></label><label>品牌類別 *<select name="category"><option value="">請選擇</option>${vendorCats.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label><label>主要品項<input name="items"></label><label>Facebook<input name="facebook" type="url"></label><label>Instagram<input name="instagram" type="url"></label><label>作品／介紹網址<input name="photoUrl" type="url"></label><label>公司登記名稱<input name="company"></label><label>統一編號<input name="taxId"></label></div></fieldset><fieldset><legend><label><input type="checkbox" name="enableSystem"> 三、系統申請（品牌或服務）</label></legend><div data-system-fields hidden><label>營運單位名稱 *<input name="unitName"></label><p class="doing-check-title">產業類別（可複選）*</p><div class="doing-check-grid">${['市集展售','活動展演','課程講座','手作體驗','美業工作室','場地／攝影棚','導覽戶外','專業服務預約','其他'].map(x=>`<label><input type="checkbox" name="industry" value="${x}">${x}</label>`).join('')}</div><p class="doing-check-title">想使用的功能（可複選）*</p><div class="doing-check-grid">${['活動報名','審核付款','攤位設備','選位排位','課程預約','會員管理','通知報到','財務結案'].map(x=>`<label><input type="checkbox" name="useCase" value="${x}">${x}</label>`).join('')}</div></div></fieldset><button type="submit" class="doing-member-save">完成首次申請</button><div class="doing-member-error" aria-live="polite"></div></form></div></div>`}
function ensureMemberGate(){
  if($('doingMemberGate'))return $('doingMemberGate');
  document.body.insertAdjacentHTML('beforeend',memberGateHTML());const modal=$('doingMemberGate'),form=modal.querySelector('form');
  modal.querySelector('.doing-member-close').onclick=()=>{modal.hidden=true;document.body.style.overflow=''};
  modal.querySelector('.doing-line-login').onclick=()=>authStart('line');modal.querySelector('.doing-google-login').onclick=()=>authStart('google');
  if(isLineBrowser()){modal.querySelector('.doing-line-warning').hidden=false;modal.querySelector('.doing-google-login').textContent='改用外部瀏覽器登入 Google'}
  form.elements.enableVendor.onchange=e=>form.querySelector('[data-vendor-fields]').hidden=!e.target.checked;
  form.elements.enableSystem.onchange=e=>form.querySelector('[data-system-fields]').hidden=!e.target.checked;
  modal.querySelector('[data-member-edit]').onclick=showMemberProfile;
  modal.querySelector('[data-member-logout]').onclick=logoutMember;
  form.onsubmit=saveMemberProfile;return modal;
}
function showMemberView(view){const modal=ensureMemberGate();modal.hidden=false;document.body.style.overflow='hidden';modal.querySelectorAll('[data-member-view]').forEach(x=>x.hidden=x.dataset.memberView!==view)}
function showMemberProfile(){const modal=ensureMemberGate(),form=modal.querySelector('form'),p=memberAuth.profile||{};for(const key of ['name','email','phone','lineId','city'])if(form.elements[key])form.elements[key].value=p[key]||'';const vendor=!!(p.brand||p.brand_name);form.elements.enableVendor.checked=vendor;form.querySelector('[data-vendor-fields]').hidden=!vendor;if(vendor){form.elements.brandName.value=p.brand||p.brand_name||'';form.elements.brandIntro.value=p.brandIntro||'';form.elements.category.value=p.sellCat||'';form.elements.items.value=p.sellItem||'';form.elements.facebook.value=p.fb||'';form.elements.instagram.value=p.ig||'';form.elements.photoUrl.value=p.photo||'';form.elements.company.value=p.company||'';form.elements.taxId.value=p.taxId||''}form.querySelector('.doing-member-save').textContent='儲存會員資料';showMemberView('profile')}
function memberStatusLabel(s){return ({pending:'審核中',approved:'已通過',active:'使用中',supplement_required:'待補件',rejected:'未通過'}[s]||s||'尚未申請')}
function showMemberTree(){const modal=ensureMemberGate(),p=memberAuth.profile||{},apps=memberAuth.applications||[],spaces=memberAuth.workspaces||[];modal.querySelector('[data-member-welcome]').textContent=`${p.name||'會員'}，您好`;modal.querySelector('[data-member-account]').textContent=`已使用 ${memberAuth.provider==='line'?'LINE':'Google'} 登入｜${p.email||''}`;modal.querySelector('[data-member-tree]').innerHTML=`<article class="is-done"><b>① 基本會員</b><span>已完成</span><small>${p.name||''}｜${p.phone||''}</small></article><article class="${p.brand?'is-done':''}"><b>② 攤商品牌</b><span>${p.brand?'已建立':'尚未建立'}</span><small>${p.brand?`${p.brand}｜${p.sellCat||'未分類'}`:'需要擺攤時再建立'}</small></article><article class="${apps.length||spaces.length?'is-done':''}"><b>③ 主辦／系統</b><span>${spaces.length?'已啟用':apps.length?memberStatusLabel(apps[0].status):'尚未申請'}</span><small>${spaces[0]?.name||apps[0]?.unitName||'需要開設系統時再申請'}</small></article><article><b>④ 我的活動</b><span>可使用</span><small>報名、付款、審核與行前資訊</small></article>`;showMemberView('tree');updateMemberAuthUi()}
function updateMemberAuthUi(){const p=memberAuth.profile||{};document.querySelectorAll('[data-my-action="login"]').forEach(x=>x.textContent=memberAuth.complete?`已登入｜${p.name||'會員'}`:'登入會員');document.querySelectorAll('[data-my-action="apply"]').forEach(x=>{x.hidden=memberAuth.complete});const title=$('doingMyEntryTitle');if(title&&memberAuth.complete)title.textContent=`${p.name||'會員'}，已登入`}
function logoutMember(){memberAuth.token='';memberAuth.profile=null;memberAuth.complete=false;memberAuth.provider='';memberAuth.roles=[];memberAuth.applications=[];memberAuth.workspaces=[];localStorage.removeItem('doing_member_token');ensureMemberGate().hidden=true;document.body.style.overflow='';updateMemberAuthUi();if(typeof toast==='function')toast('已登出 DOING 會員')}
function openMemberGate(resume){if(resume)memberAuth.resume=resume;if(memberAuth.complete){const fn=memberAuth.resume;memberAuth.resume=null;if(fn)fn();return true}showMemberView(memberAuth.token?'profile':'login');return false}
async function saveMemberProfile(e){
  e.preventDefault();const form=e.currentTarget,fd=new FormData(form),vendorOn=fd.has('enableVendor'),systemOn=fd.has('enableSystem'),error=form.querySelector('.doing-member-error'),btn=form.querySelector('.doing-member-save');error.textContent='';btn.disabled=true;
  const payload={member_token:memberAuth.token,name:fd.get('name'),email:fd.get('email'),phone:fd.get('phone'),lineId:fd.get('lineId'),city:fd.get('city'),vendor:vendorOn?{brandName:fd.get('brandName'),brandIntro:fd.get('brandIntro'),category:fd.get('category'),items:fd.get('items'),facebook:fd.get('facebook'),instagram:fd.get('instagram'),photoUrl:fd.get('photoUrl'),company:fd.get('company'),taxId:fd.get('taxId')}:{},systemApplication:systemOn?{enabled:true,unitName:fd.get('unitName'),industryCategories:fd.getAll('industry'),useCases:fd.getAll('useCase')}:{enabled:false}};
  if(vendorOn&&(!String(payload.vendor.brandName).trim()||!String(payload.vendor.brandIntro).trim()||!String(payload.vendor.category).trim())){error.textContent='攤商登錄請完整填寫品牌名稱、介紹與類別';btn.disabled=false;return}
  try{const d=await apiPost('savePlatformMemberProfile',payload),fresh=await apiGet('getPlatformMemberProfile',{member_token:memberAuth.token});setMemberState(fresh);localStorage.setItem('doing_member_token',memberAuth.token);if(typeof toast==='function')toast(d.applicationId?'會員與系統申請已完成':'會員資料已儲存');const fn=memberAuth.resume;memberAuth.resume=null;if(fn){ensureMemberGate().hidden=true;document.body.style.overflow='';fn()}else showMemberTree()}catch(err){error.textContent=err.message||'儲存失敗'}finally{btn.disabled=false}
}
function setMemberState(d){memberAuth.complete=!!d.complete;memberAuth.profile=d.profile||null;memberAuth.provider=d.provider||'';memberAuth.roles=Array.isArray(d.roles)?d.roles:[];memberAuth.applications=Array.isArray(d.applications)?d.applications:[];memberAuth.workspaces=Array.isArray(d.workspaces)?d.workspaces:[];updateMemberAuthUi()}
async function initMemberAuth(){
  const u=new URL(location.href),incoming=u.searchParams.get('member_token');memberAuth.token=incoming||localStorage.getItem('doing_member_token')||'';
  if(incoming){localStorage.setItem('doing_member_token',incoming);['member_token','member_status'].forEach(k=>u.searchParams.delete(k));history.replaceState({},'',u.pathname+u.search+u.hash)}
  const loginError=u.searchParams.get('member_login_error');if(loginError){u.searchParams.delete('member_login_error');history.replaceState({},'',u.pathname+u.search+u.hash);setTimeout(()=>{showMemberView('login');const x=ensureMemberGate().querySelector('.doing-member-error');if(x)x.textContent=loginError==='email_link_requires_existing_login'?'此 Email 已由 LINE 會員使用，請先以 LINE 登入；系統不會只憑相同 Email 自動合併帳號。':'登入未完成，請重新嘗試。'},20)}
  if(!memberAuth.token)return;
  try{const d=await apiGet('getPlatformMemberProfile',{member_token:memberAuth.token});setMemberState(d);if(!memberAuth.complete)setTimeout(showMemberProfile,20)}catch(e){memberAuth.token='';localStorage.removeItem('doing_member_token');updateMemberAuthUi()}
}
window.doingRequireMember=async resume=>{if(memberAuth.complete)return true;openMemberGate(resume);return false};
window.doingMemberToken=()=>memberAuth.token||'';
window.doingMemberProfile=()=>memberAuth.profile||null;

function wireNav(){
  const p=navParts();
  if(p.search)p.search.onclick=()=>smoothTo($('doingPublicSearch'),$('doingPublicSearchInput'));
  if(p.my)p.my.onclick=openMyEntry;
  if(p.support)p.support.onclick=()=>smoothTo($('doingHomeSupport'));
  document.querySelectorAll('[data-go="search"]').forEach(x=>x.onclick=()=>smoothTo($('doingPublicSearch'),$('doingPublicSearchInput')));
  document.querySelectorAll('[data-go="my"]').forEach(x=>x.onclick=openMyEntry);
  document.querySelectorAll('[data-my-action="login"]').forEach(x=>x.onclick=openMyLogin);
  document.querySelectorAll('[data-my-action="apply"]').forEach(x=>x.onclick=startFirstApplication);
  const myModal=$('doingMyEntryModal');
  myModal?.querySelector('.doing-my-entry-close')?.addEventListener('click',closeMyEntry);
  myModal?.addEventListener('click',e=>{if(e.target===myModal)closeMyEntry()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!myModal?.hidden)closeMyEntry()});
  document.querySelectorAll('[data-go="support"]').forEach(x=>x.onclick=()=>smoothTo($('doingHomeSupport')));
  document.querySelectorAll('[data-organizer-target]').forEach(x=>x.onclick=e=>{e.preventDefault();loadOrganizerDetails(x.dataset.organizerTarget||'scenes')});
  const initial=(location.hash||'').slice(1);
  if(['about','scenes','workflow','features','pricing','apply','support','terms','privacy'].includes(initial))loadOrganizerDetails(initial==='about'?'scenes':initial);
}

function wireSearch(){
  const input=$('doingPublicSearchInput');
  const go=$('doingPublicSearchGo');
  if(input)input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();searchActivities();}};
  if(go)go.onclick=searchActivities;
  document.querySelectorAll('.doing-quick-tags [data-q]').forEach(btn=>btn.onclick=()=>{
    if(input)input.value=btn.dataset.q||'';
    searchActivities();
  });
  document.querySelectorAll('.doing-quick-tags [data-location]').forEach(btn=>btn.onclick=()=>{if(input){input.value='';input.placeholder='輸入想找的地點';input.focus()}});
}

function wire(){
  ensureMemberGate();
  if(!isGlobal){initMemberAuth();return}
  buildHeader();
  buildPublicApp();
  wireNav();
  wireSearch();
  suppressTenantToast();
  watchActivities();
  initMemberAuth();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});
else wire();
})();
