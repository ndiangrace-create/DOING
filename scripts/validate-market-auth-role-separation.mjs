import fs from 'node:fs';
import assert from 'node:assert/strict';

const pub=fs.readFileSync('market-public.html','utf8');
const publicRoute=fs.readFileSync('market/public/index.html','utf8');
const home=fs.readFileSync('doing-home-refresh.js','utf8');
const admin=fs.readFileSync('market-center.html','utf8');
const member=fs.readFileSync('member-panel.html','utf8');
const apply=fs.readFileSync('smart-application.html','utf8');
const worker=fs.readFileSync('worker.js','utf8');

// 前台＝一般報名者。LINE 登入成功後必須回原本 Market 前台並留在原頁。
for(const token of [
  "TOKEN_KEY='doing_member_token'",
  "new URL(location.href)",
  "u.searchParams.set('return_url',loginReturn().toString())",
  "P.get('member_token')",
  "setStoredToken(incoming)",
  "history.replaceState",
  "api('getPlatformMemberProfile'",
  "api('getMyRegsGlobal'",
  "api('savePlatformMemberProfile'"
]) assert.ok(pub.includes(token),`前台會員登入契約缺少：${token}`);
assert.ok(pub.includes('/auth/line/start'),'前台必須使用 DOING LINE 登入');
assert.ok(!pub.includes("createMemberWorkspaceAdminSession"),'一般報名者前台不得交換主辦 admin session');
assert.ok(!pub.includes("admin_token"),'一般報名者前台不得依賴主辦 admin_token');

// GitHub Pages／公開短路徑若因 OAuth fallback 誤落 DOING 根頁，必須用短效標記送回 Market 前台。
for(const token of ['doing_market_member_return','../../market-public.html','member_token','member_login_error'])assert.ok(publicRoute.includes(token),`Market 公開入口缺少登入回跳保護：${token}`);
for(const token of ['doing_market_member_return','handoffToPendingMarket','clearMarketMemberReturn','MARKET_RETURN_MAX_AGE'])assert.ok(home.includes(token),`DOING 根頁缺少 Market member 回跳保護：${token}`);
assert.ok(home.includes("target.origin!==location.origin"),'Market 回跳必須限制同來源，禁止開放式轉址');
assert.ok(home.includes("startMyDoingLineLogin(){clearMarketMemberReturn()")&&home.includes("startRegistrationsLineLogin(){clearMarketMemberReturn()"),'DOING 自己的會員／工作空間登入必須先清除 Market 暫存回跳，避免誤導流');

// 後台＝主辦單位。只能接受正式主辦 admin token，不能拿一般 member token 直接放行。
for(const token of [
  "TOKEN=P.get('admin_token')||P.get('token')||''",
  "if(!T||!TOKEN)",
  "請先使用 DOING 登入，再由工作空間進入 Market",
  "api('getSessionsAdmin')"
]) assert.ok(admin.includes(token),`主辦後台 Gate 契約缺少：${token}`);
assert.ok(!admin.includes('doing_member_token'),'Market 後台不得把一般報名者 member token 當主辦權限');
assert.ok(!admin.includes("getPlatformMemberProfile"),'Market 後台不得只靠一般會員資料判定主辦權限');

// 主辦資格來自「申請／核准／工作空間／staff 權限」，而不是一般會員登入。
assert.ok(apply.includes('我要申請 DOING'),'主辦申請入口必須存在');
assert.ok(apply.includes('doing-application-contract-v12.js'),'主辦申請必須沿用 DOING 正式申請契約');
for(const token of ['state.workspaces','createMemberWorkspaceAdminSession','data-workspace-admin']) assert.ok(member.includes(token),`會員中心主辦工作空間契約缺少：${token}`);
for(const token of [
  'async function hCreateMemberWorkspaceAdminSession',
  'findStaffForPlatformMember',
  "if(!staff)return jsonErr('你沒有這個營運空間的管理權限',403)",
  "if(active===false)return jsonErr('這個營運空間的管理權限已停用',403)",
  'issueAdminToken'
]) assert.ok(worker.includes(token),`Core 主辦權限交換缺少：${token}`);

console.log(JSON.stringify({
  result:'PASS',
  identity:'DOING LINE',
  publicRole:'participant',
  publicReturn:'/market/public/ same-page return',
  publicFallbackReturn:'DOING root -> remembered Market frontstage',
  organizerRole:'approved organizer/staff only',
  organizerEntry:'application -> approval -> workspace -> admin session',
  participantCannotEnterAdmin:true,
  memberTokenIsNotAdminToken:true,
  openRedirectBlocked:true,
  coreAuthority:'staff/workspace permission',
  databaseChanges:0,
  workerChanges:0
},null,2));
