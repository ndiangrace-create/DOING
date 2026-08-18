import fs from 'node:fs';

const root=process.cwd();
const pages=['index.html','register.html','member.html','admin.html','onsite.html','platform.html','about.html','photo.html'];
const fail=(message)=>{throw new Error(message)};
for(const page of pages){
  const source=fs.readFileSync(root+'/'+page,'utf8');
  if(!/<meta[^>]+name=["']viewport["']/i.test(source))fail(page+' 缺少 viewport');
  if(!source.includes('doing-system.css'))fail(page+' 未載入全系統框架');
  if(!source.includes('doing-system.css?v=20260817-system5'))fail(page+' 未載入最新防裁切框架');
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
const admin=fs.readFileSync(root+'/admin.html','utf8');
for(const token of ['id="doing-admin-responsive-frame-v2" media="not all"','DOING_ADMIN_SINGLE_ROW_HOTFIX_V3','@media(min-width:901px)','grid-template-columns:repeat(8,minmax(0,1fr))!important','body.doing-admin .tabs{right:12px!important;left:12px!important;display:flex!important;overflow-x:auto!important']){
  if(!admin.includes(token))fail('管理後台單排防破框契約缺少：'+token);
}
if(!admin.includes('>營運項目</button>')||!admin.includes('<h2>營運項目</h2>'))fail('管理端尚未使用活動／預約通用名稱「營運項目」');
const homeCss=fs.readFileSync(root+'/doing-home-refresh.css','utf8');
if(/@media[^{}]*\{[^{}]*#doingGlobalFixedNav(?:,|\{|\.hidden)/s.test(homeCss.replaceAll('html.doing-public-refactor #doingGlobalFixedNav','SCOPED_GLOBAL_NAV')))fail('手機樣式仍可能把租戶頁的全平台導覽強制顯示');
if(!homeCss.includes('#doingGlobalFixedNav.hidden{display:none!important}'))fail('租戶頁缺少全平台導覽的預設隱藏規則');
for(const token of ['body.doing-app #doingGlobalFixedNav .doing-nav-brand{border:0!important','body.doing-app #doingGlobalFixedNav .doing-nav-member','width:auto!important','min-width:148px!important','white-space:nowrap!important','overflow-wrap:normal!important','word-break:keep-all!important','@media(min-width:821px) and (max-width:980px)']){
  if(!homeCss.includes(token))fail('首頁會員按鈕響應式契約缺少：'+token);
}
if(homeCss.includes('.doing-nav-actions .doing-nav-action,.doing-nav-member{width:118px'))fail('會員名稱不可再被固定為 118px');
for(const token of ['DOING_NO_TEXT_CLIPPING_CONTRACT_V1','white-space:normal!important','text-overflow:clip!important','overflow-wrap:anywhere!important']){
  if(!css.includes(token)&&!homeCss.includes(token))fail('文字完整顯示契約缺少：'+token);
}
for(const token of ['.doing-card-copy h3','-webkit-line-clamp:unset!important','.doing-card-meta','grid-template-rows:minmax(48px,auto) 42px!important']){
  if(!homeCss.includes(token))fail('首頁活動文字完整顯示契約缺少：'+token);
}
for(const token of ['body.doing-app.doing-admin :where(.tabs .tab,.etc-sub,.equip-name-readonly,.equip-table-name)','body.doing-app.doing-member .overview-secondary']){
  if(!css.includes(token))fail('內頁文字完整顯示契約缺少：'+token);
}
for(const token of ['DOING_NO_BROKEN_VIEWPORT_CONTRACT_V1','html,body{max-width:100%!important;overflow-x:auto!important}','flex-wrap:wrap!important;overflow:visible!important','flex-wrap:nowrap!important;overflow-x:auto!important','body.doing-app table:not(.seat-map){display:block!important']){
  if(!css.includes(token))fail('全站防橫向裁切契約缺少：'+token);
}
console.log('響應式框架驗證完成：'+pages.length+' 個正式頁面，手機／電腦共用契約、登入後會員按鈕與文字不裁切規則有效。');
