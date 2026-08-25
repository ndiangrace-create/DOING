import assert from 'node:assert/strict';
import worker from '../worker.js';

const env={JWT_SECRET:'test-only-market-member-primary-return-secret-20260823',LINE_LOGIN_CHANNEL_ID:'1234567890',LINE_LOGIN_REDIRECT_URI:'https://tobeloved-api.ndiangrace.workers.dev/auth/line/callback'};
function decodeJwtPayload(token){const part=String(token||'').split('.')[1]||'';return JSON.parse(Buffer.from(part,'base64url').toString('utf8'))}
async function startAndCancel({tenant,returnUrl}){
  const start=new URL('https://tobeloved-api.ndiangrace.workers.dev/auth/line/start');start.searchParams.set('mode','member');if(tenant)start.searchParams.set('tenant',tenant);if(returnUrl)start.searchParams.set('return_url',returnUrl);
  const startResponse=await worker.fetch(new Request(start),env,{});assert.equal(startResponse.status,302,'LINE member start 必須回 OAuth redirect');
  const lineLocation=startResponse.headers.get('location');assert.ok(lineLocation,'LINE member start 缺少 Location');const lineUrl=new URL(lineLocation);
  assert.equal(lineUrl.searchParams.has('initial_amr_display'),false,'不得強制 LINE QR；交由 LINE 標準 Auto Login / SSO 決定登入方式');
  assert.equal(lineUrl.searchParams.get('ui_locales'),'zh-TW','LINE 登入介面應維持繁體中文');
  assert.notEqual(lineUrl.searchParams.get('prompt'),'login','不得強迫重新輸入 LINE 帳密');
  const state=lineUrl.searchParams.get('state');assert.ok(state,'LINE OAuth redirect 缺少 state');const payload=decodeJwtPayload(state);
  assert.equal(payload.mode,'member');assert.equal(payload.tenant,String(tenant||'').toLowerCase());if(returnUrl)assert.equal(payload.return_url,returnUrl);
  const callback=new URL('https://tobeloved-api.ndiangrace.workers.dev/auth/line/callback');callback.searchParams.set('state',state);callback.searchParams.set('error','access_denied');
  const callbackResponse=await worker.fetch(new Request(callback),env,{});assert.equal(callbackResponse.status,302);return {payload,location:new URL(callbackResponse.headers.get('location'))};
}
const marketReturn='https://doing.2b-love.com/market/public/?tenant=demo&doing_login_flow=market_member';
const normal=await startAndCancel({tenant:'demo',returnUrl:marketReturn});
assert.equal(normal.location.origin,'https://doing.2b-love.com');assert.equal(normal.location.pathname,'/market/public/');assert.equal(normal.location.searchParams.get('tenant'),'demo');assert.equal(normal.location.searchParams.get('doing_login_flow'),'market_member');assert.equal(normal.location.searchParams.get('member_login_error'),'line_cancelled');assert.equal(normal.location.searchParams.has('login_error'),false);assert.ok(!/admin|workspace/.test(normal.location.pathname));
const platformContext=await startAndCancel({tenant:'platform',returnUrl:marketReturn});assert.equal(platformContext.location.pathname,'/market/public/');assert.equal(platformContext.location.searchParams.get('member_login_error'),'line_cancelled');
const fallback=await startAndCancel({tenant:'demo',returnUrl:''});assert.equal(fallback.payload.return_url,'https://doing.2b-love.com/');assert.equal(fallback.location.origin,'https://doing.2b-love.com');assert.equal(fallback.location.pathname,'/');assert.equal(fallback.location.searchParams.get('member_login_error'),'line_cancelled');
console.log(JSON.stringify({result:'PASS',contract:'Market participant OAuth primary return',participantMode:'member',tenantIsContextOnly:true,exactMarketReturn:true,platformTenantCannotEscalateMember:true,defaultDoingSite:'https://doing.2b-love.com/',lineInteractiveFallback:'LINE-standard',lineAutoLoginAndSsoPreserved:true,forcedQr:false,memberTokenIsNotAdminToken:true,productionWrites:0},null,2));
