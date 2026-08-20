(()=>{
'use strict';
const url=new URL(location.href),status=String(url.searchParams.get('application_status')||'').trim();
if(!status)return;
const copy={
 pending:{title:'LINE 驗證完成，正在自動開通',text:'一般申請不需要等待人工審核。系統會建立你的 DOING 工作空間；若偵測到身分衝突或資料異常，才會轉由平台人工複核。'},
 approved:{title:'工作空間已開通',text:'你的 DOING 工作空間已建立，可以進入「我的 DOING」開始設定。'},
 auto_activated:{title:'工作空間已開通',text:'你的 DOING 工作空間已建立，可以進入「我的 DOING」開始設定。'},
 manual_review:{title:'這筆申請需要人工複核',text:'系統偵測到身分、必要資料或建立流程需要人工確認。原申請已保留，不需要重新填寫。'},
 identity_resolution_required:{title:'需要確認既有帳號',text:'系統偵測到可能已有 DOING 帳號。原申請已保留，確認帳號後再接續。'}
};
const c=copy[status];if(!c)return;
function mount(){
 if(document.getElementById('doingAutoActivationStatus'))return;
 const main=document.querySelector('.smart-shell')||document.body;
 const box=document.createElement('section');box.id='doingAutoActivationStatus';box.setAttribute('role','status');
 box.style.cssText='margin:0 auto 12px;padding:14px 16px;border:1px solid #cfe2e4;border-radius:14px;background:#eef8fa;color:#263b43;line-height:1.55';
 box.innerHTML=`<strong style="display:block;font-size:17px;margin-bottom:4px">${c.title}</strong><span style="font-size:14px">${c.text}</span><div style="margin-top:10px"><a href="member-panel.html#operations" style="display:inline-flex;min-height:40px;align-items:center;padding:7px 12px;border-radius:9px;background:#4f8f9d;color:#fff;text-decoration:none;font-weight:800">進入我的 DOING</a></div>`;
 main.prepend(box);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
