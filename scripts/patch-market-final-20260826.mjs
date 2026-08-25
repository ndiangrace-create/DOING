import fs from 'node:fs';

function patchFile(path, mutate){
  const before=fs.readFileSync(path,'utf8');
  const after=mutate(before);
  if(after===before) console.log(`unchanged ${path}`);
  else {fs.writeFileSync(path,after,'utf8');console.log(`patched ${path}`)}
}
function replaceOnce(src,from,to,label){
  const n=src.split(from).length-1;
  if(n!==1) throw new Error(`${label}: expected 1 occurrence, got ${n}`);
  return src.replace(from,to);
}

patchFile('doing-market-complete-session.js',src=>{
  const from="set('fullPaymentProfile',s.paymentProfileId||s.payment_profile_id||'');";
  const to="const explicitPay=s.paymentProfileId||s.payment_profile_id||'';const fallbackPay=PAYMENTS.find(x=>(x.isDefault===true||x.is_default===true)&&(x.isEnabled!==false&&x.is_enabled!==false))||PAYMENTS.find(x=>x.isEnabled!==false&&x.is_enabled!==false);set('fullPaymentProfile',explicitPay||(fallbackPay&&fallbackPay.id)||'');";
  return src.includes('const fallbackPay=PAYMENTS.find')?src:replaceOnce(src,from,to,'payment-profile-fallback');
});

patchFile('doing-market-public-2bl.js',src=>{
  const from="function enterSession(s){const id=String(s?.id||''),tenant=String(s?._tenant||currentTenant()).trim().toLowerCase();if(!id)return;if(tenant&&!currentTenant()){const u=new URL('/market/public/',location.origin);u.searchParams.set('tenant',tenant);u.searchParams.set('session',id);u.searchParams.set('market_autoreg','1');location.href=u.toString();return}try{openRegistration(id)}catch(_){}}";
  const to=`async function hydrateTenantInline(tenant,id){\n  const st=getState();if(!st)throw new Error('報名介面尚未準備完成');\n  const u=new URL(API);u.searchParams.set('action','frontBootstrap');u.searchParams.set('tenant',tenant);if(id)u.searchParams.set('sessionId',id);\n  const r=await fetch(u,{cache:'no-store'}),raw=await r.json().catch(()=>({}));if(!r.ok||raw?.ok===false||raw?.error)throw new Error(raw?.error||'活動資料載入失敗');\n  const d=raw?.data??raw?.result??raw;st.tenantData=d.tenant||{};st.tenant=String(st.tenantData.id||tenant).trim().toLowerCase();st.events=Array.isArray(d.events)?d.events:[];st.sessions=Array.isArray(d.sessions)?d.sessions:[];st.operationUnits=Array.isArray(d.operationUnits)?d.operationUnits:[];\n  try{setupLanguages()}catch(_){}try{renderTenant()}catch(_){}try{renderEvents()}catch(_){}try{renderSessions()}catch(_){}refreshPortalVisibility();return st;\n}\nasync function enterSession(s){const id=String(s?.id||''),tenant=String(s?._tenant||currentTenant()).trim().toLowerCase();if(!id)return;try{if(tenant&&tenant!==currentTenant())await hydrateTenantInline(tenant,id);await openRegistration(id)}catch(e){showMessage(e?.message||'報名資料載入失敗')}}`;
  return src.includes('async function hydrateTenantInline')?src:replaceOnce(src,from,to,'inline-registration');
});

patchFile('doing-market-current.css',src=>{
  if(src.includes('MARKET_FINAL_2BL_CARD_MODAL_20260826'))return src;
  return src+`\n/* MARKET_FINAL_2BL_CARD_MODAL_20260826 */\n.market-2bl-front #sessionGrid .cover{height:auto!important;aspect-ratio:1/1!important;background:#fff!important}\n.market-2bl-front #sessionGrid .cover img{width:100%!important;height:100%!important;object-fit:contain!important;background:#fff!important}\n.market-2bl-front .modal-bg.show{z-index:500!important;align-items:center!important;justify-content:center!important}\n.market-2bl-front .modal-bg.show~.bottom-nav,.market-2bl-front:has(.modal-bg.show) .bottom-nav{pointer-events:none!important}\n.market-2bl-front .modal{width:min(920px,calc(100vw - 36px))!important;max-height:92vh!important;border-radius:24px!important}\n@media(max-width:760px){.market-2bl-front .modal-bg.show{padding:0!important}.market-2bl-front .modal{width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important}.market-2bl-front #sessionGrid .cover{margin:8px!important}}\n`;
});

patchFile('scripts/e2e-market-current.mjs',src=>{
  let out=src;
  if(!out.includes("paymentProfileId:'P1'")){
    out=replaceOnce(out,"const session={id:'S1',name:'測試市集',dates:[{date:'2026-09-01',label:'2026-09-01'}],venue:'測試場地',fee:500,deposit:500,limit:30,status:'open',desc:'測試說明',modules:","const session={id:'S1',eventId:'E1',name:'測試市集',dates:[{date:'2026-09-01',label:'2026-09-01'}],venue:'測試場地',fee:500,deposit:500,limit:30,status:'open',desc:'測試說明',paymentProfileId:'P1',agreementRequired:true,agreementTitle:'測試合約',agreementContent:'測試合約內容',agreementVersion:'1.0',modules:",'e2e-session-contract');
  }
  if(!out.includes("case'getPaymentProfiles'")){
    out=replaceOnce(out,"  case'getSessionEquipmentDetails':return{rows:[{name:'桌子',quantity:1}]};","  case'getSessionEquipmentDetails':return{rows:[{name:'桌子',quantity:1}]};\n  case'getPaymentProfiles':return[{id:'P1',name:'預設收款',isDefault:true,isEnabled:true}];\n  case'getAgreementTemplates':return[{slot_no:1,label:'預設合約',title:'測試合約',content:'測試合約內容',version:'1.0'}];\n  case'getEventsAdmin':return[{id:'E1',title:'精選主題'}];\n  case'getBundles':return[];",'e2e-catalog-contracts');
  }
  if(!out.includes("inlineModalNoNavigation:true")){
    out=replaceOnce(out,"registrationInline:true,rememberedMemberLogin:true","registrationInline:true,inlineModalNoNavigation:true,rememberedMemberLogin:true",'e2e-result-marker');
  }
  return out;
});
