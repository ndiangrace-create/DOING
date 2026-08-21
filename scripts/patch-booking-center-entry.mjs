import fs from 'node:fs';

const file='operations-center.html';
let html=fs.readFileSync(file,'utf8');
const oldTop='<div class="top"><a id="back" href="admin.html">← 回主辦後台</a><button class="btn" id="reload">重新整理</button></div>';
const newTop='<div class="top"><a id="back" href="admin.html">← 回主辦後台</a><div class="actions"><a id="bookingCenterLink" class="btn primary" href="booking-center.html">預約中心</a><button class="btn" id="reload">重新整理</button></div></div>';
const oldBack="$('back').href='admin.html?tenant='+encodeURIComponent(T)+(token?'&admin_token='+encodeURIComponent(token):'');";
const newBack=oldBack+"\n$('bookingCenterLink').href='booking-center.html?tenant='+encodeURIComponent(T)+(token?'&admin_token='+encodeURIComponent(token):'')+(email?'&email='+encodeURIComponent(email):'');";

if(html.includes('id="bookingCenterLink"')){
  console.log('booking center entry already present');
  process.exit(0);
}
if(!html.includes(oldTop)) throw new Error('operations-center top anchor changed; refuse unsafe patch');
if(!html.includes(oldBack)) throw new Error('operations-center auth propagation anchor changed; refuse unsafe patch');
html=html.replace(oldTop,newTop).replace(oldBack,newBack);
fs.writeFileSync(file,html);
console.log('patched operations-center.html with booking center entry');
