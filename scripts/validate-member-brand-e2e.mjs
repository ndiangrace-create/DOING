import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../worker.js';

const sql=fs.readFileSync(new URL('../supabase_member_brand_model.sql',import.meta.url),'utf8');
const memberPage=fs.readFileSync(new URL('../member.html',import.meta.url),'utf8');
const registerPage=fs.readFileSync(new URL('../register.html',import.meta.url),'utf8');
for(const table of ['brands','brand_members','brand_access_requests','registration_members','registration_member_invites']){
  assert.match(sql,new RegExp(`create table if not exists public\\.${table}`));
  assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(sql,new RegExp(`revoke all on public\\.${table} from anon, authenticated`));
}
assert.match(sql,/registrations_active_brand_session_unit_unique/);
assert.match(sql,/accept_registration_member_invite_atomic/);
assert.match(sql,/accept_registration_member_invite_atomic[\s\S]*?security invoker[\s\S]*?for update/,'接受邀請必須由低權限交易鎖定單一邀請');
assert.match(sql,/revoke all on function public\.accept_registration_member_invite_atomic\(text,text,timestamptz\) from public, anon, authenticated/,'邀請交易不可由瀏覽器角色直接呼叫');
assert.match(sql,/grant execute on function public\.accept_registration_member_invite_atomic\(text,text,timestamptz\) to service_role/,'邀請交易只供後端服務呼叫');
assert.match(memberPage,/data-page="brands"/);assert.match(memberPage,/邀請出攤夥伴/);
assert.match(registerPage,/第一次申請可直接填寫/);
assert.doesNotMatch(registerPage,/系統會在背景比對/);
assert.match(memberPage,/function goPage\(page\)/);
assert.match(memberPage,/if\(rows\.length===1\)openBrandForm\(rows\[0\]\)/);

const tables=new Proxy({
  platform_members:[],platform_member_identities:[],brands:[],brand_members:[],brand_access_requests:[],
  registrations:[],registration_members:[],registration_member_invites:[],seat_operation_logs:[]
},{get:(target,key)=>target[key]||(target[key]=[]),set:(target,key,value)=>{target[key]=value;return true}});
const clone=value=>JSON.parse(JSON.stringify(value));
const csv=value=>String(value||'').split(',').map(x=>x.trim().replace(/^"|"$/g,''));
function matches(row,key,raw){
  const value=row[key],filter=String(raw||'');
  if(filter.startsWith('eq.'))return String(value??'')===filter.slice(3);
  if(filter.startsWith('neq.'))return String(value??'')!==filter.slice(4);
  if(filter.startsWith('ilike.'))return String(value??'').toLowerCase()===filter.slice(6).replace(/%/g,'').toLowerCase();
  if(filter.startsWith('in.(')&&filter.endsWith(')'))return csv(filter.slice(4,-1)).includes(String(value??''));
  if(filter==='is.null')return value===null||value===undefined||value==='';
  return true;
}
function selectedRows(table,url){
  let rows=[...tables[table]];
  for(const [key,value] of url.searchParams.entries()){
    if(['select','order','limit','offset','on_conflict'].includes(key)||key==='or')continue;
    rows=rows.filter(row=>matches(row,key,value));
  }
  const order=String(url.searchParams.get('order')||'').split(',')[0],parts=order.split('.');
  if(parts[0])rows.sort((a,b)=>String(a[parts[0]]??'').localeCompare(String(b[parts[0]]??''))*(parts[1]==='desc'?-1:1));
  const offset=Math.max(0,Number(url.searchParams.get('offset'))||0),limit=Number(url.searchParams.get('limit'))||rows.length;
  return rows.slice(offset,offset+limit);
}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url),method=String(init.method||(typeof input==='string'?'GET':input.method)||'GET').toUpperCase();
  if(url.origin!=='https://mock.supabase.local')throw new Error('測試禁止連線外部服務：'+url.origin);
  const parts=url.pathname.split('/').filter(Boolean);
  if(parts[2]==='rpc'&&parts[3]==='accept_registration_member_invite_atomic'){
    const body=init.body?JSON.parse(String(init.body)):{} ,invite=tables.registration_member_invites.find(x=>x.id===body.p_invite_id);
    if(!invite)return json({ok:false,error:'找不到這筆出攤邀請'});
    if(invite.status==='accepted'&&invite.accepted_by_member_id===body.p_member_id)return json({ok:true,alreadyAccepted:true,registrationId:invite.registration_id});
    if(invite.status!=='pending'||new Date(invite.expires_at).getTime()<=new Date(body.p_now).getTime())return json({ok:false,error:'出攤邀請已失效，請報名人重新分享'});
    if(!tables.registration_members.some(x=>x.registration_id===invite.registration_id&&x.platform_member_id===body.p_member_id))tables.registration_members.push({id:'RM_ATOMIC_'+body.p_member_id,tenant_id:invite.tenant_id,registration_id:invite.registration_id,platform_member_id:body.p_member_id,brand_id:invite.brand_id,role:invite.role,status:'active',permissions_json:{view:true,checkin:true,request_teardown:true},invited_by_member_id:invite.invited_by_member_id,accepted_at:body.p_now,created_at:body.p_now,updated_at:body.p_now});
    Object.assign(invite,{status:'accepted',accepted_by_member_id:body.p_member_id,accepted_at:body.p_now,updated_at:body.p_now});return json({ok:true,accepted:true,registrationId:invite.registration_id});
  }
  const table=parts[2];if(!table)return json({error:'missing table'},400);
  if(method==='GET')return json(clone(selectedRows(table,url)));
  const body=init.body?JSON.parse(String(init.body)):{};
  if(method==='POST'){const rows=Array.isArray(body)?body:[body];for(const row of rows)tables[table].push(clone(row));return json(clone(rows));}
  if(method==='PATCH'){const rows=selectedRows(table,url);for(const row of rows)Object.assign(row,clone(body));const prefer=String(init.headers?.Prefer||init.headers?.prefer||'');return json(prefer.includes('return=representation')?clone(rows):[]);}
  if(method==='DELETE'){const doomed=new Set(selectedRows(table,url));tables[table]=tables[table].filter(x=>!doomed.has(x));return json([]);}
  return json({error:'unsupported'},400);
};

const env={SUPABASE_URL:'https://mock.supabase.local',SUPABASE_SERVICE_ROLE_KEY:'test-service-role',JWT_SECRET:'member-brand-e2e-secret',DOING_SITE_URL:'https://site.test/'};
const ctx={waitUntil(){}};
async function signMember(memberId,subject){
  const now=Date.now(),payload={iss:'DOING',type:'member',provider:'line',provider_subject:subject,member_id:memberId,issued_at:now,expires_at:now+3600000};
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),data=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.JWT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(header+'.'+data));
  return header+'.'+data+'.'+Buffer.from(signature).toString('base64url');
}
async function post(action,body){const res=await worker.fetch(new Request('https://worker.test/?action='+encodeURIComponent(action),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})}),env,ctx);return res.json()}
async function get(action,params){const url=new URL('https://worker.test/');url.searchParams.set('action',action);for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);const res=await worker.fetch(new Request(url),env,ctx);return res.json()}

try{
  const now=new Date().toISOString();
  tables.platform_members.push(
    {id:'MEM_A',email:null,contact_email:'a@doing.invalid',name:'報名人',phone:'0911000000',completed_at:now,vendor_json:{}},
    {id:'MEM_B',email:null,contact_email:'b@doing.invalid',name:'實際出攤者',phone:'0911000000',completed_at:now,vendor_json:{}},
    {id:'MEM_C',email:null,contact_email:'c@doing.invalid',name:'另一支手機',phone:'0922000000',completed_at:now,vendor_json:{}}
  );
  tables.platform_member_identities.push(
    {id:'MID_A',member_id:'MEM_A',provider:'line',provider_subject:'line-a',provider_email:null,last_login_at:now},
    {id:'MID_B',member_id:'MEM_B',provider:'line',provider_subject:'line-b',provider_email:null,last_login_at:now},
    {id:'MID_C',member_id:'MEM_C',provider:'line',provider_subject:'line-c',provider_email:null,last_login_at:now}
  );
  const tokenA=await signMember('MEM_A','line-a'),tokenB=await signMember('MEM_B','line-b'),tokenC=await signMember('MEM_C','line-c');

  const created=await post('saveMemberBrand',{member_token:tokenA,brand:{brandName:'夜貓美甲',category:'美業服務',brandIntro:'台中深夜美甲',items:'凝膠美甲'}});
  assert.equal(created.created,true);assert.equal(tables.brands.length,1);assert.equal(tables.brand_members.length,1);
  const brandId=tables.brands[0].id;

  const candidate=await post('saveMemberBrand',{member_token:tokenB,brand:{brandName:'夜 貓 美甲',category:'美業服務',brandIntro:'同一品牌夥伴'}});
  assert.equal(candidate.needsResolution,true,'同名品牌必須提示確認');
  assert.equal(tables.brands.length,1,'同名提示前不得偷偷建立第二品牌');
  const join=await post('saveMemberBrand',{member_token:tokenB,brand:{brandName:'夜 貓 美甲',category:'美業服務',brandIntro:'同一品牌夥伴'},resolution:'join',candidateBrandId:brandId});
  assert.equal(join.pendingApproval,true);assert.equal(tables.brand_members.find(x=>x.platform_member_id==='MEM_B').status,'pending');
  const request=tables.brand_access_requests[0];
  const approved=await post('resolveBrandAccessRequest',{member_token:tokenA,requestId:request.id,approved:true});
  assert.equal(approved.approved,true);assert.equal(tables.brand_members.find(x=>x.platform_member_id==='MEM_B').status,'active');
  assert.equal(tables.platform_members.filter(x=>['MEM_A','MEM_B'].includes(x.id)).length,2,'共用電話仍必須保留兩位獨立會員');
  assert.equal(tables.brands.length,1,'共同品牌主檔只保留一份');

  tables.registrations.push({id:'REG_A',tenant_id:'TENANT_A',session_id:'SESSION_A',brand_id:brandId,brand_name:'夜貓美甲',platform_member_id:'MEM_A',submitted_by_member_id:'MEM_A',review_status:'已錄取',payment_status:'已繳費',checkin_status:'未報到',teardown_status:'未撤場',clear_status:'未清場',transfer_status:'',created_at:now});
  tables.registration_members.push({id:'RM_A',tenant_id:'TENANT_A',registration_id:'REG_A',platform_member_id:'MEM_A',brand_id:brandId,role:'submitter',status:'active',permissions_json:{view:true,manage_registration:true,invite_team:true,checkin:true,request_teardown:true},created_at:now});
  const invite=await post('createRegistrationMemberInvite',{member_token:tokenA,registrationId:'REG_A',role:'onsite_representative'});
  assert.ok(invite.url);const inviteToken=new URL(invite.url).searchParams.get('registration_invite');assert.ok(inviteToken);
  const accepted=await post('acceptRegistrationMemberInvite',{member_token:tokenB,invite_token:inviteToken});
  assert.equal(accepted.accepted,true);assert.equal(tables.registration_members.filter(x=>x.registration_id==='REG_A').length,2);
  const stolen=await post('acceptRegistrationMemberInvite',{member_token:tokenC,invite_token:inviteToken});assert.match(stolen.error||'',/邀請已失效/,'同一邀請不得被第二支手機搶走');assert.equal(tables.registration_members.filter(x=>x.registration_id==='REG_A').length,2);
  const team=await get('getRegistrationTeam',{member_token:tokenB,registrationId:'REG_A'});assert.equal(team.length,2);
  const checkin=await post('memberOnsiteAction',{member_token:tokenB,registrationId:'REG_A',onsiteAction:'checkin'});assert.equal(checkin.status,'已報到');
  const teardown=await post('memberOnsiteAction',{member_token:tokenB,registrationId:'REG_A',onsiteAction:'request_teardown'});assert.equal(teardown.status,'已申請撤場');
  assert.equal(tables.registrations[0].checkin_status,'已報到');assert.equal(tables.registrations[0].teardown_status,'已申請撤場');

  console.log(JSON.stringify({result:'PASS',members:2,brands:1,brandMembers:2,registrationMembers:2,inviteRaceBlocked:true,flow:['同名提示','品牌管理者核准','活動邀請','本人 LINE 接受','阻擋第二支手機搶用邀請','現場報到','申請撤場'],productionWrites:0},null,2));
}finally{globalThis.fetch=realFetch}
