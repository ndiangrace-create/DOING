import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const homeRouter=read('doing-home-refresh.js');
const homeCore=fs.existsSync(new URL('../doing-home-refresh-core.js',import.meta.url))?read('doing-home-refresh-core.js'):homeRouter;
const files={
  index:read('index.html'),register:read('register.html'),member:read('member-panel.html'),memberCompat:read('member.html'),admin:read('admin.html'),
  platform:read('platform.html'),about:read('about.html'),smartPage:read('smart-application.html'),smart:read('doing-smart-activation.js'),home:homeCore,homeRouter,worker:read('worker.js'),
  schema:read('supabase_login_identity_link.sql'),sources:read('doing-data-sources.json')
};

for(const [name,source] of Object.entries({index:files.index,register:files.register,member:files.member,admin:files.admin,platform:files.platform,home:files.home})){
  assert.match(source,/LINE 登入|LINE 驗證/,`${name} 缺少目前公開的 LINE 入口`);
}
assert.match(files.smartPage+files.smart,/LINE 驗證|organizer_signup/,'智慧申請缺少目前正式 LINE 驗證入口');
assert.match(files.about,/smart-application\.html/,'about 申請相容網址必須導向智慧申請');
assert.ok(files.about.length<5000,'about 已退休，不得再次承載登入或申請完整 UI');
assert.doesNotMatch(files.about,/LINE 登入|LINE 驗證/,'about redirect-only 相容頁不得再次出現第二套 LINE 入口');
assert.match(files.memberCompat,/member-panel\.html/,'member 相容入口未導向內部會員面板');
assert.match(files.memberCompat,/index\.html/,'member 相容入口未回到新版首頁');
assert.doesNotMatch(files.memberCompat,/使用 LINE 登入/,'member 相容入口不得再顯示舊登入 UI');
for(const [name,source] of Object.entries({index:files.index,register:files.register,admin:files.admin,platform:files.platform})){
  assert.match(source,/Google 備援登入/,`${name} 的管理入口缺少 Google 備援登入`);
}
assert.doesNotMatch(files.smartPage,/id="signupGoogleBtn"/,'公開營運申請目前只能顯示 LINE 驗證');
for(const [name,source] of Object.entries({home:files.home})){
  const googleButtons=[...source.matchAll(/<button[^>]*(?:Google|google)[^>]*>/gi)].map(x=>x[0]);
  assert.ok(googleButtons.length,`${name} 應保留 Google 按鈕程式`);
  for(const button of googleButtons)assert.match(button,/hidden/,`${name} 的一般會員／申請 Google 按鈕目前必須隱藏`);
}
if(files.homeRouter!==files.home){
  assert.match(files.homeRouter,/\/auth\/line\/start/,'首頁登入路由缺少 LINE OAuth 起點');
  assert.match(files.homeRouter,/u\.searchParams\.set\('mode','member'\)/,'首頁 LINE OAuth 必須固定使用 member mode');
  assert.match(files.homeRouter,/doing_login_flow/,'首頁 LINE callback 缺少單一路由識別');
  assert.match(files.homeRouter,/handoffToWorkspace/,'首頁 LINE callback 未直接交棒我的 DOING');
  assert.match(files.homeRouter,/createMemberWorkspaceAdminSession/,'首頁登入後未建立正式工作空間 session');
  assert.match(files.homeRouter,/doing-home-refresh-core\.js/,'首頁登入路由未載入完整首頁核心');
}
assert.match(files.worker,/pathname\.endsWith\('\/auth\/line\/start'\)/);
assert.match(files.worker,/pathname\.endsWith\('\/auth\/google\/start'\)/,'Google OAuth 路由不可刪除');
assert.match(files.worker,/const scope=lineEmailEnabled\?'openid profile email':'openid profile'/,'LINE Email 未核准時必須仍可使用固定 provider subject 登入');
assert.doesNotMatch(files.worker,/if\(!verifiedEmail\)return fail\('line_email_permission_required'\)/,'LINE 不得因供應商未提供 Email 而阻斷登入');
assert.match(files.worker,/mergeVerifiedPlatformMembers/,'缺少 LINE／Google 共用會員合併流程');
assert.match(files.worker,/bindLegacyAdminAccessByVerifiedEmails/,'缺少既有主辦與平台管理者的安全補綁流程');
assert.match(files.worker,/verifiedProviderEmailsForMember/,'既有管理權只能使用 LINE／Google 已驗證 Email 補綁');
assert.match(files.worker,/googleEmailVerified/,'Google Email 必須確認為已驗證後才能綁定管理權');
assert.match(files.worker,/createIdentityLink/,'缺少使用者明確登入兩邊帳號的同步流程');
assert.match(files.worker,/identity_resolution_required/,'缺少登入成功、重複建檔暫停的身分處理流程');
assert.match(files.worker,/contact_email:email,phone,phone_normalized:phone/,'手填聯絡資料不可再覆蓋登入服務已驗證 Email');
assert.match(files.worker,/return \{found:emailMatch\|\|phoneMatch,emailMatch,phoneMatch,phoneVerified:false\}/,'Email 或電話任一相同都必須阻擋第二會員建檔');
assert.match(files.worker,/不得再完成第二個會員帳號/,'缺少 Email／電話會員唯一性規則');
assert.match(files.worker,/電話未做 OTP 前也不能拿來冒認原帳號/,'缺少電話只阻擋重複、不可冒認合併的安全規則');
assert.match(files.worker,/contact_email=ilike\.\$\{encodeURIComponent\(normalizedEmail\)\}/,'OAuth 建立會員前未檢查既有聯絡 Email');
assert.match(files.worker,/duplicate\|unique\|23505/,'缺少同時送出時的資料庫唯一衝突處理');
assert.match(files.schema,/create unique index if not exists platform_members_contact_email_unique_idx/,'聯絡 Email 缺少資料庫唯一索引');
assert.match(files.schema,/create unique index if not exists platform_members_phone_normalized_unique_idx/,'電話缺少資料庫唯一索引');
assert.match(files.schema,/create unique index if not exists platform_members_email_normalized_unique_idx/,'登入 Email 缺少不分大小寫唯一索引');
assert.match(files.worker,/status=in\.\(line_verification_pending,google_verification_pending\)/,'Google 保留流程必須能接續目前申請草稿');
assert.match(files.worker,/loginProvider:'google'/,'Google 申請完成後必須連到共用會員');
assert.match(files.worker,/platform_member_id/,'管理權限未連到共用會員編號');
assert.match(files.worker,/roles\.push\('platform_admin'\)/,'共用會員資料未回傳平台總管理者身分');
assert.match(files.worker,/platformAccess:platformStaff/,'會員中心缺少安全綁定後的平台入口資料');
assert.match(files.member,/進入平台總管理者/,'會員功能面板缺少平台總管理者入口');
assert.match(files.member,/需要備援登入時，可同步本人的 Google 帳號/,'會員功能面板未提供 Google 備援同步入口');
assert.match(files.platform,/同步登入帳號/,'平台登入頁缺少安全接回指引');
assert.match(files.worker,/issueStaffInviteToken/,'缺少管理人員簽名邀請');
assert.match(files.worker,/acceptStaffInvite/,'缺少本人 LINE 接受管理邀請流程');
assert.match(files.worker,/只有平台管理者可以設定人員權限/,'缺少平台管理人員設定防線');
assert.match(files.admin,/Email 寄邀請；對方用自己的 LINE 接受後才取得權限/,'租戶管理者新增人員流程未改為邀請接受');
assert.match(files.schema,/alter table public\.staff[\s\S]*platform_member_id/);
assert.match(files.schema,/alter table public\.platform_staff[\s\S]*platform_member_id/);
assert.match(files.schema,/alter table public\.platform_members[\s\S]*contact_email[\s\S]*phone_normalized/);
const catalog=JSON.parse(files.sources);
for(const tableName of ['staff','platform_staff']){
  const table=catalog.tables.find(x=>x.name===tableName);assert.ok(table,`資料來源地圖缺少 ${tableName}`);assert.ok(table.columns.includes('platform_member_id'),`${tableName} 未登記共用會員欄位`);
}
const platformMembers=catalog.tables.find(x=>x.name==='platform_members');assert.ok(platformMembers);for(const column of ['contact_email','phone_normalized'])assert.ok(platformMembers.columns.includes(column),`platform_members 未登記 ${column}`);

console.log(JSON.stringify({result:'PASS',publicLogin:'line',applicationSurface:'smart-application-only',aboutCompat:'redirect_only',memberCompat:'redirect_only',publicLoginRouting:files.homeRouter!==files.home?'single_router_to_workspace':'legacy_inline',managementBackupLogin:'google_visible_after_account_sync',lineEmail:'optional_until_provider_permission_is_enabled',identityAuthority:'provider_subject',accountMerge:'same_verified_provider_email_or_explicit_dual_login',emailPolicy:'unique_member_contact',phonePolicy:'unique_member_contact_without_identity_impersonation',loginPolicy:'oauth_login_allowed_duplicate_formal_write_blocked',adminBinding:'signed_email_invite_then_authenticated_line_accept',legacyAdminBinding:'verified_provider_email_only'},null,2));
