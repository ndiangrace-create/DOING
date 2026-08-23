import fs from 'node:fs';
import assert from 'node:assert/strict';

const pub=fs.readFileSync('market-public.html','utf8');
const publicRoute=fs.readFileSync('market/public/index.html','utf8');
const adminEntry=fs.readFileSync('doing-market-admin-entry.js','utf8');
const home=fs.readFileSync('doing-home-refresh.js','utf8');
const admin=fs.readFileSync('market-center.html','utf8');
const member=fs.readFileSync('member-panel.html','utf8');
const apply=fs.readFileSync('smart-application.html','utf8');
const worker=fs.readFileSync('worker.js','utf8');
const workerMirror=fs.readFileSync('worker.txt','utf8');

for(const token of ["TOKEN_KEY='doing_member_token'","new URL(location.href)","u.searchParams.set('return_url',loginReturn().toString())","P.get('member_token')","setStoredToken(incoming)","history.replaceState","api('getPlatformMemberProfile'","api('getMyRegsGlobal'","api('savePlatformMemberProfile'"]) assert.ok(pub.includes(token),`前台會員登入契約缺少：${token}`);
assert.ok(pub.includes('/auth/line/start'),'前台必須使用 DOING LINE 登入');
assert.ok(!pub.includes("createMemberWorkspaceAdminSession"),'一般報名者前台本體不得直接交換主辦 admin session');
assert.ok(!pub.includes("admin_token"),'一般報名者前台本體不得依賴主辦 admin_token');

assert.equal(worker,workerMirror,'worker.js / worker.txt 必須 byte-identical');
for(const token of ["const DEFAULT_DOING_SITE_URL = 'https://doing.2b-love.com/';","const fallback=mode==='platform'?platformSiteUrl(env):mode==='organizer_signup'?doingSiteUrl(env)+'#apply':doingSiteUrl(env);","const target=mode==='organizer_signup'?applicationTarget:mode==='platform'?platformTarget:mode==='admin'?adminTarget:memberTarget;"]) assert.ok(worker.includes(token),`Core member 主流程缺少：${token}`);
for(const forbidden of ["const DEFAULT_DOING_SITE_URL = 'https://ndiangrace-create.github.io/DOING/';","mode==='platform'||tenant==='platform'?platformTarget","mode==='admin'||tenant?adminTarget","mode==='platform'||tenant==='platform'?platformSiteUrl(env)"]) assert.ok(!worker.includes(forbidden),`Core 仍存在 tenant 越權／舊站 fallback：${forbidden}`);

for(const token of ['doing_market_member_return','../../market-public.html','member_token','member_login_error'])assert.ok(publicRoute.includes(token),`Market 公開入口缺少登入回跳保護：${token}`);
for(const token of ['doing_market_member_return','handoffToPendingMarket','clearMarketMemberReturn','MARKET_RETURN_MAX_AGE'])assert.ok(home.includes(token),`DOING 根頁缺少 Market member 回跳保護：${token}`);
assert.ok(home.includes("target.origin!==location.origin"),'Market 回跳必須限制同來源，禁止開放式轉址');
assert.ok(home.includes("startMyDoingLineLogin(){clearMarketMemberReturn()")&&home.includes("startRegistrationsLineLogin(){clearMarketMemberReturn()"),'DOING 自己的會員／工作空間登入必須先清除 Market 暫存回跳，避免誤導流');

assert.ok(pub.includes('/doing-market-admin-entry.js'),'Market 前台必須載入安全主辦入口');
for(const token of ['const HOLD_MS=3000',"u.searchParams.set('mode','member')","u.searchParams.set('doing_login_flow',FLOW)","action:'createMemberWorkspaceAdminSession'",'member_token:memberToken','tenantId:targetTenant','if(data.locked)',"new URL('/market/',siteOrigin)","dest.searchParams.set('admin_token',adminToken)"]) assert.ok(adminEntry.includes(token),`LOGO 主辦入口契約缺少：${token}`);
assert.ok(!adminEntry.includes("u.searchParams.set('mode','admin')"),'LOGO 不得直接用 admin mode 繞過會員→staff 權限交換');

for(const token of ["TOKEN=P.get('admin_token')||P.get('token')||''","if(!T||!TOKEN)","請先使用 DOING 登入，再由工作空間進入 Market","api('getSessionsAdmin')"]) assert.ok(admin.includes(token),`主辦後台 Gate 契約缺少：${token}`);
assert.ok(!admin.includes('doing_member_token'),'Market 後台不得把一般報名者 member token 當主辦權限');
assert.ok(!admin.includes("getPlatformMemberProfile"),'Market 後台不得只靠一般會員資料判定主辦權限');

assert.ok(apply.includes('申請 DOING 營運帳號'),'主辦申請入口必須存在');
assert.ok(apply.includes('doing-application-contract-v12.js'),'主辦申請必須沿用 DOING 正式申請契約');
assert.ok(apply.includes('所有資料都在這一頁填完'),'主辦申請必須維持單頁流程');
for(const token of ['state.workspaces','createMemberWorkspaceAdminSession','data-workspace-admin']) assert.ok(member.includes(token),`會員中心主辦工作空間契約缺少：${token}`);
for(const token of ['async function hCreateMemberWorkspaceAdminSession','findStaffForPlatformMember',"if(!staff)return jsonErr('你沒有這個營運空間的管理權限',403)","if(active===false)return jsonErr('這個營運空間的管理權限已停用',403)","status=eq.active&select=id,name,is_locked,locked_reason",'issueAdminToken']) assert.ok(worker.includes(token),`Core 主辦權限交換缺少：${token}`);

console.log(JSON.stringify({result:'PASS',identity:'DOING LINE',publicRole:'participant',publicReturn:'/market/public/ exact primary return',corePrimaryRouting:'mode-only; tenant-context-never-authority',officialDoingSite:'https://doing.2b-love.com/',publicFallbackReturn:'defense-in-depth only',hiddenOrganizerEntry:'public LOGO hold 3s -> LINE member -> Core staff/tenant exchange -> Market admin',organizerRequiresActiveTenant:true,organizerRequiresActiveStaff:true,lockedTenantDeniedAtEntry:true,organizerRole:'approved organizer/staff only',organizerEntry:'single-page application -> auto activation -> workspace/staff -> admin session',participantCannotEnterAdmin:true,memberTokenIsNotAdminToken:true,openRedirectBlocked:true,coreAuthority:'staff/workspace permission',databaseChanges:0,workerChanges:2},null,2));
