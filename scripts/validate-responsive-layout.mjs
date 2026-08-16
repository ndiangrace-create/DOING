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
for(const token of ['DOING_RESPONSIVE_CONTRACT_V2','background-image:none!important','position:sticky!important','min-height:46px!important','@media (max-width:760px)','@media (min-width:761px)','overflow-x:auto!important']){
  if(!css.includes(token))fail('共用響應式框架缺少：'+token);
}
console.log('響應式框架驗證完成：'+pages.length+' 個正式頁面，手機／電腦共用契約有效。');
