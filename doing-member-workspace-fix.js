(()=>{
'use strict';
function patch(){const empty=document.getElementById('emptyWorkspace');if(empty){empty.innerHTML='<h3 class="text-xl font-black">目前沒有同步到可進入的工作空間</h3><p class="mt-2 font-bold text-slate-600">如果你原本已經有營運權限，不需要重新申請。請先按「重新整理」；仍未出現時，重新登入 LINE 或聯絡 DOING 客服協助同步。</p><div class="mt-5 flex flex-wrap justify-center gap-3"><button id="retryWorkspaceSync" class="jelly-cta jelly-cta-blue" type="button">重新同步</button><a class="mini-jelly mini-jelly-lilac" href="/?support=open">聯絡客服</a><a class="mini-jelly mini-jelly-blue" href="/apply/">新增另一個營運空間</a></div>';document.getElementById('retryWorkspaceSync')?.addEventListener('click',()=>document.getElementById('refresh')?.click())}const topApply=document.querySelector('#appView a[href="/apply/"]');if(topApply)topApply.textContent='新增營運空間'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch);else patch();
})();
