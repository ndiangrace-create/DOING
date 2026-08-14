(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  document.body.classList.add('doing-about-refresh');
  document.title='DOING｜功能、費用與營運帳號申請';

  const params=new URL(location.href).searchParams;
  if(params.get('embed')==='1'){
    document.body.classList.add('doing-about-embed');
    const keep=$('#apply');
    $$('body > header, main > section, .quick-nav, .footer').forEach(el=>{if(el!==keep&&!el.contains(keep))el.style.display='none'});
    if(keep){keep.style.display='block';keep.style.paddingTop='12px';}
  }

  const hero=$('#about .hero-main');
  if(hero){
    const eyebrow=hero.querySelector('.eyebrow'); if(eyebrow)eyebrow.textContent='給正在辦活動、開課、做體驗或接預約的人';
    const h1=hero.querySelector('h1'); if(h1)h1.textContent='把報名、預約、付款、名單和現場工作，放在同一個地方。';
    const lead=hero.querySelector('.lead'); if(lead)lead.textContent='DOING 是一套活動與預約營運工具。你先把內容設定好，需要正式對外開放時再啟用；參加者則直接找活動、報名、預約，不需要申請營運帳號。';
    const actions=hero.querySelectorAll('.hero-actions a');
    if(actions[0]){actions[0].textContent='先去找活動';actions[0].href='index.html';}
    if(actions[1])actions[1].textContent='我是營運者，想了解怎麼用';
    const pts=hero.querySelectorAll('.point');
    if(pts[0])pts[0].innerHTML='<b>不用一直開新表單</b><span>活動、課程、體驗和預約都在同一套系統管理。</span>';
    if(pts[1])pts[1].innerHTML='<b>資料會跟著流程走</b><span>報名、付款、會員、通知與現場紀錄不用手動拼來拼去。</span>';
    if(pts[2])pts[2].innerHTML='<b>參加者直接使用</b><span>找活動、報名、預約、查自己的紀錄，都從公開入口完成。</span>';
  }

  const topLinks=$$('.top-actions a');
  if(topLinks[0])topLinks[0].textContent='找活動';
  if(topLinks[1])topLinks[1].textContent='我的報名';
  if(topLinks[2])topLinks[2].textContent='我是營運者';

  const q=$$('.quick-nav a');
  const qText=['DOING 是什麼','怎麼開始','可以做什麼','適合哪些營運','費用','申請營運帳號','客服'];
  q.forEach((x,i)=>{if(qText[i])x.textContent=qText[i]});

  const workflow=$('#workflow .section-head');
  if(workflow){const h=workflow.querySelector('h2'),p=workflow.querySelector('p');if(h)h.textContent='要開始很簡單';if(p)p.textContent='申請營運帳號通過後，建立活動或預約內容，確認沒問題，再正式對外開放。';}

  const pricing=$('#pricing');
  if(pricing){
    const sh=pricing.querySelector('.section-head');
    if(sh){const h=sh.querySelector('h2'),p=sh.querySelector('p');if(h)h.textContent='費用怎麼算？';if(p)p.textContent='先設定不用付費；真正要讓外面的人開始報名或預約時，再選擇適合的開通方式。';}
    if(!pricing.querySelector('.doing-audience-note')){
      const note=document.createElement('div');note.className='doing-audience-note';note.innerHTML='<b>一般參加者不用申請帳號。</b><span>下面的費用只跟主辦、品牌、工作室或服務提供者有關。</span>';sh?.after(note);
    }
    const cards=pricing.querySelectorAll('.price-card');
    if(cards[0]){const h=cards[0].querySelector('h3'),p=cards[0].querySelector('p');if(h)h.textContent='單次活動／場次';if(p)p.textContent='適合市集、講座、展演、單次工作坊。每個可以獨立報名的場次，開通一次 NT$200。';}
    if(cards[1]){const h=cards[1].querySelector('h3'),p=cards[1].querySelector('p');if(h)h.textContent='持續接預約';if(p)p.textContent='適合工作室、美業、導覽、場地或固定時段服務。啟用後 NT$888／月。';}
    const nb=pricing.querySelector('.notebox');if(nb)nb.innerHTML='<b>先設定，確定要開放再啟用。</b><br>活動延期可以沿用原本的啟用資格；如果主辦自己取消，已啟用的平台服務費不退。';
  }

  const apply=$('#apply');
  if(apply){
    const side=apply.querySelector('.side-panel');
    if(side){const h=side.querySelector('h3'),p=side.querySelector('p'),lis=side.querySelectorAll('li'),mini=side.querySelector('.mini');if(h)h.textContent='你是營運者，才需要申請';if(p)p.textContent='如果你是主辦、品牌、工作室、老師、服務提供者，想用 DOING 管理自己的活動或預約，再從這裡申請營運帳號。';if(lis[0])lis[0].textContent='填基本資料，讓我們知道你是誰、在經營什麼。';if(lis[1])lis[1].textContent='審核通過後，就會開啟你的營運帳號。';if(lis[2])lis[2].textContent='資料不夠時會請你補充，不需要重新申請。';if(mini)mini.textContent='只是來找活動、報名或預約的人，不需要填這份申請。';}
    const fh=apply.querySelector('.form-head');if(fh){const h=fh.querySelector('h2'),p=fh.querySelector('p');if(h)h.textContent='申請 DOING 營運帳號';if(p)p.textContent='填完送出即可。審核通過後才能進入營運工作台。';}
  }
})();
