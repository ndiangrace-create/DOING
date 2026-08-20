Warning: truncated output (original token count: 239006)
Total output lines: 12337

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

function crossTenantTokenDenied(payload, tenantId) {
  const hinted=jwtTenantHint(payload && (payload.token||payload.admin_token));
  return !!(hinted && hinted!=='platform' && hinted!==String(tenantId||'').trim().toLowerCase());
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
  // 前台以 page=member 判斷要開「我的報名」；member=1 一併保留以相容舊連結。
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

請回到「我的報名」查看審核進度與報名狀態。

[按鈕:前往我的報名]`,
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

攤位號碼將於活動前公布，屆時請至「我的報名」查看；行前通知信也會一併附上您的攤位與場地圖。

請回到報名系統「我的報名」登入查看繳費資訊、付款帳戶與最新進度。

[按鈕:前往我的報名]`,
      is_active:true,
      group:'審核流程'
    },
    {
      template_key:'rejection_notice',
      title:'未錄取通知信',
      subject:'【[場次名稱]】報名結果通知',
      body:`親愛的 [顯示名稱]，

感謝您報名 [場次名稱]。

很抱歉，本場次未錄取。您仍可回到「我的報名」查看報名紀錄，或查看其他開放場次。

[按鈕:前往我的報名]`,
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

請回到「我的報名」查看付款帳戶並完成繳費。

[按鈕:前往我的報名]`,
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

請回到「我的報名」查看付款確認進度。

[按鈕:前往我的報名]`,
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

您可回到「我的報名」查看最新報名狀態。

[按鈕:前往我的報名]`,
      is_active:false,
      group:'付款流程'
    },
    {
      template_key:'registration_cancelled',
      title:'取消報名信',
      subject:'【[場次名稱]】報名已取消',
      body:`親愛的 [顯示名稱]，

您報名的 [場次名稱] 已取消。

詳細狀態可回到「我的報名」查詢。

[按鈕:前往我的報名]`,
      is_active:false,
      group:'取消／退款'
    },
    {
      template_key:'refund_request_received',
      title:'退款申請通知',
      subject:'【[場次名稱]】退款申請已收到',
      body:`親愛的 [顯示名稱]，

我們已收到您 [場次名稱] 的退款申請。

主辦確認後，將依退款規則處理。您可回到「我的報名」查看進度。

[按鈕:前往我的報名]`,
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

款項將依實際金流或帳務處理時間退回。詳細紀錄可回到「我的報名」查詢。

[按鈕:前往我的報名]`,
      is_active:true,
      group:'取消／退款'
    },
    {
      template_key:'overdue_cancel',
      title:'逾期未繳取消信',
      subject:'【[場次名稱]】報名已因逾期未繳費取消',
      body:`親愛的 [顯示名稱]，

您報名的 [場次名稱] 因逾期未完成繳費，系統已取消本筆報名並釋出名額。

詳細狀態可回到「我的報名」查詢。

[按鈕:前往我的報名]`,
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

請留意報到、進場與現場規範。詳細資訊可回到「我的報名」查看。

[按鈕:前往我的報名]
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

請回到「我的報名」選擇「延期」或「退費」。
逾期未選擇者，系統將自動歸為退費處理。

[按鈕:前往我的報名]`,
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

請回到「我的報名」查看完整狀態。

[按鈕:前往我的報名]`,
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

[按鈕:前往我的報名]`,
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
      else if (label.includes('繳費') || label.includes('我的報名') || label.includes('報名紀錄') || label.includes('會員')) href = memberUrl(regId || null, tenantCtx);
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

// ② 錄取通知：資料由 DB / Worker 帶入，前台只回我的報名查詢
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
    '設備': equip || '請以我的報名顯示為準',
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
  const T=b._tenantId;if(!await verifyStaff(env,b.email,b.token,T,'settings'))return jsonErr('無權限');
  const key=String(b.themeKey||b.key||'').trim();if(!TENANT_THEME_KEYS.has(key))return jsonErr('不支援的品牌模板');
  const before=await getTenantTheme(env,T),value={key,updatedAt:nowIso(),managedBy:'tenant',updatedBy:b.email||''};
  const row=await getTenantSettingsRow(env,T);
  if(row)await dbUpdate(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(T)}`,{theme_json:value,updated_at:nowIso()});
  else await dbInsert(env,'tenant_settings',{tenant_id:T,module_flags_json:await getTenantModuleFlags(env,T),theme_json:value});
  await writeAuditLog(env,T,b.email||'','organizer','save_tenant_theme','tenant_settings',T,before,value).catch(()=>{});
  return jsonOk(value);
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
  if(row)await dbUpdate(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(T)}`,{module_flags_json:flags,updated_at:nowIso()});
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
  if(row)await dbUpdate(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(T)}`,{theme_json:value,updated_at:nowIso()});
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
async function hGetDoingPublicSupportConversation(env,p){
  const verified=await verifiedPlatformMember(env,p&&(p.member_token||p.memberToken));if(!verified||!verified.row||!verified.row.id)return jsonErr('請先登入 DOING 會員',401);
  const memberId=String(verified.row.id),requested=cleanSupportText(p&&p.threadId,80);
  const filter=requested?`id=eq.${encodeURIComponent(requested)}&member_id=eq.${encodeURIComponent(memberId)}`:`member_id…189006 tokens truncated…合（不可讓不相關者觸發延期）
  if (!b.email) return jsonErr('請提供 email');
  if (String(reg.email||'').toLowerCase() !== String(b.email||'').toLowerCase()) return jsonErr('無權限操作此報名');
  const now = nowIso();
  await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(b.regId)}&tenant_id=eq.${TENANT}`,{
    transfer_status:'已延期', transfer_target_session_id:b.targetSessionId, transfer_chosen_at:now,
  });
  const newSes = await getSessionRow(env, b.targetSessionId, TENANT);
  if (!newSes) return jsonErr('找不到目標場次');
  const newRegId = genId('REG');
  const newFee = calcFee(newSes, safeJson(reg.selected_dates_json,[]), reg.stall_count);
  const newTotal = newFee+(Number(newSes.deposit)||0);
  await dbInsert(env,'registrations',{
    id:newRegId, tenant_id:TENANT,
    session_id:b.targetSessionId, event_id:cleanEventId(newSes.event_id),
    email:reg.email, platform_member_id:reg.platform_member_id||null, name:reg.name, phone:reg.phone,
    brand_name:reg.brand_name||'', brand_intro:reg.brand_intro||'',
    sell_category:reg.sell_category||'', sell_items:reg.sell_items||'',
    sell_link:reg.sell_link||'', photo_url:reg.photo_url||'',
    equipment_json:reg.equipment_json||'{}',
    custom_fields_json:reg.custom_fields_json||'{}',
    stall_count:reg.stall_count, deposit:Number(newSes.deposit)||0,
    review_status:'已錄取',
    payment_status:isPaidStatus(reg.payment_status)?reg.payment_status:'未繳費',
    amount:newTotal, total_amount:newTotal,
    checkin_status:'未報到', clear_status:'未清場', deposit_refunded:'未退押金',
    stall_number:'', selected_dates_json:reg.selected_dates_json||'[]',
    original_session_id:reg.session_id, created_at:now,
  });
  // M-01：延期新場次名額扣減改用原子 RPC
  await dbRpc(env, 'claim_session_slot', {
    p_tenant_id: TENANT, p_session_id: b.targetSessionId, p_stall_count: (safeNum(reg.stall_count)||1)
  });
  const oldFee = Number(reg.amount||0);
  const dn = getDisplayName(reg.name, reg.brand_name||'');
  const tcTransfer = await getTenantCtx(env, TENANT);
  try {
    if (newTotal!==oldFee) await mailTransferDiffFee(env,reg.email,dn,newSes.name,newTotal,oldFee,tcTransfer);
    else await mailTransferSameFee(env,reg.email,dn,newSes.name,tcTransfer);
  } catch {}
  return jsonOk({success:true, newRegId});
}


// ── AA8-2 退款規則：由資料庫規則帶出行政費建議，退款金額由扣項自動計算 ──
function firstSessionDateValue(ses, reg) {
  const selected = safeJson(reg && reg.selected_dates_json, []);
  if (Array.isArray(selected) && selected.length) return selected[0];
  const dates = safeJson(ses && ses.dates_json, []);
  if (Array.isArray(dates) && dates.length) return dates.map(d=>d.date||d.startDate||d.day||'').filter(Boolean)[0] || '';
  return (ses && (ses.date || ses.start_date || ses.start_at)) || '';
}
function daysBeforeEvent(eventDateValue, baseIso) {
  if (!eventDateValue) return null;
  const eventDate = new Date(String(eventDateValue).slice(0,10) + 'T00:00:00+08:00');
  const baseDate = new Date(String(baseIso || nowIso()).slice(0,10) + 'T00:00:00+08:00');
  if (isNaN(eventDate.getTime()) || isNaN(baseDate.getTime())) return null;
  return Math.floor((eventDate.getTime() - baseDate.getTime()) / 86400000);
}
function normalizeRefundRules(rawRules) {
  const rulesObj = rawRules && typeof rawRules === 'object' ? rawRules : DEFAULT_REFUND_RULES;
  const list = Array.isArray(rulesObj.rules) && rulesObj.rules.length ? rulesObj.rules : DEFAULT_REFUND_RULES.rules;
  return { transferFeeDefault: safeNum(rulesObj.transferFeeDefault), rules:list };
}
function pickRefundRule(rulesObj, daysBefore) {
  const rules = normalizeRefundRules(rulesObj).rules;
  if (daysBefore === null || daysBefore === undefined) return { key:'manual', label:'無法自動判斷日期，請主辦手動確認', adminFeeType:'fixed', adminFee:0 };
  const sorted = rules.slice().sort((a,b)=>(Number(b.minDays)||-9999)-(Number(a.minDays)||-9999));
  return sorted.find(rule=>{
    const min = rule.minDays === undefined ? -9999 : Number(rule.minDays);
    const max = rule.maxDays === undefined ? 99999 : Number(rule.maxDays);
    return daysBefore >= min && daysBefore <= max;
  }) || sorted[sorted.length-1] || DEFAULT_REFUND_RULES.rules[DEFAULT_REFUND_RULES.rules.length-1];
}
function calcAdminFeeByRule(rule, paidAmount) {
  const paid = safeNum(paidAmount);
  if (!rule) return 0;
  if (rule.adminFeeType === 'percent') return Math.round(paid * (Number(rule.adminFeePercent)||0) / 100);
  return Math.min(paid, safeNum(rule.adminFee));
}
async function calcRefundSuggestion(env, TENANT, reg) {
  const [sesRows, tenantCtx, itemMap] = await Promise.all([
    dbGet(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(reg.session_id)}&select=*`),
    getTenantCtx(env,TENANT),
    _getRegistrationItemsForRegs(env, [reg]).catch(()=>({}))
  ]);
  const ses = sesRows[0] || {};
  const sessionRules = safeJson(ses.refund_rules_json, null);
  const rulesObj = normalizeRefundRules(sessionRules || tenantCtx.defaultRefundRules || DEFAULT_REFUND_RULES);
  const money = _regFinanceAmounts(reg, ses, itemMap && itemMap[reg.id]);
  const paidAmount = safeNum(reg.paid_amount) || (isPaidStatus(reg.payment_status) ? (money.cashTotal || safeNum(reg.amount || reg.total_amount)) : 0);
  const requestDate = reg.transfer_chosen_at || nowIso();
  const eventDate = firstSessionDateValue(ses, reg);
  const daysBefore = daysBeforeEvent(eventDate, requestDate);
  const snap=selectedModuleSnapshot(reg),mods=normalizeSessionModules(safeJson(ses.modules_json,{})),bp=(snap.bookingPolicy&&typeof snap.bookingPolicy==='object')?normalizeSessionModules({bookingPolicy:snap.bookingPolicy}).bookingPolicy:mods.bookingPolicy;
  if(String(mods.operatingMode||'activity')==='booking' && Array.isArray(bp.cancelTiers) && bp.cancelTiers.length){
    let hoursBefore=daysBefore*24;const tids=registrationTimeslotIds(reg);if(tids.length){const slots=await dbGet(env,'timeslots',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(tids[0])}&select=*`).catch(()=>[]);const start=_bookingStartIso(slots[0]);if(start)hoursBefore=(new Date(start).getTime()-new Date(requestDate).getTime())/3600000;}
    const tier=bp.cancelTiers.find(x=>hoursBefore>=safeNum(x.minHours))||bp.cancelTiers[bp.cancelTiers.length-1];const cash=Math.floor(paidAmount*safeNum(tier.refundPercent)/100),credit=Math.min(paidAmount-cash,Math.floor(paidAmount*safeNum(tier.creditPercent)/100));
    return {paidAmount,eventDate:eventDate||'',requestDate,daysBefore,hoursBefore,refundRuleKey:tier.key||'',refundRuleLabel:`預約取消規則｜提前 ${Math.max(0,Math.floor(hoursBefore))} 小時`,refundAdminFee:Math.max(0,paidAmount-cash-credit),refundTransferFee:0,refundAmount:cash,transferCreditAmount:credit,nonRefundAmount:Math.max(0,paidAmount-cash-credit),bookingPolicy:true};
  }
  const rule = pickRefundRule(rulesObj, daysBefore);
  const refundAdminFee = Math.min(paidAmount, calcAdminFeeByRule(rule, paidAmount));
  const refundTransferFee = Math.min(Math.max(0, paidAmount - refundAdminFee), safeNum(rulesObj.transferFeeDefault));
  const refundAmount = Math.max(0, paidAmount - refundAdminFee - refundTransferFee);
  return {paidAmount,eventDate:eventDate||'',requestDate,daysBefore,refundRuleKey:rule.key||'',refundRuleLabel:rule.label||'主辦手動確認',refundAdminFee,refundTransferFee,refundAmount,transferCreditAmount:0,nonRefundAmount:refundAdminFee+refundTransferFee,bookingPolicy:false};
}


function _bookingStartIso(slot){
  if(!slot||!slot.date_key)return null;const t=String(slot.start_text||'00:00').trim()||'00:00';
  const iso=`${slot.date_key}T${t.length===5?t+':00':t}+08:00`;const d=new Date(iso);return isNaN(d.getTime())?null:d.toISOString();
}
function _replaceDoingModuleSnapshot(reg, mutate){
  const rows=safeJson(reg&&reg.custom_fields_json,[]);const arr=Array.isArray(rows)?rows.slice():[];let hit=arr.find(x=>x&&x.key==='__doing_modules');
  if(!hit){hit={key:'__doing_modules',value:{}};arr.push(hit)} hit.value=(hit.value&&typeof hit.value==='object')?{...hit.value}:{};mutate(hit.value);return arr;
}
async function hRescheduleBooking(env,b){
  const T=b._tenantId,rows=await dbGet(env,'registrations',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(b.regId)}&select=*`);if(!rows.length)return jsonErr('找不到預約');
  const reg=rows[0],own=await verifiedRegOwnerGuard(env,reg,b,'改期的');if(own)return own;
  if(['已取消','不錄取'].includes(String(reg.review_status||''))||['已退費','已退款'].includes(String(reg.transfer_status||'')))return jsonErr('此預約已結束，不能改期');
  const sesRows=await dbGet(env,'sessions',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(reg.session_id)}&select=*`);if(!sesRows.length)return jsonErr('找不到預約場次');
  const ses=sesRows[0],unit=reg.operation_unit_id?await getOperationUnitRow(env,T,reg.operation_unit_id,reg.session_id):null,mods=normalizeSessionModules(unit?safeJson(unit.modules_json,{}):safeJson(ses.modules_json,{}));if(!mods.workshopSlots&&!String(mods.operatingMode||'').includes('booking'))return jsonErr('此報名不是時段預約型');
  const newId=String(b.timeslotId||'').trim();if(!newId)return jsonErr('請選擇新的預約時段');
  const unitFilter=unit?`&operation_unit_id=eq.${encodeURIComponent(unit.id)}`:'&operation_unit_id=is.null';
  const newRows=await dbGet(env,'timeslots',`tenant_id=eq.${T}&session_id=eq.${encodeURIComponent(reg.session_id)}${unitFilter}&id=eq.${encodeURIComponent(newId)}&status=eq.open&select=*`);if(!newRows.length)return jsonErr('新時段已不可預約或不屬於此營運項目');
  const oldIds=registrationTimeslotIds(reg);if(oldIds.includes(newId))return jsonErr('你選擇的就是目前時段');
  const oldRows=oldIds.length?await dbGet(env,'timeslots',`tenant_id=eq.${T}&id=in.(${oldIds.map(x=>encodeURIComponent(x)).join(',')})&select=*`).catch(()=>[]):[];
  const snap=selectedModuleSnapshot(reg),policy=(snap.bookingPolicy&&typeof snap.bookingPolicy==='object')?snap.bookingPolicy:mods.bookingPolicy;
  const oldStart=_bookingStartIso(oldRows[0]);if(oldStart){const hours=(new Date(oldStart).getTime()-Date.now())/3600000;if(hours<safeNum(policy.rescheduleBeforeHours))return jsonErr(`已超過可改期期限（需提前 ${safeNum(policy.rescheduleBeforeHours)} 小時）`)}
  const count=Math.max(0,Math.floor(safeNum(snap.rescheduleCount))),free=Math.max(0,Math.floor(safeNum(policy.freeRescheduleCount)));let extra=0;
  if(count>=free){if(policy.extraRescheduleMode==='reject')return jsonErr('此預約已達可改期次數上限');extra=safeNum(policy.extraRescheduleFee);if(policy.extraRescheduleMode==='new_deposit'&&!extra)extra=safeNum(snap.bookingDeposit)}
  const qty=Math.max(1,safeNum(reg.stall_count)||1),claim=await dbRpc(env,'claim_timeslot_capacity',{p_tenant_id:T,p_timeslot_id:newId,p_qty:qty}).catch(e=>({ok:false,error:e.message}));if(!claim||claim.ok===false)return jsonErr((claim&&claim.error)||'新時段名額不足');
  try{
    for(const id of oldIds)await dbRpc(env,'release_timeslot_capacity',{p_tenant_id:T,p_timeslot_id:id,p_qty:qty});
    const cf=_replaceDoingModuleSnapshot(reg,v=>{v.timeslotIds=[newId];v.rescheduleCount=count+1;v.lastRescheduledAt=nowIso();v.bookingPolicy=policy});
    const nextBalance=Math.max(0,safeNum(reg.transfer_balance_due)+extra);
    await dbUpdate(env,'registrations',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(reg.id)}`,{booking_calendar_id:newRows[0].booking_calendar_id||null,selected_dates_json:JSON.stringify([newRows[0].date_key]),custom_fields_json:JSON.stringify(cf),transfer_balance_due:nextBalance,admin_note:(String(reg.admin_note||'')+` [系統] 改期 ${count+1} 次：${oldIds.join(',')} → ${newId} ${nowTaipeiText()}`).trim()});
    await writeAuditLog(env,T,b.email||reg.email,'member','booking_reschedule','registrations',reg.id,{timeslotIds:oldIds,rescheduleCount:count},{timeslotIds:[newId],rescheduleCount:count+1,extraFee:extra,operationUnitId:reg.operation_unit_id||null}).catch(()=>{});
    await recordNotification(env,{tenantId:T,unitId:reg.operation_unit_id||null,sessionId:reg.session_id,registrationId:reg.id,email:reg.email,eventKey:'booking_rescheduled',title:'預約已改期',body:`新時段：${newRows[0].date_key} ${newRows[0].start_text||''}`,meta:{oldTimeslotIds:oldIds,newTimeslotId:newId,extraFee:extra}}).catch(()=>{});
    return jsonOk({ok:true,rescheduleCount:count+1,extraFee:extra,balanceDue:nextBalance,date:newRows[0].date_key,start:newRows[0].start_text,end:newRows[0].end_text});
  }catch(e){await dbRpc(env,'release_timeslot_capacity',{p_tenant_id:T,p_timeslot_id:newId,p_qty:qty}).catch(()=>{});for(const id of oldIds)await dbRpc(env,'claim_timeslot_capacity',{p_tenant_id:T,p_timeslot_id:id,p_qty:qty}).catch(()=>{});return jsonErr('改期未完成，原時段已保留：'+(e.message||'未知錯誤'))}
}

// getRefundSuggestion（後台開啟退費彈窗時，從 Worker 依資料庫規則帶出建議扣項）
async function hGetRefundSuggestion(env, b) {
  const TENANT=(b&&b._tenantId);
  if(!await verifyStaff(env,b.email,b.token,TENANT,'finance')) return jsonErr('無權限');
  const rows=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  if(!rows.length) return jsonErr('找不到報名');
  const group=await getBundleGroupRegs(env,TENANT,rows[0]);
  const targets=group.filter(g=>(isPaidStatus(g.payment_status)||safeNum(g.paid_amount)>0)&&!['已退費','refunded'].includes(String(g.transfer_status||'')));
  if(!targets.length) return jsonErr('此報名尚未完成付款或已完成退費');
  const details=[];
  for(const g of targets) details.push({reg:g,...await calcRefundSuggestion(env,TENANT,g)});
  const paidAmount=details.reduce((n,x)=>n+x.paidAmount,0);
  const refundAdminFee=details.reduce((n,x)=>n+x.refundAdminFee,0);
  const refundTransferFee=details.reduce((n,x)=>n+x.refundTransferFee,0);
  const refundAmount=details.reduce((n,x)=>n+safeNum(x.refundAmount),0),transferCreditAmount=details.reduce((n,x)=>n+safeNum(x.transferCreditAmount),0),nonRefundAmount=details.reduce((n,x)=>n+safeNum(x.nonRefundAmount),0);
  return jsonOk({success:true,bundleCount:group.length,paidAmount,refundAdminFee,refundTransferFee,refundAmount,transferCreditAmount,nonRefundAmount,eventDate:targets.length>1?'組合共 '+targets.length+' 場（依各場日期計算）':details[0].eventDate,daysBefore:targets.length>1?null:details[0].daysBefore,refundRuleLabel:targets.length>1?'組合場次已依各場退款規則加總':details[0].refundRuleLabel,details:details.map(x=>({regId:x.reg.id,sessionId:x.reg.session_id,paidAmount:x.paidAmount,refundAdminFee:x.refundAdminFee,refundTransferFee:x.refundTransferFee,refundAmount:x.refundAmount,eventDate:x.eventDate,daysBefore:x.daysBefore,refundRuleLabel:x.refundRuleLabel,transferCreditAmount:safeNum(x.transferCreditAmount),nonRefundAmount:safeNum(x.nonRefundAmount),hoursBefore:x.hoursBefore??null,bookingPolicy:!!x.bookingPolicy}))});
}
// applyRefund（攤友申請退費）
async function hApplyRefund(env, b) {
  const TENANT=(b&&b._tenantId);
  const rows=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  if(!rows.length)return jsonErr('找不到報名');
  const reg=rows[0],own=await verifiedRegOwnerGuard(env,reg,b,'申請退款的');if(own)return own;
  if(['已退費','refunded'].includes(String(reg.transfer_status||'')))return jsonErr('此報名已完成退費');

  const group=await getBundleGroupRegs(env,TENANT,reg);
  if(!group.some(g=>isPaidStatus(g.payment_status)||safeNum(g.paid_amount)>0))return jsonErr('尚未確認付款，不能申請退款');

  const states=[];
  try{
    for(const g of group){
      if(['已退費','refunded'].includes(String(g.transfer_status||'')))continue;
      const state=await captureRefundResourceState(env,TENANT,g);
      states.push(state);

      await releaseRefundResourcesStrict(env,TENANT,state,'退款申請釋放位置／時段失敗');
      if(state.active){
        await adjustRegistrationCapacity(env,TENANT,g,-state.qty);
        state.countAdjusted=true;
      }

      await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(g.id)}`,{
        transfer_status:'退費中',transfer_chosen_at:nowIso(),
        stall_number:null,seat_choice_status:'released',seat_choice_type:null,seat_hold_expires_at:null
      });
    }
  }catch(e){
    // 已處理的整組全部回復：報名狀態、名額、位置、時段一起回復。
    for(const state of states.slice().reverse()){
      const g=state.reg;
      await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(g.id)}`,{
        transfer_status:g.transfer_status||null,transfer_chosen_at:g.transfer_chosen_at||null,
        stall_number:g.stall_number||null,seat_choice_status:g.seat_choice_status||null,
        seat_choice_type:g.seat_choice_type||null,seat_hold_expires_at:g.seat_hold_expires_at||null
      }).catch(()=>{});
      if(state.countAdjusted)await adjustRegistrationCapacity(env,TENANT,g,state.qty).catch(()=>{});
      await restoreRefundResourceState(env,TENANT,state).catch(()=>{});
    }
    return jsonErr('退款申請沒有完成，系統已回復整組資料：'+(e&&e.message?e.message:'未知錯誤'));
  }

  for(const state of states){
    const g=state.reg;
    await writeAuditLog(env,TENANT,b.email||g.email,'member','refund_requested_release_capacity_and_stall','registrations',g.id,
      {transfer_status:g.transfer_status},{transfer_status:'退費中'},
      {capacity_delta:state.active?-state.qty:0,bundle_group:group.length>1,stall_release:true}
    ).catch(()=>{});
  }
  try{
    const sesName=await getSessionName(env,reg.session_id,TENANT),tc=await getTenantCtx(env,TENANT);
    await mailRefundRequestReceived(env,reg.email,getDisplayName(reg.name,reg.brand_name||'',await getSessionType(env,reg.session_id,TENANT)),sesName,tc);
  }catch(e){}
  for(const state of states)await recordNotification(env,{tenantId:TENANT,unitId:state.reg.operation_unit_id||null,sessionId:state.reg.session_id,registrationId:state.reg.id,email:state.reg.email,eventKey:'refund_requested',title:'退款申請已送出',body:'主辦已收到您的退款申請。',meta:{}}).catch(()=>{});
  for(const sid of [...new Set(group.map(x=>x.session_id).filter(Boolean))])await refreshSessionStatsSafe(env,TENANT,sid);
  return jsonOk({success:true,bundleCount:group.length});
}
// confirmRefund（後台確認退款）
async function hConfirmRefund(env, b) {
  const TENANT=(b&&b._tenantId);
  if(!await verifyStaff(env,b.email,b.token,TENANT,'finance'))return jsonErr('無權限');
  const rows=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  if(!rows.length)return jsonErr('找不到報名');

  const group=await getBundleGroupRegs(env,TENANT,rows[0]);
  const targets=group.filter(g=>!['已退費','refunded'].includes(String(g.transfer_status||''))&&(isCapacityInactiveTransferStatus(g.transfer_status)||isPaidStatus(g.payment_status)||safeNum(g.paid_amount)>0));
  if(!targets.length)return jsonErr('此報名已完成退費或沒有可處理資料');

  const suggestions=[];for(const g of targets)suggestions.push({reg:g,...await calcRefundSuggestion(env,TENANT,g)});
  const reservedTransferCredit=suggestions.reduce((n,x)=>n+safeNum(x.transferCreditAmount),0);
  if(reservedTransferCredit>0 && String(b.forceCashRefund||'')!=='true')return jsonErr(`此預約依原取消規則有 NT$${Math.round(reservedTransferCredit)} 可轉下次使用。請先使用「改期／轉場」保留原付款；若確定改為現金退款，請明確選擇現金退款處理。`);
  const paidTotal=suggestions.reduce((n,x)=>n+x.paidAmount,0);
  const suggestedAdmin=suggestions.reduce((n,x)=>n+x.refundAdminFee,0);
  const suggestedTransfer=suggestions.reduce((n,x)=>n+x.refundTransferFee,0);
  const adminTotal=(b.refundAdminFee!==undefined||b.refund_admin_fee!==undefined)?safeNum(b.refundAdminFee??b.refund_admin_fee):suggestedAdmin;
  const transferTotal=(b.refundTransferFee!==undefined||b.refund_transfer_fee!==undefined)?safeNum(b.refundTransferFee??b.refund_transfer_fee):suggestedTransfer;
  if(adminTotal<0||transferTotal<0)return jsonErr('退費扣項不可小於 0');
  if(adminTotal+transferTotal>paidTotal)return jsonErr('行政費與轉帳手續費不可大於已繳金額');

  function allocate(total){let used=0;return suggestions.map((x,i)=>{if(i===suggestions.length-1)return Math.max(0,total-used);const v=paidTotal>0?Math.floor(total*x.paidAmount/paidTotal):0;used+=v;return v;});}
  const adminAlloc=allocate(adminTotal),transferAlloc=allocate(transferTotal);

  const applied=[],createdAllocIds=[],createdLedgerIds=[],directReleaseStates=[];
  let refundTotal=0;
  try{
    for(let i=0;i<suggestions.length;i++){
      const x=suggestions[i],g=x.reg;
      const forceCash=String(b.forceCashRefund||'')==='true';
      const refundAmount=x.bookingPolicy?Math.max(0,Math.min(x.paidAmount,safeNum(x.refundAmount)+(forceCash?safeNum(x.transferCreditAmount):0))):Math.max(0,x.paidAmount-adminAlloc[i]-transferAlloc[i]);
      refundTotal+=refundAmount;
      const ruleLabel=String(b.refundRuleLabel||b.refund_rule_label||x.refundRuleLabel||'主辦手動確認').slice(0,120);

      // 若主辦直接從已付款狀態確認退款，先用可回復方式釋放資源。
      if(!isCapacityInactiveTransferStatus(g.transfer_status)){
        const state=await captureRefundResourceState(env,TENANT,g);
        directReleaseStates.push(state);
        await releaseRefundResourcesStrict(env,TENANT,state,'退款確認釋放位置／時段失敗');
        if(state.active){
          await adjustRegistrationCapacity(env,TENANT,g,-state.qty);
          state.countAdjusted=true;
        }
      }

      const upd={
        transfer_status:'已退費',payment_status:'已退費',
        refund_amount:refundAmount,refund_admin_fee:adminAlloc[i],refund_transfer_fee:transferAlloc[i],
        refund_rule_label:ruleLabel,refunded_at:nowIso(),refund_note:String(b.refundNote||'').slice(0,500),
        stall_number:null,seat_choice_status:'released',seat_choice_type:null,seat_hold_expires_at:null
      };
      await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(g.id)}`,upd);
      applied.push({g,upd});

      let refundPaymentId=null;
      const paidRows=await dbGet(env,'payments',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(g.id)}&status=eq.%E5%B7%B2%E7%A2%BA%E8%AA%8D&select=id&order=paid_at.desc&limit=1`).catch(()=>[]);
      if(paidRows[0])refundPaymentId=paidRows[0].id;

      if(refundAmount>0){
        const palId=genId('PAL');
        await dbInsert(env,'payment_allocations',{id:palId,tenant_id:TENANT,payment_id:refundPaymentId,registration_id:g.id,session_id:g.session_id,operation_unit_id:g.operation_unit_id||null,allocation_type:'refund',amount:refundAmount,created_at:nowIso()});
        createdAllocIds.push(palId);
        const ledId=await writeFinanceLedger(env,TENANT,{registrationId:g.id,sessionId:g.session_id,paymentId:refundPaymentId,entryType:'refund_principal',amount:refundAmount,direction:'debit',memo:'完成退款',strict:true,meta:{paidAmount:x.paidAmount,adminFee:adminAlloc[i],transferFee:transferAlloc[i]}});
        if(ledId)createdLedgerIds.push(ledId);
      }
    }
  }catch(e){
    // 回復本次金流與報名狀態
    for(const id of createdLedgerIds)await dbDelete(env,'finance_ledger',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(id)}`).catch(()=>{});
    for(const id of createdAllocIds)await dbDelete(env,'payment_allocations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(id)}`).catch(()=>{});
    for(const x of applied.slice().reverse()){
      const g=x.g;
      await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(g.id)}`,{
        transfer_status:g.transfer_status||null,payment_status:g.payment_status||'',
        refund_amount:safeNum(g.refund_amount),refund_admin_fee:safeNum(g.refund_admin_fee),
        refund_transfer_fee:safeNum(g.refund_transfer_fee),refund_rule_label:g.refund_rule_label||'',
        refunded_at:g.refunded_at||null,refund_note:g.refund_note||'',
        stall_number:g.stall_number||null,seat_choice_status:g.seat_choice_status||null,
        seat_choice_type:g.seat_choice_type||null,seat_hold_expires_at:g.seat_hold_expires_at||null
      }).catch(()=>{});
    }
    for(const state of directReleaseStates.slice().reverse()){
      if(state.countAdjusted)await adjustRegistrationCapacity(env,TENANT,state.reg,state.qty).catch(()=>{});
      await restoreRefundResourceState(env,TENANT,state).catch(()=>{});
    }
    return jsonErr('退款確認沒有完成，系統已回復本次整組資料：'+(e&&e.message?e.message:'未知錯誤'));
  }

  // 非核心副作用（稽核、Email、統計）不阻塞退款成功。
  for(let i=0;i<suggestions.length;i++){
    const x=suggestions[i],g=x.reg,refundAmount=Math.max(0,x.paidAmount-adminAlloc[i]-transferAlloc[i]);
    await writeAuditLog(env,TENANT,b.email||'','finance_admin','refund_confirmed_release_capacity_and_stall','registrations',g.id,
      {transfer_status:g.transfer_status},{transfer_status:'已退費',refund_amount:refundAmount},
      {bundle_group:targets.length>1,refund_amount:refundAmount}
    ).catch(()=>{});
    try{
      const sesName=await getSessionName(env,g.session_id,TENANT),tc=await getTenantCtx(env,TENANT);
      await mailRefundConfirm(env,g.email,getDisplayName(g.name,g.brand_name||'',await getSessionType(env,g.session_id,TENANT)),sesName,tc,refundAmount);
    }catch(e){}
  }
  for(const sid of [...new Set(targets.map(x=>x.session_id).filter(Boolean))])await refreshSessionStatsSafe(env,TENANT,sid);

  return jsonOk({
    success:true,bundleCount:targets.length,paidAmount:paidTotal,refundAmount:refundTotal,
    refundAdminFee:adminTotal,refundTransferFee:transferTotal,
    refundRuleLabel:targets.length>1?'組合場次整組完成退費':'退費完成'
  });
}
// ── SECTION 12-FM: 不可抗力取消／延期／退款模組 ─────────────────

// 1. previewForceCancelSession（GET：預覽不可抗力影響人數，不寫入資料）
async function hPreviewForceCancelSession(env, p) {
  const TENANT = (p && p._tenantId) ;
  if (!await verifyStaff(env, p.email, p.token, TENANT)) return jsonErr('無權限');
  const sesId = p.sessionId || p.session_id;
  if (!sesId) return jsonErr('請提供 sessionId');
  const sesRows = await dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(sesId)}&select=*`);
  if (!sesRows.length) return jsonErr('找不到場次');
  const ses = sesRows[0];
  if (ses.force_cancel) return jsonErr('此場次已啟動不可抗力處理，不可重複啟動');
  const forceMode = p.forceMode || p.force_mode || '';
  if (!['transfer_or_refund','refund_only'].includes(forceMode)) return jsonErr('請選擇處理模式（transfer_or_refund 或 refund_only）');
  const regs = await dbGet(env, 'registrations',
    `tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sesId)}&select=review_status,payment_status,transfer_status`);
  const tier1 = [], tier2 = [], tier3 = [];
  for (const r of regs) {
    const layer = classifyForceLayer(r);
    if (layer === 1) tier1.push(r);
    else if (layer === 2) tier2.push(r);
    else tier3.push(r);
  }
  return jsonOk({
    ok: true,
    sessionId: sesId,
    sessionName: ses.name || sesId,
    forceMode,
    eligible_count: tier1.length,    // 第一層：可選延期或退費
    notice_only_count: tier2.length, // 第二層：只通知
    skip_count: tier3.length,        // 第三層：不進入流程
    total: regs.length,
    breakdown: {
      tier1_labels: tier1.map(r=>({review_status:r.review_status,payment_status:r.payment_status})),
      tier2_labels: tier2.map(r=>({review_status:r.review_status,payment_status:r.payment_status})),
    },
  });
}

// 2. forceCancelSession（POST：正式啟動不可抗力處理）
async function hForceCancelSession(env, b) {
  const TENANT = (b && b._tenantId) ;
  if (!await verifyStaff(env, b.email, b.token, TENANT, 'sessions')) return jsonErr('無權限');
  const sesId = b.sessionId || b.session_id;
  if (!sesId) return jsonErr('請提供 sessionId');
  const reasonCode = b.reasonCode || b.reason_code || '';
  const reasonLabel = FORCE_REASON_CODES[reasonCode] || reasonCode || '不可抗力因素';
  const forceMode = b.forceMode || b.force_mode || '';
  if (!['transfer_or_refund','refund_only'].includes(forceMode)) return jsonErr('請選擇正確的處理模式');
  if (forceMode === 'transfer_or_refund' && !(b.transferTargetSessionId||b.transfer_target_session_id)) return jsonErr('提供延期場次模式必須指定目標場次 ID');
  if (forceMode === 'refund_only' && (b.transferTargetSessionId||b.transfer_target_session_id)) return jsonErr('無延期模式不可指定延期目標場次');
  const targetSesId = (forceMode === 'transfer_or_refund') ? (b.transferTargetSessionId||b.transfer_target_session_id) : null;

  const sesRows = await dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(sesId)}&select=*`);
  if (!sesRows.length) return jsonErr('找不到場次');
  const ses = sesRows[0];
  if (ses.force_cancel) return jsonErr('此場次已啟動不可抗力處理，不可重複啟動');
  let targetSesName = '';
  if (targetSesId) {
    const tgtRows = await dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(targetSesId)}&select=id,name`);
    if (!tgtRows.length) return jsonErr('找不到延期目標場次');
    targetSesName = tgtRows[0].name || '';
  }

  const now = new Date();
  // 選擇期限採用主辦設定（1～168 小時），未填則用系統預設
  let _hrs = Number(b.choiceHours || b.choice_hours);
  if (!Number.isFinite(_hrs) || _hrs <= 0) _hrs = FORCE_CHOICE_HOURS;
  _hrs = Math.min(168, Math.max(1, Math.round(_hrs)));
  const deadline = new Date(now.getTime() + _hrs * 60 * 60 * 1000);
  const deadlineText = deadline.toLocaleString('zh-TW', {timeZone:'Asia/Taipei', hour12:false});
  const _note = String(b.note || '').trim();

  await dbUpdate(env, 'sessions', `id=eq.${encodeURIComponent(sesId)}&tenant_id=eq.${TENANT}`, {
    force_cancel: true,
    force_cancel_target_id: targetSesId || null,
    force_cancel_deadline: deadline.toISOString(),
    status: '關閉',
    updated_at: now.toISOString(),
  });

  const regs = await dbGet(env, 'registrations',
    `tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sesId)}&select=*`);
  const tc = await getTenantCtx(env, TENANT);
  let notified = 0, tier1cnt = 0, tier2cnt = 0, skipped = 0, refundMarked = 0;

  for (const r of regs) {
    const layer = classifyForceLayer(r);
    if (layer === 1) tier1cnt++;
    else if (layer === 2) tier2cnt++;
    else { skipped++; continue; }

    if (forceMode === 'refund_only' && layer === 1) {
      await dbUpdate(env, 'registrations', `id=eq.${encodeURIComponent(r.id)}&tenant_id=eq.${TENANT}`, {
        transfer_status: '申請退費',
        transfer_chosen_at: now.toISOString(),
      }).catch(()=>{});
      refundMarked++;
    }

    if (r.email) {
      try {
        const dn = getDisplayName(r.name, r.brand_name||'');
        await mailForceCancelNotice(env, r.email, dn, ses.name||sesId, tc,
          {targetSesName, deadlineText, reasonLabel, note:_note});
        notified++;
      } catch(e) { console.error('mailForceCancelNotice failed', r.email, e&&e.message); logError(env, {source:'hForceCancelSession', message:'mailForceCancelNotice failed', error:e&&e.message}); }
    }
  }

  return jsonOk({
    success: true, sessionId: sesId, reasonCode, reasonLabel, forceMode, targetSesId,
    notified, tier1: tier1cnt, tier2: tier2cnt, skipped, refundMarked,
    forceChoiceDeadline: deadline.toISOString(), choiceHours: _hrs, deadlineText,
  });
}

// 3. agreeForceTransfer（POST：攤友同意延期 — 不可抗力專用）

function transferTargetDates(reg,targetSession){
  const old=safeJson(reg&&reg.selected_dates_json,[]),oldCount=Math.max(1,Array.isArray(old)?old.length:1);
  const target=_sessionDateRows(targetSession&&targetSession.dates_json);
  if(!target.length)return [];
  return target.slice(0,Math.min(oldCount,target.length)).map(x=>x.date);
}
function selectedModuleSnapshot(reg){
  const rows=safeJson(reg&&reg.custom_fields_json,[]);
  const hit=(Array.isArray(rows)?rows:[]).find(x=>x&&x.key==='__doing_modules');
  return hit&&hit.value&&typeof hit.value==='object'?hit.value:{};
}
function calcTransferModuleExtra(reg,targetSession){
  const mods=normalizeSessionModules(safeJson(targetSession&&targetSession.modules_json,{}));
  const snap=selectedModuleSnapshot(reg);let total=0;
  if(mods.workshopSlots)throw new Error('目標場次需要重新選時段，請由主辦人工安排，不能自動轉移');
  if(mods.service&&snap.service){const x=moduleItemById(mods.services,snap.service.id);if(!x)throw new Error('目標場次沒有原服務項目');total+=safeNum(x.price)}
  if(mods.resource&&snap.resource){const x=moduleItemById(mods.resources,snap.resource.id);if(!x)throw new Error('目標場次沒有原指定資源');total+=safeNum(x.price)}
  if(mods.participants&&snap.participants){
    for(const [id,old] of Object.entries(snap.participants||{})){const x=moduleItemById(mods.participantTypes,id);if(!x)throw new Error('目標場次票種設定不同');total+=Math.max(0,parseInt(old.qty,10)||0)*safeNum(x.price)}
  }
  return total;
}
function calcTransferAddonTotal(reg,targetSession){
  const defs=safeJson(targetSession&&targetSession.addons_json,[]),qty=safeJson(reg&&reg.addon_qty_json,{});
  let total=0;
  for(const [k,v] of Object.entries(qty||{})){
    const n=Math.max(0,Number(v&&typeof v==='object'?(v.qty||v.count||v.quantity||0):v)||0);if(!n)continue;
    let def=/^\d+$/.test(k)?defs[Number(k)]||null:null;if(!def)def=defs.find(x=>String(x.id||x.name||'')===String(k));
    if(!def)throw new Error('目標場次缺少原報名的加購項目');
    total+=n*safeNum(def.price);
  } return total;
}
async function buildTransferFinance(env,T,reg,targetSession){
  const dates=transferTargetDates(reg,targetSession);
  if(!dates.length)throw new Error('目標場次沒有可用日期');
  // 延期是「原報名搬到新場」，不是重新購買；金額與已收款延續原報名，不因目標場次設定重算。
  const total=Math.max(0,safeNum(reg.total_amount)||safeNum(reg.amount));
  const sourcePaid=Math.max(0,safeNum(reg.paid_amount));
  return {
    selectedDates:dates,
    total,
    sourcePaid,
    creditApplied:Math.min(sourcePaid,total),
    balanceDue:Math.max(0,total-sourcePaid),
    refundDue:0
  };
}
async function cloneRegistrationItemsForTransfer(env,T,sourceRegId,targetRegId){
  const rows=await dbGet(env,'registration_items',`tenant_id=eq.${T}&registration_id=eq.${encodeURIComponent(sourceRegId)}&select=*`).catch(()=>[]);
  for(const src of rows){
    const row={...src,id:genId('ITEM'),tenant_id:T,registration_id:targetRegId};
    delete row.created_at; delete row.updated_at;
    row.created_at=nowIso();
    await dbInsert(env,'registration_items',row);
  }
  return rows;
}
async function sourceConfirmedPaymentForTransfer(env,T,regId){
  const rows=await dbGet(env,'payments',`tenant_id=eq.${T}&registration_id=eq.${encodeURIComponent(regId)}&status=eq.%E5%B7%B2%E7%A2%BA%E8%AA%8D&select=*&order=paid_at.desc&limit=1`).catch(()=>[]);
  return rows[0]||null;
}


async function hAgreeForceTransfer(env,b){
  const TENANT=b&&b._tenantId;if(!b.regId)return jsonErr('請提供報名編號');
  const rows=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);if(!rows.length)return jsonErr('找不到報名');
  const reg=rows[0],own=await verifiedRegOwnerGuard(env,reg,b,'延期的');if(own)return own;
  const sesRows=await dbGet(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(reg.session_id)}&select=*`);if(!sesRows.length)return jsonErr('找不到原場次');
  const ses=sesRows[0],targetSesId=ses.force_cancel_target_id;
  if(!ses.force_cancel)return jsonErr('此場次尚未啟動不可抗力處理');
  if(!targetSesId)return jsonErr('未設定延期目標場次');
  if(ses.force_cancel_deadline&&new Date()>new Date(ses.force_cancel_deadline))return jsonErr('選擇期限已過');
  if(String(reg.transfer_status||'')==='已延期')return jsonErr('此報名已完成延期');
  if(['申請退費','退費中','已退費','refunded'].includes(String(reg.transfer_status||'')))return jsonErr('此報名已進入退費流程，不能延期');

  const tgtRows=await dbGet(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(targetSesId)}&select=*`);if(!tgtRows.length)return jsonErr('找不到延期目標場次');
  const tgt=tgtRows[0],stallCount=Math.max(1,safeNum(reg.stall_count)||1);
  let tf;try{tf=await buildTransferFinance(env,TENANT,reg,tgt)}catch(e){return jsonErr(e&&e.message?e.message:'目標場次無法承接原報名')}

  const claim=await dbRpc(env,'claim_session_slot',{p_tenant_id:TENANT,p_session_id:targetSesId,p_stall_count:stallCount});
  if(!claim||claim.ok===false)return jsonErr(claim?(claim.error||'目標場次名額不足'):'名額鎖定失敗');

  const now=nowIso(),newRegId=genId('REG'),settlementId=genId('TRS');
  const sourceState=await captureRefundResourceState(env,TENANT,reg);
  const sourcePayment=await sourceConfirmedPaymentForTransfer(env,TENANT,reg.id);
  let sourceMarked=false;

  try{
    // 已有實收時沿用「原付款快照」，不能因延期偷偷換收款帳戶；未付款才使用目標場次當下收款設定。
    let snap=_paymentSnapshotFromReg(reg);
    if(!snap){
      const prof=await _resolvePaymentProfileForSession(env,TENANT,tgt);
      snap=_paymentSnapshotFromProfile(prof);
    }

    const newReg={
      id:newRegId,tenant_id:TENANT,
      bundle_id:reg.bundle_id||'',bundle_group_id:reg.bundle_group_id||'',
      session_id:targetSesId,event_id:cleanEventId(tgt.event_id),
      email:reg.email,platform_member_id:reg.platform_member_id||null,name:reg.name,phone:reg.phone||'',
      brand_name:reg.brand_name||'',brand_intro:reg.brand_intro||'',
      sell_category:reg.sell_category||'',sell_items:reg.sell_items||'',sell_link:reg.sell_link||'',
      photo_url:reg.photo_url||'',fb_url:reg.fb_url||'',ig_url:reg.ig_url||'',
      equipment_json:reg.equipment_json||{},custom_fields_json:reg.custom_fields_json||[],participants_json:reg.participants_json||{},
      stall_count:stallCount,deposit:safeNum(reg.deposit),review_status:reg.review_status||'已錄取',
      payment_status:reg.payment_status||((tf.total===0)?'免費':(tf.balanceDue<=0?'已繳費':'未繳費')),
      payment_method:reg.payment_method||'',payment_last5:reg.payment_last5||null,payment_reported_at:reg.payment_reported_at||null,
      payment_report_amount:safeNum(reg.payment_report_amount),paid_at:reg.paid_at||null,
      amount:tf.total,total_amount:tf.total,paid_amount:tf.sourcePaid,
      transfer_credit_amount:tf.creditApplied,transfer_balance_due:tf.balanceDue,transfer_refund_due:0,transfer_settlement_id:settlementId,
      addon_qty_json:reg.addon_qty_json||{},addon_amount:safeNum(reg.addon_amount),selected_dates_json:tf.selectedDates,
      tax_id:reg.tax_id||'',invoice_title:reg.invoice_title||'',invoice_type:reg.invoice_type||'',invoice_email:reg.invoice_email||'',invoice_carrier:reg.invoice_carrier||'',
      invoice_status:reg.invoice_status||'',checkin_status:'未報到',clear_status:'未清場',deposit_refunded:reg.deposit_refunded||'未退押金',
      stall_number:'',seat_choice_intent:reg.seat_choice_intent||'auto',seat_choice_status:'pending',seat_choice_type:null,seat_hold_expires_at:null,
      agreement_accepted:reg.agreement_accepted===true,agreement_viewed:reg.agreement_viewed===true,
      original_session_id:reg.session_id,transferred_from_registration_id:reg.id,created_at:now,
      ..._paymentSnapshotDbPayload(snap),
      ...(tf.balanceDue>0?paymentDeadlinePayload(tgt,now,tf.balanceDue):{})
    };

    await dbInsert(env,'registrations',newReg);
    await cloneRegistrationItemsForTransfer(env,TENANT,reg.id,newRegId);

    await dbInsert(env,'transfer_settlements',{
      id:settlementId,tenant_id:TENANT,
      source_registration_id:reg.id,source_session_id:reg.session_id,
      target_registration_id:newRegId,target_session_id:targetSesId,
      source_paid_amount:tf.sourcePaid,target_total_amount:tf.total,
      credit_applied:tf.creditApplied,balance_due:tf.balanceDue,
      refund_due:0,refund_paid:0,status:tf.balanceDue>0?'balance_due':'settled',
      created_at:now,settled_at:tf.balanceDue<=0?now:null
    });

    if(tf.creditApplied>0){
      await dbInsert(env,'payment_allocations',{
        id:genId('PAL'),tenant_id:TENANT,payment_id:sourcePayment?sourcePayment.id:null,
        registration_id:newRegId,session_id:targetSesId,
        allocation_type:'transfer_credit',amount:tf.creditApplied,created_at:now
      });
      await writeFinanceLedger(env,TENANT,{registrationId:reg.id,sessionId:reg.session_id,paymentId:sourcePayment?sourcePayment.id:null,settlementId,entryType:'transfer_credit_out',amount:tf.creditApplied,direction:'debit',memo:'延期轉出既有實收',strict:true});
      await writeFinanceLedger(env,TENANT,{registrationId:newRegId,sessionId:targetSesId,paymentId:sourcePayment?sourcePayment.id:null,settlementId,entryType:'transfer_credit_in',amount:tf.creditApplied,direction:'credit',memo:'延期轉入既有實收',strict:true});
    }

    // 舊場釋放：位置與時段不能搬到新場；新場保留原本「選位意願」，重新配置實際位置。
    await releaseRefundResourcesStrict(env,TENANT,sourceState,'延期釋放原場位置／時段失敗');
    if(sourceState.active){
      await adjustRegistrationCapacity(env,TENANT,reg,-stallCount);
      sourceState.countAdjusted=true;
    }

    // 最後才把原報名標記為已延期；前面任何一步失敗都能完整回復。
    await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(reg.id)}&tenant_id=eq.${TENANT}`,{
      transfer_status:'已延期',transfer_target_session_id:targetSesId,transfer_chosen_at:now,
      admin_note:(String(reg.admin_note||'')+' [系統] 延期至 '+(tgt.name||targetSesId)+' '+nowTaipeiText()).trim()
    });
    sourceMarked=true;

    await writeAuditLog(env,TENANT,b.email||reg.email,'member','force_transfer_complete','registrations',reg.id,
      {session_id:reg.session_id,paid_amount:safeNum(reg.paid_amount),payment_status:reg.payment_status},
      {target_registration_id:newRegId,target_session_id:targetSesId,paid_amount:tf.sourcePaid,payment_status:newReg.payment_status},
      {source_payment_id:sourcePayment?sourcePayment.id:null,items_cloned:true,seat_reassign_required:true}
    ).catch(()=>{});

    await refreshSessionStatsSafe(env,TENANT,reg.session_id);
    await refreshSessionStatsSafe(env,TENANT,targetSesId);
  }catch(e){
    // 任何一步失敗：先回復原報名，再刪除本次新場資料與歸還新場名額。
    if(sourceMarked){
      await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(reg.id)}`,{
        transfer_status:reg.transfer_status||null,transfer_target_session_id:reg.transfer_target_session_id||null,
        transfer_chosen_at:reg.transfer_chosen_at||null,admin_note:reg.admin_note||''
      }).catch(()=>{});
    }
    if(sourceState.countAdjusted)await adjustRegistrationCapacity(env,TENANT,reg,stallCount).catch(()=>{});
    await restoreRefundResourceState(env,TENANT,sourceState).catch(()=>{});

    await dbDelete(env,'payment_allocations',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(newRegId)}&allocation_type=eq.transfer_credit`).catch(()=>{});
    await dbDelete(env,'finance_ledger',`tenant_id=eq.${TENANT}&settlement_id=eq.${encodeURIComponent(settlementId)}`).catch(()=>{});
    await dbDelete(env,'registration_items',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(newRegId)}`).catch(()=>{});
    await dbDelete(env,'transfer_settlements',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(settlementId)}`).catch(()=>{});
    await dbDelete(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(newRegId)}`).catch(()=>{});
    await dbRpc(env,'release_session_slot',{p_tenant_id:TENANT,p_session_id:targetSesId,p_stall_count:stallCount}).catch(()=>{});
    return jsonErr('延期資料建立失敗，系統已回復原報名：'+(e&&e.message?e.message:'未知錯誤'));
  }

  return jsonOk({
    success:true,newRegId,transferredTo:targetSesId,
    sourcePaid:tf.sourcePaid,targetTotal:tf.total,creditApplied:tf.creditApplied,
    balanceDue:tf.balanceDue,refundDue:0,settlementId,
    dataTransferred:true,seatReassignRequired:true
  });
}


// 4. applyForceRefundFM（POST：攤友選擇申請退費 — 不可抗力專用）
async function hApplyForceRefundFM(env,b){
  const TENANT=b&&b._tenantId;if(!b.regId)return jsonErr('請提供報名編號');
  const rows=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);if(!rows.length)return jsonErr('找不到報名');
  const reg=rows[0],own=await verifiedRegOwnerGuard(env,reg,b,'申請不可抗力退費的');if(own)return own;
  const sr=await dbGet(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(reg.session_id)}&select=*`),ses=sr[0]||{};
  if(!ses.force_cancel)return jsonErr('此場次尚未啟動不可抗力處理');if(ses.force_cancel_deadline&&new Date()>new Date(ses.force_cancel_deadline))return jsonErr('選擇期限已過');
  if(String(reg.transfer_status||'')==='已延期')return jsonErr('此報名已完成延期，不能申請退費');
  if(['申請退費','退費中'].includes(String(reg.transfer_status||'')))return jsonOk({success:true,alreadyRequested:true});
  const active=isActiveForCapacity(reg);
  await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(reg.id)}&tenant_id=eq.${TENANT}`,{transfer_status:'申請退費',transfer_chosen_at:nowIso(),stall_number:null,seat_choice_status:'released',seat_choice_type:null,seat_hold_expires_at:null});
  if(active)await adjustRegistrationCapacity(env,TENANT,reg,-(safeNum(reg.stall_count)||1)).catch(()=>{});
  await releaseRegistrationSeats(env,TENANT,reg,'force_refund');await releaseRegistrationTimeslots(env,TENANT,reg);await refreshSessionStatsSafe(env,TENANT,reg.session_id);
  return jsonOk({success:true,forceStatus:'refund_requested',transferStatus:'申請退費'});
}

// 5. runForceChoiceDeadline（POST：系統排程或手動執行 48 小時逾期處理）
async function hRunForceChoiceDeadline(env, b) {
  const TENANT = (b && b._tenantId) ;
  if (b.email && b.token) { if (!await verifyStaff(env, b.email, b.token, TENANT)) return jsonErr('無權限'); }
  const now = new Date();
  let sesQs = `force_cancel=eq.true&select=id,tenant_id,name,force_cancel_deadline`;
  if (TENANT) sesQs = `tenant_id=eq.${TENANT}&` + sesQs;
  const sessions = await dbGet(env, 'sessions', sesQs).catch(()=>[]);
  let processed = 0;
  for (const ses of sessions) {
    if (!ses.force_cancel_deadline) continue;
    if (now < new Date(ses.force_cancel_deadline)) continue;
    const regs = await dbGet(env, 'registrations', `tenant_id=eq.${ses.tenant_id}&session_id=eq.${encodeURIComponent(ses.id)}&review_status=eq.%E5%B7%B2%E9%8C%84%E5%8F%96&select=*`).catch(()=>[]);
    for (const r of regs) {
      if (String(r.transfer_status||'')) continue;
      const nowStr = now.toISOString();
      await dbUpdate(env, 'registrations', `id=eq.${encodeURIComponent(r.id)}&tenant_id=eq.${r.tenant_id}`, { transfer_status: '申請退費', transfer_chosen_at: nowStr });
      try { const tc = await getTenantCtx(env, r.tenant_id); const dn = getDisplayName(r.name, r.brand_name||''); await mailForceCancelNotice(env, r.email, dn, ses.name||r.session_id, tc); } catch(e) {}
      processed++;
    }
  }
  return jsonOk({ success:true, processed });
}

// 6. confirmForceRefund（POST：後台確認不可抗力退款完成）
async function hConfirmForceRefund(env,b){
  const TENANT=b&&b._tenantId;if(!await verifyStaff(env,b.email,b.token,TENANT,'finance'))return jsonErr('無權限');
  const rows=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=transfer_status`);if(!rows.length)return jsonErr('找不到報名');
  if(!['申請退費','退費中'].includes(String(rows[0].transfer_status||'')))return jsonErr('此報名不在可退款狀態');
  return hConfirmRefund(env,b);
}

// ── SECTION 13: ECPay / LINE Pay 回調 ───────────────────────────

// ECPay 付款回調（POST form）
// LINE Pay confirm redirect（GET）
// ── SECTION 14: Cron 定時任務 ───────────────────────────────────

// 繳費期限檢查（02:00 UTC）
async function cronCheckPayments(env){
  const now=new Date(),regs=await dbGet(env,'registrations',`review_status=eq.%E5%B7%B2%E9%8C%84%E5%8F%96&payment_status=eq.%E6%9C%AA%E7%B9%B3%E8%B2%BB&select=*`);
  const tcCache={},processedGroups=new Set(),processedRegs=new Set();
  async function ctx(t){if(!tcCache[t])tcCache[t]=await getTenantCtx(env,t);return tcCache[t]}
  for(const r of regs){
    const T=r.tenant_id,due=dueAtForReg(r),remind=reminderAtForReg(r);if(!due)continue;
    const groupKey=String(r.bundle_group_id||'').trim()?T+'|B|'+String(r.bundle_group_id):T+'|R|'+String(r.id);
    if(now>=due){
      if(processedGroups.has(groupKey))continue;
      const group=await getBundleGroupRegs(env,T,r);
      // 正常組合付款必須一起；若歷史資料出現其中一場已有實收，禁止排程自動取消，避免誤刪真實金流。
      if(group.some(g=>safeNum(g.paid_amount)>0||isPaidStatus(g.payment_status))){processedGroups.add(groupKey);continue}
      for(const g of group){
        if(processedRegs.has(String(g.id))||_reviewStatus(g)==='已取消')continue;
        const active=isActiveForCapacity(g),upd={review_status:'已取消',payment_status:'已取消',payment_expired_at:now.toISOString(),
          stall_number:null,seat_choice_status:'released',seat_choice_type:null,seat_hold_expires_at:null,
          admin_note:(g.admin_note||'')+' 逾期未繳費自動取消'+(group.length>1?'（兩場組合整組取消）':'')+' '+nowTaipeiText()};
        await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(g.id)}&tenant_id=eq.${T}`,upd);
        if(active)await adjustRegistrationCapacity(env,T,g,-(safeNum(g.stall_count)||1)).catch(()=>{});
        await releaseRegistrationSeats(env,T,g,'payment_overdue').catch(()=>{});
        await releaseRegistrationTimeslots(env,T,g).catch(()=>{});
        await dbUpdate(env,'payments',`tenant_id=eq.${T}&registration_id=eq.${encodeURIComponent(g.id)}&status=in.(%E5%BE%85%E4%BB%98%E6%AC%BE,%E5%BE%85%E7%A2%BA%E8%AA%8D)`,{status:'已取消'}).catch(()=>{});
        await writeAuditLog(env,T,'','system','payment_overdue_cancel','registrations',g.id,{review_status:g.review_status,payment_status:g.payment_status},upd,{bundle_group:group.length>1,due_at:due.toISOString(),capacity_delta:active?-(safeNum(g.stall_count)||1):0});
        await refreshSessionStatsSafe(env,T,g.session_id);
        try{const sn=await getSessionName(env,g.session_id,T),st=await getSessionType(env,g.session_id,T),dn=getDisplayName(g.name,g.brand_name||'',st),tc=await ctx(T);await mailAutoCancel(env,g.email,dn,sn,tc)}catch(e){}
        await recordNotification(env,{tenantId:T,unitId:g.operation_unit_id||null,sessionId:g.session_id,registrationId:g.id,email:g.email,eventKey:'payment_overdue_cancelled',title:'逾期未付款已取消',body:'因超過付款期限，此筆報名／預約已自動取消。',meta:{dueAt:g.payment_due_at||''}}).catch(()=>{});
        processedRegs.add(String(g.id));
      }
      processedGroups.add(groupKey);
    }else if(remind&&now>=remind&&!r.reminder_sent){
      await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(r.id)}&tenant_id=eq.${T}`,{reminder_sent:true});
      try{const sn=await getSessionName(env,r.session_id,T),st=await getSessionType(env,r.session_id,T),dn=getDisplayName(r.name,r.brand_name||'',st),sr=await dbGet(env,'sessions',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(r.session_id)}&select=basic_equip`),tc=await ctx(T);await mailDeadlineReminder(env,r.email,dn,sn,r.id,_officialAmount(r),safeJson(r.selected_dates_json,[]),r.equipment_json,sr[0]?.basic_equip||'',tc)}catch(e){}
      await recordNotification(env,{tenantId:T,unitId:r.operation_unit_id||null,sessionId:r.session_id,registrationId:r.id,email:r.email,eventKey:'payment_reminder',title:'付款期限提醒',body:'您的報名／預約尚有款項待完成，請依付款期限處理。',meta:{dueAt:r.payment_due_at||''}}).catch(()=>{});
    }
  }
}

// 釋出逾期預留攤位（02:00 UTC）
async function cronReleaseStalls(env) {
  const nowMs = Date.now();
  // 跨租戶：以 seat_hold_expires_at 為正式期限；舊資料沒有期限時才用 hold_time 相容判斷。
  const stalls = await dbGet(env,'stalls',`status=eq.%E9%A0%90%E7%95%99&select=*`);
  const releasedRegs = new Set();
  for (const s of (stalls||[])) {
    const expMs = s.seat_hold_expires_at ? Date.parse(s.seat_hold_expires_at) : NaN;
    const oldMs = s.hold_time ? Date.parse(s.hold_time) : NaN;
    const expired = Number.isFinite(expMs)
      ? expMs <= nowMs
      : (Number.isFinite(oldMs) && (nowMs-oldMs) >= STALL_HOLD_DAYS*24*60*60*1000);
    if (!expired) continue;
    const tenantId = s.tenant_id;
    const regId = String(seatRegId(s)||'');
    if (regId && !releasedRegs.has(tenantId+'|'+regId)) {
      const rr = await dbGet(env,'registrations',`tenant_id=eq.${tenantId}&id=eq.${encodeURIComponent(regId)}&select=*`).catch(()=>[]);
      if (rr.length) await releasePaidSeatHold(env,tenantId,rr[0],'cron_expired');
      else await dbUpdate(env,'stalls',`id=eq.${s.id}&tenant_id=eq.${tenantId}`,{status:'空閒',registration_id:null,email:null,hold_time:null,seat_hold_expires_at:null});
      releasedRegs.add(tenantId+'|'+regId);
    } else if (!regId) {
      await dbUpdate(env,'stalls',`id=eq.${s.id}&tenant_id=eq.${tenantId}`,{status:'空閒',registration_id:null,email:null,hold_time:null,seat_hold_expires_at:null});
    }
  }
}

// 行前提醒（01:00 UTC = 09:00 台灣）
async function cronPreEventReminders(env) {
  const now = new Date();
  // 跨租戶：撈所有啟用場次
  const sessions = await dbGet(env,'sessions',`status=eq.%E5%A0%B1%E5%90%8D%E4%B8%AD&select=*`);
  const tcCache = {};
  async function getReminderTenantCtx(tid) {
    if (!tcCache[tid]) tcCache[tid] = await getTenantCtx(env, tid);
    return tcCache[tid];
  }
  for (const s of sessions) {
    const TENANT = s.tenant_id ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
    const dates = safeJson(s.dates_json,[]);
    if (!dates.length) continue;
    const first = new Date(dates[0].date);
    const diff = Math.ceil((first-now)/(1000*60*60*24));
    // 活動進入前 N 天後持續自動補位（預設 7 天、最低 3 天），一直到活動開始前。
    // seat_assign_done_at 只記錄最近一次執行，不再阻止後續新付款者被補位。
    const autoWindow=sessionAutoAssignWindow(s,now);
    if (autoWindow.active) {
      try {
        await batchAssignSeatsForSession(env,TENANT,s);
        const ranAt=nowIso();
        await dbUpdate(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(s.id)}`,{seat_assign_done_at:ranAt});
        s.seat_assign_done_at=ranAt;
      } catch(e){ console.error('continuous batch assign failed', e&&e.message?e.message:e); logError(env,{source:'cronPreEventReminders',message:'continuous batch assign failed',error:e&&e.message?e.message:e}); }
    }
    if (diff!==3) continue;
    // 行前通知寄出前再補跑一次，確保所有當下符合條件者都有位置。
    try {
      await batchAssignSeatsForSession(env,TENANT,s);
      const ranAt=nowIso();
      await dbUpdate(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(s.id)}`,{seat_assign_done_at:ranAt});
      s.seat_assign_done_at=ranAt;
    } catch(e){ logError(env,{source:'cronPreEventReminders',message:'pre-mail batch assign failed',error:e&&e.message?e.message:e}); }
    const regs = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(s.id)}&review_status=eq.%E5%B7%B2%E9%8C%84%E5%8F%96&select=*`);
    const tc = await getReminderTenantCtx(TENANT);
    for (const r of regs) {
      if (!isPaidStatus(r.payment_status)) continue;
      const dn=getDisplayName(r.name,r.brand_name||'');
      try { await mailPreEventReminder(env,r.email,dn,s.name,dates[0].date,s.venue||'',tc,r.id,equipSummaryFromJson(r.equipment_json),r.stall_number||'',s.seat_map_url||''); } catch {}
    }
  }
}
async function notificationExists(env,T,eventKey,registrationId,email){const regFilter=registrationId?`&registration_id=eq.${encodeURIComponent(registrationId)}`:`&member_email=ilike.${encodeURIComponent(normEmail(email))}`;const rows=await dbGet(env,'notifications',`tenant_id=eq.${encodeURIComponent(T)}&event_key=eq.${encodeURIComponent(eventKey)}${regFilter}&select=id&limit=1`).catch(()=>[]);return !!rows.length}
async function cronCustomerLifecycle(env){const now=new Date(),today=now.toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}),tomorrow=new Date(now.getTime()+86400000).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}),yesterday=new Date(now.getTime()-86400000).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}),year=today.slice(0,4),mmdd=today.slice(5);
  const slots=await dbGet(env,'timeslots',`date_key=in.(${tomorrow},${yesterday})&select=id,tenant_id,date_key,start_text,end_text`).catch(()=>[]),slotMap=Object.fromEntries(slots.map(x=>[String(x.id),x]));if(slots.length){const regs=await dbGet(env,'registrations',`review_status=not.in.(%E5%B7%B2%E5%8F%96%E6%B6%88,%E4%B8%8D%E9%8C%84%E5%8F%96)&select=id,tenant_id,session_id,operation_unit_id,email,custom_fields_json,selected_dates_json`).catch(()=>[]);for(const r of regs){for(const id of registrationTimeslotIds(r)){const x=slotMap[id];if(!x||String(x.tenant_id)!==String(r.tenant_id))continue;const key=x.date_key===tomorrow?'booking_reminder_24h':'service_followup';if(await notificationExists(env,r.tenant_id,key,r.id,r.email))continue;await recordNotification(env,{tenantId:r.tenant_id,unitId:r.operation_unit_id||null,sessionId:r.session_id,registrationId:r.id,email:r.email,eventKey:key,title:key==='booking_reminder_24h'?'明日預約提醒':'服務完成關懷',body:key==='booking_reminder_24h'?`提醒您明日 ${x.start_text||''} 有預約。`:'謝謝您的到訪，歡迎查看店家提供的回訪優惠與票券。',meta:{timeslotId:id,date:x.date_key}})}}}
  const profiles=await dbGet(env,'tenant_customer_profiles','birthday=not.is.null&select=tenant_id,email,birthday,display_name').catch(()=>[]);for(const p of profiles){if(String(p.birthday||'').slice(5)!==mmdd)continue;const key='birthday_greeting_'+year;if(await notificationExists(env,p.tenant_id,key,null,p.email))continue;await recordNotification(env,{tenantId:p.tenant_id,email:p.email,eventKey:key,title:'生日快樂',body:`${p.display_name||'親愛的會員'}，祝您生日快樂，願今天有一份剛剛好的溫暖。`,meta:{birthday:p.birthday}})}
}

// 不可抗力逾期自動退費（02:00 UTC）
async function cronForceCancelExpiry(env) {
  const now = new Date();
  // 跨租戶
  const sessions = await dbGet(env,'sessions',`force_cancel=eq.true&select=*`);
  for (const s of sessions) {
    const TENANT = s.tenant_id ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
    if (!s.force_cancel_deadline) continue;
    if (now<new Date(s.force_cancel_deadline)) continue;
    // 找出未做選擇的報名（transfer_status 為空或 null）
    const regs = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(s.id)}&review_status=in.(%E5%B7%B2%E9%8C%84%E5%8F%96,%E5%BE%85%E5%AF%A9%E6%A0%B8)&select=*`);
    const unprocessed = regs.filter(r=>!r.transfer_status||r.transfer_status==='');
    const tcFc = await getTenantCtx(env, TENANT);
    for (const r of unprocessed) {
      await dbUpdate(env,'registrations',`id=eq.${r.id}&tenant_id=eq.${TENANT}`,{transfer_status:'申請退費',transfer_chosen_at:nowIso()});
      const st=await getSessionType(env, r.session_id, TENANT);
      const dn=getDisplayName(r.name,r.brand_name||'',st);
      try { await mailAutoRefund(env,r.email,dn,s.name,tcFc); } catch {}
    }
  }
}

// ── SECTION 15: 路由 ────────────────────────────────────────────


function icsEscape(v){return String(v||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n')}
function icsDate(date,start){return String(date||'').replace(/-/g,'')+'T'+String(start||'00:00').replace(/:/g,'').padEnd(6,'0')}
async function hBookingCalendarIcs(env,p){
 const T=p._tenantId,calendarId=String(p.calendarId||'');if(!await verifyStaff(env,p.email,p.token,T))return jsonErr('無權限');const regs=await dbGet(env,'registrations',`tenant_id=eq.${T}&select=id,session_id,booking_calendar_id,name,brand_name,selected_dates_json,custom_fields_json,review_status,transfer_status`);const sessions=await dbGet(env,'sessions',`tenant_id=eq.${T}&select=id,name,venue`);const sm=Object.fromEntries(sessions.map(x=>[x.id,x]));const slotIds=[...new Set(regs.flatMap(registrationTimeslotIds))];let slots=[];if(slotIds.length)slots=await dbGet(env,'timeslots',`tenant_id=eq.${T}&id=in.(${slotIds.map(x=>encodeURIComponent(x)).join(',')})&select=*`).catch(()=>[]);const sl=Object.fromEntries(slots.map(x=>[x.id,x]));let out=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DOING//Booking Calendar//ZH-TW','CALSCALE:GREGORIAN'];for(const r of regs){if(['已取消','不錄取'].includes(String(r.review_status||''))||['已退費','已退款'].includes(String(r.transfer_status||'')))continue;for(const id of registrationTimeslotIds(r)){const x=sl[id],s=sm[r.session_id]||{};if(!x||calendarId&&String(r.booking_calendar_id||x.booking_calendar_id||'')!==calendarId)continue;out.push('BEGIN:VEVENT','UID:'+r.id+'-'+id+'@doing','DTSTART;TZID=Asia/Taipei:'+icsDate(x.date_key,x.start_text),'DTEND;TZID=Asia/Taipei:'+icsDate(x.date_key,x.end_text||x.start_text),'SUMMARY:'+icsEscape((s.name||'預約')+'｜'+(r.brand_name||r.name||'')),'LOCATION:'+icsEscape(s.venue||''),'END:VEVENT')}}out.push('END:VCALENDAR');return new Response(out.join('\r\n'),{status:200,headers:{...corsHeaders(),'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="doing-bookings.ics"'}})}

async function hGetSystemDataCatalog(env,p){
  const pay=await verifyAdminJwt(p.token,env);
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  const rows=await dbGet(env,'platform_settings','setting_key=eq.system_data_catalog&select=setting_key,value_json,updated_at&limit=1');
  const row=rows[0]||null;
  let catalog=row?.value_json||{};
  if(typeof catalog==='string'){try{catalog=JSON.parse(catalog)}catch(_){catalog={}}}
  return jsonOk({ok:true,catalog,updatedAt:row?.updated_at||null});
}

async function routeGet(env, action, p, req) {
  if (action==='getPlatformMemberProfile') return await hGetPlatformMemberProfile(env,p);
  if (action==='getMyBrands') return await hGetMyBrands(env,p);
  if (action==='matchBrandCandidates') return await hMatchBrandCandidates(env,p);
  if (action==='getBrandAccessRequests') return await hGetBrandAccessRequests(env,p);
  if (action==='getRegistrationTeam') return await hGetRegistrationTeam(env,p);
  // 不需要 tenant 的路由
  if (action==='publicDiscovery') return await hPublicDiscovery(env,p);
  if (action==='publicExposureFeed') return await hPublicExposureFeed(env,p);
  if (action==='publicPlatformProfile') return await hPublicPlatformProfile(env,p);
  if (action==='getPlatformPublicProfile') return await hGetPlatformPublicProfile(env,p);
  if (action==='getExposurePlansPlatform') return await hGetExposurePlansPlatform(env,p);
  if (action==='getPlatformExposureOrders') return await hGetPlatformExposureOrders(env,p);
  if (action==='getPlatformAttributionReport') return await hGetPlatformAttributionReport(env,p);
  if (action==='getMyRegsGlobal') return await hGetMyRegsGlobal(env,p);
  if (action==='getMyOperationalTasks') return await hGetMyOperationalTasks(env,p);
  if (action==='adminMe') return await hAdminMe(env, p);
  if (action==='listLoginWorkspaces') return await hListLoginWorkspaces(env, p);
  if (action==='applyList') return await hApplyList(env, p);
  if (action==='getTenantsAdmin') return await hGetTenantsAdmin(env, p);
  if (action==='getPlatformDashboard') return await hGetPlatformDashboard(env,p);
  if (action==='getPlatformOperationsCenter') return await hGetPlatformOperationsCenter(env,p);
  if (action==='getPersistentChangeLedger') return await hGetPersistentChangeLedger(env,p);
  if (action==='getPlatformMetricDetails') return await hGetPlatformMetricDetails(env,p);
  if (action==='getSystemDataCatalog') return await hGetSystemDataCatalog(env,p);
  if (action==='getPlatformMembersAdmin') return await hGetPlatformMembersAdmin(env,p);
  if (action==='getPlatformAccessAssignments') return await hGetPlatformAccessAssignments(env,p);
  if (action==='getPlatformBillingPolicy') return await hGetPlatformBillingPolicy(env,p);
  if (action==='getPlatformPaymentProfile') return await hGetPlatformPaymentProfile(env,p);
  if (action==='getTenantBillingPlatform') return await hGetTenantBillingPlatform(env,p);
        if (action==='getPlatformServiceSales') return await hGetPlatformServiceSales(env,p);
  if (action==='getPublicBillingPolicy') return await hGetPublicBillingPolicy(env);
  if (action==='getDoingPublicSupportConversation') return await hGetDoingPublicSupportConversation(env,p);
  if (action==='getPlatformSupportThreads') return await hGetPlatformSupportThreads(env,p);
  if (action==='getPlatformSupportMessages') return await hGetPlatformSupportMessages(env,p);
  if (action==='getPlatformRiskCases') return await hGetPlatformRiskCases(env,p);
  if (action==='getDoingHelperKnowledgeAdmin') return await hGetDoingHelperKnowledgeAdmin(env,p);
  if (action==='getPlatformTenantModules') return await hGetPlatformTenantModules(env,p);
  if (action==='getPlatformTenantTheme') return await hGetPlatformTenantTheme(env,p);
  if (action==='platformTenantOwnerStatus') return await hPlatformTenantOwnerStatus(env, p);
  if (action==='platformTenantSessions') return await hPlatformTenantSessions(env,p);
  if (action==='platformTenantOperationUnits') return await hPlatformTenantOperationUnits(env,p);
  if (action==='getPlatformCreditBalance'){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');return jsonOk({ok:true,balance:await platformCreditBalance(env,String(p.target_tenant_id||'').trim().toLowerCase())});}
  if (action==='getOperatingBillingStatus') return await hGetOperatingBillingStatus(env,p);
  if (action==='getStartupCreditPolicy') return await hGetStartupCreditPolicy(env,p);

  // DOING：租戶由登入 JWT、場次/報名關聯或租戶 site_url 自動解析，不要求使用者輸入代碼。
  const TENANT = await resolveTenantForRequest(env, p, req);
  if (!TENANT) {
    return new Response(JSON.stringify({ok:false, error:'無法辨識主辦空間，請從主辦提供的活動連結進入'}), {status:400, headers:corsHeaders()});
  }
  if(crossTenantTokenDenied(p,TENANT))return jsonErr('營運空間不一致，已阻擋跨租戶請求',403);
  p.tenant = TENANT;
  p._tenantId = TENANT;  // 注入供 handler 使用
  // 連線測試 / 診斷
  if (action==='ping') {
    let supabaseOk=false, staffCount=0, sessionCount=0, errMsg='';
    try {
      const rows = await dbGet(env,'staff',`tenant_id=eq.${TENANT}&select=email,role`);
      supabaseOk=true; staffCount=rows.length;
    } catch(e) { errMsg=e.message; }
    try {
      const rows = await dbGet(env,'sessions',`tenant_id=eq.${TENANT}&select=id`);
      sessionCount=rows.length;
    } catch(e) {}
    return jsonOk({
      ok:true, tenant:TENANT,
      supabase: supabaseOk ? '✅ 正常' : '❌ 失敗：'+errMsg,
      staffCount, sessionCount,
      env_supabase_url: env.SUPABASE_URL ? '✅ 已設定' : '❌ 未設定',
      env_supabase_key: supabaseServiceRoleKey(env) ? '✅ 已設定' : '❌ 未設定',
      env_resend_key: env.RESEND_KEY ? '✅ 已設定' : '❌ 未設定',
    });
  }
  if (action==='ecpayReturn') {
    return new Response('0|付款 API 尚未啟用',{status:200});
  }
  if (action==='linePayConfirm') return jsonErr('LINE Pay 尚未啟用');
  if (action==='linePayCancel') return jsonErr('LINE Pay 尚未啟用');

  const featureDenied = await enforceTenantFeature(env, TENANT, action);
  if (featureDenied) return featureDenied;
  const roleDenied = await enforceTenantRole(env, TENANT, action, p);
  if (roleDenied) return roleDenied;

  switch(action) {
    case 'frontBootstrap':      return hFrontBootstrap(env,p);
    case 'getOperationUnitsPublic': return hGetOperationUnitsPublic(env,p);
    case 'getOperationUnitsAdmin': return hGetOperationUnitsAdmin(env,p);
    case 'getBookingCalendarAdmin': return hGetBookingCalendarAdmin(env,p);
    case 'getAvailabilityAdmin': return hGetAvailabilityAdmin(env,p);
    case 'getAvailableStartsPublic': return hGetAvailableStartsPublic(env,p);
    case 'getPromotionRulesAdmin': return hGetPromotionRulesAdmin(env,p);
    case 'getOperationalCloseout': return hGetOperationalCloseout(env,p);
    case 'getConsignmentPeriodsPublic': return hGetConsignmentPeriodsPublic(env,p);
    case 'getMyConsignment': return hGetMyConsignment(env,p);
    case 'getExposureCatalog': return hGetExposureCatalog(env,p);
    case 'getMyRewards': return hGetMyRewards(env,p);
    case 'getMyCustomerWallets': return hGetMyCustomerWallets(env,p);
    case 'getCustomerWalletsAdmin': return hGetCustomerWalletsAdmin(env,p);
    case 'getMyNotifications': return hGetMyNotifications(env,p);
    case 'getNotificationsAdmin': return hGetNotificationsAdmin(env,p);
    case 'bookingCalendarIcs': return hBookingCalendarIcs(env,p);
    case 'getEvents':           return hGetEvents(env,p);
    case 'getSessions':         return hGetSessions(env,p);
    case 'getBundlesPublic':    return hGetBundlesPublic(env,p);
    case 'getBundles':          return hGetBundles(env,p);
    case 'getSession':          return hGetSession(env,p);
    case 'getSessionAgreement': return hGetSessionAgreement(env,p);
    case 'listActivePhotoActivities': return hListActivePhotoActivities(env,p);
    case 'getPhotoActivityBySlug': return hGetPhotoActivityBySlug(env,p);
    case 'getMember':           return hGetMember(env,p);
    case 'getMyRegs':           return hGetMyRegs(env,p);
    case 'getRegLookup':        return hGetRegLookup(env,p);
    case 'getAnnouncements':    return hGetAnnouncements(env,p);
    case 'getSeatMap':          return hGetSeatMap(env,p);
    case 'getSessionShortLink': return hGetSessionShortLink(env,p);
    case 'getErrorLogs':        return hGetErrorLogs(env,p);
    case 'adminLogin':          return hAdminLogin(env,p);
    case 'applyTrial':          return hApplyTrial(env,p);
    case 'approveApply':        return hApproveApply(env,p);
    case 'requestApplySupplement': return hRequestApplySupplement(env,p);
    case 'lockTenant':          return hLockTenant(env,p);
    case 'unlockTenant':        return jsonErr('舊 30 日續費流程已停用，請使用正式營運權');
    case 'adminLogout':         return hAdminLogout(env,p);
    case 'adminMe':             return hAdminMe(env,p);
    case 'getDashboard':        return hGetDashboard(env,p);
    case 'adminBusinessOverview': return hAdminBusinessOverview(env,p);
    case 'financeOverview': return hFinanceOverview(env,p);
    case 'financeReport': return hFinanceReport(env,p);
    case 'adminFinanceAnomalies': return hAdminFinanceAnomalies(env,p);
    case 'getSessionDashboard': return hGetSessionDashboard(env,p);
    case 'adminSeatBoard': return hAdminSeatBoard(env,p);
    case 'getTodos': return hGetTodos(env,p);
    case 'getAdminSessionsDashboard': return hGetSessionDashboard(env,p);
    case 'getAdminSessionDashboard': return hGetSessionDashboard(env,p);
    case 'getSessionRegistrations': return hGetSessionRegistrations(env,p);
    case 'getSessionEquipmentDetails': return hGetSessionEquipmentDetails(env,p);
    case 'getPaymentSettings': return hGetPaymentSettings(env,p);
    case 'getPaymentProfiles': return hGetPaymentProfiles(env,p);
    case 'getFinancePaymentGroups': return hGetFinancePaymentGroups(env,p);
    case 'getSessionCashbook': return hGetSessionCashbook(env,p);
    case 'getEmailTemplates': return hGetEmailTemplates(env,p);
    case 'getMembers': return hGetMembers(env,p);
    case 'getMemberHistory': return hGetMemberHistory(env,p);
    case 'getCompanySettings': return hGetCompanySettings(env,p);
    case 'getTenantModuleProfile': return hGetTenantModuleProfile(env,p);
    case 'getTenantTheme': return hGetTenantTheme(env,p);
    case 'getSupportThreads': return hGetSupportThreads(env,p);
    case 'getSupportMessages': return hGetSupportMessages(env,p);
    case 'exportTenantData':   return hExportTenantData(env,p);
    case 'downloadSession':     return hDownloadSession(env,p);
    case 'getRegs':             return hGetRegs(env,p);
    case 'getRegsBySession':    return hGetRegsBySession(env,p);
    case 'onsiteSessions':      return hOnsiteSessions(env,p);
    case 'onsiteRegs':          return hOnsiteRegs(env,p);
    case 'onsitePasscodeVerify': return hOnsitePasscodeVerify(env,p);
    case 'onsiteShiftList': return hOnsiteShiftList(env,p);
    case 'onsitePasscodeList':   return hOnsitePasscodeList(env,p);
    case 'getStaff':            return hGetStaff(env,p);
    case 'getEventsAdmin':      return hGetEventsAdmin(env,p);
    case 'getSessionsAdmin':    return hGetSessionsAdmin(env,p);
    case 'getSessionVisualAssets': return hGetSessionVisualAssets(env,p);
    case 'getSessionVisualJobs': return hGetSessionVisualJobs(env,p);
    case 'getPayments':         return hGetPayments(env,p);
    case 'getFinance':          return hGetFinance(env,p);
    case 'getInvoiceList':      return hGetInvoiceList(env,p);
    case 'getSiteConfig':       return hGetSiteConfig(env,p);
    case 'getAgreementTemplate': return hGetAgreementTemplate(env,p);
    case 'getAgreementTemplates': return hGetAgreementTemplate(env,p);
    case 'getForceRefundList':  return hGetForceRefundList(env,p);
    case 'previewForceCancelSession': return hPreviewForceCancelSession(env,p);
    default: return jsonErr('unknown GET action: '+action);
  }
}

async function enforceSessionModuleForAction(env,T,action,b){
  const map={
    selectStall:'seatSelection',claimPaidSeat:'seatSelection',adminSeatBoard:'seatSelection',adminAssignSeat:'seatSelection',runBatchAssign:'seatSelection',saveSeatMap:'seatSelection',saveSeatMapImage:'seatSelection',
    submitPayment:'payment',submitPaymentBatch:'payment',createLinePayOrder:'payment',createEcpayOrder:'payment',confirmPayment:'payment',sendPaymentReminder:'payment',
    checkin:'checkin',onsiteMark:'checkin',markClear:'checkin',onsitePasscodeGenerate:'checkin',onsitePasscodeToggle:'checkin',
    updateInvoiceStatus:'invoice'
  };
  const key=map[action];if(!key)return null;let sid=String(b.sessionId||b.session_id||'').trim();
  if(!sid && b.regId){const rr=await dbGet(env,'registrations',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(b.regId)}&select=session_id`).catch(()=>[]);sid=String(rr[0]&&rr[0].session_id||'')}
  if(!sid && ['saveSeatMap','saveSeatMapImage','toggleSession'].includes(action))sid=String(b.id||'').trim();
  if(!sid)return null;const sr=await dbGet(env,'sessions',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(sid)}&select=id,modules_json`).catch(()=>[]);if(!sr.length)return jsonErr('找不到場次');const mods=normalizeSessionModules(safeJson(sr[0].modules_json,{}));if(!mods[key])return jsonErr(`此場次未啟用「${key}」功能模組`);return null;
}

async function routePost(env, action, b, ctx, req) {
  // 平台層動作不綁 Tenant。
  if(action==='trackPlatformAttribution')return hTrackPlatformAttribution(env,b);
  if(action==='createIdentityLink')return hCreateIdentityLink(env,b,req);
  if(action==='acceptStaffInvite')return hAcceptStaffInvite(env,b);
  if(action==='saveMemberBrand')return hSaveMemberBrand(env,b);
  if(action==='resolveBrandAccessRequest')return hResolveBrandAccessRequest(env,b);
  if(action==='createRegistrationMemberInvite')return hCreateRegistrationMemberInvite(env,b);
  if(action==='acceptRegistrationMemberInvite')return hAcceptRegistrationMemberInvite(env,b);
  if(action==='memberOnsiteAction')return hMemberOnsiteAction(env,b);
  if(action==='createPlatformAccessInvite')return hCreatePlatformAccessInvite(env,b);
  if(action==='setPlatformAccessActive')return hSetPlatformAccessActive(env,b);
  if(action==='savePlatformMemberProfile')return hSavePlatformMemberProfile(env,b);
  if(action==='createMemberWorkspaceAdminSession')return hCreateMemberWorkspaceAdminSession(env,b);
  if(action==='analyzeDoingApplication')return hAnalyzeDoingApplication(env,b);
  if(action==='rateDoingHelperReply')return hRateDoingHelperReply(env,b);
  if(action==='publishDoingHelperKnowledge')return hPublishDoingHelperKnowledge(env,b);
  if(action==='publishDoingHelperImprovement')return hPublishDoingHelperImprovement(env,b);
  if(action==='bulkPublishDoingHelperKnowledge')return hBulkPublishDoingHelperKnowledge(env,b);
  if(action==='reviewDoingHelperImprovement')return hReviewDoingHelperImprovement(env,b);
  if(action==='createOrganizerApplicationDraft')return hCreateOrganizerApplicationDraft(env,b);
  if(action==='approveApply')return hApproveApply(env,b);
  if(action==='requestApplySupplement')return hRequestApplySupplement(env,b);
  if(action==='rejectApply')return hRejectApply(env,b);
  if(action==='applyTrial')return hApplyTrial(env,b);
  if(action==='createDoingPublicSupportThread')return hCreateDoingPublicSupportThread(env,b);
  if(action==='sendPlatformSupportMessage')return hSendPlatformSupportMessage(env,b);
  if(action==='markPlatformSupportRead')return hMarkPlatformSupportRead(env,b);
  if(action==='reviewPlatformRiskCase')return hReviewPlatformRiskCase(env,b);
  if(action==='savePlatformTenantModules')return hSavePlatformTenantModules(env,b);
  if(action==='savePlatformTenantTheme')return hSavePlatformTenantTheme(env,b);
  if(action==='updatePlatformIssueStatus')return hUpdatePlatformIssueStatus(env,b);
  if(action==='appendPersistentChangeLedger')return hAppendPersistentChangeLedger(env,b);
      if(action==='recordPlatformServiceSale')return hRecordPlatformServiceSale(env,b);
  // DOING：寫入操作的租戶由 JWT / 場次 / 報名關聯解析；正式 handler 仍會做權限與 tenant 驗證。
  const TENANT = await resolveTenantForRequest(env, b, req);
  if (!TENANT) {
    return new Response(JSON.stringify({ok:false, error:'無法辨識主辦空間'}), {status:400, headers:corsHeaders()});
  }
  if(crossTenantTokenDenied(b,TENANT))return jsonErr('營運空間不一致，已阻擋跨租戶請求',403);
  b.tenant = TENANT;
  b._tenantId = TENANT;  // 注入供 handler 使用
  // 注入來源 IP 與 User-Agent（供不可抗力同意證據寫入）
  if (req) {
    b._ip = req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || req.headers.get('X-Real-IP') || null;
    b._userAgent = req.headers.get('User-Agent') || null;
  }
  const featureDenied = await enforceTenantFeature(env, TENANT, action);
  if (featureDenied) return featureDenied;
  const roleDenied = await enforceTenantRole(env, TENANT, action, b);
  if (roleDenied) return roleDenied;
  const sessionModuleDenied=await enforceSessionModuleForAction(env,TENANT,action,b);
  if(sessionModuleDenied)return sessionModuleDenied;

  if (action==='resendRegConfirm') {
    if (!await verifyStaff(env,b.email,b.token,TENANT,'review')) return jsonErr('無權限');
    const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
    if(!rows.length) return jsonErr('找不到報名資料');
    const reg=rows[0];
    const sesName = await getSessionName(env, reg.session_id, TENANT);
    const sesType = await getSessionType(env, reg.session_id, TENANT);
    const dn = getDisplayName(reg.name, reg.brand_name||'', sesType);
    const total = Number(reg.amount)||0;
    const stallCount = Number(reg.stall_count)||1;
    const selectedDates = safeJson(reg.selected_dates_json,[]);
    const equip = safeJson(reg.equipment_json,{});
    const tcResend = await getTenantCtx(env, TENANT);
    try { await mailRegConfirm(env,reg.email,dn,sesName,reg.id,total,stallCount,selectedDates,equip,tcResend); }
    catch(e){ return jsonErr('寄信失敗：'+e.message); }
    return jsonOk({ok:true});
  }
  if (action==='testEmail') {
    if (!await verifyStaff(env,b.email,b.token, TENANT)) return jsonErr('無權限');
    const to = b.to;
    if(!to) return jsonErr('缺少收件地址');
    const tcTest = await getTenantCtx(env, TENANT);
    const result = await sendEmail(env, to, `【${tcTest.name}】信件系統測試`, emailWrap(`
<p>✅ 這是一封測試信件。</p>
<p>如果您收到這封信，代表 <strong>${tcTest.name}</strong> 的信件系統設定正確！</p>
<p style="color:#888;font-size:12px">測試時間：${nowIso()}</p>
`, tcTest), tcTest);
    if(result.ok) return jsonOk({ok:true});
    return jsonErr('寄信失敗：'+(result.error||'未知錯誤'));
  }
  switch(action) {
    case 'register':            return hRegister(env,b,ctx);
    case 'registerBundle':      return hRegisterBundle(env,b,ctx);
    case 'saveBundle':          return hSaveBundle(env,b);
    case 'createShortLink':     return hCreateShortLink(env,b);
    case 'purgeErrorLogs':      return hPurgeErrorLogs(env,b);
    case 'deleteBundle':        return hDeleteBundle(env,b);
    case 'saveMember':          return hSaveMember(env,b);
    case 'cancelReg':           return hCancelReg(env,b);
    case 'rescheduleBooking':   return hRescheduleBooking(env,b);
    case 'selectStall':         return hSelectStall(env,b);
    case 'claimPaidSeat':       return hClaimPaidSeat(env,b);
    case 'adminSeatBoard':      return hAdminSeatBoard(env,b);
    case 'adminAssignSeat':     return hAdminAssignSeat(env,b);
    case 'adminUpdateSeatPositions': return hAdminUpdateSeatPositions(env,b);
    case 'adminUnassignSeat':   return hAdminUnassignSeat(env,b);
    case 'runBatchAssign':      return hRunBatchAssign(env,b);
    case 'saveSeatMap':         return hSaveSeatMap(env,b);
    case 'saveSeatMapImage':    return hSaveSeatMapImage(env,b);
    case 'submitPayment':       return hSubmitPayment(env,b);
    case 'submitPaymentBatch':  return hSubmitPaymentBatch(env,b);
    case 'undoPaymentReport':   return hUndoPaymentReport(env,b);
    case 'createLinePayOrder':  return hCreateLinePayOrder(env,b);
    case 'createEcpayOrder':    return hCreateEcpayOrder(env,b);
    case 'createEvent':         return hCreateEvent(env,b);
    case 'updateEvent':         return hUpdateEvent(env,b);
    case 'deleteEvent':         return hDeleteEvent(env,b);
    case 'createSession':       return hCreateSession(env,b);
    case 'updateSession':       return hUpdateSession(env,b);
    case 'autoTranslateSession': return hAutoTranslateSession(env,b);
    case 'uploadCover': return hUploadCover(env, b);
    case 'generateSessionVisual': return hGenerateSessionVisual(env,b);
    case 'setSessionMainVisual': return hSetSessionMainVisual(env,b);
    case 'deleteSessionVisualAsset': return hDeleteSessionVisualAsset(env,b);
    case 'deleteSession':       return hDeleteSession(env,b);
    case 'toggleSession':       return hToggleSession(env,b);
    case 'toggleSessionStatus': return hToggleSessionStatus(env,b);
    case 'copySession':         return hCopySession(env,b);
    case 'updateRegStatus':     return hUpdateRegStatus(env,b);
    case 'batchUpdateStatus':   return hBatchUpdateStatus(env,b);
    case 'approveReg':          return hApproveReg(env,b);
    case 'confirmPayment':      return hConfirmPayment(env,b);
    case 'markPaymentScreenshot': return hMarkPaymentScreenshot(env,b);
    case 'saveRegNote': return hSaveRegNote(env,b);
    case 'saveMemberNote': return hSaveMemberNote(env,b);
    case 'saveTenantCustomerProfile': return hSaveTenantCustomerProfile(env,b);
    case 'saveCustomerWallet': return hSaveCustomerWallet(env,b);
    case 'postCustomerWalletEntry': return hPostCustomerWalletEntry(env,b);
    case 'submitVendorSalesReport': return hSubmitVendorSalesReport(env,b);
    case 'saveTenantDomain': return hSaveTenantDomain(env,b);
    case 'checkTenantDomain': return hCheckTenantDomain(env,b);
    case 'saveConsignmentPeriod': return hSaveConsignmentPeriod(env,b);
    case 'applyConsignment': return hApplyConsignment(env,b);
    case 'reviewConsignmentApplication': return hReviewConsignmentApplication(env,b);
    case 'saveConsignmentProduct': return hSaveConsignmentProduct(env,b);
    case 'recordPosSale': return hRecordPosSale(env,b);
    case 'saveMembershipPlan': return hSaveMembershipPlan(env,b);
    case 'issueMembershipPlan': return hIssueMembershipPlan(env,b);
    case 'updateServiceVisit': return hUpdateServiceVisit(env,b);
    case 'saveWaitlistPolicy': return hSaveWaitlistPolicy(env,b);
    case 'saveMarketingAutomation': return hSaveMarketingAutomation(env,b);
    case 'submitPlatformRiskCase': return hSubmitPlatformRiskCase(env,b);
    case 'sendPaymentReminder': return hSendPaymentReminder(env,b);
    case 'adminCancelReg':      return hAdminCancelReg(env,b);
    case 'refundDeposit':       return hRefundDeposit(env,b);
    case 'checkin':             return hCheckin(env,b);
    case 'onsiteMark':          return hOnsiteMark(env,b);
    case 'onsitePasscodeVerify':   return hOnsitePasscodeVerify(env,b);
    case 'onsitePasscodeGenerate': return hOnsitePasscodeGenerate(env,b);
    case 'onsitePasscodeToggle':   return hOnsitePasscodeToggle(env,b);
    case 'onsiteShiftStart': return hOnsiteShiftStart(env,b);
    case 'onsiteShiftEnd': return hOnsiteShiftEnd(env,b);
    case 'markClear':           return hMarkClear(env,b);
    case 'sendNotify':          return hSendNotify(env,b);
    case 'resendInvite':        return hResendInvite(env,b);
    case 'addStaff':            return hAddStaff(env,b);
    case 'removeStaff':         return hRemoveStaff(env,b);
    case 'setStaffActive':      return hSetStaffActive(env,b);
    case 'updateStaffPerms':    return hUpdateStaffPerms(env,b);
    case 'updateStaffSessions': return hUpdateStaffSessions(env,b);
    case 'saveAnnouncement':    return hSaveAnnouncement(env,b);
    case 'deleteAnnouncement':  return hDeleteAnnouncement(env,b);
    case 'saveFinanceItem':     return hSaveFinanceItem(env,b);
    case 'saveSessionCashItem': return hSaveSessionCashItem(env,b);
    case 'deleteSessionCashItem': return hDeleteSessionCashItem(env,b);
    case 'deleteFinanceItem':   return hDeleteFinanceItem(env,b);
    case 'updateInvoiceStatus': return hUpdateInvoiceStatus(env,b);
    case 'checkMemberEmailPhone': return hCheckMemberEmailPhone(env,b);
    case 'listActivePhotoActivities': return hListActivePhotoActivities(env,b);
    case 'getPhotoActivityBySlug': return hGetPhotoActivityBySlug(env,b);
    case 'submitPhotoLead': return hSubmitPhotoLead(env,b);
    case 'listPhotoActivities': return hListPhotoActivities(env,b);
    case 'savePhotoActivity': return hSavePhotoActivity(env,b);
    case 'savePhotoActivityFrame': return hSavePhotoActivityFrame(env,b);
    case 'deletePhotoActivityFrame': return hDeletePhotoActivityFrame(env,b);
    case 'deletePhotoActivity': return hDeletePhotoActivity(env,b);
    case 'listPhotoLeads':      return hListPhotoLeads(env,b);
    case 'listContactLeads':    return hListContactLeads(env,b);
    case 'listVenueMaps':       return hListVenueMaps(env,b);
    case 'saveVenueMap':        return hSaveVenueMap(env,b);
    case 'applyVenueMap':       return hApplyVenueMap(env,b);
    case 'deleteVenueMap':      return hDeleteVenueMap(env,b);
    case 'setFastPass':         return hSetFastPass(env,b);
    case 'saveSiteConfig':      return hSaveSiteConfig(env,b);
    case 'saveTenantModuleProfile': return hSaveTenantModuleProfile(env,b);
    case 'saveTenantTheme': return hSaveTenantTheme(env,b);
    case 'createSupportThread': return hCreateSupportThread(env,b);
    case 'sendSupportMessage': return hSendSupportMessage(env,b);
    case 'markSupportRead': return hMarkSupportRead(env,b);
    case 'saveOperationUnit': return hSaveOperationUnit(env,b);
    case 'saveBookingCalendar': return hSaveBookingCalendar(env,b);
    case 'saveAvailabilityRule': return hSaveAvailabilityRule(env,b);
    case 'saveAvailabilityException': return hSaveAvailabilityException(env,b);
    case 'saveResourceSplitRule': return hSaveResourceSplitRule(env,b);
    case 'deleteOperationUnit': return hDeleteOperationUnit(env,b);
    case 'savePromotionRule': return hSavePromotionRule(env,b);
    case 'deletePromotionRule': return hDeletePromotionRule(env,b);
    case 'createExposureOrder': return hCreateExposureOrder(env,b);
    case 'cancelExposureOrder': return hCancelExposureOrder(env,b);
    case 'grantPartnerCredit': return grantPartnerCredit(env,b);
    case 'saveStartupCreditPolicy': return hSaveStartupCreditPolicy(env,b);
    case 'confirmOperatingPayment': return hConfirmOperatingPayment(env,b);
    case 'reportOperatingPayment': return hReportOperatingPayment(env,b);
    case 'updateRegistrationAction':       return hUpdateRegistrationAction(env,b);
    case 'savePaymentSettings':       return hSavePaymentSettings(env,b);
    case 'savePaymentProfile':       return hSavePaymentProfile(env,b);
    case 'disablePaymentProfile':    return hDisablePaymentProfile(env,b);
    case 'saveEmailTemplate':       return hSaveEmailTemplate(env,b);
    case 'saveCompanySettings':       return hSaveCompanySettings(env,b);
    case 'updateStaffScope':       return hUpdateStaffScope(env,b);
    case 'setStaffScope':       return hUpdateStaffScope(env,b);
    case 'saveAgreementTemplate': return hSaveAgreementTemplate(env,b);
    case 'saveAgreementTemplates': return hSaveAgreementTemplate(env,b);
    case 'forceCancel':         return hForceCancel(env,b);
    case 'agreeTransfer':       return hAgreeTransfer(env,b);
    case 'applyRefund':         return hApplyRefund(env,b);
    case 'confirmRefund':       return hConfirmRefund(env,b);
    // ── 不可抗力模組（獨立 action，不覆蓋原有邏輯）──
    case 'forceCancelSession':   return hForceCancelSession(env,b);
    case 'agreeForceTransfer':   return hAgreeForceTransfer(env,b);
    case 'applyForceRefund':     // alias：規格名稱
    case 'applyForceRefundFM':   return hApplyForceRefundFM(env,b);
    case 'runForceChoiceDeadline': return hRunForceChoiceDeadline(env,b);
    case 'confirmForceRefund':   return hConfirmForceRefund(env,b);
    case 'getRefundSuggestion': return hGetRefundSuggestion(env,b);
    // 允許 POST 呼叫的 GET actions
    case 'getFinance':          return hGetFinance(env,b);
    case 'getRegsBySession':    return hGetRegsBySession(env,b);
    default: return jsonErr('unknown POST action: '+action);
  }
}

// ── SECTION 16: 主進入點 ────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method==='OPTIONS') {
      return new Response(null, {status:204, headers:corsHeaders()});
    }
    // 出錯時要能回答「誰、在做什麼、哪一筆」。一路填進去，最外層 catch 就有線索可寫。
    const _logCtx = {method:request.method, path:'', action:'', tenantId:'', email:'', regId:'', sessionId:''};
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const action = url.searchParams.get('action')||'';
      _logCtx.path = pathname;
      _logCtx.action = action;

      // ── Google OAuth 路由（GET）──
      if (request.method==='GET' && pathname.endsWith('/auth/google/start')) {
        return await hGoogleStart(env, url);
      }
      if (request.method==='GET' && pathname.endsWith('/auth/google/callback')) {
        return await hGoogleCallback(env, url);
      }
      if (request.method==='GET' && pathname.endsWith('/auth/line/start')) {
        return await hLineStart(env, url);
      }
      if (request.method==='GET' && pathname.endsWith('/auth/line/callback')) {
        return await hLineCallback(env, url);
      }
      // 舊 unified Google OAuth 僅做相容轉址；現行公開入口使用 /auth/line/start。
      if (request.method==='GET' && pathname.endsWith('/auth/google/unified/start')) {
        const u = new URL('/auth/google/start', url.origin);
        for (const [k,v] of url.searchParams.entries()) {
          if (k !== 'next') u.searchParams.set(k, v);
        }
        return Response.redirect(u.toString(), 302);
      }
      if (request.method==='GET' && pathname.endsWith('/auth/google/unified/callback')) {
        const u = new URL(adminLoginSiteUrl(env));
        u.searchParams.set('login_error', 'legacy_google_callback');
        return Response.redirect(u.toString(), 302);
      }

      // ── 短網址轉址：/s/<code> ──
      // 由租戶公開網域的 /s/* route 導進來；不帶 action，tenant 由短碼資料解析。
      const shortMatch = pathname.match(/^\/s\/([a-z0-9]{4,16})$/i);
      if (request.method==='GET' && shortMatch) {
        return await hShortRedirect(env, shortMatch[1].toLowerCase());
      }

      if (request.method==='GET') {
        const p = Object.fromEntries(url.searchParams);
        _logCtx.tenantId  = p._tenantId || p.tenant || '';
        _logCtx.email     = p.email || '';
        _logCtx.regId     = p.regId || '';
        _logCtx.sessionId = p.sessionId || '';
        // /admin/me
        if (pathname.endsWith('/admin/me') || action==='adminMe') return await hAdminMe(env, p);
        return await routeGet(env, action, p, request);
      }

      if (request.method==='POST') {
        // ECPay 回調：付款 API 尚未啟用
        if (action==='ecpayReturn') {
          return new Response('0|付款 API 尚未啟用',{status:200});
        }
        // 一般 POST：支援 application/json 與 text/plain 內的 JSON
        let body={};
        try {
          const raw = await request.text();
          body = raw ? JSON.parse(raw) : {};
        } catch(e) {
          return jsonErr('invalid JSON body');
        }
        // action 可在 URL 或 body 中
        const act = action || body.action || '';
        _logCtx.action    = act;
        _logCtx.tenantId  = body._tenantId || body.tenant || '';
        _logCtx.email     = body.email || '';
        _logCtx.regId     = body.regId || '';
        _logCtx.sessionId = body.sessionId || '';
        // /admin/logout
        if (pathname.endsWith('/admin/logout') || act==='adminLogout') return await hAdminLogout(env, body);
        // 申請試用（不需登入）
        if (pathname.endsWith('/apply') || act==='applyTrial') return await hApplyTrial(env, body);
        // 多主辦空間選擇（LINE／Google 已驗證後的短效 token，不需 tenant 前置參數）
        if (act==='selectLoginWorkspace') return await hSelectLoginWorkspace(env, body);
        if (act==='platformEnterTenant') return await hPlatformEnterTenant(env, body);
        if (act==='platformUpsertTenantOwner') return await hPlatformUpsertTenantOwner(env, body);
        if (act==='grantPartnerCredit') return await grantPartnerCredit(env, body);
        if (act==='saveStartupCreditPolicy') return await hSaveStartupCreditPolicy(env, body);
        if (act==='savePlatformBillingPolicy') return await hSavePlatformBillingPolicy(env, body);
        if (act==='savePlatformPaymentProfile') return await hSavePlatformPaymentProfile(env, body);
  if (act==='recordPlatformServiceSale') return await hRecordPlatformServiceSale(env, body);
        if (act==='confirmOperatingPayment') return await hConfirmOperatingPayment(env, body);
        if (act==='confirmReportedOperatingPayment') return await hConfirmReportedOperatingPayment(env, body);
        if (act==='saveExposurePlanPlatform') return await hSaveExposurePlanPlatform(env, body);
        if (act==='savePlatformPublicProfile') return await hSavePlatformPublicProfile(env, body);
        if (act==='confirmExposurePayment') return await hConfirmExposurePayment(env, body);
        if (act==='cancelExposurePlatform') return await hCancelExposurePlatform(env, body);
        // 一鍵開通（平台管理員）
        if (act==='approveApply') return await hApproveApply(env, body);
        if (act==='requestApplySupplement') return await hRequestApplySupplement(env, body);
        if (act==='rejectApply') return await hRejectApply(env, body);
        // 鎖定 / 解鎖
        if (act==='lockTenant') return await hLockTenant(env, body);
        if (act==='unlockTenant') return jsonErr('舊 30 日續費流程已停用，請使用正式營運權');
        return await routePost(env, act, body, ctx, request);
      }

      return jsonErr('Method Not Allowed');
    } catch(e) {
      console.error('Worker error:', e);
      // 全域攔截：任何漏接的錯誤都要留下線索，否則攤友看到「異常」，你我都只能猜。
      // 用 waitUntil 在背景寫，不拖慢回應。
      const _logIt = logError(env, {
        source: 'worker',
        action: (_logCtx && _logCtx.action) || '',
        tenantId: (_logCtx && _logCtx.tenantId) || '',
        email: (_logCtx && _logCtx.email) || '',
        regId: (_logCtx && _logCtx.regId) || '',
        sessionId: (_logCtx && _logCtx.sessionId) || '',
        error: e,
        detail: {method: (_logCtx && _logCtx.method) || '', path: (_logCtx && _logCtx.path) || ''},
      });
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(_logIt); else await _logIt;
      return jsonErr('系統發生異常，已記錄。請聯繫主辦並提供發生時間。');
    }
  },

  async scheduled(event, env, ctx) {
    await syncExposureStatuses(env);
    await runWaitlistAutomation(env);
    const utcHour = new Date(event.scheduledTime).getUTCHours();
    if (utcHour===1) {
      await cronPreEventReminders(env);
      await cronCustomerLifecycle(env);
      await cronGrantCompletedRewards(env);
      await cronTrialExpireReminders(env); // 試用到期提醒
      await runMarketingAutomations(env);
    } else {
      // 02:00 UTC = 10:00 台灣 → 繳費期限 + 攤位釋出 + 不可抗力逾期
      await cronCheckPayments(env);
      await cronReleaseStalls(env);
      await cronForceCancelExpiry(env);
      // 不可抗力選擇逾期自動轉退費
      await hRunForceChoiceDeadline(env, {});
    }
  },
};
