import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const results=[];
const browser=await chromium.launch({headless:true});
const stripScripts=html=>String(html).replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi,'').replace(/<script(?:\s[^>]*)?\s*\/?>/gi,'');
const read=file=>{const html=fs.readFileSync(file,'utf8');assert.ok(html.includes('<!doctype html')||html.includes('<!DOCTYPE html'),`不是有效頁面：${file}`);return html};
async function checkBuiltPage({file,width,height,required,clicks,label}){
  const ctx=await browser.newContext({viewport:{width,height}});ctx.setDefaultTimeout(5000);const page=await ctx.newPage();
  const html=read(file);for(const token of required)assert.ok(html.includes(token),`${label} 建置檔缺少 ${token}`);
  await page.setContent(stripScripts(html),{waitUntil:'domcontentloaded'});
  for(const selector of clicks){const el=page.locator(selector).first();await el.waitFor({state:'visible'});await el.click({force:true});}
  const bodyWidth=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(bodyWidth<=width+8,`${label} 版面橫向溢位：${bodyWidth}>${width}`);
  results.push(label);await ctx.close();
}
try{
  await checkBuiltPage({file:'.doing-2-site/market/public/index.html',width:390,height:844,required:['id="list"','id="q"','id="myRegs"'],clicks:['#searchBtn','[data-type="market"]','#reload'],label:'mobile public discovery shell'});
  await checkBuiltPage({file:'.doing-2-site/market/index.html',width:1440,height:1000,required:['id="sessionList"','data-tab="sessions"','data-tab="tasks"'],clicks:['[data-tab="sessions"]','[data-tab="tasks"]'],label:'desktop market operations shell'});
  await checkBuiltPage({file:'.doing-2-site/me/index.html',width:390,height:844,required:['id="activities"','我的報名'],clicks:['#activities'],label:'mobile member records shell'});
  await checkBuiltPage({file:'.doing-2-site/market/session/index.html',width:1440,height:1000,required:['id="closeout"','data-tab="registrations"','data-tab="payment"'],clicks:['[data-tab="registrations"]','[data-tab="payment"]'],label:'desktop session workbench shell'});

  const completion=fs.readFileSync('doing-market-completion-v16.js','utf8');
  for(const token of ['publicDiscovery','/register/','getMyRegsGlobal','applyRefund','getRefundSuggestion','confirmRefund','getSessionRegistrations'])assert.ok(completion.includes(token),`Market 閉環腳本缺少 ${token}`);
  const settings=fs.readFileSync('doing-market-session-settings-v16.js','utf8');
  for(const token of ['createSession','updateSession'])assert.ok(settings.includes(token),`場次設定腳本缺少 ${token}`);
}finally{await browser.close()}
console.log(JSON.stringify({result:'PASS',browser:'Chromium',builtOutput:true,scope:'real built pages + clickable UI shell; business closure validated by dedicated Market closure checks',checks:results},null,2));
