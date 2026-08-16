import fs from 'node:fs';

const root=process.cwd();
const pages=['index.html','register.html','member.html','admin.html','onsite.html','platform.html','about.html','photo.html'];
const fail=(message)=>{throw new Error(message)};
for(const page of pages){
  const source=fs.readFileSync(root+'/'+page,'utf8');
  if(!/<meta[^>]+name=["']viewport["']/i.test(source))fail(page+' 缺少 viewport');
  if(!source.includes('doing-system.css'))fail(page+' 未載入全系統框架');
  if(!/class=["'][^"']*\bdoing-app\b/.test(source))fail(page+' 缺少 doing-app');
}
const css=fs.readFileSync(root+'/doing-system.css','utf8');
for(const token of ['DOING_RESPONSIVE_CONTRACT_V2','DOING_RESPONSIVE_DENSITY_CONTRACT_V3','background-image:none!important','position:sticky!important','min-height:46px!important','@media (max-width:760px)','@media (min-width:761px)','overflow-x:auto!important']){
  if(!css.includes(token))fail('共用響應式框架缺少：'+token);
}
for(const token of ['body.doing-app.doing-platform .metrics','grid-template-columns:repeat(2,minmax(0,1fr))!important','body.doing-app.doing-platform .metric small{display:none!important}','body.doing-app.doing-member .hero{min-height:0!important','body.doing-app.doing-member .record-timeline{display:none!important']){
  if(!css.includes(token))fail('手機密度契約缺少：'+token);
}
const member=fs.readFileSync(root+'/member.html','utf8');
if(!member.includes('overview-secondary')||!member.includes('最近進度｜'))fail('會員總覽尚未改為手機摘要模式');
const homeCss=fs.readFileSync(root+'/doing-home-refresh.css','utf8');
for(const token of ['body.doing-app #doingGlobalFixedNav .doing-nav-brand{border:0!important','body.doing-app #doingGlobalFixedNav .doing-nav-member','width:auto!important','min-width:148px!important','white-space:nowrap!important','overflow-wrap:normal!important','word-break:keep-all!important','@media(min-width:821px) and (max-width:980px)']){
  if(!homeCss.includes(token))fail('首頁會員按鈕響應式契約缺少：'+token);
}
if(homeCss.includes('.doing-nav-actions .doing-nav-action,.doing-nav-member{width:118px'))fail('會員名稱不可再被固定為 118px');
console.log('響應式框架驗證完成：'+pages.length+' 個正式頁面，手機／電腦共用契約與登入後會員按鈕有效。');
