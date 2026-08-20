import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import worker from '../worker.js';

const source=fs.readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const mirror=fs.readFileSync(new URL('../worker.txt',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../supabase_market_app_core_contracts.sql',import.meta.url),'utf8');
const contract=fs.readFileSync(new URL('../DOING_CORE_CONTRACT_V1.md',import.meta.url),'utf8');
assert.equal(source,mirror,'worker.js / worker.txt 必須完全一致');
for(const action of ['exchangeMarketAppAuthCode','getMarketVendorQr','scanMarketVendorQr','registerMarketPushToken','unregisterMarketPushToken','queueMarketPushNotification'])assert.match(source,new RegExp(`action==='${action}'`));
assert.match(source,/doingmarket:\/\/auth\/line\?code=/);assert.doesNotMatch(source,/doingmarket:\/\/auth\/line\?member_token=/);
assert.match(source,/expiresAt=now\+2\*60\*1000/);assert.match(source,/used_at=is\.null/);
for(const table of ['mobile_auth_exchanges','mobile_push_devices','mobile_push_deliveries']){
  assert.match(sql,new RegExp(`create table if not exists public\\.${table}`));
  assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
}
assert.match(sql,/revoke all on table[\s\S]*from public,anon,authenticated/);assert.match(sql,/grant select,insert,update,delete[\s\S]*to service_role/);
assert.match(contract,/不保存 `member_token`/);assert.match(contract,/productionWrites = 0/);

const tables=new Proxy({platform_members:[],platform_member_identities:[],mobile_auth_exchanges:[],mobile_push_devices:[],mobile_push_deliveries:[],registrations:[],registration_members:[],notifications:[],staff:[],staff_session_permissions:[],seat_operation_logs:[]},{get:(o,k)=>o[k]||(o[k]=[]),set:(o,k,v)=>{o[k]=v;return true}});
const clone=v=>JSON.parse(JSON.stringify(v));
function match(row,key,filter){const v=row[key],f=String(filter||'');if(f.startsWith('eq.'))return String(v??'')===decodeURIComponent(f.slice(3));if(f.startsWith('neq.'))return String(v??'')!==decodeURIComponent(f.slice(4));if(f==='is.null')return v===null||v===undefined||v==='';if(f.startsWith('gt.'))return new Date(v).getTime()>new Date(decodeURIComponent(f.slice(3))).getTime();if(f.startsWith('lte.'))return new Date(v).getTime()<=new Date(decodeURIComponent(f.slice(4))).getTime();if(f.startsWith('in.('))return f.slice(4,-1).split(',').includes(String(v??''));return true}
function selected(table,url){let rows=[...tables[table]];for(const [k,v] of url.searchParams){if(['select','order','limit','offset','on_conflict'].includes(k))continue;rows=rows.filter(r=>match(r,k,v))}return rows.slice(Number(url.searchParams.get('offset'))||0,(Number(url.searchParams.get('offset'))||0)+(Number(url.searchParams.get('limit'))||rows.length));}
const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{'Content-Type':'application/json'}}),realFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{const url=new URL(typeof input==='string'?input:input.url),method=String(init.method||(typeof input==='string'?'GET':input.method)||'GET').toUpperCase();if(url.origin!=='https://mock.supabase.local')throw new Error('測試禁止外部連線：'+url.origin);const table=url.pathname.split('/').filter(Boolean)[2];if(method==='GET')return json(clone(selected(table,url)));const body=init.body?JSON.parse(String(init.body)):{};if(method==='POST'){const rows=Array.isArray(body)?body:[body];tables[table].push(...clone(rows));return json(clone(rows))}if(method==='PATCH'){const rows=selected(table,url);for(const r of rows)Object.assign(r,clone(body));const h=new Headers(init.headers||{});return json(h.get('Prefer')?.includes('return=representation')?clone(rows):[])}if(method==='DELETE'){const doomed=new Set(selected(table,url));tables[table]=tables[table].filter(x=>!doomed.has(x));return json([])}return json({error:'unsupported'},400)};

const env={SUPABASE_URL:'https://mock.supabase.local',SUPABASE_SERVICE_ROLE_KEY:'service-test',JWT_SECRET:'market-core-contract-secret',DOING_SITE_URL:'https://doing.test/'};const ctx={waitUntil(){}};
async function token(payload){const now=Date.now(),head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),body=Buffer.from(JSON.stringify({iss:'DOING',issued_at:now,expires_at:now+3600000,...payload})).toString('base64url'),sig=crypto.createHmac('sha256',env.JWT_SECRET).update(head+'.'+body).digest('base64url');return `${head}.${body}.${sig}`}
async function post(action,body){const res=await worker.fetch(new Request(`https://worker.test/?action=${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env,ctx);return res.json()}
const shaHex=s=>crypto.createHash('sha256').update(s).digest('hex').toUpperCase(),shaB64=s=>crypto.createHash('sha256').update(s).digest('base64url');

try{
  const now=new Date().toISOString();tables.platform_members.push({id:'MEM_A',email:'a@doing.test',contact_email:'a@doing.test',display_name:'攤商 A',completed_at:now,vendor_json:{}},{id:'MEM_B',email:'b@doing.test',contact_email:'b@doing.test',display_name:'其他會員',completed_at:now,vendor_json:{}});tables.platform_member_identities.push({id:'MID_A',member_id:'MEM_A',provider:'line',provider_subject:'line-a',created_at:now},{id:'MID_B',member_id:'MEM_B',provider:'line',provider_subject:'line-b',created_at:now});
  const memberA=await token({type:'member',provider:'line',provider_subject:'line-a'}),memberB=await token({type:'member',provider:'line',provider_subject:'line-b'}),staffToken=await token({type:'admin',email:'staff@doing.test',tenant_id:'tenant-a',role:'onsite_staff',normalized_role:'onsite_staff',limit_sessions:'session-a'}),wrongTenantToken=await token({type:'admin',email:'staff@doing.test',tenant_id:'tenant-b',role:'onsite_staff',normalized_role:'onsite_staff',limit_sessions:'session-a'});
  tables.staff.push({id:'STAFF_A',tenant_id:'tenant-a',email:'staff@doing.test',role:'onsite_staff',normalized_role:'onsite_staff',is_active:true,limit_sessions:'session-a'});tables.staff_session_permissions.push({tenant_id:'tenant-a',staff_email:'staff@doing.test',session_id:'session-a',is_active:true});tables.registrations.push({id:'REG_A',tenant_id:'tenant-a',session_id:'session-a',platform_member_id:'MEM_A',submitted_by_member_id:'MEM_A',email:'a@doing.test',review_status:'已錄取',payment_status:'已繳費',checkin_status:'未報到',transfer_status:'',created_at:now});

  const verifier='v'.repeat(64),code='c'.repeat(64);tables.mobile_auth_exchanges.push({id:'MAX_1',code_hash:shaHex(code),platform_member_id:'MEM_A',provider:'line',code_challenge:shaB64(verifier),device_id:'install-market-001',app_state:'state-1',expires_at:new Date(Date.now()+300000).toISOString(),used_at:null,created_at:now});
  const exchanged=await post('exchangeMarketAppAuthCode',{code,code_verifier:verifier,device_id:'install-market-001'});assert.ok(exchanged.member_token,'正確 verifier 應安全取得 member_token');const replay=await post('exchangeMarketAppAuthCode',{code,code_verifier:verifier,device_id:'install-market-001'});assert.match(replay.error||'',/失效或已使用/,'交換碼只可使用一次');

  const deniedQr=await post('getMarketVendorQr',{member_token:memberB,registrationId:'REG_A'});assert.match(deniedQr.error||'',/只有這筆報名/);const qr=await post('getMarketVendorQr',{member_token:memberA,registrationId:'REG_A'});assert.ok(qr.qr_token);const cross=await post('scanMarketVendorQr',{qr_token:qr.qr_token,email:'staff@doing.test',token:wrongTenantToken});assert.match(cross.error||'',/無權限/);const scanned=await post('scanMarketVendorQr',{qr_token:qr.qr_token,email:'staff@doing.test',token:staffToken});assert.equal(scanned.ok,true);assert.equal(tables.registrations[0].checkin_status,'已報到');assert.equal(tables.seat_operation_logs[0].action,'marketAppQrCheckin');

  const device=await post('registerMarketPushToken',{member_token:memberA,installation_id:'install-market-001',platform:'ios',provider:'apns',push_token:'p'.repeat(64)});assert.equal(device.ok,true);const queued=await post('queueMarketPushNotification',{registrationId:'REG_A',email:'staff@doing.test',token:await token({type:'admin',email:'staff@doing.test',tenant_id:'tenant-a',role:'organizer_admin',normalized_role:'organizer_admin'}),title:'集合通知',body:'請於九點前完成報到'});assert.equal(queued.status,'queued');assert.equal(tables.notifications.length,1);assert.equal(tables.mobile_push_deliveries.length,1);const removed=await post('unregisterMarketPushToken',{member_token:memberA,installation_id:'install-market-001'});assert.equal(removed.ok,true);assert.equal(tables.mobile_push_devices[0].active,false);assert.equal(tables.mobile_push_devices[0].push_token,'');
  console.log('✅ Market App Core：原生 LINE 安全交換、QR 雙重權限、Push 登錄／通知佇列通過');console.log('productionWrites=0');
}finally{globalThis.fetch=realFetch}
