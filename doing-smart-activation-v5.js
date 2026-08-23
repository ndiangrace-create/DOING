(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev',form=document.getElementById('signupForm');if(!form)return;
const P={
 market:{n:'市集／活動／體驗',d:'市集、一般活動、體驗活動或 DIY',t:[['market','市集'],['event','一般活動'],['experience','體驗活動／DIY']],m:['場次管理','報名審核','付款確認','排位設備','通知與行前','現場報到／QR','會員／品牌','結案'],u:['market','event','workshop'],i:['market_retail','event_exhibition']},
 project:{n:'室內設計／工程',d:'室內設計與工程專案管理',t:[['interior','室內設計'],['construction','工程專案']],m:['客戶','案件','現勘','報價','設計','圖面','選材','工程','工班','進度','追加減','驗收','收款','結案'],u:['general'],i:['professional_service']},
 booking:{n:'美類／服務預約',d:'美類或一般服務預約',t:[['beauty','美類預約'],['service','一般服務預約']],m:['服務項目','服務人員／資源','預約日曆','每週開放','臨時加開／休息','可預約時段','顧客／通知','收款／訂金'],u:['beauty','service_booking'],i:['beauty_wellness']},
 guide:{n:'導覽預約',d:'導覽員與導覽預約',t:[['guide','導覽預約']],m:['導覽方案','導覽員','梯次／時段','名額','報名名單','通知','收款','行前資訊'],u:['guide'],i:['tour_outdoor']}
};
const shared=['工作總日曆','收款與對帳','通知提醒','照片／檔案'];
const S={p:new Set(),sub:{}};
const $=x=>document.getElementById(x),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const err=m=>{const box=$('er');box.textContent=m;box.style.display='block';box.scrollIntoView({behavior:'smooth',block:'nearest'})},clear=()=>{$('er').style.display='none';$('er').textContent=''};
const mods=()=>{const o=new Set(shared);[...S.p].forEach(k=>P[k].m.forEach(x=>o.add(x)));return[...o]};
const compat=()=>{const u=new Set(),i=new Set();[...S.p].forEach(k=>{P[k].u.forEach(x=>u.add(x));P[k].i.forEach(x=>i.add(x))});return{useCases:[...u],industryCategories:[...i]}};

form.innerHTML=`<div id="d2a"><style>
#d2a{display:grid;gap:12px;color:#24343a}.c{background:#fff;border:1px solid #dce8e9;border-radius:14px;padding:14px}.intro{background:#eef7f8}.intro h2{margin:2px 0 5px;font-size:23px}.intro p,.hint{margin:0;color:#687680;line-height:1.55;font-size:15px}.section-title{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-bottom:8px}.section-title h3{margin:0;font-size:18px}.section-title small{color:#7b878c}.products{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.prod{min-height:58px;border:1px solid #dce8e9;border-radius:9px;background:#fff;padding:9px 10px;text-align:left;cursor:pointer}.prod.on{background:#eef8f6;border-color:#8fc2b8;box-shadow:inset 0 0 0 1px #8fc2b8}.prod b{display:block;font-size:15px}.prod small{display:block;margin-top:2px;color:#748087;font-size:12px;line-height:1.35}.subgroups{display:grid;gap:8px}.subrow{display:grid;grid-template-columns:160px 1fr;gap:10px;align-items:start;padding-top:2px}.subname{font-weight:900;font-size:14px;padding-top:7px}.subs{display:flex;gap:7px;flex-wrap:wrap}.sub{display:inline-flex;gap:6px;align-items:center;min-height:36px;border:1px solid #dce8e9;border-radius:8px;background:#fff;padding:6px 9px;font-size:14px}.sub input{width:17px;height:17px}.fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.field{display:grid;gap:5px}.field label{font-weight:850;font-size:14px}.field input,.field select{min-height:42px;border:1px solid #d6e2e3;border-radius:8px;padding:8px 10px;font:inherit;font-size:15px;background:#fff}.full{grid-column:1/-1}.submit-row{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:2px}.submit-note{margin-right:auto;color:#6f7b80;font-size:13px}.b{min-height:42px;border:0;border-radius:8px;padding:8px 16px;font-size:15px;font-weight:900;cursor:pointer}.pri{background:#4f8f9d;color:#fff;min-width:190px}.pri:disabled{opacity:.55;cursor:not-allowed}.err{display:none;padding:10px 12px;border-radius:9px;background:#fff0ee;color:#9b3f38;font-size:15px}
@media(max-width:850px){.products{grid-template-columns:repeat(2,minmax(0,1fr))}.fields{grid-template-columns:repeat(2,minmax(0,1fr))}.subrow{grid-template-columns:1fr}}
@media(max-width:560px){#d2a{gap:9px}.c{padding:11px}.intro h2{font-size:20px}.products{grid-template-columns:1fr 1fr;gap:7px}.prod{min-height:52px;padding:8px}.prod b{font-size:14px}.prod small{display:none}.fields{grid-template-columns:1fr}.subrow{gap:5px}.submit-row{justify-content:flex-start;flex-wrap:wrap}.submit-note{width:100%;margin:0}.pri{min-width:0;width:auto}}
</style>
<section class="c intro"><small>申請 DOING</small><h2>一頁填完，LINE 驗證後直接開通</h2><p>選擇要管理的工作、填基本資料，再完成一次 LINE 驗證即可。</p></section>
<section class="c"><div class="section-title"><h3>1. 你要管理哪一種工作？</h3><small>可複選</small></div><div class="products" id="products"></div><div class="subgroups" id="subgroups" style="margin-top:10px"></div></section>
<section class="c"><div class="section-title"><h3>2. 基本資料</h3><small>* 必填</small></div><div class="fields">
<div class="field"><label>營運單位／品牌／工作室 *</label><input id="unit" autocomplete="organization"></div>
<div class="field"><label>姓名 *</label><input id="owner" autocomplete="name"></div>
<div class="field"><label>聯絡電話 *</label><input id="phone" inputmode="tel" autocomplete="tel"></div>
<div class="field"><label>Email *</label><input id="email" type="email" autocomplete="email"></div>
<div class="field"><label>所在地區 *</label><select id="region"><option value="">請選擇</option>${['台北市','新北市','桃園市','新竹市／新竹縣','苗栗縣','台中市','彰化縣','南投縣','雲林縣','嘉義市／嘉義縣','台南市','高雄市','屏東縣','宜蘭縣','花蓮縣','台東縣','離島／其他'].map(x=>`<option>${x}</option>`).join('')}</select></div>
<div class="field"><label>品牌／社群／官網 *</label><input id="link1" placeholder="至少一個公開網址" inputmode="url"></div>
<div class="field full"><label>第二個網址（選填）</label><input id="link2" placeholder="可留空" inputmode="url"></div>
</div></section>
<div class="err" id="er"></div>
<section class="c"><div class="submit-row"><span class="submit-note">送出後會用 LINE 驗證本人；符合規則即自動開通，不需等待人工審核。</span><button class="b pri" id="submitApplication" type="submit">LINE 驗證並開通</button></div></section>
</div>`;

function renderProducts(){
  $('products').innerHTML=Object.entries(P).map(([k,v])=>`<button type="button" class="prod ${S.p.has(k)?'on':''}" data-p="${k}" aria-pressed="${S.p.has(k)}"><b>${v.n}</b><small>${v.d}</small></button>`).join('');
  $('products').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{const k=b.dataset.p;if(S.p.has(k)){S.p.delete(k);delete S.sub[k]}else S.p.add(k);renderProducts();renderSubtypes();clear()});
}
function renderSubtypes(){
  if(!S.p.size){$('subgroups').innerHTML='<p class="hint">先選上面的工作類型。</p>';return}
  $('subgroups').innerHTML=[...S.p].map(k=>`<div class="subrow"><div class="subname">${P[k].n}</div><div class="subs">${P[k].t.map(([v,t])=>`<label class="sub"><input type="checkbox" data-k="${k}" value="${v}" ${(S.sub[k]||[]).includes(v)?'checked':''}><span>${t}</span></label>`).join('')}</div></div>`).join('');
  $('subgroups').querySelectorAll('[data-k]').forEach(x=>x.onchange=()=>{const a=new Set(S.sub[x.dataset.k]||[]);x.checked?a.add(x.value):a.delete(x.value);S.sub[x.dataset.k]=[...a];clear()});
}
function url(v){v=String(v||'').trim();if(!v)return'';try{const u=new URL(/^https?:\/\//i.test(v)?v:'https://'+v);return u.hostname.includes('.')?u.toString():''}catch(_){return''}}
async function submit(e){
  e?.preventDefault();clear();
  if(!S.p.size)return err('請至少選擇一個工作類型。');
  for(const k of S.p)if(!(S.sub[k]||[]).length)return err(`請至少選擇一個「${P[k].n}」使用方式。`);
  const unit=$('unit').value.trim(),owner=$('owner').value.trim(),phone=$('phone').value.trim(),email=$('email').value.trim(),region=$('region').value,l1=url($('link1').value),l2=url($('link2').value);
  if(!unit||!owner||!phone||!email||!region)return err('請把有 * 的資料填完整。');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err('Email 格式不正確。');
  if(!l1)return err('請提供至少一個可開啟的品牌、社群、官網或作品頁網址。');
  const c=compat(),products=[...S.p],application={activationProfile:{version:7,architecture:'doing_2_fixed_products',products,subtypes:S.sub,modules:mods()},unitName:unit,ownerName:owner,phone,email,contactEmail:email,region,industryCategories:c.industryCategories,useCases:c.useCases,workSituations:[],painPoints:['other'],primaryPainPoint:'other',otherPainPoint:'DOING 2.0 單頁正式申請',assistantAnalysis:{confirmed:true,scope:'doing_only',reply:'使用者已在同一頁選擇產品、使用類型並填寫正式申請資料。'},publicLinks:[l1,l2].filter(Boolean),noPublicLink:false,confirmations:{confirmReal:true,confirmUse:true,confirmReview:true},operationStage:'operating',helperUnderstanding:{version:7,fixedProducts:true,confirmed:true,customerServiceOnly:true,applicationGate:false,products,subtypes:S.sub,modules:mods()}};
  const b=$('submitApplication');b.disabled=true;b.textContent='正在處理…';
  try{
    const memberToken=localStorage.getItem('doing_member_token')||'',r=await fetch(API+'?action=createOrganizerApplicationDraft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'createOrganizerApplicationDraft',application,member_token:memberToken})}),d=await r.json();
    if(!r.ok||d.error)throw Error(d.error||'申請資料保存失敗');
    if(d.existingWorkspace){const u=new URL('/me/',location.origin);u.searchParams.set('application_status','existing_workspace');u.hash='operations';return location.href=u.toString()}
    if(d.lineVerified){const u=new URL(location.href);u.searchParams.set('application_status',d.status||'pending');if(d.applicationId)u.searchParams.set('application_id',d.applicationId);if(d.tenantId)u.searchParams.set('tenant_id',d.tenantId);return location.href=u.toString()}
    const a=new URL(API+'/auth/line/start');a.searchParams.set('mode','organizer_signup');a.searchParams.set('application_id',d.applicationId);location.href=a.toString();
  }catch(e2){err(e2.message||'申請資料保存失敗');b.disabled=false;b.textContent='LINE 驗證並開通'}
}
form.addEventListener('submit',submit);renderProducts();renderSubtypes();
})();