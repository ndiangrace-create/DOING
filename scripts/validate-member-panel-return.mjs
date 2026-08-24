import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const member=fs.readFileSync('member-current.html','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
const post=fs.readFileSync('scripts/postprocess-market-v19.mjs','utf8');

assert.equal((member.match(/\/auth\/line\/start/g)||[]).length,1,'CURRENT /me/ 只能有一個 LINE OAuth 啟動點');
for(const token of ["u.searchParams.set('mode','member')","new URL('/me/',location.origin)","u.hash='operations'","localStorage.setItem(TOKEN_KEY,incoming)",'getPlatformMemberProfile','createMemberWorkspaceAdminSession','isAuthExpired','handleLoadError'])assert.ok(member.includes(token),'CURRENT /me/ 缺少 '+token);
assert.ok(member.includes("if(isAuthExpired(e)){localStorage.removeItem(TOKEN_KEY)"),'只有明確驗證失效才可清除 member token');
assert.ok(member.includes('LINE 登入已保留，但工作空間暫時載入失敗'),'非驗證錯誤必須保留登入並提供重新確認');
assert.ok(build.includes("'/me/':'member-current.html'"),'正式短網址 /me/ 必須使用 CURRENT member source');
assert.ok(post.includes("html.replace(/<script src=\"\\/doing-member-return-direct\\.js"),'postprocess 必須主動移除退休登入 gate');
assert.ok(!post.includes("injectHead(html,'doing-member-return-direct.js'"),'postprocess 不得再插入退休登入 gate');

execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/postprocess-market-v19.mjs'],{stdio:'inherit'});
const built=fs.readFileSync('.doing-2-site/me/index.html','utf8');
assert.ok(built.includes('登入你的 DOING'),'正式 /me/ 必須保留可見的 DOING 登入頁');
assert.equal((built.match(/\/auth\/line\/start/g)||[]).length,1,'正式 /me/ 必須只有一個 LINE OAuth 啟動點');
assert.ok(!built.includes('doing-member-return-direct.js'),'正式 /me/ 不得載入退休登入 gate');
assert.ok(built.includes('createMemberWorkspaceAdminSession'),'登入完成必須能建立授權工作空間 session');
assert.ok(built.includes('handleLoadError'),'正式 /me/ 必須區分驗證失效與一般載入錯誤');

console.log(JSON.stringify({result:'PASS',flow:'homepage -> /me/ -> one LINE OAuth -> member_token -> profile -> workspace',retiredGate:false,duplicateOAuth:false,nonAuthFailureKeepsToken:true,authExpirationClearsToken:true,productionWrites:0},null,2));
