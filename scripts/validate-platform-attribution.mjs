import fs from 'node:fs';

const root=process.cwd(),fail=m=>{throw new Error(m)};
const worker=fs.readFileSync(root+'/worker.js','utf8');
const browser=fs.readFileSync(root+'/doing-attribution.js','utf8');
const index=fs.readFileSync(root+'/index.html','utf8');
const register=fs.readFileSync(root+'/register.html','utf8');
const admin=fs.readFileSync(root+'/admin.html','utf8');
const platform=fs.readFileSync(root+'/platform.html','utf8');
const sql=fs.readFileSync(root+'/supabase_platform_attribution.sql','utf8');
const data=JSON.parse(fs.readFileSync(root+'/doing-data-sources.json','utf8'));

for(const token of ['hTrackPlatformAttribution','recordRegistrationAttribution','buildAttributionReport','hGetPlatformAttributionReport',"case 'register'",'platform_attribution_events'])if(!worker.includes(token))fail('Worker 歸因鏈缺少：'+token);
for(const token of ['keepalive:true','IntersectionObserver','doing_attribution_id','doing_exposure_order_id'])if(!browser.includes(token))fail('瀏覽器歸因鏈缺少：'+token);
for(const source of [index,register])if(!source.includes('doing-attribution.js')||!source.includes('payloadFields'))fail('報名頁未帶入歸因資訊');
for(const token of ['platformAttributionMetrics','platformAttributionCampaigns','getPlatformAttributionReport'])if(!platform.includes(token))fail('平台歸因報表缺少：'+token);
for(const token of ['getExposureCatalog','attributionReport','我的曝光成效（近 30 日）','點擊→報名'])if(!admin.includes(token))fail('主辦曝光推廣報表缺少：'+token);
if(!worker.includes("buildAttributionReport(env,{days:30,tenantId:T,source:'paid_exposure'})"))fail('主辦曝光報表必須綁定登入租戶並限定付費曝光來源');
for(const token of ['enable row level security','revoke all','service_role','idempotency_key text not null unique'])if(!sql.toLowerCase().includes(token))fail('歸因 migration 安全規則缺少：'+token);
if(/(^|\n)\s*(email|phone|user_agent|ip_address)\s+/i.test(sql))fail('歸因表不可保存 Email、手機、IP 或 User-Agent 欄位');
const table=data.tables.find(x=>x.name==='platform_attribution_events');if(!table||!table.rlsEnabled)fail('資料目錄未登記歸因表與 RLS');
console.log('平台歸因驗證完成：曝光、點擊、完成報名與平台報表鏈路齊全。');
