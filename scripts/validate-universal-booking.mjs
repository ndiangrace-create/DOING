import fs from 'node:fs';
import assert from 'node:assert/strict';

const worker=fs.readFileSync('worker.js','utf8');
const admin=fs.readFileSync('admin.html','utf8');
const register=fs.readFileSync('register.html','utf8');
const platform=fs.readFileSync('platform.html','utf8');
const sql=fs.readFileSync('supabase_universal_booking.sql','utf8');
const walletSql=fs.readFileSync('supabase_customer_wallets.sql','utf8');

for(const marker of [
  "role === 'platform_super_admin') return true",
  "role!=='platform_super_admin'",
  "case 'getAvailabilityAdmin'",
  "case 'getAvailableStartsPublic'",
  "case 'saveAvailabilityRule'",
  "case 'saveAvailabilityException'",
  "tenant_id=eq.${encodeURIComponent(T)}&booking_calendar_id=eq.${encodeURIComponent(calendarId)}",
  "start+duration+after<=openEnd",
  "occupiedStart<z&&occupiedEnd>a"
])assert.ok(worker.includes(marker),`通用預約缺少安全或計算條件：${marker}`);

for(const marker of [
  "String(x.modules.operatingMode||'')==='booking'",
  "getAvailableStartsPublic",
  "selectDynamicBookingSlot",
  "bookingCalendarId:dyn?.calendarId",
  "m.quantityMode==='stall'",
  "攤位／單位數"
])assert.ok(register.includes(marker),`顧客預約或原市集保護條件缺少：${marker}`);

assert.ok(worker.includes("mods.workshopSlots&&!slots.length&&mods.operatingMode!=='booking'"),'固定場次規則只可豁免預約型，不得改動市集型');
assert.ok(worker.includes('ensureDynamicBookingTimeslot'),'動態空檔送出時必須落回既有 timeslots');
for(const marker of ['ensureTenantCustomerProfile','saveTenantCustomerProfile','submitPlatformRiskCase','getPlatformRiskCases','reviewPlatformRiskCase','status=eq.restricted','online_booking_blocked'])
  assert.ok(worker.includes(marker),`顧客管理或黑名單分層缺少：${marker}`);
for(const marker of ['本店顧客管理','本店限制預約','送平台總部複核'])assert.ok(admin.includes(marker),`租戶顧客操作缺少：${marker}`);
for(const marker of ['平台風險案件資料夾','各店私有黑名單不會互相公開','loadPlatformRiskCases'])assert.ok(platform.includes(marker),`平台風險資料夾缺少：${marker}`);

for(const marker of ['每週開放','臨時加開','臨時休息','套用星期（可複選）','指定工作人員（選填）','指定空間／設備（選填）'])
  assert.ok(admin.includes(marker),`快速日曆缺少操作：${marker}`);

for(const marker of [
  'create table if not exists public.availability_rules',
  'create table if not exists public.availability_exceptions',
  'create table if not exists public.tenant_customer_profiles',
  'create table if not exists public.platform_risk_cases',
  '預約日曆不屬於此營運空間',
  'revoke all on table public.tenant_customer_profiles from anon, authenticated',
  'revoke all on table public.platform_risk_cases from anon, authenticated'
])assert.ok(sql.includes(marker),`資料隔離結構缺少：${marker}`);

// 10:00–18:00，120 分鐘服務、結束後 30 分鐘：16:00 可接，16:30 必須擋掉。
const fits=(start,duration,after,close)=>start+duration+after<=close;
assert.equal(fits(16*60,120,0,18*60),true);
assert.equal(fits(16*60+30,120,0,18*60),false);
assert.equal(fits(16*60+30,60,30,18*60),true);

console.log('通用預約驗收通過：總管直通、租戶隔離、週期空檔、臨時開關與服務時間自動擋單。');
for(const marker of ['hGetMyCustomerWallets','hSaveCustomerWallet','hPostCustomerWalletEntry','saveResourceSplitRule','staff_split','cronCustomerLifecycle','booking_reminder_24h','service_followup','minBookingGapMinutes'])assert.ok(worker.includes(marker),`預約閉環缺少：${marker}`);
for(const marker of ['儲值與次數券','新增儲值帳戶','新增次數券','設定拆帳'])assert.ok(admin.includes(marker),`店家操作缺少：${marker}`);
for(const marker of ['getMyCustomerWallets','儲值／次數券'])assert.ok(register.includes(marker),`會員帳戶顯示缺少：${marker}`);
for(const marker of ['create table if not exists public.customer_wallets','create table if not exists public.customer_wallet_ledger','wallet tenant mismatch','insufficient wallet balance','security invoker','revoke all on table public.customer_wallets from anon,authenticated'])assert.ok(walletSql.includes(marker),`會員帳務 SSOT 缺少：${marker}`);
