import fs from 'node:fs';

const htmlFile='operations-center.html';
let html=fs.readFileSync(htmlFile,'utf8');
const oldTop='<div class="top"><a id="back" href="admin.html">← 回主辦後台</a><button class="btn" id="reload">重新整理</button></div>';
const newTop='<div class="top"><a id="back" href="admin.html">← 回主辦後台</a><div class="actions"><a id="bookingCenterLink" class="btn primary" href="booking-center.html">預約中心</a><button class="btn" id="reload">重新整理</button></div></div>';
const oldBack="$('back').href='admin.html?tenant='+encodeURIComponent(T)+(token?'&admin_token='+encodeURIComponent(token):'');";
const newBack=oldBack+"\n$('bookingCenterLink').href='booking-center.html?tenant='+encodeURIComponent(T)+(token?'&admin_token='+encodeURIComponent(token):'')+(email?'&email='+encodeURIComponent(email):'');";

if(!html.includes('id="bookingCenterLink"')){
  if(!html.includes(oldTop)) throw new Error('operations-center top anchor changed; refuse unsafe patch');
  if(!html.includes(oldBack)) throw new Error('operations-center auth propagation anchor changed; refuse unsafe patch');
  html=html.replace(oldTop,newTop).replace(oldBack,newBack);
  fs.writeFileSync(htmlFile,html);
  console.log('patched operations-center.html with booking center entry');
}else console.log('booking center entry already present');

const treeFile='doing-operational-world-tree.json';
const tree=JSON.parse(fs.readFileSync(treeFile,'utf8'));
const journey=(tree.journeys||[]).find(x=>x.id==='workspace-modules-calendar');
if(!journey) throw new Error('world tree journey workspace-modules-calendar missing');
const step=(journey.steps||[]).find(x=>x.id==='open-work');
if(!step) throw new Error('world tree open-work step missing');
if(!String(step.page||'').includes('booking-center.html')){
  step.page=String(step.page||'')+'／booking-center.html';
  step.button=String(step.button||'')+'／預約中心';
  step.actions=Array.from(new Set([...(step.actions||[]),'getAvailabilityAdmin','saveAvailabilityRule','saveAvailabilityException','getAvailableStartsPublic','updateServiceVisit']));
  step.tables=Array.from(new Set([...(step.tables||[]),'service_items','resources','availability_rules','availability_exceptions','service_visits']));
  step.evidence=Array.from(new Set([...(step.evidence||[]),'Web 通用預約中心固定契約']));
  tree.updatedAt='2026-08-21';
  fs.writeFileSync(treeFile,JSON.stringify(tree,null,2)+'\n');
  console.log('patched operational world tree booking-center path');
}else console.log('operational world tree booking-center path already present');
