(()=>{
'use strict';
const input=document.getElementById('doingSearch');
const clear=document.getElementById('clearSearch');
const cards=[...document.querySelectorAll('[data-search]')];
const empty=document.getElementById('searchEmpty');
const chips=[...document.querySelectorAll('[data-filter]')];
function normalize(v){return String(v||'').trim().toLowerCase()}
function apply(q){
  const key=normalize(q);
  let visible=0;
  cards.forEach(card=>{
    const hit=!key||normalize(card.dataset.search).includes(key)||normalize(card.textContent).includes(key);
    card.dataset.searchHidden=hit?'0':'1';
    if(hit)visible++;
  });
  empty?.classList.toggle('hidden',visible!==0);
  clear?.classList.toggle('hidden',!key);
}
input?.addEventListener('input',e=>{chips.forEach(x=>x.classList.remove('active'));apply(e.target.value)});
clear?.addEventListener('click',()=>{if(input)input.value='';chips.forEach(x=>x.classList.remove('active'));chips[0]?.classList.add('active');apply('');input?.focus()});
chips.forEach(chip=>chip.addEventListener('click',()=>{
  chips.forEach(x=>x.classList.remove('active'));chip.classList.add('active');
  const value=chip.dataset.filter==='all'?'':chip.dataset.filter;
  if(input)input.value=value==='all'?'':(value||'').split(' ')[0];
  if(value==='all'||!value){apply('');return}
  let visible=0;
  cards.forEach(card=>{
    const tokens=normalize(value).split(/\s+/).filter(Boolean);
    const hay=normalize(card.dataset.search+' '+card.textContent);
    const hit=tokens.some(t=>hay.includes(t));
    card.dataset.searchHidden=hit?'0':'1';
    if(hit)visible++;
  });
  empty?.classList.toggle('hidden',visible!==0);
  clear?.classList.toggle('hidden',false);
}));
chips[0]?.classList.add('active');
})();
