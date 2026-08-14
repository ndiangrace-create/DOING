(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const API='https://tobeloved-api.ndiangrace.workers.dev';
const url=new URL(location.href);
const isGlobal=!url.searchParams.get('tenant');
let carouselIndex=0,carouselTimer=null,carouselPaused=false,touchY=null,lastRowsKey='';

function navParts(){
  const nav=$('doingGlobalFixedNav');
  if(!nav)return{};
  const links=[...nav.querySelectorAll('a,button')];
  const search=$('globalSearchNavBtn');
  const my=$('globalMyNavBtn');
  const support=$('globalSupportNavBtn');
  const pricing=links.find(x=>/費用|功能/.test((x.textContent||'').trim())||/pricing/.test(x.getAttribute('href')||''));
  const apply=links.find(x=>/營運帳號申請/.test((x.textContent||'').trim())||/apply/.test(x.getAttribute('href')||''));
  return{nav,search,my,support,pricing,apply};
}
function buildHeader(){
  const p=navParts(); if(!p.nav)return;
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
    actions=document.createElement('div'); actions.className='doing-nav-actions';
    p.nav.appendChild(actions);
  }
  [p.apply,p.pricing,p.support,p.search,p.my].filter(Boolean).forEach(x=>{
    x.classList.add('doing-nav-action');
    x.removeAttribute('href');
    x.setAttribute('role','button');
    actions.appendChild(x);
  });
}
function smoothTo(el,focus){
  if(!el)return;
  const header=document.querySelector('.doing-global-fixed-nav');
  const gap=(header?.offsetHeight||82)+16;
  const top=window.scrollY+el.getBoundingClientRect().top-gap;
  window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
  if(focus)setTimeout(()=>focus.focus({preventScroll:true}),420);
}
function suppressTenantToast(){
  if(!isGlobal)return;
  const toast=$('toast'); if(!toast)return;
  const clean=()=>{
    const t=String(toast.textContent||'');
    if(/無法辨識主辦空間|請從主辦提供的活動連結進入|主辦提供的活動連結/.test(t)){
      toast.classList.remove('show');toast.textContent='';toast.style.display='none';
      setTimeout(()=>toast.style.display='',60);
    }
  };
  clean();
  new MutationObserver(clean).observe(toast,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
}
function realRows(){
  let a=[],b=[];
  try{
    a=Array.isArray(state.discoveryItems)?state.discoveryItems:[];
    b=Array.isArray(state.exposureItems)?state.exposureItems:[];
  }catch(e){}
  const seen=new Set(),out=[];
  [...a,...b].forEach(x=>{
    const k=String(x.sessionId||x.id||'');
    if(!k||seen.has(k))return;
    seen.add(k);out.push(x);
  });
  return out;
}
function dateText(rows){
  const a=Array.isArray(rows)?rows:[];
  if(!a.length)return '日期待公告';
  const d=a[0];
  return String((d&&typeof d==='object'?(d.label||d.date):d)||'日期待公告');
}
function itemType(x){
  const s=[x.sessionName,x.eventTitle,x.description,x.type,x.unitType].join(' ').toLowerCase();
  if(/市集|攤/.test(s))return '市集';
  if(/課程|講座|workshop|工作坊/.test(s))return '課程';
  if(/預約|體驗|booking|美甲|美睫|美容/.test(s))return '體驗／預約';
  if(/展演|演出|表演/.test(s))return '展演';
  return '活動';
}
function setCarouselPositions(stage,items){
  if(!stage||!items.length)return;
  stage.querySelectorAll('.doing-activity-card').forEach((el,i)=>{
    let d=i-carouselIndex,n=items.length;
    if(d>n/2)d-=n;if(d<-n/2)d+=n;
    let cls='off';
    if(d===0)cls='pos0'; else if(d===-1)cls='posm1'; else if(d===1)cls='pos1';
    else if(d===-2)cls='posm2'; else if(d===2)cls='pos2';
    el.className='doing-activity-card '+cls;
  });
}
function openActivity(x){
  if(!x?.tenantId||!x?.sessionId)return;
  location.href=`?tenant=${encodeURIComponent(x.tenantId)}&session=${encodeURIComponent(x.sessionId)}`;
}
function renderActivities(items,q=''){
  const stage=$('doingPublicActivityStage'); if(!stage)return;
  clearInterval(carouselTimer);
  const rows=Array.isArray(items)?items:[];
  if(!rows.length){
    stage.innerHTML=`<div class="doing-empty-state"><span>✦</span><b>${q?'找不到符合的活動':'活動快訊準備中'}</b><p>${q?'換個關鍵字試試看。':'公開活動上線後會直接出現在這裡。'}</p></div>`;
    return;
  }
  stage.innerHTML=rows.map((x,i)=>`
    <article class="doing-activity-card off" data-i="${i}" tabindex="0" role="link" aria-label="${esc(x.sessionName||x.eventTitle||'活動')}">
      <div class="doing-card-cover">${x.cover?`<img src="${esc(x.cover)}" alt="">`:'<span class="doing-card-letter">D</span>'}</div>
      <div class="doing-card-copy">
        <div class="doing-card-top"><span class="doing-type">${esc(itemType(x))}</span><span class="doing-brand">${esc(x.tenantName||'DOING')}</span></div>
        <h3>${esc(x.sessionName||x.eventTitle||'活動')}</h3>
        <p>${esc(dateText(x.dates))}${x.venue?' · '+esc(x.venue):''}</p>
        <span class="doing-card-cta">查看活動 →</span>
      </div>
    </article>`).join('');
  [...stage.querySelectorAll('.doing-activity-card')].forEach(el=>{
    const go=()=>openActivity(rows[Number(el.dataset.i)]);
    el.onclick=go; el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}};
  });
  carouselIndex=0;setCarouselPositions(stage,rows);
  if(rows.length>=3)carouselTimer=setInterval(()=>{if(!carouselPaused){carouselIndex=(carouselIndex+1)%rows.length;setCarouselPositions(stage,rows)}},4500);
  stage.onmouseenter=()=>carouselPaused=true;
  stage.onmouseleave=()=>carouselPaused=false;
  stage.ontouchstart=e=>{carouselPaused=true;touchY=e.touches[0]?.clientY??null};
  stage.ontouchend=e=>{
    const y=e.changedTouches[0]?.clientY??null;
    if(touchY!=null&&y!=null&&Math.abs(y-touchY)>26){
      carouselIndex=(carouselIndex+(y<touchY?1:-1)+rows.length)%rows.length;
      setCarouselPositions(stage,rows);
    }
    touchY=null;setTimeout(()=>carouselPaused=false,850);
  };
  stage.onwheel=e=>{
    e.preventDefault();
    carouselIndex=(carouselIndex+(e.deltaY>0?1:-1)+rows.length)%rows.length;
    setCarouselPositions(stage,rows);
  };
}
function searchActivities(){
  const input=$('doingPublicSearchInput'); if(!input)return;
  const raw=String(input.value||'').trim(),q=raw.toLowerCase(),rows=realRows();
  const hit=!q?rows:rows.filter(x=>[
    x.sessionName,x.eventTitle,x.tenantName,x.venue,x.description,itemType(x)
  ].join(' ').toLowerCase().includes(q));
  const label=$('doingActivityLabel');
  if(label)label.textContent=q?`搜尋「${raw}」`:'最近可以參加';
  renderActivities(hit.slice(0,30),raw);
  smoothTo($('doingPublicActivities'));
}
function watchActivities(){
  let tries=0;
  const tick=()=>{
    tries++;
    const rows=realRows();
    const key=rows.map(x=>x.sessionId||x.id).join('|');
    if(rows.length&&key!==lastRowsKey){
      lastRowsKey=key;
      renderActivities(rows.slice(0,30));
      const label=$('doingActivityLabel');if(label)label.textContent='最近可以參加';
    }
    if(tries<40)setTimeout(tick,500);
  };
  tick();
}
function regionOptions(){
  return ['台北市','新北市','桃園市','新竹市／新竹縣','苗栗縣','台中市','彰化縣','南投縣','雲林縣','嘉義市／嘉義縣','台南市','高雄市','屏東縣','宜蘭縣','花蓮縣','台東縣','離島／其他']
  .map(x=>`<option>${x}</option>`).join('');
}
function useCase(label,value,desc){
  return `<label class="doing-check"><input type="checkbox" value="${value}"><span><b>${label}</b><small>${desc}</small></span></label>`;
}
function need(label,key){
  return `<label class="doing-need"><input type="checkbox" data-module="${key}"><span>${label}</span></label>`;
}
function publicAppHTML(){
  return `
  <div id="doingPublicApp" class="doing-public-app">
    <section class="doing-public-hero" id="doingPublicHero">
      <div class="doing-hero-orb orb-a"></div><div class="doing-hero-orb orb-b"></div><div class="doing-hero-orb orb-c"></div>
      <div class="doing-hero-copy">
        <span class="doing-eyebrow">活動・課程・體驗・預約，都從這裡開始</span>
        <h1><span>DOING</span><small>先做就對了！</small></h1>
        <p>把週末，安排成喜歡的樣子。逛市集、看展演、上課、做體驗，或替自己預約一段喜歡的時間。</p>
        <div class="doing-hero-actions">
          <button type="button" data-go="search">找活動</button>
          <button type="button" class="secondary" data-go="my">我的報名</button>
        </div>
      </div>
      <div class="doing-hero-art" aria-hidden="true">
        <div class="doing-big-d">D</div>
        <div class="doing-mini-scene"><span>✦</span><b>市集</b><b>課程</b><b>體驗</b><b>預約</b></div>
        <div class="doing-gift">▣</div>
      </div>
    </section>

    <section class="doing-public-section doing-search-section" id="doingPublicSearch">
      <div class="doing-section-title">
        <span class="doing-kicker mint">今天想去哪裡？</span>
        <h2>找活動，很簡單。</h2>
        <p>輸入活動名稱、品牌、地點或類型，直接看可以參加的內容。</p>
      </div>
      <div class="doing-search-box">
        <span class="doing-search-icon"></span>
        <input id="doingPublicSearchInput" type="search" aria-label="搜尋活動、課程、體驗或地點" autocomplete="off">
        <button id="doingPublicSearchGo" type="button">搜尋</button>
      </div>
      <div class="doing-quick-tags">
        <button type="button" data-q="市集">市集</button><button type="button" data-q="課程">課程</button>
        <button type="button" data-q="體驗">體驗</button><button type="button" data-q="預約">預約</button><button type="button" data-q="高雄">高雄</button>
      </div>
    </section>

    <section class="doing-public-section doing-activities-section" id="doingPublicActivities">
      <div class="doing-section-title row">
        <div><span class="doing-kicker yellow">活動快訊</span><h2 id="doingActivityLabel">最近可以參加</h2></div>
        <p>上下滑一下，看看最近有什麼。</p>
      </div>
      <div id="doingPublicActivityStage" class="doing-public-carousel"><div class="doing-empty-state"><span>✦</span><b>活動快訊載入中…</b></div></div>
    </section>

    <div id="doingMyMount"></div>

    <section class="doing-public-section doing-pricing-section" id="doingPublicPricing">
      <div class="doing-section-title">
        <span class="doing-kicker blue">費用／功能</span>
        <h2>先設定好，確定要開放時再啟用。</h2>
        <p>這一區是給主辦、品牌、工作室與服務提供者看的；一般參加者不用付平台費。</p>
      </div>
      <div class="doing-price-cards">
        <article><span>單次活動／場次</span><strong>NT$200</strong><p>市集、講座、展演、單次工作坊，每個可獨立報名的場次啟用一次。</p></article>
        <article><span>持續接預約</span><strong>NT$888<small>／月</small></strong><p>工作室、美業、導覽、場地或固定時段服務。</p></article>
      </div>
      <div class="doing-simple-rule"><b>延期：</b>沿用原啟用資格。 <b>主辦自行取消：</b>已啟用的平台服務費不退。</div>
    </section>

    <section class="doing-public-section doing-apply-section" id="doingPublicApply">
      <div class="doing-section-title">
        <span class="doing-kicker purple">營運帳號申請</span>
        <h2>你正在做自己的事？</h2>
        <p>如果你是品牌、工作室、活動單位、老師或服務提供者，可以申請 DOING 營運帳號。</p>
      </div>
      <div id="doingApplicationBanner" class="doing-application-banner hidden"></div>
      <form id="doingPublicApplyForm" class="doing-apply-card" onsubmit="return false">
        <div class="doing-form-block">
          <h3>基本資料</h3>
          <div class="doing-form-grid">
            <label><span>營運單位名稱＊</span><input id="signupUnitName"></label>
            <label><span>公司／商號名稱</span><input id="signupCompanyName"></label>
            <label><span>統一編號</span><input id="signupTaxId" inputmode="numeric"></label>
            <label><span>所在地區＊</span><select id="signupRegion"><option value="">請選擇</option>${regionOptions()}</select></label>
            <label class="full"><span>主要營運內容＊</span><textarea id="signupBusinessIntro"></textarea></label>
          </div>
        </div>
        <div class="doing-form-block">
          <h3>誰負責這個帳號？</h3>
          <div class="doing-form-grid">
            <label><span>負責人姓名＊</span><input id="signupOwnerName"></label>
            <label><span>主要聯絡人＊</span><input id="signupContactName"></label>
            <label><span>聯絡電話＊</span><input id="signupPhone" inputmode="tel"></label>
            <label><span>帳務聯絡人</span><input id="signupBillingName"></label>
          </div>
        </div>
        <div class="doing-form-block">
          <h3>你最需要哪些功能？</h3>
          <p class="doing-form-help">可以複選。先告訴我們你在做什麼，再勾選最需要改善的地方。</p>
          <div id="signupUseCases" class="doing-check-grid">
            ${useCase('市集／攤商招募','market','招募、審核、設備、攤位與現場管理')}
            ${useCase('活動／講座／課程','event','名額、付款、通知與報到')}
            ${useCase('手作體驗／工作坊','workshop','日期、時段、材料與人數')}
            ${useCase('美業／工作室預約','beauty','依服務與時段安排預約')}
            ${useCase('一般服務預約','service_booking','一對一或小型服務預約')}
            ${useCase('場地／資源預約','resource_booking','場地、器材、人員或資源')}
            ${useCase('導覽／戶外體驗','guide','導覽、戶外與天候改期')}
            ${useCase('其他通用報名','general','複合型營運也可以')}
          </div>
          <label class="doing-long-answer"><span>你現在最想改善什麼？＊</span><textarea id="signupUsagePlan" placeholder="例如：報名資料很散、付款難核對、一直重複回覆、預約時段很難管。"></textarea></label>
          <div id="signupNeeds" class="doing-needs-grid">
            ${need('報名審核','review')}${need('收款／付款確認','payment')}${need('訂金／保證金','deposit')}
            ${need('日期／時段預約','workshopSlots')}${need('服務／方案','service')}${need('人員／場地／資源','resource')}
            ${need('座位／攤位選位','seatSelection')}${need('設備／租借','equipment')}${need('加購項目','addons')}
            ${need('自訂問題','customFields')}${need('條款／合約','agreement')}${need('現場報到','checkin')}
            ${need('發票資料','invoice')}${need('營運總日曆','calendar')}${need('自動通知','notifications')}${need('早鳥／回饋優惠','rewards')}
          </div>
        </div>
        <div class="doing-form-block">
          <h3>目前進度</h3>
          <div class="doing-form-grid">
            <label><span>目前營運狀態＊</span><select id="signupOperationStage"><option value="">請選擇</option><option value="operating">已經開始營運</option><option value="preparing">正在籌備中</option></select></label>
            <label><span>預計開始使用</span><input id="signupStartTime" placeholder="例如：下個月／近期第一場活動前"></label>
            <label><span>公開連結 1</span><input id="signupLink1" placeholder="Facebook／Instagram／官網"></label>
            <label><span>公開連結 2</span><input id="signupLink2"></label>
          </div>
          <label class="doing-confirm"><input id="signupNoPublicLink" type="checkbox"><span>目前還沒有公開頁面</span></label>
          <div class="doing-confirm-list">
            <label class="doing-confirm"><input id="confirmReal" type="checkbox"><span>以上資料為真實營運資訊。</span></label>
            <label class="doing-confirm"><input id="confirmUse" type="checkbox"><span>申請通過後，我會依實際營運需求使用 DOING。</span></label>
            <label class="doing-confirm"><input id="confirmReview" type="checkbox"><span>我了解申請需要審核，資料不足時可能需要補件。</span></label>
          </div>
          <button id="signupGoogleBtn" class="doing-google-submit" type="button">使用 Google 驗證並送出申請</button>
          <div id="signupErr" class="doing-form-error"></div>
        </div>
      </form>
    </section>

    <div id="doingSupportMount"></div>

    <footer class="doing-public-footer">
      <b>DOING｜活動營運管理系統</b>
      <span>兔彼樂共創活動有限公司</span>
      <a href="mailto:Ndiangrace@gmail.com">Email 客服</a>
    </footer>
  </div>`;
}
function buildPublicApp(){
  if(!isGlobal)return;
  document.documentElement.classList.add('doing-public-refactor');
  document.body.classList.add('doing-global-mode','doing-public-refactor-body');
  const sessions=$('pageSessions'); if(!sessions)return;
  let app=$('doingPublicApp');
  if(!app){
    const host=document.createElement('div');host.innerHTML=publicAppHTML();
    app=host.firstElementChild;
    sessions.prepend(app);
  }
  const oldArt=$('doingGlobalArtHome');if(oldArt)oldArt.classList.add('doing-legacy-public-hidden');
  const my=$('pageMy');
  if(my){
    my.classList.remove('page');my.classList.add('doing-public-native-panel');my.id='doingHomeMy';
    $('doingMyMount')?.replaceWith(my);
  }
  const support=$('pageSupport');
  if(support){
    support.classList.remove('page');support.classList.add('doing-public-native-panel');support.id='doingHomeSupport';
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
  if(p.pricing)p.pricing.onclick=e=>{e.preventDefault();smoothTo($('doingPublicPricing'))};
  if(p.apply)p.apply.onclick=e=>{e.preventDefault();smoothTo($('doingPublicApply'))};
  document.querySelectorAll('[data-go="search"]').forEach(x=>x.onclick=()=>smoothTo($('doingPublicSearch'),$('doingPublicSearchInput')));
  document.querySelectorAll('[data-go="my"]').forEach(x=>x.onclick=()=>smoothTo($('doingHomeMy')));
}
function wireSearch(){
  const input=$('doingPublicSearchInput'),go=$('doingPublicSearchGo');
  if(input)input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();searchActivities()}};
  if(go)go.onclick=searchActivities;
  document.querySelectorAll('.doing-quick-tags [data-q]').forEach(btn=>btn.onclick=()=>{
    if(input)input.value=btn.dataset.q||''; searchActivities();
  });
}
function showApplyError(msg){
  const e=$('signupErr');if(!e)return;
  e.textContent=msg;e.classList.add('show');smoothTo($('doingPublicApply'));
}
function clearApplyError(){const e=$('signupErr');if(e){e.textContent='';e.classList.remove('show')}}
function wireApplication(){
  const btn=$('signupGoogleBtn');if(!btn)return;
  btn.onclick=()=>{
    const val=id=>String($(id)?.value||'').trim();
    const unitName=val('signupUnitName'),companyName=val('signupCompanyName'),taxId=val('signupTaxId'),region=val('signupRegion');
    const businessIntro=val('signupBusinessIntro'),ownerName=val('signupOwnerName'),contactName=val('signupContactName'),phone=val('signupPhone');
    const billingName=val('signupBillingName'),usagePlan=val('signupUsagePlan'),operationStage=val('signupOperationStage'),startTime=val('signupStartTime');
    const link1=val('signupLink1'),link2=val('signupLink2'),noPublicLink=!!$('signupNoPublicLink')?.checked;
    const confirmReal=!!$('confirmReal')?.checked,confirmUse=!!$('confirmUse')?.checked,confirmReview=!!$('confirmReview')?.checked;
    const useCases=[...document.querySelectorAll('#signupUseCases input:checked')].map(x=>x.value);
    if(!unitName)return showApplyError('請先填寫營運單位名稱');
    if(!region)return showApplyError('請先選擇所在地區');
    if(!businessIntro)return showApplyError('請先填寫主要營運內容');
    if(!ownerName)return showApplyError('請先填寫負責人姓名');
    if(!contactName)return showApplyError('請先填寫主要聯絡人');
    if(!phone)return showApplyError('請先填寫聯絡電話');
    if(!useCases.length)return showApplyError('請至少選擇一個你目前的營運情境');
    if(!usagePlan)return showApplyError('請告訴我們你現在最想改善的問題');
    if(!operationStage)return showApplyError('請先選擇目前營運狀態');
    if(!link1&&!link2&&!noPublicLink)return showApplyError('請提供一個公開連結，或勾選「目前還沒有公開頁面」');
    if(!confirmReal||!confirmUse||!confirmReview)return showApplyError('請先完成送出前確認');
    clearApplyError();
    const flags={};document.querySelectorAll('#signupNeeds input[data-module]').forEach(x=>flags[x.dataset.module]=!!x.checked);
    const bookingUse=useCases.some(x=>['workshop','beauty','service_booking','resource_booking','guide'].includes(x));
    const marketUse=useCases.includes('market');
    const defaults={
      registration:true,review:!!flags.review,workshopSlots:bookingUse||!!flags.workshopSlots,
      service:useCases.some(x=>['beauty','service_booking','workshop'].includes(x))||!!flags.service,
      resource:useCases.some(x=>['beauty','resource_booking','guide'].includes(x))||!!flags.resource,
      participants:false,customFields:!!flags.customFields,equipment:marketUse||!!flags.equipment,
      seatSelection:marketUse&&!!flags.seatSelection,addons:!!flags.addons,agreement:!!flags.agreement,
      invoice:!!flags.invoice,payment:!!flags.payment,checkin:marketUse||!!flags.checkin,
      googleCalendar:!!flags.calendar||bookingUse,quantityMode:marketUse?'stall':(bookingUse?'booking':'participant'),
      depositKind:flags.deposit?(bookingUse?'booking':'refundable'):'none',operatingMode:bookingUse?'booking':'activity',
      notifications:!!flags.notifications,rewards:!!flags.rewards,i18n:{enabled:false,languages:['zh-TW'],translations:{}}
    };
    const moduleProfile={configured:true,useType:bookingUse?'booking':(marketUse?'market':'activity'),useCases,defaults};
    const labelMap={market:'市集／攤商招募',event:'活動／講座／課程報名',workshop:'手作體驗／工作坊',beauty:'美業／工作室預約',service_booking:'一般服務預約',resource_booking:'場地／資源預約',guide:'導覽／戶外體驗',general:'其他通用報名'};
    const applicationPayload={unitName,companyName,taxId,region,businessIntro,ownerName,contactName,phone,billingName,usagePlan,operationStage,startTime,
      publicLinks:[link1,link2].filter(Boolean),noPublicLink,useCases,useCaseLabels:useCases.map(x=>labelMap[x]||x),
      needFlags:flags,moduleProfile,confirmations:{confirmReal,confirmUse,confirmReview}};
    const u=new URL(API+'/auth/google/start');
    u.searchParams.set('mode','organizer_signup');u.searchParams.set('brand_name',unitName);u.searchParams.set('contact_name',contactName);
    u.searchParams.set('contact_phone',phone);u.searchParams.set('event_type',useCases.join(','));
    u.searchParams.set('module_profile',JSON.stringify(moduleProfile));u.searchParams.set('application_payload',JSON.stringify(applicationPayload));
    location.href=u.toString();
  };
  const status=url.searchParams.get('application_status')||'';
  if(status){
    const b=$('doingApplicationBanner');if(b){b.classList.remove('hidden');b.textContent=status==='supplement_submitted'?'補件已重新送出，DOING 會再進行審核。':'申請已送出，DOING 審核後會通知你。'}
    smoothTo($('doingPublicApply'));
  }
  const oauthErr=url.searchParams.get('login_error')||'';
  if(oauthErr){
    const map={signup_missing_profile:'申請資料不完整，請重新填寫。',signup_failed:'營運帳號申請建立失敗，請重新操作。',google_cancelled:'Google 驗證已取消。',id_token_verify_failed:'Google 身分驗證失敗，請重新操作。',token_exchange_failed:'Google 登入流程失敗，請稍後再試。',invalid_or_expired_state:'申請驗證已逾時，請重新填寫並驗證。'};
    showApplyError(map[oauthErr]||'申請流程失敗，請重新操作。');
  }
}
function wire(){
  if(!isGlobal)return;
  buildHeader();buildPublicApp();wireNav();wireSearch();wireApplication();suppressTenantToast();watchActivities();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();