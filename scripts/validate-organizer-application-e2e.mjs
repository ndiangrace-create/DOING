import assert from 'node:assert/strict';
import worker from '../worker.js';

const tables=new Proxy({
  tenant_apply_logs:[],tenants:[],staff:[],tenant_settings:[],billing_logs:[],sessions:[],
  platform_members:[],platform_member_identities:[],
  platform_settings:[{setting_key:'startup_credit_policy',value_json:{enabled:true,amount:1000}}],
  audit_logs:[],error_logs:[],service_items:[],resources:[],timeslots:[],booking_calendars:[],
  operation_units:[],registrations:[],payments:[],registration_items:[],platform_staff:[]
},{get:(target,key)=>target[key]||(target[key]=[])});

const clone=value=>JSON.parse(JSON.stringify(value));
const csv=value=>String(value||'').split(',').map(x=>x.trim().replace(/^"|"$/g,''));
function matches(row,key,raw){
  const value=row[key],filter=String(raw||'');
  if(filter.startsWith('eq.'))return String(value??'')===filter.slice(3);
  if(filter.startsWith('neq.'))return String(value??'')!==filter.slice(4);
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

const realFetch=globalThis.fetch;let emailCalls=0,lineNonce='',lineMockEmail='formal-flow-test@doing.invalid',lineMockSubject='line-test-subject',lineMockName='DOING 測試人員',googleMockEmail='formal-flow-test@doing.invalid',googleMockSubject='google-test-subject';
globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url),method=String(init.method||(typeof input==='string'?'GET':input.method)||'GET').toUpperCase();
  if(url.origin==='https://api.line.me'&&url.pathname==='/oauth2/v2.1/token')return jsonResponse({access_token:'mock-line-access-token',id_token:'mock-line-id-token'});
  if(url.origin==='https://api.line.me'&&url.pathname==='/oauth2/v2.1/verify')return jsonResponse({aud:'mock-line-client',sub:lineMockSubject,name:lineMockName,picture:'https://example.invalid/avatar.png',email:lineMockEmail,nonce:lineNonce});
  if(url.origin==='https://oauth2.googleapis.com'&&url.pathname==='/token')return jsonResponse({id_token:'mock-google-id-token'});
  if(url.origin==='https://oauth2.googleapis.com'&&url.pathname==='/tokeninfo')return jsonResponse({aud:'mock-google-client',email:googleMockEmail,email_verified:true,name:'DOING 測試人員',sub:googleMockSubject});
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
  LINE_LOGIN_CHANNEL_ID:'mock-line-client',LINE_LOGIN_CHANNEL_SECRET:'mock-line-secret',
  RESEND_KEY:'mock-resend-key',
  GOOGLE_REDIRECT_URI:'https://worker.test/auth/google/callback',LINE_LOGIN_REDIRECT_URI:'https://worker.test/auth/line/callback',
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
    unitName:'DOING 正式申請流程測試',ownerName:'DOING 測試人員',contactEmail:'formal-flow-test@doing.invalid',phone:'0900000000',
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
  assert.equal(row.status,'line_verification_pending');

  const start=await request('/auth/line/start?mode=organizer_signup&application_id='+encodeURIComponent(draft.applicationId));
  assert.equal(start.status,302);const lineStartUrl=new URL(start.headers.get('location')),state=lineStartUrl.searchParams.get('state');lineNonce=lineStartUrl.searchParams.get('nonce');assert.ok(state);assert.ok(lineNonce);assert.match(lineStartUrl.searchParams.get('scope'),/email/);
  const callback=await request('/auth/line/callback?code=mock-code&state='+encodeURIComponent(state));
  assert.equal(callback.status,302);assert.equal(new URL(callback.headers.get('location')).searchParams.get('application_status'),'pending');
  row=tables.tenant_apply_logs.find(x=>x.id===draft.applicationId);
  assert.equal(row.status,'pending');assert.equal(row.contact_email,'formal-flow-test@doing.invalid');assert.equal(row.application_json.loginProvider,'line');assert.ok(row.application_json.memberId);
  assert.equal(tables.platform_members.length,1);assert.equal(tables.platform_member_identities.filter(x=>x.provider==='line').length,1);

  const now=Date.now(),platformToken=await signToken({iss:'DOING',email:'platform-test@doing.invalid',tenant_id:'platform',role:'platform_super_admin',normalized_role:'platform_super_admin',issued_at:now,expires_at:now+3600000});
  const approvedFlags={registration:true,review:true,payment:true,equipment:true,seatSelection:true,checkin:true,invoice:false,workshopSlots:true,service:true,resource:false,participants:true,customFields:true,addons:true,agreement:true,i18n:false,googleCalendar:true};
  const approval=await jsonAction('approveApply',{token:platformToken,apply_id:draft.applicationId,module_flags:approvedFlags});
  assert.equal(approval.ok,true);assert.ok(approval.tenantId);
  const tenantId=approval.tenantId,settings=tables.tenant_settings.find(x=>x.tenant_id===tenantId),flags=typeof settings.module_flags_json==='string'?JSON.parse(settings.module_flags_json):settings.module_flags_json;
  for(const [key,value] of Object.entries(approvedFlags))assert.equal(flags[key],value,'核准模組錯誤：'+key);
  assert.equal(tables.tenants.filter(x=>x.id===tenantId).length,1);assert.equal(tables.staff.filter(x=>x.tenant_id===tenantId&&x.role==='organizer_owner').length,1);
  assert.equal(tables.staff.find(x=>x.tenant_id===tenantId&&x.role==='organizer_owner').platform_member_id,row.application_json.memberId);
  assert.equal(tables.billing_logs.filter(x=>x.tenant_id===tenantId&&x.billing_type==='startup_credit_grant').length,1);
  assert.equal(row.status,'approved');

  const ownerToken=await signToken({iss:'DOING',email:'formal-flow-test@doing.invalid',tenant_id:tenantId,role:'organizer_owner',normalized_role:'organizer_owner',issued_at:now,expires_at:now+3600000});
  const profileRes=await request('/?action=getTenantModuleProfile&tenant='+encodeURIComponent(tenantId)+'&email='+encodeURIComponent('formal-flow-test@doing.invalid')+'&token='+encodeURIComponent(ownerToken));
  const profile=await profileRes.json();assert.equal(profile.approvedFlags.invoice,false);assert.equal(profile.approvedFlags.workshopSlots,true);

  const approvedSession=await jsonAction('createSession',{tenant:tenantId,email:'formal-flow-test@doing.invalid',token:ownerToken,name:'核准功能測試場次',status:'關閉',dates:[],modules:{registration:true,review:true,payment:true,equipment:true,seatSelection:true,checkin:true,invoice:false,workshopSlots:true,service:true,participants:true,customFields:true,addons:true,agreement:true,resource:false}});
  assert.equal(approvedSession.success,true);
  const blockedSession=await jsonAction('createSession',{tenant:tenantId,email:'formal-flow-test@doing.invalid',token:ownerToken,name:'未核准功能阻擋測試',status:'關閉',dates:[],modules:{registration:true,resource:true}});
  assert.match(blockedSession.error,/尚未由平台核准.*人員／資源/);

  const adminStart=await request('/auth/line/start?mode=admin&tenant='+encodeURIComponent(tenantId));
  const adminStartUrl=new URL(adminStart.headers.get('location'));lineNonce=adminStartUrl.searchParams.get('nonce');
  const adminCallback=await request('/auth/line/callback?code=mock-code&state='+encodeURIComponent(adminStartUrl.searchParams.get('state')));
  const adminReturn=new URL(adminCallback.headers.get('location'));assert.equal(adminReturn.pathname,'/admin.html');assert.ok(adminReturn.searchParams.get('admin_token'));

  const googleStart=await request('/auth/google/start?mode=member&return_url='+encodeURIComponent('https://site.test/member.html'));
  const googleState=new URL(googleStart.headers.get('location')).searchParams.get('state');
  const googleCallback=await request('/auth/google/callback?code=mock-code&state='+encodeURIComponent(googleState));
  assert.ok(new URL(googleCallback.headers.get('location')).searchParams.get('member_token'));
  assert.equal(tables.platform_members.length,1,'LINE 與 Google 不可建立兩筆會員');
  const identityMemberIds=new Set(tables.platform_member_identities.map(x=>x.member_id));assert.deepEqual([...identityMemberIds],[row.application_json.memberId]);assert.deepEqual(tables.platform_member_identities.map(x=>x.provider).sort(),['google','line']);
  const googleAdminStart=await request('/auth/google/start?mode=admin&tenant='+encodeURIComponent(tenantId));
  const googleAdminStartUrl=new URL(googleAdminStart.headers.get('location'));
  const googleAdminCallback=await request('/auth/google/callback?code=mock-code&state='+encodeURIComponent(googleAdminStartUrl.searchParams.get('state')));
  const googleAdminReturn=new URL(googleAdminCallback.headers.get('location'));assert.equal(googleAdminReturn.pathname,'/admin.html');assert.ok(googleAdminReturn.searchParams.get('admin_token'));

  const canonicalMemberId=row.application_json.memberId,legacyMemberId='MEM_LEGACY_DUPLICATE';
  tables.platform_members.push({id:legacyMemberId,email:'formal-flow-test@doing.invalid',email_verified_at:new Date(now+5000).toISOString(),created_at:new Date(now+5000).toISOString(),updated_at:new Date(now+5000).toISOString(),vendor_json:{}});
  tables.platform_member_identities.push({id:'MID_LEGACY_GOOGLE',member_id:legacyMemberId,provider:'google',provider_subject:'legacy-google-subject',provider_email:'formal-flow-test@doing.invalid',created_at:new Date(now+5000).toISOString(),last_login_at:new Date(now+5000).toISOString()});
  tables.registrations.push({id:'REG_LEGACY_MEMBER',tenant_id:tenantId,platform_member_id:legacyMemberId});
  tables.platform_staff.push({id:'PST_LEGACY_MEMBER',email:'formal-flow-test@doing.invalid',platform_member_id:legacyMemberId,is_active:true});
  tables.tenant_apply_logs.push({id:'APP_LEGACY_MEMBER',status:'approved',application_json:{memberId:legacyMemberId}});
  const mergeStart=await request('/auth/line/start?mode=member&return_url='+encodeURIComponent('https://site.test/member.html'));
  const mergeStartUrl=new URL(mergeStart.headers.get('location'));lineNonce=mergeStartUrl.searchParams.get('nonce');
  const mergeCallback=await request('/auth/line/callback?code=mock-code&state='+encodeURIComponent(mergeStartUrl.searchParams.get('state')));
  const canonicalToken=new URL(mergeCallback.headers.get('location')).searchParams.get('member_token');assert.ok(canonicalToken);
  assert.equal(tables.platform_members.length,1,'舊有重複會員登入後必須自動合併');
  assert.equal(tables.platform_members[0].id,canonicalMemberId);
  assert.ok(tables.platform_member_identities.every(x=>x.member_id===canonicalMemberId),'所有 LINE／Google 身分必須指向同一會員');
  assert.equal(tables.registrations.find(x=>x.id==='REG_LEGACY_MEMBER').platform_member_id,canonicalMemberId);
  assert.equal(tables.platform_staff.find(x=>x.id==='PST_LEGACY_MEMBER').platform_member_id,canonicalMemberId);
  assert.equal(tables.tenant_apply_logs.find(x=>x.id==='APP_LEGACY_MEMBER').application_json.memberId,canonicalMemberId);

  const canonicalSave=await jsonAction('savePlatformMemberProfile',{member_token:canonicalToken,name:'DOING 測試人員',email:'contact-main@doing.invalid',phone:'0911222333',city:'台中市',systemApplication:{enabled:false}});
  assert.equal(canonicalSave.ok,true);assert.equal(tables.platform_members[0].email,'formal-flow-test@doing.invalid','手填聯絡信箱不可覆蓋登入服務已驗證 Email');assert.equal(tables.platform_members[0].contact_email,'contact-main@doing.invalid');assert.equal(tables.platform_members[0].phone_normalized,'0911222333');

  tables.platform_member_identities=tables.platform_member_identities.filter(x=>x.provider!=='google');
  googleMockEmail='different-google@doing.invalid';googleMockSubject='google-different-email-subject';
  tables.tenants.push({id:'legacy-google-tenant',name:'不同 Email 舊主辦'});
  tables.staff.push({id:'STF_LEGACY_GOOGLE',tenant_id:'legacy-google-tenant',email:googleMockEmail,name:'舊主辦',role:'organizer_owner',normalized_role:'organizer_owner',is_active:true,active:true,platform_member_id:null});
  const separateGoogleStart=await request('/auth/google/start?mode=member&return_url='+encodeURIComponent('https://site.test/member.html'));
  const separateGoogleState=new URL(separateGoogleStart.headers.get('location')).searchParams.get('state');
  const separateGoogleCallback=await request('/auth/google/callback?code=mock-code&state='+encodeURIComponent(separateGoogleState));
  const separateGoogleToken=new URL(separateGoogleCallback.headers.get('location')).searchParams.get('member_token');assert.ok(separateGoogleToken,'不同 Email 的 Google 驗證成功後仍必須能登入');
  assert.equal(tables.platform_members.length,2,'不同已驗證 Email 在未確認前不可誤合併');
  assert.ok(tables.staff.find(x=>x.id==='STF_LEGACY_GOOGLE').platform_member_id,'Google 已驗證 Email 應先接回原管理權');
  const collisionSave=await jsonAction('savePlatformMemberProfile',{member_token:separateGoogleToken,name:'可能重複會員',email:'another-contact@doing.invalid',phone:'+886 911-222-333',systemApplication:{enabled:false}});
  assert.match(collisionSave.error,/登入已成功.*可能屬於既有 DOING 帳號/,'同電話只暫停重複建檔，不可說成登入失敗');
  assert.equal(tables.platform_members.filter(x=>x.completed_at).length,1,'重複疑慮未解除前不可建立第二份完整會員資料');

  const linkRequest=await jsonAction('createIdentityLink',{member_token:canonicalToken,provider:'google',return_url:'https://site.test/member.html#account'});
  assert.equal(linkRequest.ok,true);assert.match(linkRequest.url,/\/auth\/google\/start/);
  const linkStartUrl=new URL(linkRequest.url),linkStart=await request(linkStartUrl.pathname+linkStartUrl.search),linkState=new URL(linkStart.headers.get('location')).searchParams.get('state');
  const linkCallback=await request('/auth/google/callback?code=mock-code&state='+encodeURIComponent(linkState)),linkReturn=new URL(linkCallback.headers.get('location'));
  assert.equal(linkReturn.searchParams.get('member_linked'),'google');assert.ok(linkReturn.searchParams.get('member_token'));
  assert.equal(tables.platform_members.length,1,'使用者明確登入兩邊帳號後必須合併成一份會員');
  assert.ok(tables.platform_member_identities.every(x=>x.member_id===canonicalMemberId),'不同 Email 的 Google 身分也必須連到原 LINE 會員');
  assert.equal(tables.platform_members[0].email,'formal-flow-test@doing.invalid','同步不同 Email 的 Google 後不可反覆改寫主要登入 Email');
  assert.equal(tables.staff.find(x=>x.id==='STF_LEGACY_GOOGLE').platform_member_id,canonicalMemberId,'雙 OAuth 同步後舊主辦權限必須移到共用會員');
  const linkedProfile=await (await request('/?action=getPlatformMemberProfile&member_token='+encodeURIComponent(linkReturn.searchParams.get('member_token')))).json();
  assert.deepEqual(linkedProfile.linkedProviders.sort(),['google','line']);

  const legacyOwnerResults=[];
  for(let i=1;i<=4;i++){
    const legacyTenant='legacy-owner-'+i,legacyEmail=`legacy-owner-${i}@doing.invalid`,staffId='STF_LEGACY_OWNER_'+i;
    tables.tenants.push({id:legacyTenant,name:'既有主辦 '+i});
    tables.staff.push({id:staffId,tenant_id:legacyTenant,email:legacyEmail,name:'既有主辦 '+i,role:'organizer_owner',normalized_role:'organizer_owner',is_active:true,active:true,platform_member_id:null});
    lineMockEmail=legacyEmail;lineMockSubject='line-legacy-owner-'+i;lineMockName='既有主辦 '+i;
    const legacyStart=await request('/auth/line/start?mode=admin&tenant='+encodeURIComponent(legacyTenant));
    const legacyStartUrl=new URL(legacyStart.headers.get('location'));lineNonce=legacyStartUrl.searchParams.get('nonce');
    const legacyCallback=await request('/auth/line/callback?code=mock-code&state='+encodeURIComponent(legacyStartUrl.searchParams.get('state')));
    const legacyReturn=new URL(legacyCallback.headers.get('location'));
    assert.equal(legacyReturn.pathname,'/admin.html');assert.ok(legacyReturn.searchParams.get('admin_token'),'既有主辦 '+i+' LINE 登入未取得管理權');
    assert.ok(tables.staff.find(x=>x.id===staffId).platform_member_id,'既有主辦 '+i+' 未綁定共用會員');legacyOwnerResults.push(legacyTenant);
  }

  const legacyPlatformEmail='legacy-platform@doing.invalid';
  tables.platform_staff.push({id:'PST_LEGACY_PLATFORM',email:legacyPlatformEmail,name:'既有平台管理者',role:'platform_super_admin',normalized_role:'platform_super_admin',is_active:true,active:true,platform_member_id:null});
  lineMockEmail=legacyPlatformEmail;lineMockSubject='line-legacy-platform';lineMockName='既有平台管理者';
  const platformLineStart=await request('/auth/line/start?mode=platform&tenant=platform'),platformLineStartUrl=new URL(platformLineStart.headers.get('location'));lineNonce=platformLineStartUrl.searchParams.get('nonce');
  const platformLineCallback=await request('/auth/line/callback?code=mock-code&state='+encodeURIComponent(platformLineStartUrl.searchParams.get('state'))),platformLineReturn=new URL(platformLineCallback.headers.get('location'));
  assert.equal(platformLineReturn.pathname,'/platform.html');assert.ok(platformLineReturn.searchParams.get('admin_token'),'既有平台管理者 LINE 登入未取得管理權');
  assert.ok(tables.platform_staff.find(x=>x.id==='PST_LEGACY_PLATFORM').platform_member_id,'既有平台管理者未綁定共用會員');

  await Promise.all(jobs);
  assert.ok(emailCalls>=2,'申請送出與審核通過通知信未完整觸發');
  console.log(JSON.stringify({
    result:'PASS',applicationId:draft.applicationId,tenantId,
    stages:['問卷草稿','模擬 LINE 驗證','平台核准','建立租戶','建立負責人','LINE 進入主辦後台','LINE／Google 共用會員','Google 以共用會員進入主辦後台','合併舊重複會員與關聯資料','手填 Email 與驗證 Email 分流','不同 Email 的 Google 仍可登入','同電話暫停重複建檔但不擋登入','使用者明確同步 LINE／Google','不同 Email 的舊主辦權限移到共用會員','4 個既有主辦以 LINE 接回管理權','既有平台管理者以 LINE 接回管理權','寫入模組','建立核准場次','阻擋未核准模組'],
    legacyOwnersBound:legacyOwnerResults.length,legacyPlatformAdminBound:true,
    approvedModules:Object.entries(approvedFlags).filter(([,v])=>v).map(([k])=>k),
    platformDisabled:['invoice','resource','i18n'],emailNotifications:emailCalls,productionWrites:0
  },null,2));
}finally{globalThis.fetch=realFetch}
