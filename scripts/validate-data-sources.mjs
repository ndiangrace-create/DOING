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
  if(!moduleMap.has(key))fail('世界樹缺少資料來源模組：'+key);
  if(JSON.stringify(tables)!==JSON.stringify(moduleMap.get(key)))fail('世界樹與資料目錄不同步：'+key);
  for(const name of tables)if(!tableNames.has(name))fail('世界樹引用不存在資料表：'+name);
}
const refs=new Set();
for(const helper of ['dbGet','dbInsert','dbUpsert','dbUpdate','dbUpdateReturning','dbDelete']){
  const re=new RegExp("\\b"+helper+"\\s*\\(\\s*env\\s*,\\s*['\"]([A-Za-z0-9_]+)['\"]","g");
  let match;while((match=re.exec(worker)))refs.add(match[1]);
}
for(const name of refs)if(!tableNames.has(name))fail('Worker 引用未經正式盤點的資料表：'+name);
const allowed=new Set(catalog.browserStorage.allowedKeys||[]);
for(const page of ['index.html','register.html','member.html','member-panel.html','admin.html','onsite.html','platform.html','about.html','photo.html','workspace.html']){
  const source=fs.readFileSync(root+'/'+page,'utf8');
  const re=/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['"]([^'"]+)/g;
  let match;while((match=re.exec(source)))if(!allowed.has(match[1]))fail(page+' 使用未核准的瀏覽器資料鍵：'+match[1]);
}
if(settings.authority?.project!=='DOING_SaaS'||settings.authority?.schema!=='public'||settings.authority?.api!=='tobeloved-api')fail('正式設定 SSOT 必須是 DOING_SaaS/public/tobeloved-api');
if(settings.browserStorage?.formalSettingsAllowed!==false||settings.browserStorage?.businessDataAllowed!==false)fail('正式設定與營運資料不可保存在瀏覽器');
if(!Array.isArray(settings.domains)||!settings.domains.length)fail('正式設定 SSOT 清單不可為空');
const settingKeys=new Set();
for(const domain of settings.domains){
  if(!domain.key||settingKeys.has(domain.key))fail('正式設定 SSOT key 缺少或重複：'+String(domain.key||''));
  settingKeys.add(domain.key);
  if(!Array.isArray(domain.tables)||!domain.tables.length)fail('正式設定缺少 Supabase 資料表：'+domain.key);
  for(const table of domain.tables)if(!tableNames.has(table))fail('正式設定引用未盤點資料表：'+domain.key+' -> '+table);
  if(!Array.isArray(domain.readActions)||!domain.readActions.length)fail('正式設定缺少讀取 API：'+domain.key);
  if(!Array.isArray(domain.writeActions)||!domain.writeActions.length)fail('正式設定缺少寫入 API：'+domain.key);
  for(const action of [...domain.readActions,...domain.writeActions])if(!worker.includes(action))fail('正式設定 API 未存在 Worker：'+domain.key+' -> '+action);
}
if(worker!==fs.readFileSync(root+'/worker.txt','utf8'))fail('worker.js / worker.txt 不一致');
console.log('資料來源驗證完成：'+tableNames.size+' 個真實資料表、'+refs.size+' 個 Worker 讀寫引用、'+moduleMap.size+' 個世界樹模組、'+settings.domains.length+' 類正式設定全部以 Supabase 為 SSOT。');
