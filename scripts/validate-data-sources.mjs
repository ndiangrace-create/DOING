import fs from 'node:fs';

const root=process.cwd();
const catalog=JSON.parse(fs.readFileSync(root+'/doing-data-sources.json','utf8'));
const capabilities=JSON.parse(fs.readFileSync(root+'/doing-capabilities.json','utf8'));
const settings=JSON.parse(fs.readFileSync(root+'/doing-settings-ssot.json','utf8'));
const worker=fs.readFileSync(root+'/worker.js','utf8');
const fail=(message)=>{throw new Error(message)};
if(catalog.authority?.projectName!=='DOING_SaaS'||catalog.authority?.schema!=='public')fail('資料權威必須是 DOING_SaaS/public');
if(catalog.authority?.api!=='tobeloved-api')fail('正式 API 必須是 tobeloved-api');
if(catalog.browserStorage?.businessDataAllowed!==false)fail('瀏覽器不可保存營運資料');
const tableNames=new Set((catalog.tables||[]).map(x=>x.name));
if(tableNames.size!==catalog.tables.length||tableNames.size<1)fail('資料表盤點重複或為空');
const moduleMap=new Map((catalog.modules||[]).map(x=>[x.key,x.tables||[]]));
for(const module of capabilities.modules||[]){
  const key=module.key||module.id;
  const tables=module.dataSource?.tables||[];
  if(!moduleMap.has(key))fail('功能盤點缺少資料來源模組：'+key);
  if(JSON.stringify(tables)!==JSON.stringify(moduleMap.get(key)))fail('功能盤點與資料目錄不同步：'+key);
  for(const name of tables)if(!tableNames.has(name))fail('功能盤點引用不存在資料表：'+name);
}
const refs=new Set();
for(const helper of ['dbGet','dbInsert','dbUpsert','dbUpdate','dbUpdateReturning','dbDelete']){
  const re=new RegExp("\\b"+helper+"\\s*\\(\\s*env\\s*,\\s*['\"]([A-Za-z0-9_]+)['\"]","g");
  let match;while((match=re.exec(worker)))refs.add(match[1]);
}
for(const name of refs)if(!tableNames.has(name))fail('Worker 引用未經正式盤點的資料表：'+name);
const allowed=new Set(catalog.browserStorage.allowedKeys||[]);
// UI-only ephemeral state is intentionally NOT business data and may only live in sessionStorage.
// Keep this list tiny and page-scoped so it cannot become a back door for formal records.
const sessionUiOnly=new Map([
  ['doing_market_page',new Set(['market-center.html','market-session.html'])],
  ['doing_market_session_tab',new Set(['market-session.html'])]
]);
const canonicalPages=['doing-2.html','register.html','member-panel.html','workspace.html','smart-application.html','market-center.html','market-public.html','market-session.html','booking-2-center.html','project-center.html','guide-center.html','world-tree.html'];
for(const page of canonicalPages){
  if(!fs.existsSync(root+'/'+page))fail('正式 canonical source 遺失：'+page);
  const source=fs.readFileSync(root+'/'+page,'utf8');
  const re=/(localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['"]([^'"]+)/g;
  let match;while((match=re.exec(source))){
    const [,storage,key]=match;if(allowed.has(key))continue;
    const pages=sessionUiOnly.get(key);
    if(storage==='sessionStorage'&&pages?.has(page))continue;
    fail(page+' 使用未核准的瀏覽器資料鍵：'+key+'（'+storage+'）');
  }
}
for(const [key,pages] of sessionUiOnly){
  for(const page of pages){const source=fs.readFileSync(root+'/'+page,'utf8');if(!source.includes(`sessionStorage.setItem('${key}'`)&&!source.includes(`sessionStorage.getItem('${key}'`))fail('UI 暫存白名單已失去實際用途：'+key)}
}
for(const retired of ['index.html','member.html','admin.html','onsite.html','platform.html','operations-center.html','photo.html','consignment.html','about.html','booking-center.html'])if(fs.existsSync(root+'/'+retired))fail('退休頁不得回到正式 root：'+retired);
if(settings.authority?.project!=='DOING_SaaS'||settings.authority?.schema!=='public'||settings.authority?.api!=='tobeloved-api')fail('正式設定 SSOT 必須是 DOING_SaaS/public/tobeloved-api');
if(settings.browserStorage?.formalSettingsAllowed!==false||settings.browserStorage?.businessDataAllowed!==false)fail('正式設定與營運資料不可保存在瀏覽器');
if(!Array.isArray(settings.domains)||!settings.domains.length)fail('正式設定 SSOT 清單不可為空');
const settingKeys=new Set();
for(const domain of settings.domains){
  if(!domain.key||settingKeys.has(domain.key))fail('正式設定 SSOT key 缺少或重複：'+String(domain.key||''));
  settingKeys.add(domain.key);
  if(!Array.isArray(domain.tables)||!domain.tables.length)fail('正式設定缺少 Supabase 資料表：'+domain.key);
  for(const table of domain.tables)if(!tableNames.has(table))fail('正式設定引用未盤點資料表：'+domain.key+' -> '+table);
  if(domain.managedBy==='migration'){
    if(!domain.migration||!fs.existsSync(root+'/'+domain.migration))fail('治理型設定缺少受版本控制 migration：'+domain.key);
    const migration=fs.readFileSync(root+'/'+domain.migration,'utf8');
    if(!domain.settingKey||!migration.includes(domain.settingKey))fail('治理型設定 migration 未寫入正式 settingKey：'+domain.key);
    if(!migration.includes('platform_settings'))fail('治理型設定未寫入 Supabase platform_settings：'+domain.key);
    continue;
  }
  if(!Array.isArray(domain.readActions)||!domain.readActions.length)fail('正式設定缺少讀取 API：'+domain.key);
  if(!Array.isArray(domain.writeActions)||!domain.writeActions.length)fail('正式設定缺少寫入 API：'+domain.key);
  for(const action of [...domain.readActions,...domain.writeActions])if(!worker.includes(action))fail('正式設定 API 未存在 Worker：'+domain.key+' -> '+action);
}
if(worker!==fs.readFileSync(root+'/worker.txt','utf8'))fail('worker.js / worker.txt 不一致');
console.log(JSON.stringify({result:'PASS',authority:'DOING_SaaS/public/tobeloved-api',tables:tableNames.size,workerTableRefs:refs.size,modules:moduleMap.size,settingsDomains:settings.domains.length,canonicalPages:canonicalPages.length,retiredRootPages:0,browserBusinessData:false,sessionUiOnly:[...sessionUiOnly.keys()]},null,2));