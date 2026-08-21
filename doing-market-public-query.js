(()=>{
'use strict';
const q=new URL(location.href).searchParams.get('q')||'';
if(!q)return;
const input=document.getElementById('q');
if(!input)return;
input.value=q;
input.dispatchEvent(new Event('input',{bubbles:true}));
setTimeout(()=>document.getElementById('searchBtn')?.click(),120);
})();
