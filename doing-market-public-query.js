(()=>{
'use strict';
const body=document.body;if(!body)return;
body.classList.add('mk-public-ui');
function ensureCss(){if(document.querySelector('link[data-market-role-ui]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='/doing-market-role-ui-v17.css?v=20260822-v17';l.dataset.marketRoleUi='1';document.head.appendChild(l)}
function afterRole(){const q=new URL(location.href).searchParams.get('q')||'';const input=document.getElementById('q');if(q&&input){input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>document.getElementById('searchBtn')?.click(),80)}}
function ensureJs(){if(window.__doingMarketRoleV17){afterRole();return}if(document.querySelector('script[data-market-role-ui]'))return;const s=document.createElement('script');s.src='/doing-market-role-ui-v17.js?v=20260822-v17';s.async=false;s.dataset.marketRoleUi='1';s.onload=afterRole;document.body.appendChild(s)}
ensureCss();ensureJs();
})();
