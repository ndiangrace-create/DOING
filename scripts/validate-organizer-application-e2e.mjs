import assert from 'node:assert/strict';
import worker from '../worker.js';

const tables=new Proxy({
  tenant_apply_logs:[],tenants:[],staff:[],tenant_settings:[],billing_logs:[],sessions:[],
  platform_settings:[{setting_key:'startup_credit_policy',value_json:{enabled:true,amount:1000}}],
  audit_logs:[],error_logs:[],service_items:[],resources:[],timeslots:[],booking_calendars:[],
  operation_units:[],registrations:[],payments:[],registration_items:[],platform_staff:[]
},{get:(target,key)=>target[key]||(target[key]=[])});

const clone=value=>JSON.parse(JSON.stringify(value));
const csv=value=>String(value||'').split(',').map(x=>x.trim().replace(/^"|"$/g,''));
function matches(row,key,raw){
  const value=row[key],filter=String(raw||'');
  if(filter.startsWith('eq.'))return String(value??'')===filter.slice(3);
  if(filter.startsWith('ilike.'))return String(value??'').toLowerCase()===filter.slice(6).replace(/%/g,'').toLowerCase();
  if(filter.startsWith('in.(')&&filter.endsWith(')'))return csv(filter.slice(4,-1)).includes(String(value??''));
  if(filter==='is.null')return value===null||value===undefined||value==='';
  if(filter==='not.is.null')return value!==null&&value!==undefined&&value!=='';
  if(filter.startsWith('gte.'))return String(value??'')>=filter.slice(4);
  if(filter.startsWith('lte.'))return String(value??'')<=filter.slice(4);
  if(filter.startsWith('gt.'))return String(value??'')>filter.slice(3);
  if(filter.startsWith('lt.'))return String(value??'')<filter.slice(3);
  return true;
}
function selectedRows(table,url){
  let rows=[...tables[table]];
  for(const [key,value] of url.searchParams.entries()){
    if(['select','order','limit','offset','on_conflict'].includes(key))continue;
    if(key==='or')continue;
    rows=rows.filter(row=>matches(row,key,value));
  }
  const orders=csv(url.searchParams.get('order'));
  for(const order of orders.reverse()){
    const [key,dir]=order.split('.');if(!key)continue;
    rows.sort((a,b)=>String(a[key]??'').localeCompare(String(b[key]??''))*(dir==='desc'?-1:1));
  }
  const offset=Math.max(0,Number(url.searchParams.get('offset'))||0),limit=Number(url.searchParams.get('limit'))||rows.length;
  return rows.slice(offset,offset+limit);
}
const jsonResponse=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

const realFetch=globalThis.fetch;let emailCalls=0;
globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url),method=String(init.method||(typeof input==='string'?'GET':input.method)||'GET').toUpperCase();
  if(url.origin==='https://oauth2.googleapis.com'&&url.pathname==='/token')return jsonResponse({id_token:'mock-google-id-token'});
  if(url.origin==='https://oauth2.googleapis.com'&&url.pathname==='/tokeninfo')return jsonResponse({aud:'mock-google-client',email:'formal-flow-test@doing.invalid',name:'DOING 測試人員',sub:'google-test-subject'});
  if(url.origin==='https://api.resend.com'){emailCalls++;return jsonResponse({id:'mock-email-'+emailCalls});}
  if(url.origin!=='https://mock.supabase.local')throw new Error('測試禁止連線外部服務：'+url.origin);
  const parts=url.pathname.split('/').filter(Boolean),table=parts[2];
  if(parts[2]==='rpc')return jsonResponse({ok:true,balance:1000,ledgerId:'mock-ledger'});
  if(!table)return jsonResponse({error:'missing table'},400);
  if(method==='GET')return jsonResponse(clone(selectedRows(table,url)));
  const body=init.body?JSON.parse(String(init.body)):{};
  if(method==='POST'){
    const rows=Array.isArray(body)?body:[body];
    for(const row of rows){
      const conflict=url.searchParams.get('on_conflict'),hit=conflict&&tables[table].find(x=>String(x[conflict])===String(row[conflict]));
      if(hit)Object.assign(hit,clone(row));else tables[table].push(clone(row));
    }
    return jsonResponse(clone(rows));
  }
  if(method==='PATCH'){
    const rows=selectedRows(table,url);for(const row of rows)Object.assign(row,clone(body));
    const prefer=String(init.headers?.Prefer||init.headers?.prefer||'');return jsonResponse(prefer.includes('return=representation')?clone(rows):[]);
  }
  if(method==='DELETE'){
    const rows=new Set(selectedRows(table,url));tables[table]=tables[table].filter(x=>!rows.has(x));return jsonResponse([]);
  }
  return jsonResponse({error:'unsupported mock method'},400);
};

const env={
  SUPABASE_URL:'https://mock.supabase.local',SUPABASE_SERVICE_ROLE_KEY:'test-service-role',
  JWT_SECRET:'isolated-e2e-jwt-secret',AUTH_SECRET:'isolated-e2e-auth-secret',
  GOOGLE_CLIENT_ID:'mock-google-client',GOOGLE_CLIENT_SECRET:'mock-google-secret',
  RESEND_KEY:'mock-resend-key',
  GOOGLE_REDIRECT_URI:'https://worker.test/auth/google/callback',
  DOING_SITE_URL:'https://site.test/',DOING_ADMIN_URL:'https://site.test/admin.html',DOING_PLATFORM_URL:'https://site.test/platform.html'
};
const jobs=[],ctx={waitUntil(p){jobs.push(Promise.resolve(p))}};
async function request(path,{method='GET',body}={}){
  const res=await worker.fetch(new Request('https://worker.test'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined}),env,ctx);
  return res;
}
async function jsonAction(action,body){const res=await request('/?action='+encodeURIComponent(action),{method:'POST',body:{action,...body}});return res.json()}
async function signToken(payload){
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),data=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.JWT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(header+'.'+data));
  return header+'.'+data+'.'+Buffer.from(sig).toString('base64url');
}

try{
  const questionnaire={
    unitName:'DOING 正式申請流程測試',ownerName:'DOING 測試人員',phone:'0900000000',
    industryCategories:['market_retail','craft_experience'],useCases:['market','workshop'],
    painPoints:['payment','schedule','extras','seating','checkin'],primaryPainPoint:'payment',noPublicLink:true,publicLinks:[],
    confirmations:{confirmReal:true,confirmUse:true,confirmReview:true},
    needFlags:{payment:true,workshopSlots:true,calendar:true,equipment:true,addons:true,seatSelection:true,checkin:true},
    moduleProfile:{configured:true,useType:'market',useCases:['market','workshop'],defaults:{
      registration:true,review:true,payment:true,equipment:true,seatSelection:true,checkin:true,invoice:true,
      workshopSlots:true,service:true,resource:false,participants:true,customFields:true,addons:true,agreement:true,
      googleCalendar:true,quantityMode:'stall',depositKind:'refundable',operatingMode:'booking'
    }}
  };

  const draft=await jsonAction('createOrganizerApplicationDraft',{application:questionnaire});
  assert.equal(draft.ok,true);assert.ok(draft.applicationId);
  let row=tables.tenant_apply_logs.find(x=>x.id===draft.applicationId);
  assert.equal(row.status,'google_verification_pending');

  const start=await request('/auth/google/start?mode=organizer_signup&application_id='+encodeURIComponent(draft.applicationId));
  assert.equal(start.status,302);const state=new URL(start.headers.get('location')).searchParams.get('state');assert.ok(state);
  const callback=await request('/auth/google/callback?code=mock-code&state='+encodeURIComponent(state));
  assert.equal(callback.status,302);assert.equal(new URL(callback.headers.get('location')).searchParams.get('application_status'),'pending');
  row=tables.tenant_apply_logs.find(x=>x.id===draft.applicationId);
  assert.equal(row.status,'pending');assert.equal(row.contact_email,'formal-flow-test@doing.invalid');

  const now=Date.now(),platformToken=await signToken({iss:'DOING',email:'platform-test@doing.invalid',tenant_id:'platform',role:'platform_super_admin',normalized_role:'platform_super_admin',issued_at:now,expires_at:now+3600000});
  const approvedFlags={registration:true,review:true,payment:true,equipment:true,seatSelection:true,checkin:true,invoice:false,workshopSlots:true,service:true,resource:false,participants:true,customFields:true,addons:true,agreement:true,i18n:false,googleCalendar:true};
  const approval=await jsonAction('approveApply',{token:platformToken,apply_id:draft.applicationId,module_flags:approvedFlags});
  assert.equal(approval.ok,true);assert.ok(approval.tenantId);
  const tenantId=approval.tenantId,settings=tables.tenant_settings.find(x=>x.tenant_id===tenantId),flags=typeof settings.module_flags_json==='string'?JSON.parse(settings.module_flags_json):settings.module_flags_json;
  for(const [key,value] of Object.entries(approvedFlags))assert.equal(flags[key],value,'核准模組錯誤：'+key);
  assert.equal(tables.tenants.filter(x=>x.id===tenantId).length,1);assert.equal(tables.staff.filter(x=>x.tenant_id===tenantId&&x.role==='organizer_owner').length,1);
  assert.equal(tables.billing_logs.filter(x=>x.tenant_id===tenantId&&x.billing_type==='startup_credit_grant').length,1);
  assert.equal(row.status,'approved');

  const ownerToken=await signToken({iss:'DOING',email:'formal-flow-test@doing.invalid',tenant_id:tenantId,role:'organizer_owner',normalized_role:'organizer_owner',issued_at:now,expires_at:now+3600000});
  const profileRes=await request('/?action=getTenantModuleProfile&tenant='+encodeURIComponent(tenantId)+'&email='+encodeURIComponent('formal-flow-test@doing.invalid')+'&token='+encodeURIComponent(ownerToken));
  const profile=await profileRes.json();assert.equal(profile.approvedFlags.invoice,false);assert.equal(profile.approvedFlags.workshopSlots,true);

  const approvedSession=await jsonAction('createSession',{tenant:tenantId,email:'formal-flow-test@doing.invalid',token:ownerToken,name:'核准功能測試場次',status:'關閉',dates:[],modules:{registration:true,review:true,payment:true,equipment:true,seatSelection:true,checkin:true,invoice:false,workshopSlots:true,service:true,participants:true,customFields:true,addons:true,agreement:true,resource:false}});
  assert.equal(approvedSession.success,true);
  const blockedSession=await jsonAction('createSession',{tenant:tenantId,email:'formal-flow-test@doing.invalid',token:ownerToken,name:'未核准功能阻擋測試',status:'關閉',dates:[],modules:{registration:true,resource:true}});
  assert.match(blockedSession.error,/尚未由平台核准.*人員／資源/);

  await Promise.all(jobs);
  assert.ok(emailCalls>=2,'申請送出與審核通過通知信未完整觸發');
  console.log(JSON.stringify({
    result:'PASS',applicationId:draft.applicationId,tenantId,
    stages:['問卷草稿','模擬 Google 驗證','平台核准','建立租戶','建立負責人','寫入模組','建立核准場次','阻擋未核准模組'],
    approvedModules:Object.entries(approvedFlags).filter(([,v])=>v).map(([k])=>k),
    platformDisabled:['invoice','resource','i18n'],emailNotifications:emailCalls,productionWrites:0
  },null,2));
}finally{globalThis.fetch=realFetch}
