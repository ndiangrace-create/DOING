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
    brand.dataset.hiddenAdminTarget='true';
    brand.innerHTML='<span class="doing-nav-logo"><img src="doing-logo.png?v=20260815k" alt="DOING" onerror="this.hidden=true;this.parentElement.classList.add(\'fallback\')"></span><span><b>活動營運管理系統</b></span>';
    brand.querySelector('img')?.setAttribute('draggable','false');
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
  if(p.support)p.support.remove();
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
  [p.search,p.pricing,p.apply].filter(Boolean).forEach(x=>{
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

let paidBoardRows=[];
let paidBoardKey='';
function randomPaidRows(){
  let base=[];
  try{base=Array.isArray(state.exposureItems)?state.exposureItems:[]}catch(e){}
  const key=base.map(x=>`${x.exposureOrderId||x.sessionId||x.id}:${Number(x.weight)||1}`).join('|');
  if(key===paidBoardKey)return paidBoardRows;
  paidBoardKey=key;
  const pool=base.slice();
  const out=[];
  while(pool.length){
    const total=pool.reduce((sum,x)=>sum+Math.max(1,Math.min(5,Number(x.weight)||1)),0);
    let pick=Math.random()*total,index=0;
    for(;index<pool.length;index++){
      pick-=Math.max(1,Math.min(5,Number(pool[index].weight)||1));
      if(pick<=0)break;
    }
    out.push(pool.splice(Math.min(index,pool.length-1),1)[0]);
  }
  paidBoardRows=out;
  return paidBoardRows;
}

function displayRows(){
  const rows=realRows();
  return rows;
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
  if(items[carouselIndex]&&!items[carouselIndex].isDemo)window.DoingAttribution?.track('impression',items[carouselIndex]);
}

function openActivity(item){
  if(item?.isDemo){
    smoothTo($('doingPublicSearch'),$('doingPublicSearchInput'));
    return;
  }
  if(!item?.tenantId||!item?.sessionId)return;
  if(window.DoingAttribution)return window.DoingAttribution.open(item);
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

function renderActivityList(items,query='',hostId='doingPublicActivityList'){
  const host=$(hostId);
  if(!host)return;
  const rows=Array.isArray(items)?items:[];
  if(!rows.length){host.innerHTML=`<div class="doing-list-empty"><b>${query?'找不到符合的活動':'目前沒有開放中的活動'}</b><span>${query?'換個活動名稱、類型或地點試試看。':'有新活動時會顯示在這裡。'}</span></div>`;return}
  host.innerHTML=rows.map((x,i)=>`<article class="doing-list-card" data-i="${i}" tabindex="0" role="link"><div class="doing-list-cover doing-cover-${(i%5)+1}">${x.cover?`<img src="${esc(x.cover)}" alt="" loading="lazy">`:`<span>${['市','課','體','親','約'][i%5]}</span>`}</div><div class="doing-list-copy"><small>${esc(itemType(x))}</small><h3>${esc(x.sessionName||x.eventTitle||'活動')}</h3><p>${esc(dateText(x.dates))}${x.venue?' · '+esc(x.venue):''}</p><span data-default-label="查看活動">${host.classList.contains('is-first-use')?'選擇這場並建立資料':'查看活動'} <b>→</b></span></div></article>`).join('');
  host.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const cover=img.closest('.doing-list-cover');if(cover){img.remove();cover.innerHTML=`<span>${['市','課','體','親','約'][Number(cover.closest('.doing-list-card')?.dataset.i||0)%5]}</span>`}},{once:true}));
  host.querySelectorAll('.doing-list-card').forEach(card=>{const go=()=>openActivity(rows[Number(card.dataset.i)]);card.onclick=go;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}});
  window.DoingAttribution?.observe(host.querySelectorAll('.doing-list-card'),card=>rows[Number(card.dataset.i)]);
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
  renderActivityList(results,raw,'doingPublicSearchResults');
  const section=$('doingPublicSearchResultsSection');if(section)section.hidden=false;
  smoothTo(section||$('doingPublicSearchResults'));
}

function watchActivities(){
  let tries=0;
  renderActivities(randomPaidRows());
  renderActivityList(realRows());
  const tick=()=>{
    tries++;
    const rows=realRows();
    const key=rows.map(x=>x.sessionId||x.id).join('|');
    if(rows.length&&key!==lastRowsKey){
      lastRowsKey=key;
      renderActivities(randomPaidRows());
      renderActivityList(rows);
      return;
    }
    if(tries<60)setTimeout(tick,500);
    else if(!rows.length){renderActivities(randomPaidRows());renderActivityList([])}
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
        <h1><span>找活動、報名、預約，</span><span>進度都在 DOING。</span></h1>
        <p class="doing-hero-desc">從找活動、送出報名，到查看審核、付款、候補、位置與行前通知，都能從「我的報名」接著處理，不用到處找訊息。</p>
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
      </div>
    </section>

    <section id="doingPublicSearchResultsSection" class="doing-public-section doing-list-section doing-search-results-section" aria-label="搜尋結果" hidden>
      <div class="doing-list-head"><div><span class="doing-kicker">搜尋結果</span><h2>符合條件的活動</h2></div><span>直接從這裡選擇，不必跨過其他區塊</span></div>
      <div id="doingPublicSearchResults" class="doing-public-activity-list" aria-live="polite"></div>
    </section>

    <section class="doing-public-section doing-activities-section" id="doingPublicActivities" aria-label="近期開放活動廣告輪播">
      <div class="doing-section-title row">
        <div><span class="doing-kicker">活動快訊</span><h2 id="doingActivityLabel">近期開放活動</h2><p>付費曝光中的活動會在這裡隨機輪播，點進去即可查看完整內容。</p></div>
        <span class="doing-ad-label">廣告</span>
      </div>
      <div class="doing-carousel-frame">
        <span class="doing-frame-title">DOING NOW</span>
        <button id="doingActivityPrev" class="doing-carousel-arrow prev" type="button" aria-label="上一個活動">‹</button>
        <div id="doingPublicActivityStage" class="doing-public-carousel" aria-live="polite"><div class="doing-empty-state"><b>正在讀取活動…</b></div></div>
        <button id="doingActivityNext" class="doing-carousel-arrow next" type="button" aria-label="下一個活動">›</button>
        <div class="doing-carousel-footer"><div id="doingActivityDots" class="doing-activity-dots" aria-label="活動頁數"></div><span id="doingActivityCount">1 / 5</span></div>
      </div>
    </section>

    <section class="doing-public-section doing-list-section" aria-label="所有開放活動">
      <div class="doing-list-head"><div><span class="doing-kicker">找活動</span><h2>所有開放活動</h2></div><span>左右滑動查看更多活動</span></div>
      <div id="doingPublicActivityList" class="doing-public-activity-list" aria-live="polite"></div>
    </section>

    <section class="doing-my-highlight" aria-label="快速報名功能亮點">
      <div class="doing-my-highlight-copy"><span class="doing-kicker">快速報名</span><h2>會員資料填一次，之後報名直接帶入。</h2><p>使用 LINE 登入後，第一次把姓名與聯絡方式填完。以後報名不用重填，錄取、付款、位置、退款和行前提醒都在會員中心查看。</p><div class="doing-my-highlight-actions"><button type="button" data-my-action="apply">第一次使用</button><button type="button" class="secondary" data-my-action="login">使用 LINE 登入</button></div></div>
      <div class="doing-my-highlight-points"><span><b>資料不用重填</b><small>後續報名快速帶入</small></span><span><b>付款與審核</b><small>最新狀態一次看</small></span><span><b>行前資訊</b><small>時間、地點與提醒集中查看</small></span></div>
    </section>

    <div id="doingMyMount"></div>

    <section class="doing-public-section doing-slash-scenes" aria-labelledby="doingSlashScenesTitle">
      <header><span class="doing-kicker">斜槓人生情境模擬</span><h2 id="doingSlashScenesTitle">你的工作不只一種，DOING 也不會只用一種產業理解你。</h2><p>不用先替自己選一個標籤。從「同一個人今天到底要做哪些事」開始，DOING 再把適合的報名、預約、審核、收款、通知與現場流程接起來。</p></header>
      <div class="doing-slash-scene-grid">
        <article><span>01｜平日 × 假日</span><h3>平常是設計師、跑現場監工，假日又是手作老師。</h3><p>平日工作留在原本的專業工具；假日開課時，DOING 接手梯次、名額、材料、報名、收款與行前通知。</p><div><b>原本會卡</b><em>客戶、工地、學生訊息全部混在聊天裡。</em></div><div class="doing-scene-answer"><b>DOING 接住</b><em>每份工作有自己的流程，同一個人不用建立好幾套身分。</em></div></article>
        <article><span>02｜主辦 × 多種內容</span><h3>辦市集，也辦活動、手作與體驗，表單多到整理不完。</h3><p>攤商招募要審核設備，民眾活動要報名付款，體驗還有時段與材料；流程不同，但都能回到同一個營運帳號。</p><div><b>原本會卡</b><em>一種內容一張表，名單、款項與通知各有不同版本。</em></div><div class="doing-scene-answer"><b>DOING 接住</b><em>依每次工作套用適合流程，再集中查看進度與正式紀錄。</em></div></article>
        <article><span>03｜服務 × 教學 × 活動</span><h3>美甲老師要服務客人，也會開課，偶爾還要合辦活動。</h3><p>日常預約需要老師與時段；課程需要名額、收款與提醒；活動需要報名、審核或現場報到，不必被迫拆成三個自己。</p><div><b>原本會卡</b><em>預約、學員與活動參加者散在不同工具，改期時特別容易漏。</em></div><div class="doing-scene-answer"><b>DOING 接住</b><em>基本資料能接續，各工作的預約、報名、帳務與人員權限仍分開。</em></div></article>
      </div>
      <p class="doing-slash-positioning"><b>DOING 是輔助系統，不是來取代其他工具。</b> 社群繼續曝光、金流繼續收款、專業軟體繼續工作；DOING 專心把斜槓人生最容易中斷的營運流程接起來。</p>
    </section>

    <section class="doing-public-section doing-organizer-section">
      <div class="doing-organizer-icon">D</div>
      <div><span class="doing-kicker yellow">不限產業的斜槓人生小幫手</span><h2>一個人有很多種工作，也值得有一套接得住的營運方式。</h2><p>今天接預約、明天開課、週末辦活動或出攤，都不必把自己硬塞進單一產業。DOING 保留你熟悉的社群、金流與曝光工具，補上跨工作最容易中斷的報名、名單、收款、通知與現場紀錄。</p></div>
      <div class="doing-organizer-actions"><a href="#doingOrganizerDetails" data-organizer-target="apply">申請營運帳號</a><a class="secondary" href="#doingOrganizerDetails" data-organizer-target="pricing">查看主辦方案</a></div>
    </section>

    <section id="doingOrganizerDetails" class="doing-organizer-details" hidden>
      <header class="doing-organizer-heading"><div><h2>主辦方案與營運情境</h2><p>需要時才展開，不占用報名者首頁。</p></div><button id="closeDoingOrganizerDetails" type="button" aria-label="關閉主辦方案或客服">關閉</button></header>
      <div id="doingOrganizerContent" class="doing-organizer-content"><div class="doing-organizer-loading">準備主辦方案…</div></div>
    </section>

    <footer class="doing-public-footer">
      <div><b>DOING</b><span>活動營運管理系統</span></div>
      <nav><a href="#doingOrganizerDetails" data-organizer-target="scenes">關於 DOING</a><a href="#doingOrganizerDetails" data-organizer-target="pricing">營運方案</a><a href="#doingOrganizerDetails" data-organizer-target="apply">申請營運帳號</a></nav>
      <small>兔彼樂共創活動有限公司</small>
    </footer>
    <div id="doingMyEntryModal" class="doing-my-entry-modal" hidden>
      <div class="doing-my-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="doingMyEntryTitle">
        <button type="button" class="doing-my-entry-close" aria-label="關閉">×</button>
        <span class="doing-kicker">DOING 會員</span><h2 id="doingMyEntryTitle">使用 LINE 登入會員。</h2><p>登入後可以報名任何 DOING 活動，也能集中查看錄取、付款、位置與行前提醒。第一次使用會在登入後請你補齊資料。</p>
        <div><button type="button" data-my-action="login">使用 LINE 登入</button><button type="button" class="secondary" data-my-action="apply">第一次使用</button></div>
      </div>
    </div>
    <button id="doingPublicSupportFab" class="doing-public-support-fab" type="button" aria-haspopup="dialog" aria-controls="doingPublicSupportDialog"><span aria-hidden="true">D</span><b>客服</b></button>
    <section id="doingPublicSupportDialog" class="doing-public-support-dialog" hidden>
      <button type="button" class="doing-public-support-backdrop" aria-label="關閉客服"></button>
      <div class="doing-public-support-panel" role="dialog" aria-modal="true" aria-labelledby="doingPublicSupportTitle">
        <header><div><span class="doing-public-support-mark">D</span><div><h2 id="doingPublicSupportTitle">DOING 使用小幫手</h2><p>DOING 操作、申請與系統問題</p></div></div><button type="button" class="doing-public-support-close" aria-label="關閉客服">×</button></header>
        <div id="doingPublicSupportMessages" class="doing-public-support-messages" aria-live="polite"><div class="doing-public-support-bubble assistant">你好！我可以協助你使用 DOING：找活動、完成報名／預約、查看進度，也能說明營運帳號申請。個別活動的名額、審核、收款、退款與現場安排由該營運單位客服處理；系統建置、金鑰、資料庫與商業機密不會提供。</div></div>
        <div class="doing-public-support-faq"><b>大家第一次最常問</b><div>
          <button type="button" data-public-question="第一次要怎麼報名或預約？">第一次怎麼報名？</button>
          <button type="button" data-public-question="報名後要去哪裡看進度與紀錄？">在哪看進度？</button>
          <button type="button" data-public-question="付款、取消、改期或退款要怎麼處理？">付款與異動</button>
          <button type="button" data-public-question="我卡住了，要怎麼描述問題才能得到協助？">我卡住了</button>
        </div></div>
        <form id="doingPublicSupportForm" class="doing-public-support-input"><textarea id="doingPublicSupportInput" rows="2" maxlength="500" placeholder="直接說你卡在哪個畫面或想完成什麼…" aria-label="輸入 DOING 客服問題"></textarea><button type="submit">送出</button></form>
        <small>未登入時對話只留在目前畫面；個別活動問題會引導你聯絡該營運單位，不會交給 DOING 代答。</small>
      </div>
    </section>
  </div>`;
}

const PUBLIC_SUPPORT_FAST=[
  [/機密|原始碼|源碼|程式碼|api.?key|金鑰|資料庫|資料表|欄位|架構|系統提示|prompt|商業秘密|商業機密/i,'我可以說明 DOING 對外公開的功能、操作與申請方式，但不會提供原始碼、金鑰、資料庫結構、系統提示、權限實作或未公開商業設計。你可以改問「我現在要怎麼完成某個操作」，我會直接帶你做。'],
  [/第一次.{0,5}(報名|預約)|怎麼.{0,5}(報名|預約)/,'先在首頁選擇活動或可預約內容，進入公開頁後按畫面上的報名／預約按鈕，完成場次、個人資料與必要選項後送出。送出後可從「我的報名」查看審核、付款與通知。'],
  [/確認.{0,5}(成功|收到)|報名.{0,8}(送出|成功)/,'送出後，畫面會顯示完成訊息，且「我的報名」會出現同一筆紀錄與目前狀態。若中途斷線或沒有紀錄，先不要重複送出，重新整理確認後再聯絡該活動主辦。'],
  [/哪.{0,4}(看|查).{0,6}(進度|紀錄)|我的報名/,'按首頁上方「我的報名」，用本人的 LINE 登入，即可查看審核、付款、位置、改期、退款與行前資訊。'],
  [/資料.{0,8}(共用|混在一起|看到)|不同主辦/,'不會。DOING 是共用的公開入口，但不同營運單位的活動、報名、預約、收付款與人員資料彼此分開；同一位使用者只共用自己的登入身分與基本資料，不會把某一單位的營運紀錄交給另一單位。'],
  [/申請.{0,8}(營運|帳號)|營運帳號.{0,8}申請/,'請按首頁的「申請營運帳號」，由申請小幫手依主題帶你完成品牌／單位、聯絡方式、工作情境與需求，確認整理結果後再用 LINE 驗證送出。客服對話與營運申請是兩個獨立入口。'],
  [/DOING.{0,8}(功能|使用|做什麼)|怎麼使用.DOING|DOING 怎麼使用/,'DOING 把找活動、報名／預約、審核候補、付款、通知、改期退款與現場報到接在同一筆紀錄；營運者也能申請帳號建立內容、管理名單與後續流程。你可以直接告訴我目前的角色和想完成的事，我會只說那一段操作。']
];
function publicSupportFastAnswer(question){const hit=PUBLIC_SUPPORT_FAST.find(([pattern])=>pattern.test(String(question||'')));return hit?.[1]||''}
function addPublicSupportBubble(text,role='assistant'){
  const host=$('doingPublicSupportMessages');if(!host)return null;const bubble=document.createElement('div');bubble.className='doing-public-support-bubble '+role;bubble.textContent=String(text||'');host.appendChild(bubble);host.scrollTop=host.scrollHeight;return bubble;
}
function addPublicSupportApplicationAction(bubble){if(!bubble)return;const button=document.createElement('button');button.type='button';button.className='doing-public-support-application-action';button.textContent='前往智慧申請';button.addEventListener('click',()=>{closePublicSupport();loadOrganizerDetails('apply',true)});bubble.appendChild(button)}
let publicHumanThreadId='',publicHumanMessageIds=new Set(),publicHumanPoller=null;
function humanSupportCategory(question){return /申請|補件|開通|營運帳號/.test(question)?'applicant':/需求|希望|建議|新增功能|系統功能/.test(question)?'system_request':'platform_user'}
async function loadPublicHumanConversation(){if(!memberAuth.token)return;const data=await apiGet('getDoingPublicSupportConversation',{member_token:memberAuth.token,threadId:publicHumanThreadId});if(!data.thread)return;publicHumanThreadId=data.thread.id;for(const message of data.messages||[]){if(publicHumanMessageIds.has(message.id))continue;publicHumanMessageIds.add(message.id);if(message.sender_scope==='platform')addPublicSupportBubble('真人客服：'+message.body,'assistant')}if(!publicHumanPoller)publicHumanPoller=setInterval(()=>loadPublicHumanConversation().catch(()=>{}),20000)}
async function createPublicHumanSupport(question,bubble){
  if(!memberAuth.token||!memberAuth.complete){addPublicSupportBubble('聯絡真人客服需要先使用本人的 LINE 登入。登入完成後會回到這裡送出剛才的問題。');openMemberGate(()=>createPublicHumanSupport(question,bubble));return}
  const button=bubble?.querySelector('.doing-public-support-human-action');if(button)button.disabled=true;
  try{const data=await apiPost('createDoingPublicSupportThread',{member_token:memberAuth.token,body:question,category:humanSupportCategory(question)});publicHumanThreadId=data.thread.id;publicHumanMessageIds.add(data.message.id);addPublicSupportBubble('已轉交 DOING 真人客服。你可以先離開此畫面；回來開啟客服時，真人回覆會接在同一段對話中。');await loadPublicHumanConversation()}
  catch(error){addPublicSupportBubble(error.message||'真人客服案件暫時無法建立，請稍後再試。')}finally{if(button)button.disabled=false}
}
function addPublicSupportHumanAction(bubble,question){if(!bubble||bubble.querySelector('.doing-public-support-human-action'))return;const button=document.createElement('button');button.type='button';button.className='doing-public-support-human-action';button.textContent='聯絡真人客服';button.addEventListener('click',()=>createPublicHumanSupport(question,bubble));bubble.appendChild(button)}
function isTenantOwnedQuestion(question){return /(?:這個|該|某個|我的).{0,8}(?:活動|課程|預約).{0,16}(?:名額|錄取|審核|候補|付款|退款|取消|改期|位置|時間|設備|報到|通知)|(?:為什麼|何時|什麼時候).{0,12}(?:錄取|退款|入帳|審核)|(?:活動|主辦|店家).{0,10}(?:規定|客服|退款|收款)/.test(String(question||''))}
async function askPublicSupport(question){
  const value=String(question||'').trim();if(!value)return;addPublicSupportBubble(value,'user');if(isTenantOwnedQuestion(value)){addPublicSupportBubble('這是個別活動或營運單位的正式決定，DOING 不會代替對方回答。請從「我的報名」打開該筆紀錄查看主辦資訊，或回到活動頁聯絡該營運單位客服；若你是卡在 DOING 按鈕、登入或畫面錯誤，再告訴我畫面與提示文字。');return}const quick=publicSupportFastAnswer(value);if(quick){const answer=addPublicSupportBubble(quick);if(/申請|開通|營運帳號/.test(value))addPublicSupportApplicationAction(answer);return}
  const waiting=addPublicSupportBubble('正在確認 DOING 的公開操作說明…');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{let memberToken='';try{memberToken=localStorage.getItem('doing_member_token')||''}catch(_){}const history=[...$('doingPublicSupportMessages').querySelectorAll('.doing-public-support-bubble')].slice(-8,-1).map(x=>({role:x.classList.contains('user')?'user':'assistant',content:x.textContent.slice(0,500)}));const response=await fetch(API+'?action=analyzeDoingApplication',{method:'POST',headers:{'Content-Type':'application/json;charset=UTF-8'},body:JSON.stringify({action:'analyzeDoingApplication',topic:'question',question:value,useCases:['general'],painPoints:['other'],workSituations:[],conversationHistory:history,member_token:memberToken}),signal:controller.signal});const result=await response.json();if(!response.ok||result.error)throw new Error(result.error||'客服暫時無法回覆');waiting.textContent=String(result.reply||'這題需要 DOING 人員確認，我先不猜答案。');if(/申請|開通|營運帳號/.test(value))addPublicSupportApplicationAction(waiting);if(/需要 DOING 人員確認|我先不猜/.test(waiting.textContent)||/需求|希望|建議|新增功能/.test(value)||/api_timeout|api_unavailable|ai_invalid_output/.test(String(result.engineStatus||'')))addPublicSupportHumanAction(waiting,value)}
  catch(_){waiting.textContent='目前連線比較慢，智慧小幫手無法完成這次回答。你可以再送一次，或轉由 DOING 真人客服接手。';if(!isTenantOwnedQuestion(value))addPublicSupportHumanAction(waiting,value)}finally{clearTimeout(timer)}
}
function openPublicSupport(){const dialog=$('doingPublicSupportDialog');if(!dialog)return;dialog.hidden=false;document.body.classList.add('doing-support-open');loadPublicHumanConversation().catch(()=>{});setTimeout(()=>$('doingPublicSupportInput')?.focus(),40)}
function closePublicSupport(){const dialog=$('doingPublicSupportDialog');if(!dialog)return;dialog.hidden=true;document.body.classList.remove('doing-support-open');$('doingPublicSupportFab')?.focus()}
function wirePublicSupport(){
  $('doingPublicSupportFab')?.addEventListener('click',openPublicSupport);document.querySelectorAll('[data-public-support-open]').forEach(x=>x.addEventListener('click',openPublicSupport));
  $('doingPublicSupportDialog')?.querySelectorAll('.doing-public-support-close,.doing-public-support-backdrop').forEach(x=>x.addEventListener('click',closePublicSupport));
  document.querySelectorAll('[data-public-question]').forEach(x=>x.addEventListener('click',()=>askPublicSupport(x.dataset.publicQuestion)));
  $('doingPublicSupportForm')?.addEventListener('submit',e=>{e.preventDefault();const input=$('doingPublicSupportInput'),value=input?.value||'';if(input)input.value='';askPublicSupport(value)});
  $('doingPublicSupportInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('doingPublicSupportForm')?.requestSubmit()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('doingPublicSupportDialog')?.hidden)closePublicSupport()});
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
  const applicationMode=target==='apply',actualTarget=target;
  details.hidden=false;
  const heading=details.querySelector('.doing-organizer-heading'),headingTitle=heading?.querySelector('h2'),headingText=heading?.querySelector('p');
  if(headingTitle)headingTitle.textContent=applicationMode?'營運帳號智慧申請':'營運方案與斜槓情境';
  if(headingText)headingText.textContent=applicationMode?'這裡只處理 DOING 營運帳號申請；一般報名客服在右側獨立按鈕。':'只顯示你選擇的營運資訊，不展開整頁舊內容。';
  [...content.children].forEach(section=>{if(section.matches('section'))section.hidden=section.id!==actualTarget});
  const section=content.querySelector('#'+CSS.escape(actualTarget))||content.querySelector('#scenes');
  const helperSection=content.querySelector('#apply'),helperHeading=helperSection?.querySelector('.doing-helper-section-head'),helperStartActions=content.querySelector('.doing-helper-start-actions');
  if(applicationMode){
    if(helperHeading){helperHeading.querySelector('h2').textContent='DOING 營運帳號智慧申請';helperHeading.querySelector('p').textContent='一次完成一個申請主題，可勾選也可補充文字。';}
    if(helperStartActions)helperStartActions.hidden=true;
    content.querySelector('#doingHelperWelcome')?.removeAttribute('hidden');content.querySelector('#signupForm')?.setAttribute('hidden','');content.querySelector('#startDoingApplication')?.click();
  }else{
    if(helperHeading){helperHeading.querySelector('h2').textContent='DOING 智慧小幫手';helperHeading.querySelector('p').textContent='申請營運帳號或詢問使用問題，都在這個獨立對話區完成。'}
    if(helperStartActions)helperStartActions.hidden=false;
  }
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
  const support=$('pageSupport');if(support)support.remove();
  const oldSingle=$('doingSinglePageSections');if(oldSingle)oldSingle.remove();
  const oldModal=$('globalSearchModal');if(oldModal)oldModal.classList.remove('show');
  $('closeDoingOrganizerDetails')?.addEventListener('click',()=>{const details=$('doingOrganizerDetails');if(details)details.hidden=true;window.scrollTo({top:0,behavior:'smooth'})});
  wirePublicSupport();
}

function openMyEntry(){if(memberAuth.complete){location.href='member.html';return}const modal=$('doingMyEntryModal');if(modal){modal.hidden=false;document.body.style.overflow='hidden';modal.querySelector('[data-my-action="login"]')?.focus()}}
function closeMyEntry(){const modal=$('doingMyEntryModal');if(modal){modal.hidden=true;document.body.style.overflow=''}}
function openMyLogin(){closeMyEntry();if(memberAuth.complete)location.href='member.html';else openMemberGate()}
function startFirstApplication(){closeMyEntry();openMemberGate()}

const memberAuth={token:'',profile:null,complete:false,resume:null,provider:'',linkedProviders:[],roles:[],applications:[],workspaces:[],brands:[]};
async function openMemberWorkspaceAdmin(space,calendar=true){const tenantId=String(space&&space.id||'').trim().toLowerCase();if(!tenantId||!memberAuth.token){location.href='member.html#operations';return}try{const d=await apiPost('createMemberWorkspaceAdminSession',{member_token:memberAuth.token,tenantId});const u=new URL('admin.html',location.href);u.searchParams.set('tenant',d.tenantId);u.searchParams.set('from','tenant');u.searchParams.set('admin_token',d.adminToken);if(calendar)u.hash='calendar';location.href=u.toString()}catch(e){if(typeof toast==='function')toast(e.message||'無法進入這個營運空間');else alert(e.message||'無法進入這個營運空間')}}
function isLineBrowser(){return /\bLine\//i.test(navigator.userAgent)||/LIFF/i.test(navigator.userAgent)}
function memberReturnUrl(){const u=new URL(location.href);['member_token','member_status','member_login_error','login_error','member_linked'].forEach(k=>u.searchParams.delete(k));return u.toString()}
function authStart(provider){
  const path=provider==='line'?'/auth/line/start':'/auth/google/start';
  const u=new URL(API+path);u.searchParams.set('return_url',memberReturnUrl());if(provider==='google')u.searchParams.set('mode','member');location.href=u.toString();
}
function memberGateHTML(){const vendorCats=['餐飲美食','手作設計','文創選物','服飾配件','生活用品','親子兒童','寵物相關','收藏娛樂','美類','體驗／服務','其他'];return `<div id="doingMemberGate" class="doing-member-gate" hidden><div class="doing-member-dialog" role="dialog" aria-modal="true"><button type="button" class="doing-member-close">×</button><section data-member-view="login"><span class="doing-kicker">DOING 會員</span><h2>使用 LINE 登入</h2><p>登入後就能報名活動、查看進度，也不用每次重填資料。</p><button type="button" class="doing-line-login">使用 LINE 登入</button><button type="button" class="doing-google-login" hidden aria-hidden="true" tabindex="-1">使用 Google 登入</button></section><section data-member-view="tree" hidden><span class="doing-kicker">DOING 會員中心</span><h2 data-member-welcome>已登入</h2><p data-member-account></p><div class="doing-member-tree" data-member-tree></div><div class="doing-member-tree-actions"><button type="button" data-member-edit>編輯會員資料</button><button type="button" class="secondary" data-member-logout>登出</button></div></section><form data-member-view="profile" hidden><span class="doing-kicker">會員資料</span><h2>填一次，以後直接報名</h2><p>先完成姓名與聯絡方式。如果你也是攤商或想開設自己的系統，再勾選對應資料即可。</p><fieldset><legend>一、基本資料（報名活動會用到）</legend><label>姓名 *<input name="name" required></label><label>Email *<input name="email" type="email" required></label><label>手機 *<input name="phone" inputmode="tel" required></label><label>LINE 帳號<input name="lineId"></label><label>所在縣市<input name="city"></label></fieldset><fieldset><legend>登入帳號同步</legend><p data-link-status>目前以 LINE 登入為主。同步後，另一種登入方式也會進到同一份會員資料。</p><button type="button" data-link-account>同步 Google 帳號</button></fieldset><fieldset><legend><label><input type="checkbox" name="enableVendor"> 二、我是攤商／有品牌</label></legend><div data-vendor-fields hidden><label>品牌／公司名稱 *<input name="brandName"></label><label>品牌介紹 *<textarea name="brandIntro"></textarea></label><label>品牌類別 *<select name="category"><option value="">請選擇</option>${vendorCats.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label><label>主要品項<input name="items"></label><label>Facebook<input name="facebook" type="url"></label><label>Instagram<input name="instagram" type="url"></label><label>作品／介紹網址<input name="photoUrl" type="url"></label><label>公司登記名稱<input name="company"></label><label>統一編號<input name="taxId"></label></div></fieldset><fieldset><legend><label><input type="checkbox" name="enableSystem"> 三、我想使用 DOING 經營</label></legend><div data-system-fields hidden><label>營運單位名稱 *<input name="unitName"></label><p class="doing-check-title">你目前經營哪些內容？（可複選）*</p><div class="doing-check-grid">${['市集展售','活動展演','課程講座','手作體驗','美類','場地／攝影棚','導覽戶外','專業服務預約','其他'].map(x=>`<label><input type="checkbox" name="industry" value="${x}">${x}</label>`).join('')}</div><p class="doing-check-title">你最想管理哪些工作？（可複選）*</p><div class="doing-check-grid">${['活動報名','審核付款','攤位設備','選位排位','課程預約','會員管理','通知報到','財務結案'].map(x=>`<label><input type="checkbox" name="useCase" value="${x}">${x}</label>`).join('')}</div></div></fieldset><button type="submit" class="doing-member-save">儲存會員資料</button><div class="doing-member-error" aria-live="polite"></div></form></div></div>`}
function ensureMemberGate(){
  if($('doingMemberGate'))return $('doingMemberGate');
  document.body.insertAdjacentHTML('beforeend',memberGateHTML());const modal=$('doingMemberGate'),form=modal.querySelector('form');
  const useCaseGrid=form.querySelector('[name="useCase"]')?.closest('.doing-check-grid');
  if(useCaseGrid&&!form.querySelector('[name="useCase"][value="預約管理"]'))useCaseGrid.insertAdjacentHTML('beforeend','<label><input type="checkbox" name="useCase" value="預約管理">預約管理</label>');
  modal.querySelector('.doing-member-close').onclick=()=>{modal.hidden=true;document.body.style.overflow=''};
  modal.querySelector('.doing-line-login').onclick=()=>authStart('line');
  modal.querySelector('.doing-google-login').onclick=()=>authStart('google');
  form.elements.enableVendor.onchange=e=>form.querySelector('[data-vendor-fields]').hidden=!e.target.checked;
  form.elements.enableSystem.onchange=e=>form.querySelector('[data-system-fields]').hidden=!e.target.checked;
  modal.querySelector('[data-member-edit]').onclick=showMemberProfile;
  modal.querySelector('[data-member-logout]').onclick=logoutMember;
  modal.querySelector('[data-link-account]').onclick=linkGoogleAccount;
  form.onsubmit=saveMemberProfile;return modal;
}
function showMemberView(view){const modal=ensureMemberGate();modal.hidden=false;document.body.style.overflow='hidden';modal.querySelectorAll('[data-member-view]').forEach(x=>x.hidden=x.dataset.memberView!==view)}
function showMemberProfile(){const modal=ensureMemberGate(),form=modal.querySelector('form'),p=memberAuth.profile||{},brand=(memberAuth.brands||[]).find(x=>x.membershipStatus==='active')||null,app=(memberAuth.applications||[])[0]||{};for(const key of ['name','email','phone','lineId','city'])if(form.elements[key])form.elements[key].value=p[key]||'';const linked=new Set(memberAuth.linkedProviders||[]),linkBtn=form.querySelector('[data-link-account]'),linkStatus=form.querySelector('[data-link-status]');linkBtn.disabled=linked.has('google');linkBtn.textContent=linked.has('google')?'LINE、Google 已同步':'同步 Google 帳號';linkStatus.textContent=linked.has('google')?'兩種登入方式已連到同一份 DOING 會員資料。':'目前以 LINE 登入為主。同步後，Google 也會進到同一份會員資料。';const vendor=!!brand;form.elements.enableVendor.checked=vendor;form.querySelector('[data-vendor-fields]').hidden=!vendor;if(vendor){form.elements.brandName.value=brand.name||'';form.elements.brandIntro.value=brand.intro||'';form.elements.category.value=brand.category||'';form.elements.items.value=brand.items||'';form.elements.facebook.value=brand.facebook||'';form.elements.instagram.value=brand.instagram||'';form.elements.photoUrl.value=brand.photoUrl||'';form.elements.company.value=brand.company||'';form.elements.taxId.value=brand.taxId||''}const system=!!(app.id||memberAuth.workspaces?.length);form.elements.enableSystem.checked=system;form.querySelector('[data-system-fields]').hidden=!system;form.elements.unitName.value=app.unitName||memberAuth.workspaces?.[0]?.name||'';const industries=new Set(app.industryCategories||[]),useCases=new Set(app.useCases||[]);form.querySelectorAll('[name="industry"]').forEach(x=>x.checked=industries.has(x.value));form.querySelectorAll('[name="useCase"]').forEach(x=>x.checked=useCases.has(x.value));form.querySelector('.doing-member-save').textContent='儲存會員資料';showMemberView('profile')}
async function linkGoogleAccount(){const modal=ensureMemberGate(),error=modal.querySelector('.doing-member-error'),btn=modal.querySelector('[data-link-account]');error.textContent='';btn.disabled=true;try{const d=await apiPost('createIdentityLink',{member_token:memberAuth.token,provider:'google',return_url:memberReturnUrl()});if(d.alreadyLinked){memberAuth.linkedProviders=[...new Set([...(memberAuth.linkedProviders||[]),'google'])];showMemberProfile();return}location.href=d.url}catch(e){error.textContent=e.message||'帳號同步失敗，請稍後再試';btn.disabled=false}}
function memberStatusLabel(s){return ({pending:'審核中',approved:'已通過',active:'使用中',supplement_required:'待補件',rejected:'未通過'}[s]||s||'尚未申請')}
function memberTreeHTML(){const p=memberAuth.profile||{},brands=(memberAuth.brands||[]).filter(x=>x.membershipStatus==='active'),apps=memberAuth.applications||[],spaces=memberAuth.workspaces||[];return `<article class="is-done"><b>① 基本會員</b><span>已完成</span><small>${esc(p.name||'')}｜${esc(p.phone||'')}</small></article><article class="${brands.length?'is-done':''}"><b>② 我的品牌</b><span>${brands.length?brands.length+' 個':'尚未建立'}</span><small>${brands.length?esc(brands.map(x=>x.name).join('、')):'第一次報名時也可直接建立'}</small></article><article class="${apps.length||spaces.length?'is-done':''}"><b>③ 主辦／系統</b><span>${spaces.length?'已啟用':apps.length?memberStatusLabel(apps[0].status):'尚未申請'}</span><small>${esc(spaces[0]?.name||apps[0]?.unitName||'需要開設系統時再申請')}</small></article><article class="is-done"><b>④ 我的活動</b><span>可使用</span><small>報名、出攤成員、位置、報到與撤場</small></article>`}
function showMemberTree(){showMemberPage()}
async function showMemberPage(){if(!memberAuth.complete){openMemberGate();return}closeMyEntry();const panel=$('doingHomeMy'),p=memberAuth.profile||{};if(!panel)return;panel.hidden=false;panel.classList.add('is-open');let dashboard=$('doingMemberDashboard');if(!dashboard){dashboard=document.createElement('div');dashboard.id='doingMemberDashboard';dashboard.className='doing-member-page-dashboard';panel.prepend(dashboard)}dashboard.innerHTML=`<div class="doing-member-page-head"><div><span class="doing-kicker">DOING 會員中心</span><h2>${esc(p.name||'會員')}，你好</h2><p>已使用 LINE 登入｜${esc(p.email||'')}</p></div><div><button type="button" data-page-edit>編輯我的資料</button><button type="button" class="secondary" data-page-logout>登出</button></div></div><div class="doing-member-tree">${memberTreeHTML()}</div>`;dashboard.querySelector('[data-page-edit]').onclick=showMemberProfile;dashboard.querySelector('[data-page-logout]').onclick=logoutMember;const legacy=$('myLogin');if(legacy)legacy.hidden=true;const title=panel.querySelector('.section-title');if(title){title.querySelector('h2').textContent='我的活動';title.querySelector('p').textContent='報名進度、付款、位置、退款與行前提醒都在這裡。'}smoothTo(panel);await loadMemberActivities()}
async function loadMemberActivities(){const records=$('myRecords');if(records)records.innerHTML='<div class="empty">正在讀取你的活動…</div>';try{const rows=await apiGet('getMyRegsGlobal',{member_token:memberAuth.token});state.myEmail=memberAuth.profile?.email||'';state.myPhone=memberAuth.profile?.phone||'';state.myRows=Array.isArray(rows)?rows:[];renderMy(state.myRows)}catch(e){if(records)records.innerHTML=`<div class="empty">${esc(e.message||'讀取失敗')}</div>`;if(typeof toast==='function')toast(e.message||'讀取失敗')}}
function updateMemberAuthUi(){const p=memberAuth.profile||{},label=memberAuth.complete?`${p.name||'會員'}｜會員中心`:'LINE 登入';document.querySelectorAll('[data-my-action="login"]').forEach(x=>x.textContent=label);document.querySelectorAll('[data-my-action="apply"]').forEach(x=>{x.hidden=memberAuth.complete});const top=$('globalMyNavBtn');if(top)top.textContent=memberAuth.complete?(p.name||'會員'):'LINE 登入';const tenantTop=$('memberLoginBtn');if(tenantTop)tenantTop.textContent=memberAuth.complete?(memberAuth.workspaces.length===1?'營運管理':'我的 DOING'):'LINE 登入';const title=$('doingMyEntryTitle');if(title&&memberAuth.complete)title.textContent=`${p.name||'會員'}，已登入`}
function logoutMember(){memberAuth.token='';memberAuth.profile=null;memberAuth.complete=false;memberAuth.provider='';memberAuth.linkedProviders=[];memberAuth.roles=[];memberAuth.applications=[];memberAuth.workspaces=[];memberAuth.brands=[];localStorage.removeItem('doing_member_token');ensureMemberGate().hidden=true;const panel=$('doingHomeMy');if(panel){panel.hidden=true;panel.classList.remove('is-open')}document.body.style.overflow='';updateMemberAuthUi();if(typeof toast==='function')toast('已登出 DOING 會員')}
function openMemberGate(resume){if(resume)memberAuth.resume=resume;if(memberAuth.complete){const fn=memberAuth.resume;memberAuth.resume=null;if(fn)fn();return true}showMemberView(memberAuth.token?'profile':'login');return false}
async function saveMemberProfile(e){
  e.preventDefault();const form=e.currentTarget,fd=new FormData(form),vendorOn=fd.has('enableVendor'),systemOn=fd.has('enableSystem'),error=form.querySelector('.doing-member-error'),btn=form.querySelector('.doing-member-save');error.textContent='';btn.disabled=true;
  const brand=vendorOn?{brandId:(memberAuth.brands||[]).find(x=>x.membershipStatus==='active'&&['owner','manager'].includes(x.role))?.id||'',brandName:fd.get('brandName'),brandIntro:fd.get('brandIntro'),category:fd.get('category'),items:fd.get('items'),facebook:fd.get('facebook'),instagram:fd.get('instagram'),photoUrl:fd.get('photoUrl'),company:fd.get('company'),taxId:fd.get('taxId')}:null;
  const payload={member_token:memberAuth.token,name:fd.get('name'),email:fd.get('email'),phone:fd.get('phone'),lineId:fd.get('lineId'),city:fd.get('city'),systemApplication:systemOn?{enabled:true,unitName:fd.get('unitName'),industryCategories:fd.getAll('industry'),useCases:fd.getAll('useCase')}:{enabled:false}};
  if(vendorOn&&(!String(brand.brandName).trim()||!String(brand.brandIntro).trim()||!String(brand.category).trim())){error.textContent='攤商登錄請完整填寫品牌名稱、介紹與類別';btn.disabled=false;return}
  try{const d=await apiPost('savePlatformMemberProfile',payload);if(brand){let saved=await apiPost('saveMemberBrand',{member_token:memberAuth.token,brand});if(saved.needsResolution){const match=saved.matches?.[0];if(confirm(`系統找到同名品牌「${match?.name||brand.brandName}」。\n\n按「確定」＝我是這個品牌的成員，送出加入申請。\n按「取消」＝只是同名，建立另一個品牌。`)){saved=await apiPost('saveMemberBrand',{member_token:memberAuth.token,brand,resolution:'join',candidateBrandId:match?.id});error.textContent=saved.message||'已送出加入品牌申請';memberAuth.resume=null}else{const distinguishingInfo=prompt('請補一項辨識資料，例如所在地區、公司登記名稱或官方網址。')||'';if(!distinguishingInfo.trim())throw new Error('尚未建立品牌；同名品牌需要一項辨識資料');saved=await apiPost('saveMemberBrand',{member_token:memberAuth.token,brand,resolution:'separate',candidateBrandId:match?.id,distinguishingInfo})}}}const fresh=await apiGet('getPlatformMemberProfile',{member_token:memberAuth.token});setMemberState(fresh);localStorage.setItem('doing_member_token',memberAuth.token);if(typeof toast==='function')toast(d.applicationId?'會員與系統申請已完成':'會員資料已儲存');const fn=memberAuth.resume;memberAuth.resume=null;if(fn){ensureMemberGate().hidden=true;document.body.style.overflow='';fn()}else showMemberTree()}catch(err){error.textContent=err.message||'儲存失敗'}finally{btn.disabled=false}
}
function setMemberState(d){memberAuth.complete=!!d.complete;memberAuth.profile=d.profile||null;memberAuth.provider=d.provider||'';memberAuth.linkedProviders=Array.isArray(d.linkedProviders)?d.linkedProviders:[];memberAuth.roles=Array.isArray(d.roles)?d.roles:[];memberAuth.applications=Array.isArray(d.applications)?d.applications:[];memberAuth.workspaces=Array.isArray(d.workspaces)?d.workspaces:[];memberAuth.brands=Array.isArray(d.brands)?d.brands:[];updateMemberAuthUi()}
async function initMemberAuth(){
  const u=new URL(location.href),incoming=u.searchParams.get('member_token'),linked=u.searchParams.get('member_linked');memberAuth.token=incoming||localStorage.getItem('doing_member_token')||'';
  if(incoming)localStorage.setItem('doing_member_token',incoming);
  const loginError=u.searchParams.get('member_login_error')||u.searchParams.get('login_error');if(loginError){u.searchParams.delete('member_login_error');u.searchParams.delete('login_error');history.replaceState({},'',u.pathname+u.search+u.hash);setTimeout(()=>{showMemberView(memberAuth.token?'profile':'login');const x=ensureMemberGate().querySelector('.doing-member-error');if(x)x.textContent=loginError==='identity_resolution_required'?'這個 Email 或手機已綁定既有 DOING 帳號，申請草稿已保留。請先登入原帳號，再同步目前的 LINE／Google；無法使用原登入時請聯絡平台協助。':loginError==='email_link_requires_existing_login'?'Google 同步未完成，請確認使用原申請帳號；若仍失敗請聯絡 DOING 客服。':loginError==='line_email_permission_required'?'LINE 登入尚未完成，請稍後再試。':loginError==='line_only'?'目前會員端只開放 LINE 登入。':'登入或帳號同步未完成，請重新嘗試。'},20)}
  if(!memberAuth.token)return;
  let lastError=null;
  for(let attempt=0;attempt<(incoming?3:1);attempt++){
    try{
      if(attempt)await new Promise(resolve=>setTimeout(resolve,500*attempt));
      const d=await apiGet('getPlatformMemberProfile',{member_token:memberAuth.token});setMemberState(d);
      if(incoming){['member_token','member_status','member_linked'].forEach(k=>u.searchParams.delete(k));history.replaceState({},'',u.pathname+u.search+u.hash)}
      if(!memberAuth.complete||u.searchParams.get('openMemberProfile')==='1'){u.searchParams.delete('openMemberProfile');history.replaceState({},'',u.pathname+u.search+u.hash);setTimeout(showMemberProfile,20)}
      else if(incoming){window.scrollTo({top:0,behavior:'auto'});if(typeof toast==='function')toast(linked==='google'?'Google 已同步到同一個 DOING 帳號':'LINE 登入成功')}
      return;
    }catch(e){lastError=e}
  }
  memberAuth.token='';localStorage.removeItem('doing_member_token');updateMemberAuthUi();
  if(incoming){['member_token','member_status','member_linked'].forEach(k=>u.searchParams.delete(k));history.replaceState({},'',u.pathname+u.search+u.hash);setTimeout(()=>{showMemberView('login');const x=ensureMemberGate().querySelector('.doing-member-error');if(x)x.textContent=lastError?.message||'登入資料讀取失敗，請稍後再試'},20)}
}
window.doingRequireMember=async resume=>{if(memberAuth.complete)return true;openMemberGate(resume);return false};
window.doingMemberToken=()=>memberAuth.token||'';
window.doingMemberProfile=()=>memberAuth.profile||null;
window.doingMemberBrands=()=>memberAuth.brands||[];

function wireNav(){
  const p=navParts();
  if(p.search)p.search.onclick=()=>smoothTo($('doingPublicSearch'),$('doingPublicSearchInput'));
  if(p.my)p.my.onclick=openMyEntry;
  document.querySelectorAll('[data-go="search"]').forEach(x=>x.onclick=()=>smoothTo($('doingPublicSearch'),$('doingPublicSearchInput')));
  document.querySelectorAll('[data-go="my"]').forEach(x=>x.onclick=openMyEntry);
  document.querySelectorAll('[data-my-action="login"]').forEach(x=>x.onclick=openMyLogin);
  document.querySelectorAll('[data-my-action="apply"]').forEach(x=>x.onclick=startFirstApplication);
  const myModal=$('doingMyEntryModal');
  myModal?.querySelector('.doing-my-entry-close')?.addEventListener('click',closeMyEntry);
  myModal?.addEventListener('click',e=>{if(e.target===myModal)closeMyEntry()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!myModal?.hidden)closeMyEntry()});
  document.querySelectorAll('[data-go="support"]').forEach(x=>x.onclick=openPublicSupport);
  document.querySelectorAll('[data-organizer-target]').forEach(x=>x.onclick=e=>{e.preventDefault();loadOrganizerDetails(x.dataset.organizerTarget||'scenes')});
  const initial=(location.hash||'').slice(1);
  if(['about','scenes','workflow','features','pricing','apply','support','terms','privacy'].includes(initial)){if(initial==='support')openPublicSupport();else loadOrganizerDetails(initial==='about'?'scenes':initial)}
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
  if(!isGlobal){
    const openTenantMember=()=>{if(!memberAuth.complete){openMemberGate();return}const spaces=memberAuth.workspaces||[];if(spaces.length===1){openMemberWorkspaceAdmin(spaces[0],true);return}location.href='member.html#operations'};
    const top=$('memberLoginBtn');if(top)top.onclick=openTenantMember;
    document.querySelectorAll('.bottom-nav button[data-page="my"]').forEach(x=>x.onclick=openTenantMember);
    initMemberAuth();return
  }
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
