// DOING_MUST_FIX_CLOSURE_20260725：付款回報撤回／主辦全流程取消／不可抗力延期完整資料與金流搬移／SaaS feature gate 保留
// SAAS_TENANT_FEATURE_GATE_20260723：租戶功能旗標後端強制閘門＋前台 bootstrap 回傳
// SEAT_SINGLE_SOURCE_ACTUAL_FIX_20260722：實際移除舊 API、補上 saveSeatMapImage、統一位置分類與資料來源
// MEMBER_FASTPASS_PAYMENT_EQUIP_FIX_20260721：會員免審核狀態回傳＋付款卡片設備自備顯示
// FULL_FLOW_FIX_20260721：會員、選位、場地圖、取消退款、現場與拍照框閉環修復
// SEAT_FLOW_FIX_20260721：前台選位意願／場地圖套用／24h 保留與釋出閉環修復
// FINANCE_MODULE_CONFIRMED_20260707：包含 getPaymentProfiles / savePaymentProfile / disablePaymentProfile / getFinancePaymentGroups
// ================================================================
// DOING｜活動營運管理系統 Cloudflare Worker
// 正式主線檔案：worker.js
// GitHub 正式主線保留 worker.js；另同步產出 worker.txt 供人工下載與部署。
// Cloudflare Workers 請部署 worker.txt／worker.js 的相同內容。
// 更新日期：2026-06-28（版本殘留清理版）
// ================================================================
// 環境變數 (Cloudflare Workers 設定)：
//   SUPABASE_URL  — DOING SaaS Supabase Project URL
//   SUPABASE_SERVICE_ROLE_KEY — Supabase service_role key（SUPABASE_KEY 相容備援）
//   RESEND_KEY    — Resend API key
//   AUTH_SECRET   — token 鹽值（自訂字串，改後管理員需重新登入）
//   OPENAI_API_KEY — OpenAI API 金鑰（AI 主視覺生成模組）
//   OPENAI_IMAGE_MODEL — 可選，預設 gpt-image-1.5
// wrangler.toml cron：
//   [[triggers.crons]]
//   crons = ["0 1 * * *", "0 2 * * *"]
// ================================================================

// ── SECTION 1: 常數設定 ─────────────────────────────────────────
// DEFAULT_TENANT 已移除：主辦空間必須由正式登入／資料關聯解析，不允許預設 fallback
const PAY_DEADLINE_HOURS = 48;
const REMINDER_HOURS    = 36;
const STALL_HOLD_DAYS   = 3;
const SEAT_HOLD_HOURS   = 24; // 加價選位保留 24 小時
const FORCE_CHOICE_HOURS = 48; // 不可抗力選擇期限固定 48 小時

// 不可抗力原因代碼（後台單選清單）
const FORCE_REASON_CODES = {
  typhoon:                    '颱風警報',
  heavy_rain:                 '豪雨／大雨特報',
  earthquake_or_disaster:     '地震或災害安全疑慮',
  gov_work_school_suspension: '政府公告停班停課',
  gov_order_cancel:           '政府／主管機關要求停辦',
  venue_safety_request:       '場地方公共安全要求',
  venue_unavailable:          '場地突發不可使用',
  traffic_disruption:         '交通中斷或重大管制',
  other_force_majeure:        '其他不可抗力因素',
};

// fallback 常數（當 tenants 資料庫欄位為空時使用）
const FALLBACK_SITE_URL   = ''; // SaaS 不綁固定品牌網址；由 tenants.site_url / env 提供
// FALLBACK_LINE_URL 已移除：LINE 連結僅由 tenant_settings/tenants.line_url 提供，缺設定不 fallback
// FALLBACK_BANK_INFO 已移除：付款資訊僅由 tenant 設定提供，缺設定不 fallback
const FALLBACK_EMAIL_FROM = 'DOING｜活動營運管理系統 <no-reply@ndian.live>'; // fallback only；正式寄件資料以 tenants 設定 / env.MAIL_FROM 為準
const FALLBACK_EMAIL_REPLY= 'service@ndian.live'; // fallback only；正式回覆信箱以 tenants 設定 / env.MAIL_REPLY_TO 為準
const FALLBACK_TENANT_NAME= 'DOING｜活動營運管理系統';
const DEFAULT_REFUND_RULES = {
  transferFeeDefault: 0,
  rules: [
    { key:'before_7', label:'活動前 7 日以上：扣行政費 NT$500', minDays:7, adminFeeType:'fixed', adminFee:500 },
    { key:'before_3_6', label:'活動前 3～6 日：退 50%', minDays:3, maxDays:6, adminFeeType:'percent', adminFeePercent:50 },
    { key:'within_3', label:'活動前 3 日內或當日：不退費', minDays:-9999, maxDays:2, adminFeeType:'percent', adminFeePercent:100 }
  ]
};

// ── 付款 API 設定（功能保留、尚未啟用，key 請設定於 Cloudflare Workers 環境變數）──
const ECPAY_MERCHANT_ID = 'YOUR_ECPAY_MERCHANT_ID';
const ECPAY_HASH_KEY    = 'YOUR_ECPAY_HASH_KEY';
const ECPAY_HASH_IV     = 'YOUR_ECPAY_HASH_IV';
const ECPAY_API_URL     = 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

const LINEPAY_CHANNEL_ID = 'YOUR_LINEPAY_CHANNEL_ID';
const LINEPAY_SECRET     = 'YOUR_LINEPAY_SECRET';
const LINEPAY_API_URL    = 'https://api-pay.line.me';
const WORKER_PUBLIC_URL  = ''; // SaaS 不綁舊 Worker；正式網址由 env.WORKER_URL 提供

// ── AI 主視覺生成模組（022）────────────────────────────────────
const AI_VISUAL_BUCKET = 'session-visuals';
const AI_VISUAL_COUNT = 1;
const AI_VISUAL_SIZE = '1024x1024'; // 全部固定 1:1
const AI_VISUAL_DEFAULT_MODEL = 'gpt-image-1.5';
const AI_VISUAL_DEFAULT_QUALITY = 'medium';
const AI_VISUAL_PRESETS = {
  general_event: {
    label: '通用活動',
    rules: 'polished event key visual, clear hierarchy, coherent composition, adaptable to the event information supplied by the tenant, no fixed brand identity, no fixed mascot, no fixed logo, no fixed color palette',
    subject: 'the visual must be derived from the current tenant event title, description, date, location and optional theme note stored in the system',
    avoid: 'no unrelated brand identity, no hard-coded campaign name, no copied legacy event style, no fixed tenant-specific visual language'
  }
};


// ── SECTION 2: 工具函式 ──────────────────────────────────────────

// ── 租戶解析：從 GET params 或 POST body 取得 tenantId ──────────
function getTenantId(p) {
  // p 可能是 URL searchParams 或 POST body
  // 缺少內部主辦識別時回傳 null，不允許 fallback 至任何預設值
  const t = p && (p.tenant || p.tenantId || p.tenant_id);
  if (!t) return null;
  const clean = String(t).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || null;
}

function jwtTenantHint(token) {
  try {
    const parts=String(token||'').split('.');
    if(parts.length<2) return '';
    const raw=parts[1].replace(/-/g,'+').replace(/_/g,'/');
    const json=JSON.parse(atob(raw+'='.repeat((4-raw.length%4)%4)));
    return String(json.tenant_id||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
  } catch(e) { return ''; }
}
function normalizeSiteBase(raw) {
  try {
    const u=new URL(String(raw||'').trim());
    u.hash=''; u.search='';
    let p=u.pathname.replace(/\/+$/,'/');
    if(!p.endsWith('/')) p+='/';
    return (u.origin+p).toLowerCase();
  } catch(e) { return ''; }
}
async function resolveTenantForRequest(env, p, req) {
  const explicit=getTenantId(p);
  if(explicit) return explicit;

  // Admin/staff requests: derive routing hint from JWT, then verifyStaff/adminMe verifies it cryptographically.
  const hinted=jwtTenantHint(p && (p.token||p.admin_token));
  if(hinted && hinted!=='platform') return hinted;

  // Session-specific public links can resolve their tenant without exposing any tenant code.
  const sid=String((p&&(p.sessionId||p.session_id))||'').trim();
  if(sid){
    const rows=await dbGet(env,'sessions',`id=eq.${encodeURIComponent(sid)}&select=tenant_id`).catch(()=>[]);
    if(rows[0]?.tenant_id) return String(rows[0].tenant_id).trim().toLowerCase();
  }

  // Registration-specific public operations can resolve through the registration itself.
  const rid=String((p&&(p.regId||p.reg_id||p.registrationId||p.registration_id))||'').trim();
  if(rid){
    const rows=await dbGet(env,'registrations',`id=eq.${encodeURIComponent(rid)}&select=tenant_id`).catch(()=>[]);
    if(rows[0]?.tenant_id) return String(rows[0].tenant_id).trim().toLowerCase();
  }

  // Public tenant homepage: resolve by the tenant's configured site_url/custom domain.
  const pageHeader=req?.headers?.get('X-DOING-PAGE')||'';
  const referer=req?.headers?.get('Referer')||'';
  const origin=req?.headers?.get('Origin')||'';
  const candidates=[pageHeader,referer,origin].map(normalizeSiteBase).filter(Boolean);
  if(candidates.length){
    const tenants=await dbGet(env,'tenants','status=eq.active&select=id,site_url').catch(()=>[]);
    for(const t of tenants){
      const site=normalizeSiteBase(t.site_url);
      if(site && candidates.some(c=>c.startsWith(site)||site.startsWith(c))) return String(t.id).trim().toLowerCase();
    }
  }
  return '';
}

// ── JWT / Token 安全層（Google OAuth 升級）──────────────────────
// JWT_SECRET 必須來自環境變數，不得有任何預設值
function jwtSecret(env) {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET 環境變數未設定，請於 Cloudflare Workers Secrets 設定');
  return env.JWT_SECRET;
}

// 相容舊 token 格式（過渡期，90 天後可移除）
function authSecret(env) {
  if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET 環境變數未設定');
  return env.AUTH_SECRET;
}
// makeToken 保留供舊路徑相容，新路徑全用 signAdminJwt
function makeToken(email, tenantId, env) {
  return md5(email + tenantId + authSecret(env));
}

// ── HS256 JWT 實作（Web Crypto API）──
async function signAdminJwt(payload, env) {
  const secret = jwtSecret(env);
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey('raw', keyData, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const header = btoa(JSON.stringify({ alg:'HS256', typ:'JWT' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const body = btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return `${header}.${body}.${sigB64}`;
}

async function verifyAdminJwt(token, env) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const secret = jwtSecret(env);
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, { name:'HMAC', hash:'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    let _raw = atob(parts[1].replace(/-/g,'+').replace(/_/g,'/'));
    let _str; try { _str = decodeURIComponent(escape(_raw)); } catch(e) { _str = _raw; }
    const payload = JSON.parse(_str);
    if (payload.expires_at && Date.now() > payload.expires_at) return null; // 已過期
    return payload;
  } catch(e) { return null; }
}

// 簽發後台 admin JWT（30 天有效）
async function issueAdminToken(staffRow, tenantId, env) {
  const now = Date.now();
  const payload = {
    iss: 'DOING',
    sub: staffRow.id || staffRow.email,
    email: staffRow.email,
    tenant_id: tenantId,
    staff_id: staffRow.id || '',
    role: staffRow.role || 'organizer_admin',
    normalized_role: staffRow.normalized_role || staffRow.role || '',
    limit_sessions: staffRow.limit_sessions || '',
    display_name: (staffRow.name || staffRow.display_name || '').replace(/[^\x00-\x7F]/g, ''),
    issued_at: now,
    expires_at: now + 30 * 24 * 60 * 60 * 1000,  // 30 天
  };
  return signAdminJwt(payload, env);
}

// 免輸入主辦識別登入：多工作空間選擇用短效 JWT（10 分鐘）
async function issueWorkspaceSelectionToken(email, tenantIds, env, extra = {}) {
  const now = Date.now();
  return signAdminJwt({
    iss: 'DOING',
    type: 'workspace_selection',
    sub: email,
    email,
    provider: String(extra.provider || ''),
    platform_member_id: String(extra.platform_member_id || ''),
    tenant_ids: Array.from(new Set((tenantIds || []).filter(Boolean))),
    issued_at: now,
    expires_at: now + 10 * 60 * 1000,
  }, env);
}

async function verifyWorkspaceSelectionToken(token, env) {
  const payload = await verifyAdminJwt(token, env);
  if (!payload || payload.type !== 'workspace_selection' || (!payload.email && !payload.platform_member_id) || !Array.isArray(payload.tenant_ids)) return null;
  return payload;
}

// 簽發前台會員 JWT（30 天有效）
async function issueMemberToken(memberInfo, env) {
  const now = Date.now();
  const payload = {
    iss: 'DOING',
    type: 'member',
    sub: memberInfo.provider_subject || memberInfo.google_sub || memberInfo.email,
    email: memberInfo.email,
    provider: memberInfo.provider || '',
    provider_subject: memberInfo.provider_subject || memberInfo.google_sub || '',
    google_sub: memberInfo.google_sub || '',
    display_name: (memberInfo.display_name || '').replace(/[^\x00-\x7F]/g, ''),
    avatar_url: memberInfo.avatar_url || '',
    issued_at: now,
    expires_at: now + 30 * 24 * 60 * 60 * 1000,  // 30 天
  };
  return signAdminJwt(payload, env);
}

// 檢查 tenant 是否被鎖定
async function checkTenantLocked(env, tenantId) {
  try {
    const rows = await dbGet(env, 'tenants', `id=eq.${tenantId}&select=is_locked,locked_reason,plan_type,trial_end_at`);
    const t = rows[0];
    if (!t) return { locked: false };
    if (t.is_locked) return { locked: true, reason: t.locked_reason || '帳號已鎖定' };
    // DOING：帳號／設定／預覽本身不因舊 trial_end_at 自動鎖定；正式營運權另由發布／預約 entitlement 判斷。
    return { locked: false };
  } catch(e) { return { locked: false }; }
}

// 驗證 admin token（優先 JWT，回退舊 makeToken 格式相容）
async function verifyAdminToken(token, email, tenantId, env) {
  if (!token || !email) return null;
  // 新格式：JWT
  if (token.includes('.')) {
    const payload = await verifyAdminJwt(token, env);
    if (!payload) return null;
    if (payload.email !== email) return null;
    // platform_super_admin 不受 tenant 限制
    if (payload.normalized_role === 'platform_super_admin' || payload.role === 'platform_super_admin') return payload;
    if (payload.tenant_id !== tenantId) return null;
    return payload;
  }
  // 舊格式相容（過渡期）：重新查 DB 驗證
  const expected = makeToken(email, tenantId, env);
  const expectedPlatform = makeToken(email, 'platform', env);
  if (token !== expected && token !== expectedPlatform) return null;
  return { email, tenant_id: tenantId, role: '', legacy: true };
}

function genId(prefix) {
  // 報名表 ID 縮短且可依時間排序（自行編排、不過長）；其餘 ID 維持原樣
  if (prefix === 'REG') {
    return 'R' + Date.now().toString(36).toUpperCase() + crypto.randomUUID().replace(/-/g,'').slice(0,6).toUpperCase();
  }
  // H-04：改用 crypto.randomUUID，移除 4 碼尾碼碰撞風險
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}
function secureRandomInt(min,max){
  const lo=Math.ceil(Number(min)),hi=Math.floor(Number(max));
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<lo)throw new Error('亂數範圍不正確');
  const range=hi-lo+1,limit=Math.floor(0x100000000/range)*range,buf=new Uint32Array(1);
  do{crypto.getRandomValues(buf)}while(buf[0]>=limit);
  return lo+(buf[0]%range);
}
function isPaidStatus(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  if (['已繳費','已付款','付款完成','付款成功','paid','confirmed_paid','payment_confirmed'].includes(s)) return true;
  if (s.includes('已繳費') || s.includes('已付款')) return true;
  return false;
}
function isBookingSecuredStatus(v){const s=String(v||'').trim();return isPaidStatus(s)||s==='已付訂金'||s==='deposit_paid'}
function safeNum(v) {
  const n = Number(v);
  return isNaN(n) || n < 0 ? 0 : n;
}
function isCapacityInactiveTransferStatus(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  if (['已延期','transferred','申請退費','退費中','退費待處理','退款待處理','已退費','已退款','refund_pending','refunded'].includes(s)) return true;
  return s.includes('退費') || s.includes('退款') || s.includes('refund');
}
function isCapacityInactiveReviewStatus(v) {
  return ['已取消','不錄取','未錄取'].includes(String(v || ''));
}
function isActiveForCapacity(reg) {
  if (!reg) return false;
  if (isCapacityInactiveReviewStatus(reg.review_status)) return false;
  if (isCapacityInactiveTransferStatus(reg.transfer_status)) return false;
  return true;
}
// M-01：adjustSessionCurrentCount 改用原子 RPC（防並發）
// delta > 0 = claim（報名），delta < 0 = release（取消/退費）
async function adjustSessionCurrentCount(env, tenantId, sessionId, delta) {
  if (!sessionId || !delta) return;
  if (delta > 0) {
    await dbRpc(env, 'claim_session_slot', { p_tenant_id: tenantId, p_session_id: sessionId, p_stall_count: delta });
  } else {
    await dbRpc(env, 'release_session_slot', { p_tenant_id: tenantId, p_session_id: sessionId, p_stall_count: Math.abs(delta) });
  }
}
async function adjustRegistrationCapacity(env, tenantId, reg, delta) {
  if (!reg || !delta) return;
  const qty=Math.abs(delta);
  const uid=String(reg.operation_unit_id||'').trim();
  if(uid){
    if(delta>0) await dbRpc(env,'claim_operation_unit_capacity',{p_tenant_id:tenantId,p_operation_unit_id:uid,p_qty:qty});
    else await dbRpc(env,'release_operation_unit_capacity',{p_tenant_id:tenantId,p_operation_unit_id:uid,p_qty:qty});
    return;
  }
  await adjustSessionCurrentCount(env,tenantId,reg.session_id,delta);
}
async function writeAuditLog(env, tenantId, actorEmail, actorRole, action, targetTable, targetId, beforeJson, afterJson, metaJson) {
  try {
    await dbInsert(env, 'audit_logs', {
      id: genId('AUD'),
      tenant_id: tenantId,
      actor_email: actorEmail || '',
      actor_role: actorRole || '',
      action,
      target_table: targetTable || '',
      target_id: targetId || '',
      before_json: beforeJson || {},
      after_json: afterJson || {},
      meta_json: metaJson || {},
      created_at: nowIso(),
    });
  } catch(e) {
    console.error('audit log skipped', e && e.message ? e.message : e); logError(env, {source:'writeAuditLog', message:'audit log skipped', error:e && e.message ? e.message : e});
  }
}
function safeJson(str, fallback) {
  if (str === null || str === undefined) return fallback;
  if (typeof str !== 'string') return str;  // 已是 object/array，直接回傳
  if (!str.trim()) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}
function agreementRequiredOn(v) {
  return !(v === false || v === 'false' || v === 0 || v === '0' || String(v || '').toLowerCase() === 'no' || String(v || '').toLowerCase() === 'off');
}
function getDisplayName(name, brand) { return brand || name || '您'; }
function nowIso() { return new Date().toISOString(); }
function nowTaipeiText() { return new Date().toLocaleString('zh-TW', {timeZone:'Asia/Taipei', hour12:false}); }

// 不可抗力三層對象分類（由後端 DB 狀態決定，前台不自行判斷）
// 第一層：已錄取＋已付款 or 已錄取＋付款待確認 → 可選延期或退費
// 第二層：已錄取未付款 or 待審核 → 只通知，不給選擇
// 第三層：已取消 / 不錄取 / 已退費 / 無有效報名 → 不進入流程
function classifyForceLayer(reg) {
  const rs = String(reg.review_status || '');
  const ps = String(reg.payment_status || '');
  const ts = String(reg.transfer_status || '');
  // 第三層
  if (['已取消'].includes(rs)) return 3;
  if (['不錄取', '未錄取'].includes(rs)) return 3;
  if (['已退費', 'refunded'].includes(ts)) return 3;
  // 第一層
  if (rs === '已錄取' && (isPaidStatus(ps) || ps === '待確認')) return 1;
  // 第二層
  if (rs === '已錄取' || rs === '待審核') return 2;
  return 3;
}
function cleanEventId(v) {
  const s = String(v ?? '').trim();
  if (!s || s === '0' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
  return s;
}

// ── SECTION 3: MD5（Token 驗證）────────────────────────────────
function md5(inputStr) {
  function safeAdd(x, y) {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xFFFF);
  }
  const rol = (n, c) => (n << c) | (n >>> (32 - c));
  const F = (a,b,c,d,x,s,t) => safeAdd(rol(safeAdd(safeAdd(a,(b&c)|(~b&d)),safeAdd(x,t)),s),b);
  const G = (a,b,c,d,x,s,t) => safeAdd(rol(safeAdd(safeAdd(a,(b&d)|(c&~d)),safeAdd(x,t)),s),b);
  const H = (a,b,c,d,x,s,t) => safeAdd(rol(safeAdd(safeAdd(a,b^c^d),safeAdd(x,t)),s),b);
  const I = (a,b,c,d,x,s,t) => safeAdd(rol(safeAdd(safeAdd(a,c^(b|~d)),safeAdd(x,t)),s),b);
  const bytes = new TextEncoder().encode(inputStr);
  const len = bytes.length;
  const nWords = ((len + 72) >> 6) << 4;
  const w = new Int32Array(nWords);
  for (let j = 0; j < len; j++) w[j >> 2] |= bytes[j] << ((j & 3) << 3);
  w[len >> 2] |= 0x80 << ((len & 3) << 3);
  w[nWords - 2] = len * 8;
  let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
  for (let j = 0; j < nWords; j += 16) {
    const [A,B,C,D] = [a,b,c,d];
    a=F(a,b,c,d,w[j+0],7,-680876936);   d=F(d,a,b,c,w[j+1],12,-389564586);
    c=F(c,d,a,b,w[j+2],17,606105819);   b=F(b,c,d,a,w[j+3],22,-1044525330);
    a=F(a,b,c,d,w[j+4],7,-176418897);   d=F(d,a,b,c,w[j+5],12,1200080426);
    c=F(c,d,a,b,w[j+6],17,-1473231341); b=F(b,c,d,a,w[j+7],22,-45705983);
    a=F(a,b,c,d,w[j+8],7,1770035416);   d=F(d,a,b,c,w[j+9],12,-1958414417);
    c=F(c,d,a,b,w[j+10],17,-42063);     b=F(b,c,d,a,w[j+11],22,-1990404162);
    a=F(a,b,c,d,w[j+12],7,1804603682);  d=F(d,a,b,c,w[j+13],12,-40341101);
    c=F(c,d,a,b,w[j+14],17,-1502002290);b=F(b,c,d,a,w[j+15],22,1236535329);
    a=G(a,b,c,d,w[j+1],5,-165796510);   d=G(d,a,b,c,w[j+6],9,-1069501632);
    c=G(c,d,a,b,w[j+11],14,643717713);  b=G(b,c,d,a,w[j+0],20,-373897302);
    a=G(a,b,c,d,w[j+5],5,-701558691);   d=G(d,a,b,c,w[j+10],9,38016083);
    c=G(c,d,a,b,w[j+15],14,-660478335); b=G(b,c,d,a,w[j+4],20,-405537848);
    a=G(a,b,c,d,w[j+9],5,568446438);    d=G(d,a,b,c,w[j+14],9,-1019803690);
    c=G(c,d,a,b,w[j+3],14,-187363961);  b=G(b,c,d,a,w[j+8],20,1163531501);
    a=G(a,b,c,d,w[j+13],5,-1444681467); d=G(d,a,b,c,w[j+2],9,-51403784);
    c=G(c,d,a,b,w[j+7],14,1735328473);  b=G(b,c,d,a,w[j+12],20,-1926607734);
    a=H(a,b,c,d,w[j+5],4,-378558);      d=H(d,a,b,c,w[j+8],11,-2022574463);
    c=H(c,d,a,b,w[j+11],16,1839030562); b=H(b,c,d,a,w[j+14],23,-35309556);
    a=H(a,b,c,d,w[j+1],4,-1530992060);  d=H(d,a,b,c,w[j+4],11,1272893353);
    c=H(c,d,a,b,w[j+7],16,-155497632);  b=H(b,c,d,a,w[j+10],23,-1094730640);
    a=H(a,b,c,d,w[j+13],4,681279174);   d=H(d,a,b,c,w[j+0],11,-358537222);
    c=H(c,d,a,b,w[j+3],16,-722521979);  b=H(b,c,d,a,w[j+6],23,76029189);
    a=H(a,b,c,d,w[j+9],4,-640364487);   d=H(d,a,b,c,w[j+12],11,-421815835);
    c=H(c,d,a,b,w[j+15],16,530742520);  b=H(b,c,d,a,w[j+2],23,-995338651);
    a=I(a,b,c,d,w[j+0],6,-198630844);   d=I(d,a,b,c,w[j+7],10,1126891415);
    c=I(c,d,a,b,w[j+14],15,-1416354905);b=I(b,c,d,a,w[j+5],21,-57434055);
    a=I(a,b,c,d,w[j+12],6,1700485571);  d=I(d,a,b,c,w[j+3],10,-1894986606);
    c=I(c,d,a,b,w[j+10],15,-1051523);   b=I(b,c,d,a,w[j+1],21,-2054922799);
    a=I(a,b,c,d,w[j+8],6,1873313359);   d=I(d,a,b,c,w[j+15],10,-30611744);
    c=I(c,d,a,b,w[j+6],15,-1560198380); b=I(b,c,d,a,w[j+13],21,1309151649);
    a=I(a,b,c,d,w[j+4],6,-145523070);   d=I(d,a,b,c,w[j+11],10,-1120210379);
    c=I(c,d,a,b,w[j+2],15,718787259);   b=I(b,c,d,a,w[j+9],21,-343485551);
    a=safeAdd(a,A); b=safeAdd(b,B); c=safeAdd(c,C); d=safeAdd(d,D);
  }
  const w2h = n => [(n)&0xFF,(n>>8)&0xFF,(n>>16)&0xFF,(n>>24)&0xFF]
    .map(x => ('0'+x.toString(16)).slice(-2)).join('');
  return w2h(a)+w2h(b)+w2h(c)+w2h(d);
}

// ── SECTION 4: 加密工具（ECPay / LINE Pay）──────────────────────
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
}
async function hmacSha256Base64(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ── SECTION 5: CORS / Response ──────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}
const jsonOk  = data => new Response(JSON.stringify(data), {status:200, headers:corsHeaders()});
const jsonErr = msg  => new Response(JSON.stringify({error:msg}), {status:200, headers:corsHeaders()});

// ── SECTION 6: Supabase 查詢工具 ────────────────────────────────
function supabaseServiceRoleKey(env) {
  return env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
}
function sbHdr(env) {
  const key = supabaseServiceRoleKey(env);
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}
async function dbGetOnce(env, table, qs) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${qs?'?'+qs:''}`, {headers:sbHdr(env), cache:'no-store'});
  if (!res.ok) throw new Error(`DB GET ${table}: ${await res.text()}`);
  return res.json();
}
// 大量資料防截斷：Supabase 單次上限 1000 筆。呼叫端未自訂 limit 時，
// 一旦命中 1000 筆代表可能被截斷，改用穩定排序(order=id.asc，或沿用既有 order)
// 以 offset 逐頁抓齊全部，避免統計/加總/匯出算錯。有自訂 limit 者照舊單次抓。
async function dbGet(env, table, qs) {
  const PAGE = 1000;
  const q = qs || '';
  const first = await dbGetOnce(env, table, q);
  if (!Array.isArray(first) || first.length < PAGE || /(^|&)limit=/.test(q)) return first;
  const hasOrder = /(^|&)order=/.test(q);
  const baseQs = hasOrder ? q : (q ? q + '&order=id.asc' : 'order=id.asc');
  let all = []; let offset = 0;
  while (true) {
    const pageQs = `${baseQs}&limit=${PAGE}&offset=${offset}`;
    let page;
    try {
      page = await dbGetOnce(env, table, pageQs);
    } catch (e) {
      // 極少數無 id 欄位的表，加 order=id 會失敗 → 退回不加排序的 offset 翻頁
      if (!hasOrder) { page = await dbGetOnce(env, table, `${q?q+'&':''}limit=${PAGE}&offset=${offset}`); }
      else throw e;
    }
    if (!Array.isArray(page)) break;
    all = all.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
    if (offset > 500000) { logError(env,{source:'dbGet',message:'pagination safety cap hit',error:`${table} ${q}`}); break; }
  }
  return all;
}
async function dbInsert(env, table, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method:'POST', body:JSON.stringify(data),
    headers:{...sbHdr(env),'Prefer':'return=representation'}, cache:'no-store',
  });
  if (!res.ok) throw new Error(`DB INSERT ${table}: ${await res.text()}`);
  const r = await res.json();
  return Array.isArray(r) ? r[0] : r;
}
async function dbUpsert(env, table, data, onConflict) {
  const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${qs}`, {
    method:'POST', body:JSON.stringify(data),
    headers:{...sbHdr(env),'Prefer':'resolution=merge-duplicates,return=representation'}, cache:'no-store',
  });
  if (!res.ok) throw new Error(`DB UPSERT ${table}: ${await res.text()}`);
  const r = await res.json().catch(()=>[]);
  return Array.isArray(r) ? r[0] : r;
}
async function dbUpdate(env, table, qs, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method:'PATCH', body:JSON.stringify(data), headers:sbHdr(env), cache:'no-store',
  });
  if (!res.ok) throw new Error(`DB UPDATE ${table}: ${await res.text()}`);
  return true;
}
async function dbUpdateReturning(env, table, qs, data) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method:'PATCH', body:JSON.stringify(data),
    headers:{...sbHdr(env),'Prefer':'return=representation'}, cache:'no-store',
  });
  if (!res.ok) throw new Error(`DB UPDATE ${table}: ${await res.text()}`);
  const r = await res.json().catch(()=>[]);
  return Array.isArray(r) ? r : [];
}
async function dbDelete(env, table, qs) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method:'DELETE', headers:sbHdr(env), cache:'no-store',
  });
  if (!res.ok) throw new Error(`DB DELETE ${table}: ${await res.text()}`);
  return true;
}

// M-01：RPC 呼叫（用於原子名額操作）
async function dbRpc(env, fnName, params) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method:'POST',
    body: JSON.stringify(params),
    headers: {...sbHdr(env), 'Content-Type':'application/json'},
    cache: 'no-store',
  });
  if (!res.ok) {
    const errText = await res.text().catch(()=>'');
    throw new Error(`DB RPC ${fnName}: ${errText}`);
  }
  return res.json();
}

// ── SECTION 6.4: 系統異常紀錄 ───────────────────────────────────
// 全部錯誤都寫進 error_logs，後台「系統異常」頁看得到。
// 三個鐵則：
//   1. 記錄失敗絕不可以反過來害到主流程 —— 所以整段包 try/catch，永不 throw。
//   2. 不記密碼、token、金鑰 —— 出事的紀錄不能變成新的外洩來源。
//   3. 記下「哪一筆、哪個功能、什麼錯誤」，光寫「異常」等於沒寫。
const LOG_REDACT_KEYS = ['token','password','pwd','secret','key','apikey','api_key','authorization','passcode','session_token'];
function redactForLog(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (LOG_REDACT_KEYS.some(bad => String(k).toLowerCase().includes(bad))) continue;
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') { out[k] = '[object]'; continue; }
    out[k] = String(v).slice(0, 300);
  }
  return out;
}
async function logError(env, opts) {
  try {
    const o = opts || {};
    const err = o.error;
    const msg = err ? (err.message || String(err)) : String(o.message || '');
    await dbInsert(env, 'error_logs', {
      tenant_id:  String(o.tenantId || ''),
      level:      o.level || 'error',
      source:     String(o.source || ''),
      action:     String(o.action || ''),
      reg_id:     String(o.regId || ''),
      session_id: String(o.sessionId || ''),
      email:      String(o.email || ''),
      message:    msg.slice(0, 2000),
      detail:     redactForLog(o.detail),
      created_at: nowIso(),
    });
  } catch (e) {
    // 寫紀錄本身失敗就只能吞掉 —— 但至少留在 console，不能讓它拖垮使用者的請求。
    console.error('logError failed:', e && e.message ? e.message : e);
  }
}

// 後台：讀系統異常紀錄
async function hGetErrorLogs(env, p) {
  const TENANT = p._tenantId;
  if (!await verifyStaff(env, p.email, p.token, TENANT, 'superadmin')) return jsonErr('無權限');
  const limit = Math.min(Math.max(parseInt(p.limit, 10) || 100, 1), 500);
  let q = `order=created_at.desc&limit=${limit}&select=*`;
  // 平台層級的錯誤可能還沒解析出 tenant（tenant_id 為空），超管要看得到，所以一併撈。
  q += `&or=(tenant_id.eq.${TENANT},tenant_id.eq.)`;
  if (p.level) q += `&level=eq.${encodeURIComponent(p.level)}`;
  if (p.regId) q += `&registration_id=eq.${encodeURIComponent(p.regId)}`;
  const rows = await dbGet(env, 'error_logs', q).catch(()=>[]);
  return jsonOk(rows.map(r => ({
    id: r.id, level: r.level || 'error', source: r.source || '', action: r.action || '',
    regId: r.reg_id || '', sessionId: r.session_id || '', email: r.email || '',
    message: r.message || '', detail: r.detail || {}, createdAt: r.created_at || '',
  })));
}
// 後台：清除舊的異常紀錄（全部都記 → 量會很大，要能清）
async function hPurgeErrorLogs(env, b) {
  const TENANT = b._tenantId;
  if (!await verifyStaff(env, b.email, b.token, TENANT, 'superadmin')) return jsonErr('無權限');
  const days = Math.min(Math.max(parseInt(b.days, 10) || 30, 1), 365);
  const res = await dbRpc(env, 'purge_error_logs', {p_days: days});
  return jsonOk(res || {ok:true});
}

// ── SECTION 6.5: 短網址 ─────────────────────────────────────────
// 租戶分享用。/s/<code> 由各租戶設定的公開網域導入本 Worker。
// 去掉容易看錯的 l / o / 0 / 1，避免攤友手抄短碼時輸錯。
const SHORT_CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const SHORT_CODE_LEN = 6;
function genShortCode() {
  const arr = new Uint32Array(SHORT_CODE_LEN);
  crypto.getRandomValues(arr);
  let s = '';
  for (let i=0; i<SHORT_CODE_LEN; i++) s += SHORT_CODE_ALPHABET[arr[i] % SHORT_CODE_ALPHABET.length];
  return s;
}
// 短網址一律掛在該租戶自己的站台根目錄底下。
function shortLinkUrl(siteUrl, code) {
  if (!siteUrl) throw new Error('TENANT_SITE_URL_REQUIRED');
  return new URL('/s/' + code, siteUrl).toString();
}
// 轉址目標＝場次報名頁。格式與前台 shareUrl() 一致，改一邊要記得改另一邊。
function sessionShareUrl(siteUrl, sessionId) {
  if (!siteUrl) throw new Error('TENANT_SITE_URL_REQUIRED');
  const u = new URL(siteUrl);
  u.pathname = '/';
  u.search = 'page=session&ses=' + encodeURIComponent(sessionId);
  return u.toString();
}
function shortLinkErrorPage(msg, status) {
  const html = '<!doctype html><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>連結無效</title>'
    + '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#F8F6F0;'
    + 'font-family:-apple-system,BlinkMacSystemFont,\'Noto Sans TC\',sans-serif;color:#111111">'
    + '<div style="text-align:center;padding:24px;line-height:1.8">'
    + '<div style="font-size:20px;font-weight:900;margin-bottom:12px">' + msg + '</div>'
    + '<div style="font-weight:700;color:#666666">請回到主辦提供的活動頁面</div>'
    + '</div></body>';
  return new Response(html, {status: status, headers: {'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}});
}
async function hShortRedirect(env, code) {
  let rows;
  try {
    rows = await dbRpc(env, 'short_link_hit', {p_code: code});
  } catch(e) {
    // 不吞錯誤：資料庫掛掉就明講，不要假裝連結壞掉。
    console.error('short_link_hit failed:', e && e.message); logError(env, {source:'hShortRedirect', message:'short_link_hit failed:', error:e && e.message});
    return shortLinkErrorPage('短網址服務暫時異常，請稍後再試。', 500);
  }
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || !row.session_id) return shortLinkErrorPage('這個短網址不存在或已失效。', 404);
  const ctx = await getTenantCtx(env, row.tenant_id).catch(()=>null);
  return Response.redirect(sessionShareUrl(ctx && ctx.siteUrl, row.session_id), 302);
}
// 取得或建立場次短網址。後台與前台共用同一份（一個場次永遠只有一組短網址）。
async function ensureShortLinkForSession(env, TENANT, sessionId) {
  const sid = String(sessionId || '').trim();
  if (!sid) return {error:'缺少場次'};
  const ses = await dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(sid)}&select=id`);
  if (!ses.length) return {error:'找不到這個場次'};
  const ctx = await getTenantCtx(env, TENANT);

  const exist = await dbGet(env, 'short_links', `tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sid)}&select=code,clicks`);
  if (exist.length) {
    return {sessionId:sid, code:exist[0].code, clicks:Number(exist[0].clicks)||0,
            url:shortLinkUrl(ctx && ctx.siteUrl, exist[0].code), created:false};
  }
  let row = null, lastErr = '';
  for (let i=0; i<6 && !row; i++) {
    const code = genShortCode();
    try {
      row = await dbInsert(env, 'short_links', {tenant_id:TENANT, session_id:sid, code});
    } catch(e) {
      lastErr = (e && e.message) ? e.message : String(e);
      if (!/duplicate|unique|23505/i.test(lastErr)) throw e;
      const again = await dbGet(env, 'short_links', `tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sid)}&select=code,clicks`);
      if (again.length) {
        return {sessionId:sid, code:again[0].code, clicks:Number(again[0].clicks)||0,
                url:shortLinkUrl(ctx && ctx.siteUrl, again[0].code), created:false};
      }
    }
  }
  if (!row) return {error:'短碼產生失敗，請再試一次：' + lastErr};
  return {sessionId:sid, code:row.code, clicks:0,
          url:shortLinkUrl(ctx && ctx.siteUrl, row.code), created:true};
}

// 後台：為場次產生短網址（含點擊數）
async function hCreateShortLink(env, b) {
  const TENANT = b._tenantId;
  if (!await verifyStaff(env, b.email, b.token, TENANT, 'sessions')) return jsonErr('無權限');
  const r = await ensureShortLinkForSession(env, TENANT, b.sessionId);
  return r.error ? jsonErr(r.error) : jsonOk(r);
}

// 前台（公開）：攤友分享場次用。只能「取得某場次的短網址」，不回傳點擊數。
async function hGetSessionShortLink(env, p) {
  const TENANT = p._tenantId;
  const r = await ensureShortLinkForSession(env, TENANT, p.sessionId);
  if (r.error) return jsonErr(r.error);
  return jsonOk({sessionId:r.sessionId, code:r.code, url:r.url});
}

// ── SECTION 7: 管理員驗證 ───────────────────────────────────────
// AI 高成本功能專用：只允許真正的平台超級管理員，不能用 organizer_owner 或一般 superadmin 權限代替。
async function verifyPlatformSuperAdmin(env, email, token, tenantId) {
  if (!email || !token || !tenantId) return false;
  const payload = await verifyAdminToken(token, email, tenantId, env);
  if (!payload) return false;
  const role = String(payload.normalized_role || payload.role || '').trim();
  if (role === 'platform_super_admin') return true;
  if (payload.legacy) {
    const rows = await dbGet(env, 'platform_staff', `email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=role,normalized_role`).catch(()=>[]);
    const dbRole = String((rows[0] && (rows[0].normalized_role || rows[0].role)) || '').trim();
    return dbRole === 'platform_super_admin';
  }
  return false;
}

async function verifyStaff(env, email, token, tenantId, requiredRole='', sessionId='') {
  if (!email || !token) return false;
  const tid = (typeof tenantId === 'string' && tenantId) ? tenantId : null;
  if (!tid) return false;

  // 驗證 token（JWT 或舊格式）
  const jwtPayload = await verifyAdminToken(token, email, tid, env);
  if (!jwtPayload) return false;

  const role = jwtPayload.normalized_role || jwtPayload.role || '';
  const limitSessions = jwtPayload.limit_sessions || '';

  // platform_super_admin 直通（跨 tenant）
  if (role === 'platform_super_admin') return true;

  // tenant 隔離：token 內的 tenant_id 才是準的，前端傳來的不可信
  if (jwtPayload.tenant_id !== tid && !jwtPayload.legacy) return false;

  // 舊格式回退：查 DB 確認
  if (jwtPayload.legacy) {
    const platformRows = await dbGet(env, 'platform_staff', `email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=*`).catch(()=>[]);
    if (platformRows[0]?.role === 'platform_super_admin') return true;
    const rows = await dbGet(env, 'staff', `tenant_id=eq.${tid}&email=eq.${encodeURIComponent(email)}&select=*`);
    const staff = rows[0];
    if (!staff) return false;
    const staffActive = staff.is_active !== undefined ? staff.is_active : staff.active;
    if (staffActive === false) return false;
    const staffRole = staff.normalized_role || staff.role || '';
    if (staffRole === 'organizer_owner' || staffRole === 'platform_super_admin') return true;
    if (requiredRole === 'superadmin') return false;
    if (requiredRole) {
      const perms = safeJson(staff.perms_json, {});
      if (!perms[requiredRole]) return false;
    }
    const ls = staff.limit_sessions || '';
    if (sessionId && ls) {
      const allowed = String(ls).split(',').map(s=>s.trim()).filter(Boolean);
      if (allowed.length && !allowed.includes(sessionId)) return false;
    }
    return true;
  }

  // JWT 格式：從 payload 取角色
  const normalizedRole = role;
  const ownerRoles = ['organizer_owner', 'platform_super_admin', 'organizer_admin'];

  if (requiredRole === 'superadmin') {
    return normalizedRole === 'organizer_owner' || normalizedRole === 'platform_super_admin';
  }

  if (requiredRole === 'finance') {
    const allowed = ['organizer_owner','platform_super_admin','organizer_admin','finance_admin'];
    return allowed.includes(normalizedRole);
  }

  if (requiredRole === 'checkin') {
    const allowed = ['organizer_owner','platform_super_admin','organizer_admin','session_admin','onsite_staff'];
    if (!allowed.includes(normalizedRole)) return false;
    // 不可在此直接 return。現場人員 / 場次管理員還必須繼續往下檢查 session 授權，
    // 避免改 URL 或直接打 API 就讀到未授權場次。
  }

  if (requiredRole === 'review' || requiredRole === 'sessions' || requiredRole === 'events') {
    const allowed = ['organizer_owner','platform_super_admin','organizer_admin','session_admin','finance_admin'];
    return allowed.includes(normalizedRole);
  }

  if (requiredRole === 'announce') {
    const allowed = ['organizer_owner','platform_super_admin','organizer_admin'];
    return allowed.includes(normalizedRole);
  }

  // 有 sessionId 限制：session_admin / onsite_staff 只能看授權場次
  if (sessionId && limitSessions) {
    if (['session_admin','onsite_staff'].includes(normalizedRole)) {
      const allowed = String(limitSessions).split(',').map(s=>s.trim()).filter(Boolean);
      if (allowed.length && !allowed.includes(sessionId)) return false;
    }
  }

  // JWT 驗證通過後仍回查 staff 最新狀態，避免停用或場次權限變更後舊 token 仍可使用。
  const activeRows = await dbGet(env, 'staff', `tenant_id=eq.${tid}&email=eq.${encodeURIComponent(email)}&select=is_active,active,limit_sessions,role,normalized_role`).catch(()=>[]);
  if (activeRows[0]) {
    const active = activeRows[0].is_active !== undefined ? activeRows[0].is_active : activeRows[0].active;
    if (active === false) return false;
    const dbRole = activeRows[0].normalized_role || activeRows[0].role || normalizedRole;
    const dbLimitSessions = activeRows[0].limit_sessions || '';
    if (sessionId && ['onsite_staff','session_admin'].includes(dbRole)) {
      // 009 權限表優先；若尚未執行 009 或查不到表，才回退 staff.limit_sessions。
      const permRows = await dbGet(env, 'staff_session_permissions', `tenant_id=eq.${tid}&staff_email=eq.${encodeURIComponent(email)}&session_id=eq.${encodeURIComponent(sessionId)}&is_active=eq.true&select=session_id`).catch(()=>null);
      if (Array.isArray(permRows)) {
        if (!permRows.length) return false;
      } else {
        const allowed = String(dbLimitSessions).split(',').map(s=>s.trim()).filter(Boolean);
        if (dbRole === 'onsite_staff' && !allowed.length) return false;
        if (allowed.length && !allowed.includes(sessionId)) return false;
      }
    }
  }
  return true; // 通過基本驗證，無特殊 requiredRole
}

// ── SECTION 8: Session 格式化 / 費用計算 ────────────────────────
function calcLimit(s) {
  const dates = safeJson(s.dates_json, []);
  if (!dates.length) return safeNum(s.limit_count);
  const hasLimit = dates.some(d => Number(d.limit) > 0);
  if (!hasLimit) return 0;
  return dates.reduce((sum, d) => sum + (Number(d.limit) || 0), 0);
}

function normalizeSessionModules(raw){
  const src=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:safeJson(raw,{});
  const out={
    registration:true,
    review:!!src.review,
    workshopSlots:Object.prototype.hasOwnProperty.call(src,'workshopSlots')?!!src.workshopSlots:!!src.timeslot,
    service:!!src.service,
    resource:!!src.resource,
    participants:!!src.participants,
    customFields:!!src.customFields,
    equipment:!!src.equipment,
    seatSelection:Object.prototype.hasOwnProperty.call(src,'seatSelection')?!!src.seatSelection:!!src.seats,
    addons:!!src.addons,
    agreement:!!src.agreement,
    invoice:!!src.invoice,
    payment:!!src.payment,
    checkin:!!src.checkin,
    quantityMode:['stall','booking','participant'].includes(String(src.quantityMode||''))?String(src.quantityMode):'booking',
    services:Array.isArray(src.services)?src.services:[],
    resources:Array.isArray(src.resources)?src.resources:[],
    participantTypes:Array.isArray(src.participantTypes)?src.participantTypes:[],
    depositKind:['none','booking','refundable'].includes(String(src.depositKind||''))?String(src.depositKind):'none',
    depositPolicy:(src.depositPolicy&&typeof src.depositPolicy==='object')?src.depositPolicy:{calcType:'fixed',value:0,cap:0},
    bookingPolicy:(src.bookingPolicy&&typeof src.bookingPolicy==='object')?src.bookingPolicy:{paymentMode:'full',depositType:'fixed',depositValue:0,cancelTiers:[],rescheduleBeforeHours:24,freeRescheduleCount:1,extraRescheduleMode:'new_deposit',extraRescheduleFee:0,noShowRefundPercent:0,organizerCancelModes:['reschedule','credit','refund']},
    googleCalendar:src.googleCalendar!==false,
    operatingMode:['activity','booking'].includes(String(src.operatingMode||''))?String(src.operatingMode):((src.workshopSlots||src.service)?'booking':'activity'),
    activityDatesTogether:src.activityDatesTogether===true,
    i18n:(src.i18n&&typeof src.i18n==='object')?src.i18n:{}
  };
  const i18n=out.i18n;
  out.i18n={enabled:!!i18n.enabled,languages:Array.isArray(i18n.languages)?i18n.languages.map(String).filter(Boolean):['zh-TW'],translations:(i18n.translations&&typeof i18n.translations==='object')?i18n.translations:{}};
  if(!out.i18n.languages.includes('zh-TW'))out.i18n.languages.unshift('zh-TW');
  const dp=out.depositPolicy||{}; out.depositPolicy={calcType:['fixed','percent','per_unit'].includes(String(dp.calcType||''))?String(dp.calcType):'fixed',value:Math.max(0,safeNum(dp.value)),cap:Math.max(0,safeNum(dp.cap))};
  const bp=out.bookingPolicy||{}; out.bookingPolicy={paymentMode:['full','deposit'].includes(String(bp.paymentMode||''))?String(bp.paymentMode):'full',depositType:['fixed','percent'].includes(String(bp.depositType||''))?String(bp.depositType):'fixed',depositValue:Math.max(0,safeNum(bp.depositValue)),cancelTiers:(Array.isArray(bp.cancelTiers)?bp.cancelTiers:[]).slice(0,8).map((x,i)=>{const refund=Math.max(0,Math.min(100,safeNum(x&&x.refundPercent)));const credit=Math.max(0,Math.min(100-refund,safeNum(x&&x.creditPercent)));return {key:String(x&&x.key||('tier_'+i)),minHours:Math.max(0,safeNum(x&&x.minHours)),refundPercent:refund,creditPercent:credit}}).sort((a,b)=>b.minHours-a.minHours),rescheduleBeforeHours:Math.max(0,safeNum(bp.rescheduleBeforeHours)),freeRescheduleCount:Math.max(0,Math.floor(safeNum(bp.freeRescheduleCount))),extraRescheduleMode:['reject','fee','new_deposit'].includes(String(bp.extraRescheduleMode||''))?String(bp.extraRescheduleMode):'new_deposit',extraRescheduleFee:Math.max(0,safeNum(bp.extraRescheduleFee)),noShowRefundPercent:Math.max(0,Math.min(100,safeNum(bp.noShowRefundPercent))),organizerCancelModes:Array.isArray(bp.organizerCancelModes)?bp.organizerCancelModes.filter(x=>['reschedule','credit','refund'].includes(String(x))):['reschedule','credit','refund']};
  return out;
}

function moduleItemById(items,id){const k=String(id||'');return (Array.isArray(items)?items:[]).find(x=>String(x&&x.id||'')===k)||null}
function moduleTranslation(mods,lang,key,fallback=''){const m=normalizeSessionModules(mods);if(!m.i18n.enabled||!lang||lang==='zh-TW')return fallback;const p=m.i18n.translations&&m.i18n.translations[lang];return p&&String(p[key]||'').trim()?String(p[key]).trim():fallback}

function calcConfiguredDeposit(modules, baseAmount, units){
  const m=normalizeSessionModules(modules),p=m.depositPolicy||{}; let v=0;
  if(p.value>0){
    if(p.calcType==='percent') v=Math.round(Math.max(0,safeNum(baseAmount))*p.value/100);
    else if(p.calcType==='per_unit') v=Math.round(p.value*Math.max(1,Math.floor(safeNum(units)||1)));
    else v=Math.round(p.value);
  }
  if(p.cap>0) v=Math.min(v,p.cap); return Math.max(0,v);
}
function calcBookingDeposit(modules,totalBeforeBookingDeposit){
  const m=normalizeSessionModules(modules),bp=m.bookingPolicy||{}; if(m.depositKind!=='booking'||bp.paymentMode!=='deposit')return 0;
  const v=bp.depositType==='percent'?Math.round(Math.max(0,safeNum(totalBeforeBookingDeposit))*bp.depositValue/100):Math.round(bp.depositValue);
  return Math.max(0,Math.min(Math.max(0,safeNum(totalBeforeBookingDeposit)),v));
}

function formatSession(s) {
  return {
    id: s.id, eventId: s.event_id,
    name: s.name, region: s.region || '',
    dates: safeJson(s.dates_json, []),
    venue: s.venue, fee: safeNum(s.fee), deposit: safeNum(s.deposit),
    limit: calcLimit(s), maxStalls: safeNum(s.max_stalls),
    count: safeNum(s.current_count), status: s.status,
    needReview: s.need_review === true || s.need_review === 'true',
    modules: normalizeSessionModules(safeJson(s.modules_json,{})),
    customFields: safeJson(s.custom_fields_json, []),
    equip: safeJson(s.equip_json, {}),
    addons: safeJson(s.addons_json, []),
    invoiceTax: safeJson(s.invoice_tax_json, {stall:true,equip:false,extra:false}),
    refundRules: safeJson(s.refund_rules_json, null),
    basicEquip: s.basic_equip || '',
    theme: s.theme || '', organizer: s.organizer || '', coorg: s.co_organizer || '',
    cover: s.cover_url || '', desc: s.description || '',
    mainVisualAssetId: s.main_visual_asset_id || '',
    aiVisualPreset: s.ai_visual_preset || '',
    seatPricingEnabled: s.seat_pricing_enabled === true || s.seat_pricing_enabled === 'true',
    seatHoldHours: safeNum(s.seat_hold_hours) || SEAT_HOLD_HOURS,
    seatMapUrl: s.seat_map_url || '',
    assignedStaff: s.assigned_staff ? String(s.assigned_staff).split(',').filter(Boolean) : [],
    forceCancel: s.force_cancel || false,
    forceCancelTargetId: s.force_cancel_target_id || '',
    forceCancelDeadline: s.force_cancel_deadline || '',
    // 不可抗力模組欄位
    forceCancelled: s.force_cancel || false,
    forceCancelReasonCode: s.force_cancel_reason_code || '',
    forceCancelReasonLabel: s.force_cancel_reason_label || '',
    forceCancelNote: s.force_cancel_note || '',
    forceCancelledAt: s.force_cancel_deadline || '',
    forceMode: s.force_cancel ? 'cancel' : '',
    forceTransferTargetSessionId: s.force_cancel_target_id || '',
    forceChoiceDeadline: s.force_cancel_deadline || '',
    forceNoticeSentAt: s.force_notice_sent_at || '',
    createdAt: s.created_at,
    // ── 合約同意設定 ──────────────────────────────────
    agreementRequired:  agreementRequiredOn(s.agreement_required),
    agreementTitle:     s.agreement_title   || '',
    agreementContent:   s.agreement_content || '',
    agreementVersion:   s.agreement_version || '',
    agreementUpdatedAt: s.agreement_updated_at || '',
    seatAssignDaysBefore: safeNum(s.seat_assign_days_before) || 7,
    venueMapTemplateId: s.venue_map_template_id || '',
    paymentProfileId: s.payment_profile_id || '',
  };
}
function calcFee(ses, selectedDates, stallCount) {
  const dates = safeJson(ses.dates_json, []);
  const baseFee = safeNum(ses.fee);
  const stalls = Math.max(parseInt(stallCount)||1, 1); // 無上限，由後台 maxStalls 控制
  if (dates.length > 1 && selectedDates && selectedDates.length > 0) {
    const allSelected = dates.every(d => selectedDates.includes(d.date));
    if (allSelected && baseFee > 0) return baseFee * stalls;
    return selectedDates.reduce((sum, sd) => {
      const def = dates.find(d => d.date === sd);
      return sum + (def ? (Number(def.fee) || 0) : 0);
    }, 0) * stalls;
  }
  if (dates.length === 1) return (Number(dates[0].fee) || baseFee || 0) * stalls;
  return baseFee * stalls;
}
function effectiveEquipIncl(key, def, basicEquip) {
  // A→Z 阻斷修正：費用計算以後台設備設定 incl 為準。
  // 前台若顯示「本次含 N」，後端也必須把 N 件視為內含，不可再依 basic_equip 文字猜測。
  const raw = Number(def?.incl)||0;
  return raw > 0 ? raw : 0;
}
// B-04 設備正式語意（唯一定義，前後端一致）：
//   equipment_json = 該報名「實際選擇的設備總量」，不是加租量。
//   內含總量 = 每攤內含數 × 攤位數
//   加租數量 = max(0, 已選總量 - 內含總量)
//   設備費   = 加租數量 × 單價
// 原本 incl 沒乘攤位數（stalls 算了卻沒用），導致 4 攤含 1 桌選 4 桌時被多收 3 桌錢。
function calcEquipTotal(equip, equipJsonStr, stallCount, basicEquip='') {
  let total = 0;
  const stalls = Math.max(Number(stallCount) || 1, 1);
  try {
    const def = typeof equipJsonStr === 'string' ? JSON.parse(equipJsonStr||'{}') : (equipJsonStr||{});
    Object.entries(equip||{}).forEach(([k,qty]) => {
      if (def[k]?.open) {
        const inclPerStall = effectiveEquipIncl(k, def[k], basicEquip);
        const inclTotal = inclPerStall * stalls;
        const extra = Math.max(0, (Number(qty)||0) - inclTotal);
        total += (Number(def[k].price)||0) * extra;
      }
    });
  } catch {}
  return total;
}

// ── SECTION 9: Email 工具（Resend API）─────────────────────────
async function sendEmail(env, to, subject, htmlBody, tenantCtx) {
  // 相容舊寫法 sendEmail(env,{to,subject,html})，避免 SaaS 平台通知失效。
  if (to && typeof to === 'object' && !Array.isArray(to)) {
    const payload = to;
    const maybeTenantCtx = subject;
    to = payload.to;
    subject = payload.subject;
    htmlBody = payload.html || payload.body || payload.htmlBody || '';
    tenantCtx = maybeTenantCtx && typeof maybeTenantCtx === 'object' ? maybeTenantCtx : tenantCtx;
  }
  if (!to) return {ok:false, error:'missing recipient'};
  if (!env.RESEND_KEY) {
    console.error('Email skipped: RESEND_KEY missing'); logError(env, {source:'sendEmail', message:'Email skipped: RESEND_KEY missing', error:''});
    return {ok:false, error:'RESEND_KEY missing'};
  }
  const emailFrom    = (tenantCtx && tenantCtx.emailFrom)    || env.MAIL_FROM || FALLBACK_EMAIL_FROM;
  const emailReplyTo = (tenantCtx && tenantCtx.emailReplyTo) || env.MAIL_REPLY_TO || FALLBACK_EMAIL_REPLY;
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), 8000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{'Authorization':`Bearer ${env.RESEND_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:emailFrom, to:Array.isArray(to)?to:[to], subject, html:htmlBody, reply_to:emailReplyTo}),
      signal:ctrl.signal,
    });
    const txt = await res.text().catch(()=>'');
    if (!res.ok) {
      console.error('Email failed:', res.status, txt); logError(env, {source:'sendEmail', message:'Email failed:', error:txt});
      return {ok:false, error:txt || ('HTTP '+res.status)};
    }
    return {ok:true};
  } catch(e) {
    console.error('Email failed:', e && e.message ? e.message : String(e)); logError(env, {source:'sendEmail', message:'Email failed:', error:e && e.message ? e.message : String(e)});
    return {ok:false, error:e && e.name==='AbortError' ? 'timeout' : (e.message||String(e))};
  } finally {
    clearTimeout(timer);
  }
}
// emailWrap：依租戶動態顯示品牌名稱與頁尾
function emailWrap(content, tenantCtx) {
  const name    = (tenantCtx && tenantCtx.name)    || FALLBACK_TENANT_NAME;
  const footer  = (tenantCtx && tenantCtx.footer)  || (name + '　All rights reserved.');
  const color   = (tenantCtx && tenantCtx.color)   || '#2d6a4f';
  return `<div style="font-family:'Noto Sans TC',sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fafaf8;border-radius:12px">
<div style="text-align:center;margin-bottom:24px"><h2 style="color:${color};font-size:20px;margin:0">${name}</h2></div>
${content}
<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0">
<p style="font-size:12px;color:#aaa;text-align:center">${footer}</p>
</div>`;
}
function memberUrl(regId, tenantCtx) {
  const base = (tenantCtx && tenantCtx.siteUrl) || '';
  if (!base) return '';
  const tid = (tenantCtx && tenantCtx.id) || '';  // M-02：id 缺漏時不輸出 'undefined' 字串
  const sep = base.includes('?') ? '&' : '?';
  // 前台以 page=member 判斷要開「我的紀錄」；member=1 一併保留以相容舊連結。
  return base + sep + 'page=member&member=1&tenant=' + encodeURIComponent(tid) + (regId ? '&pay='+encodeURIComponent(regId) : '');
}
function emailBtn(label, href, bg, color, extraStyle='') {
  return `<a href="${href}" style="display:block;background:${bg};color:${color};border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;line-height:1.35;text-align:center;padding:11px 10px;white-space:nowrap;${extraStyle}">${label}</a>`;
}
function defaultEmailTemplates() {
  // SaaS 信件模板：功能保留，是否寄出由 email_templates.is_active 控制。
  // DOING 預設關閉「查詢型通知」，各主辦可依租戶設定在後台開啟。
  return [
    {
      template_key:'registration_received',
      title:'報名確認信',
      subject:'【[場次名稱]】我們已收到您的報名',
      body:`親愛的 [顯示名稱]，

我們已收到您報名 [場次名稱]。

日期：[報名日期]
攤位數：[攤位數] 攤
設備：[設備]
應繳金額：NT$ [應繳金額]

請回到「我的紀錄」查看審核進度與報名狀態。

[按鈕:前往我的紀錄]`,
      is_active:false,
      group:'報名流程'
    },
    {
      template_key:'approval_notice',
      title:'錄取通知信',
      subject:'【[場次名稱]】錄取通知',
      body:`親愛的 [顯示名稱]，

恭喜您錄取 [場次名稱]。

場次：[場次名稱]
日期：[報名日期]
攤位數：[攤位數] 攤
設備：[設備]
應繳金額：NT$ [應繳金額]

攤位號碼將於活動前公布，屆時請至「我的紀錄」查看；行前通知信也會一併附上您的攤位與場地圖。

請回到報名系統「我的紀錄」登入查看繳費資訊、付款帳戶與最新進度。

[按鈕:前往我的紀錄]`,
      is_active:true,
      group:'審核流程'
    },
    {
      template_key:'rejection_notice',
      title:'未錄取通知信',
      subject:'【[場次名稱]】報名結果通知',
      body:`親愛的 [顯示名稱]，

感謝您報名 [場次名稱]。

很抱歉，本場次未錄取。您仍可回到「我的紀錄」查看報名紀錄，或查看其他開放場次。

[按鈕:前往我的紀錄]`,
      is_active:false,
      group:'審核流程'
    },
    {
      template_key:'payment_reminder',
      title:'繳費期限提醒',
      subject:'【[場次名稱]】繳費期限提醒',
      body:`親愛的 [顯示名稱]，

提醒您，您已錄取 [場次名稱]，目前尚未完成繳費。

日期：[報名日期]
攤位數：[攤位數] 攤
設備：[設備]
應繳金額：NT$ [應繳金額]

請回到「我的紀錄」查看付款帳戶並完成繳費。

[按鈕:前往我的紀錄]`,
      is_active:true,
      group:'付款流程'
    },
    {
      template_key:'payment_report_received',
      title:'繳費回報收到信',
      subject:'【[場次名稱]】繳費回報已收到',
      body:`親愛的 [顯示名稱]，

我們已收到您的繳費回報，付款狀態目前為待確認。

場次：[場次名稱]
付款方式：[付款方式]
回報金額：NT$ [回報金額]
末五碼：[末五碼]

請回到「我的紀錄」查看付款確認進度。

[按鈕:前往我的紀錄]`,
      is_active:false,
      group:'付款流程'
    },
    {
      template_key:'payment_confirmed',
      title:'繳費確認信',
      subject:'【[場次名稱]】繳費確認',
      body:`親愛的 [顯示名稱]，

您的付款已確認完成。

場次：[場次名稱]
繳費金額：NT$ [應繳金額]
設備：[設備]
攤位號碼：[攤位號碼]

您可回到「我的紀錄」查看最新報名狀態。

[按鈕:前往我的紀錄]`,
      is_active:false,
      group:'付款流程'
    },
    {
      template_key:'registration_cancelled',
      title:'取消報名信',
      subject:'【[場次名稱]】報名已取消',
      body:`親愛的 [顯示名稱]，

您報名的 [場次名稱] 已取消。

詳細狀態可回到「我的紀錄」查詢。

[按鈕:前往我的紀錄]`,
      is_active:false,
      group:'取消／退款'
    },
    {
      template_key:'refund_request_received',
      title:'退款申請通知',
      subject:'【[場次名稱]】退款申請已收到',
      body:`親愛的 [顯示名稱]，

我們已收到您 [場次名稱] 的退款申請。

主辦確認後，將依退款規則處理。您可回到「我的紀錄」查看進度。

[按鈕:前往我的紀錄]`,
      is_active:false,
      group:'取消／退款'
    },
    {
      template_key:'refund_done',
      title:'退費完成信',
      subject:'【[場次名稱]】退費已完成',
      body:`親愛的 [顯示名稱]，

您 [場次名稱] 的退費已處理完成。

退費金額：NT$ [退費金額]

款項將依實際金流或帳務處理時間退回。詳細紀錄可回到「我的紀錄」查詢。

[按鈕:前往我的紀錄]`,
      is_active:true,
      group:'取消／退款'
    },
    {
      template_key:'overdue_cancel',
      title:'逾期未繳取消信',
      subject:'【[場次名稱]】報名已因逾期未繳費取消',
      body:`親愛的 [顯示名稱]，

您報名的 [場次名稱] 因逾期未完成繳費，系統已取消本筆報名並釋出名額。

詳細狀態可回到「我的紀錄」查詢。

[按鈕:前往我的紀錄]`,
      is_active:true,
      group:'付款流程'
    },
    {
      template_key:'event_reminder',
      title:'行前提醒',
      subject:'【[場次名稱]】活動行前提醒',
      body:`親愛的 [顯示名稱]，

您報名的 [場次名稱] 即將開始。

日期：[活動日期]
地點：[地點]
您的攤位：[攤位號碼]
設備：[設備]

場地圖：[場地圖網址]

請留意報到、進場與現場規範。詳細資訊可回到「我的紀錄」查看。

[按鈕:前往我的紀錄]
[按鈕:加入官方LINE]`,
      is_active:true,
      group:'活動通知'
    },
    {
      template_key:'force_notice',
      title:'不可抗力通知',
      subject:'【[場次名稱]】不可抗力處理通知',
      body:`親愛的 [顯示名稱]，

您報名的 [場次名稱] 因不可抗力因素啟動處理流程。

原因：[取消原因]
[補充說明]

原場次：[原場次]
延期場次：[新場次]
請於 [選擇期限] 前完成選擇

請回到「我的紀錄」選擇「延期」或「退費」。
逾期未選擇者，系統將自動歸為退費處理。

[按鈕:前往我的紀錄]`,
      is_active:true,
      group:'不可抗力'
    },
    {
      template_key:'force_result_notice',
      title:'不可抗力處理結果通知',
      subject:'【[場次名稱]】不可抗力處理結果通知',
      body:`親愛的 [顯示名稱]，

您的不可抗力處理結果已更新。

原場次：[原場次]
新場次：[新場次]
退費金額：NT$ [退費金額]

請回到「我的紀錄」查看完整狀態。

[按鈕:前往我的紀錄]`,
      is_active:true,
      group:'不可抗力'
    },
    {
      template_key:'staff_invite',
      title:'管理員邀請信',
      subject:'【[主辦名稱]】您已被授權為活動管理員',
      body:`親愛的 [顯示名稱]，

[主辦名稱] 邀請您成為管理人員。

角色：[管理員角色]
權限：[權限]
管理範圍：[管理範圍]

請點下方按鈕，再用自己的 LINE 登入並接受邀請。接受後，這個 LINE、日後同步的 Google 與此 Email 都會連到同一個 DOING 會員。

[按鈕:接受管理邀請]`,
      is_active:true,
      group:'系統管理'
    },
    {
      template_key:'custom_notice',
      title:'自訂通知信',
      subject:'【[主辦名稱]】通知',
      body:`親愛的 [顯示名稱]，

[通知內容]

[按鈕:前往我的紀錄]`,
      is_active:false,
      group:'系統管理'
    }
  ];
}
function applyEmailVars(text, vars) {
  let out = String(text || '');
  for (const [k,v] of Object.entries(vars || {})) {
    out = out.split('['+k+']').join(String(v ?? ''));
  }
  return out;
}
function escapeEmailText(s) {
  return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function renderEmailTemplateBody(body, vars, tenantCtx, regId) {
  const prepared = applyEmailVars(body, vars);
  const lines = String(prepared || '').split(/\r?\n/);
  const parts = [];
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^\[按鈕:(.+?)\]$/);
    if (m) {
      const label = m[1].trim();
      let href = '';
      if (label.includes('邀請') || (label.includes('後台') && vars && vars['邀請連結'])) href = (vars && vars['邀請連結']) || '';
      else if (label.includes('後台')) href = (tenantCtx && tenantCtx.siteUrl) || FALLBACK_SITE_URL;
      else if (label.includes('繳費') || label.includes('我的紀錄') || label.includes('報名紀錄') || label.includes('會員')) href = memberUrl(regId || null, tenantCtx);
      else if (label.includes('LINE') || label.includes('客服')) href = (tenantCtx && tenantCtx.lineUrl) || '';
      else if (label.includes('活動')) href = (tenantCtx && tenantCtx.siteUrl) || FALLBACK_SITE_URL;
      if (href) parts.push(emailBtn(label, href, label.includes('LINE') ? '#06C755' : '#2d6a4f', '#fff'));
      continue;
    }
    if (!line) { parts.push('<div style="height:8px"></div>'); continue; }
    parts.push('<p style="margin:8px 0;line-height:1.8">'+escapeEmailText(raw)+'</p>');
  }
  return parts.join('\n');
}
function emailDateText(selectedDates) {
  const arr = safeJson(selectedDates, []);
  if (Array.isArray(arr)) {
    return arr.map(d => {
      if (d && typeof d === 'object') return d.date || d.value || d.label || d.name || '';
      return String(d || '');
    }).filter(Boolean).join('、');
  }
  return String(arr || '');
}
function emailMoneyText(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toLocaleString('zh-TW') : '0';
}
async function getEmailTemplateOrDefault(env, tenantId, key) {
  const k = String(key || '').trim();
  const defaults = defaultEmailTemplates();
  const fallback = defaults.find(x => x.template_key === k) || {template_key:k,title:k,subject:'【[主辦名稱]】通知',body:'[通知內容]',is_active:false};
  try {
    const rows = await dbGet(env, 'email_templates', `tenant_id=eq.${tenantId}&template_key=eq.${encodeURIComponent(k)}&select=*`);
    if (rows && rows[0]) {
      const r = rows[0];
      return {
        template_key:k,
        title:r.title || fallback.title,
        subject:r.subject || fallback.subject,
        body:r.body || r.body_html || fallback.body,
        is_active:r.is_active !== false,
        from_db:true,
      };
    }
  } catch(e) {}
  return {...fallback, from_db:false};
}
async function logEmailDelivery(env, tenantId, templateKey, to, result, meta={}) {
  try {
    await writeAuditLog(env, tenantId, meta.actorEmail || '', meta.actorRole || 'system',
      result && result.skipped ? 'email_skipped_disabled' : (result && result.ok ? 'email_sent' : 'email_failed'),
      meta.targetTable || 'registrations', meta.targetId || '', null, null,
      { template_key:templateKey, to:to || '', error:(result && result.error)||'', subject:meta.subject||'', reason:meta.reason||'' });
  } catch(e) {}
}
async function sendTemplateEmail(env, tenantId, templateKey, to, vars, tenantCtx, regId='', meta={}) {
  if (!to) return {ok:false, error:'missing recipient'};
  const tpl = await getEmailTemplateOrDefault(env, tenantId, templateKey);
  const subject = applyEmailVars(tpl.subject || '【[主辦名稱]】通知', vars);
  if (tpl.is_active === false) {
    const skipped = {ok:true, skipped:true, disabled:true};
    await logEmailDelivery(env, tenantId, templateKey, to, skipped, {...meta, subject, reason:'template_disabled'});
    return skipped;
  }
  const bodyHtml = renderEmailTemplateBody(tpl.body || '', vars, tenantCtx, regId);
  const result = await sendEmail(env, to, subject, emailWrap(bodyHtml, tenantCtx), tenantCtx);
  await logEmailDelivery(env, tenantId, templateKey, to, result, {...meta, subject});
  return result;
}

function normalizeEquipName(k) {
  let name = String(k || '').trim();
  name = name.replace(/\s+/g, '');
  const aliases = {
    '椅子':'椅', '椅':'椅', '椅凳':'椅',
    '桌子':'桌', '桌':'桌', '長桌':'桌', '摺疊桌':'桌', '折疊桌':'桌', '桌台':'桌',
    '電':'電力', '用電':'電力', '插座':'電力', '電源':'電力',
  };
  return aliases[name] || name;
}
function equipSummaryFromJson(equip) {
  const eq = safeJson(equip, {});
  return Object.entries(eq)
    .filter(([k,v]) => Number(v) > 0)
    .map(([k,v]) => `${normalizeEquipName(k)} ×${Number(v)}`)
    .join('、');
}

function addonSummaryFromJson(addonQty, sessionRow={}) {
  const qty = safeJson(addonQty, {});
  const defs = safeJson(sessionRow.addons_json, []) || [];
  const parts = [];
  if (Array.isArray(qty)) {
    qty.forEach((it, i) => {
      if (it && typeof it === 'object') {
        const n = Number(it.qty || it.count || it.quantity || it.value || 0);
        const name = it.name || it.label || it.title || (defs[i] && defs[i].name) || `項目${i+1}`;
        if (n > 0) parts.push(`${name}×${n}`);
      } else {
        const n = Number(it || 0);
        const name = (defs[i] && defs[i].name) || `項目${i+1}`;
        if (n > 0) parts.push(`${name}×${n}`);
      }
    });
  } else if (qty && typeof qty === 'object') {
    Object.entries(qty).forEach(([k, v]) => {
      const n = Number((v && typeof v === 'object') ? (v.qty || v.count || v.quantity || v.value || 0) : v);
      if (n <= 0) return;
      const def = /^\d+$/.test(String(k)) && defs[Number(k)] ? defs[Number(k)] : null;
      const name = (v && typeof v === 'object' && (v.name || v.label || v.title)) || (def && def.name) || k;
      parts.push(`${name}×${n}`);
    });
  }
  return parts.length ? parts.join('、') : '無';
}
async function hUndoPaymentReport(env, b){
  const TENANT=b._tenantId; if(!TENANT) return jsonErr('無法辨識主辦空間');
  if(!b.regId) return jsonErr('缺少報名編號');
  const rows=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  const reg=(rows||[])[0];
  if(!reg) return jsonErr('找不到報名紀錄');
  const guard=await verifiedRegOwnerGuard(env,reg,b,'撤回付款回報'); if(guard) return guard;
  const ps=String(reg.payment_status||'');
  if(isPaidStatus(ps)) return jsonErr('主辦已確認入帳，無法撤回。若有問題請聯繫主辦');
  if(!/待確認|回報/.test(ps)) return jsonErr('目前狀態不需要撤回，可直接重新回報付款');
  await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}`,{
    payment_status:'未繳費',
    payment_report_amount:null,
    payment_last5:'',
    payment_reported_at:null,
    admin_note:(reg.admin_note||'')+` [使用者撤回付款回報] ${nowTaipeiText()}`
  });
  try {
    await dbUpdate(env,'payments',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(b.regId)}&status=eq.%E5%BE%85%E7%A2%BA%E8%AA%8D`,{status:'已取消'});
  } catch(e) {
    logError(env,{source:'hUndoPaymentReport',action:'undoPaymentReport',tenantId:TENANT,regId:b.regId,message:'付款回報撤回時 payments 狀態同步失敗',error:e&&e.message?e.message:e});
  }
  return jsonOk({success:true});
}

function buildPaymentLineCardText(reg, sesName, method, amount) {
  const brand = String(reg.brand_name || reg.brand || '').trim();
  const name = String(reg.name || reg.contact_name || reg.display_name || '').trim();
  const who = brand && name ? `${brand}／${name}` : (brand || name || '未填名稱');
  const stallCount = Math.max(Number(reg.stall_count || 1), 1);
  const equipText = equipSummaryFromJson(reg.equipment_json);
  const deposit = Number(reg.deposit || 0);
  const lines = [
    sesName || reg.session_name || '場次',
    who,
    `攤位 ${stallCount} 攤`,
    `設備：${equipText || '自備'}`,
  ];
  if (deposit > 0) lines.push(`保證金 NT$${deposit.toLocaleString()}`);
  lines.push('');
  lines.push(`付款金額：NT$${Number(amount || reg.amount || 0).toLocaleString()}（${method || reg.payment_method || '付款'}）`);
  return lines.join('\n');
}


// ① 報名確認：可由後台開關控制，DOING 預設關閉
async function mailRegConfirm(env, email, displayName, sesName, regId, total, stallCount, selectedDates, equip, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
    '報名日期': emailDateText(selectedDates) || '未設定',
    '活動日期': emailDateText(selectedDates) || '未設定',
    '攤位數': Number(stallCount || 1) || 1,
    '設備': equipSummaryFromJson(equip) || '無',
    '應繳金額': emailMoneyText(total),
  };
  return sendTemplateEmail(env, tenantId, 'registration_received', email, vars, tenantCtx, regId, {targetId:regId, targetTable:'registrations'});
}

// ② 錄取通知：資料由 DB / Worker 帶入，前台只回我的紀錄查詢
async function mailApproval(env, email, displayName, sesName, regId, fee, stallCount, selectedDates, equip, sesEquipJson, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
    '報名日期': emailDateText(selectedDates) || '未設定',
    '活動日期': emailDateText(selectedDates) || '未設定',
    '攤位數': Number(stallCount || 1) || 1,
    '設備': equipSummaryFromJson(equip) || '無',
    '應繳金額': emailMoneyText(fee),
  };
  return sendTemplateEmail(env, tenantId, 'approval_notice', email, vars, tenantCtx, regId, {targetId:regId, targetTable:'registrations'});
}

// ③ 繳費回報已收到：保留 SaaS 功能，DOING 預設關閉
async function mailPaymentReceived(env, email, displayName, sesName, method, amount, last5, regId, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
    '付款方式': method || '付款',
    '回報金額': emailMoneyText(amount),
    '末五碼': last5 || '未提供',
  };
  return sendTemplateEmail(env, tenantId, 'payment_report_received', email, vars, tenantCtx, regId, {targetId:regId, targetTable:'registrations'});
}

// ④ 繳費確認信：保留 SaaS 功能，DOING 預設關閉
async function mailPaymentConfirm(env, email, displayName, sesName, amount, equipStr, stallNo, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
    '應繳金額': emailMoneyText(amount),
    '設備': equipStr || '無',
    '攤位號碼': stallNo || '尚未指定',
  };
  return sendTemplateEmail(env, tenantId, 'payment_confirmed', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// ⑤ 未錄取通知信：保留 SaaS 功能，DOING 預設關閉
async function mailRejection(env, email, displayName, sesName, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
  };
  return sendTemplateEmail(env, tenantId, 'rejection_notice', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// ⑥ 取消報名信：保留 SaaS 功能，DOING 預設關閉
async function mailCancelReg(env, email, displayName, sesName, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
  };
  return sendTemplateEmail(env, tenantId, 'registration_cancelled', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// ⑦ 退款申請已收到：保留 SaaS 功能，DOING 預設關閉
async function mailRefundRequestReceived(env, email, displayName, sesName, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
  };
  return sendTemplateEmail(env, tenantId, 'refund_request_received', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// ⑧ 一般退費完成信：保留，DOING 預設開啟
async function mailRefundConfirm(env, email, displayName, sesName, tenantCtx=null, refundAmount=0) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
    '退費金額': emailMoneyText(refundAmount),
  };
  return sendTemplateEmail(env, tenantId, 'refund_done', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// ⑨ 逾期未繳費自動取消
async function mailAutoCancel(env, email, displayName, sesName, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
  };
  return sendTemplateEmail(env, tenantId, 'overdue_cancel', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// 系統必要保留：繳費期限提醒
async function mailDeadlineReminder(env, email, displayName, sesName, regId, fee, selectedDates, equip, sesEquipJson, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
    '報名日期': emailDateText(selectedDates) || '未設定',
    '活動日期': emailDateText(selectedDates) || '未設定',
    '攤位數': '',
    '設備': equipSummaryFromJson(equip) || '無',
    '應繳金額': emailMoneyText(fee),
  };
  return sendTemplateEmail(env, tenantId, 'payment_reminder', email, vars, tenantCtx, regId, {targetId:regId, targetTable:'registrations'});
}

// 系統必要保留：行前提醒
async function mailPreEventReminder(env, email, displayName, sesName, date, venue, tenantCtx=null, regId='', equip='', stallNo='', mapUrl='') {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
    '活動日期': date || '未設定',
    '報名日期': date || '未設定',
    '地點': venue || '未設定',
    '設備': equip || '請以我的紀錄顯示為準',
    '攤位號碼': stallNo || '請至現場服務台洽詢',
    '場地圖網址': mapUrl || '（本場無場地圖，請以現場為準）',
  };
  return sendTemplateEmail(env, tenantId, 'event_reminder', email, vars, tenantCtx, regId, {targetId:regId, targetTable:'registrations'});
}

// 系統必要保留：不可抗力取消／延期通知
async function mailForceCancelChoice(env, email, displayName, sesName, targetSesName, deadline, tenantCtx=null, extra={}) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
    '原場次': sesName || '',
    '新場次': targetSesName || '無延期場次',
    '選擇期限': deadline || '依系統顯示',
    '取消原因': (extra && extra.reasonLabel) || '不可抗力因素',
    '補充說明': (extra && extra.note) || '',
  };
  return sendTemplateEmail(env, tenantId, 'force_notice', email, vars, tenantCtx, '', {targetTable:'registrations'});
}
async function mailTransferDiffFee(env, email, displayName, newSesName, newFee, oldFee, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': newSesName || '',
    '原場次': '',
    '新場次': newSesName || '',
    '退費金額': '0',
    '應繳金額': emailMoneyText(newFee),
  };
  return sendTemplateEmail(env, tenantId, 'force_result_notice', email, vars, tenantCtx, '', {targetTable:'registrations'});
}
async function mailTransferSameFee(env, email, displayName, newSesName, tenantCtx=null) {
  return mailTransferDiffFee(env, email, displayName, newSesName, 0, 0, tenantCtx);
}
async function mailAutoRefund(env, email, displayName, sesName, tenantCtx=null) {
  return mailRefundRequestReceived(env, email, displayName, sesName, tenantCtx);
}

// 不可抗力取消通知信
async function mailForceCancelNotice(env, email, displayName, sesName, tenantCtx=null, opts={}) {
  return mailForceCancelChoice(env, email, displayName, sesName,
    (opts && opts.targetSesName) || '', (opts && opts.deadlineText) || '', tenantCtx,
    {reasonLabel:(opts&&opts.reasonLabel)||'', note:(opts&&opts.note)||''});
}

// 延期完成信
async function mailForceTransferDone(env, email, displayName, oldSesName, newSesName, paidAmount, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': newSesName || '',
    '原場次': oldSesName || '',
    '新場次': newSesName || '',
    '退費金額': '0',
    '應繳金額': emailMoneyText(paidAmount),
  };
  return sendTemplateEmail(env, tenantId, 'force_result_notice', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// 退費完成信（不可抗力）
async function mailForceRefundDone(env, email, displayName, sesName, refundAmount, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': displayName || '',
    '場次名稱': sesName || '',
    '原場次': sesName || '',
    '新場次': '',
    '退費金額': emailMoneyText(refundAmount),
  };
  return sendTemplateEmail(env, tenantId, 'force_result_notice', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// 管理員邀請
async function mailStaffInvite(env, email, name, role, perms, limitSessions, tenantCtx=null, inviteUrl='') {
  const labels = {review:'審核報名',checkin:'現場報到',sessions:'管理場次',events:'管理活動',finance:'財務管理',announce:'公告管理'};
  const permText = (role==='superadmin'||role==='超級管理員'||role==='platform_super_admin')
    ? '所有功能（超級管理員）'
    : Object.keys(perms||{}).filter(k=>perms[k]).map(k=>labels[k]||k).join('、') || '依後台權限設定';
  const sesText = limitSessions?.length ? '僅限指定場次' : '所有場次';
  const tenantId = tenantCtx?.id || '';
  const vars = {
    '主辦名稱': tenantCtx?.name || FALLBACK_TENANT_NAME,
    '顯示名稱': name || email || '',
    '管理員角色': role || '',
    '權限': permText,
    '管理範圍': sesText,
    '邀請連結': inviteUrl || '',
  };
  return sendTemplateEmail(env, tenantId, 'staff_invite', email, vars, tenantCtx, '', {targetTable:'staff', targetId:email});
}


// ── SECTION 10: DB 查詢輔助 ─────────────────────────────────────
async function getSessionRow(env, sessionId, tenantId) {
  const tid = tenantId ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  const rows = await dbGet(env, 'sessions', `tenant_id=eq.${tid}&id=eq.${encodeURIComponent(sessionId)}&select=*`);
  return rows[0] || null;
}
async function getSessionName(env, sessionId, tenantId) {
  const tid = tenantId ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  const rows = await dbGet(env, 'sessions', `tenant_id=eq.${tid}&id=eq.${encodeURIComponent(sessionId)}&select=name`);
  return rows.length ? rows[0].name : sessionId;
}
async function getSessionType(){ return '活動場次'; }
// SaaS 租戶功能旗標：未設定的舊租戶維持既有功能；只有明確 false 才關閉。
const DEFAULT_TENANT_MODULE_FLAGS = {
  registration: true, review: true, payment: true, equipment: true, seatSelection: true,
  checkin: true, invoice: true, workshopSlots: true, service: true, resource: true,
  participants: true, customFields: true, addons: true, agreement: true, i18n: true, googleCalendar: true,
  themeEvents: false, photoFrames: false, ai_visual: false
};

function normalizeApprovedModuleFlags(raw,fallback={}){
  const src=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:{};
  const base=(fallback&&typeof fallback==='object'&&!Array.isArray(fallback))?fallback:{};
  const out={registration:true};
  for(const key of Object.keys(DEFAULT_TENANT_MODULE_FLAGS)){
    if(key==='registration')continue;
    out[key]=Object.prototype.hasOwnProperty.call(src,key)?src[key]===true:base[key]===true;
  }
  return out;
}

function normalizeTenantModuleProfileValue(raw){
  const obj=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:safeJson(raw,{});
  const defaults=normalizeSessionModules(obj.defaults||obj.modules||{});
  return {configured:obj.configured===true,useType:String(obj.useType||'generic'),defaults,updatedAt:obj.updatedAt||''};
}
async function getTenantModuleProfileValue(env, tenantId){
  const tid=String(tenantId||'').trim().toLowerCase();
  if(!tid) return {configured:false,useType:'generic',defaults:normalizeSessionModules({}),updatedAt:''};
  const rows=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(tid)}&select=config_json`).catch(()=>[]);
  const cfg=safeJson(rows[0]?.config_json,{});
  return normalizeTenantModuleProfileValue(cfg.moduleProfile||{});
}
async function getTenantSettingsRow(env, tenantId){
  const tid=String(tenantId||'').trim().toLowerCase();
  if(!tid)return null;
  const rows=await dbGet(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(tid)}&select=tenant_id,module_flags_json,theme_json`).catch(()=>[]);
  return rows[0]||null;
}
async function getTenantModuleFlags(env, tenantId) {
  try {
    const settings=await getTenantSettingsRow(env,tenantId);
    if(settings){
      const raw=safeJson(settings.module_flags_json,{});
      const flags={};
      for(const key of Object.keys(DEFAULT_TENANT_MODULE_FLAGS))flags[key]=raw[key]===true;
      for(const [key,value] of Object.entries(raw))if(typeof value!=='boolean')flags[key]=value;
      return flags;
    }
    const p=await getTenantModuleProfileValue(env,tenantId);
    if(!p.configured) return {...DEFAULT_TENANT_MODULE_FLAGS};
    return {...DEFAULT_TENANT_MODULE_FLAGS,...p.defaults};
  } catch(e) { return {...DEFAULT_TENANT_MODULE_FLAGS}; }
}

async function tenantAllowedSessionModules(env,tenantId,raw){
  const modules=normalizeSessionModules(raw||{}),flags=await getTenantModuleFlags(env,tenantId);
  for(const key of Object.keys(DEFAULT_TENANT_MODULE_FLAGS)){
    if(key==='registration'||flags[key]!==false)continue;
    if(key==='i18n')modules.i18n={enabled:false,languages:['zh-TW'],translations:{}};
    else modules[key]=false;
  }
  if(!modules.workshopSlots&&modules.operatingMode==='booking')modules.operatingMode='activity';
  return modules;
}
async function requestedUnapprovedModules(env,tenantId,raw){
  const requested=normalizeSessionModules(raw||{}),flags=await getTenantModuleFlags(env,tenantId),labels={review:'審核錄取',payment:'付款確認',equipment:'設備租借',seatSelection:'攤位／座位選位',checkin:'現場報到',invoice:'發票資料',workshopSlots:'日期／時段',service:'服務方案',resource:'人員／資源',participants:'票種／人數',customFields:'自訂問題',addons:'加購',agreement:'條款合約',i18n:'多語言',googleCalendar:'行事曆'},blocked=[];
  for(const key of Object.keys(DEFAULT_TENANT_MODULE_FLAGS)){
    if(key==='registration'||flags[key]!==false)continue;
    const enabled=key==='i18n'?requested.i18n?.enabled===true:requested[key]===true;
    if(enabled)blocked.push(labels[key]||key);
  }
  return blocked;
}

async function hGetTenantModuleProfile(env,p){
  const T=p._tenantId; if(!await verifyStaff(env,p.email,p.token,T)) return jsonErr('無權限');
  const [profile,approvedFlags]=await Promise.all([getTenantModuleProfileValue(env,T),getTenantModuleFlags(env,T)]);
  return jsonOk({...profile,approvedFlags});
}
async function hSaveTenantModuleProfile(env,b){
  const T=b._tenantId; if(!await verifyStaff(env,b.email,b.token,T,'superadmin')) return jsonErr('只有租戶負責人可修改新場次預設');
  const rows=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(T)}&select=config_json`); if(!rows.length)return jsonErr('找不到主辦空間');
  const cfg=safeJson(rows[0].config_json,{});
  const approvedFlags=await getTenantModuleFlags(env,T);
  const defaults=normalizeSessionModules(b.defaults||{});
  for(const key of Object.keys(DEFAULT_TENANT_MODULE_FLAGS))if(approvedFlags[key]===false)defaults[key]=false;
  const profile={configured:true,useType:String(b.useType||'generic'),defaults,updatedAt:nowIso()};
  cfg.moduleProfile=profile;
  await dbUpdate(env,'tenants',`id=eq.${encodeURIComponent(T)}`,{config_json:JSON.stringify(cfg)});
  await writeAuditLog(env,T,b.email||'','organizer','save_module_profile','tenants',T,null,profile).catch(()=>{});
  return jsonOk({...profile,approvedFlags});
}

const TENANT_THEME_KEYS=new Set(['cute_pastel','fresh_minimal','mono_anime','warm_handmade','vivid_pop']);
function normalizeTenantTheme(raw){
  const v=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:safeJson(raw,{});
  const key=TENANT_THEME_KEYS.has(String(v.key||''))?String(v.key):'cute_pastel';
  return {key,updatedAt:String(v.updatedAt||'')};
}
async function getTenantTheme(env,tenantId){
  const row=await getTenantSettingsRow(env,tenantId);
  return normalizeTenantTheme(row&&row.theme_json);
}
async function hGetTenantTheme(env,p){
  const T=p._tenantId;if(!await verifyStaff(env,p.email,p.token,T))return jsonErr('無權限');
  return jsonOk(await getTenantTheme(env,T));
}
async function hSaveTenantTheme(env,b){
  return jsonErr('品牌模板由 DOING 平台依租戶方案設定；租戶端不開放自行切換',403);
}
async function hGetPlatformTenantModules(env,p){
  if(!await platformSupportAuth(env,p))return jsonErr('無權限');const T=String(p.target_tenant_id||'').trim().toLowerCase();if(!T)return jsonErr('請選擇主辦');return jsonOk({flags:await getTenantModuleFlags(env,T)});
}
async function hSavePlatformTenantModules(env,b){
  const jwt=await platformSupportAuth(env,b);if(!jwt)return jsonErr('無權限');const T=String(b.target_tenant_id||'').trim().toLowerCase();if(!T)return jsonErr('請選擇主辦');
  const incoming=(b.flags&&typeof b.flags==='object')?b.flags:{},current=await getTenantModuleFlags(env,T),flags={...current};
  for(const key of Object.keys(DEFAULT_TENANT_MODULE_FLAGS))if(Object.prototype.hasOwnProperty.call(incoming,key))flags[key]=incoming[key]===true;
  flags.registration=true;
  const row=await getTenantSettingsRow(env,T);
  if(row)await dbUpdate(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(T)}`,{module_flags_json:JSON.stringify(flags),updated_at:nowIso()});
  else await dbInsert(env,'tenant_settings',{tenant_id:T,module_flags_json:flags,theme_json:{key:'cute_pastel',updatedAt:nowIso()}});
  await writeAuditLog(env,T,jwt.email||'','platform_super_admin','approve_tenant_modules','tenant_settings',T,current,flags).catch(()=>{});return jsonOk({flags});
}
async function hGetPlatformTenantTheme(env,p){
  if(!await platformSupportAuth(env,p))return jsonErr('無權限');
  const T=String(p.target_tenant_id||'').trim().toLowerCase();if(!T)return jsonErr('請選擇主辦');
  return jsonOk(await getTenantTheme(env,T));
}
async function hSavePlatformTenantTheme(env,b){
  const jwt=await platformSupportAuth(env,b);if(!jwt)return jsonErr('無權限');
  const T=String(b.target_tenant_id||'').trim().toLowerCase(),key=String(b.themeKey||b.key||'').trim();
  if(!T)return jsonErr('請選擇主辦');if(!TENANT_THEME_KEYS.has(key))return jsonErr('不支援的品牌模板');
  const before=await getTenantTheme(env,T),value={key,updatedAt:nowIso(),managedBy:'platform'};
  const row=await getTenantSettingsRow(env,T);
  if(row)await dbUpdate(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(T)}`,{theme_json:JSON.stringify(value),updated_at:nowIso()});
  else await dbInsert(env,'tenant_settings',{tenant_id:T,module_flags_json:await getTenantModuleFlags(env,T),theme_json:value});
  await writeAuditLog(env,T,jwt.email||'','platform_super_admin','set_tenant_theme','tenant_settings',T,before,value).catch(()=>{});
  return jsonOk(value);
}

function cleanSupportText(value,max){return String(value||'').trim().slice(0,max)}
async function tenantSupportAuth(env,p,T){return await verifyStaff(env,p.email,p.token,T)}
async function platformSupportAuth(env,p){const jwt=await verifyAdminJwt(p.token,env);return jwt&&jwt.normalized_role==='platform_super_admin'?jwt:null}
async function hGetSupportThreads(env,p){
  const T=p._tenantId;if(!await tenantSupportAuth(env,p,T))return jsonErr('無權限');
  const rows=await dbGet(env,'support_threads',`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=last_message_at.desc`).catch(()=>[]);
  return jsonOk({threads:rows,unread:rows.reduce((n,x)=>n+safeNum(x.tenant_unread_count),0)});
}
async function hGetSupportMessages(env,p){
  const T=p._tenantId;if(!await tenantSupportAuth(env,p,T))return jsonErr('無權限');const id=cleanSupportText(p.threadId,80);if(!id)return jsonErr('缺少對話');
  const threads=await dbGet(env,'support_threads',`id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(T)}&select=id`).catch(()=>[]);if(!threads.length)return jsonErr('找不到對話');
  return jsonOk({messages:await dbGet(env,'support_messages',`thread_id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(T)}&select=*&order=created_at.asc`).catch(()=>[])});
}
async function hCreateSupportThread(env,b){
  const T=b._tenantId;if(!await tenantSupportAuth(env,b,T))return jsonErr('無權限');
  const body=cleanSupportText(b.body,4000),subject=cleanSupportText(b.subject,120);if(!body)return jsonErr('請輸入訊息');
  const kind=['support','module_request'].includes(String(b.kind||''))?String(b.kind):'support';const id=crypto.randomUUID(),now=nowIso();
  const thread=await dbInsert(env,'support_threads',{id,tenant_id:T,kind,subject:subject||(kind==='module_request'?'申請新增功能':'系統客服'),status:'open',priority:'normal',requested_module_key:kind==='module_request'?cleanSupportText(b.moduleKey,80):null,metadata_json:{},created_by_email:cleanSupportText(b.email,320),last_message_at:now,created_at:now,updated_at:now});
  await dbInsert(env,'support_messages',{id:crypto.randomUUID(),thread_id:id,tenant_id:T,sender_scope:'tenant',sender_email:cleanSupportText(b.email,320),body,created_at:now});
  return jsonOk({thread});
}
async function hSendSupportMessage(env,b){
  const T=b._tenantId;if(!await tenantSupportAuth(env,b,T))return jsonErr('無權限');const id=cleanSupportText(b.threadId,80),body=cleanSupportText(b.body,4000);if(!id||!body)return jsonErr('請選擇對話並輸入訊息');
  const threads=await dbGet(env,'support_threads',`id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(T)}&select=id`).catch(()=>[]);if(!threads.length)return jsonErr('找不到對話');
  const message=await dbInsert(env,'support_messages',{id:crypto.randomUUID(),thread_id:id,tenant_id:T,sender_scope:'tenant',sender_email:cleanSupportText(b.email,320),body,created_at:nowIso()});return jsonOk({message});
}
async function hMarkSupportRead(env,b){
  const T=b._tenantId;if(!await tenantSupportAuth(env,b,T))return jsonErr('無權限');const id=cleanSupportText(b.threadId,80);if(!id)return jsonErr('缺少對話');
  await dbUpdate(env,'support_threads',`id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(T)}`,{tenant_unread_count:0,updated_at:nowIso()});return jsonOk({ok:true});
}
async function hGetPlatformSupportThreads(env,p){
  if(!await platformSupportAuth(env,p))return jsonErr('無權限');const rows=await dbGet(env,'support_threads','select=*&order=last_message_at.desc').catch(()=>[]);return jsonOk({threads:rows,unread:rows.reduce((n,x)=>n+safeNum(x.platform_unread_count),0)});
}
async function hGetPlatformSupportMessages(env,p){
  if(!await platformSupportAuth(env,p))return jsonErr('無權限');const id=cleanSupportText(p.threadId,80);if(!id)return jsonErr('缺少對話');return jsonOk({messages:await dbGet(env,'support_messages',`thread_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`).catch(()=>[])});
}
async function hSendPlatformSupportMessage(env,b){
  const jwt=await platformSupportAuth(env,b);if(!jwt)return jsonErr('無權限');const id=cleanSupportText(b.threadId,80),body=cleanSupportText(b.body,4000);if(!id||!body)return jsonErr('請選擇對話並輸入訊息');
  const threads=await dbGet(env,'support_threads',`id=eq.${encodeURIComponent(id)}&select=id,tenant_id`).catch(()=>[]);if(!threads.length)return jsonErr('找不到對話');
  const message=await dbInsert(env,'support_messages',{id:crypto.randomUUID(),thread_id:id,tenant_id:threads[0].tenant_id,sender_scope:'platform',sender_email:cleanSupportText(jwt.email,320),body,created_at:nowIso()});return jsonOk({message});
}
async function hMarkPlatformSupportRead(env,b){
  if(!await platformSupportAuth(env,b))return jsonErr('無權限');const id=cleanSupportText(b.threadId,80);if(!id)return jsonErr('缺少對話');await dbUpdate(env,'support_threads',`id=eq.${encodeURIComponent(id)}`,{platform_unread_count:0,updated_at:nowIso()});return jsonOk({ok:true});
}

const TENANT_FEATURE_ACTIONS = {
  registration: new Set([
    'register','registerBundle','saveBundle','deleteBundle','cancelReg','adminCancelReg',
    'getBundles','getBundlesPublic','getMember','getMyRegs','getRegLookup','getRegs','getRegsBySession',
    'getSessionRegistrations','downloadSession','updateRegStatus','batchUpdateStatus','approveReg',
    'saveRegNote','checkMemberEmailPhone','setFastPass','updateRegistrationAction','rescheduleBooking',
    'forceCancelSession','agreeForceTransfer','runForceChoiceDeadline'
  ]),
  payment: new Set([
    'submitPayment','submitPaymentBatch','undoPaymentReport','createLinePayOrder','createEcpayOrder','confirmPayment',
    'markPaymentScreenshot','sendPaymentReminder','refundDeposit','applyRefund','confirmRefund',
    'getPayments','getPaymentSettings','getPaymentProfiles','getFinancePaymentGroups',
    'savePaymentSettings','savePaymentProfile','disablePaymentProfile','getFinance','saveFinanceItem',
    'deleteFinanceItem','adminFinanceAnomalies','getRefundSuggestion','getForceRefundList',
    'applyForceRefund','applyForceRefundFM','confirmForceRefund'
  ]),
  equipment: new Set(['getSessionEquipmentDetails']),
  seatSelection: new Set([
    'getSeatMap','selectStall','claimPaidSeat','saveSeatMap','saveSeatMapImage',
    'listVenueMaps','saveVenueMap','applyVenueMap','deleteVenueMap'
  ]),
  photoFrames: new Set(['listPhotoActivities','savePhotoActivity','savePhotoActivityFrame','deletePhotoActivityFrame','deletePhotoActivity','listPhotoLeads']),
  checkin: new Set([
    'onsiteSessions','onsiteRegs','onsitePasscodeVerify','onsitePasscodeList',
    'onsitePasscodeGenerate','onsitePasscodeToggle','onsiteShiftStart','onsiteShiftEnd','onsiteShiftList','checkin','onsiteMark','markClear'
  ]),
  invoice: new Set(['getInvoiceList','updateInvoiceStatus']),
  ai_visual: new Set([
    'generateSessionVisual','getSessionVisualAssets','getSessionVisualJobs',
    'setSessionMainVisual','deleteSessionVisualAsset'
  ]),
};

function tenantFeatureForAction(action) {
  for (const [feature, actions] of Object.entries(TENANT_FEATURE_ACTIONS)) {
    if (actions.has(action)) return feature;
  }
  return '';
}

async function enforceTenantFeature(env, tenantId, action) {
  const feature = tenantFeatureForAction(action);
  if (!feature) return null;
  const flags = await getTenantModuleFlags(env, tenantId);
  if (flags[feature] === false) {
    return new Response(JSON.stringify({ok:false, error:`此租戶未開啟 ${feature} 功能`, feature}), {
      status:403,
      headers:corsHeaders(),
    });
  }
  return null;
}

// 租戶後台角色是 API 的正式邊界，不只靠前端隱藏按鈕。
const TENANT_ROLE_ACTIONS = {
  owner: new Set(['saveTenantModuleProfile','addStaff','removeStaff','setStaffActive','setStaffScope','updateStaffPerms','updateStaffScope','updateStaffSessions']),
  settingsRead: new Set(['getTenantModuleProfile','getTenantTheme','getStaff','getCompanySettings','getSiteConfig','getEmailTemplates','getPaymentSettings','getPaymentProfiles','getAgreementTemplate','getAgreementTemplates','listVenueMaps','listPhotoActivities']),
  settings: new Set(['saveCompanySettings','saveSiteConfig','saveEmailTemplate','testEmail','savePaymentSettings','savePaymentProfile','disablePaymentProfile','saveAgreementTemplate','saveAgreementTemplates','saveVenueMap','applyVenueMap','deleteVenueMap','savePhotoActivity','deletePhotoActivity','savePhotoActivityFrame','deletePhotoActivityFrame','savePromotionRule','deletePromotionRule']),
  finance: new Set(['financeOverview','financeReport','adminFinanceAnomalies','getFinance','getPayments','getFinancePaymentGroups','getSessionCashbook','saveFinanceItem','deleteFinanceItem','saveSessionCashItem','deleteSessionCashItem','confirmPayment','confirmRefund','confirmForceRefund','refundDeposit','applyForceRefund','applyForceRefundFM','markPaymentScreenshot','sendPaymentReminder','getInvoiceList','updateInvoiceStatus','downloadSession']),
  sessions: new Set(['getDashboard','adminBusinessOverview','getSessionDashboard','getAdminSessionsDashboard','getAdminSessionDashboard','getEventsAdmin','getSessionsAdmin','getOperationUnitsAdmin','getBookingCalendarAdmin','getPromotionRulesAdmin','createEvent','updateEvent','deleteEvent','createSession','updateSession','copySession','deleteSession','toggleSession','toggleSessionStatus','saveOperationUnit','deleteOperationUnit','saveAnnouncement','deleteAnnouncement','sendNotify','resendInvite','resendRegConfirm']),
  review: new Set(['getSessionRegistrations','getRegs','getRegsBySession','approveReg','updateRegStatus','batchUpdateStatus','adminCancelReg','saveRegNote','saveMemberNote','updateRegistrationAction','setFastPass','previewForceCancelSession','forceCancelSession','runForceChoiceDeadline']),
  members: new Set(['getMembers','getMemberHistory','saveMember','listContactLeads','listPhotoLeads']),
  onsite: new Set(['onsiteSessions','onsiteRegs','onsitePasscodeList','onsitePasscodeGenerate','onsitePasscodeToggle','onsiteShiftList','onsiteShiftStart','onsiteShiftEnd','onsiteMark','checkin','markClear']),
  seats: new Set(['adminSeatBoard','adminAssignSeat','adminUnassignSeat','adminUpdateSeatPositions','runBatchAssign','saveSeatMap','saveSeatMapImage'])
};
const TENANT_ROLE_ALLOW = {
  owner:['organizer_owner','platform_super_admin'],
  settingsRead:['organizer_owner','organizer_admin','session_admin','finance_admin','platform_super_admin'],
  settings:['organizer_owner','organizer_admin','platform_super_admin'],
  finance:['organizer_owner','organizer_admin','finance_admin','platform_super_admin'],
  sessions:['organizer_owner','organizer_admin','session_admin','platform_super_admin'],
  review:['organizer_owner','organizer_admin','session_admin','platform_super_admin'],
  members:['organizer_owner','organizer_admin','session_admin','finance_admin','platform_super_admin'],
  onsite:['organizer_owner','organizer_admin','session_admin','onsite_staff','platform_super_admin'],
  seats:['organizer_owner','organizer_admin','session_admin','platform_super_admin']
};
function tenantRoleGroupForAction(action){for(const [group,actions] of Object.entries(TENANT_ROLE_ACTIONS))if(actions.has(action))return group;return ''}
async function enforceTenantRole(env,tenantId,action,payload){
  const group=tenantRoleGroupForAction(action);if(!group)return null;
  const email=normEmail(payload&&payload.email),token=String(payload&&payload.token||'');
  if(!email||!token)return jsonErr('此功能需要登入主辦工作台',401);
  const jwt=await verifyAdminToken(token,email,tenantId,env);if(!jwt)return jsonErr('登入已失效，請重新登入',401);
  let role=String(jwt.normalized_role||jwt.role||'').trim();
  if(role!=='platform_super_admin'){
    const rows=await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(tenantId)}&email=eq.${encodeURIComponent(email)}&select=normalized_role,role,is_active,active&limit=1`).catch(()=>[]);
    const staff=rows[0],active=staff&&(staff.is_active!==undefined?staff.is_active:staff.active);
    if(!staff||active===false)return jsonErr('此帳號沒有有效的租戶權限',403);
    role=String(staff.normalized_role||staff.role||role).trim();
  }
  if(!(TENANT_ROLE_ALLOW[group]||[]).includes(role))return jsonErr('你的角色不能執行這項操作',403);
  return null;
}

// 取得租戶 context（品牌資料、信件設定、SaaS 功能旗標）
async function getTenantCtx(env, tenantId) {
  const tid = tenantId ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  const [rows, moduleFlags, theme] = await Promise.all([
    dbGet(env, 'tenants', `id=eq.${tid}&select=id,name,slug,config_json,line_url,bank_info,email_from,email_reply_to,footer_text,site_url,default_refund_rules_json,payment_config_json`),
    getTenantModuleFlags(env, tid),
    getTenantTheme(env, tid),
  ]);
  const t = rows[0] || {};
  const cfg = safeJson(t.config_json, {});
  return {
    id:         tid,
    name:       t.name       || FALLBACK_TENANT_NAME,
    slug:       t.slug       || tid,
    siteUrl:    t.site_url   || cfg.siteUrl   || '',
    lineUrl:    t.line_url   || '',
    bankInfo:   t.bank_info  || '',
    emailFrom:  t.email_from || FALLBACK_EMAIL_FROM,
    emailReplyTo: t.email_reply_to || FALLBACK_EMAIL_REPLY,
    footer:     t.footer_text || (t.name || FALLBACK_TENANT_NAME) + '　All rights reserved.',
    color:      cfg.brandColor || '#2d6a4f',
    heroImg:    cfg.heroImg  || '',
    infoText:   cfg.infoText || '',
    defaultRefundRules: safeJson(t.default_refund_rules_json, DEFAULT_REFUND_RULES),
    paymentConfig: safeJson(t.payment_config_json, {}),
    moduleFlags,
    theme,
    businessType: moduleFlags.businessType || '',
    i18n:(cfg.i18n&&typeof cfg.i18n==='object')?cfg.i18n:{enabled:false,defaultLanguage:'zh-TW',languages:['zh-TW']},
  };
}


// ── SECTION 10.9: AI 主視覺生成模組（022）──────────────────────
function _aiVisualPresetKey(raw) {
  const s = String(raw || '').trim();
  return Object.prototype.hasOwnProperty.call(AI_VISUAL_PRESETS, s) ? s : '';
}
function _detectAiVisualPreset(sessionRow, eventRow, requested) {
  return _aiVisualPresetKey(requested) || 'general_event';
}
function _aiVisualDateText(sessionRow) {
  const dates = safeJson(sessionRow && sessionRow.dates_json, []);
  const out = (Array.isArray(dates) ? dates : []).map(d => {
    if (d && typeof d === 'object') return String(d.label || d.name || d.date || '').trim();
    return String(d || '').trim();
  }).filter(Boolean);
  return out.join('、');
}
function _aiVisualCleanContext(v, maxLen = 700) {
  return String(v || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
function _buildAiVisualPrompt(sessionRow, eventRow, presetKey, variantNo, visualThemeNote='') {
  const preset = AI_VISUAL_PRESETS[presetKey];
  const title = _aiVisualCleanContext(sessionRow.name, 120);
  const dateText = _aiVisualCleanContext(_aiVisualDateText(sessionRow), 160);
  const venue = _aiVisualCleanContext(sessionRow.venue, 180);
  const desc = _aiVisualCleanContext(sessionRow.description || (eventRow && eventRow.description) || '', 700);
  const themeNote = _aiVisualCleanContext(visualThemeNote, 400);
  const composition = variantNo === 1
    ? 'Use a strong primary composition with generous clean breathing room and clear visual hierarchy.'
    : 'Use a different but still clean composition with layered storytelling while preserving a clear overlay-safe area.';
  return [
    'Create a polished square 1:1 main visual background for this specific event or activity.',
    `This is the event subject: title=${title}; date=${dateText}; location=${venue}; description=${desc || 'none'}; visual theme note=${themeNote || 'none'}.`,
    'The image must clearly communicate the actual event type and activity context from the database. Do not default every event to a market scene or generic landscape.',
    'Required core scene language: depict concrete visual cues that match the event title, description, venue and activity type, with believable participants and event atmosphere when appropriate.',
    'Theme relevance is mandatory: use the event title, description and visual-theme note to decide the surrounding props, season, activities, objects, decorations and mood.',
    'If the location suggests a famous place, use it only as supporting context unless the event itself is explicitly about that place. The event activity remains the main subject.',
    `Brand preset: ${preset.label}.`,
    `Brand visual rules: ${preset.rules}.`,
    `Required subject emphasis: ${preset.subject}.`,
    `Strictly avoid: ${preset.avoid}.`,
    composition,
    'Hard output rules: no text, no letters, no numbers, no logos, no QR codes, no watermarks, no signage with readable writing. The system will overlay exact official elements after generation.',
    'Keep a stable illustration language, intentional negative space, strong readability for later overlay, and avoid clutter or generic stock-photo aesthetics.',
    'If unsure, prioritize the event description and actual activity type; avoid unrelated travel scenes, empty scenery or invented business content.'
  ].filter(Boolean).join('\n');
}
function _aiVisualBytesToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < arr.length; i += CHUNK) binary += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  return btoa(binary);
}
function _aiVisualXmlEscape(v) {
  return String(v == null ? '' : v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
async function _openAiGenerateSquareVisual(env, prompt) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY 環境變數未設定');
  const model = String(env.OPENAI_IMAGE_MODEL || AI_VISUAL_DEFAULT_MODEL).trim();
  const quality = String(env.OPENAI_IMAGE_QUALITY || AI_VISUAL_DEFAULT_QUALITY).trim();
  const payload = {
    model,
    prompt,
    n: 1,
    size: AI_VISUAL_SIZE,
    quality,
    output_format: 'png',
  };
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : text.slice(0, 700);
    throw new Error('OpenAI 產圖失敗（' + res.status + '）：' + msg);
  }
  const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw new Error('OpenAI 產圖成功但未回傳圖像資料');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, model, quality, usage: data.usage || null };
}
async function _aiVisualStorageUpload(env, storagePath, bytes, mime = 'image/png') {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
  if (!base || !key) throw new Error('Supabase Storage 環境變數未設定');
  const res = await fetch(base + '/storage/v1/object/' + AI_VISUAL_BUCKET + '/' + storagePath, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'apikey': key,
      'Content-Type': mime,
      'x-upsert': 'false',
    },
    body: bytes,
  });
  if (!res.ok) throw new Error('AI 主視覺 Storage 上傳失敗（' + res.status + '）：' + (await res.text()).slice(0, 500));
  return base + '/storage/v1/object/public/' + AI_VISUAL_BUCKET + '/' + storagePath;
}
async function _aiVisualStorageDelete(env, storagePath) {
  if (!storagePath) return;
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
  if (!base || !key) return;
  const res = await fetch(base + '/storage/v1/object/' + AI_VISUAL_BUCKET + '/' + storagePath, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + key, 'apikey': key },
  });
  if (!res.ok && res.status !== 404) throw new Error('Storage 刪除失敗（' + res.status + '）：' + (await res.text()).slice(0, 400));
}


async function hUploadCover(env,b){
  const TENANT=b&&b._tenantId;
  if(!await verifyStaff(env,b.email,b.token,TENANT,'sessions'))return jsonErr('無權限');
  const raw=String(b.image||'').trim();
  const m=raw.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if(!m)return jsonErr('圖片格式不支援，請使用 PNG、JPG 或 WebP');
  let bin;
  try{bin=atob(m[2].replace(/\s+/g,''));}catch(e){return jsonErr('圖片資料無法解析');}
  if(!bin.length)return jsonErr('圖片內容是空的');
  if(bin.length>6*1024*1024)return jsonErr('圖片過大，請控制在 6MB 以內');
  const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const ext=m[1]==='image/jpeg'?'jpg':(m[1]==='image/webp'?'webp':'png');
  const storagePath=`${TENANT}/manual/${genId('COVER')}.${ext}`;
  try{
    const url=await _aiVisualStorageUpload(env,storagePath,bytes,m[1]);
    await writeAuditLog(env,TENANT,b.email||'','admin','upload_cover','storage',storagePath,null,{url},{mime:m[1],size:bytes.length}).catch(()=>{});
    return jsonOk({success:true,url,storagePath});
  }catch(e){
    return jsonErr('圖片上傳失敗：'+(e&&e.message?e.message:'Storage 寫入失敗'));
  }
}



async function publicPlatformProfile(env){
  const p=await getPlatformSetting(env,'public_platform_profile',{});
  return {companyName:String(p.companyName||''),taxId:String(p.taxId||''),officialLineUrl:String(p.officialLineUrl||''),supportEmail:String(p.supportEmail||'Ndiangrace@gmail.com')};
}
async function hPublicPlatformProfile(env,p){return jsonOk(await publicPlatformProfile(env))}
async function hGetPlatformPublicProfile(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');return jsonOk(await publicPlatformProfile(env))}
async function hSavePlatformPublicProfile(env,b){
  const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  const value={companyName:String(b.companyName||'').trim(),taxId:String(b.taxId||'').trim(),officialLineUrl:String(b.officialLineUrl||'').trim(),supportEmail:normEmail(b.supportEmail||'')};
  const now=nowIso(),rows=await dbGet(env,'platform_settings','setting_key=eq.public_platform_profile&select=setting_key').catch(()=>[]);
  if(rows.length)await dbUpdate(env,'platform_settings','setting_key=eq.public_platform_profile',{value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});else await dbInsert(env,'platform_settings',{setting_key:'public_platform_profile',value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});
  return jsonOk(value);
}

// ── DOING 曝光推廣模組（007）─────────────────────────────────────
// exposure_orders 只保存「曝光權益」；活動名稱、日期、圖、地點永遠讀正式 sessions/events/tenants。
const EXPOSURE_HOME_PLACEMENT='home_activity_flash';
function exposurePublicSessionStatus(v){return ['報名中','開放中','開放'].includes(String(v||''))}
async function syncExposureStatuses(env){
  const now=nowIso(),q=encodeURIComponent(now);
  await dbUpdate(env,'exposure_orders',`status=eq.scheduled&starts_at=lte.${q}&ends_at=gt.${q}`,{status:'active',activated_at:now,updated_at:now}).catch(()=>{});
  await dbUpdate(env,'exposure_orders',`status=in.(scheduled,active)&ends_at=lte.${q}`,{status:'expired',updated_at:now}).catch(()=>{});
}
async function hPublicExposureFeed(env,p){
  await syncExposureStatuses(env);
  const now=nowIso(),q=encodeURIComponent(now);
  const orders=await dbGet(env,'exposure_orders',`placement=eq.${EXPOSURE_HOME_PLACEMENT}&status=eq.active&starts_at=lte.${q}&ends_at=gt.${q}&payment_status=eq.confirmed&select=*&order=activated_at.asc`).catch(()=>[]);
  if(!orders.length)return jsonOk({items:[]});
  const ids=[...new Set(orders.map(x=>String(x.session_id||'')).filter(Boolean))];
  const tid=[...new Set(orders.map(x=>String(x.tenant_id||'')).filter(Boolean))];
  const inQ=a=>a.map(x=>'"'+String(x).replace(/"/g,'')+'"').join(',');
  const [sessions,tenants,plans]=await Promise.all([
    dbGet(env,'sessions',`id=in.(${inQ(ids)})&select=id,tenant_id,event_id,name,status,venue,dates_json,cover_url,fee,modules_json`).catch(()=>[]),
    dbGet(env,'tenants',`id=in.(${inQ(tid)})&status=eq.active&is_locked=eq.false&select=id,name,slug,config_json`).catch(()=>[]),
    dbGet(env,'exposure_plans','select=id,name,placement,display_weight,sort_order').catch(()=>[])
  ]);
  const sm=Object.fromEntries(sessions.map(x=>[String(x.id),x])),tm=Object.fromEntries(tenants.map(x=>[String(x.id),x])),pm=Object.fromEntries(plans.map(x=>[String(x.id),x]));
  const eventIds=[...new Set(sessions.map(x=>String(x.event_id||'')).filter(Boolean))];
  const events=eventIds.length?await dbGet(env,'events',`id=in.(${inQ(eventIds)})&select=id,tenant_id,title,description,cover_url,status`).catch(()=>[]):[];
  const em=Object.fromEntries(events.map(x=>[String(x.id),x]));
  const out=[];
  for(const o of orders){
    const s=sm[String(o.session_id)],t=tm[String(o.tenant_id)],pl=pm[String(o.plan_id)]||{};
    if(!s||!t||String(s.tenant_id)!==String(o.tenant_id)||!exposurePublicSessionStatus(s.status))continue;
    const e=em[String(s.event_id||'')]||{};if(e.id&&String(e.tenant_id)!==String(o.tenant_id))continue;if(String(e.status||'')==='停用')continue;
    const cfg=safeJson(t.config_json,{});
    out.push({
      exposureOrderId:o.id,tenantId:o.tenant_id,tenantName:t.name||t.id,tenantLogo:String(cfg.logoUrl||cfg.logo_url||''),
      sessionId:s.id,sessionName:s.name||'',eventId:s.event_id||'',eventTitle:e.title||'',venue:s.venue||'',dates:safeJson(s.dates_json,[]),
      cover:s.cover_url||e.cover_url||String(cfg.heroImg||cfg.hero_img||''),fee:safeNum(s.fee),
      endsAt:o.ends_at||'',weight:Math.max(1,Number(pl.display_weight)||1),sortOrder:Number(pl.sort_order)||0
    });
  }
  out.sort((a,b)=>(b.sortOrder-a.sortOrder)||String(a.endsAt).localeCompare(String(b.endsAt)));
  return jsonOk({items:out});
}

// 匿名平台歸因：只保存活動鍵、來源、事件與隨機歸因碼，不保存 Email、手機、IP 或 User-Agent。
const PLATFORM_ATTRIBUTION_SOURCES=new Set(['paid_exposure','global_discovery']);
const PLATFORM_ATTRIBUTION_PUBLIC_EVENTS=new Set(['impression','click']);
function cleanAttributionId(v){const x=String(v||'').trim();return /^[A-Za-z0-9_-]{8,80}$/.test(x)?x:''}
function cleanAttributionPath(v){const x=String(v||'/').trim().slice(0,200);return x.startsWith('/')?x:'/'}
async function hTrackPlatformAttribution(env,b){
  const eventType=String(b.eventType||'').trim(),source=String(b.source||'').trim();
  const tenantId=String(b.tenantId||'').trim(),sessionId=String(b.sessionId||'').trim();
  const attributionId=cleanAttributionId(b.attributionId),exposureOrderId=String(b.exposureOrderId||'').trim();
  if(!PLATFORM_ATTRIBUTION_PUBLIC_EVENTS.has(eventType)||!PLATFORM_ATTRIBUTION_SOURCES.has(source))return jsonErr('歸因事件格式不正確');
  if(!tenantId||!sessionId||!attributionId)return jsonErr('歸因事件缺少活動資訊');
  const sessions=await dbGet(env,'sessions',`id=eq.${encodeURIComponent(sessionId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&select=id,tenant_id,status&limit=1`).catch(()=>[]);
  if(!sessions.length||!exposurePublicSessionStatus(sessions[0].status))return jsonErr('活動目前未公開');
  let orderId=null;
  if(source==='paid_exposure'){
    if(!exposureOrderId)return jsonErr('付費曝光事件缺少曝光訂單');
    const orders=await dbGet(env,'exposure_orders',`id=eq.${encodeURIComponent(exposureOrderId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&session_id=eq.${encodeURIComponent(sessionId)}&select=id&limit=1`).catch(()=>[]);
    if(!orders.length)return jsonErr('找不到對應的曝光訂單');
    orderId=orders[0].id;
  }
  const key=[eventType,source,attributionId,tenantId,sessionId].join(':');
  const row={id:genId('ATTR'),tenant_id:tenantId,session_id:sessionId,exposure_order_id:orderId,registration_id:null,attribution_id:attributionId,event_type:eventType,source,page_path:cleanAttributionPath(b.pagePath),idempotency_key:key,occurred_at:nowIso(),created_at:nowIso()};
  await dbUpsert(env,'platform_attribution_events',row,'idempotency_key');
  return jsonOk({ok:true,attributionId});
}
async function recordRegistrationAttribution(env,T,b,registrationId,sessionId){
  const attributionId=cleanAttributionId(b.doing_attribution_id||b.attributionId),source=String(b.doing_attribution_source||b.attributionSource||'').trim();
  const attributedSession=String(b.doing_attribution_session_id||b.attributionSessionId||'').trim();
  if(!attributionId||!PLATFORM_ATTRIBUTION_SOURCES.has(source)||attributedSession!==String(sessionId))return;
  const claimedOrderId=String(b.doing_exposure_order_id||b.exposureOrderId||'').trim();
  let clickQuery=`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sessionId)}&attribution_id=eq.${encodeURIComponent(attributionId)}&source=eq.${encodeURIComponent(source)}&event_type=eq.click&select=exposure_order_id&limit=1`;
  if(claimedOrderId)clickQuery+=`&exposure_order_id=eq.${encodeURIComponent(claimedOrderId)}`;
  const clicks=await dbGet(env,'platform_attribution_events',clickQuery).catch(()=>[]);if(!clicks.length)return;
  const exposureOrderId=String(clicks[0].exposure_order_id||'').trim()||null;
  const key=['registration',source,attributionId,T,sessionId,registrationId].join(':');
  await dbUpsert(env,'platform_attribution_events',{id:genId('ATTR'),tenant_id:T,session_id:sessionId,exposure_order_id:exposureOrderId,registration_id:registrationId,attribution_id:attributionId,event_type:'registration',source,page_path:cleanAttributionPath(b.doing_attribution_path||b.attributionPath),idempotency_key:key,occurred_at:nowIso(),created_at:nowIso()},'idempotency_key');
}
async function buildAttributionReport(env,{days=30,tenantId='',source=''}={}){
  days=Math.max(1,Math.min(365,parseInt(days,10)||30));
  const since=new Date(Date.now()-days*86400000).toISOString(),filters=[`occurred_at=gte.${encodeURIComponent(since)}`];
  if(tenantId)filters.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
  if(source)filters.push(`source=eq.${encodeURIComponent(source)}`);
  filters.push('select=tenant_id,session_id,exposure_order_id,event_type,source,occurred_at','order=occurred_at.desc','limit=5000');
  const events=await dbGet(env,'platform_attribution_events',filters.join('&')).catch(()=>[]);
  const tids=[...new Set(events.map(x=>String(x.tenant_id||'')).filter(Boolean))],sids=[...new Set(events.map(x=>String(x.session_id||'')).filter(Boolean))];
  const inQ=a=>a.map(x=>'"'+x.replace(/"/g,'')+'"').join(',');
  const [tenants,sessions]=await Promise.all([
    tids.length?dbGet(env,'tenants',`id=in.(${inQ(tids)})&select=id,name`).catch(()=>[]):[],
    sids.length?dbGet(env,'sessions',`id=in.(${inQ(sids)})&select=id,name`).catch(()=>[]):[]
  ]);
  const tm=Object.fromEntries(tenants.map(x=>[String(x.id),x.name||x.id])),sm=Object.fromEntries(sessions.map(x=>[String(x.id),x.name||x.id]));
  const totals={impressions:0,clicks:0,registrations:0,clickRate:0,registrationRate:0},groups={};
  for(const e of events){
    if(e.event_type==='impression')totals.impressions++;else if(e.event_type==='click')totals.clicks++;else if(e.event_type==='registration')totals.registrations++;
    const key=String(e.exposure_order_id||'')||[e.source,e.tenant_id,e.session_id].join(':');
    if(!groups[key])groups[key]={key,source:e.source,exposureOrderId:e.exposure_order_id||'',tenantId:e.tenant_id,tenantName:tm[String(e.tenant_id)]||e.tenant_id,sessionId:e.session_id,sessionName:sm[String(e.session_id)]||e.session_id,impressions:0,clicks:0,registrations:0,lastAt:e.occurred_at};
    if(e.event_type==='impression')groups[key].impressions++;else if(e.event_type==='click')groups[key].clicks++;else if(e.event_type==='registration')groups[key].registrations++;
  }
  totals.clickRate=totals.impressions?Number((totals.clicks/totals.impressions*100).toFixed(1)):0;
  totals.registrationRate=totals.clicks?Number((totals.registrations/totals.clicks*100).toFixed(1)):0;
  const campaigns=Object.values(groups).map(x=>({...x,clickRate:x.impressions?Number((x.clicks/x.impressions*100).toFixed(1)):0,registrationRate:x.clicks?Number((x.registrations/x.clicks*100).toFixed(1)):0})).sort((a,b)=>String(b.lastAt).localeCompare(String(a.lastAt)));
  return {days,totals,campaigns,truncated:events.length>=5000};
}
async function hGetPlatformAttributionReport(env,p){
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  return jsonOk(await buildAttributionReport(env,{days:p.days}));
}
async function hGetExposureCatalog(env,p){
  const T=p._tenantId;if(!await verifyStaff(env,p.email,p.token,T,'settings'))return jsonErr('無權限');
  await syncExposureStatuses(env);
  const [plans,sessions,events,orders,attributionReport]=await Promise.all([
    dbGet(env,'exposure_plans','is_active=eq.true&placement=eq.home_activity_flash&select=*&order=sort_order.desc,price.asc').catch(()=>[]),
    dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(T)}&status=in.(%E5%A0%B1%E5%90%8D%E4%B8%AD,%E9%96%8B%E6%94%BE%E4%B8%AD,%E9%96%8B%E6%94%BE)&select=id,event_id,name,status,venue,dates_json,cover_url,fee,created_at&order=created_at.desc`).catch(()=>[]),
    dbGet(env,'events',`tenant_id=eq.${encodeURIComponent(T)}&select=id,title,cover_url`).catch(()=>[]),
    dbGet(env,'exposure_orders',`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=created_at.desc`).catch(()=>[]),
    buildAttributionReport(env,{days:30,tenantId:T,source:'paid_exposure'})
  ]);
  const em=Object.fromEntries(events.map(x=>[String(x.id),x]));
  return jsonOk({plans,sessions:sessions.map(s=>({...s,eventTitle:(em[String(s.event_id)]||{}).title||'',cover:s.cover_url||(em[String(s.event_id)]||{}).cover_url||''})),orders,attributionReport});
}
async function hCreateExposureOrder(env,b){
  const T=b._tenantId;if(!await verifyStaff(env,b.email,b.token,T,'settings'))return jsonErr('無權限');
  const planId=String(b.planId||'').trim(),sessionId=String(b.sessionId||'').trim();if(!planId||!sessionId)return jsonErr('請選擇曝光方案與活動');
  const [plans,sessions]=await Promise.all([
    dbGet(env,'exposure_plans',`id=eq.${encodeURIComponent(planId)}&is_active=eq.true&select=*`).catch(()=>[]),
    dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(sessionId)}&select=id,status,name,event_id`).catch(()=>[])
  ]);
  const plan=plans[0],ses=sessions[0];if(!plan)return jsonErr('曝光方案目前未開放');if(!ses)return jsonErr('找不到活動');if(!exposurePublicSessionStatus(ses.status))return jsonErr('只有正式公開中的活動才能購買首頁曝光');
  const dup=await dbGet(env,'exposure_orders',`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sessionId)}&status=in.(pending_payment,scheduled,active)&select=id,status&limit=1`).catch(()=>[]);
  if(dup.length)return jsonErr('這個活動已有待付款或進行中的同方案曝光');
  let requested=null;if(b.requestedStartAt){const d=new Date(b.requestedStartAt);if(!Number.isNaN(d.getTime()))requested=d.toISOString()}
  const row={id:genId('EXP'),tenant_id:T,plan_id:plan.id,session_id:sessionId,placement:plan.placement||EXPOSURE_HOME_PLACEMENT,status:'pending_payment',payment_status:'pending',amount:safeNum(plan.price),requested_start_at:requested,created_by_email:b.email||'',note:String(b.note||''),created_at:nowIso(),updated_at:nowIso()};
  await dbInsert(env,'exposure_orders',row);return jsonOk({ok:true,order:row});
}
async function hCancelExposureOrder(env,b){
  const T=b._tenantId;if(!await verifyStaff(env,b.email,b.token,T,'settings'))return jsonErr('無權限');
  const id=String(b.orderId||'').trim();if(!id)return jsonErr('缺少曝光訂單');
  const rows=await dbGet(env,'exposure_orders',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`).catch(()=>[]);const o=rows[0];if(!o)return jsonErr('找不到曝光訂單');
  if(String(o.payment_status)==='confirmed'||['active','scheduled'].includes(String(o.status)))return jsonErr('已付款的曝光請聯繫 DOING 客服處理');
  await dbUpdate(env,'exposure_orders',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,{status:'cancelled',payment_status:'cancelled',cancelled_at:nowIso(),updated_at:nowIso()});return jsonOk({ok:true});
}
async function hGetExposurePlansPlatform(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');return jsonOk(await dbGet(env,'exposure_plans','select=*&order=sort_order.desc,created_at.asc').catch(()=>[]))}
async function hSaveExposurePlanPlatform(env,b){
  const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  const id=String(b.id||'').trim()||genId('EXPP'),code=String(b.code||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');const name=String(b.name||'').trim();
  const days=Math.max(1,Math.min(365,parseInt(b.durationDays,10)||0)),price=Math.max(0,Number(b.price)||0),weight=Math.max(1,Math.min(20,parseInt(b.displayWeight,10)||1)),sort=Math.max(-9999,Math.min(9999,parseInt(b.sortOrder,10)||0));
  if(!code||!name)return jsonErr('請填寫方案代碼與名稱');
  const data={code,name,placement:EXPOSURE_HOME_PLACEMENT,duration_days:days,price,display_weight:weight,sort_order:sort,is_active:b.isActive===true||b.isActive==='true',updated_at:nowIso()};
  const old=await dbGet(env,'exposure_plans',`id=eq.${encodeURIComponent(id)}&select=id`).catch(()=>[]);
  if(old.length)await dbUpdate(env,'exposure_plans',`id=eq.${encodeURIComponent(id)}`,data);else await dbInsert(env,'exposure_plans',{id,...data,config_json:{},created_at:nowIso()});
  return jsonOk({ok:true,id});
}
async function hGetPlatformExposureOrders(env,p){
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');await syncExposureStatuses(env);
  const orders=await dbGet(env,'exposure_orders','select=*&order=created_at.desc&limit=500').catch(()=>[]);if(!orders.length)return jsonOk([]);
  const tids=[...new Set(orders.map(x=>String(x.tenant_id||'')).filter(Boolean))],sids=[...new Set(orders.map(x=>String(x.session_id||'')).filter(Boolean))],pids=[...new Set(orders.map(x=>String(x.plan_id||'')).filter(Boolean))];const inQ=a=>a.map(x=>'"'+x.replace(/"/g,'')+'"').join(',');
  const [tenants,sessions,plans]=await Promise.all([dbGet(env,'tenants',`id=in.(${inQ(tids)})&select=id,name`).catch(()=>[]),dbGet(env,'sessions',`id=in.(${inQ(sids)})&select=id,tenant_id,name,status`).catch(()=>[]),dbGet(env,'exposure_plans',`id=in.(${inQ(pids)})&select=id,name,duration_days,price`).catch(()=>[])]);
  const tm=Object.fromEntries(tenants.map(x=>[x.id,x])),sm=Object.fromEntries(sessions.map(x=>[x.id,x])),pm=Object.fromEntries(plans.map(x=>[x.id,x]));
  return jsonOk(orders.map(o=>({...o,tenantName:(tm[o.tenant_id]||{}).name||o.tenant_id,sessionName:(sm[o.session_id]||{}).name||o.session_id,sessionStatus:(sm[o.session_id]||{}).status||'',planName:(pm[o.plan_id]||{}).name||o.plan_id,durationDays:(pm[o.plan_id]||{}).duration_days||0})));
}
async function hConfirmExposurePayment(env,b){
  const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  const id=String(b.orderId||'').trim();if(!id)return jsonErr('缺少曝光訂單');
  let startsAt=null;if(b.startsAt){const d=new Date(b.startsAt);if(!Number.isNaN(d.getTime()))startsAt=d.toISOString()}
  try{
    const result=await dbRpc(env,'confirm_exposure_payment_atomic',{p_order_id:id,p_confirmed_by:pay.email,p_starts_at:startsAt});
    return jsonOk(result&&typeof result==='object'?result:{ok:true});
  }catch(e){
    const t=String(e&&e.message||'');
    if(t.includes('EXPOSURE_ORDER_NOT_FOUND'))return jsonErr('找不到曝光訂單');
    if(t.includes('EXPOSURE_ORDER_CANCELLED'))return jsonErr('此曝光訂單已取消');
    if(t.includes('EXPOSURE_PLAN_NOT_FOUND'))return jsonErr('找不到曝光方案');
    return jsonErr('曝光收款確認失敗：'+t);
  }
}
async function hCancelExposurePlatform(env,b){const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');const id=String(b.orderId||'').trim();if(!id)return jsonErr('缺少曝光訂單');await dbUpdate(env,'exposure_orders',`id=eq.${encodeURIComponent(id)}`,{status:'cancelled',cancelled_at:nowIso(),updated_at:nowIso(),note:String(b.note||'平台取消曝光')});return jsonOk({ok:true})}


// ── SECTION 11: GET Handlers ─────────────────────────────────────


// DOING 公開平台首頁：跨主辦只讀取「正式公開」資料。
// 不回傳 staff、會員、付款、財務或任何主辦私有設定。
async function hPublicDiscovery(env,p){
  const [tenants,events,sessions,units,logs]=await Promise.all([
    dbGet(env,'tenants','status=eq.active&is_locked=eq.false&select=id,name,slug,config_json,created_at').catch(()=>[]),
    dbGet(env,'events','status=neq.%E5%81%9C%E7%94%A8&select=id,tenant_id,title,description,location,cover_url,status').catch(()=>[]),
    dbGet(env,'sessions','status=in.(%E5%A0%B1%E5%90%8D%E4%B8%AD,%E9%96%8B%E6%94%BE%E4%B8%AD,%E9%96%8B%E6%94%BE)&select=id,tenant_id,event_id,name,status,venue,dates_json,cover_url,modules_json,fee,deposit,created_at').catch(()=>[]),
    dbGet(env,'operation_units','status=in.(open,active,published)&select=id,tenant_id,event_id,session_id,name,unit_type,status,description,fee,modules_json,sort_order,created_at').catch(()=>[]),
    dbGet(env,'billing_logs','status=eq.confirmed&select=tenant_id,billing_type,period_end').catch(()=>[])
  ]);
  const tenantMap=new Map();
  for(const t of tenants){
    const cfg=safeJson(t.config_json,{});
    tenantMap.set(String(t.id),{
      id:t.id,name:t.name||t.id,slug:t.slug||t.id,
      logoUrl:String(cfg.logoUrl||cfg.logo_url||''),
      heroImg:String(cfg.heroImg||cfg.hero_img||''),
      infoText:String(cfg.infoText||cfg.info_text||'')
    });
  }
  const now=Date.now(),billingByTenant=new Map();
  for(const x of logs){
    const k=String(x.tenant_id||''); if(!billingByTenant.has(k))billingByTenant.set(k,[]);
    billingByTenant.get(k).push(x);
  }
  const bookingActive=T=>(billingByTenant.get(String(T))||[]).some(x=>String(x.billing_type)==='booking_monthly'&&x.period_end&&new Date(x.period_end).getTime()>now);
  const activityEntitled=(T,sid)=>(billingByTenant.get(String(T))||[]).some(x=>String(x.billing_type)===billingTypeForActivity(sid));
  const unitEntitled=(T,uid)=>(billingByTenant.get(String(T))||[]).some(x=>String(x.billing_type)===billingTypeForOperationUnit(uid));
  const eventMap=new Map(events.map(e=>[String(e.id),e]));
  const result=[];
  for(const s of sessions){
    const T=String(s.tenant_id||''),tenant=tenantMap.get(T);if(!tenant)continue;
    const mods=normalizeSessionModules(safeJson(s.modules_json,{}));
    const unitRows=units.filter(u=>String(u.tenant_id)===T&&String(u.session_id)===String(s.id));
    const sessionPaid=String(mods.operatingMode||'activity')==='booking'?bookingActive(T):activityEntitled(T,s.id);
    const publicUnits=unitRows.filter(u=>{
      const um=normalizeSessionModules(safeJson(u.modules_json,{}));
      return String(um.operatingMode||'activity')==='booking'?bookingActive(T):unitEntitled(T,u.id);
    });
    if(!sessionPaid&&!publicUnits.length)continue;
    const ev=eventMap.get(String(s.event_id||''))||{};
    result.push({
      tenantId:T,tenantName:tenant.name,tenantSlug:tenant.slug,tenantLogo:tenant.logoUrl,
      eventId:s.event_id||'',eventTitle:ev.title||'',
      sessionId:s.id,sessionName:s.name||'',status:s.status||'',venue:s.venue||'',
      dates:safeJson(s.dates_json,[]),cover:s.cover_url||ev.cover_url||tenant.heroImg||'',
      description:ev.description||'',fee:safeNum(s.fee),deposit:safeNum(s.deposit),
      operationUnits:publicUnits.map(u=>({id:u.id,name:u.name||'',unitType:u.unit_type||'registration',fee:safeNum(u.fee)}))
    });
  }
  result.sort((a,b)=>{
    const first=x=>{const ds=Array.isArray(x.dates)?x.dates:[];const d=ds[0];return new Date((d&&typeof d==='object'?d.date:d)||'2999-12-31').getTime()||Number.MAX_SAFE_INTEGER};
    return first(a)-first(b);
  });
  return jsonOk({items:result.slice(0,200),organizers:[...tenantMap.values()]});
}

// 「我的報名」跨主辦查詢。
// 權限核心：只以使用者提供的 Email 查候選，再以手機逐筆配對；
// 回傳的每一筆都必須是該本人自己的 registration。
// 主辦後台完全不使用此 API，因此不會取得其他 Tenant 資料。
async function hGetMyRegsGlobal(env,p){
  const verified=await verifiedPlatformMember(env,p&&(p.member_token||p.memberToken||p.token));
  if(!verified||!platformMemberComplete(verified.row))return jsonErr('會員登入已失效，請重新使用 LINE 登入');
  const memberId=String(verified.row.id||'').trim();
  if(!memberId)return jsonErr('找不到會員資料，請重新使用 LINE 登入');
  const accessible=await memberRegistrationRows(env,memberId),regs=accessible.rows,membershipMap=accessible.membershipMap;
  if(!regs.length)return jsonOk([]);
  const tenantIds=[...new Set(regs.map(r=>String(r.tenant_id||'')).filter(Boolean))];
  const sessionIds=[...new Set(regs.map(r=>String(r.session_id||'')).filter(Boolean))];
  const unitIds=[...new Set(regs.map(r=>String(r.operation_unit_id||'')).filter(Boolean))];
  const eventIds=[...new Set(regs.map(r=>String(r.event_id||'')).filter(Boolean))];
  const inQ=a=>a.map(x=>'"'+String(x).replace(/"/g,'')+'"').join(',');
  const [tenants,sessions,units,events]=await Promise.all([
    tenantIds.length?dbGet(env,'tenants',`id=in.(${inQ(tenantIds)})&select=id,name,slug,config_json`).catch(()=>[]):[],
    sessionIds.length?dbGet(env,'sessions',`id=in.(${inQ(sessionIds)})&select=id,tenant_id,event_id,name,venue,dates_json,equip_json,basic_equip,seat_pricing_enabled,seat_hold_hours,seat_map_url,force_cancel,force_cancel_deadline,force_cancel_target_id,modules_json`).catch(()=>[]):[],
    unitIds.length?dbGet(env,'operation_units',`id=in.(${inQ(unitIds)})&select=id,tenant_id,session_id,event_id,name,modules_json`).catch(()=>[]):[],
    eventIds.length?dbGet(env,'events',`id=in.(${inQ(eventIds)})&select=id,tenant_id,title`).catch(()=>[]):[]
  ]);
  const tMap=Object.fromEntries(tenants.map(x=>[String(x.id),x]));
  const sMap=Object.fromEntries(sessions.map(x=>[String(x.id),x]));
  const uMap=Object.fromEntries(units.map(x=>[String(x.id),x]));
  const eMap=Object.fromEntries(events.map(x=>[String(x.id),x]));
  const out=[];
  for(const r of regs){
    const T=String(r.tenant_id||''),t=tMap[T]||{},s=sMap[String(r.session_id)]||{},u=uMap[String(r.operation_unit_id)]||null;
    // 關聯資料再驗 tenant，防止錯 ID 交叉串接。
    if(s.id&&String(s.tenant_id)!==T)continue;
    if(u&&String(u.tenant_id)!==T)continue;
    const ev=eMap[String(r.event_id||s.event_id||'')]||{};
    if(ev.id&&String(ev.tenant_id)!==T)continue;
    const paySnap=await ensurePaymentSnapshotForReg(env,T,r,s,{writeIfSafe:false}).catch(()=>_paymentSnapshotFromReg(r));
    const payPub=_paymentSnapshotPublic(paySnap);
    let displayDates=safeJson(s.dates_json,[]);
    if(u){
      const uts=await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(u.id)}&select=*&order=date_key.asc,start_text.asc`).catch(()=>[]);
      if(uts.length)displayDates=uts.map(x=>({date:x.date_key,label:x.label||x.date_key,start:x.start_text||'',end:x.end_text||'',timeslotId:x.id,limit:safeNum(x.capacity)}));
    }
    const cfg=safeJson(t.config_json,{});
    const membership=membershipMap[String(r.id)]||null,memberPermissions=membership?safeJson(membership.permissions_json,{}):registrationSubmitterPermissions();
    out.push({
      tenantId:T,tenantName:t.name||T,tenantSlug:t.slug||T,tenantLogo:String(cfg.logoUrl||cfg.logo_url||''),tenantLineUrl:String(cfg.lineUrl||cfg.line_url||''),
      eventId:r.event_id||s.event_id||'',eventTitle:ev.title||'',
      id:r.id,sessionId:r.session_id,sessionName:s.name||r.session_id,operationUnitId:r.operation_unit_id||'',operationUnitName:u?.name||'',
      name:r.name||'',brandId:r.brand_id||'',brand:r.brand_name||'',memberRole:membership?.role||'submitter',memberPermissions,venue:s.venue||'',sessionDates:displayDates,
      status:r.review_status,payStatus:r.payment_status,amount:Number(r.amount||0),total:Number(r.total_amount||r.amount||0),paid:Number(r.paid_amount||0),
      due:(()=>{const snap=selectedModuleSnapshot(r),paid=safeNum(r.paid_amount),total=safeNum(r.total_amount||r.amount);const first=safeNum(snap.amountDueNow);return Math.max(0,(paid<=0&&first>0?first:total)-paid)})(),
      deposit:Number(r.deposit||0),stallCount:Number(r.stall_count||1),selectedDates:safeJson(r.selected_dates_json,[]),equip:safeJson(r.equipment_json,{}),addonQty:safeJson(r.addon_qty_json,{}),participants:safeJson(r.participants_json,{}),
      totalEquipmentText:_equipmentTextFromMap(_effectiveEquipmentMapForReg(r,s)),stallNumber:r.stall_number||'',
      seatChoiceIntent:r.seat_choice_intent||'auto',seatChoiceStatus:r.seat_choice_status||'',seatChoiceType:r.seat_choice_type||'',
      bundleId:r.bundle_id||'',bundleGroupId:r.bundle_group_id||'',paymentDueAt:r.payment_due_at||'',paymentReminderAt:r.payment_reminder_at||'',paymentExpiredAt:r.payment_expired_at||'',seatHoldExpiresAt:r.seat_hold_expires_at||'',
      transferCreditAmount:safeNum(r.transfer_credit_amount),transferBalanceDue:safeNum(r.transfer_balance_due),transferRefundDue:safeNum(r.transfer_refund_due),
      seatPricingEnabled:(s.seat_pricing_enabled===true||s.seat_pricing_enabled==='true'),seatHoldHours:safeNum(s.seat_hold_hours)||SEAT_HOLD_HOURS,
      seatMapUrl:s.seat_map_url||'',seatFeeTotal:safeNum(r.seat_fee_total),payMethod:r.payment_method||'',payLast5:r.payment_last5||'',checkin:r.checkin_status,teardownStatus:r.teardown_status||'未撤場',clearStatus:r.clear_status||'未清場',createdAt:r.created_at,approvedAt:r.approved_at||'',paymentReportedAt:r.payment_reported_at||'',paidAt:r.paid_at||'',checkinAt:r.checkin_at||'',
      transferStatus:r.transfer_status||'',refundAmount:safeNum(r.refund_amount),refundedAt:r.refunded_at||'',refundNote:r.refund_note||'',forceStatus:r.force_status||(s.force_cancel?'pending_force_choice':null),
      forceChoiceDeadline:s.force_cancel_deadline||'',forceCancelled:s.force_cancel||false,forceTransferTargetSessionId:r.transferred_to_session_id||s.force_cancel_target_id||'',
      modules:normalizeSessionModules(u?safeJson(u.modules_json,{}):safeJson(s.modules_json,{})),
      paymentProfile:payPub,paymentProfileName:payPub.paymentProfileName,paymentOwnerMode:payPub.paymentOwnerMode,
      allowedPaymentMethods:payPub.allowedMethods,bankAccount:payPub.bankAccount,linepay:payPub.linepay,card:payPub.card
    });
  }
  return jsonOk(out);
}


// frontBootstrap：前台資料庫主導總入口

function normalizedTableId(prefix,sessionId,rawId,index){
  const clean=String(rawId||'').trim().replace(/[^A-Za-z0-9_-]/g,'_');
  return clean?`${prefix}_${sessionId}_${clean}`:`${prefix}_${sessionId}_${index+1}`;
}
async function syncSessionTranslations(env,T,s){
  try{
    const sid=String(s&&s.id||''); if(!sid)return;
    const mods=normalizeSessionModules(safeJson(s.modules_json,{})),now=nowIso();
    const all=(mods.i18n&&mods.i18n.translations)||{};
    for(const locale of Object.keys(all)){
      if(locale==='zh-TW')continue;
      const fields=all[locale]||{};
      for(const [field,val] of Object.entries(fields)){
        const value=String(val||'').trim(); if(!value)continue;
        const id=`TR_${sid}_${locale}_${field}`.replace(/[^A-Za-z0-9_-]/g,'_');
        const found=await dbGet(env,'translations',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(id)}&select=id`).catch(()=>[]);
        const payload={entity_type:'session',entity_id:sid,locale,field_name:field,value,source:'manual',updated_at:now};
        if(found.length)await dbUpdate(env,'translations',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(id)}`,payload);
        else await dbInsert(env,'translations',{id,tenant_id:T,created_at:now,...payload});
      }
    }
  }catch(e){console.error('translation sync skipped',e?.message||e)}
}
async function syncNormalizedSessionCatalogs(env,T,s){
  try{
    const sid=String(s.id||'');if(!sid)return;
    const mods=normalizeSessionModules(safeJson(s.modules_json,{}));
    const sync=async(table,prefix,items,mapper)=>{
      const old=await dbGet(env,table,`tenant_id=eq.${T}&session_id=eq.${encodeURIComponent(sid)}&select=id`).catch(()=>[]);
      const keep=new Set();
      for(let i=0;i<items.length;i++){
        const x=items[i]||{},id=normalizedTableId(prefix,sid,x.id,i);keep.add(id);
        const p=mapper(x,i);const hit=old.some(y=>String(y.id)===id);
        if(hit)await dbUpdate(env,table,`tenant_id=eq.${T}&id=eq.${encodeURIComponent(id)}`,{...p,updated_at:now});
        else await dbInsert(env,table,{id,tenant_id:T,session_id:sid,...p,created_at:now,updated_at:now});
      }
      for(const x of old)if(!keep.has(String(x.id)))await dbDelete(env,table,`tenant_id=eq.${T}&id=eq.${encodeURIComponent(x.id)}`).catch(()=>{});
    };
    await sync('service_items','SVC',mods.services,(x,i)=>({name:String(x.label||x.name||''),description:String(x.description||''),price:safeNum(x.price),duration_minutes:Math.max(0,parseInt(x.durationMinutes||0,10)||0),capacity:Math.max(0,parseInt(x.capacity||0,10)||0),active:x.active!==false,sort_order:i,config_json:x.config||{}}));
    await sync('resources','RES',mods.resources,(x,i)=>({name:String(x.label||x.name||''),resource_type:String(x.resourceType||'staff'),staff_id:x.staffId||null,capacity:Math.max(1,parseInt(x.capacity||1,10)||1),active:x.active!==false,sort_order:i,config_json:{price:safeNum(x.price),...(x.config||{})}}));
    if(mods.workshopSlots){
      const dates=_sessionDateRows(s.dates_json||[]),old=await dbGet(env,'timeslots',`tenant_id=eq.${T}&session_id=eq.${encodeURIComponent(sid)}&select=*`).catch(()=>[]),keep=new Set();
      for(const d of dates){
        const hit=old.find(x=>String(x.date_key||'')===d.date&&String(x.start_text||'')===String(d.start||'')&&String(x.end_text||'')===String(d.end||''));
        const id=hit?.id||`TS_${crypto.randomUUID().replace(/-/g,'').slice(0,20)}`;keep.add(String(id));
        const p={date_key:d.date,label:d.label||d.date,start_text:d.start||'',end_text:d.end||'',capacity:Math.max(0,parseInt(d.limit||0,10)||0),status:'open',updated_at:now};
        if(hit)await dbUpdate(env,'timeslots',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(id)}`,p);
        else await dbInsert(env,'timeslots',{id,tenant_id:T,session_id:sid,reserved_count:0,confirmed_count:0,config_json:{},created_at:now,...p});
      }
      for(const x of old)if(!keep.has(String(x.id)))await dbUpdate(env,'timeslots',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(x.id)}`,{status:'closed',updated_at:now}).catch(()=>{});
    }
    await syncSessionTranslations(env,T,s);
  }catch(e){console.error('normalized catalog sync skipped',e?.message||e)}
}
async function hydrateNormalizedSession(env,T,s){
  const row={...s},mods=normalizeSessionModules(safeJson(s.modules_json,{}));
  try{
    const [sv,res,ts,tr]=await Promise.all([
      dbGet(env,'service_items',`tenant_id=eq.${T}&session_id=eq.${encodeURIComponent(s.id)}&active=eq.true&select=*&order=sort_order.asc`).catch(()=>[]),
      dbGet(env,'resources',`tenant_id=eq.${T}&session_id=eq.${encodeURIComponent(s.id)}&active=eq.true&select=*&order=sort_order.asc`).catch(()=>[]),
      dbGet(env,'timeslots',`tenant_id=eq.${T}&session_id=eq.${encodeURIComponent(s.id)}&status=eq.open&select=*&order=date_key.asc,start_text.asc`).catch(()=>[]),
      dbGet(env,'translations',`tenant_id=eq.${T}&entity_type=eq.session&entity_id=eq.${encodeURIComponent(s.id)}&select=locale,field_name,value`).catch(()=>[])
    ]);
    if(sv.length)mods.services=sv.map(x=>({id:x.id,label:x.name,description:x.description,price:safeNum(x.price),durationMinutes:safeNum(x.duration_minutes),capacity:safeNum(x.capacity)}));
    if(res.length)mods.resources=res.map(x=>({id:x.id,label:x.name,resourceType:x.resource_type,staffId:x.staff_id,price:safeNum((x.config_json||{}).price),capacity:safeNum(x.capacity)}));
    if(tr.length){mods.i18n=mods.i18n||{enabled:true,languages:['zh-TW'],translations:{}};mods.i18n.translations=mods.i18n.translations||{};for(const x of tr){mods.i18n.translations[x.locale]=mods.i18n.translations[x.locale]||{};mods.i18n.translations[x.locale][x.field_name]=x.value}}
    if(ts.length){
      const dates=_sessionDateRows(s.dates_json||[]),map=new Map(ts.map(x=>[`${x.date_key}|${x.start_text||''}|${x.end_text||''}`,x]));
      row.dates_json=JSON.stringify(dates.map(d=>{const x=map.get(`${d.date}|${d.start||''}|${d.end||''}`);return x?{...d,timeslotId:x.id,limit:safeNum(x.capacity),remaining:x.capacity>0?Math.max(0,safeNum(x.capacity)-safeNum(x.reserved_count)-safeNum(x.confirmed_count)):0}:d}));
    }
    row.modules_json=JSON.stringify(mods);
  }catch(e){}
  return row;
}

// ── DOING 統一營運單元 / 通知 / 回饋核心 ───────────────────────
function formatOperationUnit(u){
  const modules=normalizeSessionModules(safeJson(u&&u.modules_json,{}));
  return {
    id:u.id,tenantId:u.tenant_id,eventId:u.event_id||'',sessionId:u.session_id,
    code:u.code||'',name:u.name||'',unitType:u.unit_type||'registration',status:u.status||'draft',
    description:u.description||'',capacity:safeNum(u.capacity),currentCount:safeNum(u.current_count),fee:safeNum(u.fee),
    modules,pricing:safeJson(u.pricing_json,{}),policy:safeJson(u.policy_json,{}),
    publicConfig:safeJson(u.public_config_json,{}),sortOrder:safeNum(u.sort_order),createdAt:u.created_at,updatedAt:u.updated_at
  };
}
function operationUnitIsOpen(u){return ['open','active','published'].includes(String(u&&u.status||''))}
async function getOperationUnitRow(env,T,id,sessionId=''){
  if(!id)return null;
  let q=`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`;
  if(sessionId)q+=`&session_id=eq.${encodeURIComponent(sessionId)}`;
  const rows=await dbGet(env,'operation_units',q).catch(()=>[]);return rows[0]||null;
}
async function operationUnitEntitlementActive(env,T,u){
  if(!u)return false;const m=normalizeSessionModules(safeJson(u.modules_json,{}));
  if(String(m.operatingMode||'activity')==='booking')return !!(await activeBookingEntitlement(env,T));
  return await hasOperationUnitEntitlement(env,T,u.id);
}
async function ensureOperationUnitEntitlement(env,T,u){
  const m=normalizeSessionModules(safeJson(u.modules_json,{})),mode=String(m.operatingMode||'activity'),fees=await platformBillingPolicy(env);
  if(mode==='booking'){
    const active=await activeBookingEntitlement(env,T);if(active)return {ok:true,mode,periodEnd:active.period_end};
    const end=addCalendarMonthTaipei(nowIso()),c=await consumeCreditOrNeedPayment(env,T,fees.bookingMonthlyFee,'booking_monthly','unit:'+u.id,end);if(!c.ok){await ensurePendingBillingLog(env,T,'booking_monthly',fees.bookingMonthlyFee,'等待租戶繳交預約營運月費','',end);return {...c,mode}}
    try{await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:'booking_monthly',amount:fees.bookingMonthlyFee,tax:0,total:fees.bookingMonthlyFee,status:'confirmed',confirmed_at:nowIso(),confirmed_by:'platform_credit',period_start:nowIso(),period_end:end,note:'預約營運月方案｜'+u.id,created_at:nowIso()})}catch(e){await rollbackPlatformCreditUse(env,T,fees.bookingMonthlyFee,c.ledgerId,'booking_unit_entitlement_failed').catch(()=>{});throw e}return {ok:true,mode,periodEnd:end};
  }
  if(isPaidOperatingUnit(u))return {ok:true,mode,chargeMode:'paid_activity_rate'};
  if(await hasOperationUnitEntitlement(env,T,u.id))return {ok:true,mode};
  const c=await consumeCreditOrNeedPayment(env,T,fees.freeActivityFee,'activity_unit',u.id);if(!c.ok){await ensurePendingBillingLog(env,T,billingTypeForOperationUnit(u.id),fees.freeActivityFee,'等待租戶繳交免費獨立活動啟用費',u.session_id||'');return {...c,mode}}
  try{await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:billingTypeForOperationUnit(u.id),amount:fees.freeActivityFee,tax:0,total:fees.freeActivityFee,status:'confirmed',confirmed_at:nowIso(),confirmed_by:'platform_credit',period_start:nowIso(),period_end:null,note:'營運項目正式開通｜'+u.id,created_at:nowIso()})}catch(e){await rollbackPlatformCreditUse(env,T,fees.freeActivityFee,c.ledgerId,'activity_unit_entitlement_failed').catch(()=>{});throw e}return {ok:true,mode};
}
async function anyOpenUnitEntitled(env,T,sessionId){
  const rows=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sessionId)}&status=in.(open,active,published)&select=*`).catch(()=>[]);
  for(const u of rows)if(await operationUnitEntitlementActive(env,T,u))return true;return false;
}
function unitTypeAllowed(v){return ['market','registration','booking','beauty','workshop','course','guide','staff','generic'].includes(String(v||''))?String(v):'registration'}
function unitStatusAllowed(v){return ['draft','pending_payment','open','active','published','closed','archived'].includes(String(v||''))?String(v):'draft'}
function unitCode(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)}

function formatBookingCalendar(x){return {id:String(x.id||''),name:String(x.name||'預約日曆'),color:String(x.color||'#8bbfd1'),status:String(x.status||'active'),operationUnitId:String(x.operation_unit_id||''),ownerStaffId:String(x.owner_staff_id||''),sortOrder:safeNum(x.sort_order),config:safeJson(x.config_json,{})}}
async function bookingCalendarsForTenant(env,T){return dbGet(env,'booking_calendars',`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=sort_order.asc,created_at.asc`).catch(()=>[])}
async function ensureBookingCalendar(env,T,{id='',name='主要預約日曆',operationUnitId='',color='#8bbfd1'}={}){
  const rows=await bookingCalendarsForTenant(env,T),cleanName=String(name||'主要預約日曆').trim().slice(0,60)||'主要預約日曆';
  let hit=id?rows.find(x=>String(x.id)===String(id)):null;if(!hit&&cleanName)hit=rows.find(x=>String(x.name).toLowerCase()===cleanName.toLowerCase()&&(!operationUnitId||!x.operation_unit_id||String(x.operation_unit_id)===String(operationUnitId)));
  if(hit)return hit;
  const now=nowIso(),calendar={id:genId('CAL'),tenant_id:T,operation_unit_id:operationUnitId||null,name:cleanName,color:/^#[0-9a-f]{6}$/i.test(color)?color:'#8bbfd1',status:'active',owner_staff_id:null,sort_order:rows.length,config_json:{},created_at:now,updated_at:now};await dbInsert(env,'booking_calendars',calendar);return calendar;
}
async function hGetBookingCalendarAdmin(env,p){
  const T=p._tenantId;if(!await verifyStaff(env,p.email,p.token,T,'sessions'))return jsonErr('無權限');
  const [calendars,regs]=await Promise.all([bookingCalendarsForTenant(env,T),dbGet(env,'registrations',`tenant_id=eq.${encodeURIComponent(T)}&select=id,session_id,operation_unit_id,booking_calendar_id,name,brand_name,email,phone,selected_dates_json,custom_fields_json,review_status,registration_status,payment_status,transfer_status&order=created_at.desc&limit=3000`).catch(()=>[])]);
  const slotIds=[...new Set(regs.flatMap(registrationTimeslotIds))],slots=slotIds.length?await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&id=in.(${slotIds.map(x=>encodeURIComponent(x)).join(',')})&select=id,date_key,start_text,end_text,booking_calendar_id,operation_unit_id`).catch(()=>[]):[],slotMap=Object.fromEntries(slots.map(x=>[String(x.id),x])),calByUnit={};for(const c of calendars)if(c.operation_unit_id&&!calByUnit[c.operation_unit_id])calByUnit[c.operation_unit_id]=c.id;
  const bookings=[];for(const r of regs){const ids=registrationTimeslotIds(r);for(const slotId of ids){const s=slotMap[slotId];if(!s)continue;const calendarId=String(r.booking_calendar_id||s.booking_calendar_id||calByUnit[r.operation_unit_id]||'');bookings.push({id:r.id,slotId,calendarId,date:s.date_key,time:s.start_text||'',end:s.end_text||'',name:r.brand_name||r.name||'預約',email:r.email||'',phone:r.phone||'',sessionId:r.session_id||'',operationUnitId:r.operation_unit_id||'',reviewStatus:r.review_status||'',registrationStatus:r.registration_status||'',paymentStatus:r.payment_status||'',transferStatus:r.transfer_status||''})}}
  return jsonOk({calendars:calendars.map(formatBookingCalendar),bookings});
}
async function hSaveBookingCalendar(env,b){
  const T=b._tenantId;if(!await verifyStaff(env,b.email,b.token,T,'settings'))return jsonErr('無權限');const name=String(b.name||'').trim().slice(0,60);if(!name)return jsonErr('請填預約日曆名稱');
  const id=String(b.id||genId('CAL')),old=await dbGet(env,'booking_calendars',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`).catch(()=>[]),operationUnitId=String(b.operationUnitId||old[0]?.operation_unit_id||'').trim(),ownerStaffId=String(b.ownerStaffId||'').trim();
  if(operationUnitId){const u=await getOperationUnitRow(env,T,operationUnitId);if(!u)return jsonErr('找不到指定的營運項目')}
  if(ownerStaffId){const s=await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(ownerStaffId)}&select=id`).catch(()=>[]);if(!s.length)return jsonErr('找不到指定的工作人員')}
  const status=['active','inactive','archived'].includes(String(b.status))?String(b.status):(old[0]?.status||'active'),color=/^#[0-9a-f]{6}$/i.test(String(b.color||''))?String(b.color):String(old[0]?.color||'#8bbfd1'),now=nowIso(),data={name,color,status,operation_unit_id:operationUnitId||null,owner_staff_id:ownerStaffId||null,sort_order:Math.max(0,parseInt(b.sortOrder??old[0]?.sort_order??0,10)||0),config_json:(b.config&&typeof b.config==='object')?b.config:safeJson(old[0]?.config_json,{}),updated_at:now};
  if(old.length)await dbUpdate(env,'booking_calendars',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,data);else await dbInsert(env,'booking_calendars',{id,tenant_id:T,created_at:now,...data});
  if(b.assignExistingSlots===true&&operationUnitId)await dbUpdate(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(operationUnitId)}&booking_calendar_id=is.null`,{booking_calendar_id:id,updated_at:now}).catch(()=>{});
  const fresh=(await dbGet(env,'booking_calendars',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`))[0];await writeAuditLog(env,T,b.email||'','admin',old.length?'update_booking_calendar':'create_booking_calendar','booking_calendars',id,old[0]||null,fresh,{}).catch(()=>{});return jsonOk(formatBookingCalendar(fresh));
}

async function syncOperationUnitCatalogs(env,T,u){
  const uid=String(u.id),sid=String(u.session_id),mods=normalizeSessionModules(safeJson(u.modules_json,{})),pub=safeJson(u.public_config_json,{}),now=nowIso();
  const sync=async(table,prefix,items,mapper)=>{
    const old=await dbGet(env,table,`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(uid)}&select=id`).catch(()=>[]),keep=new Set();
    for(let i=0;i<items.length;i++){
      const x=items[i]||{},id=normalizedTableId(prefix,uid,x.id,i);keep.add(id);const payload={...mapper(x,i),session_id:sid,operation_unit_id:uid,updated_at:now};
      if(old.some(y=>String(y.id)===id))await dbUpdate(env,table,`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,payload);
      else await dbInsert(env,table,{id,tenant_id:T,created_at:now,...payload});
    }
    for(const x of old)if(!keep.has(String(x.id)))await dbDelete(env,table,`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(x.id)}`).catch(()=>{});
  };
  await sync('service_items','USVC',mods.services,(x,i)=>({name:String(x.label||x.name||''),description:String(x.description||''),price:safeNum(x.price),duration_minutes:Math.max(0,parseInt(x.durationMinutes||0,10)||0),capacity:Math.max(0,parseInt(x.capacity||0,10)||0),active:x.active!==false,sort_order:i,config_json:x.config||{}}));
  await sync('resources','URES',mods.resources,(x,i)=>({name:String(x.label||x.name||''),resource_type:String(x.resourceType||'staff'),staff_id:x.staffId||null,capacity:Math.max(1,parseInt(x.capacity||1,10)||1),active:x.active!==false,sort_order:i,config_json:{price:safeNum(x.price),...(x.config||{})}}));
  const slots=Array.isArray(pub.timeslots)?pub.timeslots:[],bookingMode=String(mods.operatingMode||'activity')==='booking';
  const oldSlots=await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(uid)}&select=*`).catch(()=>[]),keep=new Set();
  for(let i=0;i<slots.length;i++){
    const x=slots[i]||{},date=String(x.date||x.dateKey||'').slice(0,10),start=String(x.start||x.startText||''),end=String(x.end||x.endText||''),hit=oldSlots.find(y=>String(y.date_key||'')===date&&String(y.start_text||'')===start&&String(y.end_text||'')===end);
    if(!date||!start)continue;const id=hit?.id||`TS_${crypto.randomUUID().replace(/-/g,'').slice(0,20)}`;keep.add(String(id));
    let bookingCalendarId=null;if(bookingMode){const cal=await ensureBookingCalendar(env,T,{id:String(x.calendarId||''),name:String(x.calendarName||'主要預約日曆'),operationUnitId:uid,color:String(x.calendarColor||'#8bbfd1')});bookingCalendarId=cal.id}
    const payload={session_id:sid,operation_unit_id:uid,booking_calendar_id:bookingCalendarId,date_key:date,label:String(x.label||date),start_text:start,end_text:end,capacity:Math.max(0,parseInt(x.capacity||x.limit||0,10)||0),status:x.status==='closed'?'closed':'open',updated_at:now};
    if(hit)await dbUpdate(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,payload);
    else await dbInsert(env,'timeslots',{id,tenant_id:T,reserved_count:0,confirmed_count:0,config_json:{},created_at:now,...payload});
  }
  for(const x of oldSlots)if(!keep.has(String(x.id)))await dbUpdate(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(x.id)}`,{status:'closed',updated_at:now}).catch(()=>{});
}

async function hGetOperationUnitsPublic(env,p){
  const T=p._tenantId,sid=String(p.sessionId||'');if(!sid)return jsonErr('請提供場次');
  const rows=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&status=in.(open,active,published)&select=*&order=sort_order.asc,created_at.asc`).catch(()=>[]),out=[];
  for(const u of rows)if(await operationUnitEntitlementActive(env,T,u)){const f=formatOperationUnit(u);const ts=await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(u.id)}&status=eq.open&select=*&order=date_key.asc,start_text.asc`).catch(()=>[]);f.timeslots=ts.map(x=>({id:x.id,date:x.date_key,label:x.label||x.date_key,start:x.start_text||'',end:x.end_text||'',capacity:safeNum(x.capacity),remaining:safeNum(x.capacity)>0?Math.max(0,safeNum(x.capacity)-safeNum(x.reserved_count)-safeNum(x.confirmed_count)):0}));out.push(f)}
  return jsonOk(out);
}
async function hGetOperationUnitsAdmin(env,p){
  const T=p._tenantId,sid=String(p.sessionId||'');if(!await verifyStaff(env,p.email,p.token,T,'sessions',sid||undefined))return jsonErr('無權限');
  let q=`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=sort_order.asc,created_at.asc`;if(sid)q=`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&select=*&order=sort_order.asc,created_at.asc`;
  const calendars=await bookingCalendarsForTenant(env,T),calendarMap=Object.fromEntries(calendars.map(x=>[String(x.id),x]));const rows=await dbGet(env,'operation_units',q).catch(()=>[]),out=[];for(const u of rows){const f=formatOperationUnit(u);const ts=await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(u.id)}&select=*&order=date_key.asc,start_text.asc`).catch(()=>[]);f.timeslots=ts.map(x=>({id:x.id,date:x.date_key,label:x.label||x.date_key,start:x.start_text||'',end:x.end_text||'',capacity:safeNum(x.capacity),status:x.status||'open',calendarId:x.booking_calendar_id||'',calendarName:calendarMap[x.booking_calendar_id]?.name||''}));out.push(f)}return jsonOk(out);
}
async function hSaveOperationUnit(env,b){
  const T=b._tenantId,sid=String(b.sessionId||'').trim();if(!sid)return jsonErr('請先指定場次');if(!await verifyStaff(env,b.email,b.token,T,'sessions',sid))return jsonErr('無權限');
  const sr=await dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(sid)}&select=id,event_id`).catch(()=>[]);if(!sr.length)return jsonErr('找不到場次');
  const name=String(b.name||'').trim();if(!name)return jsonErr('請填營運項目名稱');const blocked=await requestedUnapprovedModules(env,T,b.modules||{});if(blocked.length)return jsonErr('以下功能尚未由平台核准：'+blocked.join('、'));const now=nowIso(),id=String(b.id||genId('UNT')),mods=await tenantAllowedSessionModules(env,T,b.modules||{}),pricing=(b.pricing&&typeof b.pricing==='object')?b.pricing:{},policy=(b.policy&&typeof b.policy==='object')?b.policy:{},pub=(b.publicConfig&&typeof b.publicConfig==='object')?b.publicConfig:{};
  const requestedStatus=unitStatusAllowed(b.status),wantsOpen=['open','active','published'].includes(requestedStatus),slots=Array.isArray(b.timeslots)?b.timeslots:(Array.isArray(pub.timeslots)?pub.timeslots:[]);
  if(wantsOpen&&mods.operatingMode==='booking'&&!mods.workshopSlots)return jsonErr('預約型營運項目必須設定日期／時段');
  if(wantsOpen&&mods.service&&!mods.services.length)return jsonErr('已啟用服務方案，請至少建立一個服務項目');
  if(wantsOpen&&mods.resource&&!mods.resources.length)return jsonErr('已啟用人員／資源，請至少建立一個可選資源');
  if(wantsOpen&&mods.workshopSlots&&!slots.length)return jsonErr('已啟用日期／時段，請至少建立一個可預約時段');
  if(wantsOpen&&mods.operatingMode==='booking'&&!mods.payment)return jsonErr('預約型營運項目必須啟用付款功能');
  let code=unitCode(b.code)||unitCode(name)||('unit-'+id.slice(-6).toLowerCase());const same=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&code=eq.${encodeURIComponent(code)}&select=id`).catch(()=>[]);if(same.some(x=>String(x.id)!==id))code=code+'-'+id.slice(-4).toLowerCase();
  const data={event_id:String(sr[0].event_id||''),session_id:sid,code,name,unit_type:unitTypeAllowed(b.unitType),status:requestedStatus,description:String(b.description||''),capacity:Math.max(0,parseInt(b.capacity||0,10)||0),fee:Math.max(0,safeNum(b.fee)),modules_json:JSON.stringify(mods),pricing_json:JSON.stringify(pricing),policy_json:JSON.stringify(policy),public_config_json:JSON.stringify({...pub,timeslots:slots}),sort_order:Math.max(0,parseInt(b.sortOrder||0,10)||0),updated_at:now};
  const old=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`).catch(()=>[]);if(wantsOpen)data.status=old.length&&operationUnitIsOpen(old[0])?requestedStatus:'draft';if(old.length){if(String(old[0].session_id)!==sid)return jsonErr('營運項目不可跨場次直接搬移');await dbUpdate(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,data)}else await dbInsert(env,'operation_units',{id,tenant_id:T,current_count:0,created_at:now,...data});
  let fresh=(await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`))[0];if(wantsOpen&&!operationUnitIsOpen(fresh)){const ent=await ensureOperationUnitEntitlement(env,T,{...fresh,status:requestedStatus});if(!ent.ok){await dbUpdate(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,{status:'pending_payment',updated_at:nowIso()});fresh=(await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`))[0];await syncOperationUnitCatalogs(env,T,fresh);return jsonOk({...formatOperationUnit(fresh),needPayment:true,paymentAmount:ent.amount||0,platformCredit:ent.balance||0,pendingOpenStatus:requestedStatus})}await dbUpdate(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,{status:requestedStatus,updated_at:nowIso()});fresh=(await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`))[0]}await syncOperationUnitCatalogs(env,T,fresh);await writeAuditLog(env,T,b.email||'','admin',old.length?'update_operation_unit':'create_operation_unit','operation_units',id,old[0]||null,fresh,{sessionId:sid}).catch(()=>{});return jsonOk(formatOperationUnit(fresh));
}
async function hDeleteOperationUnit(env,b){
  const T=b._tenantId,id=String(b.id||b.operationUnitId||''),u=await getOperationUnitRow(env,T,id);if(!u)return jsonErr('找不到營運項目');if(!await verifyStaff(env,b.email,b.token,T,'sessions',String(u.session_id)))return jsonErr('無權限');
  const regs=await dbGet(env,'registrations',`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(id)}&select=id&limit=1`).catch(()=>[]);if(regs.length)return jsonErr('此營運項目已有正式報名／預約紀錄，不能刪除；請改為關閉或封存，避免歷史資料斷鏈');
  for(const table of ['timeslots','service_items','resources','promotion_rules'])await dbDelete(env,table,`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(id)}`).catch(()=>{});await dbDelete(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`);return jsonOk({ok:true});
}

function promotionDiscountValue(rule,amount){const v=Math.max(0,safeNum(rule&&rule.value)),base=Math.max(0,safeNum(amount));let d=String(rule&&rule.value_type||'fixed')==='percent'?Math.round(base*v/100):Math.round(v);const cap=Math.max(0,safeNum(rule&&rule.max_discount));if(cap>0)d=Math.min(d,cap);return Math.max(0,Math.min(base,d))}
function promotionTimeActive(r,now=Date.now()){const a=r.start_at?new Date(r.start_at).getTime():0,z=r.end_at?new Date(r.end_at).getTime():Infinity;return now>=a&&now<=z}
function promotionScopeMatches(r,unitId,sessionId){return (!r.operation_unit_id||String(r.operation_unit_id)===String(unitId||''))&&(!r.session_id||String(r.session_id)===String(sessionId||''))}
async function rewardBalance(env,T,email){const rows=await dbGet(env,'reward_ledger',`tenant_id=eq.${encodeURIComponent(T)}&member_email=ilike.${encodeURIComponent(normEmail(email))}&select=amount`).catch(()=>[]);return Math.max(0,Math.round(rows.reduce((n,x)=>n+safeNum(x.amount),0)))}
async function calculateRegistrationBenefits(env,T,b,u,grossAmount){
  if(!u)return {grossAmount:safeNum(grossAmount),promoDiscount:0,rewardRedeem:0,totalDiscount:0,netAmount:safeNum(grossAmount),appliedRules:[]};
  const uid=String(u.id),sid=String(u.session_id),rows=await dbGet(env,'promotion_rules',`tenant_id=eq.${encodeURIComponent(T)}&active=eq.true&select=*`).catch(()=>[]),active=rows.filter(r=>promotionTimeActive(r)&&promotionScopeMatches(r,uid,sid)),candidates=[];
  for(const r of active){if(r.rule_type==='early_bird')candidates.push({r,d:promotionDiscountValue(r,grossAmount)});else if(r.rule_type==='coupon'&&String(r.code||'').trim()&&String(r.code).trim().toLowerCase()===String(b.promotionCode||'').trim().toLowerCase()&&safeNum(grossAmount)>=safeNum(r.min_amount))candidates.push({r,d:promotionDiscountValue(r,grossAmount)})}
  candidates.sort((a,z)=>z.d-a.d);const chosen=candidates[0]||null,promoDiscount=chosen?chosen.d:0,afterPromo=Math.max(0,safeNum(grossAmount)-promoDiscount),bal=await rewardBalance(env,T,b.email),pricing=safeJson(u.pricing_json,{});
  let maxRedeem=afterPromo;const fixed=Math.max(0,safeNum(pricing.rewardMaxRedeem)),pct=Math.max(0,Math.min(100,safeNum(pricing.rewardMaxRedeemPercent)));if(fixed>0)maxRedeem=Math.min(maxRedeem,fixed);if(pct>0)maxRedeem=Math.min(maxRedeem,Math.floor(afterPromo*pct/100));
  const requested=Math.max(0,Math.round(safeNum(b.rewardRedeemAmount))),rewardRedeem=Math.min(requested,bal,maxRedeem),totalDiscount=promoDiscount+rewardRedeem;
  return {grossAmount:safeNum(grossAmount),promoDiscount,rewardRedeem,totalDiscount,netAmount:Math.max(0,safeNum(grossAmount)-totalDiscount),rewardBalanceBefore:bal,appliedRules:chosen?[{id:chosen.r.id,name:chosen.r.name,type:chosen.r.rule_type,amount:chosen.d}]:[]};
}
async function applyRewardRedemption(env,T,email,regId,u,benefit){const amount=Math.max(0,safeNum(benefit&&benefit.rewardRedeem));if(amount<=0)return;const r=await dbRpc(env,'consume_reward_credit_atomic',{p_tenant_id:T,p_member_email:normEmail(email),p_amount:amount,p_operation_unit_id:u?.id||null,p_session_id:u?.session_id||null,p_registration_id:regId});if(!r||r.ok===false)throw new Error((r&&r.error)||'回饋金餘額已變動，請重新送出')}
async function recordNotification(env,{tenantId,unitId=null,sessionId=null,registrationId=null,email='',eventKey,title,body,channel='system',status='sent',meta={}}){try{await dbInsert(env,'notifications',{id:genId('NTF'),tenant_id:tenantId,operation_unit_id:unitId,session_id:sessionId,registration_id:registrationId,member_email:normEmail(email),event_key:eventKey,channel,title:String(title||''),body:String(body||''),status,scheduled_at:null,sent_at:status==='sent'?nowIso():null,error_message:null,meta_json:JSON.stringify(meta||{}),created_at:nowIso()})}catch(e){logError(env,{source:'recordNotification',tenantId,regId:registrationId,error:e})}}

async function hGetPromotionRulesAdmin(env,p){const T=p._tenantId,sid=String(p.sessionId||'');if(!await verifyStaff(env,p.email,p.token,T,'sessions',sid||undefined))return jsonErr('無權限');let q=`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=created_at.desc`;if(sid)q=`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&select=*&order=created_at.desc`;return jsonOk(await dbGet(env,'promotion_rules',q).catch(()=>[]))}
async function hSavePromotionRule(env,b){
  const T=b._tenantId,uid=String(b.operationUnitId||''),u=uid?await getOperationUnitRow(env,T,uid):null,sid=String((u&&u.session_id)||b.sessionId||'');
  if(!sid||!await verifyStaff(env,b.email,b.token,T,'sessions',sid))return jsonErr('無權限');
  const typ=String(b.ruleType||'');if(!['early_bird','coupon','completion_reward','multi_session_bonus'].includes(typ))return jsonErr('優惠類型不正確');
  const name=String(b.name||'').trim();if(!name)return jsonErr('請填名稱');
  const code=typ==='coupon'?String(b.code||'').trim():'';if(typ==='coupon'&&!code)return jsonErr('請填優惠券代碼');
  let id=String(b.id||'').trim();
  if(!id){
    let q=`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=${uid?'eq.'+encodeURIComponent(uid):'is.null'}&session_id=eq.${encodeURIComponent(sid)}&rule_type=eq.${encodeURIComponent(typ)}&select=id,code&order=created_at.desc&limit=50`;
    const same=await dbGet(env,'promotion_rules',q).catch(()=>[]);
    const hit=typ==='coupon'?same.find(x=>String(x.code||'').trim().toLowerCase()===code.toLowerCase()):same[0];
    id=String(hit?.id||genId('PRO'));
  }
  const now=nowIso(),data={operation_unit_id:uid||null,session_id:sid||null,name,rule_type:typ,code:typ==='coupon'?code:null,active:b.active!==false,start_at:b.startAt||null,end_at:b.endAt||null,value_type:String(b.valueType)==='percent'?'percent':'fixed',value:Math.max(0,safeNum(b.value)),min_amount:Math.max(0,safeNum(b.minAmount)),max_discount:Math.max(0,safeNum(b.maxDiscount)),every_n_sessions:Math.max(0,parseInt(b.everyNSessions||0,10)||0),config_json:JSON.stringify((b.config&&typeof b.config==='object')?b.config:{}),updated_at:now};
  const old=await dbGet(env,'promotion_rules',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=id`).catch(()=>[]);
  if(old.length)await dbUpdate(env,'promotion_rules',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,data);
  else await dbInsert(env,'promotion_rules',{id,tenant_id:T,created_at:now,...data});
  return jsonOk({ok:true,id});
}
async function hDeletePromotionRule(env,b){const T=b._tenantId,id=String(b.id||'');const rows=await dbGet(env,'promotion_rules',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=session_id`).catch(()=>[]);if(!rows.length)return jsonErr('找不到優惠');if(!await verifyStaff(env,b.email,b.token,T,'sessions',String(rows[0].session_id||'')))return jsonErr('無權限');await dbDelete(env,'promotion_rules',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`);return jsonOk({ok:true})}
async function hGetMyRewards(env,p){const T=p._tenantId,verified=await verifiedPlatformMember(env,p&&(p.member_token||p.memberToken||p.token));if(!verified||!platformMemberComplete(verified.row))return jsonErr('會員登入已失效，請重新使用 LINE 登入');const email=platformContactEmail(verified.row);const rows=await dbGet(env,'reward_ledger',`tenant_id=eq.${encodeURIComponent(T)}&member_email=ilike.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=100`).catch(()=>[]);return jsonOk({balance:await rewardBalance(env,T,email),rows})}
async function hGetMyNotifications(env,p){const T=p._tenantId,verified=await verifiedPlatformMember(env,p&&(p.member_token||p.memberToken||p.token));if(!verified||!platformMemberComplete(verified.row))return jsonErr('會員登入已失效，請重新使用 LINE 登入');const email=platformContactEmail(verified.row);return jsonOk(await dbGet(env,'notifications',`tenant_id=eq.${encodeURIComponent(T)}&member_email=ilike.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=100`).catch(()=>[]))}
async function hGetNotificationsAdmin(env,p){const T=p._tenantId,sid=String(p.sessionId||'');if(!await verifyStaff(env,p.email,p.token,T,'announce',sid||undefined)&&!await verifyStaff(env,p.email,p.token,T,'sessions',sid||undefined))return jsonErr('無權限');let q=`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=created_at.desc&limit=200`;if(sid)q=`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&select=*&order=created_at.desc&limit=200`;return jsonOk(await dbGet(env,'notifications',q).catch(()=>[]))}

async function getPlatformSetting(env,key,fallback={}){const rows=await dbGet(env,'platform_settings',`setting_key=eq.${encodeURIComponent(key)}&select=value_json`).catch(()=>[]);return rows.length?safeJson(rows[0].value_json,fallback):fallback}
const DEFAULT_PLATFORM_BILLING_POLICY=Object.freeze({freeActivityFee:200,bookingMonthlyFee:688,paidActivityRatePercent:1,noCap:true});
function normalizePlatformBillingPolicy(raw={}){return {freeActivityFee:Math.max(0,Math.round(safeNum(raw.freeActivityFee??DEFAULT_PLATFORM_BILLING_POLICY.freeActivityFee))),bookingMonthlyFee:Math.max(0,Math.round(safeNum(raw.bookingMonthlyFee??DEFAULT_PLATFORM_BILLING_POLICY.bookingMonthlyFee))),paidActivityRatePercent:Math.max(0,Math.min(100,Math.round(safeNum(raw.paidActivityRatePercent??DEFAULT_PLATFORM_BILLING_POLICY.paidActivityRatePercent)*10000)/10000)),noCap:true}}
async function platformBillingPolicy(env){return normalizePlatformBillingPolicy(await getPlatformSetting(env,'platform_billing_policy',DEFAULT_PLATFORM_BILLING_POLICY))}

async function hGetPlatformServiceSales(env,p){
  const pay=await verifyAdminJwt(p.token,env);
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限',401);
  const T=String(p.target_tenant_id||'').trim().toLowerCase();
  if(!T)return jsonErr('請選擇主辦');
  const rows=await dbGet(env,'billing_logs',`tenant_id=eq.${encodeURIComponent(T)}&status=eq.confirmed&select=id,billing_type,amount,total,note,confirmed_at,confirmed_by,created_at&order=created_at.desc&limit=100`).catch(()=>[]);
  return jsonOk(rows.filter(x=>String(x.billing_type||'').startsWith('setup_feature:')).map(x=>{
    const note=String(x.note||''),parts=note.split('｜');
    return {id:x.id,billingType:x.billing_type,serviceName:parts.shift()||'平台服務',amount:safeNum(x.total||x.amount),note:parts.join('｜'),confirmedAt:x.confirmed_at||x.created_at,confirmedBy:x.confirmed_by||''};
  }));
}
async function hRecordPlatformServiceSale(env,b){
  const pay=await verifyAdminJwt(b.token,env);
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限',401);
  const T=String(b.target_tenant_id||'').trim().toLowerCase(),kind=['setup','module','custom'].includes(String(b.kind||''))?String(b.kind):'custom';
  const name=String(b.name||'').trim().slice(0,100),amount=Math.max(0,Math.round(safeNum(b.amount))),moduleKey=String(b.moduleKey||'').trim(),note=String(b.note||'').trim().slice(0,500);
  if(!T||!name)return jsonErr('請選擇主辦並填寫服務名稱');
  const tenant=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(T)}&select=id`).catch(()=>[]);
  if(!tenant.length)return jsonErr('找不到主辦空間');
  if(moduleKey&&!Object.prototype.hasOwnProperty.call(DEFAULT_TENANT_MODULE_FLAGS,moduleKey))return jsonErr('不支援的專業模組');
  const now=nowIso(),id=genId('SVC'),code=(moduleKey||kind+'_'+id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
  await dbInsert(env,'billing_logs',{id,tenant_id:T,billing_type:'setup_feature:'+kind+':'+code,amount,tax:0,total:amount,status:'confirmed',confirmed_at:now,confirmed_by:pay.email,period_start:now,period_end:null,note:name+(note?'｜'+note:''),created_at:now});
  let flags=null;
  if(moduleKey){
    const current=await getTenantModuleFlags(env,T);flags={...current,[moduleKey]:true,registration:true};
    const row=await getTenantSettingsRow(env,T);
    if(row)await dbUpdate(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(T)}`,{module_flags_json:JSON.stringify(flags),updated_at:now});
    else await dbInsert(env,'tenant_settings',{tenant_id:T,module_flags_json:flags,theme_json:{key:'cute_pastel',updatedAt:now}});
  }
  await writeAuditLog(env,T,pay.email||'','platform_super_admin','record_platform_service_sale','billing_logs',id,null,{kind,name,amount,moduleKey,note},{source:'platform.html'}).catch(()=>{});
  return jsonOk({ok:true,id,flags});
}

async function hGetPlatformBillingPolicy(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');return jsonOk(await platformBillingPolicy(env))}
async function hGetPublicBillingPolicy(env){return jsonOk(await platformBillingPolicy(env))}
async function hSavePlatformBillingPolicy(env,b){const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');const value=normalizePlatformBillingPolicy(b),now=nowIso(),rows=await dbGet(env,'platform_settings','setting_key=eq.platform_billing_policy&select=setting_key').catch(()=>[]);if(rows.length)await dbUpdate(env,'platform_settings','setting_key=eq.platform_billing_policy',{value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});else await dbInsert(env,'platform_settings',{setting_key:'platform_billing_policy',value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});await writeAuditLog(env,'platform',pay.email||'','platform_super_admin','save_platform_billing_policy','platform_settings','platform_billing_policy',null,value,{}).catch(()=>{});return jsonOk(value)}
async function platformPaymentProfile(env){const p=await getPlatformSetting(env,'platform_payment_profile',{});return {bankName:String(p.bankName||'').trim(),bankCode:String(p.bankCode||'').trim(),accountName:String(p.accountName||'').trim(),accountNumber:String(p.accountNumber||'').trim(),paymentNote:String(p.paymentNote||'').trim()}}
async function hGetPlatformPaymentProfile(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');return jsonOk(await platformPaymentProfile(env))}
async function hSavePlatformPaymentProfile(env,b){const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');const value={bankName:String(b.bankName||'').trim(),bankCode:String(b.bankCode||'').trim(),accountName:String(b.accountName||'').trim(),accountNumber:String(b.accountNumber||'').replace(/\s+/g,'').trim(),paymentNote:String(b.paymentNote||'').trim().slice(0,500)},now=nowIso(),rows=await dbGet(env,'platform_settings','setting_key=eq.platform_payment_profile&select=setting_key').catch(()=>[]);if(rows.length)await dbUpdate(env,'platform_settings','setting_key=eq.platform_payment_profile',{value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});else await dbInsert(env,'platform_settings',{setting_key:'platform_payment_profile',value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});await writeAuditLog(env,'platform',pay.email||'','platform_super_admin','save_platform_payment_profile','platform_settings','platform_payment_profile',null,{...value,accountNumber:value.accountNumber?`***${value.accountNumber.slice(-4)}`:''},{}).catch(()=>{});return jsonOk(value)}
async function startupCreditPolicy(env){const p=await getPlatformSetting(env,'startup_credit_policy',{enabled:true,amount:1000});return {enabled:p.enabled!==false,amount:Math.max(0,Math.round(safeNum(p.amount)))}}
async function grantStartupCreditIfEligible(env,T){const pol=await startupCreditPolicy(env);if(!pol.enabled||pol.amount<=0)return {granted:false,amount:0};const hit=await dbGet(env,'billing_logs',`tenant_id=eq.${encodeURIComponent(T)}&billing_type=eq.startup_credit_grant&status=eq.confirmed&select=id,amount`).catch(()=>[]);if(hit.length)return {granted:false,amount:safeNum(hit[0].amount),existing:true};await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:'startup_credit_grant',amount:pol.amount,tax:0,total:pol.amount,status:'confirmed',confirmed_at:nowIso(),confirmed_by:'system_onboarding',period_start:nowIso(),period_end:null,note:'DOING 新主辦創業金',created_at:nowIso()});return {granted:true,amount:pol.amount}}
async function hGetStartupCreditPolicy(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');return jsonOk(await startupCreditPolicy(env))}
async function hSaveStartupCreditPolicy(env,b){const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');const value={enabled:b.enabled!==false,amount:Math.max(0,Math.round(safeNum(b.amount)))},now=nowIso(),rows=await dbGet(env,'platform_settings',`setting_key=eq.startup_credit_policy&select=setting_key`).catch(()=>[]);if(rows.length)await dbUpdate(env,'platform_settings','setting_key=eq.startup_credit_policy',{value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});else await dbInsert(env,'platform_settings',{setting_key:'startup_credit_policy',value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});return jsonOk(value)}

async function grantCompletionRewardsForRegistration(env,T,r,s,u){
  if(!u||!r||!s||!isPaidStatus(r.payment_status)||!['已錄取','完成'].includes(String(r.review_status||'')))return;
  const mods=normalizeSessionModules(safeJson(u.modules_json,{}));if(mods.checkin&&String(r.checkin_status||'')!=='已報到')return;
  const rules=(await dbGet(env,'promotion_rules',`tenant_id=eq.${encodeURIComponent(T)}&active=eq.true&select=*`).catch(()=>[])).filter(x=>promotionScopeMatches(x,u.id,s.id)&&promotionTimeActive(x));
  const baseRules=rules.filter(x=>x.rule_type==='completion_reward'),bonusRules=rules.filter(x=>x.rule_type==='multi_session_bonus'),email=normEmail(r.email);
  for(const rule of baseRules){const amount=promotionDiscountValue(rule,safeNum(r.total_amount||r.amount));if(amount<=0)continue;try{await dbInsert(env,'reward_ledger',{id:genId('RWD'),tenant_id:T,member_email:email,operation_unit_id:u.id,session_id:s.id,registration_id:r.id,entry_type:'earn',amount,note:rule.name||'完成一場回饋',source_rule_id:rule.id,created_by:'system',created_at:nowIso()})}catch(e){if(!String(e.message||'').toLowerCase().includes('duplicate'))logError(env,{source:'grantCompletionRewards',tenantId:T,regId:r.id,error:e})}}
  const earned=await dbGet(env,'reward_ledger',`tenant_id=eq.${encodeURIComponent(T)}&member_email=ilike.${encodeURIComponent(email)}&entry_type=eq.earn&select=registration_id`).catch(()=>[]),completedCount=new Set(earned.map(x=>x.registration_id).filter(Boolean)).size;
  for(const rule of bonusRules){const n=Math.max(1,parseInt(rule.every_n_sessions||0,10)||0);if(!n||completedCount===0||completedCount%n!==0)continue;const amount=promotionDiscountValue(rule,safeNum(r.total_amount||r.amount));if(amount<=0)continue;try{await dbInsert(env,'reward_ledger',{id:genId('RWD'),tenant_id:T,member_email:email,operation_unit_id:u.id,session_id:s.id,registration_id:r.id,entry_type:'bonus',amount,note:rule.name||`第 ${completedCount} 場加碼`,source_rule_id:rule.id,created_by:'system',created_at:nowIso()})}catch(e){if(!String(e.message||'').toLowerCase().includes('duplicate'))logError(env,{source:'grantCompletionRewardsBonus',tenantId:T,regId:r.id,error:e})}}
}
async function cronGrantCompletedRewards(env){
  const sessions=await dbGet(env,'sessions','select=id,tenant_id,dates_json,modules_json').catch(()=>[]),now=Date.now();
  for(const s of sessions){const dates=_sessionDateRows(s.dates_json||[]);if(!dates.length)continue;const last=Math.max(...dates.map(d=>new Date(String(d.date)+'T23:59:59+08:00').getTime()).filter(Number.isFinite));if(!last||last>now)continue;const units=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(s.tenant_id)}&session_id=eq.${encodeURIComponent(s.id)}&select=*`).catch(()=>[]);if(!units.length)continue;const um=Object.fromEntries(units.map(u=>[u.id,u]));const regs=await dbGet(env,'registrations',`tenant_id=eq.${encodeURIComponent(s.tenant_id)}&session_id=eq.${encodeURIComponent(s.id)}&operation_unit_id=not.is.null&select=*`).catch(()=>[]);for(const r of regs){const u=um[r.operation_unit_id];if(u)await grantCompletionRewardsForRegistration(env,s.tenant_id,r,s,u)}}
}
async function callAutoTranslate(env,source){
  if(!env.OPENAI_API_KEY)throw new Error('尚未設定 OPENAI_API_KEY');
  const model=String(env.OPENAI_TRANSLATION_MODEL||'gpt-5.6-luna');
  const resp=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({
    model,
    input:[
      {role:'developer',content:[{type:'input_text',text:'Translate localization content faithfully. Preserve proper nouns, URLs, dates, money, line breaks, and formatting. Return ONLY valid JSON with keys en, ja, ko. Each language object must contain name, venue, desc, agreementTitle, agreementContent. Do not invent facts.'}]},
      {role:'user',content:[{type:'input_text',text:'Return JSON. Source Traditional Chinese:\\n'+JSON.stringify(source)}]}
    ],
    text:{format:{type:'json_object'}},max_output_tokens:6000
  })});
  const j=await resp.json().catch(()=>({}));
  if(!resp.ok)throw new Error(j.error?.message||'自動翻譯服務失敗');
  let text=String(j.output_text||'');if(!text&&Array.isArray(j.output))for(const o of j.output)for(const c of o.content||[])if(c.type==='output_text')text+=c.text||'';
  const data=safeJson(text,null);if(!data)throw new Error('自動翻譯回傳格式錯誤');return data;
}
async function hAutoTranslateSession(env,b){
  const T=b._tenantId;if(!await verifyStaff(env,b.email,b.token,T,'sessions',String(b.sessionId||'')))return jsonErr('無權限');
  const flags=await getTenantModuleFlags(env,T);if(flags.i18n===false)return jsonErr('多語言功能尚未由平台核准');
  const rows=await dbGet(env,'sessions',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(b.sessionId)}&select=*`);if(!rows.length)return jsonErr('找不到場次');
  const s=rows[0],mods=normalizeSessionModules(safeJson(s.modules_json,{}));
  const result=await callAutoTranslate(env,{name:s.name||'',venue:s.venue||'',desc:s.description||'',agreementTitle:s.agreement_title||'',agreementContent:s.agreement_content||''});
  mods.i18n=mods.i18n||{};mods.i18n.enabled=true;mods.i18n.languages=['zh-TW','en','ja','ko'];mods.i18n.translations=mods.i18n.translations||{};
  for(const locale of ['en','ja','ko']){const old=mods.i18n.translations[locale]||{},inc=result[locale]||{};mods.i18n.translations[locale]={...old};for(const k of ['name','venue','desc','agreementTitle','agreementContent'])if(b.overwrite===true||!String(old[k]||'').trim())mods.i18n.translations[locale][k]=String(inc[k]||'')}
  await dbUpdate(env,'sessions',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(s.id)}`,{modules_json:JSON.stringify(mods),updated_at:nowIso()});
  await syncSessionTranslations(env,T,{...s,modules_json:JSON.stringify(mods)});
  return jsonOk({success:true,translations:mods.i18n.translations});
}

async function hFrontBootstrap(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  const [tc, eventRows, sessionRows, annRows, unitRows] = await Promise.all([
    getTenantCtx(env, TENANT),
    dbGet(env, 'events', `tenant_id=eq.${TENANT}&status=neq.%E5%81%9C%E7%94%A8&select=*`),
    dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&status=in.(%E5%A0%B1%E5%90%8D%E4%B8%AD,%E9%96%8B%E6%94%BE%E4%B8%AD)&select=*`),
    dbGet(env, 'announcements', `tenant_id=eq.${TENANT}&select=*&order=created_at.desc`),
    dbGet(env, 'operation_units', `tenant_id=eq.${TENANT}&status=in.(open,active,published)&select=*&order=sort_order.asc,created_at.asc`).catch(()=>[]),
  ]);
  const publicUnits=[];for(const u of unitRows)if(await operationUnitEntitlementActive(env,TENANT,u)){const f=formatOperationUnit(u),ts=await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(TENANT)}&operation_unit_id=eq.${encodeURIComponent(u.id)}&status=eq.open&select=*&order=date_key.asc,start_text.asc`).catch(()=>[]);f.timeslots=ts.map(x=>({id:x.id,date:x.date_key,label:x.label||x.date_key,start:x.start_text||'',end:x.end_text||'',capacity:safeNum(x.capacity),remaining:safeNum(x.capacity)>0?Math.max(0,safeNum(x.capacity)-safeNum(x.reserved_count)-safeNum(x.confirmed_count)):0}));publicUnits.push(f)}
  const unitSessionIds=new Set(publicUnits.map(x=>String(x.sessionId)));
  return jsonOk({
    tenant: {
      id:       tc.id,
      name:     tc.name,
      slug:     tc.slug,
      heroImg:  tc.heroImg,
      infoText: tc.infoText,
      lineUrl:  tc.lineUrl,
      bankInfo: tc.bankInfo,
      color:    tc.color,
      paymentConfig: tc.paymentConfig,
      moduleFlags: tc.moduleFlags,
      theme: tc.theme,
      businessType: tc.businessType,
      i18n:tc.i18n,
    },
    events:        eventRows.map(r=>({id:r.id,title:r.title,desc:r.description,location:r.location,cover:r.cover_url,status:r.status})),
    sessions:      (await (async()=>{const checks=await Promise.all(sessionRows.map(async s=>({s,ok:(await operatingEntitlementActive(env,TENANT,s))||unitSessionIds.has(String(s.id))})));return checks.filter(x=>x.ok).map(x=>formatSession(x.s))})()),
    operationUnits: publicUnits,
    announcements: annRows.map(r=>({id:r.id,title:r.title,content:r.content,url:r.url,urlText:r.url_text,createdAt:r.created_at})),
  });
}

// getEvents
async function hGetEvents(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  const rows = await dbGet(env, 'events', `tenant_id=eq.${TENANT}&status=neq.%E5%81%9C%E7%94%A8&select=*`);
  return jsonOk(rows.map(r=>({id:r.id,title:r.title,desc:r.description,location:r.location,cover:r.cover_url,status:r.status})));
}

// getSessions
async function hGetSessions(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  let qs = `tenant_id=eq.${TENANT}&status=in.(報名中,開放中)&select=*`;
  if (p.eventId) qs += `&event_id=eq.${encodeURIComponent(p.eventId)}`;
  let rows = await dbGet(env, 'sessions', qs);
  const checks=await Promise.all(rows.map(async s=>({s,ok:(await operatingEntitlementActive(env,TENANT,s))||(await anyOpenUnitEntitled(env,TENANT,s.id))})));
  return jsonOk(checks.filter(x=>x.ok).map(x=>formatSession(x.s)));
}

// getSession
async function hGetSession(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  const id = p.id || p.sessionId;
  if (!id) return jsonErr('請提供 id');
  const rows = await dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(id)}&select=*`);
  if (!rows.length) return jsonErr('找不到場次');
  if(['報名中','開放中','開放'].includes(String(rows[0].status||'')) && !(await operatingEntitlementActive(env,TENANT,rows[0])) && !(await anyOpenUnitEntitled(env,TENANT,rows[0].id))){
    const staffOk=!!(p&&p.email&&p.token&&await verifyStaff(env,p.email,p.token,TENANT));
    if(!staffOk)return jsonErr('此場次尚未正式開放');
  }
  const hydrated=await hydrateNormalizedSession(env,TENANT,rows[0]);
  return jsonOk(formatSession(hydrated));
}

// getSessionAgreement（回傳場次合約設定，供前台 Modal 顯示）
async function hGetSessionAgreement(env, p) {
  const TENANT = (p && p._tenantId);
  const id = p.id || p.sessionId;
  if (!id) return jsonErr('請提供 id');
  const rows = await dbGet(env, 'sessions',
    `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(id)}&select=*`);
  if (!rows.length) return jsonErr('找不到場次');
  const s = rows[0];
  const lang=String(p.lang||'zh-TW');
  const sessionMods=normalizeSessionModules(safeJson(s.modules_json,{}));
  let title = moduleTranslation(sessionMods,lang,'agreementTitle',s.agreement_title || '報名合約／活動細則與攤商規範');
  let content = moduleTranslation(sessionMods,lang,'agreementContent',s.agreement_content || '');
  let version = s.agreement_version || '';
  let updatedAt = s.agreement_updated_at || null;

  // A→Z 阻斷修正：若場次尚未套用合約正文，但後台已有「預設合約範本」，
  // 前台仍要能讀到合約，避免報名者卡在「無法載入合約內容」。
  if (!String(content||'').trim()) {
    try {
      const templates = await dbGet(env, 'tenant_agreement_templates',
        `tenant_id=eq.${TENANT}&select=*&order=slot_no.asc,created_at.asc`);
      const t = (templates||[]).find(x => String(x.content||'').trim()) || null;
      if (t) {
        title = t.title || title;
        content = t.content || '';
        version = t.version || version;
        updatedAt = t.updated_at || updatedAt;
      }
    } catch(e) { console.error('agreement template fallback failed', e && e.message ? e.message : e); logError(env, {source:'hGetSessionAgreement', message:'agreement template fallback failed', error:e && e.message ? e.message : e}); }
  }

  return jsonOk({
    sessionId: s.id,
    sessionName: s.name || '',
    agreementRequired: agreementRequiredOn(s.agreement_required),
    title,
    content,
    version,
    updatedAt,
  });
}

// member lookup helpers（前台會員以 tenant_id + email 為主，phone 為查找輔助）
function normEmail(v){ return String(v||'').trim().toLowerCase(); }
// 手機比對修正：資料庫可能存 0955 / 886955 / +886955 / 955 等格式，
// 前台查詢時要視為同一支手機，不可用完全相同字串導致「會員紀錄消失」。
function phoneDigits(v){ return String(v||'').trim().replace(/[^0-9]/g,''); }
function normPhone(v){
  const d = phoneDigits(v);
  if (!d) return '';
  if (d.startsWith('886') && d.length >= 12) return '0' + d.slice(3);
  if (d.length === 9 && d.startsWith('9')) return '0' + d;
  return d;
}
function phoneMatches(a,b){
  const ca = normPhone(a), cb = normPhone(b);
  if (!ca || !cb) return false;
  return ca === cb;
}
function memberPayloadFromRow(m){
  if (!m) return null;
  const brandName = m.brand_name || m.brand || '';
  return {
    email:m.email||'', name:m.name||'', phone:String(m.phone||''),
    brand:brandName, brand_name:brandName,
    brandIntro:m.brand_intro||'', brand_intro:m.brand_intro||'',
    sellCat:m.sell_category||'', sell_category:m.sell_category||'',
    sellItem:m.sell_items||'', sell_items:m.sell_items||'',
    photo:m.photo_url||'', photo_url:m.photo_url||'',
    fb:m.fb_url||'', fb_url:m.fb_url||'', ig:m.ig_url||'', ig_url:m.ig_url||'',
    collabUrl:m.collab_url||'', collabDesc:m.collab_desc||'', collabItems:m.collab_items||'',
    company:m.company||m.invoice_title||'', taxId:m.tax_id||'', tax_id:m.tax_id||'',
    invoiceType:m.invoice_type||'', invoiceTitle:m.invoice_title||m.company||'', invoice_title:m.invoice_title||m.company||'',
    invoiceEmail:m.invoice_email||'', invoice_email:m.invoice_email||'',
    invoiceCarrier:m.invoice_carrier||'', invoice_carrier:m.invoice_carrier||'',
    city:m.city||'', lineId:m.line_id||'', line_id:m.line_id||'',
    fastPass:m.fast_pass===true||m.fast_pass==='true', joinedAt:m.joined_at||m.created_at||'',
    member_id:m.email||m.member_id||'', source:m._source||'members',
  };
}
// ── 嚴格身份驗證：Email＋手機必須成對相符 ─────────────────────────
// findMemberByEmailOrPhone 是「盡量找到人」的寬鬆查找（僅供 getMyRegs 內部比對用），
// 不可拿來當權限判斷。凡是會吐出個資、或會改動正式資料的 API，一律走下面兩個函式。
async function findVerifiedMemberByEmailPhone(env, tenantId, email, phone){
  const e = normEmail(email);
  const ph = normPhone(phone);
  if (!e || !ph) return null;
  // members 已有此 Email 時，只能用 members 目前的手機驗證，
  // 不得退回舊 registrations 繞過（否則改過手機的人，舊手機還能登入）。
  const members = await dbGet(env, 'members', `tenant_id=eq.${tenantId}&email=ilike.${encodeURIComponent(e)}&select=*`).catch(()=>[]);
  if (members.length) {
    const m = members[0];
    return phoneMatches(m.phone, ph) ? {...m, _source:'members'} : null;
  }
  // 尚未建立 members 的人，才允許用歷史報名紀錄的 Email＋手機配對。
  const regs = await dbGet(env, 'registrations', `tenant_id=eq.${tenantId}&email=ilike.${encodeURIComponent(e)}&select=email,phone,name,brand_name,brand_intro,sell_category,sell_items,photo_url,fb_url,ig_url,tax_id,invoice_title,invoice_email,invoice_type,invoice_carrier,created_at&order=created_at.desc&limit=100`).catch(()=>[]);
  const found = regs.find(r => phoneMatches(r.phone, ph));
  return found ? {...found, _source:'registrations'} : null;
}
// 報名所有權：以 registrations 這筆本身的 email＋phone 驗證，兩者都必須相符。
function isRegistrationOwner(reg, email, phone){
  if (!reg) return false;
  const e = normEmail(email);
  const ph = normPhone(phone);
  if (!e || !ph) return false;
  return normEmail(reg.email) === e && phoneMatches(reg.phone, ph);
}
// 所有「會改動正式資料」的攤友端 API 共用這一道關卡（單一來源，不各寫各的）。
function regOwnerGuard(reg, b, actionLabel){
  if (!b || !b.email || !b.phone) return jsonErr('請先以 Email 與手機完成身份驗證');
  if (!isRegistrationOwner(reg, b.email, b.phone)) return jsonErr('無權限' + actionLabel + '此報名');
  return null;
}

// 新版會員報名以 LINE 會員 Token 驗證；未回綁會員 ID 的歷史報名保留舊驗證。
async function verifiedRegOwnerGuard(env, reg, b, actionLabel){
  const memberId=String(reg&&reg.platform_member_id||'').trim();
  if(!memberId)return regOwnerGuard(reg,b,actionLabel);
  const verified=await verifiedPlatformMember(env,b&&(b.member_token||b.memberToken));
  if(!verified)return jsonErr('會員登入已失效，請重新使用 LINE 登入');
  if(String(verified.row&&verified.row.id||'').trim()!==memberId)return jsonErr('無權限'+actionLabel+'此報名');
  return null;
}

async function findMemberByEmailOrPhone(env, tenantId, email, phone){
  const e = normEmail(email);
  const ph = normPhone(phone);
  let rows = [];
  if (e) {
    rows = await dbGet(env, 'members', `tenant_id=eq.${tenantId}&email=ilike.${encodeURIComponent(e)}&select=*`).catch(()=>[]);
    if (rows.length) return {...rows[0], _source:'members'};
  }
  if (ph) {
    rows = await dbGet(env, 'members', `tenant_id=eq.${tenantId}&select=*`).catch(()=>[]);
    const found = rows.find(r => phoneMatches(r.phone, ph));
    if (found) return {...found, _source:'members'};
  }
  if (e) {
    rows = await dbGet(env, 'registrations', `tenant_id=eq.${tenantId}&email=ilike.${encodeURIComponent(e)}&select=email,phone,name,brand_name,brand_intro,sell_category,sell_items,photo_url,fb_url,ig_url,tax_id,invoice_title,invoice_email,invoice_type,invoice_carrier,created_at&order=created_at.desc&limit=20`).catch(()=>[]);
    if (!ph && rows.length) return {...rows[0], _source:'registrations'};
    const found = rows.find(r => phoneMatches(r.phone, ph));
    if (found) return {...found, _source:'registrations'};
    if (rows.length) return {...rows[0], _source:'registrations'};
  }
  if (ph) {
    rows = await dbGet(env, 'registrations', `tenant_id=eq.${tenantId}&select=email,phone,name,brand_name,brand_intro,sell_category,sell_items,photo_url,fb_url,ig_url,tax_id,invoice_title,invoice_email,invoice_type,invoice_carrier,created_at&order=created_at.desc&limit=200`).catch(()=>[]);
    const found = rows.find(r => phoneMatches(r.phone, ph));
    if (found) return {...found, _source:'registrations'};
  }
  return null;
}
// getMember
// 報名前預檢：這個 Email 是否已有會員、手機是否一致。
// 只回傳兩個布林值，不吐任何個資，用來提前擋下「填完整張表才被拒」的死路。
async function hCheckMemberEmailPhone(env, p) {
  const TENANT = (p && p._tenantId);
  if (!TENANT) return jsonErr('無法辨識主辦空間');
  const email = normEmail(p && p.email);
  const phone = normPhone(p && p.phone);
  if (!email) return jsonOk({exists:false, match:false});
  let rows = [];
  try {
    rows = await dbGet(env, 'members', `tenant_id=eq.${TENANT}&email=ilike.${encodeURIComponent(email)}&select=phone`);
  } catch (e) {
    logError(env, {source:'hCheckMemberEmailPhone', message:'read member failed', error: e && e.message ? e.message : e});
    return jsonOk({exists:false, match:false});
  }
  if (!rows || !rows.length) return jsonOk({exists:false, match:false});
  const ok = phone ? phoneMatches(rows[0].phone, phone) : false;
  return jsonOk({exists:true, match:!!ok});
}
async function hGetMember(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  const email = normEmail(p && p.email);
  const phone = normPhone(p && p.phone);
  // B-01：只給 Email 就撈得到姓名／手機／統編／發票信箱＝個資外洩。必須成對驗證。
  if (!email || !phone) return jsonErr('請提供 Email 與手機');
  const m = await findVerifiedMemberByEmailPhone(env, TENANT, email, phone);
  if (!m) return jsonOk(null);
  return jsonOk(memberPayloadFromRow(m));
}

async function verifiedPlatformMember(env, token){
  const payload=await verifyAdminJwt(String(token||''),env).catch(()=>null);
  const subject=String(payload&&payload.provider_subject||payload&&payload.google_sub||'');
  if(!payload||payload.type!=='member'||!subject)return null;
  if(payload.provider){const row=await getPlatformMemberByProvider(env,String(payload.provider),subject);if(row)return {payload,row}}
  const providers=['line','google'];
  for(const provider of providers){const row=await getPlatformMemberByProvider(env,provider,subject);if(row)return {payload,row}}
  return null;
}

// ── 會員／品牌／報名協作模型 ─────────────────────────────────────
// 品牌名稱只做候選比對，不是身分證明；同名品牌可並存，必須由會員明確選擇。
function normalizeBrandName(v){
  return String(v||'').normalize('NFKC').trim().toLowerCase().replace(/[\s\u3000]+/g,'');
}
function brandProfileFromRow(row){
  if(!row)return null;
  return {id:row.id||'',name:row.display_name||'',displayName:row.display_name||'',category:row.category||'',intro:row.intro||'',items:row.items||'',facebook:row.facebook_url||'',instagram:row.instagram_url||'',photoUrl:row.profile_url||'',company:row.company_name||'',taxId:row.tax_id||'',status:row.status||'active'};
}
function brandMembershipPayload(row,brand){
  return {...brandProfileFromRow(brand),membershipId:row.id||'',role:row.role||'member',membershipStatus:row.status||'pending',permissions:safeJson(row.permissions_json,{})};
}
function brandOwnerPermissions(){return {edit_brand:true,manage_members:true,submit_registration:true}}
function registrationSubmitterPermissions(){return {view:true,manage_registration:true,invite_team:true,checkin:true,request_teardown:true}}
function registrationOnsitePermissions(){return {view:true,checkin:true,request_teardown:true}}

async function activeBrandMemberships(env,memberId,{includePending=false}={}){
  const id=String(memberId||'').trim();if(!id)return [];
  const statuses=includePending?'active,pending':'active';
  const rows=await dbGet(env,'brand_members',`platform_member_id=eq.${encodeURIComponent(id)}&status=in.(${statuses})&select=*&order=created_at.asc`).catch(()=>[]);
  const ids=[...new Set(rows.map(x=>String(x.brand_id||'')).filter(Boolean))];
  if(!ids.length)return [];
  const brands=await dbGet(env,'brands',`id=in.(${ids.map(x=>'"'+x.replace(/"/g,'')+'"').join(',')})&select=*`).catch(()=>[]),map=Object.fromEntries(brands.map(x=>[String(x.id),x]));
  return rows.filter(x=>map[String(x.brand_id)]).map(x=>({membership:x,brand:map[String(x.brand_id)]}));
}

async function exactBrandCandidates(env,name,excludeMemberId=''){
  const key=normalizeBrandName(name);if(!key)return [];
  const rows=await dbGet(env,'brands',`normalized_name=eq.${encodeURIComponent(key)}&status=in.(active,pending_review)&select=*&order=created_at.asc&limit=8`).catch(()=>[]);
  if(!excludeMemberId)return rows;
  const memberships=await dbGet(env,'brand_members',`platform_member_id=eq.${encodeURIComponent(excludeMemberId)}&status=eq.active&select=brand_id`).catch(()=>[]),own=new Set(memberships.map(x=>String(x.brand_id||'')));
  return rows.filter(x=>!own.has(String(x.id||'')));
}

async function hGetMyBrands(env,p){
  const verified=await verifiedPlatformMember(env,p.member_token||p.memberToken||p.token);
  if(!verified)return jsonErr('會員登入已失效，請重新使用 LINE 登入',401);
  const memberId=String(verified.row.id||''),links=await activeBrandMemberships(env,memberId,{includePending:true});
  const requests=await dbGet(env,'brand_access_requests',`platform_member_id=eq.${encodeURIComponent(memberId)}&select=*&order=created_at.desc&limit=50`).catch(()=>[]);
  return jsonOk({brands:links.map(x=>brandMembershipPayload(x.membership,x.brand)),requests:requests.map(x=>({id:x.id,brandId:x.brand_id,status:x.status,requestType:x.request_type,requestedRole:x.requested_role,note:x.note||'',createdAt:x.created_at||'',resolvedAt:x.resolved_at||''}))});
}

async function hMatchBrandCandidates(env,p){
  const verified=await verifiedPlatformMember(env,p.member_token||p.memberToken||p.token);
  if(!verified)return jsonErr('會員登入已失效，請重新使用 LINE 登入',401);
  const name=String(p.brandName||p.brand_name||p.name||'').trim();if(!name)return jsonOk({matches:[]});
  const rows=await exactBrandCandidates(env,name,String(verified.row.id||''));
  return jsonOk({matches:rows.map(x=>({id:x.id,name:x.display_name||'',category:x.category||'',company:x.company_name||'',profileUrl:x.profile_url||'',status:x.status||'active'})),rule:'品牌同名只提示，不會自動合併會員或品牌'});
}

async function syncPrimaryBrandSnapshot(env,memberId,brand){
  if(!brand)return;
  const vendorJson={brandId:brand.id||'',brandName:brand.display_name||'',brandIntro:brand.intro||'',category:brand.category||'',items:brand.items||'',facebook:brand.facebook_url||'',instagram:brand.instagram_url||'',photoUrl:brand.profile_url||'',company:brand.company_name||'',taxId:brand.tax_id||''};
  await dbUpdate(env,'platform_members',`id=eq.${encodeURIComponent(memberId)}`,{vendor_json:vendorJson,updated_at:nowIso()});
}

async function hSaveMemberBrand(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);
  if(!verified)return jsonErr('會員登入已失效，請重新使用 LINE 登入',401);
  const memberId=String(verified.row.id||''),data=b.brand&&typeof b.brand==='object'?b.brand:b;
  const name=String(data.displayName||data.brandName||data.name||'').trim(),key=normalizeBrandName(name);
  if(!name||!key)return jsonErr('請填寫品牌名稱');
  const allowed=['餐飲美食','手作設計','文創選物','服飾配件','生活用品','親子兒童','寵物相關','收藏娛樂','美類','美業服務','體驗／服務','其他'];
  const category=String(data.category||'').trim();if(category&&!allowed.includes(category))return jsonErr('請重新選擇正式品牌類別');
  const values={display_name:name,normalized_name:key,category,intro:String(data.intro||data.brandIntro||'').trim(),items:String(data.items||'').trim(),facebook_url:String(data.facebook||'').trim(),instagram_url:String(data.instagram||'').trim(),profile_url:String(data.photoUrl||data.profileUrl||'').trim(),company_name:String(data.company||data.companyName||'').trim(),tax_id:String(data.taxId||'').trim(),updated_at:nowIso()};
  const brandId=String(data.brandId||b.brandId||'').trim();
  if(brandId){
    const links=await dbGet(env,'brand_members',`brand_id=eq.${encodeURIComponent(brandId)}&platform_member_id=eq.${encodeURIComponent(memberId)}&status=eq.active&select=*`).catch(()=>[]),link=links[0];
    if(!link||!['owner','manager'].includes(String(link.role||''))||safeJson(link.permissions_json,{}).edit_brand===false)return jsonErr('你沒有編輯這個品牌的權限',403);
    await dbUpdate(env,'brands',`id=eq.${encodeURIComponent(brandId)}&status=neq.merged`,values);
    const brand={id:brandId,...values};await syncPrimaryBrandSnapshot(env,memberId,brand);
    return jsonOk({ok:true,brand:brandMembershipPayload(link,brand),updated:true});
  }
  const candidates=await exactBrandCandidates(env,name,memberId),resolution=String(b.resolution||data.resolution||'').trim();
  if(candidates.length&&!resolution)return jsonOk({needsResolution:true,matches:candidates.map(x=>({id:x.id,name:x.display_name||'',category:x.category||'',company:x.company_name||'',profileUrl:x.profile_url||''})),message:'系統找到可能相同的品牌，請確認一次即可'});
  if(candidates.length&&resolution==='join'){
    const target=String(b.candidateBrandId||data.candidateBrandId||candidates[0].id),candidate=candidates.find(x=>String(x.id)===target);
    if(!candidate)return jsonErr('請重新選擇要加入的品牌');
    const requestType='brand_member',requestId=genId('BAR'),now=nowIso();
    const existing=await dbGet(env,'brand_access_requests',`brand_id=eq.${encodeURIComponent(target)}&platform_member_id=eq.${encodeURIComponent(memberId)}&request_type=eq.${requestType}&status=eq.pending&select=*`).catch(()=>[]);
    if(!existing[0])await dbInsert(env,'brand_access_requests',{id:requestId,brand_id:target,platform_member_id:memberId,request_type:requestType,status:'pending',requested_role:'member',note:String(b.note||data.note||'').trim(),created_at:now,updated_at:now});
    if(requestType==='brand_member'){
      const links=await dbGet(env,'brand_members',`brand_id=eq.${encodeURIComponent(target)}&platform_member_id=eq.${encodeURIComponent(memberId)}&select=*`).catch(()=>[]);
      if(!links[0])await dbInsert(env,'brand_members',{id:genId('BM'),brand_id:target,platform_member_id:memberId,role:'member',status:'pending',permissions_json:{},invited_by_member_id:null,joined_at:null,created_at:now,updated_at:now});
    }
    return jsonOk({ok:true,pendingApproval:true,brandId:target,message:'已送出加入品牌申請，品牌管理者確認後即可共同管理'});
  }
  if(candidates.length&&resolution!=='separate')return jsonErr('請確認你與同名品牌的關係');
  if(candidates.length&&resolution==='separate'){
    const distinguish=String(b.distinguishingInfo||data.distinguishingInfo||values.company_name||values.profile_url||'').trim();
    if(!distinguish)return jsonErr('同名但不同品牌時，請補充地區、公司名稱或介紹網址，避免後台再次誤判');
    values.intro=[values.intro,`辨識資訊：${distinguish}`].filter(Boolean).join('\n');
  }
  const id=genId('BRD'),now=nowIso(),brand={id,...values,status:'active',created_by_member_id:memberId,created_at:now,updated_at:now};
  await dbInsert(env,'brands',brand);
  const link={id:genId('BM'),brand_id:id,platform_member_id:memberId,role:'owner',status:'active',permissions_json:brandOwnerPermissions(),invited_by_member_id:memberId,joined_at:now,created_at:now,updated_at:now};
  try{await dbInsert(env,'brand_members',link)}catch(e){await dbDelete(env,'brands',`id=eq.${encodeURIComponent(id)}`).catch(()=>{});throw e}
  await syncPrimaryBrandSnapshot(env,memberId,brand);
  return jsonOk({ok:true,created:true,brand:brandMembershipPayload(link,brand)});
}

async function hGetBrandAccessRequests(env,p){
  const verified=await verifiedPlatformMember(env,p.member_token||p.memberToken||p.token);if(!verified)return jsonErr('會員登入已失效',401);
  const memberId=String(verified.row.id||''),links=await activeBrandMemberships(env,memberId),managed=links.filter(x=>['owner','manager'].includes(String(x.membership.role||''))&&safeJson(x.membership.permissions_json,{}).manage_members!==false);
  const brandIds=managed.map(x=>String(x.brand.id||''));if(!brandIds.length)return jsonOk([]);
  const rows=await dbGet(env,'brand_access_requests',`brand_id=in.(${brandIds.map(x=>'"'+x.replace(/"/g,'')+'"').join(',')})&status=eq.pending&select=*&order=created_at.asc`).catch(()=>[]),memberIds=[...new Set(rows.map(x=>String(x.platform_member_id||'')).filter(Boolean))];
  const members=memberIds.length?await dbGet(env,'platform_members',`id=in.(${memberIds.map(x=>'"'+x.replace(/"/g,'')+'"').join(',')})&select=id,name,display_name`).catch(()=>[]):[],mm=Object.fromEntries(members.map(x=>[String(x.id),x]));
  return jsonOk(rows.map(x=>({id:x.id,brandId:x.brand_id,memberId:x.platform_member_id,memberName:mm[x.platform_member_id]?.name||mm[x.platform_member_id]?.display_name||'DOING 會員',requestType:x.request_type,requestedRole:x.requested_role,note:x.note||'',createdAt:x.created_at||''})));
}

async function hResolveBrandAccessRequest(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);if(!verified)return jsonErr('會員登入已失效',401);
  const memberId=String(verified.row.id||''),requestId=String(b.requestId||b.id||''),approved=b.approved===true||b.approved==='true';
  const rows=await dbGet(env,'brand_access_requests',`id=eq.${encodeURIComponent(requestId)}&status=eq.pending&select=*`).catch(()=>[]),req=rows[0];if(!req)return jsonErr('找不到待處理申請');
  const links=await dbGet(env,'brand_members',`brand_id=eq.${encodeURIComponent(req.brand_id)}&platform_member_id=eq.${encodeURIComponent(memberId)}&status=eq.active&select=*`).catch(()=>[]),link=links[0];
  if(!link||!['owner','manager'].includes(String(link.role||''))||safeJson(link.permissions_json,{}).manage_members===false)return jsonErr('你沒有管理這個品牌成員的權限',403);
  const now=nowIso();await dbUpdate(env,'brand_access_requests',`id=eq.${encodeURIComponent(req.id)}`,{status:approved?'approved':'rejected',resolved_by_member_id:memberId,resolved_at:now,updated_at:now});
  if(req.request_type==='brand_member'){
    const memberLinks=await dbGet(env,'brand_members',`brand_id=eq.${encodeURIComponent(req.brand_id)}&platform_member_id=eq.${encodeURIComponent(req.platform_member_id)}&select=*`).catch(()=>[]),ml=memberLinks[0];
    if(approved){const data={role:req.requested_role||'member',status:'active',permissions_json:{edit_brand:false,manage_members:false,submit_registration:true},invited_by_member_id:memberId,joined_at:now,updated_at:now};if(ml)await dbUpdate(env,'brand_members',`id=eq.${encodeURIComponent(ml.id)}`,data);else await dbInsert(env,'brand_members',{id:genId('BM'),brand_id:req.brand_id,platform_member_id:req.platform_member_id,...data,created_at:now})}
    else if(ml)await dbUpdate(env,'brand_members',`id=eq.${encodeURIComponent(ml.id)}`,{status:'rejected',updated_at:now});
  }
  return jsonOk({ok:true,approved});
}

async function ensureRegistrationBrand(env,memberId,b){
  const name=String(b.brand||'').trim();if(!name)return {brandId:'',brand:null};
  const requested=String(b.brandId||b.brand_id||'').trim(),links=await activeBrandMemberships(env,memberId);
  if(requested){const found=links.find(x=>String(x.brand.id)===requested);if(!found)return {error:'你目前沒有使用這個品牌報名的權限'};if(safeJson(found.membership.permissions_json,{}).submit_registration===false)return {error:'你可以查看這個品牌，但尚未取得送出報名的權限'};return {brandId:requested,brand:found.brand}}
  const key=normalizeBrandName(name),own=links.filter(x=>normalizeBrandName(x.brand.display_name)===key);
  if(own.length===1){if(safeJson(own[0].membership.permissions_json,{}).submit_registration===false)return {error:'你可以查看這個品牌，但尚未取得送出報名的權限'};return {brandId:own[0].brand.id,brand:own[0].brand}}
  if(own.length>1)return {error:'你有多個同名品牌，請先到「我的 DOING」選擇正確品牌'};
  const candidates=await exactBrandCandidates(env,name,memberId);
  if(candidates.length)return {error:'系統找到同名品牌。請先到「我的 DOING」確認是加入既有品牌，或建立同名但不同的品牌；不會自動合併'};
  const now=nowIso(),id=genId('BRD'),brand={id,display_name:name,normalized_name:key,category:String(b.sellCat||b.sellCategory||''),intro:String(b.brandIntro||''),items:String(b.sellItem||b.sellItems||''),facebook_url:String(b.fb||''),instagram_url:String(b.ig||''),profile_url:String(b.photo||''),company_name:String(b.company||b.invoiceTitle||''),tax_id:String(b.taxId||''),status:'active',created_by_member_id:memberId,created_at:now,updated_at:now};
  await dbInsert(env,'brands',brand);try{await dbInsert(env,'brand_members',{id:genId('BM'),brand_id:id,platform_member_id:memberId,role:'owner',status:'active',permissions_json:brandOwnerPermissions(),invited_by_member_id:memberId,joined_at:now,created_at:now,updated_at:now})}catch(e){await dbDelete(env,'brands',`id=eq.${encodeURIComponent(id)}`).catch(()=>{});throw e}
  await syncPrimaryBrandSnapshot(env,memberId,brand).catch(()=>{});return {brandId:id,brand};
}

async function ensureRegistrationSubmitter(env,TENANT,registrationId,memberId,brandId){
  const existing=await dbGet(env,'registration_members',`registration_id=eq.${encodeURIComponent(registrationId)}&platform_member_id=eq.${encodeURIComponent(memberId)}&select=id`).catch(()=>[]);if(existing[0])return;
  const now=nowIso();await dbInsert(env,'registration_members',{id:genId('RM'),tenant_id:TENANT,registration_id:registrationId,platform_member_id:memberId,brand_id:brandId||null,role:'submitter',status:'active',permissions_json:registrationSubmitterPermissions(),invited_by_member_id:memberId,accepted_at:now,created_at:now,updated_at:now});
}

async function registrationMembership(env,registrationId,memberId){
  const rows=await dbGet(env,'registration_members',`registration_id=eq.${encodeURIComponent(registrationId)}&platform_member_id=eq.${encodeURIComponent(memberId)}&status=eq.active&select=*`).catch(()=>[]);return rows[0]||null;
}

async function issueRegistrationInviteToken(env,invite){
  const now=Date.now();return signAdminJwt({iss:'DOING',type:'registration_member_invite',invite_id:invite.id,registration_id:invite.registration_id,tenant_id:invite.tenant_id,role:invite.role,issued_at:now,expires_at:now+7*24*60*60*1000},env);
}
async function verifyRegistrationInviteToken(env,token){const p=await verifyAdminJwt(String(token||''),env).catch(()=>null);return p&&p.iss==='DOING'&&p.type==='registration_member_invite'&&p.invite_id&&p.registration_id?p:null}
function registrationInviteUrl(env,token){const u=new URL(doingPageUrl(env,'member.html'));u.searchParams.set('registration_invite',token);u.hash='activities';return u.toString()}

async function hCreateRegistrationMemberInvite(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);if(!verified)return jsonErr('會員登入已失效',401);
  const memberId=String(verified.row.id||''),regId=String(b.registrationId||b.regId||''),membership=await registrationMembership(env,regId,memberId);
  if(!membership||safeJson(membership.permissions_json,{}).invite_team!==true)return jsonErr('只有報名送出者或被授權管理者可以邀請出攤夥伴',403);
  const regs=await dbGet(env,'registrations',`id=eq.${encodeURIComponent(regId)}&select=id,tenant_id,brand_id,review_status,transfer_status`).catch(()=>[]),reg=regs[0];if(!reg)return jsonErr('找不到報名');
  if(['已取消','不錄取'].includes(String(reg.review_status||''))||['已退費','已退款'].includes(String(reg.transfer_status||'')))return jsonErr('已結束的報名不能再邀請出攤夥伴');
  const role=String(b.role||'onsite_representative');if(!['onsite_representative','assistant'].includes(role))return jsonErr('邀請角色不正確');
  const now=nowIso(),id=genId('RMI'),expires=new Date(Date.now()+7*24*60*60*1000).toISOString(),invite={id,tenant_id:reg.tenant_id,registration_id:reg.id,brand_id:reg.brand_id||null,role,status:'pending',invited_by_member_id:memberId,accepted_by_member_id:null,expires_at:expires,accepted_at:null,revoked_at:null,created_at:now,updated_at:now};
  await dbInsert(env,'registration_member_invites',invite);const token=await issueRegistrationInviteToken(env,invite);
  return jsonOk({ok:true,inviteId:id,url:registrationInviteUrl(env,token),expiresAt:expires,message:'把連結傳給實際出攤者；對方用自己的 LINE 接受後，就能報到與申請撤場'});
}

async function hAcceptRegistrationMemberInvite(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);if(!verified)return jsonErr('請先使用自己的 LINE 登入，再接受出攤邀請',401);
  const token=await verifyRegistrationInviteToken(env,b.invite_token||b.inviteToken||b.registration_invite);if(!token)return jsonErr('出攤邀請已失效，請報名人重新分享',400);
  const result=await dbRpc(env,'accept_registration_member_invite_atomic',{p_invite_id:String(token.invite_id),p_member_id:String(verified.row.id||''),p_now:nowIso()}).catch(e=>({ok:false,error:e&&e.message?e.message:'接受邀請失敗'}));
  if(!result||result.ok===false)return jsonErr(result?.error||'出攤邀請已失效，請報名人重新分享',409);
  return jsonOk({ok:true,accepted:true,alreadyAccepted:!!result.alreadyAccepted,registrationId:result.registrationId||token.registration_id,message:result.alreadyAccepted?'你已經加入這筆活動':'已加入這筆活動；你可以查看位置、設備、報到與申請撤場'});
}

async function hGetRegistrationTeam(env,p){
  const verified=await verifiedPlatformMember(env,p.member_token||p.memberToken||p.token);if(!verified)return jsonErr('會員登入已失效',401);
  const regId=String(p.registrationId||p.regId||''),memberId=String(verified.row.id||''),self=await registrationMembership(env,regId,memberId);if(!self)return jsonErr('你不是這筆報名的成員',403);
  const rows=await dbGet(env,'registration_members',`registration_id=eq.${encodeURIComponent(regId)}&status=eq.active&select=*&order=created_at.asc`).catch(()=>[]),ids=[...new Set(rows.map(x=>String(x.platform_member_id||'')).filter(Boolean))];
  const members=ids.length?await dbGet(env,'platform_members',`id=in.(${ids.map(x=>'"'+x.replace(/"/g,'')+'"').join(',')})&select=id,name,display_name`).catch(()=>[]):[],mm=Object.fromEntries(members.map(x=>[String(x.id),x]));
  return jsonOk(rows.map(x=>({memberId:x.platform_member_id,name:mm[x.platform_member_id]?.name||mm[x.platform_member_id]?.display_name||'DOING 會員',role:x.role,status:x.status,permissions:safeJson(x.permissions_json,{}),isMe:String(x.platform_member_id)===memberId})));
}

async function hMemberOnsiteAction(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);if(!verified)return jsonErr('會員登入已失效',401);
  const regId=String(b.registrationId||b.regId||''),memberId=String(verified.row.id||''),membership=await registrationMembership(env,regId,memberId);if(!membership)return jsonErr('你不是這筆報名的現場人員',403);
  const perms=safeJson(membership.permissions_json,{}),action=String(b.onsiteAction||b.mode||'');
  const rows=await dbGet(env,'registrations',`id=eq.${encodeURIComponent(regId)}&select=*`).catch(()=>[]),reg=rows[0];if(!reg)return jsonErr('找不到報名');
  const now=nowIso(),operator=verified.row.name||verified.row.display_name||memberId;
  if(action==='checkin'){
    if(perms.checkin!==true)return jsonErr('你沒有這筆報名的報到權限',403);const err=checkinGuard(reg,false);if(err)return jsonErr(err);
    if(String(reg.checkin_status)==='已報到')return jsonOk({ok:true,alreadyDone:true,status:'已報到',at:reg.checkin_at||''});
    await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(regId)}&tenant_id=eq.${encodeURIComponent(reg.tenant_id)}`,checkinData(false,now));
    await dbInsert(env,'seat_operation_logs',{id:genId('OPL'),tenant_id:reg.tenant_id,session_id:reg.session_id||null,registration_id:regId,stall_id:null,action:'participant_checkin',operator_type:'participant',operator_id:operator,note:'member:'+memberId,created_at:now}).catch(()=>{});
    return jsonOk({ok:true,status:'已報到',at:now});
  }
  if(action==='request_teardown'){
    if(perms.request_teardown!==true)return jsonErr('你沒有這筆報名的撤場權限',403);if(String(reg.checkin_status)!=='已報到')return jsonErr('尚未完成報到，不能申請撤場');
    if(String(reg.teardown_status)==='已申請撤場'||String(reg.clear_status)==='已清場')return jsonOk({ok:true,alreadyDone:true,status:reg.clear_status==='已清場'?'已清場':'已申請撤場'});
    await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(regId)}&tenant_id=eq.${encodeURIComponent(reg.tenant_id)}`,{teardown_status:'已申請撤場',updated_at:now});
    await dbInsert(env,'seat_operation_logs',{id:genId('OPL'),tenant_id:reg.tenant_id,session_id:reg.session_id||null,registration_id:regId,stall_id:null,action:'participant_teardown_request',operator_type:'participant',operator_id:operator,note:'member:'+memberId,created_at:now}).catch(()=>{});
    return jsonOk({ok:true,status:'已申請撤場',at:now});
  }
  return jsonErr('未知的現場操作');
}

async function hGetPlatformMemberProfile(env,p){
  const verified=await verifiedPlatformMember(env,p.member_token||p.token);
  if(!verified)return jsonErr('會員登入已失效，請重新登入');
  const v=safeJson(verified.row.vendor_json,{});
  const email=platformContactEmail(verified.row),memberId=String(verified.row.id||'');
  const applicationRows=await dbGet(env,'tenant_apply_logs','select=id,brand_name,contact_email,status,created_at,approved_at,supplement_requested_at,supplement_submitted_at,rejected_at,tenant_id,application_json&order=created_at.desc&limit=500').catch(()=>[]);
  const applications=applicationRows.filter(x=>!isQaApplication(x)&&(String(safeJson(x.application_json,{}).memberId||'')===memberId||(!safeJson(x.application_json,{}).memberId&&email&&normEmail(x.contact_email)===email))).slice(0,20);
  const workspaces=await findAdminWorkspacesByMemberId(env,memberId);
  const identities=await dbGet(env,'platform_member_identities',`member_id=eq.${encodeURIComponent(memberId)}&select=provider,provider_email,last_login_at&order=last_login_at.desc`).catch(()=>[]);
  const platformRows=await dbGet(env,'platform_staff',`platform_member_id=eq.${encodeURIComponent(memberId)}&is_active=eq.true&select=id,name,role,normalized_role&limit=1`).catch(()=>[]),platformStaff=platformRows[0]||null;
  const brandLinks=await activeBrandMemberships(env,memberId,{includePending:true}),brands=brandLinks.map(x=>brandMembershipPayload(x.membership,x.brand)),primary=brands.find(x=>x.membershipStatus==='active')||null;
  const roles=['participant'];if(primary||v.brandName)roles.push('vendor');if(applications.length)roles.push('organizer_applicant');if(workspaces.length)roles.push('organizer');if(platformStaff)roles.push('platform_admin');
  const brandName=primary?.name||v.brandName||'',brandIntro=primary?.intro||v.brandIntro||'',brandCategory=primary?.category||v.category||'',brandItems=primary?.items||v.items||'';
  return jsonOk({profile:{id:memberId,email,name:verified.row.name||verified.row.display_name||'',phone:verified.row.phone||'',lineId:verified.row.line_id||'',city:verified.row.city||'',primaryBrandId:primary?.id||v.brandId||'',brand:brandName,brand_name:brandName,brandIntro,sellCat:brandCategory,sellItem:brandItems,fb:primary?.facebook||v.facebook||'',ig:primary?.instagram||v.instagram||'',photo:primary?.photoUrl||v.photoUrl||'',company:primary?.company||v.company||'',taxId:primary?.taxId||v.taxId||''},brands,complete:platformMemberComplete(verified.row),provider:verified.row._identity?.provider||'',linkedProviders:[...new Set(identities.map(x=>String(x.provider||'')).filter(Boolean))],roles,platformAccess:platformStaff?{role:'platform_super_admin',name:platformStaff.name||'DOING 平台總管理者'}:null,applications:applications.map(x=>{const a=safeJson(x.application_json,{});return{id:x.id,unitName:a.unitName||x.brand_name||'',industryCategories:Array.isArray(a.industryCategories)?a.industryCategories:[],useCases:Array.isArray(a.useCases)?a.useCases:[],status:x.status||'pending',createdAt:x.created_at||'',approvedAt:x.approved_at||a.approvedAt||'',supplementRequestedAt:x.supplement_requested_at||a.supplementRequestedAt||'',supplementSubmittedAt:x.supplement_submitted_at||a.supplementSubmittedAt||'',rejectedAt:x.rejected_at||a.rejectedAt||'',tenantId:x.tenant_id||'',timeline:Array.isArray(a.timeline)?a.timeline:[]}}),workspaces:workspaces.map(x=>({id:x.tenant_id||x.id,name:x.name||x.tenant_id||x.id,role:x.role||'',isLocked:!!x.is_locked,lockedReason:x.locked_reason||''}))});
}

function isQaApplication(row){
  const app=safeJson(row&&row.application_json,{}),name=String(app.unitName||(row&&row.brand_name)||'').trim();
  return app.qaTest===true||Boolean(String(app.qaRun||'').trim())||/^DOING QA(?:\s|$)/i.test(name);
}

function platformContactEmail(row){return normEmail(row&&(row.contact_email||row.email))}

async function platformIdentityCollision(env,memberId,contactEmail,phone){
  const id=String(memberId||''),email=normEmail(contactEmail),normalizedPhone=normPhone(phone);
  const [members,identities]=await Promise.all([
    dbGet(env,'platform_members','select=id,email,contact_email,phone,phone_normalized,name,completed_at,email_verified_at&limit=1000').catch(()=>[]),
    email?dbGet(env,'platform_member_identities',`provider_email=ilike.${encodeURIComponent(email)}&select=member_id,provider`).catch(()=>[]):Promise.resolve([])
  ]);
  const verifiedEmailMemberIds=new Set(identities.map(x=>String(x.member_id||'')));
  const matches=members.filter(row=>{
    if(String(row.id||'')===id)return false;
    const emailHit=!!email&&(normEmail(row.email)===email||normEmail(row.contact_email)===email||verifiedEmailMemberIds.has(String(row.id||'')));
    const phoneHit=!!normalizedPhone&&normPhone(row.phone_normalized||row.phone)===normalizedPhone&&!!(row.completed_at||row.name);
    return emailHit||phoneHit;
  });
  const emailMatch=matches.some(row=>normEmail(row.email)===email||normEmail(row.contact_email)===email||verifiedEmailMemberIds.has(String(row.id||'')));
  const phoneMatch=matches.some(row=>normalizedPhone&&normPhone(row.phone_normalized||row.phone)===normalizedPhone);
  // 手機目前只是聯絡／風險提示資料，尚未做 SMS OTP，不能據此合併會員、授權或阻擋登入。
  // 例如夫妻可能共用聯絡電話；兩個不同 LINE 身分仍必須保留為兩位會員。
  return {found:emailMatch,emailMatch,phoneMatch,phoneVerified:false};
}

async function hSavePlatformMemberProfile(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.token);
  if(!verified)return jsonErr('會員登入已失效，請重新登入');
  const name=String(b.name||'').trim(),email=normEmail(b.email),phone=normPhone(b.phone);
  if(!name||!email||!phone)return jsonErr('姓名、Email 與手機為必填');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return jsonErr('Email 格式不正確');
  if(phone.length<9)return jsonErr('手機格式不正確');
  const collision=await platformIdentityCollision(env,verified.row.id,email,phone);
  if(collision.found)return jsonErr('登入已成功，但這個 Email 已連結既有 DOING 帳號。請先使用原 LINE／Google 登入並連結帳號；無法使用舊登入時請聯絡平台協助。');
  const hasVendor=Object.prototype.hasOwnProperty.call(b,'vendor'),vendor=hasVendor&&b.vendor&&typeof b.vendor==='object'?b.vendor:safeJson(verified.row.vendor_json,{});
  const allowedVendorCategories=['餐飲美食','手作設計','文創選物','服飾配件','生活用品','親子兒童','寵物相關','收藏娛樂','美類','美業服務','體驗／服務','其他'];
  const vendorCategory=String(vendor.category||'').trim();
  if(vendorCategory&&!allowedVendorCategories.includes(vendorCategory))return jsonErr('請重新選擇正式品牌類別');
  const vendorJson={brandName:String(vendor.brandName||'').trim(),brandIntro:String(vendor.brandIntro||'').trim(),category:vendorCategory,items:String(vendor.items||'').trim(),facebook:String(vendor.facebook||'').trim(),instagram:String(vendor.instagram||'').trim(),photoUrl:String(vendor.photoUrl||'').trim(),company:String(vendor.company||'').trim(),taxId:String(vendor.taxId||'').trim()};
  const update={contact_email:email,phone,phone_normalized:phone,name,line_id:String(b.lineId||'').trim(),city:String(b.city||'').trim(),completed_at:nowIso(),updated_at:nowIso()};
  if(hasVendor)update.vendor_json=vendorJson;
  await dbUpdate(env,'platform_members',`id=eq.${encodeURIComponent(verified.row.id)}`,update);
  let applicationId='';
  const sys=b.systemApplication&&typeof b.systemApplication==='object'?b.systemApplication:null;
  if(sys&&sys.enabled){
    const unitName=String(sys.unitName||vendor.brandName||vendor.company||'').trim();
    const industries=Array.isArray(sys.industryCategories)?sys.industryCategories.map(String).filter(Boolean):[];
    const useCases=Array.isArray(sys.useCases)?sys.useCases.map(String).filter(Boolean):[];
    if(!unitName||!industries.length||!useCases.length)return jsonErr('系統申請請完整填寫單位名稱、產業類別與使用功能');
    const submittedAt=nowIso(),applicationJson={unitName,ownerName:name,phone,industryCategories:industries,useCases,publicLinks:[vendor.facebook,vendor.instagram,vendor.photoUrl].filter(Boolean),memberId:verified.row.id,loginProvider:verified.row._identity?.provider||'',createdAt:submittedAt,submittedAt,timeline:[{key:'application_created',label:'建立申請',at:submittedAt},{key:'application_submitted',label:'已驗證並送出',at:submittedAt}]};
    const existing=await dbGet(env,'tenant_apply_logs',`contact_email=eq.${encodeURIComponent(email)}&brand_name=eq.${encodeURIComponent(unitName)}&status=in.(pending,supplement_required)&select=id`).catch(()=>[]);
    if(existing[0]){applicationId=existing[0].id;await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{contact_name:name,contact_phone:phone,event_type:useCases.join(','),application_json:applicationJson})}
    else{applicationId=genId('APL');await dbInsert(env,'tenant_apply_logs',{id:applicationId,brand_name:unitName,contact_name:name,contact_email:email,contact_phone:phone,event_type:useCases.join(','),plan_type:'review',note:'由已驗證 DOING 會員送出',status:'pending',application_json:applicationJson,created_at:submittedAt})}
  }
  return jsonOk({ok:true,complete:true,applicationId});
}

async function memberRegistrationRows(env,memberId,tenantId=''){
  const id=String(memberId||'').trim();if(!id)return {rows:[],membershipMap:{}};
  const tenantFilter=tenantId?`tenant_id=eq.${encodeURIComponent(tenantId)}&`:'';
  const [direct,submitted,memberships]=await Promise.all([
    dbGet(env,'registrations',`${tenantFilter}platform_member_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc&limit=500`).catch(()=>[]),
    dbGet(env,'registrations',`${tenantFilter}submitted_by_member_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc&limit=500`).catch(()=>[]),
    dbGet(env,'registration_members',`${tenantFilter}platform_member_id=eq.${encodeURIComponent(id)}&status=eq.active&select=*&order=created_at.desc&limit=500`).catch(()=>[])
  ]);
  const teamIds=[...new Set(memberships.map(x=>String(x.registration_id||'')).filter(Boolean))],team=teamIds.length?await dbGet(env,'registrations',`${tenantFilter}id=in.(${teamIds.map(x=>'"'+x.replace(/"/g,'')+'"').join(',')})&select=*&order=created_at.desc&limit=500`).catch(()=>[]):[];
  const map=new Map();for(const r of [...direct,...submitted,...team])if(r&&r.id&&!map.has(String(r.id)))map.set(String(r.id),r);
  const membershipMap=Object.fromEntries(memberships.map(x=>[String(x.registration_id),x]));
  return {rows:[...map.values()].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)),membershipMap};
}

// getMyRegs
async function hGetMyRegs(env, p) {
  const TENANT = (p && p._tenantId);
  const verified=await verifiedPlatformMember(env,p&&(p.member_token||p.memberToken||p.token));
  if(!verified||!platformMemberComplete(verified.row))return jsonErr('會員登入已失效，請重新使用 LINE 登入');
  const platformMemberId=String(verified.row.id||'').trim();
  const email=platformContactEmail(verified.row);
  if(!platformMemberId)return jsonErr('找不到會員資料，請重新使用 LINE 登入');

  const accessible=await memberRegistrationRows(env,platformMemberId,TENANT),regs=accessible.rows,membershipMap=accessible.membershipMap;
  const [sessions, units] = await Promise.all([
    dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&select=id,name,event_id,venue,dates_json,equip_json,basic_equip,seat_pricing_enabled,seat_hold_hours,seat_map_url,force_cancel,force_cancel_deadline,force_cancel_target_id,modules_json`),
    dbGet(env, 'operation_units', `tenant_id=eq.${TENANT}&select=*`).catch(()=>[]),
  ]);
  const sMap = {}; sessions.forEach(s=>sMap[s.id]=s);const uMap={};units.forEach(u=>uMap[u.id]=u);
  return jsonOk(await Promise.all(regs.map(async r=>{
    const s = sMap[r.session_id]||{},u=uMap[r.operation_unit_id]||null;
    const paySnap = await ensurePaymentSnapshotForReg(env,TENANT,r,s,{writeIfSafe:true}).catch(()=>_paymentSnapshotFromReg(r));
    const payPub = _paymentSnapshotPublic(paySnap);
    let displayDates=safeJson(s.dates_json,[]);if(u){const uts=await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(TENANT)}&operation_unit_id=eq.${encodeURIComponent(u.id)}&select=*&order=date_key.asc,start_text.asc`).catch(()=>[]);if(uts.length)displayDates=uts.map(x=>({date:x.date_key,label:x.label||x.date_key,start:x.start_text||'',end:x.end_text||'',timeslotId:x.id,limit:safeNum(x.capacity)}))}
    const membership=membershipMap[String(r.id)]||null,memberPermissions=membership?safeJson(membership.permissions_json,{}):registrationSubmitterPermissions();
    return {
      id:r.id, sessionId:r.session_id, sessionName:s.name||r.session_id, operationUnitId:r.operation_unit_id||'', operationUnitName:u?.name||'',
      eventId:r.event_id||s.event_id||'', name:r.name||'', brandId:r.brand_id||'',brand:r.brand_name||'',memberRole:membership?.role||'submitter',memberPermissions,
      venue:s.venue||'', sessionDates:displayDates,
      status:r.review_status, payStatus:r.payment_status,
      amount:Number(r.amount||0), total:Number(r.total_amount||r.amount||0), paid:Number(r.paid_amount||0),
      due:(()=>{const snap=selectedModuleSnapshot(r),paid=safeNum(r.paid_amount),total=safeNum(r.total_amount||r.amount);const first=safeNum(snap.amountDueNow);return Math.max(0,(paid<=0&&first>0?first:total)-paid)})(), deposit:Number(r.deposit||0),
      stallCount:Number(r.stall_count||1), selectedDates:safeJson(r.selected_dates_json,[]), equip:safeJson(r.equipment_json,{}),
      totalEquipmentText:_equipmentTextFromMap(_effectiveEquipmentMapForReg(r, s)), preNoticeEquipmentText:_equipmentTextFromMap(_effectiveEquipmentMapForReg(r, s)),
      addonQty:safeJson(r.addon_qty_json,{}), participants:safeJson(r.participants_json,{}), stallNumber:r.stall_number||'',
      seatChoiceIntent:r.seat_choice_intent||'auto', seatChoiceStatus:r.seat_choice_status||'', seatChoiceType:r.seat_choice_type||'',
      bundleId:r.bundle_id||'', bundleGroupId:r.bundle_group_id||'',
      paymentDueAt:r.payment_due_at||'',paymentReminderAt:r.payment_reminder_at||'',paymentExpiredAt:r.payment_expired_at||'',
      transferCreditAmount:safeNum(r.transfer_credit_amount),transferBalanceDue:safeNum(r.transfer_balance_due),transferRefundDue:safeNum(r.transfer_refund_due),transferSettlementId:r.transfer_settlement_id||'',
      seatPricingEnabled:(s.seat_pricing_enabled===true||s.seat_pricing_enabled==='true'), seatHoldHours:safeNum(s.seat_hold_hours)||SEAT_HOLD_HOURS,
      seatMapUrl:s.seat_map_url||'', seatFeeTotal:safeNum(r.seat_fee_total), seatHoldExpiresAt:r.seat_hold_expires_at||'',
      payMethod:r.payment_method||'', payLast5:r.payment_last5||'', checkin:r.checkin_status,teardownStatus:r.teardown_status||'未撤場',clearStatus:r.clear_status||'未清場', createdAt:r.created_at, approvedAt:r.approved_at||'', paymentReportedAt:r.payment_reported_at||'', paidAt:r.paid_at||'', checkinAt:r.checkin_at||'',
      transferStatus:r.transfer_status||'', transferChosenAt:r.transfer_chosen_at||'', refundAmount:safeNum(r.refund_amount),
      refundAdminFee:safeNum(r.refund_admin_fee), refundTransferFee:safeNum(r.refund_transfer_fee), refundRuleLabel:r.refund_rule_label||'', refundedAt:r.refunded_at||'', refundNote:r.refund_note||'',
      forceStatus:r.force_status || (s.force_cancel ? (r.transfer_status==='申請退費'?'refund_requested':(r.transfer_status==='已延期'?'transferred':'pending_force_choice')) : null),
      forceChoiceDeadline:s.force_cancel_deadline||'', forceCancelled:s.force_cancel||false, forceMode:s.force_cancel?'cancel':'', forceCancelReasonLabel:s.force_cancel_reason_label||'',
      forceTransferTargetSessionId:r.transferred_to_session_id||s.force_cancel_target_id||'', forceRefundRequestedAt:r.force_refund_requested_at||'', forceRefundedAt:r.force_refunded_at||'',
      agreementAccepted:r.agreement_accepted||false, agreementVersion:r.agreement_version||'',
      modules:normalizeSessionModules(u?safeJson(u.modules_json,{}):safeJson(s.modules_json,{})), rewardBalance:await rewardBalance(env,TENANT,email), rescheduleCount:safeNum(selectedModuleSnapshot(r).rescheduleCount), bookingPolicy:selectedModuleSnapshot(r).bookingPolicy||normalizeSessionModules(safeJson(s.modules_json,{})).bookingPolicy,
      paymentProfile:payPub, paymentProfileName:payPub.paymentProfileName, paymentOwnerMode:payPub.paymentOwnerMode,
      allowedPaymentMethods:payPub.allowedMethods, bankAccount:payPub.bankAccount, linepay:payPub.linepay, card:payPub.card,
    };
  })));
}
// getRegLookup（信件深連結用：依 regId 反查 email，不依賴瀏覽器暫存）
// B-02：本 API 原本可用 regId 反查 Email，而 regId 又能串取消／選位／付款／退費，
// 形成完整攻擊鏈。已停用，改由 Email＋手機登入「我的紀錄」取得自己的報名。
async function hGetRegLookup(env, p) {
  return jsonErr('為保護個資，此查詢已停用。請使用 Email＋手機登入「我的紀錄」。');
}

// getAnnouncements
async function hGetAnnouncements(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  const rows = await dbGet(env, 'announcements', `tenant_id=eq.${TENANT}&select=*&order=created_at.desc`);
  return jsonOk(rows.map(r=>({id:r.id,title:r.title,content:r.content,url:r.url,urlText:r.url_text,createdAt:r.created_at,paymentProfileId:r.payment_profile_id||'',paymentProfile:_paymentSnapshotPublic(safeJson(r.payment_profile_snapshot,null))})));
}

// ── 舊 Google unified OAuth 已停用 ────────────────────────
// DOING 現行公開入口使用 LINE；Google OAuth 路由完整保留但不顯示。
// 下方 staff/member 輔助函式保留供既有其他流程相容。

// 輔助：檢查是否為 staff
async function checkIsStaff(env, email, tenantId) {
  const platformRows = await dbGet(env, 'platform_staff', `email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=email`).catch(()=>[]);
  if (platformRows[0]) return true;
  const rows = await dbGet(env, 'staff', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}&select=email,is_active,active`).catch(()=>[]);
  if (!rows[0]) return false;
  const active = rows[0].is_active !== undefined ? rows[0].is_active : rows[0].active;
  return active !== false;
}

// 輔助：檢查是否為 member
async function checkIsMember(env, email, tenantId) {
  const rows = await dbGet(env, 'members', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}&select=email`).catch(()=>[]);
  return rows.length > 0;
}

// 輔助：用 email 簽發 staff token
async function issueStaffTokenByEmail(env, email, tenantId) {
  const platformRows = await dbGet(env, 'platform_staff', `email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=*`).catch(()=>[]);
  if (platformRows[0]) return issueAdminToken({ ...platformRows[0], email }, 'platform', env);
  const rows = await dbGet(env, 'staff', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}&select=*`).catch(()=>[]);
  if (!rows[0]) throw new Error('staff not found');
  const active = rows[0].is_active !== undefined ? rows[0].is_active : rows[0].active;
  if (active === false) throw new Error('staff inactive');
  return issueAdminToken({ ...rows[0], email }, tenantId, env);
}

// 輔助：更新 staff 最後登入
async function updateStaffLastLogin(env, email, tenantId, displayName) {
  await dbUpdate(env, 'staff', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}`,
    { last_login_at: new Date().toISOString(), display_name: displayName }).catch(()=>{});
}

// 輔助：更新 member 最後登入 + Google 資料
async function updateMemberLastLogin(env, email, tenantId, googleSub, displayName, avatarUrl) {
  const rows = await dbGet(env, 'members', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}&select=email`).catch(()=>[]);
  if (rows[0]) {
    await dbUpdate(env, 'members', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}`,
      { last_login_at: new Date().toISOString(), google_sub: googleSub, display_name: displayName, avatar_url: avatarUrl, login_provider: 'google' }).catch(()=>{});
  } else {
    // 新會員：建立記錄
    await dbInsert(env, 'members', {
      email, tenant_id: tenantId, google_sub: googleSub,
      display_name: displayName, avatar_url: avatarUrl,
      login_provider: 'google', last_login_at: new Date().toISOString(),
      joined_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).catch(()=>{});
  }
}

// ── 申請試用 API ──────────────────────────────────────────────────

// 營運帳號申請先完整寫入資料庫，再以申請編號進行 LINE 驗證；Google 流程保留但不從公開入口觸發。
async function hCreateOrganizerApplicationDraft(env,b){
  const app=(b&&b.application&&typeof b.application==='object')?b.application:{};
  const unitName=String(app.unitName||'').trim(),ownerName=String(app.ownerName||'').trim(),phone=String(app.phone||'').trim(),contactEmail=normEmail(app.contactEmail||app.email||'');
  const industries=Array.isArray(app.industryCategories)?app.industryCategories.map(String).filter(Boolean).slice(0,20):[];
  const useCases=Array.isArray(app.useCases)?app.useCases.map(String).filter(Boolean).slice(0,20):[];
  const publicLinks=Array.isArray(app.publicLinks)?app.publicLinks.map(x=>String(x||'').trim()).filter(Boolean).slice(0,8):[];
  if(!unitName||!ownerName||!phone||!contactEmail)return jsonErr('營運單位、姓名、Email 與聯絡電話不可空白');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))return jsonErr('Email 格式不正確');
  if(!industries.length)return jsonErr('請至少選擇一個產業類別');
  if(!useCases.length)return jsonErr('請至少選擇一個 DOING 使用情境');
  if(!publicLinks.length&&app.noPublicLink!==true)return jsonErr('請至少提供一項公開資訊');
  const confirmations=(app.confirmations&&typeof app.confirmations==='object')?app.confirmations:{};
  if(confirmations.confirmReal!==true||confirmations.confirmUse!==true||confirmations.confirmReview!==true)return jsonErr('請先完成送出前確認');
  const id=genId('APL'),createdAt=nowIso();
  const applicationJson={...app,contactEmail,ownerName,contactName:ownerName,billingName:ownerName,industryCategories:industries,useCases,publicLinks,createdAt,timeline:[...(Array.isArray(app.timeline)?app.timeline:[]),{key:'application_created',label:'建立申請',at:createdAt}]};
  await dbInsert(env,'tenant_apply_logs',{
    id,brand_name:unitName,contact_name:ownerName,contact_email:contactEmail,contact_phone:phone,
    event_type:useCases.join(','),plan_type:'review',note:'等待 LINE 驗證',status:'line_verification_pending',application_json:applicationJson,created_at:createdAt
  });
  return jsonOk({ok:true,applicationId:id});
}

// 主辦申請為「LINE 驗證後送審」，審核通過才建立 Tenant / Owner / 創業金；Google 驗證程式保留備用。
async function hApplyTrial(env,b){
  const brand=String(b.brand_name||'').trim(),contact=String(b.contact_name||'').trim(),email=normEmail(b.contact_email||''),phone=String(b.contact_phone||'').trim();
  if(!brand||!contact||!email||!phone)return jsonErr('主辦基本資料不完整');
  const existing=await dbGet(env,'tenant_apply_logs',`contact_email=eq.${encodeURIComponent(email)}&status=eq.pending&select=id`).catch(()=>[]);
  if(existing.length)return jsonOk({ok:true,pending:true,applyId:existing[0].id});
  const id=genId('APL'),now=nowIso();
  await dbInsert(env,'tenant_apply_logs',{
    id,brand_name:brand,contact_name:contact,contact_email:email,contact_phone:phone,
    event_type:String(b.event_type||''),plan_type:'review',note:String(b.note||''),status:'pending',
    application_json:b.application_json||{},created_at:now
  });
  return jsonOk({ok:true,pending:true,applyId:id});
}
async function hApproveApply(env,b){
  const pay=await verifyAdminJwt(b.token,env);
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限',401);
  const applyId=String(b.apply_id||'').trim();if(!applyId)return jsonErr('缺少申請資料');
  const rows=await dbGet(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}&select=*`).catch(()=>[]);
  const apply=rows[0];if(!apply)return jsonErr('找不到申請資料');
  if(String(apply.status)!=='pending')return jsonErr('此申請已處理');
  const email=normEmail(apply.contact_email),brand=String(apply.brand_name||'').trim(),contact=String(apply.contact_name||brand).trim();
  if(!email||!brand)return jsonErr('申請資料不完整');
  const base=brand.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,20)||'doing';
  let tid=String(b.tenant_id||'').trim().toLowerCase()||base;
  for(let i=0;i<30;i++){
    const hit=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(tid)}&select=id`).catch(()=>[]);
    if(!hit.length)break;
    tid=base+'-'+crypto.randomUUID().replace(/-/g,'').slice(0,4);
  }
  const now=nowIso(),app=safeJson(apply.application_json,{});
  const mp=safeJson(app.moduleProfile,{});
  const defaults=normalizeSessionModules(mp.defaults||{});
  const requested=safeJson(app.needFlags,{});
  const suggestedFlags={registration:true};
  for(const key of Object.keys(DEFAULT_TENANT_MODULE_FLAGS)){
    if(key==='registration')continue;
    const requestKey=key==='googleCalendar'?'calendar':key;
    suggestedFlags[key]=requested[requestKey]===true||(key==='i18n'?defaults.i18n?.enabled===true:defaults[key]===true);
  }
  const approvedFlags=normalizeApprovedModuleFlags(b.module_flags,suggestedFlags);
  approvedFlags.businessType=String(mp.useType||'generic');
  for(const key of Object.keys(DEFAULT_TENANT_MODULE_FLAGS))if(approvedFlags[key]===false)defaults[key]=false;
  const profile={configured:true,useType:String(mp.useType||'generic'),useCases:Array.isArray(mp.useCases)?mp.useCases.map(String).slice(0,12):[],defaults,updatedAt:now};
  try{
    await dbInsert(env,'tenants',{
      id:tid,slug:tid,name:brand,status:'active',plan_type:'active',is_locked:false,
      contact_name:contact,contact_phone:String(apply.contact_phone||''),event_type:String(apply.event_type||''),
      notify_email:email,config_json:JSON.stringify({moduleProfile:profile,industryCategories:Array.isArray(app.industryCategories)?app.industryCategories:[]}),payment_config_json:'{}',
      default_refund_rules_json:'{}',created_at:now,updated_at:now
    });
    try{
      await dbInsert(env,'staff',{
        id:genId('STF'),tenant_id:tid,email,name:contact,display_name:contact,
        platform_member_id:String(app.memberId||'').trim()||null,
        role:'organizer_owner',normalized_role:'organizer_owner',is_active:true,active:true,
        perms_json:JSON.stringify({events:true,sessions:true,review:true,finance:true,checkin:true,announce:true,members:true,settings:true}),
        limit_sessions:'',created_at:now,updated_at:now
      });
    }catch(e){await dbDelete(env,'tenants',`id=eq.${encodeURIComponent(tid)}`).catch(()=>{});throw e}
    await dbInsert(env,'tenant_settings',{tenant_id:tid,module_flags_json:approvedFlags,theme_json:{key:'cute_pastel',updatedAt:now}});
    await grantStartupCreditIfEligible(env,tid);
    await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}`,{
      status:'approved',tenant_id:tid,approved_at:now,approved_by:pay.email,rejection_reason:null,rejected_at:null,rejected_by:null,
      application_json:{...app,approvedModuleFlags:approvedFlags,approvedModuleFlagsAt:now,approvedAt:now,timeline:[...(Array.isArray(app.timeline)?app.timeline:[]),{key:'application_approved',label:'審核通過並建立帳號',at:now}]}
    });
    try{
      const baseUrl=String(env.DOING_SITE_URL||env.FRONTEND_SITE_URL||'https://ndiangrace-create.github.io/DOING/').replace(/\/+$/,'/');
      await sendEmail(env,email,'【DOING】營運帳號申請已通過',emailWrap(`<p>${contact} 您好：</p><p>您的 DOING 營運帳號申請已通過，可以開始使用主辦工作台。</p><p><a href="${baseUrl}">前往 DOING</a></p>`));
    }catch(e){}
    return jsonOk({ok:true,tenantId:tid,moduleFlags:approvedFlags,adminUrl:`admin.html?tenant=${encodeURIComponent(tid)}`});
  }catch(e){
    await dbDelete(env,'billing_logs',`tenant_id=eq.${encodeURIComponent(tid)}&billing_type=eq.startup_credit_grant&confirmed_by=eq.system_onboarding`).catch(()=>{});
    await dbDelete(env,'staff',`tenant_id=eq.${encodeURIComponent(tid)}&email=eq.${encodeURIComponent(email)}`).catch(()=>{});
    await dbDelete(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(tid)}`).catch(()=>{});
    await dbDelete(env,'tenants',`id=eq.${encodeURIComponent(tid)}`).catch(()=>{});
    return jsonErr('開通失敗：'+(e&&e.message?e.message:'資料建立失敗'));
  }
}
async function hRejectApply(env,b){
  const pay=await verifyAdminJwt(b.token,env);
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限',401);
  const applyId=String(b.apply_id||'').trim(),reason=String(b.reason||'').trim();
  if(!applyId)return jsonErr('缺少申請資料');
  const rows=await dbGet(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}&select=*`).catch(()=>[]);
  const apply=rows[0];if(!apply)return jsonErr('找不到申請資料');
  if(String(apply.status)!=='pending')return jsonErr('此申請已處理');
  const rejectedAt=nowIso(),app=safeJson(apply.application_json,{});
  await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}`,{
    status:'rejected',rejected_at:rejectedAt,rejected_by:pay.email,rejection_reason:reason||'申請資料未通過審核',application_json:{...app,rejectedAt,timeline:[...(Array.isArray(app.timeline)?app.timeline:[]),{key:'application_rejected',label:'申請未通過',at:rejectedAt}]}
  });
  try{await sendEmail(env,apply.contact_email,'【DOING】營運帳號申請結果',emailWrap(`<p>${apply.contact_name||''} 您好：</p><p>本次 DOING 營運帳號申請尚未通過審核。</p>${reason?`<p>說明：${reason}</p>`:''}<p>如資料需要補充，可重新提出申請。</p>`));}catch(e){}
  return jsonOk({ok:true});
}

// GET /apply/list — 查詢申請列表（平台管理員用）
// GET /getTenantsAdmin — 平台管理員查詢所有租戶
// BUG-B FIX 2025-06
function platformIssueKey(parts){return parts.map(x=>String(x||'').trim().replaceAll('|','/')).join('|').slice(0,900)}
function platformRevenueLog(x){const t=String(x&&x.billing_type||'');return t==='booking_monthly'||t.startsWith('activity_publish:')||t.startsWith('activity_rate:')||t.startsWith('activity_unit:')||t.startsWith('setup_feature:')||t.startsWith('exposure:')}
async function hGetPlatformOperationsCenter(env,p){
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  const monthAgo=new Date(Date.now()-30*86400000).toISOString();
  const [tenants,sessions,regs,errors,logs,applications,stored]=await Promise.all([
    dbGet(env,'tenants','select=id,name,status,is_locked,locked_reason,created_at').catch(()=>[]),
    dbGet(env,'sessions','select=id,tenant_id,name,status,venue,dates_json,payment_profile_id,created_at,updated_at').catch(()=>[]),
    dbGet(env,'registrations','select=id,tenant_id,session_id,operation_unit_id,name,brand_name,email,review_status,registration_status,payment_status,amount,total_amount,paid_amount,deposit,payment_method,payment_last5,payment_reported_at,transfer_status,refund_amount,created_at,updated_at').catch(()=>[]),
    dbGet(env,'error_logs',`created_at=gte.${encodeURIComponent(monthAgo)}&select=id,tenant_id,level,source,action,reg_id,session_id,message,created_at&order=created_at.desc&limit=500`).catch(()=>[]),
    dbGet(env,'billing_logs','select=id,tenant_id,billing_type,amount,total,status,session_id,created_at&order=created_at.desc&limit=3000').catch(()=>[]),
    dbGet(env,'tenant_apply_logs','status=in.(pending,supplement_required)&select=id,status,created_at').catch(()=>[]),
    dbGet(env,'platform_issue_records','select=*&order=last_seen_at.desc&limit=1000').catch(()=>[])
  ]);
  const now=nowIso(),tenantMap=Object.fromEntries(tenants.map(x=>[String(x.id),x])),sessionMap=Object.fromEntries(sessions.map(x=>[String(x.id),x])),existing=Object.fromEntries(stored.map(x=>[String(x.source_key),x])),detected=[];
  const pushIssue=x=>{const key=platformIssueKey(x.key);if(!key)return;detected.push({source_key:key,issue_type:x.type,severity:x.severity||'warning',title:x.title,detail:x.detail||'',tenant_id:String(x.tenantId||''),session_id:String(x.sessionId||''),registration_id:String(x.registrationId||''),source_table:x.sourceTable||'',source_id:String(x.sourceId||''),last_seen_at:now,metadata_json:x.meta||{}})};
  for(const t of tenants)if(t.is_locked===true)pushIssue({key:['tenant_locked',t.id],type:'tenant',severity:'critical',title:'租戶目前遭鎖定',detail:t.locked_reason||'請確認欠費或帳號狀態',tenantId:t.id,sourceTable:'tenants',sourceId:t.id});
  for(const s of sessions){
    if(['停用','關閉','已關閉','封存','archived'].includes(String(s.status||'')))continue;
    const dates=safeJson(s.dates_json,[]);
    if(!Array.isArray(dates)||!dates.length)pushIssue({key:['session_dates',s.id],type:'session_config',title:'場次缺少日期',detail:s.name||'未命名場次',tenantId:s.tenant_id,sessionId:s.id,sourceTable:'sessions',sourceId:s.id});
    if(!String(s.venue||'').trim())pushIssue({key:['session_venue',s.id],type:'session_config',title:'場次缺少地點',detail:s.name||'未命名場次',tenantId:s.tenant_id,sessionId:s.id,sourceTable:'sessions',sourceId:s.id});
  }
  for(const r of regs)for(const issue of _financeIssuesForReg(r))pushIssue({key:['finance',r.id,issue],type:'finance',severity:issue.includes('已取消')||issue.includes('已付款')?'critical':'warning',title:issue,detail:[r.brand_name||r.name||r.email,sessionMap[String(r.session_id||'')]?.name].filter(Boolean).join('｜'),tenantId:r.tenant_id,sessionId:r.session_id,registrationId:r.id,sourceTable:'registrations',sourceId:r.id});
  const errorGroups={};for(const e of errors){const key=platformIssueKey(['system',e.tenant_id,e.source,e.action,e.session_id,e.reg_id]),g=errorGroups[key]||(errorGroups[key]={...e,count:0});g.count++;if(new Date(e.created_at||0)>new Date(g.created_at||0))Object.assign(g,e)}
  for(const [key,e] of Object.entries(errorGroups))pushIssue({key:[key],type:'system_error',severity:String(e.level)==='error'?'critical':'warning',title:'系統異常：'+(e.source||e.action||'未分類'),detail:(e.message||'系統已留下錯誤紀錄')+(e.count>1?`｜近 30 日 ${e.count} 次`:''),tenantId:e.tenant_id,sessionId:e.session_id,registrationId:e.reg_id,sourceTable:'error_logs',sourceId:e.id,meta:{count:e.count,action:e.action||''}});
  const detectedKeys=new Set(detected.map(x=>x.source_key)),upserts=detected.map(x=>{const old=existing[x.source_key];return {...x,first_seen_at:old?.first_seen_at||now,status:old?.status==='resolved'?'open':(old?.status||'open'),resolved_at:old?.status==='resolved'?null:(old?.resolved_at||null),resolved_by:old?.status==='resolved'?'':(old?.resolved_by||''),resolution_note:old?.status==='resolved'?'':(old?.resolution_note||''),updated_at:now}});
  if(upserts.length)await dbUpsert(env,'platform_issue_records',upserts,'source_key').catch(e=>logError(env,{source:'platformIssueSync',message:'問題紀錄同步失敗',error:e}));
  for(const old of stored)if(old.status!=='resolved'&&old.issue_type!=='system_error'&&!detectedKeys.has(String(old.source_key||'')))await dbUpdate(env,'platform_issue_records',`id=eq.${encodeURIComponent(old.id)}`,{status:'resolved',resolved_at:now,resolved_by:'system:auto',resolution_note:'來源資料已恢復正常',updated_at:now}).catch(()=>{});
  const issueRows=await dbGet(env,'platform_issue_records','status=neq.resolved&select=*&order=severity.asc,last_seen_at.desc&limit=500').catch(()=>upserts),issueByTenant={};for(const x of issueRows){const id=String(x.tenant_id||'');if(id)issueByTenant[id]=(issueByTenant[id]||0)+1}
  const revenueLogs=logs.filter(x=>x.status==='confirmed'&&platformRevenueLog(x)),allRevenue=revenueLogs.reduce((n,x)=>n+Math.max(0,safeNum(x.total||x.amount)),0),monthRevenue=revenueLogs.filter(x=>new Date(x.created_at||0)>=new Date(monthAgo)).reduce((n,x)=>n+Math.max(0,safeNum(x.total||x.amount)),0),tenantRevenue={};for(const x of revenueLogs){const id=String(x.tenant_id||'');tenantRevenue[id]=(tenantRevenue[id]||0)+Math.max(0,safeNum(x.total||x.amount))}
  const activeIds=new Set();for(const s of sessions)if(new Date(s.updated_at||s.created_at||0)>=new Date(monthAgo))activeIds.add(String(s.tenant_id||''));for(const r of regs)if(new Date(r.updated_at||r.created_at||0)>=new Date(monthAgo))activeIds.add(String(r.tenant_id||''));
  const fallbackSummary={monthRevenue,allRevenue,openIssueCount:issueRows.length,criticalIssueCount:issueRows.filter(x=>x.severity==='critical').length,affectedTenantCount:new Set(issueRows.map(x=>x.tenant_id).filter(Boolean)).size,pendingApplicationCount:applications.length,tenantCount:tenants.length,activeTenant30d:activeIds.size};
  const fallbackHealth=tenants.map(t=>({tenantId:t.id,tenantName:t.name||'租戶名稱待設定',status:t.status||'',locked:t.is_locked===true,issueCount:issueByTenant[String(t.id)]||0,sessionCount:sessions.filter(s=>String(s.tenant_id)===String(t.id)).length,registrationCount:regs.filter(r=>String(r.tenant_id)===String(t.id)).length,revenue:tenantRevenue[String(t.id)]||0,active30d:activeIds.has(String(t.id))})).sort((a,b)=>b.issueCount-a.issueCount||b.revenue-a.revenue);
  const exact=await dbRpc(env,'doing_platform_operations_summary',{}).catch(()=>null),summary=exact?.summary||fallbackSummary,tenantHealth=Array.isArray(exact?.tenantHealth)?exact.tenantHealth:fallbackHealth;
  return jsonOk({summary,issues:issueRows.map(x=>({...x,tenantName:tenantMap[String(x.tenant_id||'')]?.name||'租戶名稱待設定',sessionName:sessionMap[String(x.session_id||'')]?.name||''})),tenantHealth});
}
async function hUpdatePlatformIssueStatus(env,b){
  const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  const id=String(b.issueId||b.id||'').trim(),status=String(b.status||'').trim(),note=String(b.note||'').trim().slice(0,1000);if(!id||!['open','acknowledged','resolved'].includes(status))return jsonErr('問題狀態不正確');
  const rows=await dbGet(env,'platform_issue_records',`id=eq.${encodeURIComponent(id)}&select=*`).catch(()=>[]),old=rows[0];if(!old)return jsonErr('找不到問題紀錄');
  const now=nowIso(),next={status,resolution_note:note,updated_at:now,resolved_at:status==='resolved'?now:null,resolved_by:status==='resolved'?(pay.email||''):''};await dbUpdate(env,'platform_issue_records',`id=eq.${encodeURIComponent(id)}`,next);
  await writeAuditLog(env,old.tenant_id||'',pay.email||'','platform_super_admin','update_platform_issue_status','platform_issue_records',id,{status:old.status},{status,note}).catch(()=>{});return jsonOk({ok:true,id,status});
}
async function hGetPlatformDashboard(env,p){
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  const [tenants,sessions,units,regs,logs,members]=await Promise.all([
    dbGet(env,'tenants','select=id,status,is_locked,created_at').catch(()=>[]),
    dbGet(env,'sessions','select=id,tenant_id,status,created_at').catch(()=>[]),
    dbGet(env,'operation_units','select=id,tenant_id,status,unit_type,created_at').catch(()=>[]),
    dbGet(env,'registrations','select=id,tenant_id,operation_unit_id,created_at').catch(()=>[]),
    dbGet(env,'billing_logs','status=eq.confirmed&select=billing_type,amount,total,created_at').catch(()=>[]),
    dbGet(env,'platform_members','select=id,completed_at,vendor_json,created_at').catch(()=>[])
  ]);
  const now=Date.now(),monthAgo=now-30*86400000,activeTenantIds=new Set();
  for(const x of sessions)if(new Date(x.created_at||0).getTime()>=monthAgo)activeTenantIds.add(String(x.tenant_id||''));
  for(const x of regs)if(new Date(x.created_at||0).getTime()>=monthAgo)activeTenantIds.add(String(x.tenant_id||''));
  const revenueLogs=logs.filter(x=>{const t=String(x.billing_type||'');return t==='booking_monthly'||t.startsWith('activity_publish:')||t.startsWith('activity_rate:')||t.startsWith('activity_unit:')||t.startsWith('setup_feature:')||t.startsWith('exposure:')});
  const revenue=revenueLogs.reduce((n,x)=>n+Math.max(0,safeNum(x.total||x.amount)),0);
  const startupGranted=logs.filter(x=>String(x.billing_type)==='startup_credit_grant').reduce((n,x)=>n+Math.max(0,safeNum(x.amount)),0);
  return jsonOk({tenantCount:tenants.length,memberCount:members.length,completedMemberCount:members.filter(x=>!!x.completed_at).length,vendorMemberCount:members.filter(x=>!!safeJson(x.vendor_json,{}).brandName).length,activeTenant30d:activeTenantIds.size,lockedTenantCount:tenants.filter(x=>x.is_locked===true).length,sessionCount:sessions.length,operationUnitCount:units.length,registrationCount:regs.length,platformRevenue:revenue,startupCreditGranted:startupGranted,bookingUnitCount:units.filter(x=>String(x.unit_type)==='booking').length,openUnitCount:units.filter(x=>['open','active','published'].includes(String(x.status||''))).length});
}

async function hGetPlatformMetricDetails(env,p){
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  const kind=String(p.kind||'').trim(),allowed=new Set(['activeTenants','sessions','operationUnits','registrations','platformRevenue','startupCredit']);if(!allowed.has(kind))return jsonErr('不支援的統計明細');
  const tenants=await dbGet(env,'tenants','select=id,name,status,is_locked,created_at&limit=1000').catch(()=>[]),tenantMap=Object.fromEntries(tenants.map(x=>[String(x.id),x]));
  const tenantName=id=>String(tenantMap[String(id||'')]?.name||'租戶名稱待設定').trim(),tenantMeta=id=>({tenantId:String(id||''),tenantName:tenantName(id)});
  if(kind==='sessions'){
    const list=await dbGet(env,'sessions','select=id,tenant_id,name,status,created_at&order=created_at.desc&limit=500').catch(()=>[]);
    return jsonOk({kind,title:'活動場次',rows:list.map(x=>({...tenantMeta(x.tenant_id),id:x.id,title:x.name||x.id,meta:[tenantName(x.tenant_id),x.status||'未設定狀態'].join('｜'),createdAt:x.created_at||''}))});
  }
  if(kind==='operationUnits'){
    const list=await dbGet(env,'operation_units','select=id,tenant_id,session_id,name,status,unit_type,created_at&order=created_at.desc&limit=500').catch(()=>[]);
    return jsonOk({kind,title:'營運項目',rows:list.map(x=>({...tenantMeta(x.tenant_id),id:x.id,title:x.name||x.id,meta:[tenantName(x.tenant_id),x.unit_type||'活動',x.status||'未設定狀態'].join('｜'),createdAt:x.created_at||''}))});
  }
  if(kind==='registrations'){
    const list=await dbGet(env,'registrations','select=id,tenant_id,session_id,operation_unit_id,payment_status,review_status,created_at&order=created_at.desc&limit=500').catch(()=>[]),sessionIds=[...new Set(list.map(x=>String(x.session_id||'')).filter(Boolean))],sessionRows=sessionIds.length?await dbGet(env,'sessions',`id=in.(${sessionIds.map(x=>'"'+x.replaceAll('"','')+'"').join(',')})&select=id,name`).catch(()=>[]):[],sessionMap=Object.fromEntries(sessionRows.map(x=>[String(x.id),x.name||x.id]));
    return jsonOk({kind,title:'全平台報名／預約',rows:list.map(x=>({...tenantMeta(x.tenant_id),id:x.id,title:sessionMap[String(x.session_id||'')]||x.operation_unit_id||'報名／預約',meta:[tenantName(x.tenant_id),x.review_status||'未審核',x.payment_status||'未付款'].join('｜'),createdAt:x.created_at||''}))});
  }
  if(kind==='activeTenants'){
    const monthAgo=new Date(Date.now()-30*86400000).toISOString(),[sessions,regs]=await Promise.all([dbGet(env,'sessions',`created_at=gte.${encodeURIComponent(monthAgo)}&select=tenant_id,created_at`).catch(()=>[]),dbGet(env,'registrations',`created_at=gte.${encodeURIComponent(monthAgo)}&select=tenant_id,created_at`).catch(()=>[])]),last={};for(const x of [...sessions,...regs]){const id=String(x.tenant_id||'');if(id&&(!last[id]||new Date(x.created_at)>new Date(last[id])))last[id]=x.created_at}
    return jsonOk({kind,title:'近 30 日活躍主辦',rows:Object.entries(last).sort((a,b)=>new Date(b[1])-new Date(a[1])).map(([id,at])=>({...tenantMeta(id),id,title:tenantName(id),meta:tenantMap[id]?.status||'未設定狀態',createdAt:at}))});
  }
  const logs=await dbGet(env,'billing_logs','status=eq.confirmed&select=id,tenant_id,billing_type,amount,total,note,created_at&order=created_at.desc&limit=1000').catch(()=>[]),isRevenue=x=>{const t=String(x.billing_type||'');return t==='booking_monthly'||t.startsWith('activity_publish:')||t.startsWith('activity_rate:')||t.startsWith('activity_unit:')||t.startsWith('setup_feature:')||t.startsWith('exposure:')},list=kind==='startupCredit'?logs.filter(x=>String(x.billing_type)==='startup_credit_grant'):logs.filter(isRevenue);
  return jsonOk({kind,title:kind==='startupCredit'?'已發創業金':'平台收入',rows:list.map(x=>({...tenantMeta(x.tenant_id),id:x.id,title:tenantName(x.tenant_id),meta:String(x.note||x.billing_type||''),amount:Math.max(0,safeNum(x.total||x.amount)),createdAt:x.created_at||''}))});
}

async function hGetPlatformMembersAdmin(env,p){
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  const members=await dbGet(env,'platform_members','select=id,email,name,phone,display_name,vendor_json,completed_at,created_at,updated_at&order=updated_at.desc&limit=500').catch(()=>[]);
  const identities=await dbGet(env,'platform_member_identities','select=member_id,provider,last_login_at').catch(()=>[]);
  const idMap={};for(const x of identities){if(!idMap[x.member_id])idMap[x.member_id]=[];idMap[x.member_id].push({provider:x.provider,lastLoginAt:x.last_login_at})}
  return jsonOk({members:members.map(x=>{const v=safeJson(x.vendor_json,{});const roles=['participant'];if(v.brandName)roles.push('vendor');return {id:x.id,email:x.email||'',name:x.name||x.display_name||'',phone:x.phone||'',brand:v.brandName||'',category:v.category||'',roles,providers:idMap[x.id]||[],complete:!!x.completed_at,createdAt:x.created_at||'',updatedAt:x.updated_at||''}})});
}

async function requirePlatformOwner(env,token){
  const pay=await verifyAdminJwt(String(token||''),env).catch(()=>null);
  if(!pay||pay.normalized_role!=='platform_super_admin'||!pay.staff_id)return null;
  const rows=await dbGet(env,'platform_staff',`id=eq.${encodeURIComponent(pay.staff_id)}&is_active=eq.true&normalized_role=eq.platform_super_admin&select=id,email,platform_member_id&limit=1`).catch(()=>[]);
  return rows[0]?{pay,row:rows[0]}:null;
}

async function hGetPlatformAccessAssignments(env,p){
  const owner=await requirePlatformOwner(env,p.token);
  if(!owner)return jsonErr('只有平台管理者可以設定人員權限',403);
  const [platformRows,staffRows,tenants,sessions]=await Promise.all([
    dbGet(env,'platform_staff','select=id,email,name,display_name,role,normalized_role,is_active,platform_member_id,last_login_at,created_at&order=created_at.asc').catch(()=>[]),
    dbGet(env,'staff','normalized_role=in.(organizer_owner,organizer_admin,session_admin,finance_admin,onsite_staff)&select=id,tenant_id,email,name,display_name,role,normalized_role,is_active,active,platform_member_id,limit_sessions,scope_type,scope_event_id,last_login_at,created_at&order=created_at.asc').catch(()=>[]),
    dbGet(env,'tenants','select=id,name,status,is_locked&order=created_at.asc').catch(()=>[]),
    dbGet(env,'sessions','select=id,tenant_id,name,status,dates_json&order=created_at.desc').catch(()=>[])
  ]);
  const tenantNames=Object.fromEntries(tenants.map(x=>[String(x.id),x.name||x.id]));
  const providerRows=await dbGet(env,'platform_member_identities','select=member_id,provider').catch(()=>[]),providerMap={};
  for(const x of providerRows){if(!providerMap[x.member_id])providerMap[x.member_id]=[];if(!providerMap[x.member_id].includes(x.provider))providerMap[x.member_id].push(x.provider)}
  const mapRow=(x,type)=>({id:x.id,type,email:x.email||'',name:x.name||x.display_name||x.email||'',role:x.normalized_role||x.role||'',active:(x.is_active!==undefined?x.is_active:x.active)!==false,memberId:x.platform_member_id||'',providers:providerMap[x.platform_member_id]||[],tenantId:x.tenant_id||'',tenantName:tenantNames[String(x.tenant_id)]||'',sessionIds:String(x.limit_sessions||'').split(',').map(v=>v.trim()).filter(Boolean),scopeType:x.scope_type||'all',scopeEventId:x.scope_event_id||'',lastLoginAt:x.last_login_at||'',invitationStatus:x.platform_member_id?'accepted':'pending'});
  return jsonOk({ownerStaffId:owner.row.id,platform:platformRows.map(x=>mapRow(x,'platform')),tenant:staffRows.map(x=>mapRow(x,'tenant')),tenants,sessions});
}

async function hCreatePlatformAccessInvite(env,b){
  const owner=await requirePlatformOwner(env,b.token);
  if(!owner)return jsonErr('只有平台管理者可以新增管理人員',403);
  const accessType=String(b.accessType||b.access_type||'').trim(),email=normEmail(b.targetEmail||b.email),name=String(b.targetName||b.name||'').trim();
  if(!['platform','system','onsite'].includes(accessType))return jsonErr('請選擇管理角色');
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return jsonErr('請輸入正確的 Email');
  let assignmentId='',tenantId='',role='',perms={},limitSessions=[];
  if(accessType==='platform'){
    role='platform_super_admin';
    const existing=await dbGet(env,'platform_staff',`email=eq.${encodeURIComponent(email)}&select=*`).catch(()=>[]),row=existing[0];
    assignmentId=row?.id||genId('PST');
    const data={email,name,display_name:name,role,normalized_role:role,is_active:true,updated_at:nowIso(),note:'由平台人員與權限設定頁邀請'};
    if(row){if(row.platform_member_id)return jsonErr('這個 Email 已是平台管理者');await dbUpdate(env,'platform_staff',`id=eq.${encodeURIComponent(assignmentId)}`,data)}
    else await dbInsert(env,'platform_staff',{id:assignmentId,...data});
  }else{
    tenantId=String(b.tenantId||b.tenant_id||'').trim().toLowerCase();
    if(!tenantId)return jsonErr('請選擇管理的營運帳號');
    const tenantRows=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(tenantId)}&select=id,name&limit=1`).catch(()=>[]);
    if(!tenantRows[0])return jsonErr('找不到這個營運帳號');
    role=accessType==='system'?'organizer_admin':'onsite_staff';perms=accessType==='system'?{events:true,sessions:true,review:true,finance:true,checkin:true,announce:true,members:true,settings:true}:{checkin:true};
    limitSessions=accessType==='onsite'?[...new Set((b.sessionIds||b.limitSessions||[]).map(x=>String(x||'').trim()).filter(Boolean))]:[];
    if(accessType==='onsite'&&!limitSessions.length)return jsonErr('現場管理至少要選擇一個場次');
    if(limitSessions.length){const valid=await dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(tenantId)}&id=in.(${limitSessions.map(x=>encodeURIComponent(x)).join(',')})&select=id`).catch(()=>[]);if(valid.length!==limitSessions.length)return jsonErr('選擇的場次不屬於這個營運帳號')}
    const existing=await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(tenantId)}&email=eq.${encodeURIComponent(email)}&select=*`).catch(()=>[]),row=existing[0];
    assignmentId=row?.id||crypto.randomUUID();
    if(row?.platform_member_id)return jsonErr('此人已是這個營運帳號的管理者，請直接調整既有權限');
    const data={email,tenant_id:tenantId,name,display_name:name,role,normalized_role:role,role_id:null,perms_json:JSON.stringify(perms),limit_sessions:limitSessions.join(','),scope_type:accessType==='system'?'all':'session',scope_event_id:'',active:true,is_active:true,updated_at:nowIso()};
    if(row)await dbUpdate(env,'staff',`id=eq.${encodeURIComponent(assignmentId)}`,data);else await dbInsert(env,'staff',{id:assignmentId,...data});
    await syncStaffSessionPermissions(env,tenantId,email,limitSessions);
  }
  const invite=await prepareStaffInvite(env,{assignmentType:accessType==='platform'?'platform':'tenant',assignmentId,tenantId,email,role});
  const tc=accessType==='platform'?{id:'',name:'DOING 平台',siteUrl:doingSiteUrl(env)}:await getTenantCtx(env,tenantId);
  const mail=await mailStaffInvite(env,email,name,role,perms,limitSessions,tc,invite.url).catch(()=>null);
  return jsonOk({success:true,assignmentId,invitationStatus:'pending',emailSent:!!(mail&&mail.ok&&!mail.skipped)});
}

async function hSetPlatformAccessActive(env,b){
  const owner=await requirePlatformOwner(env,b.token);
  if(!owner)return jsonErr('只有平台管理者可以停用或啟用管理人員',403);
  const assignmentType=String(b.assignmentType||b.assignment_type||''),id=String(b.assignmentId||b.assignment_id||''),active=b.active===true||b.active==='true'||b.active===1||b.active==='1';
  if(!id||!['platform','tenant'].includes(assignmentType))return jsonErr('缺少管理人員資料');
  if(assignmentType==='platform'){
    if(!active&&id===owner.row.id)return jsonErr('不能停用目前登入中的平台管理者');
    if(!active){const rows=await dbGet(env,'platform_staff','is_active=eq.true&normalized_role=eq.platform_super_admin&select=id').catch(()=>[]);if(rows.length<=1)return jsonErr('至少要保留一位可登入的平台管理者')}
    await dbUpdate(env,'platform_staff',`id=eq.${encodeURIComponent(id)}`,{is_active:active,updated_at:nowIso()});
  }else await dbUpdate(env,'staff',`id=eq.${encodeURIComponent(id)}`,{is_active:active,active,updated_at:nowIso()});
  return jsonOk({success:true,active});
}

async function hGetTenantsAdmin(env, p) {
  const payload = await verifyAdminJwt(p.token, env);
  if (!payload || payload.normalized_role !== 'platform_super_admin') return jsonErr('無權限', 401);
  const rows = await dbGet(env, 'tenants',
    'order=created_at.desc&select=id,name,slug,plan_type,is_locked,locked_reason,trial_start_at,trial_end_at,session_count_used,contact_name,contact_phone,notify_email,created_at'
  );
  for (const tenant of rows) {
    const owners = await dbGet(env,'staff',
      `tenant_id=eq.${encodeURIComponent(tenant.id)}&normalized_role=eq.organizer_owner&select=email,name,is_active,active&limit=1`
    ).catch(()=>[]);
    const owner = owners[0] || null;
    tenant.owner_email = owner ? owner.email : '';
    tenant.owner_name = owner ? (owner.name||'') : '';
    tenant.owner_active = owner ? (owner.is_active !== false && owner.active !== false) : false;
  }
  return jsonOk(rows);
}


async function hPlatformUpsertTenantOwner(env,b){
  const payload=await verifyAdminJwt(b.token,env);
  if(!payload || payload.normalized_role!=='platform_super_admin')return jsonErr('無權限',401);

  const tenantId=String(b.target_tenant_id||b.tenant_id||'').trim().toLowerCase();
  const ownerEmail=normEmail(b.owner_email||b.target_email||'');
  const ownerName=String(b.owner_name||b.target_name||'').trim();
  const active=b.active!==false && b.active!=='false' && b.active!==0 && b.active!=='0';

  if(!tenantId)return jsonErr('請選擇租戶');
  if(!ownerEmail)return jsonErr('請輸入擁有者 Email');

  const tenants=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(tenantId)}&select=id,name,is_locked`);
  if(!tenants.length)return jsonErr('找不到租戶');

  const existing=await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(tenantId)}&email=eq.${encodeURIComponent(ownerEmail)}&select=*`);
  const before=existing[0]||null;
  const data={
    email:ownerEmail,
    tenant_id:tenantId,
    name:ownerName,
    display_name:ownerName,
    role:'organizer_owner',
    normalized_role:'organizer_owner',
    role_id:null,
    perms_json:JSON.stringify({events:true,sessions:true,review:true,finance:true,checkin:true,announce:true,members:true,settings:true}),
    limit_sessions:'',
    scope_type:'all',
    scope_event_id:'',
    active,
    is_active:active,
    updated_at:nowIso()
  };

  if(existing.length){
    await dbUpdate(env,'staff',
      `tenant_id=eq.${encodeURIComponent(tenantId)}&email=eq.${encodeURIComponent(ownerEmail)}`,
      data
    );
  }else{
    await dbInsert(env,'staff',{id:crypto.randomUUID(),...data,created_at:nowIso()});
  }

  await syncStaffSessionPermissions(env,tenantId,ownerEmail,[]);
  await writeAuditLog(
    env,tenantId,payload.email||'',payload.normalized_role||'platform_super_admin',
    existing.length?'platform_update_tenant_owner':'platform_create_tenant_owner',
    'staff',ownerEmail,before,data,{source:'platform.html'}
  ).catch(()=>{});

  const tc=await getTenantCtx(env,tenantId).catch(()=>null);
  try{
    await mailStaffInvite(env,ownerEmail,ownerName,'organizer_owner',safeJson(data.perms_json,{}),[],tc);
  }catch{}

  const base=String(env.DOING_SITE_URL||env.FRONTEND_SITE_URL||'https://ndiangrace-create.github.io/DOING/').replace(/\/+$/,'/');
  return jsonOk({
    ok:true,
    tenant_id:tenantId,
    tenant_name:tenants[0].name||tenantId,
    owner_email:ownerEmail,
    owner_name:ownerName,
    role:'organizer_owner',
    active,
    admin_url:base+'admin.html?tenant='+encodeURIComponent(tenantId)
  });
}

async function hPlatformTenantSessions(env,p){
  const payload=await verifyAdminJwt(p.token,env);if(!payload||payload.normalized_role!=='platform_super_admin')return jsonErr('無權限',401);const T=String(p.target_tenant_id||'').trim().toLowerCase();if(!T)return jsonErr('請選擇主辦');const rows=await dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(T)}&select=id,name,status,modules_json&order=created_at.desc`).catch(()=>[]);return jsonOk(rows.map(s=>({id:s.id,name:s.name||s.id,status:s.status||'',operatingMode:normalizeSessionModules(safeJson(s.modules_json,{})).operatingMode,entitled:false})));
}

async function hPlatformTenantOperationUnits(env,p){
  const payload=await verifyAdminJwt(p.token,env);if(!payload||payload.normalized_role!=='platform_super_admin')return jsonErr('無權限',401);const T=String(p.target_tenant_id||'').trim().toLowerCase();if(!T)return jsonErr('請選擇主辦');const rows=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&select=id,session_id,name,status,modules_json&order=created_at.desc`).catch(()=>[]);return jsonOk(rows.map(u=>({id:u.id,sessionId:u.session_id,name:u.name||u.id,status:u.status||'',operatingMode:normalizeSessionModules(safeJson(u.modules_json,{})).operatingMode||'activity'})));
}

async function hPlatformTenantOwnerStatus(env,p){
  const payload=await verifyAdminJwt(p.token,env);
  if(!payload || payload.normalized_role!=='platform_super_admin')return jsonErr('無權限',401);
  const tenantId=String(p.target_tenant_id||p.tenant_id||'').trim().toLowerCase();
  const ownerEmail=normEmail(p.owner_email||p.target_email||'');
  if(!tenantId||!ownerEmail)return jsonErr('缺少租戶或 Email');
  const rows=await dbGet(env,'staff',
    `tenant_id=eq.${encodeURIComponent(tenantId)}&email=eq.${encodeURIComponent(ownerEmail)}&select=email,name,role,normalized_role,is_active,active`
  ).catch(()=>[]);
  if(!rows.length)return jsonOk({exists:false,tenant_id:tenantId,owner_email:ownerEmail});
  const s=rows[0];
  return jsonOk({
    exists:true,
    tenant_id:tenantId,
    owner_email:s.email,
    owner_name:s.name||'',
    role:s.normalized_role||s.role||'',
    active:s.is_active!==false && s.active!==false
  });
}

async function hPlatformEnterTenant(env, b) {
  const payload = await verifyAdminJwt(b.token, env);
  if (!payload || payload.normalized_role !== 'platform_super_admin') return jsonErr('無權限', 401);
  const target = String(b.target_workspace_id || b.tenant_id || b.tenant || '').trim().toLowerCase();
  if (!target) return jsonErr('請選擇主辦空間');
  const rows = await dbGet(env,'tenants',`id=eq.${encodeURIComponent(target)}&select=id,name,status,is_locked`);
  const tenant = rows[0];
  if (!tenant) return jsonErr('找不到主辦空間');
  const adminToken = await issueAdminToken({
    id: payload.staff_id || payload.sub || payload.email,
    email: payload.email,
    name: payload.display_name || payload.email,
    role: 'platform_super_admin',
    normalized_role: 'platform_super_admin',
    limit_sessions: ''
  }, target, env);
  return jsonOk({ok:true, tenant_id:target, tenant_name:tenant.name||target, admin_token:adminToken, admin_url:adminSiteUrl(env)});
}

async function hApplyList(env, p) {
  const payload = await verifyAdminJwt(p.token, env);
  if (!payload || payload.normalized_role !== 'platform_super_admin') return jsonErr('無權限', 401);
  const rows = await dbGet(env, 'tenant_apply_logs', `order=created_at.desc&limit=50&select=*`);
  return jsonOk(rows.filter(row=>!isQaApplication(row)));
}
async function hRequestApplySupplement(env,b){
  const pay=await verifyAdminJwt(b.token,env);
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限',401);
  const applyId=String(b.apply_id||'').trim(),reason=String(b.reason||'').trim();
  if(!applyId)return jsonErr('缺少申請資料');
  if(!reason)return jsonErr('請填寫補件說明');
  const rows=await dbGet(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}&select=*`).catch(()=>[]);
  const apply=rows[0];if(!apply)return jsonErr('找不到申請資料');
  const requestedAt=nowIso(),app=safeJson(apply.application_json,{});
  await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}`,
    {status:'supplement_required',supplement_requested_at:requestedAt,supplement_requested_by:pay.email,supplement_reason:reason,rejected_at:null,rejected_by:null,rejection_reason:null,application_json:{...app,supplementRequestedAt:requestedAt,timeline:[...(Array.isArray(app.timeline)?app.timeline:[]),{key:'supplement_requested',label:'平台要求補件',at:requestedAt}]}}
  );
  try{
    const page=doingPageUrl(env,'about.html');
    await sendEmail(env,apply.contact_email,'【DOING】營運帳號申請需要補件',emailWrap(`<p>${apply.contact_name||''} 您好：</p><p>你的 DOING 營運帳號申請需要補充資料後再繼續審核。</p><p><b>補件說明：</b><br>${reason}</p><p>請回到申請頁重新填寫並使用原 Google 帳號完成送出：</p><p><a href="${page}#apply">前往 DOING 營運帳號申請</a></p>`));
  }catch(e){}
  return jsonOk({ok:true});
}


// ── 鎖定 / 停用機制 API ──────────────────────────────────────────

// POST /lockTenant — 鎖定租戶（平台管理員用）
async function hLockTenant(env, b) {
  const payload = await verifyAdminJwt(b.token, env);
  if (!payload || payload.normalized_role !== 'platform_super_admin') return jsonErr('無權限', 401);
  await dbUpdate(env, 'tenants', `id=eq.${b.tenant_id}`, {
    is_locked: true,
    locked_at: new Date().toISOString(),
    locked_reason: b.reason || '帳號鎖定',
    updated_at: new Date().toISOString(),
  });
  return jsonOk({ ok: true });
}

// POST /unlockTenant — 解鎖租戶（收到付款後）
async function hUnlockTenant(env, b) { return jsonErr('舊試用解鎖流程已停用；正式營運權請使用計費／額度流程'); }

// ── 場次下載 Excel ────────────────────────────────────────────────

// GET /downloadSession — 下載單場次完整 Excel
async function hDownloadSession(env,p){
  const TENANT=p._tenantId;
  if(!await verifyStaff(env,p.email,p.token,TENANT))return jsonErr('無權限');
  const lockCheck=await checkTenantLocked(env,TENANT);
  if(lockCheck.locked)return jsonErr('帳號已鎖定，無法下載資料，請先續費');
  const sesId=String(p.sessionId||'').trim();
  if(!sesId)return jsonErr('請指定場次');

  const sessions=await dbGet(env,'sessions',`id=eq.${encodeURIComponent(sesId)}&tenant_id=eq.${TENANT}&select=*`);
  const session=sessions[0];if(!session)return jsonErr('找不到場次');
  const regs=await dbGet(env,'registrations',`session_id=eq.${encodeURIComponent(sesId)}&tenant_id=eq.${TENANT}&select=*&order=created_at.asc`);
  const itemMap=await _getRegistrationItemsForRegs(env,regs);
  const cashbook=await _getSessionCashbook(env,TENANT,sesId);
  const payments=await dbGet(env,'payments',`tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sesId)}&select=*&order=created_at.asc`).catch(()=>[]);
  const allocations=await dbGet(env,'payment_allocations',`tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sesId)}&select=*&order=created_at.asc`).catch(()=>[]);
  const eventRows=session.event_id?await dbGet(env,'events',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(session.event_id)}&select=*`).catch(()=>[]):[];
  const event=eventRows[0]||{};

  const activeRegs=regs.filter(_isActiveFinanceReg);
  const receivableRegs=activeRegs.filter(_isReceivableReg);
  const receivedRegs=activeRegs.filter(_isConfirmedPaidReg);
  const totalReceivable=_sumCash(receivableRegs,session,itemMap);
  const totalReceived=_sumCash(receivedRegs,session,itemMap);
  const totalDeposit=_sumDeposit(receivedRegs,session,itemMap);
  const refundTotal=regs.reduce((sum,r)=>sum+_officialRefund(r),0);

  const summary=[
    ['欄位','內容'],
    ['系列',event.title||''],
    ['場次',session.name||''],
    ['日期',_sessionDateRows(safeJson(session.dates_json,[])).map(x=>x.date).filter(Boolean).join('、')],
    ['地點',session.venue||''],
    ['狀態',session.status||''],
    ['報名筆數',regs.length],
    ['有效報名筆數',activeRegs.length],
    ['應收總額',totalReceivable],
    ['已收總額',totalReceived],
    ['未收總額',Math.max(0,totalReceivable-totalReceived)],
    ['已收押金',totalDeposit],
    ['已退款',refundTotal],
    ['場次收入',cashbook.totals.income],
    ['場次支出',cashbook.totals.expense],
    ['場次結餘',cashbook.totals.balance],
  ];

  const regHeaders=[
    '報名編號','系列','場次','品牌名稱','品牌介紹','聯絡人','Email','電話',
    '販售分類','販售內容','品牌連結','Facebook','Instagram','照片連結',
    '報名日期','攤位數','設備','加購內容','位置','選位意願','選位狀態',
    '應收金額','實收金額','押金','審核狀態','繳費狀態','付款方式','付款末碼',
    '退款金額','退款狀態','發票類型','統一編號','發票抬頭','發票 Email','發票狀態',
    '報到狀態','清場狀態','押金退還狀態','自訂欄位','參加者資料','申請時間'
  ];
  const regRows=regs.map(r=>{
    const money=_regFinanceAmounts(r,session,itemMap[r.id]);
    return [
      r.registration_no||r.id,event.title||'',session.name||'',
      r.brand_name||'',r.brand_intro||'',r.name||'',r.email||'',r.phone||'',
      r.sell_category||'',r.sell_items||'',r.sell_link||'',r.fb_url||'',r.ig_url||'',r.photo_url||'',
      safeJson(r.selected_dates_json,[]).join('、'),safeNum(r.stall_count)||1,
      _equipmentTextFromMap(_effectiveEquipmentMapForReg(r,session)),
      JSON.stringify(safeJson(r.addon_qty_json,{})),r.stall_number||'',
      r.seat_choice_intent||'',r.seat_choice_status||'',
      money.cashTotal,safeNum(r.paid_amount),money.depositTotal,
      _reviewStatus(r)||'',_payStatus(r)||'',r.payment_method||'',r.payment_last5||'',
      safeNum(r.refund_amount),r.transfer_status||'',
      r.invoice_type||'',r.tax_id||'',r.invoice_title||'',r.invoice_email||'',r.invoice_status||'',
      _checkinStatus(r)||'',_clearStatus(r)||'',_depositStatus(r)||'',
      JSON.stringify(safeJson(r.custom_fields_json,{})),JSON.stringify(safeJson(r.participants_json,{})),
      r.created_at?new Date(r.created_at).toLocaleString('zh-TW'):''
    ];
  });

  const incomeRows=cashbook.rows.filter(x=>x.kind==='收入').map(x=>[x.date,x.category,x.amount,x.note,x.source,x.referenceType,x.referenceId]);
  const expenseRows=cashbook.rows.filter(x=>x.kind==='支出').map(x=>[x.date,x.category,x.amount,x.note,x.source,x.referenceType,x.referenceId]);
  const payRows=payments.map(x=>[
    x.id,x.registration_id||'',x.email||'',safeNum(x.amount),x.method||'',x.status||'',x.trade_no||'',
    x.paid_at?new Date(x.paid_at).toLocaleString('zh-TW'):'',x.created_at?new Date(x.created_at).toLocaleString('zh-TW'):''
  ]);
  const allocRows=allocations.map(x=>[
    x.id,x.payment_id||'',x.registration_id||'',x.allocation_type||'',safeNum(x.amount),
    x.created_at?new Date(x.created_at).toLocaleString('zh-TW'):''
  ]);
  const equipRows=regs.map(r=>[
    r.registration_no||r.id,r.brand_name||r.name||r.email||'',
    safeNum(r.stall_count)||1,_equipmentTextFromMap(_effectiveEquipmentMapForReg(r,session)),
    r.stall_number||'',r.seat_choice_intent||'',r.seat_choice_status||'',
    _checkinStatus(r)||'',_clearStatus(r)||''
  ]);

  return jsonOk({
    filename:`${String(session.name||sesId).replace(/[\\/:*?"<>|]/g,'_')}_完整報表.xlsx`,
    session:{id:sesId,name:session.name||'',eventName:event.title||'',date:_sessionFirstDate(session),venue:session.venue||''},
    sheets:[
      {name:'場次總覽',rows:summary},
      {name:'完整報名名單',rows:[regHeaders,...regRows]},
      {name:'收入明細',rows:[['日期','分類','金額','備註','來源','關聯類型','關聯編號'],...incomeRows]},
      {name:'支出明細',rows:[['日期','分類','金額','備註','來源','關聯類型','關聯編號'],...expenseRows]},
      {name:'付款紀錄',rows:[['付款編號','報名編號','Email','金額','方式','狀態','末碼／交易號','確認時間','建立時間'],...payRows]},
      {name:'付款分配',rows:[['分配編號','付款編號','報名編號','類型','金額','建立時間'],...allocRows]},
      {name:'設備與位置',rows:[['報名編號','品牌／姓名','攤位數','設備','位置','選位意願','選位狀態','報到','清場'],...equipRows]}
    ]
  });
}


// ── Cron：試用到期提醒 ────────────────────────────────────────────
async function cronTrialExpireReminders(env) {
  // 舊 trial_end_at 到期提醒／自動鎖定正式停用。
  // DOING 現行規則：免費帳號可持續設定與預覽，正式營運權由 billing entitlement 控制。
  return {ok:true, skipped:'legacy_trial_disabled'};
}


// 免輸入主辦識別登入：依 Google email 找出可管理的主辦空間
async function findAdminWorkspacesByEmail(env, email) {
  const rows = await dbGet(env, 'staff', `email=eq.${encodeURIComponent(email)}&select=*`).catch(()=>[]);
  const byTenant = new Map();
  for (const row of rows) {
    const active = row.is_active !== undefined ? row.is_active : row.active;
    const tenantId = String(row.tenant_id || '').trim().toLowerCase();
    if (active === false || !tenantId || byTenant.has(tenantId)) continue;
    byTenant.set(tenantId, row);
  }
  const workspaces = [];
  for (const [tenantId, staff] of byTenant.entries()) {
    const tenantRows = await dbGet(env, 'tenants', `id=eq.${encodeURIComponent(tenantId)}&select=id,name,slug,is_locked,locked_reason,plan_type,trial_end_at`).catch(()=>[]);
    const tenant = tenantRows[0];
    if (!tenant) continue;
    workspaces.push({
      tenant_id: tenantId,
      name: tenant.name || tenant.slug || tenantId,
      role: staff.normalized_role || staff.role || 'organizer_admin',
      is_locked: !!tenant.is_locked,
    });
  }
  workspaces.sort((a,b)=>String(a.name).localeCompare(String(b.name), 'zh-Hant'));
  return workspaces;
}

async function approvedApplicationsByMemberId(env, memberId) {
  const id=String(memberId||'').trim();if(!id)return [];
  const rows=await dbGet(env,'tenant_apply_logs','status=eq.approved&select=*&order=approved_at.desc&limit=500').catch(()=>[]);
  return rows.filter(row=>String(safeJson(row.application_json,{}).memberId||'')===id&&String(row.tenant_id||'').trim());
}

async function findStaffForPlatformMember(env, memberId, tenantId) {
  const id=String(memberId||'').trim(),tenant=String(tenantId||'').trim().toLowerCase();
  if(!id||!tenant)return null;
  const direct=await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(tenant)}&platform_member_id=eq.${encodeURIComponent(id)}&select=*`).catch(()=>[]);
  let staff=direct.find(row=>((row.is_active!==undefined?row.is_active:row.active)!==false));
  if(staff)return staff;
  const applications=await approvedApplicationsByMemberId(env,id);
  const application=applications.find(row=>String(row.tenant_id||'').trim().toLowerCase()===tenant);
  if(!application)return null;
  const email=normEmail(application.contact_email);
  const rows=await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(tenant)}&email=eq.${encodeURIComponent(email)}&select=*`).catch(()=>[]);
  staff=rows.find(row=>((row.is_active!==undefined?row.is_active:row.active)!==false));
  if(staff)await dbUpdate(env,'staff',`id=eq.${encodeURIComponent(staff.id)}`,{platform_member_id:id}).catch(()=>{});
  return staff||null;
}

async function findAdminWorkspacesByMemberId(env, memberId) {
  const id=String(memberId||'').trim();if(!id)return [];
  const tenantIds=new Set();
  const direct=await dbGet(env,'staff',`platform_member_id=eq.${encodeURIComponent(id)}&select=*`).catch(()=>[]);
  for(const row of direct){const active=row.is_active!==undefined?row.is_active:row.active;if(active!==false&&row.tenant_id)tenantIds.add(String(row.tenant_id).trim().toLowerCase())}
  for(const row of await approvedApplicationsByMemberId(env,id))tenantIds.add(String(row.tenant_id).trim().toLowerCase());
  const workspaces=[];
  for(const tenantId of tenantIds){
    const staff=await findStaffForPlatformMember(env,id,tenantId);if(!staff)continue;
    const tenantRows=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(tenantId)}&select=id,name,slug,is_locked,locked_reason,plan_type,trial_end_at`).catch(()=>[]);
    const tenant=tenantRows[0];if(!tenant)continue;
    workspaces.push({tenant_id:tenantId,name:tenant.name||tenant.slug||tenantId,role:staff.normalized_role||staff.role||'organizer_admin',is_locked:!!tenant.is_locked});
  }
  workspaces.sort((a,b)=>String(a.name).localeCompare(String(b.name),'zh-Hant'));
  return workspaces;
}

const DEFAULT_DOING_SITE_URL = 'https://ndiangrace-create.github.io/DOING/';

function doingSiteUrl(env) {
  const raw = String(env.DOING_SITE_URL || DEFAULT_DOING_SITE_URL).trim();
  try {
    const u = new URL(raw);
    if (!u.pathname.endsWith('/')) u.pathname += '/';
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch(e) {
    return DEFAULT_DOING_SITE_URL;
  }
}

function doingPageUrl(env, filename) {
  return new URL(filename, doingSiteUrl(env)).toString();
}

function adminLoginSiteUrl(env) {
  return env.DOING_LOGIN_URL || doingSiteUrl(env);
}

function adminSiteUrl(env) {
  return env.DOING_ADMIN_URL || doingPageUrl(env, 'admin.html');
}

function platformSiteUrl(env) {
  return env.DOING_PLATFORM_URL || doingPageUrl(env, 'platform.html');
}

function googleRedirectUri(env, requestUrl) {
  return env.GOOGLE_REDIRECT_URI || `${requestUrl.origin}/auth/google/callback`;
}

function lineRedirectUri(env, requestUrl) {
  return env.LINE_LOGIN_REDIRECT_URI || `${requestUrl.origin}/auth/line/callback`;
}

async function issueLineOAuthState(env, extra={}) {
  const now=Date.now();
  return signAdminJwt({iss:'DOING',type:'line_oauth_state',mode:String(extra.mode||'').slice(0,40),tenant:String(extra.tenant||'').trim().toLowerCase().slice(0,120),application_id:String(extra.application_id||'').slice(0,120),return_url:String(extra.return_url||'').slice(0,1800),link_member_id:String(extra.link_member_id||'').slice(0,120),nonce:String(extra.nonce||'').slice(0,120),issued_at:now,expires_at:now+10*60*1000},env);
}

async function verifyLineOAuthState(env, token) {
  const payload=await verifyAdminJwt(token||'',env);
  return payload&&payload.iss==='DOING'&&payload.type==='line_oauth_state'?payload:null;
}

function safeDoingReturnUrl(env, raw) {
  const fallback=new URL(doingSiteUrl(env));
  try{const target=new URL(String(raw||''),fallback);return target.origin===fallback.origin?target:fallback}catch(e){return fallback}
}

async function getPlatformMemberByProvider(env, provider, subject) {
  const ids=await dbGet(env,'platform_member_identities',`provider=eq.${encodeURIComponent(provider)}&provider_subject=eq.${encodeURIComponent(subject)}&select=*`).catch(()=>[]);
  if(!ids[0])return null;
  const rows=await dbGet(env,'platform_members',`id=eq.${encodeURIComponent(ids[0].member_id)}&select=*`).catch(()=>[]);
  return rows[0]?{...rows[0],_identity:ids[0]}:null;
}

async function getPlatformMemberById(env,id){
  const rows=await dbGet(env,'platform_members',`id=eq.${encodeURIComponent(String(id||''))}&select=*`).catch(()=>[]);
  return rows[0]||null;
}

async function issueIdentityLinkStart(env,memberId,provider,returnUrl){
  const now=Date.now();
  return signAdminJwt({iss:'DOING',type:'identity_link_start',member_id:String(memberId||''),provider:String(provider||''),return_url:String(returnUrl||'').slice(0,1800),issued_at:now,expires_at:now+10*60*1000},env);
}

async function hCreateIdentityLink(env,b,req){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);
  if(!verified)return jsonErr('會員登入已失效，請重新使用 LINE 登入');
  const provider=String(b.provider||'').trim().toLowerCase();
  if(!['line','google'].includes(provider))return jsonErr('不支援的登入方式');
  const already=await dbGet(env,'platform_member_identities',`member_id=eq.${encodeURIComponent(verified.row.id)}&provider=eq.${encodeURIComponent(provider)}&select=id`).catch(()=>[]);
  if(already.length)return jsonOk({ok:true,alreadyLinked:true,provider});
  const returnUrl=safeDoingReturnUrl(env,b.return_url||b.returnUrl||doingPageUrl(env,'member.html')).toString();
  const linkToken=await issueIdentityLinkStart(env,verified.row.id,provider,returnUrl);
  const start=new URL(`/auth/${provider}/start`,new URL(req&&req.url||doingSiteUrl(env)).origin);start.searchParams.set('mode','link');start.searchParams.set('link_token',linkToken);start.searchParams.set('return_url',returnUrl);
  return jsonOk({ok:true,provider,url:start.toString()});
}

async function verifyIdentityLinkStart(env,token,provider){
  const payload=await verifyAdminJwt(String(token||''),env).catch(()=>null);
  if(!payload||payload.iss!=='DOING'||payload.type!=='identity_link_start'||payload.provider!==provider||!payload.member_id)return null;
  return payload;
}

async function issueStaffInviteToken(env,{assignmentType='tenant',assignmentId='',tenantId='',email='',role=''}){
  const now=Date.now();
  return signAdminJwt({
    iss:'DOING',type:'staff_invite',assignment_type:String(assignmentType||'tenant'),assignment_id:String(assignmentId||''),
    tenant_id:String(tenantId||'').trim().toLowerCase(),email:normEmail(email),role:String(role||''),
    issued_at:now,expires_at:now+7*24*60*60*1000
  },env);
}

async function verifyStaffInviteToken(env,token){
  const payload=await verifyAdminJwt(String(token||''),env).catch(()=>null);
  if(!payload||payload.iss!=='DOING'||payload.type!=='staff_invite'||!payload.assignment_id||!payload.email)return null;
  return payload;
}

function staffInviteUrl(env,inviteToken){
  const u=new URL(doingPageUrl(env,'member.html'));
  u.searchParams.set('staff_invite',String(inviteToken||''));
  u.hash='account';
  return u.toString();
}

async function prepareStaffInvite(env,{assignmentType='tenant',assignmentId='',tenantId='',email='',role=''}){
  const token=await issueStaffInviteToken(env,{assignmentType,assignmentId,tenantId,email,role});
  return {token,url:staffInviteUrl(env,token)};
}

async function hAcceptStaffInvite(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);
  if(!verified)return jsonErr('請先使用自己的 LINE 登入，再接受管理邀請',401);
  const invite=await verifyStaffInviteToken(env,b.invite_token||b.inviteToken||b.staff_invite);
  if(!invite)return jsonErr('管理邀請已失效，請管理者重新寄送',400);
  const assignmentType=String(invite.assignment_type||'tenant'),table=assignmentType==='platform'?'platform_staff':'staff';
  const filter=`id=eq.${encodeURIComponent(invite.assignment_id)}&select=*`;
  const rows=await dbGet(env,table,filter).catch(()=>[]),assignment=rows[0];
  if(!assignment)return jsonErr('找不到這筆管理邀請，請管理者重新寄送',404);
  const active=assignment.is_active!==undefined?assignment.is_active:assignment.active;
  if(active===false)return jsonErr('這筆管理邀請已被停用，請聯絡管理者',403);
  if(normEmail(assignment.email)!==normEmail(invite.email))return jsonErr('管理邀請資料已更新，請使用最新邀請信',409);
  if(assignmentType!=='platform'&&String(assignment.tenant_id||'').toLowerCase()!==String(invite.tenant_id||'').toLowerCase())return jsonErr('管理邀請的營運空間不一致',409);
  if(assignment.platform_member_id&&String(assignment.platform_member_id)!==String(verified.row.id))return jsonErr('這筆邀請已由另一個 DOING 會員接受，請管理者確認後重新邀請',409);

  const inviteEmail=normEmail(invite.email),current=verified.row;
  let member=current;
  const existing=await dbGet(env,'platform_members',`email=eq.${encodeURIComponent(inviteEmail)}&email_verified_at=not.is.null&id=neq.${encodeURIComponent(current.id)}&select=*&order=created_at.asc&limit=1`).catch(()=>[]);
  if(existing[0])member=await mergeVerifiedPlatformMembers(env,current,existing[0],inviteEmail,current.id);
  const memberUpdate={updated_at:nowIso()};
  if(!normEmail(member.email)){memberUpdate.email=inviteEmail;memberUpdate.email_verified_at=nowIso()}
  else if(normEmail(member.email)===inviteEmail&&!member.email_verified_at)memberUpdate.email_verified_at=nowIso();
  if(!platformContactEmail(member))memberUpdate.contact_email=inviteEmail;
  await dbUpdate(env,'platform_members',`id=eq.${encodeURIComponent(member.id)}`,memberUpdate).catch(()=>{});
  await dbUpdate(env,table,`id=eq.${encodeURIComponent(assignment.id)}`,{platform_member_id:member.id,updated_at:nowIso()});
  await bindLegacyAdminAccessByVerifiedEmails(env,member.id);

  const tenantId=assignmentType==='platform'?'platform':String(assignment.tenant_id||''),role=String(assignment.normalized_role||assignment.role||invite.role||'');
  return jsonOk({ok:true,accepted:true,assignmentType,tenantId,role,memberId:member.id,message:assignmentType==='platform'?'已完成平台管理者綁定':'已完成管理者綁定'});
}

function platformMemberComplete(row){return !!(row&&platformContactEmail(row)&&normPhone(row.phone)&&String(row.name||'').trim()&&row.completed_at)}

function platformMemberMergeScore(row){const vendor=safeJson(row&&row.vendor_json,{});return (row&&row.completed_at?8:0)+(row&&row.name?4:0)+(row&&row.phone?2:0)+(vendor&&vendor.brandName?2:0)+(row&&row.email_verified_at?1:0)}

async function verifiedProviderEmailsForMember(env,memberId){
  const id=String(memberId||'').trim();if(!id)return [];
  const emails=new Set(),member=await getPlatformMemberById(env,id);
  if(member&&member.email_verified_at){const email=normEmail(member.email);if(email)emails.add(email)}
  const identities=await dbGet(env,'platform_member_identities',`member_id=eq.${encodeURIComponent(id)}&select=provider,provider_email`).catch(()=>[]);
  for(const identity of identities){
    if(!['line','google'].includes(String(identity.provider||'').trim().toLowerCase()))continue;
    const email=normEmail(identity.provider_email);if(email)emails.add(email);
  }
  return [...emails];
}

async function bindLegacyAdminAccessByVerifiedEmails(env,memberId){
  const id=String(memberId||'').trim(),linked={tenantStaff:0,platformStaff:0};if(!id)return linked;
  for(const email of await verifiedProviderEmailsForMember(env,id)){
    const tenantRows=await dbGet(env,'staff',`email=eq.${encodeURIComponent(email)}&select=id,platform_member_id,is_active,active`).catch(()=>[]);
    for(const row of tenantRows){
      const active=row.is_active!==undefined?row.is_active:row.active;
      if(active===false||String(row.platform_member_id||'').trim())continue;
      await dbUpdate(env,'staff',`id=eq.${encodeURIComponent(row.id)}`,{platform_member_id:id});linked.tenantStaff++;
    }
    const platformRows=await dbGet(env,'platform_staff',`email=eq.${encodeURIComponent(email)}&select=id,platform_member_id,is_active,active`).catch(()=>[]);
    for(const row of platformRows){
      const active=row.is_active!==undefined?row.is_active:row.active;
      if(active===false||String(row.platform_member_id||'').trim())continue;
      await dbUpdate(env,'platform_staff',`id=eq.${encodeURIComponent(row.id)}`,{platform_member_id:id});linked.platformStaff++;
    }
  }
  return linked;
}

async function mergeVerifiedPlatformMembers(env,left,right,verifiedEmail,preferredMemberId=''){
  if(!left||!right||String(left.id)===String(right.id))return left||right;
  const preferred=[left,right].find(row=>String(row.id)===String(preferredMemberId||''));
  const pair=preferred?[preferred,[left,right].find(row=>String(row.id)!==String(preferred.id))]:[left,right].sort((a,b)=>platformMemberMergeScore(b)-platformMemberMergeScore(a)||String(a.created_at||'').localeCompare(String(b.created_at||''))),target=pair[0],source=pair[1],now=nowIso();
  const targetVendor=safeJson(target.vendor_json,{}),sourceVendor=safeJson(source.vendor_json,{}),mergedVendor={...sourceVendor,...Object.fromEntries(Object.entries(targetVendor).filter(([,value])=>value!==''&&value!==null&&value!==undefined))};
  const primaryEmail=normEmail(target.email)||normEmail(source.email)||normEmail(verifiedEmail),contactEmail=platformContactEmail(target)||platformContactEmail(source)||primaryEmail,phone=normPhone(target.phone||source.phone);
  await dbUpdate(env,'platform_members',`id=eq.${encodeURIComponent(target.id)}`,{email:primaryEmail||null,contact_email:contactEmail||null,email_verified_at:target.email_verified_at||source.email_verified_at||now,phone:phone||null,phone_normalized:phone||null,name:target.name||source.name||null,line_id:target.line_id||source.line_id||null,city:target.city||source.city||null,display_name:target.display_name||source.display_name||'',avatar_url:target.avatar_url||source.avatar_url||'',vendor_json:mergedVendor,completed_at:target.completed_at||source.completed_at||null,updated_at:now});
  const identities=await dbGet(env,'platform_member_identities',`member_id=eq.${encodeURIComponent(source.id)}&select=*`).catch(()=>[]);
  for(const identity of identities)await dbUpdate(env,'platform_member_identities',`id=eq.${encodeURIComponent(identity.id)}`,{member_id:target.id,provider_email:identity.provider_email||verifiedEmail}).catch(()=>{});
  await dbUpdate(env,'registrations',`platform_member_id=eq.${encodeURIComponent(source.id)}`,{platform_member_id:target.id}).catch(()=>{});
  await dbUpdate(env,'registrations',`submitted_by_member_id=eq.${encodeURIComponent(source.id)}`,{submitted_by_member_id:target.id}).catch(()=>{});
  const sourceBrandLinks=await dbGet(env,'brand_members',`platform_member_id=eq.${encodeURIComponent(source.id)}&select=*`).catch(()=>[]);
  for(const link of sourceBrandLinks){const duplicate=await dbGet(env,'brand_members',`brand_id=eq.${encodeURIComponent(link.brand_id)}&platform_member_id=eq.${encodeURIComponent(target.id)}&select=id`).catch(()=>[]);if(duplicate[0])await dbDelete(env,'brand_members',`id=eq.${encodeURIComponent(link.id)}`).catch(()=>{});else await dbUpdate(env,'brand_members',`id=eq.${encodeURIComponent(link.id)}`,{platform_member_id:target.id,updated_at:now}).catch(()=>{})}
  const sourceRegLinks=await dbGet(env,'registration_members',`platform_member_id=eq.${encodeURIComponent(source.id)}&select=*`).catch(()=>[]);
  for(const link of sourceRegLinks){const duplicate=await dbGet(env,'registration_members',`registration_id=eq.${encodeURIComponent(link.registration_id)}&platform_member_id=eq.${encodeURIComponent(target.id)}&select=id`).catch(()=>[]);if(duplicate[0])await dbDelete(env,'registration_members',`id=eq.${encodeURIComponent(link.id)}`).catch(()=>{});else await dbUpdate(env,'registration_members',`id=eq.${encodeURIComponent(link.id)}`,{platform_member_id:target.id,updated_at:now}).catch(()=>{})}
  await dbUpdate(env,'brands',`created_by_member_id=eq.${encodeURIComponent(source.id)}`,{created_by_member_id:target.id,updated_at:now}).catch(()=>{});
  await dbUpdate(env,'brand_access_requests',`platform_member_id=eq.${encodeURIComponent(source.id)}`,{platform_member_id:target.id,updated_at:now}).catch(()=>{});
  await dbUpdate(env,'brand_access_requests',`resolved_by_member_id=eq.${encodeURIComponent(source.id)}`,{resolved_by_member_id:target.id,updated_at:now}).catch(()=>{});
  await dbUpdate(env,'registration_member_invites',`invited_by_member_id=eq.${encodeURIComponent(source.id)}`,{invited_by_member_id:target.id,updated_at:now}).catch(()=>{});
  await dbUpdate(env,'registration_member_invites',`accepted_by_member_id=eq.${encodeURIComponent(source.id)}`,{accepted_by_member_id:target.id,updated_at:now}).catch(()=>{});
  await dbUpdate(env,'staff',`platform_member_id=eq.${encodeURIComponent(source.id)}`,{platform_member_id:target.id}).catch(()=>{});
  await dbUpdate(env,'platform_staff',`platform_member_id=eq.${encodeURIComponent(source.id)}`,{platform_member_id:target.id}).catch(()=>{});
  const applications=await dbGet(env,'tenant_apply_logs','select=id,application_json&limit=1000').catch(()=>[]);
  for(const application of applications){const data=safeJson(application.application_json,{});if(String(data.memberId||'')===String(source.id))await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(application.id)}`,{application_json:{...data,memberId:target.id,identityMergedAt:now}}).catch(()=>{})}
  await dbDelete(env,'platform_members',`id=eq.${encodeURIComponent(source.id)}`).catch(()=>{});
  const identity=await dbGet(env,'platform_member_identities',`member_id=eq.${encodeURIComponent(target.id)}&select=*&order=last_login_at.desc&limit=1`).catch(()=>[]);
  await bindLegacyAdminAccessByVerifiedEmails(env,target.id);
  return {...target,email:primaryEmail||null,contact_email:contactEmail||null,email_verified_at:target.email_verified_at||source.email_verified_at||now,phone:phone||null,phone_normalized:phone||null,name:target.name||source.name||null,line_id:target.line_id||source.line_id||null,city:target.city||source.city||null,display_name:target.display_name||source.display_name||'',avatar_url:target.avatar_url||source.avatar_url||'',vendor_json:mergedVendor,completed_at:target.completed_at||source.completed_at||null,_identity:identity[0]||target._identity};
}

async function upsertPlatformIdentity(env,{provider,subject,email='',displayName='',avatarUrl='',preferredMemberId=''}){
  const now=nowIso();
  const normalizedEmail=normEmail(email);
  let member=await getPlatformMemberByProvider(env,provider,subject);
  if(member){
    if(normalizedEmail){
      const matches=await dbGet(env,'platform_members',`email=eq.${encodeURIComponent(normalizedEmail)}&id=neq.${encodeURIComponent(member.id)}&email_verified_at=not.is.null&select=*&order=created_at.asc`).catch(()=>[]);
      if(matches[0]){await mergeVerifiedPlatformMembers(env,member,matches[0],normalizedEmail,preferredMemberId);member=await getPlatformMemberByProvider(env,provider,subject)}
    }
    const update={display_name:displayName||member.display_name||'',avatar_url:avatarUrl||member.avatar_url||'',updated_at:now};
    if(normalizedEmail&&!normEmail(member.email)){update.email=normalizedEmail;update.email_verified_at=now}
    await dbUpdate(env,'platform_members',`id=eq.${encodeURIComponent(member.id)}`,update).catch(()=>{});
    if(member._identity)await dbUpdate(env,'platform_member_identities',`id=eq.${encodeURIComponent(member._identity.id)}`,{provider_email:normalizedEmail||member._identity.provider_email||null,last_login_at:now}).catch(()=>{});
    await bindLegacyAdminAccessByVerifiedEmails(env,member.id);
    return {...member,...update};
  }
  if(normalizedEmail){
    const byEmail=await dbGet(env,'platform_members',`email=eq.${encodeURIComponent(normalizedEmail)}&select=*`).catch(()=>[]);
    if(byEmail[0]){
      member=byEmail[0];if(!member.email_verified_at)throw new Error('email_link_requires_existing_login');
      await dbInsert(env,'platform_member_identities',{id:genId('MID'),member_id:member.id,provider,provider_subject:subject,provider_email:normalizedEmail,created_at:now,last_login_at:now});
      await dbUpdate(env,'platform_members',`id=eq.${encodeURIComponent(member.id)}`,{display_name:displayName||member.display_name||'',avatar_url:avatarUrl||member.avatar_url||'',updated_at:now});
      await bindLegacyAdminAccessByVerifiedEmails(env,member.id);
      return member;
    }
  }
  const row={id:genId('MEM'),email:normalizedEmail||null,contact_email:normalizedEmail||null,phone:null,phone_normalized:null,name:null,line_id:null,city:null,display_name:displayName,avatar_url:avatarUrl,vendor_json:{},created_at:now,updated_at:now,completed_at:null,email_verified_at:normalizedEmail?now:null};
  await dbInsert(env,'platform_members',row);await dbInsert(env,'platform_member_identities',{id:genId('MID'),member_id:row.id,provider,provider_subject:subject,provider_email:normalizedEmail||null,created_at:now,last_login_at:now});
  await bindLegacyAdminAccessByVerifiedEmails(env,row.id);
  return row;
}

async function hLineStart(env,url){
  if(!env.LINE_LOGIN_CHANNEL_ID)return new Response('LINE Login 尚未設定 Channel ID',{status:500});
  const mode=String(url.searchParams.get('mode')||'member').trim().toLowerCase(),tenant=String(url.searchParams.get('tenant')||'').trim().toLowerCase(),nonce=crypto.randomUUID();
  const link=mode==='link'?await verifyIdentityLinkStart(env,url.searchParams.get('link_token'),'line'):null;
  if(mode==='link'&&!link)return new Response('帳號連結已失效，請回會員中心重新操作',{status:400});
  const fallback=mode==='platform'||tenant==='platform'?platformSiteUrl(env):mode==='organizer_signup'?doingSiteUrl(env)+'#apply':doingSiteUrl(env);
  const state=await issueLineOAuthState(env,{mode,tenant,application_id:url.searchParams.get('application_id')||'',return_url:link?.return_url||url.searchParams.get('return_url')||fallback,link_member_id:link?.member_id||'',nonce});
  // LINE Email 權限需經 LINE Developers 另行審核。尚未核准時仍以固定 provider subject
  // 完成安全登入；有核准並明確開啟設定時，才額外取得已驗證 Email 做跨服務自動合併。
  const lineEmailEnabled=String(env.LINE_LOGIN_EMAIL_ENABLED||'').trim().toLowerCase()==='true';
  const scope=lineEmailEnabled?'openid profile email':'openid profile';
  const params=new URLSearchParams({response_type:'code',client_id:env.LINE_LOGIN_CHANNEL_ID,redirect_uri:lineRedirectUri(env,url),state,scope,nonce,bot_prompt:'normal'});
  return Response.redirect(`https://access.line.me/oauth2/v2.1/authorize?${params}`,302);
}

async function hLineCallback(env,url){
  const statePayload=await verifyLineOAuthState(env,url.searchParams.get('state')||'');
  const mode=String(statePayload&&statePayload.mode||'member').trim().toLowerCase(),tenant=String(statePayload&&statePayload.tenant||'').trim().toLowerCase();
  const memberTarget=safeDoingReturnUrl(env,statePayload&&statePayload.return_url),applicationTarget=new URL(doingSiteUrl(env)),adminTarget=new URL(adminLoginSiteUrl(env)),platformTarget=new URL(platformSiteUrl(env));applicationTarget.hash='apply';
  const target=mode==='organizer_signup'?applicationTarget:mode==='platform'||tenant==='platform'?platformTarget:mode==='admin'||tenant?adminTarget:memberTarget;
  const fail=reason=>{target.searchParams.set(['member','link'].includes(mode)?'member_login_error':'login_error',reason);return Response.redirect(target.toString(),302)};
  if(!statePayload)return fail('invalid_or_expired_state');
  if(url.searchParams.get('error'))return fail('line_cancelled');
  const code=url.searchParams.get('code');
  if(!code||!env.LINE_LOGIN_CHANNEL_ID||!env.LINE_LOGIN_CHANNEL_SECRET)return fail('line_config_or_code_missing');
  try{
    const tokenHttp=await fetch('https://api.line.me/oauth2/v2.1/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:lineRedirectUri(env,url),client_id:env.LINE_LOGIN_CHANNEL_ID,client_secret:env.LINE_LOGIN_CHANNEL_SECRET})});
    const tokens=await tokenHttp.json();if(!tokenHttp.ok||!tokens.access_token||!tokens.id_token)throw new Error('token_exchange_failed');
    const verifyHttp=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id_token:String(tokens.id_token),client_id:String(env.LINE_LOGIN_CHANNEL_ID)})});
    const profile=await verifyHttp.json();if(!verifyHttp.ok||String(profile.aud)!==String(env.LINE_LOGIN_CHANNEL_ID)||!profile.sub||String(profile.nonce||'')!==String(statePayload.nonce||''))throw new Error('id_token_verify_failed');
    const verifiedEmail=normEmail(profile.email||''),lineSubject=String(profile.sub),lineName=String(profile.name||''),lineAvatar=String(profile.picture||'');
    let member=await upsertPlatformIdentity(env,{provider:'line',subject:lineSubject,email:verifiedEmail,displayName:lineName,avatarUrl:lineAvatar,preferredMemberId:mode==='link'?statePayload.link_member_id:''});

    if(mode==='link'){
      const original=await getPlatformMemberById(env,statePayload.link_member_id);if(!original)return fail('identity_link_target_not_found');
      member=await mergeVerifiedPlatformMembers(env,original,member,verifiedEmail,original.id);
      const memberToken=await issueMemberToken({email:member.email,provider:'line',provider_subject:lineSubject,display_name:lineName,avatar_url:lineAvatar},env);
      memberTarget.searchParams.set('member_token',memberToken);memberTarget.searchParams.set('member_status',platformMemberComplete(member)?'ready':'profile_required');memberTarget.searchParams.set('member_linked','line');return Response.redirect(memberTarget.toString(),302);
    }

    if(mode==='organizer_signup'){
      const applicationId=String(statePayload.application_id||'').trim();if(!applicationId)return fail('signup_missing_profile');
      const draftRows=await dbGet(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}&status=eq.line_verification_pending&select=*`).catch(()=>[]),draft=draftRows[0];
      if(!draft)return fail('signup_draft_not_found');
      const appPayload=safeJson(draft.application_json,{}),brand=String(appPayload.unitName||draft.brand_name||'').trim(),contact=String(appPayload.ownerName||appPayload.contactName||draft.contact_name||lineName||'').trim(),phone=String(appPayload.phone||draft.contact_phone||'').trim(),contactEmail=normEmail(appPayload.contactEmail||draft.contact_email||verifiedEmail);
      if(!brand||!contact||!phone||!contactEmail)return fail('signup_missing_profile');
      const collision=await platformIdentityCollision(env,member.id,contactEmail,phone);
      if(collision.found){const memberToken=await issueMemberToken({email:member.email,provider:'line',provider_subject:lineSubject,display_name:lineName,avatar_url:lineAvatar},env);await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{note:'登入成功；偵測到既有帳號，申請保留草稿等待連結帳號',application_json:{...appPayload,memberId:member.id,loginProvider:'line',identityResolutionRequired:true}}).catch(()=>{});applicationTarget.searchParams.set('member_token',memberToken);applicationTarget.searchParams.set('member_status',platformMemberComplete(member)?'ready':'profile_required');applicationTarget.searchParams.set('member_login_error','identity_resolution_required');applicationTarget.searchParams.set('application_status','identity_resolution_required');applicationTarget.searchParams.set('application_id',applicationId);return Response.redirect(applicationTarget.toString(),302)}
      const signupProfile=appPayload.moduleProfile||{},signupDefaults=normalizeSessionModules(signupProfile&&signupProfile.defaults?signupProfile.defaults:{}),profileConfig={configured:true,useType:String(signupProfile.useType||'generic'),useCases:Array.isArray(signupProfile.useCases)?signupProfile.useCases.map(String).slice(0,12):[],defaults:signupDefaults,updatedAt:nowIso()};
      const submittedAt=nowIso(),applicationJson={...appPayload,ownerName:contact,contactName:contact,billingName:contact,moduleProfile:profileConfig,memberId:member.id,loginProvider:'line',lineSubject,lineDisplayName:lineName,submittedAt,timeline:[...(Array.isArray(appPayload.timeline)?appPayload.timeline:[]),{key:'application_submitted',label:'LINE 驗證並送出',at:submittedAt}]};
      const existingRows=await dbGet(env,'tenant_apply_logs',`contact_email=eq.${encodeURIComponent(contactEmail)}&status=eq.supplement_required&select=id,status,supplement_count,brand_name`).catch(()=>[]),supplement=existingRows.find(x=>String(x.brand_name||'').trim().toLowerCase()===brand.toLowerCase());
      if(supplement){await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(supplement.id)}`,{brand_name:brand,contact_name:contact,contact_email:contactEmail,contact_phone:phone,event_type:(appPayload.useCases||[]).join(','),status:'pending',plan_type:'review',note:'LINE 驗證後補件重新送出',application_json:applicationJson,supplement_submitted_at:submittedAt,supplement_count:safeNum(supplement.supplement_count)+1,rejected_at:null,rejected_by:null,rejection_reason:null});await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{status:'replaced',note:'已併入補件申請'}).catch(()=>{});applicationTarget.searchParams.set('application_status','supplement_submitted');applicationTarget.searchParams.set('application_id',supplement.id);return Response.redirect(applicationTarget.toString(),302)}
      await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{brand_name:brand,contact_name:contact,contact_email:contactEmail,contact_phone:phone,event_type:(appPayload.useCases||[]).join(','),plan_type:'review',note:'LINE 驗證完成',status:'pending',application_json:applicationJson});
      try{await sendEmail(env,contactEmail,'【DOING】營運帳號申請已送出',emailWrap(`<p>${contact} 您好：</p><p>你的 DOING 營運帳號申請已送出，目前等待平台審核。</p><p><b>申請編號：</b>${applicationId}</p><p>審核通過或需要補件時，系統會再寄信通知。</p>`))}catch(e){}
      applicationTarget.searchParams.set('application_status','pending');applicationTarget.searchParams.set('application_id',applicationId);return Response.redirect(applicationTarget.toString(),302);
    }

    if(mode==='platform'||tenant==='platform'){
      let rows=await dbGet(env,'platform_staff',`platform_member_id=eq.${encodeURIComponent(member.id)}&is_active=eq.true&select=*`).catch(()=>[]),staff=rows[0];
      if(!staff&&verifiedEmail){rows=await dbGet(env,'platform_staff',`email=eq.${encodeURIComponent(verifiedEmail)}&is_active=eq.true&select=*`).catch(()=>[]);staff=rows[0];if(staff)await dbUpdate(env,'platform_staff',`id=eq.${encodeURIComponent(staff.id)}`,{platform_member_id:member.id,last_login_at:nowIso()}).catch(()=>{})}
      if(!staff){await logAdminLogin(env,'platform',null,verifiedEmail,'line','denied','not_platform_staff','','').catch(()=>{});return fail('not_authorized')}
      const platformToken=await issueAdminToken({...staff,email:staff.email||verifiedEmail,name:staff.name||lineName},'platform',env);await dbUpdate(env,'platform_staff',`id=eq.${encodeURIComponent(staff.id)}`,{last_login_at:nowIso()}).catch(()=>{});await logAdminLogin(env,'platform',staff.id,staff.email||verifiedEmail,'line','success','platform_login','','').catch(()=>{});platformTarget.searchParams.set('admin_token',platformToken);return Response.redirect(platformTarget.toString(),302);
    }

    if(mode==='admin'||tenant){
      const workspaces=tenant?((await findStaffForPlatformMember(env,member.id,tenant))?await findAdminWorkspacesByMemberId(env,member.id):[]):await findAdminWorkspacesByMemberId(env,member.id);
      if(!workspaces.length){await logAdminLogin(env,tenant,null,verifiedEmail,'line','denied','member_not_in_staff','','').catch(()=>{});return fail('not_authorized')}
      if(tenant||workspaces.length===1){const selected=tenant?workspaces.find(w=>w.tenant_id===tenant):workspaces[0];if(!selected)return fail('not_authorized');const staff=await findStaffForPlatformMember(env,member.id,selected.tenant_id);if(!staff)return fail('not_authorized');const adminToken=await issueAdminToken({...staff,email:staff.email||verifiedEmail},selected.tenant_id,env);await dbUpdate(env,'staff',`id=eq.${encodeURIComponent(staff.id)}`,{last_login_at:nowIso(),display_name:staff.display_name||lineName,platform_member_id:member.id}).catch(()=>{});await logAdminLogin(env,selected.tenant_id,staff.id,staff.email||verifiedEmail,'line','success','tenant_login','','').catch(()=>{});const u=new URL(adminSiteUrl(env));u.searchParams.set('tenant',selected.tenant_id);u.searchParams.set('admin_token',adminToken);return Response.redirect(u.toString(),302)}
      const selectionToken=await issueWorkspaceSelectionToken(verifiedEmail,workspaces.map(w=>w.tenant_id),env,{provider:'line',platform_member_id:member.id});const u=new URL(adminLoginSiteUrl(env));u.searchParams.set('workspace_token',selectionToken);return Response.redirect(u.toString(),302);
    }

    const memberToken=await issueMemberToken({email:member.email,provider:'line',provider_subject:lineSubject,display_name:lineName,avatar_url:lineAvatar},env);
    memberTarget.searchParams.set('member_token',memberToken);memberTarget.searchParams.set('member_status',platformMemberComplete(member)?'ready':'profile_required');return Response.redirect(memberTarget.toString(),302);
  }catch(e){await logError(env,{source:'hLineCallback',action:'lineOAuthCallback',tenantId:tenant,message:'LINE OAuth callback failed',error:e&&e.message?e.message:String(e),meta:{mode,applicationId:String(statePayload&&statePayload.application_id||'')}}).catch(()=>{});return fail('line_login_failed')}
}

async function issueGoogleOAuthState(env, tenant, extra={}) {
  const now = Date.now();
  return signAdminJwt({
    iss: 'DOING',
    type: 'google_oauth_state',
    tenant: String(tenant || '').trim().toLowerCase(),
    mode:String(extra.mode||''), return_url:String(extra.return_url||'').slice(0,1800), link_member_id:String(extra.link_member_id||'').slice(0,120), application_id:String(extra.application_id||'').slice(0,120), brand_name:String(extra.brand_name||'').slice(0,120), contact_name:String(extra.contact_name||'').slice(0,120), contact_phone:String(extra.contact_phone||'').slice(0,80), event_type:String(extra.event_type||'').slice(0,240), module_profile:String(extra.module_profile||'').slice(0,6000),
    issued_at: now,
    expires_at: now + 10 * 60 * 1000,
  }, env);
}

async function verifyGoogleOAuthState(env, token) {
  const payload = await verifyAdminJwt(token || '', env);
  if (!payload || payload.iss !== 'DOING' || payload.type !== 'google_oauth_state') return null;
  return payload;
}

async function hListLoginWorkspaces(env, p) {
  const payload = await verifyWorkspaceSelectionToken(p.workspace_token || p.token || '', env);
  if (!payload) return jsonErr('登入選擇已失效，請重新使用 LINE 登入');
  const current = payload.platform_member_id?await findAdminWorkspacesByMemberId(env,payload.platform_member_id):await findAdminWorkspacesByEmail(env,payload.email);
  const allowed = new Set(payload.tenant_ids.map(v=>String(v).toLowerCase()));
  return jsonOk({
    ok: true,
    email: payload.email,
    workspaces: current.filter(w=>allowed.has(String(w.tenant_id).toLowerCase())),
  });
}

async function hSelectLoginWorkspace(env, b) {
  const payload = await verifyWorkspaceSelectionToken(b.workspace_token || b.token || '', env);
  if (!payload) return jsonErr('登入選擇已失效，請重新使用 LINE 登入');
  const tenant = String(b.target_workspace_id || b.tenant || b.tenant_id || '').trim().toLowerCase();
  const allowed = payload.tenant_ids.map(v=>String(v).toLowerCase());
  if (!tenant || !allowed.includes(tenant)) return jsonErr('此主辦空間不在本次登入授權範圍');

  const staff = payload.platform_member_id?await findStaffForPlatformMember(env,payload.platform_member_id,tenant):(await dbGet(env, 'staff', `tenant_id=eq.${encodeURIComponent(tenant)}&email=eq.${encodeURIComponent(payload.email)}&select=*`).catch(()=>[])).find(r=>((r.is_active !== undefined ? r.is_active : r.active) !== false));
  if (!staff) return jsonErr('此帳號已無該主辦空間管理權限，請重新登入');

  const adminToken = await issueAdminToken({ ...staff, email: staff.email||payload.email }, tenant, env);
  await dbUpdate(env, 'staff', `id=eq.${encodeURIComponent(staff.id)}`, { last_login_at: new Date().toISOString() }).catch(()=>{});
  await logAdminLogin(env, tenant, staff.id, staff.email||payload.email, payload.provider||'google', 'success', 'workspace_selected', '', '');

  const adminUrl = adminSiteUrl(env);
  return jsonOk({ ok:true, tenant, admin_token:adminToken, admin_url:adminUrl });
}

// GET /auth/google/start
async function hGoogleStart(env, url) {
  // 公開畫面現階段只顯示 LINE；Google OAuth 保留並可供既有帳號連結與未來重新啟用。
  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
  if (!GOOGLE_CLIENT_ID) {
    return new Response('Google OAuth 未設定：缺少 GOOGLE_CLIENT_ID', { status: 500 });
  }

  const GOOGLE_REDIRECT_URI = googleRedirectUri(env, url);
  const tenant = String(url.searchParams.get('tenant') || '').trim().toLowerCase();
  const mode=String(url.searchParams.get('mode')||'').trim().toLowerCase(),link=mode==='link'?await verifyIdentityLinkStart(env,url.searchParams.get('link_token'),'google'):null;
  if(mode==='link'&&!link)return new Response('帳號連結已失效，請回會員中心重新操作',{status:400});
  const state = await issueGoogleOAuthState(env, tenant, {mode,return_url:link?.return_url||url.searchParams.get('return_url')||'',link_member_id:link?.member_id||'',application_id:url.searchParams.get('application_id')||'',brand_name:url.searchParams.get('brand_name')||'',contact_name:url.searchParams.get('contact_name')||'',contact_phone:url.searchParams.get('contact_phone')||'',event_type:url.searchParams.get('event_type')||'',module_profile:url.searchParams.get('module_profile')||''});

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}

// GET /auth/google/callback
async function hGoogleCallback(env, url) {
  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
  const GOOGLE_REDIRECT_URI = googleRedirectUri(env, url);

  const loginUrl = adminLoginSiteUrl(env);
  const adminUrl = adminSiteUrl(env);
  const platformUrl = platformSiteUrl(env);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const failRedirect = (reason, target = loginUrl) => {
    const u = new URL(target);
    u.searchParams.set('login_error', reason);
    return Response.redirect(u.toString(), 302);
  };

  if (!GOOGLE_CLIENT_ID) return failRedirect('google_client_id_missing');
  if (!GOOGLE_CLIENT_SECRET) return failRedirect('google_client_secret_missing');
  if (errorParam) return failRedirect('google_cancelled');
  if (!code || !state) return failRedirect('missing_params');

  const statePayload = await verifyGoogleOAuthState(env, state);
  if (!statePayload) return failRedirect('invalid_or_expired_state');
  const tenant = String(statePayload.tenant || '').trim().toLowerCase();

  let tokenRes;
  try {
    const tokenHttp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    tokenRes = await tokenHttp.json();
    if (!tokenHttp.ok) throw new Error(tokenRes.error || 'token_exchange_failed');
  } catch(e) {
    await logAdminLogin(env, tenant, null, '', 'google', 'error', 'token_exchange_failed', '', '').catch(()=>{});
    return failRedirect(