(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const p=new URL(location.href).searchParams;
const keep=(path)=>{const u=new URL(path,location.origin);for(const k of ['tenant','admin_token','token']){const v=p.get(k);if(v)u.searchParams.set(k,v)}return u.toString()};
if(location.pathname!=='/'&&!/\/doing-2\.html$/.test(location.pathname))return;
document.body.classList.add('d2-home-v11');
const nav=document.querySelector('.d2-product-nav');if(nav)nav.hidden=true;
const top=document.querySelector('.d2-top-actions');if(top){top.innerHTML=`<a href="${keep('/smart-application.html')}">我要申請</a><a href="${keep('/member-panel.html#account')}">登入</a>`}
const main=document.querySelector('main.shell');if(!main)return;
main.className='d2-home-canvas';
main.innerHTML=`
<section class="d2-home-hero" aria-labelledby="d2HomeTitle">
  <div class="d2-home-logo-wrap"><img class="d2-home-logo" src="/doing-logo.png" alt="DOING"></div>
  <div class="d2-home-badge">先做就對了 ✓</div>
  <h1 id="d2HomeTitle" class="d2-home-tagline">協槓人生小幫手</h1>
  <form id="d2HomeSearch" class="d2-home-search" role="search">
    <span class="d2-home-search-icon" aria-hidden="true">⌕</span>
    <input id="d2HomeSearchInput" type="search" autocomplete="off" placeholder="搜尋活動、課程、體驗、地點……" aria-label="搜尋活動、課程、體驗或地點">
    <button type="submit">搜尋</button>
  </form>
</section>
<div class="d2-home-spacer" aria-hidden="true"></div>
<nav class="d2-home-actions" aria-label="主要功能">
  <a class="d2-home-action green" href="${keep('/market/public/')}"><span class="ico" aria-hidden="true">✦</span><span>報名活動</span></a>
  <a class="d2-home-action lavender" href="${keep('/member-panel.html#activities')}"><span class="ico" aria-hidden="true">▣</span><span>我的紀錄</span></a>
  <button class="d2-home-action yellow" id="d2SupportOpen" type="button"><span class="ico" aria-hidden="true">☻</span><span>線上客服</span></button>
</nav>
<div class="d2-home-secondary"><a href="${keep('/smart-application.html')}">我要申請 DOING</a></div>
<div class="d2-support-dialog" id="d2SupportDialog" hidden>
  <div class="d2-support-backdrop" data-close-support></div>
  <section class="d2-support-panel" role="dialog" aria-modal="true" aria-labelledby="d2SupportTitle">
    <div class="d2-support-head"><b id="d2SupportTitle">DOING 線上客服</b><button type="button" data-close-support aria-label="關閉客服">×</button></div>
    <div class="d2-support-messages" id="d2SupportMessages">
      <div class="d2-support-msg">嗨！你可以直接告訴我想完成什麼，或卡在哪個畫面。</div>
      <div class="d2-support-quick">
        <button type="button" data-q="第一次要怎麼報名或預約？">第一次怎麼報名？</button>
        <button type="button" data-q="報名後要去哪裡看進度與紀錄？">在哪看進度？</button>
        <button type="button" data-q="付款、取消、改期或退款要怎麼處理？">付款與異動</button>
        <button type="button" data-q="我卡住了，要怎麼描述問題才能得到協助？">我卡住了</button>
      </div>
    </div>
    <form class="d2-support-form" id="d2SupportForm"><textarea id="d2SupportInput" rows="2" maxlength="500" placeholder="直接說你卡在哪裡…" aria-label="輸入客服問題"></textarea><button type="submit">送出</button></form>
  </section>
</div>`;
const $=id=>document.getElementById(id);
$('d2HomeSearch').addEventListener('submit',e=>{e.preventDefault();const q=$('d2HomeSearchInput').value.trim();const u=new URL('/market/public/',location.origin);if(q)u.searchParams.set('q',q);location.href=u.toString()});
const dlg=$('d2SupportDialog'),open=()=>{dlg.hidden=false;document.body.style.overflow='hidden';setTimeout(()=>$('d2SupportInput')?.focus(),20)},close=()=>{dlg.hidden=true;document.body.style.overflow=''};
$('d2SupportOpen').addEventListener('click',open);dlg.querySelectorAll('[data-close-support]').forEach(x=>x.addEventListener('click',close));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dlg.hidden)close()});
function bubble(text,user=false){const d=document.createElement('div');d.className='d2-support-msg'+(user?' user':'');d.textContent=text;$('d2SupportMessages').appendChild(d);d.scrollIntoView({block:'end'});return d}
function quick(q){const s=q.replace(/\s/g,'');if(/第一次.*報名|怎麼報名|怎麼預約/.test(s))return'先到「報名活動」找到想參加的內容，打開活動頁後依畫面完成報名。報名完成後可以到「我的紀錄」查看進度。';if(/進度|紀錄|我的報名/.test(s))return'請從首頁的「我的紀錄」進入。第一次使用會先用 LINE 驗證，完成後會回到你的紀錄頁。';if(/付款|取消|退款|改期/.test(s))return'先到「我的紀錄」打開該筆報名，依該活動目前提供的付款或異動按鈕操作；如果是活動方決定的退款規則，請以該筆活動顯示的內容為準。';if(/卡住|錯誤|不能|無法/.test(s))return'把「你在哪一頁、按了哪個按鈕、畫面出現什麼提示」告訴我，我會先幫你判斷下一步。';return''}
async function ask(question){const value=String(question||'').trim();if(!value)return;bubble(value,true);const q=quick(value);if(q){bubble(q);return}const waiting=bubble('正在幫你確認…');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{let memberToken='';try{memberToken=localStorage.getItem('doing_member_token')||''}catch(_){}const response=await fetch(API+'?action=analyzeDoingApplication',{method:'POST',headers:{'Content-Type':'application/json;charset=UTF-8'},body:JSON.stringify({action:'analyzeDoingApplication',topic:'question',question:value,useCases:['general'],painPoints:['other'],workSituations:[],member_token:memberToken}),signal:controller.signal});const result=await response.json();if(!response.ok||result.error)throw new Error(result.error||'客服暫時無法回覆');waiting.textContent=String(result.reply||'這題需要進一步確認，我先不猜答案。')}catch(_){waiting.textContent='目前連線比較慢。你可以再送一次，或稍後再試。'}finally{clearTimeout(timer)}}
dlg.querySelectorAll('[data-q]').forEach(x=>x.addEventListener('click',()=>ask(x.dataset.q)));$('d2SupportForm').addEventListener('submit',e=>{e.preventDefault();const input=$('d2SupportInput'),v=input.value;input.value='';ask(v)});$('d2SupportInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('d2SupportForm').requestSubmit()}});
})();
