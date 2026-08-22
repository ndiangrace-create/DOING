import assert from 'node:assert/strict';
import fs from 'node:fs';
const js=fs.readFileSync('doing-member-return-direct.js','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');
for(const token of ["/auth/line/start","mode','member'","/me/","return_url","staff_invite","registration_invite"]) assert.ok(js.includes(token),'missing '+token);
assert.ok(!js.includes("new URL('/',location.origin)"),'會員登入不可再繞首頁');
assert.ok(build.includes("'/me/':'member-panel.html'"),'正式短網址 /me/ 必須承接會員紀錄');
assert.ok(build.includes('doing-member-return-direct.js'),'部署產物必須注入直接回跳修正');
console.log(JSON.stringify({result:'PASS',flow:'/me/ -> LINE -> same /me/ hash',homepageRedirect:false},null,2));
