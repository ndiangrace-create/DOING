(()=>{
'use strict';
if(location.pathname!=='/'&&!/\/doing-2\.html$/.test(location.pathname))return;
const wrap=document.querySelector('.d2-home-logo-wrap');
if(!wrap)return;
wrap.innerHTML='<div class="d2-home-logo-slot" data-doing-logo-slot aria-label="LOGO 預留位置"></div>';
})();
