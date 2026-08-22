(()=>{
'use strict';
const q=new URL(location.href).searchParams.get('q')||'';
function apply(){const input=document.getElementById('q');if(q&&input){input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>document.getElementById('searchBtn')?.click(),80)}}
document.readyState==='loading'?addEventListener('DOMContentLoaded',apply,{once:true}):apply();
})();
