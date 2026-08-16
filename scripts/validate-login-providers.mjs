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
assert.match(files.worker,/status=in\.\(line_verification_pending,google_verification_pending\)/,'Google 保留流程必須能接續目前申請草稿');
assert.match(files.worker,/loginProvider:'google'/,'Google 申請完成後必須連到共用會員');
assert.match(files.worker,/platform_member_id/,'管理權限未連到共用會員編號');
assert.match(files.schema,/alter table public\.staff[\s\S]*platform_member_id/);
assert.match(files.schema,/alter table public\.platform_staff[\s\S]*platform_member_id/);
const catalog=JSON.parse(files.sources);
for(const tableName of ['staff','platform_staff']){
  const table=catalog.tables.find(x=>x.name===tableName);assert.ok(table,`資料來源地圖缺少 ${tableName}`);assert.ok(table.columns.includes('platform_member_id'),`${tableName} 未登記共用會員欄位`);
}

console.log(JSON.stringify({result:'PASS',publicLogin:'line',googleIntegration:'retained_hidden',identityAuthority:'platform_members + platform_member_identities',accountMerge:'verified_email_only',adminBinding:'platform_member_id'},null,2));
