import fs from 'node:fs';

const root=process.cwd();
const pages=['index.html','register.html','member-panel.html','admin.html','onsite.html','platform.html','photo.html','operations-center.html','consignment.html'];
const fail=(message)=>{throw new Error(message)};
for(const page of pages){
  const source=fs.readFileSync(root+'/'+page,'utf8');
  if(!/<meta[^>]+name=["']viewport["']/i.test(source))fail(page+' 缺少 viewport');
  if(!source.includes('doing-system.css'))fail(page+' 未載入全系統框架');
  if(!source.includes('doing-system.css?v=20260817-system5'))fail(page+' 未載入最新防裁切框架');
  if(!/class=["'][^"']*\bdoing-app\b/.test(source))fail(page+' 缺少 doing-app');
}
const compat=fs.readFileSync(root+'/member.html','utf8');
if(!/<meta[^>]+name=["']viewport["']/i.test(compat)||!compat.includes("member-panel.html")||!compat.includes("index.html"))fail('member.html 相容轉址契約不完整');
const aboutCompat=fs.readFileSync(root+'/about.html','utf8');
if(!/<meta[^>]+name=["']viewport["']/i.test(aboutCompat)||!aboutCompat.includes('smart-application.html')||!aboutCompat.includes('index.html'))fail('about.html 相容轉址契約不完整');
if(aboutCompat.length>=5000||aboutCompat.includes('apply-wrap')||aboutCompat.includes('smart-flow-guide'))fail('about.html 不得重新承載舊完整頁面');
const css=fs.readFileSync(root+'/doing-system.css','utf8');
for(const token of ['DOING_RESPONSIVE_CONTRACT_V2','DOING_RESPONSIVE_DENSITY_CONTRACT_V3','background-image:none!important','position:sticky!important','min-height:46px!important','@media (max-width:760px)','@media (min-width:761px)','overflow-x:auto!important']){
  if(!css.includes(token))fail('共用響應式框架缺少：'+token);
}
for(const token of ['body.doing-app.doing-platform .metrics','grid-template-columns:repeat(2,minmax(0,1fr))!important','body.doing-app.doing-platform .metric small{display:none!important}','body.doing-app.doing-member .hero{min-height:0!important','body.doing-app.doing-member .record-timeline{display:none!important']){
  if(!css.includes(token))fail('手機密度契約缺少：'+token);
}
const member=fs.readFileSync(root+'/member-panel.html','utf8');
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
const marketCss=fs.readFileSync(root+'/doing-market-2bl.css','utf8');
for(const token of ['--dm-pink:#f3afd0','--dm-lav:#d7c8fb','grid-template-columns:repeat(3,minmax(0,1fr))','@media(max-width:768px)','grid-template-columns:repeat(2,minmax(0,1fr))','position:fixed!important','border-radius:20px']){
  if(!marketCss.includes(token))fail('Market 新操作介面缺少手機／桌機契約：'+token);
}
if(/gradient\(/i.test(marketCss))fail('Market 新操作介面不得用漸層');
const publicUi=fs.readFileSync(root+'/doing-market-public-query.js','utf8');
for(const token of ['mk-public-ui','mk-public-bottom','grid-template-columns:repeat(2,minmax(0,1fr))','報名活動','我的紀錄','線上客服'])if(!publicUi.includes(token))fail('Market 公開活動頁缺少參考圖操作元素：'+token);
if(/gradient\(/i.test(publicUi))fail('Market 公開活動頁不得用漸層');
const shell=fs.readFileSync(root+'/doing-2-shell.js','utf8');
for(const token of ['d2-market-journey','後台入口','場次總覽','場次設定','待辦','審核','付款','排位','退款','財務結案'])if(!shell.includes(token))fail('Market 心智圖操作導航缺少：'+token);
console.log('響應式框架驗證完成：'+pages.length+' 個正式功能頁＋member/about 相容轉址＋Market 手機參考視覺／桌機自動框架／操作路徑均有效。');
