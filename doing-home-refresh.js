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
    brand.innerHTML='<span class="doing-nav-logo">D</span><span><b>DOING</b><small>活動營運管理系統</small></span>';
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
    p.pricing.href='about.html#pricing';
    p.pricing.classList.add('doing-organizer-nav');
  }
  if(p.apply){
    p.apply.textContent='申請營運帳號';
    p.apply.href='about.html#apply';
    p.apply.classList.add('doing-organizer-nav','primary');
  }
  [p.search,p.my,p.support,p.pricing,p.apply].filter(Boolean).forEach(x=>{
    x.classList.add('doing-nav-action');
    if(x.tagName==='BUTTON')x.type='button';
    actions.appendChild(x);
  });
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
  smoothTo($('doingPublicActivities'));
}

function watchActivities(){
  let tries=0;
  renderActivities(displayRows());
  const tick=()=>{
    tries++;
    const rows=realRows();
    const key=rows.map(x=>x.sessionId||x.id).join('|');
    if(rows.length&&key!==lastRowsKey){
      lastRowsKey=key;
      renderActivities(rows.slice(0,5));
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
      <span class="doing-bee" aria-hidden="true"><i></i></span><span class="doing-bunny" aria-hidden="true"><i></i><b></b></span>
      <div class="doing-hero-copy" id="doingPublicSearch">
        <span class="doing-eyebrow">活動預約營運管理系統</span>
        <div class="doing-wordmark" aria-label="DOING"><span>D</span><span class="doing-check-o"><b>✓</b></span><span>I</span><span>N</span><span>G</span></div>
        <p class="doing-hero-tagline">先做就對了！美好從這裡開始。</p>
        <h1>把週末，安排成喜歡的樣子。</h1>
        <p class="doing-hero-desc">逛市集、看展演、上課、做體驗，或替自己預約一段喜歡的時間。所有主辦的公開活動，都從 DOING 開始。</p>
        <div class="doing-search-box">
          <span class="doing-search-icon" aria-hidden="true"></span>
          <input id="doingPublicSearchInput" type="search" placeholder="搜尋活動、課程、體驗或地點" aria-label="搜尋活動、課程、體驗或地點" autocomplete="off">
          <button id="doingPublicSearchGo" type="button">搜尋</button>
        </div>
        <div class="doing-quick-tags" aria-label="活動快速分類">
          <button type="button" data-q="市集">市集</button><button type="button" data-q="課程">課程</button><button type="button" data-q="體驗">體驗</button><button type="button" data-q="預約">預約</button><button type="button" data-q="高雄">高雄</button>
        </div>
      </div>
      <div class="doing-hero-console" aria-label="DOING 系統服務">
        <div class="doing-console-top"><span></span><span></span><span></span><b>DOING</b></div>
        <div class="doing-console-card main"><small>一個入口完成</small><b>找活動 → 報名 → 付款</b><span>我的報名隨時查看進度</span></div>
        <div class="doing-console-grid">
          <div><i>♡</i><b>活動探索</b><span>跨主辦搜尋</span></div>
          <div><i>✓</i><b>報名紀錄</b><span>狀態集中管理</span></div>
          <div><i>✦</i><b>行前提醒</b><span>資訊不漏接</span></div>
          <div><i>→</i><b>直接出發</b><span>時間地點一次看</span></div>
        </div>
        <button type="button" data-go="my">查看我的報名</button>
      </div>
    </section>

    <section class="doing-public-section doing-activities-section" id="doingPublicActivities" aria-label="活動快訊輪播">
      <div class="doing-section-title row">
        <div><span class="doing-kicker">活動快訊</span><h2 id="doingActivityLabel">全平台精選活動</h2><p>首頁曝光依租戶購買資格、期間與排序顯示；活動內容永遠讀取正式場次資料。</p></div>
        <span class="doing-ad-label">全租戶曝光版位</span>
      </div>
      <div class="doing-carousel-frame">
        <span class="doing-frame-title">DOING NOW</span>
        <button id="doingActivityPrev" class="doing-carousel-arrow prev" type="button" aria-label="上一個活動">‹</button>
        <div id="doingPublicActivityStage" class="doing-public-carousel" aria-live="polite"><div class="doing-empty-state"><b>正在讀取活動…</b></div></div>
        <button id="doingActivityNext" class="doing-carousel-arrow next" type="button" aria-label="下一個活動">›</button>
        <div class="doing-carousel-footer"><div id="doingActivityDots" class="doing-activity-dots" aria-label="活動頁數"></div><span id="doingActivityCount">1 / 5</span></div>
      </div>
    </section>

    <div id="doingMyMount"></div>

    <section class="doing-public-section doing-organizer-section">
      <div class="doing-organizer-icon">D</div>
      <div><span class="doing-kicker yellow">給主辦／營運者</span><h2>你不只參加，也正在做自己的事？</h2><p>DOING 把報名、會員、付款、預約、通知與現場管理整理在同一套系統。功能依申請問卷核准開通，需要新增功能時可直接向系統客服提出申請。</p></div>
      <div class="doing-organizer-actions"><a href="about.html#apply">申請營運帳號</a><a class="secondary" href="about.html#pricing">查看主辦方案</a></div>
    </section>

    <div id="doingSupportMount"></div>

    <footer class="doing-public-footer">
      <div><b>DOING</b><span>活動營運管理系統</span></div>
      <nav><a href="about.html#about">關於 DOING</a><a href="about.html#pricing">主辦方案</a><a href="about.html#apply">申請營運帳號</a><a href="mailto:Ndiangrace@gmail.com">Email 客服</a></nav>
      <small>兔彼樂共創活動有限公司</small>
    </footer>
  </div>`;
}

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
    my.classList.remove('page');my.classList.add('doing-public-native-panel','doing-my-panel');my.id='doingHomeMy';
    $('doingMyMount')?.replaceWith(my);
  }
  const support=$('pageSupport');
  if(support){
    support.classList.remove('page');support.classList.add('doing-public-native-panel','doing-support-panel');support.id='doingHomeSupport';
    $('doingSupportMount')?.replaceWith(support);
  }
  const oldSingle=$('doingSinglePageSections');if(oldSingle)oldSingle.remove();
  const oldModal=$('globalSearchModal');if(oldModal)oldModal.classList.remove('show');
}

function wireNav(){
  const p=navParts();
  if(p.search)p.search.onclick=()=>smoothTo($('doingPublicSearch'),$('doingPublicSearchInput'));
  if(p.my)p.my.onclick=()=>smoothTo($('doingHomeMy'));
  if(p.support)p.support.onclick=()=>smoothTo($('doingHomeSupport'));
  document.querySelectorAll('[data-go="search"]').forEach(x=>x.onclick=()=>smoothTo($('doingPublicSearch'),$('doingPublicSearchInput')));
  document.querySelectorAll('[data-go="my"]').forEach(x=>x.onclick=()=>smoothTo($('doingHomeMy')));
  document.querySelectorAll('[data-go="support"]').forEach(x=>x.onclick=()=>smoothTo($('doingHomeSupport')));
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
}

function wire(){
  if(!isGlobal)return;
  buildHeader();
  buildPublicApp();
  wireNav();
  wireSearch();
  suppressTenantToast();
  watchActivities();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});
else wire();
})();
