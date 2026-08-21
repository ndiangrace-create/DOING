(()=>{
'use strict';
const TOKEN_KEY='doing_member_token';
const u=new URL(location.href);
const hasInvite=u.searchParams.has('staff_invite')||u.searchParams.has('registration_invite');
const hasIncoming=u.searchParams.has('member_token');
const hasStored=!!localStorage.getItem(TOKEN_KEY);
const loginView=document.getElementById('loginView');
const inlineLogin=document.getElementById('lineLogin');

// DOING 2.0：會員中心不再提供第二層登入入口。
// 已登入直接顯示會員中心；未登入回到單一登入入口處理。
if(inlineLogin) inlineLogin.remove();
if(!hasIncoming&&!hasStored&&!hasInvite){
  if(loginView) loginView.classList.add('hidden');
  const target=new URL('/',location.origin);
  target.searchParams.set('openMemberProfile','1');
  target.searchParams.set('return_to',u.pathname+u.hash);
  location.replace(target.toString());
}
})();
