import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const home=fs.readFileSync('home-current.html','utf8');
const build=fs.readFileSync('scripts/build-doing-2-site.mjs','utf8');

for(const t of ['市集活動系統','室內設計進度系統','美類預約系統'])assert.ok(home.includes(t),'CURRENT 公開系統缺少 '+t);
for(const t of ['申請市集活動系統','申請室內設計系統','申請美類預約系統'])assert.ok(home.includes(t),'CURRENT 個別申請 CTA 缺少 '+t);
assert.equal((home.match(/class="system-action" href="\/apply\//g)||[]).length,3,'三個公開系統必須各自只有一個 /apply/ CTA');
for(const forbidden of ['一個帳號，多種身分','共用同一資料庫','SSOT','Core','需要什麼再加什麼','手機與電腦同一套','系統亮點'])assert.ok(!home.includes(forbidden),'首頁不得公開內部架構／未定案宣傳：'+forbidden);
assert.ok(build.includes("'/apply/':'apply-current.html'"),'Pages 必須發布 CURRENT /apply/');

execFileSync(process.execPath,['scripts/build-doing-2-site.mjs'],{stdio:'inherit'});
const page=fs.readFileSync('.doing-2-site/apply/index.html','utf8');
assert.ok(!page.includes('data-doing-ui-state="rebuild-shell"'),'正式申請頁不得退回重建殼');
for(const token of ['data-system="market"','data-system="project"','data-system="booking"','createOrganizerApplicationDraft','auth/line/start'])assert.ok(page.includes(token),'正式申請頁功能缺少：'+token);
assert.ok(!page.includes('supabase.co'),'正式申請頁不得直連 Supabase');

console.log(JSON.stringify({result:'PASS',publicSystems:['市集活動系統','室內設計進度系統','美類預約系統'],systemCount:3,individualApplyCtas:3,applyEntry:'/apply/',applyState:'current-live',internalArchitecturePublic:false,productionWrites:0},null,2));
