import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const worker = read('worker.js');
const admin = read('admin.html');
const platform = read('platform.html');
const about = read('about.html');
const capabilities = JSON.parse(read('doing-capabilities.json'));

assert.match(worker, /freeActivityFee:200,bookingMonthlyFee:688,paidActivityRatePercent:1,noCap:true/);
assert.match(worker, /if\(isPaidOperatingSession\(s\)\)return \{ok:true,mode,chargeMode:'paid_activity_rate'\}/);
assert.match(worker, /if\(isPaidOperatingUnit\(u\)\)return \{ok:true,mode,chargeMode:'paid_activity_rate'\}/);
assert.match(worker, /async function tenantBillingSnapshot/);
assert.match(worker, /case 'reportOperatingPayment': return hReportOperatingPayment/);
assert.match(worker, /confirmReportedOperatingPayment/);
assert.match(admin, /id="tab-billing"/);
assert.match(admin, /id="page-billing"/);
assert.match(admin, /id="tenantBillingRoot"/);
assert.match(admin, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(admin, /系統費總計/);
assert.match(admin, /freeActivityTotal/);
assert.match(admin, /paidActivityTotal/);
assert.match(admin, /bookingTotal/);
assert.ok(!admin.includes('不封頂'), '租戶帳務頁不可顯示平台內部的不封頂規則');
assert.match(worker, /systemFeeTotal=freeActivityTotal\+paidActivityTotal\+bookingTotal/);
assert.match(admin, /overflow-wrap:anywhere/);
assert.match(platform, /id="platformPaymentProfileSection"/);
assert.match(platform, /id="tenantBillingPlatformBox"/);
assert.match(about, /id="publicFreeActivityFee">200</);
assert.ok(capabilities.modules.some(module => module.id === 'platform-billing' && module.features.some(feature => feature.label.includes('NT$200'))));

console.log('租戶系統帳務驗收通過：NT$200、實收 1%、NT$688、付款回報、平台確認與防裁切版面均已登記。');
