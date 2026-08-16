import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const files={
  index:read('index.html'),register:read('register.html'),member:read('member.html'),admin:read('admin.html'),
  platform:read('platform.html'),about:read('about.html'),home:read('doing-home-refresh.js'),worker:read('worker.js'),
  schema:read('supabase_login_identity_link.sql'),sources:read('doing-data-sources.json')
};

for(const [name,source] of Object.entries({index:files.index,register:files.register,member:files.member,admin:files.admin,platform:files.platform,about:files.about,home:files.home})){
  assert.match(source,/LINE 登入|LINE 驗證/,`${name} 缺少目前公開的 LINE 入口`);
}
for(const [name,source] of Object.entries({index:files.index,register:files.register,platform:files.platform,about:files.about,home:files.home})){
  const googleButtons=[...source.matchAll(/<button[^>]*(?:Google|google)[^>]*>/gi)].map(x=>x[0]);
  assert.ok(googleButtons.length,`${name} 應保留 Google 按鈕程式`);
  for(const button of googleButtons)assert.match(button,/hidden/,`${name} 的 Google 按鈕目前必須隱藏`);
}
assert.match(files.worker,/pathname\.endsWith\('\/auth\/line\/start'\)/);
assert.match(files.worker,/pathname\.endsWith\('\/auth\/google\/start'\)/,'Google OAuth 路由不可刪除');
assert.match(files.worker,/scope='openid profile email'/,'LINE 必須取得驗證 Email 才能安全同步帳號');
assert.match(files.worker,/mergeVerifiedPlatformMembers/,'缺少 LINE／Google 共用會員合併流程');
assert.match(files.worker,/bindLegacyAdminAccessByVerifiedEmails/,'缺少既有主辦與平台管理者的安全補綁流程');
assert.match(files.worker,/verifiedProviderEmailsForMember/,'既有管理權只能使用 LINE／Google 已驗證 Email 補綁');
assert.match(files.worker,/googleEmailVerified/,'Google Email 必須確認為已驗證後才能綁定管理權');
assert.match(files.worker,/createIdentityLink/,'缺少使用者明確登入兩邊帳號的同步流程');
assert.match(files.worker,/identity_resolution_required/,'缺少登入成功、重複建檔暫停的身分處理流程');
assert.match(files.worker,/contact_email:email,phone,phone_normalized:phone/,'手填聯絡資料不可再覆蓋登入服務已驗證 Email');
assert.match(files.worker,/status=in\.\(line_verification_pending,google_verification_pending\)/,'Google 保留流程必須能接續目前申請草稿');
assert.match(files.worker,/loginProvider:'google'/,'Google 申請完成後必須連到共用會員');
assert.match(files.worker,/platform_member_id/,'管理權限未連到共用會員編號');
assert.match(files.schema,/alter table public\.staff[\s\S]*platform_member_id/);
assert.match(files.schema,/alter table public\.platform_staff[\s\S]*platform_member_id/);
assert.match(files.schema,/alter table public\.platform_members[\s\S]*contact_email[\s\S]*phone_normalized/);
const catalog=JSON.parse(files.sources);
for(const tableName of ['staff','platform_staff']){
  const table=catalog.tables.find(x=>x.name===tableName);assert.ok(table,`資料來源地圖缺少 ${tableName}`);assert.ok(table.columns.includes('platform_member_id'),`${tableName} 未登記共用會員欄位`);
}
const platformMembers=catalog.tables.find(x=>x.name==='platform_members');assert.ok(platformMembers);for(const column of ['contact_email','phone_normalized'])assert.ok(platformMembers.columns.includes(column),`platform_members 未登記 ${column}`);

console.log(JSON.stringify({result:'PASS',publicLogin:'line',googleIntegration:'retained_hidden_and_linkable',identityAuthority:'provider_subject',accountMerge:'same_verified_email_or_explicit_dual_login',manualEmailAndPhone:'duplicate_signal_only',loginPolicy:'oauth_login_allowed_duplicate_formal_write_paused',adminBinding:'platform_member_id',legacyAdminBinding:'verified_provider_email_only'},null,2));
