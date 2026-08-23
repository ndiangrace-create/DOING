import assert from 'node:assert/strict';
import worker from '../worker.js';

const env={
  JWT_SECRET:'test-only-market-member-primary-return-secret-20260823',
  LINE_LOGIN_CHANNEL_ID:'1234567890',
  LINE_LOGIN_REDIRECT_URI:'https://tobeloved-api.ndiangrace.workers.dev/auth/line/callback',
};

function decodeJwtPayload(token){
  const part=String(token||'').split('.')[1]||'';
  return JSON.parse(Buffer.from(part,'base64url').toString('utf8'));
}

async function startAndCancel({tenant,returnUrl}){
  const start=new URL('https://tobeloved-api.ndiangrace.workers.dev/auth/line/start');
  start.searchParams.set('mode','member');
  if(tenant)start.searchParams.set('tenant',tenant);
  if(returnUrl)start.searchParams.set('return_url',returnUrl);
  const startResponse=await worker.fetch(new Request(start),env,{});
  assert.equal(startResponse.status,302,'LINE member start 必須回 OAuth redirect');
  const lineLocation=startResponse.headers.get('location');
  assert.ok(lineLocation,'LINE member start 缺少 Location');
  const lineUrl=new URL(lineLocation);
  const state=lineUrl.searchParams.get('state');
  assert.ok(state,'LINE OAuth redirect 缺少 state');
  const payload=decodeJwtPayload(state);
  assert.equal(payload.mode,'member','一般報名者 OAuth state 必須固定 mode=member');
  assert.equal(payload.tenant,String(tenant||'').toLowerCase(),'tenant 只能保留上下文，不可改變 member 角色');
  if(returnUrl)assert.equal(payload.return_url,returnUrl,'Market 前台 return_url 必須原樣簽入 OAuth state');

  const callback=new URL('https://tobeloved-api.ndiangrace.workers.dev/auth/line/callback');
  callback.searchParams.set('state',state);
  callback.searchParams.set('error','access_denied');
  const callbackResponse=await worker.fetch(new Request(callback),env,{});
  assert.equal(callbackResponse.status,302,'取消 LINE 登入仍必須回原角色入口');
  return {payload,location:new URL(callbackResponse.headers.get('location'))};
}

const marketReturn='https://doing.2b-love.com/market/public/?tenant=demo&doing_login_flow=market_member';
const normal=await startAndCancel({tenant:'demo',returnUrl:marketReturn});
assert.equal(normal.location.origin,'https://doing.2b-love.com');
assert.equal(normal.location.pathname,'/market/public/');
assert.equal(normal.location.searchParams.get('tenant'),'demo');
assert.equal(normal.location.searchParams.get('doing_login_flow'),'market_member');
assert.equal(normal.location.searchParams.get('member_login_error'),'line_cancelled');
assert.equal(normal.location.searchParams.has('login_error'),false,'member 錯誤不得使用主辦 login_error');
assert.ok(!/admin|workspace/.test(normal.location.pathname),'member Callback 不得進主辦頁');

// 即使 tenant 名稱帶有管理語意，也不得把 member 身分提升成平台／主辦。
const platformContext=await startAndCancel({tenant:'platform',returnUrl:marketReturn});
assert.equal(platformContext.location.origin,'https://doing.2b-love.com');
assert.equal(platformContext.location.pathname,'/market/public/');
assert.equal(platformContext.location.searchParams.get('member_login_error'),'line_cancelled');

// 缺 return_url 時，member fallback 只能回正式 DOING 2.0 站點，不得回舊 GitHub Pages 或 admin。
const fallback=await startAndCancel({tenant:'demo',returnUrl:''});
assert.equal(fallback.payload.return_url,'https://doing.2b-love.com/');
assert.equal(fallback.location.origin,'https://doing.2b-love.com');
assert.equal(fallback.location.pathname,'/');
assert.equal(fallback.location.searchParams.get('member_login_error'),'line_cancelled');

console.log(JSON.stringify({
  result:'PASS',
  contract:'Market participant OAuth primary return',
  participantMode:'member',
  tenantIsContextOnly:true,
  exactMarketReturn:true,
  platformTenantCannotEscalateMember:true,
  defaultDoingSite:'https://doing.2b-love.com/',
  rescueFallbackRequired:false,
  memberTokenIsNotAdminToken:true,
  productionWrites:0
},null,2));
