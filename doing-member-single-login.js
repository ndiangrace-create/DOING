(()=>{
'use strict';
const API='https://tobeloved-api.ndiangrace.workers.dev';
const TOKEN_KEY='doing_member_token';
const u=new URL(location.href);
const hasInvite=u.searchParams.has('staff_invite')||u.searchParams.has('registration_invite');
const hasIncoming=u.searchParams.has('member_token');
const hasStored=!!localStorage.getItem(TOKEN_KEY);
const loginView=document.getElementById('loginView');
const inlineLogin=document.getElementById('lineLogin');

// DOING 2.0 單一登入：會員中心本身不再出現第二顆 LINE 登入按鈕。
if(inlineLogin) inlineLogin.remove();

// 已帶回 member_token 或已有 30 天會員 token：直接交給 member-panel 原本流程載入。
if(hasIncoming||hasStored) return;

// 未登入時直接啟動 LINE OAuth，不再先繞回首頁。
// 邀請參數與原本分頁必須一路保留，登入成功後回到同一個 member-panel。
if(loginView) loginView.classList.add('hidden');
const returnUrl=new URL('/member-panel.html',location.origin);
for(const key of ['staff_invite','registration_invite']){
  const value=u.searchParams.get(key);
  if(value) returnUrl.searchParams.set(key,value);
}
returnUrl.hash=u.hash||'#home';
const auth=new URL(API+'/auth/line/start');
auth.searchParams.set('mode','member');
auth.searchParams.set('return_url',returnUrl.toString());
location.replace(auth.toString());
})();
