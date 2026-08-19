(()=>{
'use strict';
const workVisual={
  '美容／美甲／按摩／SPA':{icon:'💅',title:'預約工作室',items:['預約','顧客','行事曆','服務紀錄']},
  '市集':{icon:'🏪',title:'市集工作區',items:['場次','攤商／出攤','報名','收款','排位／報到']},
  '活動／講座／展演':{icon:'🎟️',title:'活動工作區',items:['活動','報名','名單','通知','報到']},
  '課程／手作／教學':{icon:'🎓',title:'課程工作區',items:['梯次','學員','名額','收款','通知']},
  '導覽／戶外體驗':{icon:'🧭',title:'導覽工作區',items:['梯次','參加者','集合資訊','通知','紀錄']},
  '設計／接案／工程':{icon:'🧩',title:'案件工作區',items:['案件','進度','檔案','收款','紀錄']},
  '商品販售／團購':{icon:'📦',title:'商品工作區',items:['商品','訂單','收款','紀錄']},
  '寄賣／通路':{icon:'🛍️',title:'寄賣／通路工作區',items:['合作通路','商品','銷售','抽成／結算']},
  '空間／設備出租':{icon:'🏠',title:'資源預約工作區',items:['資源','時段','預約','收款']},
  '其他工作／副業':{icon:'＋',title:'自訂工作區',items:['工作紀錄','日曆','收款','檔案']}
};
const commonVisual={
  '工作總日曆':'🗓️',
  '收款與對帳':'💰',
  '通知提醒':'🔔',
  '照片／檔案':'🖼️'
};
const $=s=>document.querySelector(s);
function nextToolsHeading(h){let n=h?.nextElementSibling;while(n&&!n.classList.contains('sa-tools'))n=n.nextElementSibling;return n}
function enhance(){
  const stage=$('#saStage');
  if(!stage)return;
  const title=stage.querySelector('h3');
  if(!title||!title.textContent.includes('我這樣理解你的工作'))return;
  if(stage.dataset.visualSystem==='1')return;
  stage.dataset.visualSystem='1';
  stage.classList.add('sa-visual-result');
  title.textContent='DOING 已經幫你整理好工作系統';
  const summary=stage.querySelector('.sa-summary');
  if(summary){summary.classList.add('sa-visual-summary');const b=summary.querySelector('b');if(b)b.textContent='你的 DOING 系統藍圖'}
  const headings=[...stage.querySelectorAll('h4')];
  const workHeading=headings.find(h=>h.textContent.includes('工作組合'));
  const toolHeading=headings.find(h=>h.textContent.includes('核准後先準備的工具'));
  if(workHeading){workHeading.textContent='你會拿到這些工作空間';workHeading.classList.add('sa-visual-section-title')}
  const workGrid=nextToolsHeading(workHeading);
  if(workGrid){
    workGrid.classList.add('sa-system-spaces');
    [...workGrid.children].forEach(card=>{
      const label=card.querySelector('b')?.textContent.trim()||'';
      const unit=card.querySelector('.sa-muted')?.textContent.trim()||'';
      const v=workVisual[label]||{icon:'▦',title:label||'工作空間',items:['工作紀錄','日曆','收款','檔案']};
      card.className='sa-system-space';
      card.innerHTML=`<div class="sa-space-top"><span class="sa-space-icon" aria-hidden="true">${v.icon}</span><div><b>${v.title}</b><small>${label}</small></div></div><div class="sa-space-screen"><div class="sa-space-screen-head"><span></span><span></span><span></span></div><div class="sa-space-mini-grid">${v.items.map(x=>`<span>${x}</span>`).join('')}</div></div>${unit?`<p>${unit}</p>`:''}`;
    });
  }
  if(toolHeading){toolHeading.textContent='所有工作共用';toolHeading.classList.add('sa-visual-section-title')}
  const toolGrid=nextToolsHeading(toolHeading);
  if(toolGrid){
    toolGrid.classList.add('sa-common-toolbar');
    [...toolGrid.children].forEach(card=>{
      const name=card.querySelector('b')?.textContent.trim()||'';
      if(!commonVisual[name]){card.hidden=true;return}
      card.className='sa-common-tool';
      card.innerHTML=`<span aria-hidden="true">${commonVisual[name]}</span><b>${name}</b>`;
    });
  }
  const confirm=$('#saConfirm');
  if(confirm){confirm.checked=true;const label=confirm.closest('label');if(label){label.hidden=true;label.setAttribute('aria-hidden','true')}}
  const note=[...stage.querySelectorAll('.sa-muted')].find(x=>x.textContent.includes('目前還沒有建立正式申請資料'));
  if(note)note.innerHTML='<b>目前還沒有建立正式申請資料。</b> 按下「開始建立你的 DOING 系統」後，下一步才填姓名、品牌與聯絡資料。';
  const next=$('#saNext');if(next)next.textContent='開始建立你的 DOING 系統';
  const back=$('#saBack');if(back)back.textContent='← 返回調整工作內容';
}
const style=document.createElement('style');
style.id='doingSmartVisualResultStyle';
style.textContent=`
#smartActivationV2 .sa-visual-result{padding:14px!important;background:#fbfdfd!important}
#smartActivationV2 .sa-visual-result>h3{font-size:24px!important;margin-bottom:7px!important}
#smartActivationV2 .sa-visual-summary{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;background:#eef8f5!important;border:1px solid #d4e8e2}
#smartActivationV2 .sa-visual-summary>b{white-space:nowrap}
#smartActivationV2 .sa-visual-section-title{font-size:16px!important;margin:14px 0 7px!important}
#smartActivationV2 .sa-system-spaces{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:9px!important;margin-top:0!important}
#smartActivationV2 .sa-system-space{border:1px solid #dce8e6;background:#fff;border-radius:14px;padding:10px;min-width:0;box-shadow:0 7px 20px rgba(42,78,83,.05)}
#smartActivationV2 .sa-space-top{display:flex;align-items:center;gap:9px}
#smartActivationV2 .sa-space-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:9px;background:#edf7f7;border:1px solid #d8e9e8;font-size:20px;flex:0 0 38px}
#smartActivationV2 .sa-space-top b{display:block;font-size:15px}.sa-space-top small{display:block;color:#728087;font-size:11px;margin-top:1px}
#smartActivationV2 .sa-space-screen{margin-top:8px;padding:7px;border:1px solid #e1eaea;border-radius:9px;background:#f9fcfc}
#smartActivationV2 .sa-space-screen-head{display:flex;gap:3px;margin-bottom:6px}#smartActivationV2 .sa-space-screen-head span{width:14px;height:3px;border-radius:2px;background:#c8dcdd}
#smartActivationV2 .sa-space-mini-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}#smartActivationV2 .sa-space-mini-grid span{padding:5px 6px;border-radius:6px;background:#fff;border:1px solid #e3ebeb;font-size:11px;font-weight:800;color:#40555c;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#smartActivationV2 .sa-system-space>p{font-size:11px;color:#75838a;margin:7px 1px 0}
#smartActivationV2 .sa-common-toolbar{display:flex!important;flex-wrap:wrap;gap:6px!important;margin-top:0!important}
#smartActivationV2 .sa-common-tool{display:flex;align-items:center;gap:6px;padding:7px 9px!important;min-height:34px!important;border:1px solid #dfe8e7;border-radius:8px;background:#fff}
#smartActivationV2 .sa-common-tool>span{font-size:15px}#smartActivationV2 .sa-common-tool>b{font-size:12px!important;white-space:nowrap}
#smartActivationV2 .sa-visual-result .sa-actions{margin-top:13px;padding-top:10px;border-top:1px solid #e4eceb}
#smartActivationV2 .sa-visual-result #saNext{min-height:44px;padding:9px 16px;font-size:15px;background:#3f8898}
#smartActivationV2 .sa-visual-result #saBack{min-height:40px}
@media(max-width:920px){#smartActivationV2 .sa-system-spaces{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:620px){#smartActivationV2 .sa-system-spaces{grid-template-columns:1fr!important}#smartActivationV2 .sa-visual-summary{grid-template-columns:1fr}#smartActivationV2 .sa-common-toolbar{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}#smartActivationV2 .sa-common-tool{justify-content:flex-start}}
`;
document.head.appendChild(style);
const observer=new MutationObserver(()=>enhance());
const start=()=>{const root=document.getElementById('smartActivationV2');if(root)observer.observe(root,{childList:true,subtree:true});enhance()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
