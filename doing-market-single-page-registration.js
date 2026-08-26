(()=>{
'use strict';
const $=id=>document.getElementById(id);
let agreementLoad=0;
function cfg(){try{return typeof moduleCfg==='function'&&state?.session?moduleCfg(state.session):{}}catch(_){return{}}}
function requiredAgreement(){const m=cfg();return !!(m.agreement&&state?.session&&state.session.agreementRequired!==false)}
function installStyle(){
  if($('doing-market-single-page-registration-style'))return;
  const s=document.createElement('style');s.id='doing-market-single-page-registration-style';s.textContent=`
  #sessionModal.single-page-registration .reg-wizard,
  #sessionModal.single-page-registration #regPrevBtn,
  #sessionModal.single-page-registration #regNextBtn{display:none!important}
  #sessionModal.single-page-registration .reg-step-panel:not(.hidden){display:block!important}
  #sessionModal.single-page-registration #submitRegBtn{display:inline-flex!important}
  #sessionModal.single-page-registration .single-page-member-source{display:none!important}
  #sessionModal.single-page-registration .modal-body{padding-top:12px!important}
  #sessionModal.single-page-registration .form-section{display:block}
  #sessionModal.single-page-registration #dateSection{border-top:0!important;padding-top:8px!important}
  #sessionModal.single-page-registration .single-member-summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;margin:0 0 8px;border:1px solid var(--line);border-radius:14px;background:#f7fbfa}
  #sessionModal.single-page-registration .single-member-summary b{font-size:14px}
  #sessionModal.single-page-registration .single-member-summary span{font-size:13px;color:var(--muted)}
  #sessionModal.single-page-registration .single-agreement-box{max-height:190px;overflow:auto;white-space:pre-wrap;padding:12px;margin:8px 0 12px;border:1px solid var(--line);border-radius:14px;background:#fff;line-height:1.65}
  #sessionModal.single-page-registration #readAgreementBtn{display:none!important}
  #sessionModal.single-page-registration #agreementSection>.choice{align-items:flex-start}
  #sessionModal.single-page-registration #agreementCheck{width:22px;height:22px;flex:0 0 22px;margin-top:2px}
  #sessionModal.single-page-registration .modal-foot{grid-template-columns:auto 1fr!important}
  #sessionModal.single-page-registration .modal-foot #submitRegBtn{grid-column:auto!important;width:100%!important}
  @media(max-width:520px){
    #sessionModal.single-page-registration .modal-foot{grid-template-columns:90px 1fr!important}
    #sessionModal.single-page-registration .single-agreement-box{max-height:150px}
  }`;
  document.head.appendChild(s);
}
function syncLoggedInMember(p){
  if(!p)return;
  const set=(id,v)=>{const el=$(id);if(el&&v!=null&&String(v).trim()&&!String(el.value||'').trim())el.value=String(v)};
  set('regEmail',p.email);set('regPhone',p.phone);set('regName',p.name);set('regBrand',p.brand||p.brand_name||p.brandName);
  set('regIntro',p.brandIntro||p.brand_intro);set('regSellCat',p.sellCat||p.sell_category);set('regSellItem',p.sellItem||p.sell_items);
  set('regPhoto',p.photo||p.photo_url);set('regFb',p.fb||p.fb_url);set('regIg',p.ig||p.ig_url);set('invoiceEmail',p.email);
}
function memberSummary(){
  const section=$('regEmail')?.closest('.form-section'),detail=$('dateSection');if(!section||!detail)return;
  const p=window.doingMemberProfile?.(),token=window.doingMemberToken?.();let box=$('singleMemberSummary');
  if(p&&token){
    syncLoggedInMember(p);section.classList.add('single-page-member-source');
    if(!box){box=document.createElement('div');box.id='singleMemberSummary';box.className='single-member-summary';detail.parentElement.insertBefore(box,detail)}
    const brand=$('regBrand')?.value||p.brand||p.brand_name||'';
    box.innerHTML='<b>已登入</b><span>'+[brand,$('regName')?.value||p.name].filter(Boolean).map(x=>String(x)).join('｜')+'</span>';
    box.classList.remove('hidden');
  }else{
    section.classList.remove('single-page-member-source');if(box)box.classList.add('hidden');
  }
}
function enforceEquipment(){
  const sec=$('equipSection'),m=cfg();if(!sec)return;
  if(!m.equipment){sec.classList.add('hidden');return}
  const items=Object.values(state?.session?.equip||{}).filter(x=>x&&x.open!==false);
  sec.classList.toggle('hidden',items.length===0);
}
function gateSubmit(){
  const btn=$('submitRegBtn'),check=$('agreementCheck');if(!btn)return;
  btn.disabled=requiredAgreement()&&(!state?.agreementViewed||!check?.checked);
}
async function inlineAgreement(){
  const sec=$('agreementSection'),check=$('agreementCheck');if(!sec)return;
  let box=$('singleAgreementContent');
  if(!requiredAgreement()){if(box)box.remove();if(check)check.checked=false;gateSubmit();return}
  if(!box){box=document.createElement('div');box.id='singleAgreementContent';box.className='single-agreement-box';const choice=check?.closest('.choice');sec.insertBefore(box,choice||sec.firstChild)}
  const seq=++agreementLoad;box.textContent='正在載入合約內容…';state.agreementViewed=false;if(check)check.checked=false;gateSubmit();
  try{
    if(!state.agreement)state.agreement=await apiGet('getSessionAgreement',{sessionId:state.session.id,lang:typeof lang==='function'?lang():'zh-TW'});
    if(seq!==agreementLoad)return;
    const a=state.agreement||{};box.textContent=[a.title||'報名合約',a.version?'版本：'+a.version:'',a.content||'主辦尚未提供合約內容。'].filter(Boolean).join('\n\n');
    state.agreementViewed=true;gateSubmit();
  }catch(e){if(seq!==agreementLoad)return;box.textContent='合約載入失敗：'+(e?.message||'請稍後再試');state.agreementViewed=false;gateSubmit()}
}
function validateAll(){
  if(!$('sessionModal')?.classList.contains('single-page-registration'))return true;
  const s=state?.session,m=cfg();
  if((s?.dates||[]).length&&![...document.querySelectorAll('[name=regDate]:checked')].length){toast(m.workshopSlots?'請選擇日期／時段':'請選擇報名日期');return false}
  if(requiredAgreement()&&(!$('agreementCheck')?.checked||!state?.agreementViewed)){toast('請勾選同意合約後再送出');return false}
  return true;
}
function activate(){
  const modal=$('sessionModal');if(!modal?.classList.contains('show')||!state?.session)return;
  installStyle();modal.classList.add('single-page-registration');
  document.querySelectorAll('#sessionModal [data-reg-step]').forEach(x=>{if(!x.classList.contains('hidden'))x.classList.add('active')});
  $('regPrevBtn')?.classList.add('hidden');$('regNextBtn')?.classList.add('hidden');$('submitRegBtn')?.classList.remove('hidden');
  memberSummary();enforceEquipment();if(typeof updateSummary==='function')updateSummary();inlineAgreement();gateSubmit();
}
$('agreementCheck')?.addEventListener('change',gateSubmit);
const submitBtn=$('submitRegBtn'),legacySubmit=submitBtn?.onclick;
submitBtn?.addEventListener('click',async e=>{
  if(!$('sessionModal')?.classList.contains('single-page-registration'))return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!validateAll())return;
  const fn=legacySubmit||submitBtn.onclick;
  if(typeof fn!=='function'){toast('送出功能尚未就緒，請重新整理後再試');return}
  await fn.call(submitBtn,e);
},true);
const modal=$('sessionModal');if(modal)new MutationObserver(()=>{if(modal.classList.contains('show'))setTimeout(activate,0)}).observe(modal,{attributes:true,attributeFilter:['class']});
window.addEventListener('pageshow',()=>setTimeout(activate,0));
})();
