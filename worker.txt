Warning: truncated output (original token count: 168764)
Total output lines: 10317

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
async function issueWorkspaceSelectionToken(email, tenantIds, env) {
  const now = Date.now();
  return signAdminJwt({
    iss: 'DOING',
    type: 'workspace_selection',
    sub: email,
    email,
    tenant_ids: Array.from(new Set((tenantIds || []).filter(Boolean))),
    issued_at: now,
    expires_at: now + 10 * 60 * 1000,
  }, env);
}

async function verifyWorkspaceSelectionToken(token, env) {
  const payload = await verifyAdminJwt(token, env);
  if (!payload || payload.type !== 'workspace_selection' || !payload.email || !Array.isArray(payload.tenant_ids)) return null;
  return payload;
}

// 簽發前台會員 JWT（30 天有效）
async function issueMemberToken(memberInfo, env) {
  const now = Date.now();
  const payload = {
    iss: 'DOING',
    type: 'member',
    sub: memberInfo.google_sub || memberInfo.email,
    email: memberInfo.email,
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
    return 'R' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,4).toUpperCase();
  }
  // H-04：改用 crypto.randomUUID，移除 4 碼尾碼碰撞風險
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
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

[主辦名稱] 已開通您的後台管理權限。

角色：[管理員角色]
權限：[權限]
管理範圍：[管理範圍]

請從前台進入後台登入。

[按鈕:前往後台登入]`,
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
      if (label.includes('後台')) href = (tenantCtx && tenantCtx.siteUrl) || FALLBACK_SITE_URL;
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
  const guard=regOwnerGuard(reg,b,'撤回付款回報'); if(guard) return guard;
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
async function mailStaffInvite(env, email, name, role, perms, limitSessions, tenantCtx=null) {
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
  participants: true, addons: true, agreement: true, i18n: true, googleCalendar: true
};

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

async function hGetTenantModuleProfile(env,p){
  const T=p._tenantId; if(!await verifyStaff(env,p.email,p.token,T)) return jsonErr('無權限');
  const [profile,approvedFlags]=await Promise.all([getTenantModuleProfileValue(env,T),getTenantModuleFlags(env,T)]);
  return jsonOk({...profile,approvedFlags});
}
async function hSaveTenantModuleProfile(env,b){
  const T=b._tenantId; if(!await verifyStaff(env,b.email,b.token,T)) return jsonErr('無權限');
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
  const key=String(b.themeKey||b.key||'').trim();if(!TENANT_THEME_KEYS.has(key))return jsonErr('不支援的品牌風格');
  const value={key,updatedAt:nowIso()};
  const row=await getTenantSettingsRow(env,T);
  if(row)await dbUpdate(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(T)}`,{theme_json:JSON.stringify(value),updated_at:nowIso()});
  else await dbInsert(env,'tenant_settings',{tenant_id:T,module_flags_json:await getTenantModuleFlags(env,T),theme_json:value});
  await writeAuditLog(env,T,b.email||'','organizer','save_tenant_theme','tenant_settings',T,null,value).catch(()=>{});
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
  if(row)await dbUpdate(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(T)}`,{module_flags_json:JSON.stringify(flags),updated_at:nowIso()});
  else await dbInsert(env,'tenant_settings',{tenant_id:T,module_flags_json:flags,theme_json:{key:'cute_pastel',updatedAt:nowIso()}});
  await writeAuditLog(env,T,jwt.email||'','platform_super_admin','approve_tenant_modules','tenant_settings',T,current,flags).catch(()=>{});return jsonOk({flags});
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
async function hGetExposureCatalog(env,p){
  const T=p._tenantId;if(!await verifyStaff(env,p.email,p.token,T,'settings'))return jsonErr('無權限');
  await syncExposureStatuses(env);
  const [plans,sessions,events,orders]=await Promise.all([
    dbGet(env,'exposure_plans','is_active=eq.true&placement=eq.home_activity_flash&select=*&order=sort_order.desc,price.asc').catch(()=>[]),
    dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(T)}&status=in.(%E5%A0%B1%E5%90%8D%E4%B8%AD,%E9%96%8B%E6%94%BE%E4%B8%AD,%E9%96%8B%E6%94%BE)&select=id,event_id,name,status,venue,dates_json,cover_url,fee,created_at&order=created_at.desc`).catch(()=>[]),
    dbGet(env,'events',`tenant_id=eq.${encodeURIComponent(T)}&select=id,title,cover_url`).catch(()=>[]),
    dbGet(env,'exposure_orders',`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=created_at.desc`).catch(()=>[])
  ]);
  const em=Object.fromEntries(events.map(x=>[String(x.id),x]));
  return jsonOk({plans,sessions:sessions.map(s=>({...s,eventTitle:(em[String(s.event_id)]||{}).title||'',cover:s.cover_url||(em[String(s.event_id)]||{}).cover_url||''})),orders});
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
  const email=normEmail(p&&p.email),phone=normPhone(p&&p.phone);
  if(!email||!phone)return jsonErr('請提供 Email 與手機，才能查詢我的報名／預約');
  const candidates=await dbGet(env,'registrations',`email=ilike.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=500`).catch(()=>[]);
  const regs=candidates.filter(r=>normEmail(r.email)===email&&phoneMatches(r.phone,phone));
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
    out.push({
      tenantId:T,tenantName:t.name||T,tenantSlug:t.slug||T,tenantLogo:String(cfg.logoUrl||cfg.logo_url||''),tenantLineUrl:String(cfg.lineUrl||cfg.line_url||''),
      eventId:r.event_id||s.event_id||'',eventTitle:ev.title||'',
      id:r.id,sessionId:r.session_id,sessionName:s.name||r.session_id,operationUnitId:r.operation_unit_id||'',operationUnitName:u?.name||'',
      name:r.name||'',brand:r.brand_name||'',venue:s.venue||'',sessionDates:displayDates,
      status:r.review_status,payStatus:r.payment_status,amount:Number(r.amount||0),total:Number(r.total_amount||r.amount||0),paid:Number(r.paid_amount||0),
      due:(()=>{const snap=selectedModuleSnapshot(r),paid=safeNum(r.paid_amount),total=safeNum(r.total_amount||r.amount);const first=safeNum(snap.amountDueNow);return Math.max(0,(paid<=0&&first>0?first:total)-paid)})(),
      deposit:Number(r.deposit||0),stallCount:Number(r.stall_count||1),selectedDates:safeJson(r.selected_dates_json,[]),equip:safeJson(r.equipment_json,{}),
      totalEquipmentText:_equipmentTextFromMap(_effectiveEquipmentMapForReg(r,s)),stallNumber:r.stall_number||'',
      seatChoiceIntent:r.seat_choice_intent||'auto',seatChoiceStatus:r.seat_choice_status||'',seatChoiceType:r.seat_choice_type||'',
      bundleId:r.bundle_id||'',bundleGroupId:r.bundle_group_id||'',paymentDueAt:r.payment_due_at||'',seatHoldExpiresAt:r.seat_hold_expires_at||'',
      transferCreditAmount:safeNum(r.transfer_credit_amount),transferBalanceDue:safeNum(r.transfer_balance_due),transferRefundDue:safeNum(r.transfer_refund_due),
      seatPricingEnabled:(s.seat_pricing_enabled===true||s.seat_pricing_enabled==='true'),seatHoldHours:safeNum(s.seat_hold_hours)||SEAT_HOLD_HOURS,
      seatMapUrl:s.seat_map_url||'',seatFeeTotal:safeNum(r.seat_fee_total),payMethod:r.payment_method||'',payLast5:r.payment_last5||'',checkin:r.checkin_status,createdAt:r.created_at,
      transferStatus:r.transfer_status||'',refundAmount:safeNum(r.refund_amount),forceStatus:r.force_status||(s.force_cancel?'pending_force_choice':null),
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
    const end=addCalendarMonthTaipei(nowIso()),c=await consumeCreditOrNeedPayment(env,T,fees.bookingMonthlyFee,'booking_monthly','unit:'+u.id,end);if(!c.ok)return {...c,mode};
    try{await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:'booking_monthly',amount:fees.bookingMonthlyFee,tax:0,total:fees.bookingMonthlyFee,status:'confirmed',confirmed_at:nowIso(),confirmed_by:'platform_credit',period_start:nowIso(),period_end:end,note:'預約營運月方案｜'+u.id,created_at:nowIso()})}catch(e){await rollbackPlatformCreditUse(env,T,fees.bookingMonthlyFee,c.ledgerId,'booking_unit_entitlement_failed').catch(()=>{});throw e}return {ok:true,mode,periodEnd:end};
  }
  if(await hasOperationUnitEntitlement(env,T,u.id))return {ok:true,mode};
  const c=await consumeCreditOrNeedPayment(env,T,fees.freeActivityFee,'activity_unit',u.id);if(!c.ok)return {...c,mode};
  try{await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:billingTypeForOperationUnit(u.id),amount:fees.freeActivityFee,tax:0,total:fees.freeActivityFee,status:'confirmed',confirmed_at:nowIso(),confirmed_by:'platform_credit',period_start:nowIso(),period_end:null,note:'營運項目正式開通｜'+u.id,created_at:nowIso()})}catch(e){await rollbackPlatformCreditUse(env,T,fees.freeActivityFee,c.ledgerId,'activity_unit_entitlement_failed').catch(()=>{});throw e}return {ok:true,mode};
}
async function anyOpenUnitEntitled(env,T,sessionId){
  const rows=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sessionId)}&status=in.(open,active,published)&select=*`).catch(()=>[]);
  for(const u of rows)if(await operationUnitEntitlementActive(env,T,u))return true;return false;
}
function unitTypeAllowed(v){return ['market','registration','booking','workshop','course','guide','staff','generic'].includes(String(v||''))?String(v):'registration'}
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
  const name=String(b.name||'').trim();if(!name)return jsonErr('請填營運項目名稱');const now=nowIso(),id=String(b.id||genId('UNT')),mods=normalizeSessionModules(b.modules||{}),pricing=(b.pricing&&typeof b.pricing==='object')?b.pricing:{},policy=(b.policy&&typeof b.policy==='object')?b.policy:{},pub=(b.publicConfig&&typeof b.publicConfig==='object')?b.publicConfig:{};
  let code=unitCode(b.code)||unitCode(name)||('unit-'+id.slice(-6).toLowerCase());const same=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&code=eq.${encodeURIComponent(code)}&select=id`).catch(()=>[]);if(same.some(x=>String(x.id)!==id))code=code+'-'+id.slice(-4).toLowerCase();
  const data={event_id:String(sr[0].event_id||''),session_id:sid,code,name,unit_type:unitTypeAllowed(b.unitType),status:unitStatusAllowed(b.status),description:String(b.description||''),capacity:Math.max(0,parseInt(b.capacity||0,10)||0),fee:Math.max(0,safeNum(b.fee)),modules_json:JSON.stringify(mods),pricing_json:JSON.stringify(pricing),policy_json:JSON.stringify(policy),public_config_json:JSON.stringify({...pub,timeslots:Array.isArray(b.timeslots)?b.timeslots:(Array.isArray(pub.timeslots)?pub.timeslots:[])}),sort_order:Math.max(0,parseInt(b.sortOrder||0,10)||0),updated_at:now};
  const old=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`).catch(()=>[]);const requestedStatus=data.status;const wantsOpen=['open','active','published'].includes(requestedStatus);if(wantsOpen)data.status=old.length&&operationUnitIsOpen(old[0])?requestedStatus:'draft';if(old.length){if(String(old[0].session_id)!==sid)return jsonErr('營運項目不可跨場次直接搬移');await dbUpdate(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,data)}else await dbInsert(env,'operation_units',{id,tenant_id:T,current_count:0,created_at:now,...data});
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
async function hGetMyRewards(env,p){const T=p._tenantId,email=normEmail(p.email),phone=normPhone(p.phone);if(!email||!phone)return jsonErr('請提供 Email 與手機');const m=await findVerifiedMemberByEmailPhone(env,T,email,phone);if(!m){const regs=await dbGet(env,'registrations',`tenant_id=eq.${encodeURIComponent(T)}&email=ilike.${encodeURIComponent(email)}&select=phone&limit=20`).catch(()=>[]);if(!regs.some(r=>phoneMatches(r.phone,phone)))return jsonErr('Email 或手機驗證失敗')}const rows=await dbGet(env,'reward_ledger',`tenant_id=eq.${encodeURIComponent(T)}&member_email=ilike.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=100`).catch(()=>[]);return jsonOk({balance:await rewardBalance(env,T,email),rows})}
async function hGetMyNotifications(env,p){const T=p._tenantId,email=normEmail(p.email),phone=normPhone(p.phone);if(!email||!phone)return jsonErr('請提供 Email 與手機');const regs=await dbGet(env,'registrations',`tenant_id=eq.${encodeURIComponent(T)}&email=ilike.${encodeURIComponent(email)}&select=phone&limit=20`).catch(()=>[]);const m=await findVerifiedMemberByEmailPhone(env,T,email,phone).catch(()=>null);if(!m&&!regs.some(r=>phoneMatches(r.phone,phone)))return jsonErr('Email 或手機驗證失敗');return jsonOk(await dbGet(env,'notifications',`tenant_id=eq.${encodeURIComponent(T)}&member_email=ilike.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=100`).catch(()=>[]))}
async function hGetNotificationsAdmin(env,p){const T=p._tenantId,sid=String(p.sessionId||'');if(!await verifyStaff(env,p.email,p.token,T,'announce',sid||undefined)&&!await verifyStaff(env,p.email,p.token,T,'sessions',sid||undefined))return jsonErr('無權限');let q=`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=created_at.desc&limit=200`;if(sid)q=`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&select=*&order=created_at.desc&limit=200`;return jsonOk(await dbGet(env,'notifications',q).catch(()=>[]))}

async function getPlatformSetting(env,key,fallback={}){const rows=await dbGet(env,'platform_settings',`setting_key=eq.${encodeURIComponent(key)}&select=value_json`).catch(()=>[]);return rows.length?safeJson(rows[0].value_json,fallback):fallback}
const DEFAULT_PLATFORM_BILLING_POLICY=Object.freeze({freeActivityFee:200,bookingMonthlyFee:688,paidActivityRatePercent:1,noCap:true});
function normalizePlatformBillingPolicy(raw={}){return {freeActivityFee:Math.max(0,Math.round(safeNum(raw.freeActivityFee??DEFAULT_PLATFORM_BILLING_POLICY.freeActivityFee))),bookingMonthlyFee:Math.max(0,Math.round(safeNum(raw.bookingMonthlyFee??DEFAULT_PLATFORM_BILLING_POLICY.bookingMonthlyFee))),paidActivityRatePercent:Math.max(0,Math.min(100,Math.round(safeNum(raw.paidActivityRatePercent??DEFAULT_PLATFORM_BILLING_POLICY.paidActivityRatePercent)*10000)/10000)),noCap:true}}
async function platformBillingPolicy(env){return normalizePlatformBillingPolicy(await getPlatformSetting(env,'platform_billing_policy',DEFAULT_PLATFORM_BILLING_POLICY))}
async function hGetPlatformBillingPolicy(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');return jsonOk(await platformBillingPolicy(env))}
async function hGetPublicBillingPolicy(env){return jsonOk(await platformBillingPolicy(env))}
async function hSavePlatformBillingPolicy(env,b){const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');const value=normalizePlatformBillingPolicy(b),now=nowIso(),rows=await dbGet(env,'platform_settings','setting_key=eq.platform_billing_policy&select=setting_key').catch(()=>[]);if(rows.length)await dbUpdate(env,'platform_settings','setting_key=eq.platform_billing_policy',{value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});else await dbInsert(env,'platform_settings',{setting_key:'platform_billing_policy',value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});await writeAuditLog(env,'platform',pay.email||'','platform_super_admin','save_platform_billing_policy','platform_settings','platform_billing_policy',null,value,{}).catch(()=>{});return jsonOk(value)}
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

// getMyRegs
async function hGetMyRegs(env, p) {
  const TENANT = (p && p._tenantId);
  const email = normEmail(p && p.email);
  const phone = normPhone(p && p.phone);
  if (!email || !phone) return jsonErr('請提供 Email 與手機，才能查詢我的紀錄');

  // 只用同一個 Email 的會員／報名進行驗證，避免「相同電話、不同 Email」被誤認為同一人。
  const [memberRows, regsByEmail] = await Promise.all([
    dbGet(env,'members',`tenant_id=eq.${TENANT}&email=ilike.${encodeURIComponent(email)}&select=*`),
    dbGet(env,'registrations',`tenant_id=eq.${TENANT}&email=ilike.${encodeURIComponent(email)}&select=*&order=created_at.desc`),
  ]);
  let member = memberRows[0] || null;
  const regMatched = regsByEmail.find(r=>phoneMatches(r.phone,phone));

  if (member && !phoneMatches(member.phone,phone)) {
    // 舊會員手機空白或格式不同時，可由自己既有報名紀錄完成補驗；真正不一致仍阻斷。
    if (!regMatched) return jsonErr('Email 已存在，但手機與會員資料不一致，請確認報名時使用的手機號碼。');
    try { await upsertMember(env,{_tenantId:TENANT,email,phone,name:regMatched.name||'',brand:regMatched.brand_name||'',brandIntro:regMatched.brand_intro||'',sellCat:regMatched.sell_category||'',photo:regMatched.photo_url||'',fb:regMatched.fb_url||'',ig:regMatched.ig_url||'',taxId:regMatched.tax_id||'',invoiceTitle:regMatched.invoice_title||'',invoiceEmail:regMatched.invoice_email||''}); } catch(e) {}
  } else if (!member) {
    if (regsByEmail.length && !regMatched) return jsonErr('查無符合 Email 與手機的報名紀錄，請確認是否與報名時一致。');
    if (regMatched) {
      try { await upsertMember(env,{_tenantId:TENANT,email,phone,name:regMatched.name||'',brand:regMatched.brand_name||'',brandIntro:regMatched.brand_intro||'',sellCat:regMatched.sell_category||'',photo:regMatched.photo_url||'',fb:regMatched.fb_url||'',ig:regMatched.ig_url||'',taxId:regMatched.tax_id||'',invoiceTitle:regMatched.invoice_title||'',invoiceEmail:regMatched.invoice_email||''}); } catch(e) {}
    } else {
      // 全新會員：建立最小會員紀錄，回傳空清單；「沒有舊報名」不是錯誤。
      try { await upsertMember(env,{_tenantId:TENANT,email,phone,name:'',brand:'',brandIntro:'',sellCat:''}); }
      catch(e) {
        const again=await dbGet(env,'members',`tenant_id=eq.${TENANT}&email=ilike.${encodeURIComponent(email)}&select=phone`).catch(()=>[]);
        if(again.length && !phoneMatches(again[0].phone,phone)) return jsonErr('Email 已存在，但手機與會員資料不一致。');
      }
    }
  }

  const [regsByMember, sessions, units] = await Promise.all([
    dbGet(env, 'registrations', `tenant_id=eq.${TENANT}&member_id=ilike.${encodeURIComponent(email)}&select=*&order=created_at.desc`).catch(()=>[]),
    dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&select=id,name,event_id,venue,dates_json,equip_json,basic_equip,seat_pricing_enabled,seat_hold_hours,seat_map_url,force_cancel,force_cancel_deadline,force_cancel_target_id,modules_json`),
    dbGet(env, 'operation_units', `tenant_id=eq.${TENANT}&select=*`).catch(()=>[]),
  ]);
  const regMap = new Map();
  [...regsByEmail, ...regsByMember].forEach(r=>{ if(r && r.id && phoneMatches(r.phone,phone)) regMap.set(String(r.id), r); });
  const regs = Array.from(regMap.values()).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  const sMap = {}; sessions.forEach(s=>sMap[s.id]=s);const uMap={};units.forEach(u=>uMap[u.id]=u);
  return jsonOk(await Promise.all(regs.map(async r=>{
    const s = sMap[r.session_id]||{},u=uMap[r.operation_unit_id]||null;
    const paySnap = await ensurePaymentSnapshotForReg(env,TENANT,r,s,{writeIfSafe:true}).catch(()=>_paymentSnapshotFromReg(r));
    const payPub = _paymentSnapshotPublic(paySnap);
    let displayDates=safeJson(s.dates_json,[]);if(u){const uts=await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(TENANT)}&operation_unit_id=eq.${encodeURIComponent(u.id)}&select=*&order=date_key.asc,start_text.asc`).catch(()=>[]);if(uts.length)displayDates=uts.map(x=>({date:x.date_key,label:x.label||x.date_key,start:x.start_text||'',end:x.end_text||'',timeslotId:x.id,limit:safeNum(x.capacity)}))}
    return {
      id:r.id, sessionId:r.session_id, sessionName:s.name||r.session_id, operationUnitId:r.operation_unit_id||'', operationUnitName:u?.name||'',
      eventId:r.event_id||s.event_id||'', name:r.name||'', brand:r.brand_name||'',
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
      payMethod:r.payment_method||'', payLast5:r.payment_last5||'', checkin:r.checkin_status, createdAt:r.created_at,
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
// DOING 後台登入只保留 /auth/google/start + /auth/google/callback。
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
  if (platformRows[0]) return iss…68764 tokens truncated…pshot:String(s.description||'').slice(0,2000),
      prompt_text:prompt1, requested_count:AI_VISUAL_COUNT, completed_count:0,
      model, quality, created_by:b.email||'', created_at:createdAt,
    });
  } catch (e) {
    if (String(e && e.message || e).includes('uq_ai_visual_jobs_one_processing') || String(e && e.message || e).includes('duplicate key')) {
      return jsonErr('此場次已有 AI 主視覺正在生成，請勿重複送出');
    }
    throw e;
  }

  const uploadedPaths = [];
  const insertedAssetIds = [];
  try {
    const generated = [await _openAiGenerateSquareVisual(env, prompt1)];
    if (generated.length !== AI_VISUAL_COUNT) throw new Error('產圖數量不是 1 張');

    const assets = [];
    for (let i = 0; i < generated.length; i++) {
      const assetId = genId('VIS');
      const finalBytes = generated[i].bytes;
      const finalMime = 'image/png';
      const finalExt = 'png';
      const storagePath = `${TENANT}/${sessionId}/${jobId}/variant_${i+1}.${finalExt}`;
      const publicUrl = await _aiVisualStorageUpload(env, storagePath, finalBytes, finalMime);
      uploadedPaths.push(storagePath);
      const row = await dbInsert(env, 'session_visual_assets', {
        id:assetId, tenant_id:TENANT, session_id:sessionId, job_id:jobId,
        asset_type:'main_visual', style_preset:presetKey, storage_provider:'supabase_storage',
        bucket_name:AI_VISUAL_BUCKET, storage_path:storagePath, public_url:publicUrl,
        mime_type:finalMime, width:1024, height:1024, file_size:finalBytes.length,
        variant_no:i+1, is_selected:false, prompt_text:prompt1,
        created_by:b.email||'', created_at:nowIso(),
      });
      insertedAssetIds.push(assetId);
      assets.push(_aiVisualAssetPublic(row));
    }

    await dbUpdate(env, 'ai_visual_jobs', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(jobId)}`, {
      status:'succeeded', completed_count:AI_VISUAL_COUNT, completed_at:nowIso(), error_message:null,
    });
    await dbUpdate(env, 'sessions', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(sessionId)}`, {
      ai_visual_preset:presetKey,
    });
    await writeAuditLog(env, TENANT, b.email||'', 'admin', 'generate_ai_visual', 'sessions', sessionId, {}, {jobId,presetKey,count:1,composition:'standard'}, {});
    return jsonOk({ success:true, jobId, stylePreset:presetKey, aspectRatio:'1:1', assets });
  } catch (e) {
    // 閉環回滾：任一張上傳或 DB 寫入失敗，清掉本次所有半成品。
    for (const id of insertedAssetIds) await dbDelete(env, 'session_visual_assets', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(id)}`).catch(()=>{});
    for (const p of uploadedPaths) await _aiVisualStorageDelete(env, p).catch(()=>{});
    await dbUpdate(env, 'ai_visual_jobs', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(jobId)}`, {
      status:'failed', completed_count:0, error_message:String(e && e.message ? e.message : e).slice(0,2000), completed_at:nowIso(),
    }).catch(()=>{});
    await logError(env, {tenantId:TENANT, source:'hGenerateSessionVisual', action:'generateSessionVisual', sessionId, email:b.email||'', error:e});
    return jsonErr('AI 主視覺生成失敗：' + (e && e.message ? e.message : e));
  }
}

// AI 主視覺：二選一設為正式主圖，並同步既有 cover_url，前台不用改框架。
async function hSetSessionMainVisual(env, b) {
  const TENANT = b._tenantId;
  const sessionId = String(b.sessionId || b.session_id || '').trim();
  const assetId = String(b.assetId || b.asset_id || '').trim();
  if (!sessionId || !assetId) return jsonErr('缺少 sessionId 或 assetId');
  if (!await verifyPlatformSuperAdmin(env, b.email, b.token, TENANT)) return jsonErr('無權限');
  const rows = await dbGet(env, 'session_visual_assets', `tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sessionId)}&id=eq.${encodeURIComponent(assetId)}&select=*`);
  if (!rows.length) return jsonErr('找不到這張主視覺，或圖片不屬於本場次');
  const asset = rows[0];
  if (!asset.public_url) return jsonErr('圖片 URL 缺失，不能設為正式主圖');

  // 022：正式主圖二選一改由 DB RPC 單一交易完成，避免清空舊主圖後新主圖更新失敗的半套狀態。
  const rpcResult = await dbRpc(env, 'set_session_main_visual_atomic', {
    p_tenant_id:TENANT,
    p_session_id:sessionId,
    p_asset_id:assetId,
  });
  await writeAuditLog(env, TENANT, b.email||'', 'admin', 'set_ai_main_visual', 'sessions', sessionId, {}, {assetId,publicUrl:asset.public_url}, {});
  return jsonOk({success:true, asset:_aiVisualAssetPublic({...asset,is_selected:true}), coverUrl:asset.public_url, rpc:rpcResult});
}

// AI 主視覺：刪除未選用圖片；正式主圖禁止直接刪除。
async function hDeleteSessionVisualAsset(env, b) {
  const TENANT = b._tenantId;
  const sessionId = String(b.sessionId || b.session_id || '').trim();
  const assetId = String(b.assetId || b.asset_id || '').trim();
  if (!sessionId || !assetId) return jsonErr('缺少 sessionId 或 assetId');
  if (!await verifyPlatformSuperAdmin(env, b.email, b.token, TENANT)) return jsonErr('無權限');
  const [assets, sessions] = await Promise.all([
    dbGet(env, 'session_visual_assets', `tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sessionId)}&id=eq.${encodeURIComponent(assetId)}&select=*`),
    dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(sessionId)}&select=id,main_visual_asset_id`),
  ]);
  if (!assets.length) return jsonErr('找不到圖片');
  const asset = assets[0];
  if (asset.is_selected === true || (sessions[0] && String(sessions[0].main_visual_asset_id||'') === assetId)) return jsonErr('正式主圖不可直接刪除，請先選擇另一張正式主圖');
  await _aiVisualStorageDelete(env, asset.storage_path);
  await dbDelete(env, 'session_visual_assets', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(assetId)}`);
  return jsonOk({success:true, assetId});
}

// createEvent
async function hCreateEvent(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'events')) return jsonErr('無權限');
  const id = genId('EVT');
  await dbInsert(env,'events',{id,tenant_id:TENANT,title:b.title,description:b.desc||'',location:b.location||'',cover_url:b.cover||'',status:'開放中',created_at:nowIso()});
  return jsonOk({success:true,id});
}
// updateEvent
async function hUpdateEvent(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'events')) return jsonErr('無權限');
  const data = {title:b.title,description:b.desc||'',location:b.location||'',cover_url:b.cover||''};
  if (b.status) data.status=b.status;
  await dbUpdate(env,'events',`id=eq.${encodeURIComponent(b.id)}&tenant_id=eq.${TENANT}`,data);
  return jsonOk({success:true});
}
// deleteEvent
async function hDeleteEvent(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyPlatformSuperAdmin(env,b.email,b.token,TENANT)) return jsonErr('刪除主題僅限平台超級管理員');
  await dbDelete(env,'events',`id=eq.${encodeURIComponent(b.id)}&tenant_id=eq.${TENANT}`);
  return jsonOk({success:true});
}

// createSession
// 僅供尚未建立 billing_entity 前的申請通知顯示；正式限制仍以 billing_entities 為準。
const TRIAL_DAYS = 30;
const TRIAL_MAX_SESSIONS = 5;

// ── 試用限制：以 billing_entities 為正式來源，不在 Worker 寫死天數／場次 ──
async function getTenantBillingPolicy(env, TENANT) {
  const tenants = await dbGet(
    env,
    'tenants',
    `id=eq.${encodeURIComponent(TENANT)}&select=plan_type,trial_end_at,billing_entity_id,is_locked,locked_reason`
  ).catch(()=>[]);
  const tenant = tenants[0] || {};
  let policy = {
    planType: tenant.plan_type || '',
    trialEndAt: tenant.trial_end_at || null,
    trialSessionLimit: 0,
    locked: tenant.is_locked === true,
    lockedReason: tenant.locked_reason || '',
  };
  if (tenant.billing_entity_id) {
    const rows = await dbGet(
      env,
      'billing_entities',
      `id=eq.${encodeURIComponent(tenant.billing_entity_id)}&select=trial_session_limit,trial_day_limit,is_locked,locked_reason`
    ).catch(()=>[]);
    const be = rows[0] || {};
    policy.trialSessionLimit = Number(be.trial_session_limit) || 0;
    if (be.is_locked === true) {
      policy.locked = true;
      policy.lockedReason = be.locked_reason || policy.lockedReason || '帳務逾期';
    }
  }
  return policy;
}

async function checkTrialSessionLimit(env, TENANT) {
  // 舊試用場次上限已停用。帳號／設定／預覽免費；正式營運改由 entitlement 判斷。
  const lock = await checkTenantLocked(env, TENANT);
  return lock.locked ? (lock.reason || '此主辦空間目前為唯讀鎖定') : '';
}

function _sessionArray(v) {
  if (Array.isArray(v)) return v;
  return safeJson(v, []);
}
function _sessionObject(v, fallback={}) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  return safeJson(v, fallback);
}
function _sessionTextList(v) {
  if (Array.isArray(v)) return v.map(x=>String(x||'').trim()).filter(Boolean);
  return String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
}
function _sessionDateRows(v) {
  return _sessionArray(v).map(x=>{
    if (typeof x === 'string') return {date:x};
    return {
      date:String(x.date||'').trim(),
      label:String(x.label||x.name||'').trim(),
      start:String(x.start||x.start_time||'').trim(),
      end:String(x.end||x.end_time||'').trim(),
      fee:Number(x.fee)||0,
      limit:Number(x.limit)||0,
    };
  }).filter(x=>x.date);
}
function _validateSessionInput(b) {
  const name = String(b.name||'').trim();
  if (!name) return '請填寫場次名稱';
  const dates = _sessionDateRows(b.dates);
  const status=String(b.status||'關閉').trim();
  const draftLike=['關閉','已關閉','停用','封存','已封存'].includes(status);
  if (!dates.length && !draftLike) return '正式開放前請至少設定一個活動日期';
  return '';
}

function billingTypeForActivity(sid){return 'activity_publish:'+String(sid||'')}
function billingTypeForOperationUnit(uid){return 'activity_unit:'+String(uid||'')}
async function billingRows(env,T){return dbGet(env,'billing_logs',`tenant_id=eq.${encodeURIComponent(T)}&select=id,billing_type,amount,status,period_start,period_end,note,created_at&order=created_at.desc&limit=1000`).catch(()=>[])}
async function platformCreditBalance(env,T){const rows=await billingRows(env,T);return Math.max(0,rows.filter(x=>String(x.status)==='confirmed'&&['startup_credit_grant','partner_credit_grant','platform_credit_use','platform_credit_rollback'].includes(String(x.billing_type||''))).reduce((n,x)=>n+(Number(x.amount)||0),0))}
async function hasActivityEntitlement(env,T,sid){const rows=await billingRows(env,T);return rows.some(x=>String(x.status)==='confirmed'&&String(x.billing_type)===billingTypeForActivity(sid))}
async function hasOperationUnitEntitlement(env,T,uid){const rows=await billingRows(env,T);return rows.some(x=>String(x.status)==='confirmed'&&String(x.billing_type)===billingTypeForOperationUnit(uid))}
async function activeBookingEntitlement(env,T){const now=Date.now(),rows=await billingRows(env,T);return rows.find(x=>String(x.status)==='confirmed'&&String(x.billing_type)==='booking_monthly'&&x.period_end&&new Date(x.period_end).getTime()>now)||null}
function addCalendarMonthTaipei(iso){const d=new Date(iso),parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d).reduce((a,x)=>(a[x.type]=x.value,a),{});let y=+parts.year,m=+parts.month,day=+parts.day;m++;if(m===13){m=1;y++}const last=new Date(Date.UTC(y,m,0)).getUTCDate(),dd=Math.min(day,last);return new Date(`${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}T${parts.hour}:${parts.minute}:${parts.second}+08:00`).toISOString()}
async function grantPartnerCredit(env,b){const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');const T=String(b.target_tenant_id||'').trim().toLowerCase(),amt=Number(b.amount)||0;if(!T||amt===0)return jsonErr('請輸入主辦與合作額度金額');const before=await platformCreditBalance(env,T);if(amt<0&&before+amt<0)return jsonErr('扣回金額不可大於目前可用額度');await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:'partner_credit_grant',amount:amt,tax:0,total:amt,status:'confirmed',confirmed_at:nowIso(),confirmed_by:pay.email,period_start:nowIso(),period_end:null,note:String(b.note||'合作主辦額度調整'),created_at:nowIso()});return jsonOk({ok:true,balance:await platformCreditBalance(env,T)})}
async function hConfirmOperatingPayment(env,b){
  const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('無權限');
  const T=String(b.target_tenant_id||'').trim().toLowerCase(),mode=String(b.mode||'').trim(),sid=String(b.sessionId||'').trim(),fees=await platformBillingPolicy(env);if(!T)return jsonErr('請選擇主辦');
  if(mode==='booking'){
    const active=await activeBookingEntitlement(env,T);if(active)return jsonOk({ok:true,alreadyActive:true,periodEnd:active.period_end});
    const start=nowIso(),end=addCalendarMonthTaipei(start);await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:'booking_monthly',amount:fees.bookingMonthlyFee,tax:0,total:fees.bookingMonthlyFee,status:'confirmed',confirmed_at:start,confirmed_by:pay.email,period_start:start,period_end:end,note:String(b.note||'平台確認預約營運款'),created_at:start});const pendingUnits=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&status=eq.pending_payment&select=id,modules_json`).catch(()=>[]);for(const u of pendingUnits){if(String(normalizeSessionModules(safeJson(u.modules_json,{})).operatingMode||'activity')==='booking')await dbUpdate(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(u.id)}`,{status:'open',updated_at:start}).catch(()=>{})}return jsonOk({ok:true,mode,amount:fees.bookingMonthlyFee,periodEnd:end});
  }
  if(mode==='operation_unit'){
    const uid=String(b.operationUnitId||'').trim();if(!uid)return jsonErr('請指定營運項目');const ur=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(uid)}&select=id,modules_json`).catch(()=>[]);if(!ur.length)return jsonErr('找不到該主辦的營運項目');const um=normalizeSessionModules(safeJson(ur[0].modules_json,{}));if(String(um.operatingMode||'activity')==='booking')return jsonErr('此營運項目屬預約月方案，請開通預約營運權');if(await hasOperationUnitEntitlement(env,T,uid))return jsonOk({ok:true,alreadyActive:true});const t=nowIso();await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:billingTypeForOperationUnit(uid),amount:fees.freeActivityFee,tax:0,total:fees.freeActivityFee,status:'confirmed',confirmed_at:t,confirmed_by:pay.email,period_start:t,period_end:null,note:String(b.note||'平台確認營運項目開通款'),created_at:t});await dbUpdate(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(uid)}&status=eq.pending_payment`,{status:'open',updated_at:t}).catch(()=>{});return jsonOk({ok:true,mode,amount:fees.freeActivityFee,operationUnitId:uid});
  }
  if(mode!=='activity'||!sid)return jsonErr('活動發布請指定場次');const sr=await dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(sid)}&select=id`).catch(()=>[]);if(!sr.length)return jsonErr('找不到該主辦的場次');if(await hasActivityEntitlement(env,T,sid))return jsonOk({ok:true,alreadyActive:true});const t=nowIso();await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:billingTypeForActivity(sid),amount:fees.freeActivityFee,tax:0,total:fees.freeActivityFee,status:'confirmed',confirmed_at:t,confirmed_by:pay.email,period_start:t,period_end:null,note:String(b.note||'平台確認活動發布款'),created_at:t});return jsonOk({ok:true,mode,amount:fees.freeActivityFee,sessionId:sid});
}
async function hGetOperatingBillingStatus(env,p){
  const jwt=await verifyAdminJwt(p.token,env);const T=String((jwt&&jwt.tenant_id)||p._tenantId||'').toLowerCase();if(!jwt||!T||T==='platform')return jsonErr('無權限');if(!await verifyStaff(env,jwt.email,p.token,T,'settings'))return jsonErr('無權限');const booking=await activeBookingEntitlement(env,T),rows=await billingRows(env,T);return jsonOk({ok:true,platformCredit:await platformCreditBalance(env,T),booking:booking?{active:true,periodStart:booking.period_start,periodEnd:booking.period_end}:{active:false},activities:rows.filter(x=>String(x.status)==='confirmed'&&String(x.billing_type||'').startsWith('activity_publish:')).map(x=>({sessionId:String(x.billing_type).slice('activity_publish:'.length),createdAt:x.created_at})),operationUnits:rows.filter(x=>String(x.status)==='confirmed'&&String(x.billing_type||'').startsWith('activity_unit:')).map(x=>({operationUnitId:String(x.billing_type).slice('activity_unit:'.length),createdAt:x.created_at}))});
}
async function consumeCreditOrNeedPayment(env,T,amount,kind,note,periodEnd=null){
  const r=await dbRpc(env,'consume_platform_credit_atomic',{p_tenant_id:T,p_amount:Math.max(0,Number(amount)||0),p_kind:String(kind||''),p_note:String(note||''),p_period_end:periodEnd||null}).catch(e=>({ok:false,error:e&&e.message?e.message:String(e)}));
  if(!r||r.ok===false){if(r&&r.error)throw new Error('平台額度扣抵失敗：'+r.error);return {ok:false,needPayment:true,amount,balance:Math.max(0,Number(r&&r.balance)||0)}}
  return {ok:true,balance:Math.max(0,Number(r.balance)||0),ledgerId:r.ledgerId||r.ledger_id||''};
}
async function rollbackPlatformCreditUse(env,T,amount,ledgerId,note){
  await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:'platform_credit_rollback',amount:Math.abs(safeNum(amount)),tax:0,total:Math.abs(safeNum(amount)),status:'confirmed',confirmed_at:nowIso(),confirmed_by:'system',period_start:nowIso(),period_end:null,note:`rollback:${ledgerId||''}|${note||''}`,created_at:nowIso()});
}
async function operatingEntitlementActive(env,T,s){
  const mods=normalizeSessionModules(safeJson(s&&s.modules_json,{}));
  if(String(mods.operatingMode||'activity')==='booking')return !!(await activeBookingEntitlement(env,T));
  return await hasActivityEntitlement(env,T,s&&s.id);
}
async function ensureOperatingEntitlement(env,T,s){
  const mods=normalizeSessionModules(safeJson(s.modules_json,{}));const mode=String(mods.operatingMode||'activity'),fees=await platformBillingPolicy(env);
  if(mode==='booking'){
    const act=await activeBookingEntitlement(env,T);if(act)return {ok:true,mode,periodEnd:act.period_end};
    const end=addCalendarMonthTaipei(nowIso()),c=await consumeCreditOrNeedPayment(env,T,fees.bookingMonthlyFee,'booking_monthly',s.id,end);if(!c.ok)return {...c,mode};
    const raced=await activeBookingEntitlement(env,T);if(raced){await rollbackPlatformCreditUse(env,T,fees.bookingMonthlyFee,c.ledgerId,'booking_entitlement_already_created').catch(()=>{});return {ok:true,mode,periodEnd:raced.period_end}}
    try{
      await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:'booking_monthly',amount:fees.bookingMonthlyFee,tax:0,total:fees.bookingMonthlyFee,status:'confirmed',confirmed_at:nowIso(),confirmed_by:'platform_credit',period_start:nowIso(),period_end:end,note:'預約營運月方案',created_at:nowIso()});
    }catch(e){await rollbackPlatformCreditUse(env,T,fees.bookingMonthlyFee,c.ledgerId,'booking_entitlement_failed').catch(()=>{});throw e}
    return {ok:true,mode,periodEnd:end};
  }
  if(await hasActivityEntitlement(env,T,s.id))return {ok:true,mode};
  const c=await consumeCreditOrNeedPayment(env,T,fees.freeActivityFee,'activity_publish',s.id);if(!c.ok)return {...c,mode};
  if(await hasActivityEntitlement(env,T,s.id)){await rollbackPlatformCreditUse(env,T,fees.freeActivityFee,c.ledgerId,'activity_entitlement_already_created').catch(()=>{});return {ok:true,mode}}
  try{
    await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:billingTypeForActivity(s.id),amount:fees.freeActivityFee,tax:0,total:fees.freeActivityFee,status:'confirmed',confirmed_at:nowIso(),confirmed_by:'platform_credit',period_start:nowIso(),period_end:null,note:'活動發布權',created_at:nowIso()});
  }catch(e){await rollbackPlatformCreditUse(env,T,fees.freeActivityFee,c.ledgerId,'activity_entitlement_failed').catch(()=>{});throw e}
  return {ok:true,mode};
}

function _validateSessionForOpenRow(s){
  const mods=normalizeSessionModules(safeJson(s&&s.modules_json,{})),dateRows=safeJson(s&&s.dates_json,[]);
  if(mods.operatingMode==='activity' && Array.isArray(dateRows) && dateRows.length>1 && !mods.activityDatesTogether)return '此活動有多個日期。若參加者可分別選擇日期，請拆成獨立場次（每場 NT$200）；若必須一次報名全部日期，請勾選「多日期為同一完整活動」。';

  const status=String(s&&s.status||'關閉');
  const dates=_sessionDateRows(s&&s.dates_json);
  if(status!=='報名中'&&status!=='開放')return '';
  const basic=_validateSessionInput({name:s&&s.name,dates:safeJson(s&&s.dates_json,[]),status});
  if(basic)return basic;
  if(mods.workshopSlots && dates.some(d=>!String(d.start||'').trim()))return '此場啟用日期／時段模組，請先為每個可報名時段設定開始時間';
  if(mods.service && !mods.services.length)return '此場啟用服務項目模組，請至少建立一個服務項目';
  if(mods.resource && !mods.resources.length)return '此場啟用指定人員／資源模組，請至少建立一個可選資源';
  if(mods.participants && !mods.participantTypes.length)return '此場啟用票種／人數模組，請至少建立一個票種';
  if(mods.operatingMode==='booking'){
    if(!mods.workshopSlots)return '預約型正式開放前，請啟用日期／時段模組';
    if(!mods.payment)return '預約型正式開放前，請啟用付款模組';
    const bp=mods.bookingPolicy||{};
    if(bp.paymentMode==='deposit' && safeNum(bp.depositValue)<=0)return '訂金制的訂金金額／比例必須大於 0';
    const hasPrice=safeNum(s.fee)>0 || (Array.isArray(mods.services)&&mods.services.some(x=>safeNum(x.price)>0)) || dates.some(d=>safeNum(d.fee)>0);
    if(!hasPrice)return '預約型正式開放前，請設定大於 0 的正式服務／時段費用';
  }
  return '';
}

function _sessionBasePayload(b, includeDefaults=false) {
  const data = {};
  const put = (key, value, condition=true) => { if (condition) data[key] = value; };
  put('event_id', cleanEventId(b.eventId), includeDefaults || b.eventId !== undefined);
  put('name', String(b.name||'').trim(), includeDefaults || b.name !== undefined);
  put('region', String(b.region||'').trim(), includeDefaults || b.region !== undefined);
  put('dates_json', JSON.stringify(_sessionDateRows(b.dates)), includeDefaults || b.dates !== undefined);
  put('venue', String(b.venue||'').trim(), includeDefaults || b.venue !== undefined);
  put('fee', Number(b.fee)||0, includeDefaults || b.fee !== undefined);
  put('deposit', Number(b.deposit)||0, includeDefaults || b.deposit !== undefined);
  put('limit_count', Number(b.limit)||0, includeDefaults || b.limit !== undefined);
  put('max_stalls', Number(b.maxStalls)||0, includeDefaults || b.maxStalls !== undefined);
  put('status', String(b.status||'關閉').trim() || '關閉', includeDefaults || b.status !== undefined);
  put('need_review', b.needReview === true || b.needReview === 'true', includeDefaults || b.needReview !== undefined);
  put('modules_json', JSON.stringify(_sessionObject(b.modules, {})), includeDefaults || b.modules !== undefined);
  put('equip_json', JSON.stringify(_sessionObject(b.equip, {})), includeDefaults || b.equip !== undefined);
  put('basic_equip', String(b.basicEquip||''), includeDefaults || b.basicEquip !== undefined);
  put('custom_fields_json', JSON.stringify(_sessionArray(b.customFields)), includeDefaults || b.customFields !== undefined);
  put('addons_json', JSON.stringify(_sessionArray(b.addons)), includeDefaults || b.addons !== undefined);
  put('invoice_tax_json', JSON.stringify(_sessionObject(b.invoiceTax, {stall:true,equip:false,extra:false})), includeDefaults || b.invoiceTax !== undefined);
  put('refund_rules_json', b.refundRules == null || b.refundRules === '' ? null : JSON.stringify(_sessionObject(b.refundRules, {})), includeDefaults || b.refundRules !== undefined);
  put('theme', String(b.theme||''), includeDefaults || b.theme !== undefined);
  put('organizer', String(b.organizer||''), includeDefaults || b.organizer !== undefined);
  put('co_organizer', String(b.coorg||b.coOrganizer||''), includeDefaults || b.coorg !== undefined || b.coOrganizer !== undefined);
  put('cover_url', String(b.cover||''), includeDefaults || b.cover !== undefined);
  put('description', String(b.desc||''), includeDefaults || b.desc !== undefined);
  put('assigned_staff', _sessionTextList(b.assignedStaff).join(','), includeDefaults || b.assignedStaff !== undefined);
  put('agreement_required', agreementRequiredOn(b.agreementRequired), includeDefaults || b.agreementRequired !== undefined);
  put('agreement_title', String(b.agreementTitle||'報名合約／活動細則與攤商規範'), includeDefaults || b.agreementTitle !== undefined);
  put('agreement_content', String(b.agreementContent||''), includeDefaults || b.agreementContent !== undefined);
  put('agreement_version', String(b.agreementVersion||''), includeDefaults || b.agreementVersion !== undefined);
  put('agreement_updated_at', nowIso(), includeDefaults || b.agreementRequired !== undefined || b.agreementTitle !== undefined || b.agreementContent !== undefined || b.agreementVersion !== undefined);
  put('seat_pricing_enabled', b.seatPricingEnabled === true || b.seatPricingEnabled === 'true', includeDefaults || b.seatPricingEnabled !== undefined);
  put('seat_hold_hours', Math.max(1, Number(b.seatHoldHours)||24), includeDefaults || b.seatHoldHours !== undefined);
  put('seat_map_url', String(b.seatMapUrl||''), includeDefaults || b.seatMapUrl !== undefined);
  put('seat_assign_days_before', Math.max(3, Number(b.seatAssignDaysBefore)||7), includeDefaults || b.seatAssignDaysBefore !== undefined);
  put('venue_map_template_id', b.venueMapTemplateId ? String(b.venueMapTemplateId) : null, includeDefaults || b.venueMapTemplateId !== undefined);
  put('payment_profile_id', b.paymentProfileId ? String(b.paymentProfileId) : null, includeDefaults || b.paymentProfileId !== undefined);
  return data;
}

async function hCreateSession(env, b) {
  const TENANT = b && b._tenantId;
  if (!await verifyStaff(env,b.email,b.token,TENANT,'sessions')) return jsonErr('無權限');
  const lock = await checkTenantLocked(env, TENANT);
  if (lock.locked) return jsonErr(lock.reason || '此主辦空間目前為唯讀鎖定');
  const err = _validateSessionInput(b);
  if (err) return jsonErr(err);
  const limitErr = await checkTrialSessionLimit(env, TENANT);
  if (limitErr) return jsonErr(limitErr);

  const id = genId('SES');
  const data = {
    id,
    tenant_id: TENANT,
    current_count: 0,
    force_cancel: false,
    force_cancelled: false,
    created_at: nowIso(),
    updated_at: nowIso(),
    ..._sessionBasePayload(b, true),
  };
  const openErr=await _validateSessionDependenciesForOpen(env,TENANT,data);if(openErr)return jsonErr(openErr);
  await dbInsert(env, 'sessions', data);
  await syncNormalizedSessionCatalogs(env,TENANT,data);
  return jsonOk({success:true,id,session:formatSession({...data})});
}

async function hUpdateSession(env, b) {
  const TENANT = b && b._tenantId;
  if (!await verifyStaff(env,b.email,b.token,TENANT,'sessions',String(b.id||''))) return jsonErr('無權限');
  const lock = await checkTenantLocked(env, TENANT);
  if (lock.locked) return jsonErr(lock.reason || '此主辦空間目前為唯讀鎖定');
  if (!b.id) return jsonErr('缺少場次 id');
  const currentRows = await dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(TENANT)}&id=eq.${encodeURIComponent(b.id)}&select=*`);
  if (!currentRows.length) return jsonErr('找不到場次');
  const current=currentRows[0];
  const patch = {..._sessionBasePayload(b, false), updated_at:nowIso()};
  const simulated={...current,...patch};
  const basicErr=_validateSessionInput({name:simulated.name,dates:safeJson(simulated.dates_json,[]),status:simulated.status});
  if(basicErr)return jsonErr(basicErr);
  const openErr=await _validateSessionDependenciesForOpen(env,TENANT,simulated);if(openErr)return jsonErr(openErr);
  if(simulated.status==='報名中'||simulated.status==='開放'){const ent=await ensureOperatingEntitlement(env,TENANT,simulated);if(!ent.ok)return jsonErr(`尚未取得正式營運權：本次需 NT$${ent.amount}，可用合作額度 NT$${ent.balance||0}`)}
  await dbUpdate(env,'sessions',`id=eq.${encodeURIComponent(b.id)}&tenant_id=eq.${encodeURIComponent(TENANT)}`, patch);
  const rows = await dbGet(env,'sessions',`id=eq.${encodeURIComponent(b.id)}&tenant_id=eq.${encodeURIComponent(TENANT)}&select=*`);
  if(rows[0])await syncNormalizedSessionCatalogs(env,TENANT,rows[0]);
  return jsonOk({success:true,id:b.id,session:rows[0]?formatSession(rows[0]):null});
}

// deleteSession
async function hDeleteSession(env,b){
  const TENANT=b&&b._tenantId;if(!await verifyStaff(env,b.email,b.token,TENANT,'superadmin'))return jsonErr('只有主辦擁有者可以刪除空白場次');
  const sid=b.id||b.sessionId;
  const [regs,pays,items]=await Promise.all([
    dbGet(env,'registrations',`tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sid)}&select=id&limit=1`).catch(()=>[]),
    dbGet(env,'payments',`tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sid)}&select=id&limit=1`).catch(()=>[]),
    dbGet(env,'registration_items',`tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(sid)}&select=id&limit=1`).catch(()=>[])
  ]);
  if(regs.length||pays.length||items.length)return jsonErr('此場次已有報名或金流紀錄，為保留財務與歷史資料不可刪除，請改用「封存」。');
  await dbDelete(env,'sessions',`id=eq.${encodeURIComponent(sid)}&tenant_id=eq.${TENANT}`);return jsonOk({success:true});
}
// toggleSession
async function hToggleSession(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'sessions')) return jsonErr('無權限');
  const id = b.id||b.sessionId;
  const rows = await dbGet(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(id)}&select=*`);
  if (!rows.length) return jsonErr('找不到場次');
  const next = rows[0].status==='關閉'?'報名中':'關閉';
  const err=await _validateSessionDependenciesForOpen(env,TENANT,{...rows[0],status:next});if(err)return jsonErr(err);
  if(next==='報名中'||next==='開放'){const ent=await ensureOperatingEntitlement(env,TENANT,rows[0]);if(!ent.ok)return jsonErr(`尚未取得正式營運權：本次需 NT$${ent.amount}，可用合作額度 NT$${ent.balance||0}`)}
  await dbUpdate(env,'sessions',`id=eq.${encodeURIComponent(id)}&tenant_id=eq.${TENANT}`,{status:next});
  return jsonOk({success:true, status:next});
}
// toggleSessionStatus（直接設定指定 status）
async function hToggleSessionStatus(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'sessions')) return jsonErr('無權限');
  const targetStatus=b.status||'已截止';
  const rows=await dbGet(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.sessionId)}&select=*`);
  if(!rows.length)return jsonErr('找不到場次');
  const err=await _validateSessionDependenciesForOpen(env,TENANT,{...rows[0],status:targetStatus});if(err)return jsonErr(err);
  if(targetStatus==='報名中'||targetStatus==='開放'){const ent=await ensureOperatingEntitlement(env,TENANT,rows[0]);if(!ent.ok)return jsonErr(`尚未取得正式營運權：本次需 NT$${ent.amount}，可用合作額度 NT$${ent.balance||0}`)}
  await dbUpdate(env,'sessions',`id=eq.${encodeURIComponent(b.sessionId)}&tenant_id=eq.${TENANT}`,{status:targetStatus});
  return jsonOk({success:true,status:targetStatus});
}
// copySession
async function hCopySession(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'sessions')) return jsonErr('無權限');
  const limitErr = await checkTrialSessionLimit(env, TENANT);
  if (limitErr) return jsonErr(limitErr);
  const rows = await dbGet(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.id)}&select=*`);
  if (!rows.length) return jsonErr('找不到場次');
  const src = {...rows[0]};
  const newId = genId('SES');
  src.id=newId; src.name=(src.name||'')+'（複製）';
  src.current_count=0; src.status='關閉';
  src.force_cancel=false; src.force_cancel_target_id=null; src.force_cancel_deadline=null;
  src.created_at=nowIso();
  await dbInsert(env,'sessions',src);
  return jsonOk({success:true,id:newId});
}



function paymentTermsForSession(sessionRow){
  const mods=normalizeSessionModules(safeJson(sessionRow&&sessionRow.modules_json,{}));
  const p=(mods.paymentTerms&&typeof mods.paymentTerms==='object')?mods.paymentTerms:{};
  const deadlineHours=Math.max(1,Math.min(720,parseInt(p.deadlineHours,10)||PAY_DEADLINE_HOURS));
  const reminderHours=Math.max(0,Math.min(deadlineHours,parseInt(p.reminderHours,10)||REMINDER_HOURS));
  return {deadlineHours,reminderHours};
}
function paymentDeadlinePayload(sessionRow,approvedAtIso,total){
  if(!(safeNum(total)>0)) return {approved_at:approvedAtIso,payment_due_at:null,payment_reminder_at:null,payment_terms_snapshot:{}};
  const t=paymentTermsForSession(sessionRow),base=new Date(approvedAtIso);
  return {approved_at:approvedAtIso,
    payment_due_at:new Date(base.getTime()+t.deadlineHours*3600000).toISOString(),
    payment_reminder_at:new Date(base.getTime()+t.reminderHours*3600000).toISOString(),
    payment_terms_snapshot:t};
}
function dueAtForReg(reg){
  if(reg&&reg.payment_due_at){const d=new Date(reg.payment_due_at);if(!isNaN(d))return d;}
  const s=safeJson(reg&&reg.payment_terms_snapshot,{}),h=Math.max(1,parseInt(s.deadlineHours,10)||PAY_DEADLINE_HOURS);
  const b=new Date((reg&&reg.approved_at)||(reg&&reg.created_at)||0);return isNaN(b)?null:new Date(b.getTime()+h*3600000);
}
function reminderAtForReg(reg){
  if(reg&&reg.payment_reminder_at){const d=new Date(reg.payment_reminder_at);if(!isNaN(d))return d;}
  const s=safeJson(reg&&reg.payment_terms_snapshot,{}),h=Math.max(0,parseInt(s.reminderHours,10)||REMINDER_HOURS);
  const b=new Date((reg&&reg.approved_at)||(reg&&reg.created_at)||0);return isNaN(b)?null:new Date(b.getTime()+h*3600000);
}

async function applyReviewStatusChange(env, TENANT, reg, nextStatus, adminNote) {
  const beforeActive = isActiveForCapacity(reg);
  const upd = {review_status: nextStatus};
  if (adminNote) upd.admin_note = adminNote;
  if (String(nextStatus||'') === '已錄取') {
    const sessionRow = await getSessionRow(env, reg.session_id, TENANT).catch(()=>null);
    if (sessionRow) {
      try{const snap=await ensurePaymentSnapshotForReg(env,TENANT,reg,sessionRow,{forceWrite:true});Object.assign(upd,_paymentSnapshotDbPayload(snap));}
      catch(e){await writeAuditLog(env,TENANT,'','system','approval_payment_snapshot_deferred','registrations',reg.id,null,{message:e&&e.message?e.message:String(e)},{});}
      const approvedAt=nowIso();
      Object.assign(upd,paymentDeadlinePayload(sessionRow,approvedAt,_officialAmount(reg)));
    }
  }
  await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(reg.id)}&tenant_id=eq.${TENANT}`,upd);
  const nextReg = {...reg, review_status: nextStatus};
  const afterActive = isActiveForCapacity(nextReg);
  if (beforeActive !== afterActive) {
    await adjustRegistrationCapacity(env, TENANT, reg, afterActive ? (safeNum(reg.stall_count)||1) : -(safeNum(reg.stall_count)||1));
    await writeAuditLog(env, TENANT, '', 'system', 'review_status_capacity_adjust', 'registrations', reg.id, {review_status:reg.review_status}, {review_status:nextStatus}, {capacity_delta:afterActive ? (safeNum(reg.stall_count)||1) : -(safeNum(reg.stall_count)||1)});
  }
}

// updateRegStatus（單筆）
async function hUpdateRegStatus(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'review')) return jsonErr('無權限');
  const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  if (!rows.length) return jsonErr('找不到報名');
  const reg = rows[0];
  try {
    await applyReviewStatusChange(env, TENANT, reg, b.status, b.adminNote);
  } catch(e) {
    return jsonErr(e && e.message ? e.message : '審核失敗');
  }
  await sendStatusEmail(env, b.status, reg);
  return jsonOk({success:true});
}

// batchUpdateStatus（批次）
async function hBatchUpdateStatus(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'review')) return jsonErr('無權限');
  const results=[];
  for (const regId of (b.regIds||[])) {
    try {
      const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(regId)}&select=*`);
      if (!rows.length) { results.push({error:'找不到報名'}); continue; }
      const reg = rows[0];
      await applyReviewStatusChange(env, TENANT, reg, b.status, b.adminNote);
      await sendStatusEmail(env, b.status, reg);
      results.push({success:true});
    } catch(e) { results.push({error:e.message}); }
  }
  return jsonOk({success:true, results});
}

// 共用：依審核狀態寄信
async function sendStatusEmail(env, status, reg) {
  const TENANT = (reg && reg.tenant_id) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  try {
    const sesName = await getSessionName(env, reg.session_id, TENANT);
    const sesType = await getSessionType(env, reg.session_id, TENANT);
    const dn = getDisplayName(reg.name, reg.brand_name||'', sesType);
    const tc = await getTenantCtx(env, TENANT);
    if (status==='已錄取') {
      const sr = await dbGet(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(reg.session_id)}&select=basic_equip`);
      const be = sr.length?sr[0].basic_equip||'':'';
      await mailApproval(env,reg.email,dn,sesName,reg.id,Number(reg.amount)||0,reg.stall_count,safeJson(reg.selected_dates_json,[]),reg.equipment_json,be,tc);
    }
    if (status==='不錄取') await mailRejection(env,reg.email,dn,sesName,tc);
    await recordNotification(env,{tenantId:TENANT,unitId:reg.operation_unit_id||null,sessionId:reg.session_id,registrationId:reg.id,email:reg.email,eventKey:status==='已錄取'?'registration_approved':'registration_rejected',title:status==='已錄取'?'已錄取':'報名結果通知',body:status==='已錄取'?'您的報名／預約已錄取，請依付款期限完成後續作業。':'本次報名未錄取。',meta:{reviewStatus:status}}).catch(()=>{});
  } catch(e) {
    // 原本為 catch {} 全部吞掉：寄信失敗時畫面仍顯示成功，完全查不到原因。
    console.error('sendStatusEmail error:', status, reg && reg.email, e && e.message ? e.message : String(e)); logError(env, {source:'sendStatusEmail', message:'sendStatusEmail error:', error:e && e.message ? e.message : String(e)});
  }
}

// approveReg（與 updateRegStatus 功能相同，保留接口相容性）
async function hApproveReg(env,b){
  const TENANT=(b&&b._tenantId);
  if(!await verifyStaff(env,b.email,b.token,TENANT,'review'))return jsonErr('無權限');
  const rows=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  if(!rows.length)return jsonErr('找不到報名');
  const reg=rows[0],group=await getBundleGroupRegs(env,TENANT,reg);
  const status=b.status||(b.approved?'已錄取':'不錄取');
  for(const g of group){
    try{await applyReviewStatusChange(env,TENANT,g,status,b.adminNote)}
    catch(e){return jsonErr(e&&e.message?e.message:'審核失敗')}
  }
  for(const g of group){
    await sendStatusEmail(env,status,g).catch(()=>{});
    await refreshSessionStatsSafe(env,TENANT,g.session_id);
  }
  return jsonOk({success:true,status,bundleCount:group.length});
}

async function runPaymentConfirmSideEffects(env,TENANT,regId,amount){
  const rr=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(regId)}&select=*`);
  if(!rr.length)return;
  const reg=rr[0],now=reg.paid_at||nowIso();
  const paySesRows=await dbGet(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(reg.session_id)}&select=*`).catch(()=>[]);
  try{
    await dbUpdate(env,'stalls',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(regId)}&status=eq.預留`,{status:'鎖定',seat_hold_expires_at:null});
    if(String(reg.seat_choice_intent||'auto')==='paid'){
      await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(regId)}`,{seat_choice_status:'locked',seat_hold_expires_at:null});
    }else if(!reg.stall_number){
      const ses=paySesRows[0];
      if(ses&&sessionAutoAssignWindow(ses).active){
        await autoAssignSeatForPaidReg(env,TENANT,{...reg,payment_status:'已繳費',paid_at:now});
        await dbUpdate(env,'sessions',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(reg.session_id)}`,{seat_assign_done_at:nowIso()}).catch(()=>{});
      }
    }
  }catch(e){logError(env,{source:'runPaymentConfirmSideEffects',message:'seat lock/auto assign failed',error:e&&e.message?e.message:e});}
  try{
    const sesName=await getSessionName(env,reg.session_id,TENANT),sesType=await getSessionType(env,reg.session_id,TENANT),dn=getDisplayName(reg.name,reg.brand_name||'',sesType),tc=await getTenantCtx(env,TENANT);
    let equipStr='';try{const eq=safeJson(reg.equipment_json,{});equipStr=Object.entries(eq).filter(([k,v])=>v>0).map(([k,v])=>k+'x'+v).join('、');}catch(_e){}
    await mailPaymentConfirm(env,reg.email,dn,sesName,amount,equipStr,reg.stall_number||'',tc);
  }catch(e){logError(env,{source:'runPaymentConfirmSideEffects',message:'payment confirm mail failed',error:e&&e.message?e.message:e});}
  await recordNotification(env,{tenantId:TENANT,unitId:reg.operation_unit_id||null,sessionId:reg.session_id,registrationId:reg.id,email:reg.email,eventKey:'payment_confirmed',title:'付款已確認',body:'您的付款已完成確認。',meta:{amount:safeNum(amount),paymentStatus:reg.payment_status}}).catch(()=>{});
  await refreshSessionStatsSafe(env,TENANT,reg.session_id);
}

// confirmPayment（後台手動確認）
async function hConfirmPayment(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token, TENANT, 'finance')) return jsonErr('無權限');
  const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  if (!rows.length) return jsonErr('找不到報名');
  const reg = rows[0];
  // 合併結帳：先完整快照，再逐筆執行『不做外部副作用』的金流核心；任一失敗就整組補償回復。
  if (!b._groupDone) {
    const gid=String(reg.payment_group_id||'').trim();
    if(gid){
      const grp=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&payment_group_id=eq.${encodeURIComponent(gid)}&select=*`).catch(()=>[]);
      const targets=grp.filter(g=>!isPaidStatus(g.payment_status));
      if(!targets.length)return jsonErr('此組合已完成繳費，不能重複確認');
      for(const g of targets){
        if(_reviewStatus(g)!=='已錄取')return jsonErr('組合內仍有場次尚未錄取，不能整組確認付款');
        if(isCapacityInactiveTransferStatus(g.transfer_status))return jsonErr('組合內已有報名進入退費流程，不能整組確認付款');
      }
      const snap=[];
      for(const g of targets){
        const payments=await dbGet(env,'payments',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(g.id)}&select=*`).catch(()=>[]);
        const allocs=await dbGet(env,'payment_allocations',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(g.id)}&select=*`).catch(()=>[]);
        const ledger=await dbGet(env,'finance_ledger',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(g.id)}&select=*`).catch(()=>[]);
        snap.push({reg:{...g},payments,allocs,ledger});
      }
      const applied=[];
      try{
        for(const g of targets){
          const rr=await hConfirmPayment(env,{...b,regId:g.id,_groupDone:true,_deferSideEffects:true});
          const jj=await rr.json();
          if(jj&&jj.error)throw new Error(jj.error);
          applied.push({id:g.id,amount:safeNum(jj&&jj.amount)});
        }
      }catch(e){
        for(const x of snap){
          const patch={...x.reg};delete patch.id;delete patch.tenant_id;
          await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(x.reg.id)}`,patch).catch(()=>{});
          await dbDelete(env,'payments',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(x.reg.id)}`).catch(()=>{});
          for(const row of x.payments)await dbInsert(env,'payments',row).catch(()=>{});
          await dbDelete(env,'payment_allocations',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(x.reg.id)}`).catch(()=>{});
          for(const row of x.allocs)await dbInsert(env,'payment_allocations',row).catch(()=>{});
          await dbDelete(env,'finance_ledger',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(x.reg.id)}`).catch(()=>{});
          for(const row of x.ledger)await dbInsert(env,'finance_ledger',row).catch(()=>{});
        }
        return jsonErr('組合付款確認失敗，系統已回復整組金流狀態：'+(e&&e.message?e.message:'資料寫入失敗'));
      }
      for(const x of applied)await runPaymentConfirmSideEffects(env,TENANT,x.id,x.amount).catch(e=>logError(env,{source:'hConfirmPayment',message:'group payment side effect failed',error:e&&e.message?e.message:e}));
      return jsonOk({success:true,bundleCount:targets.length,paymentGroupId:gid});
    }
  }
  if (_reviewStatus(reg) !== '已錄取') return jsonErr('尚未錄取，不能確認付款');
  if (isPaidStatus(_payStatus(reg)) && safeNum(reg.paid_amount)+0.0001>=safeNum(reg.total_amount||reg.amount)) return jsonErr('此報名已完成繳費，不能重複確認');
  if (isCapacityInactiveTransferStatus(reg.transfer_status)) return jsonErr('此報名已進入退費流程，不能確認付款');
  const now = nowIso();
  const method = b.method || reg.payment_method || '手動確認';
  const [paySesRows, payItemMap] = await Promise.all([
    dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(reg.session_id)}&select=*`).catch(()=>[]),
    _getRegistrationItemsForRegs(env, [reg]).catch(()=>({})),
  ]);
  const payMoney = _regFinanceAmounts(reg, paySesRows[0] || {}, payItemMap && payItemMap[reg.id]);
  const officialDue=payMoney.cashTotal||safeNum(reg.total_amount)||safeNum(reg.amount);
  const dueBefore=Math.max(0,officialDue-safeNum(reg.paid_amount));
  const amount=Math.max(0,Math.min(dueBefore||officialDue,safeNum(reg.payment_report_amount)||dueBefore||officialDue));
  const paySnap = await ensurePaymentSnapshotForReg(env,TENANT,reg,paySesRows[0]||{}, {writeIfSafe:true}).catch(()=>_paymentSnapshotFromReg(reg));
  const newPaid=safeNum(reg.paid_amount)+amount,_bookSnap=selectedModuleSnapshot(reg),_secureDue=safeNum(_bookSnap.amountDueNow),nextPayStatus=newPaid+0.0001>=officialDue?'已繳費':(_secureDue>0&&newPaid+0.0001>=_secureDue?'已付訂金':'未繳費');
  const corePaymentsBefore=await dbGet(env,'payments',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(b.regId)}&select=*`).catch(()=>[]);
  const coreAllocsBefore=await dbGet(env,'payment_allocations',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(b.regId)}&select=*`).catch(()=>[]);
  const coreLedgerBefore=await dbGet(env,'finance_ledger',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(b.regId)}&select=*`).catch(()=>[]);
  let confirmedPaymentId='';
  try{
    await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(b.regId)}&tenant_id=eq.${TENANT}`,{
      payment_status:nextPayStatus,payment_method:method,paid_at:(nextPayStatus==='已繳費'||nextPayStatus==='已付訂金')?now:(reg.paid_at||null),
      paid_amount:newPaid,..._paymentSnapshotDbPayload(paySnap),
    });
    const pendingPayRows=await dbGet(env,'payments',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(b.regId)}&status=eq.%E5%BE%85%E7%A2%BA%E8%AA%8D&select=id`);
    if(pendingPayRows.length){
      confirmedPaymentId=String(pendingPayRows[0].id);
      await dbUpdate(env,'payments',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(confirmedPaymentId)}`,{registration_id:b.regId,session_id:reg.session_id,operation_unit_id:reg.operation_unit_id||null,email:reg.email,amount,method,status:'已確認',trade_no:b.merchantTradeNo||reg.payment_last5||'',paid_at:now,payment_profile_id:(paySnap&&paySnap.payment_profile_id)||null,payment_profile_snapshot:paySnap||{}});
      for(const extra of pendingPayRows.slice(1)){
        await dbUpdate(env,'payments',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(extra.id)}`,{amount:0,status:'已作廢',admin_note:'同一報名重複付款回報，確認付款時合併作廢'}).catch(()=>{});
      }
    }else{
      confirmedPaymentId=genId('PAY');
      await dbInsert(env,'payments',{id:confirmedPaymentId,tenant_id:TENANT,registration_id:b.regId,session_id:reg.session_id,operation_unit_id:reg.operation_unit_id||null,email:reg.email,amount,method,status:'已確認',trade_no:b.merchantTradeNo||reg.payment_last5||'',paid_at:now,created_at:now,payment_profile_id:(paySnap&&paySnap.payment_profile_id)||null,payment_profile_snapshot:paySnap||{}});
    }
    if(amount>0){
      await dbInsert(env,'payment_allocations',{id:genId('PAL'),tenant_id:TENANT,payment_id:confirmedPaymentId||null,registration_id:b.regId,session_id:reg.session_id,operation_unit_id:reg.operation_unit_id||null,allocation_type:'payment',amount,created_at:now});
      await writeFinanceLedger(env,TENANT,{registrationId:b.regId,sessionId:reg.session_id,paymentId:confirmedPaymentId||null,entryType:'payment_received',amount,direction:'credit',memo:'確認收款',strict:true});
    }
  }catch(e){
    await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}`,{
      payment_status:reg.payment_status||'',payment_method:reg.payment_method||'',paid_at:reg.paid_at||null,paid_amount:safeNum(reg.paid_amount),
      payment_profile_id:reg.payment_profile_id||null,payment_profile_snapshot:safeJson(reg.payment_profile_snapshot,{}),
      payment_owner_mode:reg.payment_owner_mode||'',payment_methods_allowed:safeJson(reg.payment_methods_allowed,{}),
      bank_account_snapshot:safeJson(reg.bank_account_snapshot,{}),linepay_config_snapshot:safeJson(reg.linepay_config_snapshot,{}),
      card_config_snapshot:safeJson(reg.card_config_snapshot,{}),payment_snapshot_created_at:reg.payment_snapshot_created_at||null
    }).catch(()=>{});
    await dbDelete(env,'payments',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(b.regId)}`).catch(()=>{});
    for(const row of corePaymentsBefore)await dbInsert(env,'payments',row).catch(()=>{});
    await dbDelete(env,'payment_allocations',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(b.regId)}`).catch(()=>{});
    for(const row of coreAllocsBefore)await dbInsert(env,'payment_allocations',row).catch(()=>{});
    await dbDelete(env,'finance_ledger',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(b.regId)}`).catch(()=>{});
    for(const row of coreLedgerBefore)await dbInsert(env,'finance_ledger',row).catch(()=>{});
    return jsonErr('確認付款失敗，系統已回復本次完整金流狀態：'+(e&&e.message?e.message:'金流資料寫入失敗'));
  }
  if(b._deferSideEffects)return jsonOk({success:true,deferred:true,amount,newPaid,nextPayStatus});
  await runPaymentConfirmSideEffects(env,TENANT,b.regId,amount).catch(e=>logError(env,{source:'hConfirmPayment',message:'payment side effect failed',error:e&&e.message?e.message:e}));
  return jsonOk({success:true,amount,newPaid,nextPayStatus});
}

// markPaymentScreenshot（後台標記已回報客服／已收到匯款截圖）
async function hMarkPaymentScreenshot(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token, TENANT)) return jsonErr('無權限');
  const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  if (!rows.length) return jsonErr('找不到報名');
  const reg = rows[0];
  if (isPaidStatus(_payStatus(reg))) return jsonErr('此報名已確認付款，不需再標記客服回報');
  if (_reviewStatus(reg)==='已取消') return jsonErr('此報名已取消，不能標記客服回報');
  const now = nowIso();
  const oldNote = String(reg.admin_note||'').trim();
  const append = `[後台] 已回報客服／已收到匯款截圖 ${nowTaipeiText()}`;
  const data = {
    payment_screenshot_status:'已回報客服',
    payment_screenshot_received_at:now,
    admin_note:(oldNote ? oldNote + ' ' : '') + append,
  };
  await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(b.regId)}&tenant_id=eq.${TENANT}`,data);
  try {
    await dbUpdate(env,'payments',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(b.regId)}&status=eq.待確認`,{
      screenshot_status:'已回報客服',
      screenshot_received_at:now,
      admin_note:append,
    });
  } catch(e) { console.error('payments screenshot optional update skipped', e&&e.message?e.message:e); logError(env, {source:'hMarkPaymentScreenshot', message:'payments screenshot optional update skipped', error:e&&e.message?e.message:e}); }
  return jsonOk({success:true, paymentScreenshotStatus:'已回報客服', paymentScreenshotReceivedAt:now});
}


// sendPaymentReminder（後台手動寄出待付款提醒，支援 email_templates 與 [按鈕:...] 語法）
async function hSendPaymentReminder(env, b) {
  const TENANT = (b && b._tenantId);
  const regId = b.regId || b.id;
  if (!regId) return jsonErr('缺少 regId');
  const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(regId)}&select=*`);
  if (!rows.length) return jsonErr('找不到報名');
  const reg = rows[0];
  const sessionId = b.sessionId || b.session_id || reg.session_id;
  if (!await verifyStaff(env,b.email,b.token,TENANT,'review',sessionId)) return jsonErr('無權限');
  if (!reg.email) return jsonErr('此報名沒有 Email，無法寄信');
  if (_reviewStatus(reg) !== '已錄取') return jsonErr('尚未錄取，不適合寄待付款提醒');
  if (isPaidStatus(_payStatus(reg)) || _payStatus(reg) === '免費') return jsonErr('此報名已完成付款或為免費，不需寄待付款提醒');
  if (isCapacityInactiveTransferStatus(reg.transfer_status) || _reviewStatus(reg)==='已取消') return jsonErr('此報名已取消或進入退費流程，不能寄待付款提醒');
  const sesName = await getSessionName(env, sessionId, TENANT);
  const sesType = await getSessionType(env, sessionId, TENANT);
  const tc = await getTenantCtx(env, TENANT);
  const selectedDates = safeJson(reg.selected_dates_json, []);
  const datesText = Array.isArray(selectedDates) ? selectedDates.map(d => typeof d==='object' ? (d.date || d.value || d.label || '') : String(d||'')).filter(Boolean).join('、') : String(selectedDates || '');
  const displayName = getDisplayName(reg.name, reg.brand_name||'');
  const amount = Number(reg.amount || reg.total_amount || reg.registration_total_amount || 0) || 0;
  const result = await mailDeadlineReminder(env, reg.email, displayName, sesName, reg.id, amount, selectedDates, reg.equipment_json, '', tc);
  if (result && result.disabled) return jsonErr('這封信目前已停用，未寄出');
  if (!result || !result.ok) return jsonErr('寄信失敗：'+((result&&result.error)||'未知錯誤'));
  const oldNote = String(reg.admin_note||'').trim();
  const append = `[後台] 已寄出待付款提醒 ${nowTaipeiText()}`;
  await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(reg.id)}`,{reminder_sent:true,admin_note:(oldNote ? oldNote + ' ' : '') + append}).catch(()=>{});
  return jsonOk({success:true, to:reg.email, subject});
}

// adminCancelReg（後台取消未繳費／待確認報名，保留資料不刪除）
async function hAdminCancelReg(env, b) {
  const TENANT = (b && b._tenantId);
  if (!await verifyStaff(env,b.email,b.token,TENANT,'review',b.sessionId||b.session_id||'')) return jsonErr('無權限');
  const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  if (!rows.length) return jsonErr('找不到報名');
  const reg = rows[0];
  const group = await getBundleGroupRegs(env, TENANT, reg);
  const now = nowIso();
  const reason = String(b.reason || b.cancelReason || b.cancel_reason || '').trim().slice(0,300);

  // 已完成退費／已取消視為冪等成功，不重複扣名額或改金流。
  const pending = group.filter(g => _reviewStatus(g)!=='已取消' && !['已退費','refunded'].includes(String(g.transfer_status||'')));
  if (!pending.length) return jsonOk({success:true, alreadyCancelled:true, bundleCount:group.length});

  // 只要組合內任一筆已有實收，就整組進退款待辦；付款歷史與 paid_amount 保留不抹除。
  const needsRefund = pending.some(g => isPaidStatus(_payStatus(g)) || safeNum(g.paid_amount)>0);

  for (const g of pending) {
    const wasActive = isActiveForCapacity(g);
    const paid = isPaidStatus(_payStatus(g)) || safeNum(g.paid_amount)>0;
    const oldNote = String(g.admin_note||'').trim();
    const label = needsRefund ? '[後台] 主辦取消報名，已轉退款待處理' : '[後台] 主辦取消報名';
    const append = `${label}${group.length>1?'（組合套組同進退）':''}${reason?'｜原因：'+reason:''} ${nowTaipeiText()}`;
    const upd = {
      review_status:'已取消',
      transfer_status: needsRefund ? '退費中' : null,
      transfer_chosen_at: needsRefund ? now : (g.transfer_chosen_at||null),
      stall_number:null,
      seat_choice_status:'released',
      seat_choice_type:null,
      seat_hold_expires_at:null,
      admin_note:(oldNote ? oldNote + ' ' : '') + append,
    };
    if (!paid && !needsRefund) {
      upd.payment_status = '已取消';
      upd.payment_report_amount = 0;
      upd.payment_last5 = null;
      upd.payment_reported_at = null;
    }
    await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(g.id)}&tenant_id=eq.${TENANT}`,upd);
    if (wasActive) await adjustRegistrationCapacity(env,TENANT,g,-(safeNum(g.stall_count)||1));
    await releaseRegistrationSeats(env,TENANT,g,needsRefund?'admin_cancel_refund_pending':'admin_cancel');
    await releaseRegistrationTimeslots(env,TENANT,g);
    if (!needsRefund) {
      try { await dbUpdate(env,'payments',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(g.id)}&status=eq.%E5%BE%85%E7%A2%BA%E8%AA%8D`,{status:'已取消'}); } catch(e) {}
    }
    await writeAuditLog(env,TENANT,b.email||'','organizer_admin',needsRefund?'admin_cancel_to_refund':'admin_cancel','registrations',g.id,
      {review_status:g.review_status,payment_status:g.payment_status,transfer_status:g.transfer_status},upd,
      {reason,bundle_group:group.length>1,paid_amount:safeNum(g.paid_amount),capacity_delta:wasActive?-(safeNum(g.stall_count)||1):0});
  }

  for(const sid of [...new Set(pending.map(x=>x.session_id).filter(Boolean))])await refreshSessionStatsSafe(env,TENANT,sid);
  if (needsRefund) {
    // 寄出退款申請已收到通知；主辦可直接在退款待辦完成後續確認。
    for (const g of pending) {
      if (!(isPaidStatus(_payStatus(g)) || safeNum(g.paid_amount)>0) || !g.email) continue;
      try {
        const sesName=await getSessionName(env,g.session_id,TENANT);
        const tc=await getTenantCtx(env,TENANT);
        await mailRefundRequestReceived(env,g.email,getDisplayName(g.name,g.brand_name||'',await getSessionType(env,g.session_id,TENANT)),sesName,tc);
      } catch(e) { logError(env,{source:'hAdminCancelReg',action:'adminCancelReg',tenantId:TENANT,regId:g.id,message:'主辦取消後退款通知寄送失敗',error:e&&e.message?e.message:e}); }
    }
    return jsonOk({success:true,status:'已取消',refundPending:true,transferStatus:'退費中',bundleCount:group.length});
  }
  return jsonOk({success:true,status:'已取消',refundPending:false,bundleCount:group.length});
}

// refundDeposit
async function hRefundDeposit(env,b){
  const TENANT=b&&b._tenantId;if(!await verifyStaff(env,b.email,b.token,TENANT,'finance'))return jsonErr('無權限');
  const rows=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);if(!rows.length)return jsonErr('找不到報名');
  const reg=rows[0];if(String(reg.deposit_refunded||'')==='已退押金')return jsonErr('此筆押金已完成退還');
  if(['申請退費','退費中','已退費'].includes(String(reg.transfer_status||'')))return jsonErr('退費中或已退費不可另走退押金');
  const ses=await getSessionRow(env,reg.session_id,TENANT).catch(()=>null),split=_receivedSplitForReg(reg,ses||{},null);
  const amount=Math.max(0,Math.min(split.depositReceived,safeNum(reg.deposit)||safeNum(ses&&ses.deposit)));if(amount<=0)return jsonErr('此筆沒有已實收且可退的押金');
  await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(b.regId)}&tenant_id=eq.${TENANT}`,{deposit_refunded:'已退押金'});
  await writeFinanceLedger(env,TENANT,{registrationId:b.regId,sessionId:reg.session_id,entryType:'deposit_refund',amount,direction:'debit',memo:'退還押金'});
  await refreshSessionStatsSafe(env,TENANT,reg.session_id);return jsonOk({success:true,amount});
}

// checkin
// ── 報到共用核心：後台「現場」tab 與工讀生通行碼頁共用同一份規則 ──
// 規則：報到必須「已錄取」＋「已繳費或免費」＋非退費流程中；取消報到一律寫「未報到」。
function checkinGuard(reg, undo){
  if (undo) return '';
  if (_reviewStatus(reg) !== '已錄取') return '尚未錄取，不能報到';
  if (!(isBookingSecuredStatus(_payStatus(reg)) || _payStatus(reg) === '免費')) return '尚未完成必要付款，不能報到';
  if (['申請退費','已退費'].includes(String(reg.transfer_status||''))) return '此報名已進入退費流程，不能報到';
  return '';
}
function checkinData(undo, now){
  return undo ? {checkin_status:'未報到', checkin_at:null}
              : {checkin_status:'已報到', checkin_at:now};
}

async function hCheckin(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'checkin')) return jsonErr('無權限');
  const undo = b.undo===true||b.undo==='true';
  const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=review_status,payment_status,transfer_status`);
  if (!rows.length) return jsonErr('找不到報名');
  const reg = rows[0];
  const err = checkinGuard(reg, undo);
  if (err) return jsonErr(err);
  const now = nowIso();
  await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(b.regId)}&tenant_id=eq.${TENANT}`, checkinData(undo, now));
  const operator = await staffDisplayName(env, TENANT, b.email);
  await dbInsert(env,'seat_operation_logs',{ id: genId('OPL'), tenant_id: TENANT, session_id: (b.sessionId||null), registration_id: b.regId, stall_id: null, action: undo?'undoCheckin':'checkin', operator_type:'admin', operator_id: operator, note: null, created_at: now }).catch(()=>{});
  return jsonOk({success:true, undo});
}

async function hUpdateRegistrationAction(env, b) {
  const TENANT = (b && b._tenantId);
  const regId = b.regId || b.id;
  const action = String(b.regAction || b.actionName || b.mode || '').trim();
  if (!regId) return jsonErr('缺少 regId');
  const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(regId)}&select=*`);
  if (!rows.length) return jsonErr('找不到報名');
  const reg = rows[0];
  const sessionId = b.sessionId || b.session_id || reg.session_id;
  if (!await verifyStaff(env,b.email,b.token,TENANT,'',sessionId)) return jsonErr('無權限');
  if (action === 'approve') return hApproveReg(env,{...b,regId,status:'已錄取',approved:true,sessionId});
  if (action === 'reject') return hApproveReg(env,{...b,regId,status:'不錄取',approved:false,sessionId});
  if (action === 'waitlist') return hApproveReg(env,{...b,regId,status:'備取',sessionId});
  if (action === 'markPaymentReported') return hMarkPaymentScreenshot(env,{...b,regId,sessionId});
  if (action === 'confirmPayment') return hConfirmPayment(env,{...b,regId,sessionId});
  if (action === 'cancelUnpaid') return hAdminCancelReg(env,{...b,regId,sessionId});
  if (action === 'remindPayment') return hSendPaymentReminder(env,{...b,regId,sessionId});
  if (action === 'checkin') return hCheckin(env,{...b,regId,sessionId});
  if (action === 'undoCheckin') return hCheckin(env,{...b,regId,sessionId,undo:true});
  if (action === 'markUnpaid') {
    if (!await verifyStaff(env,b.email,b.token,TENANT,'finance',sessionId)) return jsonErr('無權限');
    if (isPaidStatus(_payStatus(reg))) return jsonErr('已繳費資料不可直接改回未繳費，請走退費或人工校正流程');
    await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(regId)}`,{payment_status:'未繳費'});
    return jsonOk({success:true});
  }
  return jsonErr('未知操作：'+action);
}

// markClear（已清場）
async function hMarkClear(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'checkin')) return jsonErr('無權限');
  const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=review_status,payment_status,transfer_status`);
  if (!rows.length) return jsonErr('找不到報名');
  const reg = rows[0];
  if (String(reg.review_status||'') !== '已錄取') return jsonErr('尚未錄取，不能清場');
  if (!(isBookingSecuredStatus(reg.payment_status) || String(reg.payment_status||'') === '免費')) return jsonErr('尚未完成必要付款，不能清場');
  if (['申請退費','已退費'].includes(String(reg.transfer_status||''))) return jsonErr('此報名已進入退費流程，不能清場');
  const data = {clear_status:'已清場'};
  if (b.refunded) data.deposit_refunded='已退押金';
  await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(b.regId)}&tenant_id=eq.${TENANT}`,data);
  return jsonOk({success:true});
}

// sendNotify
async function hSendNotify(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  const ok = (await verifyStaff(env,b.email,b.token,TENANT,'review'))||(await verifyStaff(env,b.email,b.token,TENANT,'announce'));
  if (!ok) return jsonErr('無權限');
  let qs = `tenant_id=eq.${TENANT}&select=email,name,review_status`;
  if (b.sessionId) qs+=`&session_id=eq.${encodeURIComponent(b.sessionId)}`;
  if (b.regId) qs+=`&id=eq.${encodeURIComponent(b.regId)}`;
  let rows = await dbGet(env,'registrations',qs);
  if (b.target&&b.target!=='all') rows=rows.filter(r=>r.review_status===b.target);
  let sent=0, skipped=0;
  const tc = await getTenantCtx(env, TENANT);
  for (const r of rows) if(r.email) {
    try {
      const dn = getDisplayName(r.name, r.brand_name||'', '');
      const result = await sendTemplateEmail(env, TENANT, 'custom_notice', r.email, {
        '主辦名稱': tc.name || FALLBACK_TENANT_NAME,
        '顯示名稱': dn || r.name || '',
        '通知內容': b.content || b.message || '',
        '場次名稱': b.sessionName || '',
      }, tc, r.id, {targetId:r.id,targetTable:'registrations',actorEmail:b.email||'',actorRole:'announce'});
      if (result && result.skipped) skipped++; else if(result && result.ok) sent++;
    } catch {}
  }
  return jsonOk({success:true, sent, skipped});
}

// resendInvite
async function hResendInvite(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'superadmin')) return jsonErr('無權限');
  const rows = await dbGet(env,'staff',`tenant_id=eq.${TENANT}&email=eq.${encodeURIComponent(b.targetEmail)}&select=*`);
  if (!rows.length) return jsonErr('找不到此管理員');
  const s=rows[0];
  const ls=s.limit_sessions?String(s.limit_sessions).split(',').filter(Boolean):[];
  const tc = await getTenantCtx(env, TENANT);
  try { await mailStaffInvite(env,s.email,s.name||'',s.role||'活動夥伴',safeJson(s.perms_json,{}),ls,tc); } catch(e) { return jsonErr('寄信失敗：'+e.message); }
  return jsonOk({success:true});
}

function normalizeStaffRoleInput(role) {
  const r = String(role || '').trim();
  const map = {
    'superadmin':'platform_super_admin',
    '超級管理員':'platform_super_admin',
    '活動夥伴':'organizer_admin',
    '共創夥伴':'organizer_admin',
    'staff':'organizer_admin',
    'organizer_admin':'organizer_admin',
    '主辦':'organizer_owner',
    '主辦者':'organizer_owner',
    'organizer_owner':'organizer_owner',
    '場次管理員':'session_admin',
    'session_admin':'session_admin',
    '財務管理員':'finance_admin',
    'finance_admin':'finance_admin',
    '現場人員':'onsite_staff',
    'onsite_staff':'onsite_staff'
  };
  return map[r] || r || 'organizer_admin';
}

async function syncStaffSessionPermissions(env, tenantId, staffEmail, sessionIds) {
  const ids = (sessionIds||[]).map(x=>String(x||'').trim()).filter(Boolean);
  await dbDelete(env, 'staff_session_permissions', `tenant_id=eq.${tenantId}&staff_email=eq.${encodeURIComponent(staffEmail)}`).catch(()=>{});
  for (const sid of ids) {
    await dbInsert(env, 'staff_session_permissions', {
      id: genId('SSP'), tenant_id: tenantId, staff_email: staffEmail, session_id: sid,
      can_view: true, can_checkin: true, can_mark_absent: true, can_note: true, can_mark_refund_flag: true,
      is_active: true, created_at: nowIso(), updated_at: nowIso()
    }).catch(()=>{});
  }
}

// addStaff
async function hAddStaff(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'superadmin')) return jsonErr('無權限');
  const ex = await dbGet(env,'staff',`tenant_id=eq.${TENANT}&email=eq.${encodeURIComponent(b.targetEmail)}&select=email`);
  if (ex.length) return jsonErr('此帳號已存在');
  const normalizedRole = normalizeStaffRoleInput(b.role || 'organizer_admin');
  const displayRole = normalizedRole;
  const perms = b.perms || (normalizedRole === 'onsite_staff' ? {checkin:true} : {});
  // 授權範圍：all（全部）/ event（整個系列）/ session（指定場次）
  const scopeType = ['all','event','session'].includes(b.scopeType) ? b.scopeType : 'all';
  const scopeEventId = scopeType==='event' ? String(b.scopeEventId||'').trim() : '';
  await dbInsert(env,'staff',{
    id:crypto.randomUUID(),
    email:b.targetEmail,
    tenant_id:TENANT,
    name:b.targetName||'',
    role:displayRole,
    normalized_role:normalizedRole,
    role_id:null,
    perms_json:JSON.stringify(perms),
    limit_sessions:(b.limitSessions||[]).join(','),
    scope_type:scopeType,
    scope_event_id:scopeEventId,
    active:true,
    is_active:true,
  });
  await syncStaffSessionPermissions(env, TENANT, b.targetEmail, b.limitSessions||[]);
  const tcStaff = await getTenantCtx(env, TENANT);
  try { await mailStaffInvite(env,b.targetEmail,b.targetName||'',displayRole,perms,b.limitSessions||[],tcStaff); } catch {}
  return jsonOk({success:true});
}
// setStaffActive（開放／關閉帳號，保留人員資料與場次權限）
async function hSetStaffActive(env, b) {
  const TENANT = (b && b._tenantId);
  if (!await verifyStaff(env,b.email,b.token,TENANT,'superadmin')) return jsonErr('無權限');
  if (!b.targetEmail) return jsonErr('缺少 targetEmail');
  const active = b.active === true || b.active === 'true' || b.active === 1 || b.active === '1';
  await dbUpdate(env,'staff',`email=eq.${encodeURIComponent(b.targetEmail)}&tenant_id=eq.${TENANT}`,{
    is_active:active,
    active:active,
    updated_at:nowIso(),
  });
  return jsonOk({success:true, active});
}

// removeStaff
async function hRemoveStaff(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'superadmin')) return jsonErr('無權限');
  if (!b.targetEmail) return jsonErr('缺少 targetEmail');
  if (String(b.targetEmail).toLowerCase() === String(b.email).toLowerCase()) return jsonErr('不能刪除目前登入中的自己');
  await dbDelete(env,'staff',`email=eq.${encodeURIComponent(b.targetEmail)}&tenant_id=eq.${TENANT}`);
  return jsonOk({success:true});
}
// updateStaffPerms
async function hUpdateStaffPerms(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'superadmin')) return jsonErr('無權限');
  await dbUpdate(env,'staff',`email=eq.${encodeURIComponent(b.targetEmail)}&tenant_id=eq.${TENANT}`,{perms_json:JSON.stringify(b.perms||{})});
  return jsonOk({success:true});
}
// updateStaffSessions
async function hUpdateStaffSessions(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'superadmin')) return jsonErr('無權限');
  const sessions = b.sessions || b.sessionIds || [];
  const scopeType = b.scopeType || b.scope_type || 'all';
  const scopeEventId = (scopeType === 'event') ? (b.scopeEventId || b.scope_event_id || '') : '';
  const staffUpd = {limit_sessions:sessions.join(','), scope_type:scopeType, scope_event_id:scopeEventId, updated_at:nowIso()};
  if (b.role) { staffUpd.normalized_role = b.role; staffUpd.role = b.role; }
  await dbUpdate(env,'staff',`email=eq.${encodeURIComponent(b.targetEmail)}&tenant_id=eq.${TENANT}`,staffUpd);
  await syncStaffSessionPermissions(env, TENANT, b.targetEmail, sessions);
  return jsonOk({success:true});
}

// saveAnnouncement
async function hSaveAnnouncement(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'announce')) return jsonErr('無權限');
  if (b.id) {
    await dbUpdate(env,'announcements',`id=eq.${encodeURIComponent(b.id)}&tenant_id=eq.${TENANT}`,{title:b.title,content:b.content||'',url:b.url||'',url_text:b.urlText||''});
    return jsonOk({success:true});
  }
  const id=genId('ANN');
  await dbInsert(env,'announcements',{id,tenant_id:TENANT,title:b.title,content:b.content||'',url:b.url||'',url_text:b.urlText||'',created_at:nowIso()});
  return jsonOk({success:true,id});
}
// deleteAnnouncement
async function hDeleteAnnouncement(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyPlatformSuperAdmin(env,b.email,b.token,TENANT)) return jsonErr('刪除公告僅限平台超級管理員');
  await dbDelete(env,'announcements',`id=eq.${encodeURIComponent(b.id)}&tenant_id=eq.${TENANT}`);
  return jsonOk({success:true});
}

// saveFinanceItem
async function hSaveFinanceItem(env,b){ return hSaveSessionCashItem(env,b); }
// deleteFinanceItem
async function hDeleteFinanceItem(env,b){ return hDeleteSessionCashItem(env,b); }
// updateInvoiceStatus
async function hUpdateInvoiceStatus(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token, TENANT)) return jsonErr('無權限');
  await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(b.regId)}&tenant_id=eq.${TENANT}`,{invoice_status:b.status});
  return jsonOk({success:true});
}

// setFastPass
async function hSetFastPass(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'checkin')) return jsonErr('無權限');
  // email 大小寫不一致會造成「設定成功但報名時查不到」的靜默失效，故一律不分大小寫比對
  const em = String(b.targetEmail||'').trim();
  if (!em) return jsonErr('缺少會員 Email');
  const rows = await dbGet(env,'members',`tenant_id=eq.${TENANT}&email=ilike.${encodeURIComponent(em)}&select=email`);
  if (!rows.length) return jsonErr('找不到會員');
  await dbUpdate(env,'members',`email=ilike.${encodeURIComponent(em)}&tenant_id=eq.${TENANT}`,{fast_pass:b.enable?true:false});
  return jsonOk({success:true, enabled:!!b.enable});
}
// saveSiteConfig
async function hSaveSiteConfig(env, b) {
  const TENANT = (b && b._tenantId) ;
  if (!await verifyStaff(env,b.email,b.token,TENANT,'superadmin')) return jsonErr('無權限');
  const existing = await dbGet(env,'tenants',`id=eq.${TENANT}&select=config_json`);
  const oldCfg = existing.length ? safeJson(existing[0].config_json, {}) : {};
  const config = {...oldCfg};
  if ('heroImg' in b) config.heroImg = b.heroImg || '';
  if ('infoText' in b) config.infoText = b.infoText || '';
  if ('logoUrl' in b) config.logoUrl = b.logoUrl || '';
  if ('i18n' in b && b.i18n && typeof b.i18n==='object') {
    const langs=Array.isArray(b.i18n.languages)?b.i18n.languages.map(String).filter(Boolean):['zh-TW'];
    if(!langs.includes('zh-TW'))langs.unshift('zh-TW');
    config.i18n={enabled:!!b.i18n.enabled,defaultLanguage:langs.includes(String(b.i18n.defaultLanguage||''))?String(b.i18n.defaultLanguage):'zh-TW',languages:[...new Set(langs)].slice(0,8)};
  }
  await dbUpdate(env,'tenants',`id=eq.${TENANT}`,{config_json:JSON.stringify(config)});
  return jsonOk({success:true});
}

// ── 本場收款設定：沿用既有 tenants.payment_config_json，DB 為唯一來源 ──
function _paymentMethodsAllowed(v){
  const x=(v&&typeof v==='object')?v:safeJson(v,{});
  return {bank:x.bank!==false,linepay:!!x.linepay,card:!!x.card};
}
function _normalizePaymentOwnerMode(v){
  const s=String(v||'').trim().toLowerCase();
  if(s==='platform_agency'||s.endsWith('_agency'))return 'platform_agency';
  if(s==='partner_self'||s.includes('partner'))return 'partner_self';
  return 'organizer_self';
}
function _paymentProfilePublic(r){
  if(!r)return null;
  const allowed=_paymentMethodsAllowed(r.allowed_methods||r.allowedMethods||{});
  const bank=r.bank_account_obj||r.bankAccount||{};
  return {
    id:r.id||'',name:r.name||'',mode:_normalizePaymentOwnerMode(r.mode),ownerName:r.owner_name||r.ownerName||'',
    isDefault:r.is_default===true||r.isDefault===true,isEnabled:r.is_enabled!==false&&r.isEnabled!==false,
    allowedMethods:allowed,
    bankAccount:{bankName:r.bank_name||bank.bankName||'',branchName:r.bank_branch||bank.branchName||'',accountName:r.account_name||bank.accountName||'',accountNumber:r.bank_account||bank.accountNumber||''},
    linepay:{displayName:r.linepay_display_name||(r.linepay&&r.linepay.displayName)||'',url:r.linepay_url||(r.linepay&&r.linepay.url)||''},
    card:{displayName:r.card_display_name||(r.card&&r.card.displayName)||'',url:r.card_url||(r.card&&r.card.url)||''},
    note:r.note||'',updatedAt:r.updated_at||r.updatedAt||'',createdAt:r.created_at||r.createdAt||''
  };
}
function _paymentProfileRowFromBody(b,TENANT,id){
  return {
    id,
    name:String(b.name||'').trim()||'收款設定',
    mode:_normalizePaymentOwnerMode(b.mode),
    owner_name:String(b.ownerName||b.owner_name||'').trim(),
    allowed_methods:_paymentMethodsAllowed(b.allowedMethods||b.allowed_methods||{}),
    bank_name:String(b.bankName||b.bank_name||'').trim(),
    bank_branch:String(b.bankBranch||b.bank_branch||'').trim(),
    account_name:String(b.accountName||b.account_name||'').trim(),
    bank_account:String(b.bankAccount||b.bank_account||'').trim(),
    linepay_display_name:String(b.linepayDisplayName||b.linepay_display_name||'').trim(),
    linepay_url:String(b.linepayUrl||b.linepay_url||'').trim(),
    card_display_name:String(b.cardDisplayName||b.card_display_name||'').trim(),
    card_url:String(b.cardUrl||b.card_url||'').trim(),
    note:String(b.note||'').trim(),
    is_default:!!b.isDefault||!!b.is_default,
    is_enabled:!(b.isEnabled===false||b.is_enabled===false),
    updated_at:nowIso()
  };
}
async function _loadTenantPaymentConfig(env,TENANT){
  const rows=await dbGet(env,'tenants',`id=eq.${TENANT}&select=name,payment_config_json,bank_info,line_url`).catch(()=>[]);
  if(!rows.length)throw new Error('找不到租戶收款設定');
  return {tenant:rows[0],cfg:safeJson(rows[0].payment_config_json,{})};
}
function _legacyPaymentProfileFromConfig(TENANT,tenant,cfg){
  const pm=Array.isArray(cfg.payMethods)?cfg.payMethods:[];
  const lp=cfg.linePayText||cfg.linePay||cfg.linePayUrl||cfg.line_pay_url||(pm.find(m=>/line/i.test(String(m&&m.name||'')))||{}).url||'';
  const cp=cfg.creditCardText||cfg.creditCard||cfg.cardPayUrl||cfg.creditCardUrl||cfg.ecpayUrl||cfg.card||cfg.card_pay_url||(pm.find(m=>/信用|刷卡|card|綠界/i.test(String(m&&m.name||'')))||{}).url||'';
  const acct=cfg.bankAccount||cfg.account||'';
  return {
    id:'tenant_default',name:cfg.profileName||cfg.paymentProfileName||'主辦空間預設收款',
    mode:_normalizePaymentOwnerMode(cfg.paymentOwnerMode||cfg.mode),owner_name:cfg.ownerName||tenant.name||'',
    allowed_methods:{bank:!!acct||(!lp&&!cp),linepay:!!lp,card:!!cp},
    bank_name:cfg.bankName||cfg.bank||'',bank_branch:cfg.bankBranch||cfg.branch||'',
    account_name:cfg.accountName||cfg.account_name||'',bank_account:acct,
    linepay_display_name:lp?'LINE Pay':'',linepay_url:lp,
    card_display_name:cp?'信用卡':'',card_url:cp,
    note:cfg.paymentNote||cfg.note||tenant.bank_info||'',is_default:true,is_enabled:true,
    created_at:cfg.createdAt||'',updated_at:cfg.updatedAt||''
  };
}
function _profilesFromPaymentConfig(TENANT,tenant,cfg){
  const raw=Array.isArray(cfg.profiles)?cfg.profiles:(Array.isArray(cfg.paymentProfiles)?cfg.paymentProfiles:[]);
  const rows=raw.map(x=>({...x,id:String(x&&x.id||'').trim(),is_default:!!(x&&(x.is_default===true||x.isDefault===true)),is_enabled:!(x&&(x.is_enabled===false||x.isEnabled===false))})).filter(x=>x.id);
  return rows.length?rows:[_legacyPaymentProfileFromConfig(TENANT,tenant,cfg)];
}
async function _seedDefaultPaymentProfileIfNeeded(env,TENANT){
  // 相容既有呼叫名稱；只讀既有 JSON，不建立任何 DB table / row。
  const {tenant,cfg}=await _loadTenantPaymentConfig(env,TENANT);
  return _profilesFromPaymentConfig(TENANT,tenant,cfg);
}
async function _saveProfilesToPaymentConfig(env,TENANT,profiles,extraPatch={}){
  const {cfg}=await _loadTenantPaymentConfig(env,TENANT);
  const next={...cfg,...extraPatch,profiles,updatedAt:nowIso()};
  delete next.paymentProfiles;
  await dbUpdate(env,'tenants',`id=eq.${TENANT}`,{payment_config_json:next});
  return next;
}
async function _getDefaultPaymentProfile(env,TENANT){
  const rows=await _seedDefaultPaymentProfileIfNeeded(env,TENANT);
  return rows.find(r=>r.is_default===true&&r.is_enabled!==false)||rows.find(r=>r.is_enabled!==false)||rows[0]||null;
}
async function _resolvePaymentProfileForSession(env,TENANT,sessionRow){
  const wanted=String(sessionRow&&(sessionRow.payment_profile_id||sessionRow.paymentProfileId)||'').trim();
  const rows=await _seedDefaultPaymentProfileIfNeeded(env,TENANT);
  if(wanted){
    const hit=rows.find(r=>String(r.id)===wanted&&r.is_enabled!==false);
    if(hit)return hit;
    throw new Error('此場次指定的收款設定不存在或已停用，請主辦重新指定後再操作');
  }
  return rows.find(r=>r.is_default===true&&r.is_enabled!==false)||rows.find(r=>r.is_enabled!==false)||rows[0]||null;
}
function _paymentProfileUsableError(profile){
  if(!profile||profile.is_enabled===false)return '尚未設定可用收款設定';
  const p=_paymentProfilePublic(profile),a=p.allowedMethods||{},b=p.bankAccount||{};
  const bank=!!(a.bank&&String(b.accountNumber||'').trim());
  const line=!!(a.linepay&&String((p.linepay||{}).url||'').trim());
  const card=!!(a.card&&String((p.card||{}).url||'').trim());
  return (!bank&&!line&&!card)?'收款設定尚未填入可使用的銀行帳號、LINE Pay 或信用卡付款資訊':'';
}
function _paymentSnapshotFromProfile(profile){
  const p=_paymentProfilePublic(profile);if(!p)return null;
  return {payment_profile_id:p.id,payment_profile_name:p.name,payment_owner_mode:p.mode,owner_name:p.ownerName,allowed_methods:p.allowedMethods,bank_account:p.bankAccount,linepay:p.linepay,card:p.card,snapshot_created_at:nowIso()};
}
function _paymentSnapshotFromReg(r){
  const snap=safeJson(r.payment_profile_snapshot,null);
  if(snap&&typeof snap==='object')return snap;
  if(r.payment_profile_id||r.bank_account_snapshot){
    return {payment_profile_id:r.payment_profile_id||'',payment_profile_name:r.payment_profile_name||'',payment_owner_mode:r.payment_owner_mode||'',owner_name:r.payment_owner_name||'',allowed_methods:safeJson(r.payment_methods_allowed,{bank:true,linepay:false,card:false}),bank_account:safeJson(r.bank_account_snapshot,{}),linepay:safeJson(r.linepay_config_snapshot,{}),card:safeJson(r.card_config_snapshot,{})};
  }
  return null;
}
function _paymentSnapshotPublic(snap){
  const s=snap&&typeof snap==='object'?snap:{},allowed=_paymentMethodsAllowed(s.allowed_methods||s.allowedMethods||{}),bank=s.bank_account||s.bankAccount||{};
  return {paymentProfileId:s.payment_profile_id||s.paymentProfileId||'',paymentProfileName:s.payment_profile_name||s.paymentProfileName||'',paymentOwnerMode:_normalizePaymentOwnerMode(s.payment_owner_mode||s.paymentOwnerMode),paymentOwnerName:s.owner_name||s.payment_owner_name||'',allowedMethods:allowed,bankAccount:{bankName:bank.bankName||bank.bank_name||'',branchName:bank.branchName||bank.branch_name||'',accountName:bank.accountName||bank.account_name||'',accountNumber:bank.accountNumber||bank.bankAccount||bank.bank_account||''},linepay:s.linepay||{},card:s.card||{},snapshotCreatedAt:s.snapshot_created_at||s.payment_snapshot_created_at||'',legacy:!!s.legacy};
}
function _paymentSnapshotDbPayload(snap){
  const pub=_paymentSnapshotPublic(snap);
  return {payment_profile_id:pub.paymentProfileId||null,payment_profile_snapshot:snap||{},payment_owner_mode:pub.paymentOwnerMode||'',payment_methods_allowed:pub.allowedMethods,bank_account_snapshot:pub.bankAccount,linepay_config_snapshot:pub.linepay||{},card_config_snapshot:pub.card||{},payment_snapshot_created_at:nowIso()};
}
function _isPaymentStarted(reg){
  const ps=String(reg&&reg.payment_status||'').trim();
  return isPaidStatus(ps)||['待確認','付款待確認','已回報','免費'].includes(ps);
}
async function ensurePaymentSnapshotForReg(env,TENANT,reg,sessionRow,opts={}){
  const existing=_paymentSnapshotFromReg(reg);
  if(existing){
    if(!_isPaymentStarted(reg)){
      try{
        const latest=await _resolvePaymentProfileForSession(env,TENANT,sessionRow||{});
        if(latest&&String(latest.id||'')===String(existing.payment_profile_id||'')){
          const fresh=_paymentSnapshotFromProfile(latest);
          existing.allowed_methods=fresh.allowed_methods;existing.linepay=fresh.linepay;existing.card=fresh.card;
        }
      }catch(e){console.error('refresh allowed methods skipped',e&&e.message?e.message:e);}
    }
    return existing;
  }
  const profile=await _resolvePaymentProfileForSession(env,TENANT,sessionRow||{});
  const err=_paymentProfileUsableError(profile);if(err)throw new Error(err);
  const snap=_paymentSnapshotFromProfile(profile),canWrite=opts.forceWrite||(!_isPaymentStarted(reg));
  if(canWrite&&reg&&reg.id)await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(reg.id)}`,_paymentSnapshotDbPayload(snap));
  else if(_isPaymentStarted(reg))snap.legacy=true;
  return snap;
}
function _paymentMethodKey(method){
  const s=String(method||'').toLowerCase();
  if(s.includes('line'))return 'linepay';
  if(s.includes('信用')||s.includes('刷卡')||s.includes('card')||s.includes('綠界'))return 'card';
  return 'bank';
}
function _methodAllowedFromSnapshot(snap,method){
  return !!_paymentMethodsAllowed((snap&&snap.allowed_methods)||{})[_paymentMethodKey(method)];
}
async function hGetPaymentProfiles(env,p){
  const TENANT=p&&p._tenantId;if(!await verifyStaff(env,p.email,p.token,TENANT,'finance'))return jsonErr('無權限');
  return jsonOk((await _seedDefaultPaymentProfileIfNeeded(env,TENANT)).map(_paymentProfilePublic));
}
async function hSavePaymentProfile(env,b){
  const TENANT=b&&b._tenantId;if(!await verifyStaff(env,b.email,b.token,TENANT,'finance'))return jsonErr('無權限');
  const current=await _seedDefaultPaymentProfileIfNeeded(env,TENANT);
  const id=String(b.id||'').trim()||genId('PAYSET'),row=_paymentProfileRowFromBody(b,TENANT,id);
  let profiles=current.filter(x=>String(x.id)!==id);
  if(row.is_default)profiles=profiles.map(x=>({...x,is_default:false}));
  profiles.push({...row,created_at:(current.find(x=>String(x.id)===id)||{}).created_at||nowIso()});
  if(!profiles.some(x=>x.is_default===true&&x.is_enabled!==false)){const first=profiles.find(x=>x.is_enabled!==false);if(first)first.is_default=true;}
  const def=profiles.find(x=>x.is_default===true)||profiles[0]||row,pub=_paymentProfilePublic(def),methods=[];
  if(pub.allowedMethods.linepay&&pub.linepay.url)methods.push({name:'LINE Pay',url:pub.linepay.url});
  if(pub.allowedMethods.card&&pub.card.url)methods.push({name:'信用卡／綠界',url:pub.card.url});
  await _saveProfilesToPaymentConfig(env,TENANT,profiles,{paymentNote:pub.note||'',bankName:pub.bankAccount.bankName||'',bankBranch:pub.bankAccount.branchName||'',accountName:pub.bankAccount.accountName||'',bankAccount:pub.bankAccount.accountNumber||'',payMethods:methods,paymentOwnerMode:pub.mode||'organizer_self',ownerName:pub.ownerName||''});
  await writeAuditLog(env,TENANT,b.email||'','finance_admin','payment_profile_saved','tenants',TENANT,null,{profileId:id},{storage:'payment_config_json'});
  return jsonOk({success:true,id});
}
async function hDisablePaymentProfile(env,b){
  const TENANT=b&&b._tenantId;if(!await verifyStaff(env,b.email,b.token,TENANT,'finance'))return jsonErr('無權限');
  const id=String(b.id||'').trim();if(!id)return jsonErr('請提供收款設定 ID');
  const current=await _seedDefaultPaymentProfileIfNeeded(env,TENANT),hit=current.find(x=>String(x.id)===id);
  if(!hit)return jsonErr('找不到收款設定');
  if(hit.is_default===true)return jsonErr('預設收款設定不可停用，請先設定其他預設');
  const inUse=await dbGet(env,'sessions',`tenant_id=eq.${TENANT}&payment_profile_id=eq.${encodeURIComponent(id)}&select=id,name`).catch(()=>[]);
  if(inUse.length)return jsonErr('此收款設定仍被 '+inUse.length+' 個場次使用，請先改用其他收款設定');
  await _saveProfilesToPaymentConfig(env,TENANT,current.map(x=>String(x.id)===id?{...x,is_enabled:false,updated_at:nowIso()}:x));
  await writeAuditLog(env,TENANT,b.email||'','finance_admin','payment_profile_disabled','tenants',TENANT,null,{profileId:id},{storage:'payment_config_json'});
  return jsonOk({success:true});
}
async function hGetFinancePaymentGroups(env,p){
  const TENANT=p&&p._tenantId;if(!await verifyStaff(env,p.email,p.token,TENANT,'finance'))return jsonErr('無權限');
  const sId=p.sessionId||p.session_id||'';let qs=`tenant_id=eq.${TENANT}&select=*`;if(sId)qs+=`&session_id=eq.${encodeURIComponent(sId)}`;
  const [regs,sessions]=await Promise.all([dbGet(env,'registrations',qs).catch(()=>[]),dbGet(env,'sessions',`tenant_id=eq.${TENANT}&select=*`).catch(()=>[])]);
  const smap={};sessions.forEach(s=>smap[s.id]=s);const itemMap=await _getRegistrationItemsForRegs(env,regs).catch(()=>({})),groups={};
  for(const r of regs.filter(_isReceivableReg)){
    const ses=smap[r.session_id]||{},money=_regFinanceAmounts(r,ses,itemMap[r.id]),snap=_paymentSnapshotPublic(_paymentSnapshotFromReg(r)||{payment_profile_name:'未保存收款快照',payment_owner_mode:'legacy',allowed_methods:{bank:true}});
    const key=(snap.paymentProfileId||'legacy')+'|'+(snap.paymentOwnerMode||'legacy');
    if(!groups[key])groups[key]={paymentProfileId:snap.paymentProfileId,paymentProfileName:snap.paymentProfileName||'未保存收款快照',ownerMode:snap.paymentOwnerMode||'legacy',ownerName:snap.paymentOwnerName||'',count:0,receivable:0,received:0,deposit:0,transferDue:0};
    groups[key].count++;groups[key].receivable+=money.cashTotal;if(_isConfirmedPaidReg(r))groups[key].received+=money.cashTotal;groups[key].deposit+=money.depositTotal;
    if(snap.paymentOwnerMode==='platform_agency')groups[key].transferDue+=Math.max(0,money.cashTotal-money.depositTotal);
  }
  return jsonOk(Object.values(groups));
}
async function hGetPaymentSettings(env,p){
  const TENANT=p&&p._tenantId;if(!await verifyStaff(env,p.email,p.token,TENANT))return jsonErr('無權限');
  const {tenant:t,cfg}=await _loadTenantPaymentConfig(env,TENANT);
  let payMethods=Array.isArray(cfg.payMethods)?cfg.payMethods.filter(m=>m&&m.name):[];
  if(!payMethods.length){const seed=[],lp=cfg.linePayText||cfg.linePay||cfg.linePayUrl||cfg.line_pay_url||'',cp=cfg.creditCardText||cfg.creditCard||cfg.cardPayUrl||cfg.creditCardUrl||cfg.ecpayUrl||cfg.card||cfg.card_pay_url||'';if(lp)seed.push({name:'LINE Pay',url:lp});if(cp)seed.push({name:'信用卡／綠界',url:cp});payMethods=seed;}
  return jsonOk({paymentNote:cfg.paymentNote||cfg.note||'',bankName:cfg.bankName||cfg.bank||'',bankBranch:cfg.bankBranch||cfg.branch||'',accountName:cfg.accountName||cfg.account_name||'',bankAccount:cfg.bankAccount||cfg.account||'',payMethods,lineUrl:t.line_url||'',bankInfo:t.bank_info||'',paymentProfiles:_profilesFromPaymentConfig(TENANT,t,cfg).map(_paymentProfilePublic)});
}
async function hSavePaymentSettings(env,b){
  const TENANT=b&&b._tenantId;if(!await verifyStaff(env,b.email,b.token,TENANT,'superadmin'))return jsonErr('無權限');
  const {cfg}=await _loadTenantPaymentConfig(env,TENANT),payMethods=Array.isArray(b.payMethods)?b.payMethods.map(m=>({name:String((m&&m.name)||'').trim(),url:String((m&&m.url)||'').trim()})).filter(m=>m.name):[];
  const payment={...cfg,paymentNote:b.paymentNote||'',bankName:b.bankName||'',bankBranch:b.bankBranch||'',accountName:b.accountName||'',bankAccount:b.bankAccount||'',payMethods,updatedAt:nowIso()};
  if(Array.isArray(payment.profiles)&&payment.profiles.length){
    const idx=payment.profiles.findIndex(x=>x&&(x.is_default===true||x.isDefault===true)),i=idx>=0?idx:0,x={...payment.profiles[i]};
    x.bank_name=payment.bankName;x.bank_branch=payment.bankBranch;x.account_name=payment.accountName;x.bank_account=payment.bankAccount;x.note=payment.paymentNote;
    x.allowed_methods={bank:!!payment.bankAccount||!payMethods.length,linepay:payMethods.some(m=>/line/i.test(m.name)),card:payMethods.some(m=>/信用|刷卡|card|綠界/i.test(m.name))};
    x.linepay_url=(payMethods.find(m=>/line/i.test(m.name))||{}).url||'';x.card_url=(payMethods.find(m=>/信用|刷卡|card|綠界/i.test(m.name))||{}).url||'';x.updated_at=nowIso();payment.profiles[i]=x;
  }
  const bankInfo=[payment.paymentNote,payment.bankName,payment.bankBranch,payment.accountName,payment.bankAccount].filter(Boolean).join('\n');
  await dbUpdate(env,'tenants',`id=eq.${TENANT}`,{payment_config_json:payment,bank_info:bankInfo});
  return jsonOk({success:true});
}

// 正式開放依賴驗證：同步檢查既有場次欄位，再檢查既有付款設定。
async function _validateSessionDependenciesForOpen(env,TENANT,s){
  const rowErr=_validateSessionForOpenRow(s);if(rowErr)return rowErr;
  const status=String(s&&s.status||'關閉');
  if(status!=='報名中'&&status!=='開放')return '';
  const mods=normalizeSessionModules(safeJson(s&&s.modules_json,{}));
  if(mods.payment){
    let p;try{p=await _resolvePaymentProfileForSession(env,TENANT,s||{});}catch(e){return e&&e.message?e.message:'此場收款設定無法解析';}
    const pe=_paymentProfileUsableError(p);if(pe)return '此場啟用付款模組，'+pe;
  }
  return '';
}

async function hGetCompanySettings(env, p) {
  const TENANT = (p && p._tenantId);
  if (!await verifyStaff(env,p.email,p.token,TENANT)) return jsonErr('無權限');
  const rows = await dbGet(env, 'tenants', `id=eq.${TENANT}&select=id,name,slug,config_json,email_from,email_reply_to,footer_text,site_url,line_url,logo_url`);
  if (!rows.length) return jsonErr('找不到租戶設定');
  const t=rows[0], cfg=safeJson(t.config_json, {}), c=cfg.company||{};
  return jsonOk({systemName:c.systemName||'DOING｜活動營運管理系統', companyName:c.companyName||t.name||'', serviceEmail:c.serviceEmail||t.email_reply_to||'', serviceLine:c.serviceLine||t.line_url||'', phone:c.phone||'', website:c.website||t.site_url||'', loginText:c.loginText||'', serviceInfo:c.serviceInfo||'', logoUrl:t.logo_url||''});
}
async function hSaveCompanySettings(env, b) {
  const TENANT = (b && b._tenantId);
  if (!await verifyStaff(env,b.email,b.token,TENANT,'superadmin')) return jsonErr('無權限');
  const rows = await dbGet(env,'tenants',`id=eq.${TENANT}&select=config_json`);
  if (!rows.length) return jsonErr('找不到租戶設定');
  const cfg=safeJson(rows[0].config_json, {});
  cfg.company={systemName:b.systemName||'', companyName:b.companyName||'', serviceEmail:b.serviceEmail||'', serviceLine:b.serviceLine||'', phone:b.phone||'', website:b.website||'', loginText:b.loginText||'', serviceInfo:b.serviceInfo||''};
  const data={config_json:JSON.stringify(cfg)};
  if (b.companyName!==undefined) data.name=b.companyName||'';
  if (b.website!==undefined) data.site_url=b.website||'';
  if (b.serviceEmail!==undefined) data.email_reply_to=b.serviceEmail||'';
  if (b.serviceLine!==undefined) data.line_url=b.serviceLine||'';
  await dbUpdate(env,'tenants',`id=eq.${TENANT}`,data);
  return jsonOk({success:true});
}
async function hGetEmailTemplates(env, p) {
  const TENANT = (p && p._tenantId);
  if (!await verifyStaff(env,p.email,p.token,TENANT,'announce')) return jsonErr('無權限');
  const dbRows = await dbGet(env, 'email_templates', `tenant_id=eq.${TENANT}&select=*&order=template_key.asc`).catch(()=>[]);
  const map = new Map();
  for (const d of defaultEmailTemplates()) map.set(d.template_key, {...d, isDefault:true});
  for (const r of (Array.isArray(dbRows)?dbRows:[])) {
    const base = map.get(r.template_key) || {};
    map.set(r.template_key, {
      ...base,
      id:r.id,
      template_key:r.template_key,
      title:r.title||base.title||'',
      subject:r.subject||base.subject||'',
      body:r.body||r.body_html||base.body||'',
      is_active:r.is_active!==false,
      updated_at:r.updated_at||'',
      updated_by:r.updated_by||'',
      isDefault:false,
    });
  }
  return jsonOk(Array.from(map.values()).map(r=>({
    id:r.id||'', templateKey:r.template_key, template_key:r.template_key, title:r.title||'', subject:r.subject||'',
    body:r.body||'', isActive:r.is_active!==false, is_active:r.is_active!==false, isDefault:!!r.isDefault,
    group:r.group||'', updatedAt:r.updated_at||'', updatedBy:r.updated_by||''
  })));
}
async function hSaveEmailTemplate(env, b) {
  const TENANT = (b && b._tenantId);
  if (!await verifyStaff(env,b.email,b.token,TENANT,'announce')) return jsonErr('無權限');
  const key=String(b.templateKey||b.template_key||'').trim();
  if(!key) return jsonErr('缺少 templateKey');
  const existing = await dbGet(env,'email_templates',`tenant_id=eq.${TENANT}&template_key=eq.${encodeURIComponent(key)}&select=id`).catch(()=>[]);
  const bodyText = b.body || b.content || '';
  const row={
    tenant_id:TENANT,
    template_key:key,
    title:b.title||'',
    subject:b.subject||'',
    body:bodyText,           // 資料庫欄位為 body（原寫 body_html，找不到該欄位而存檔失敗）
    is_active:(b.isActive===false||b.is_active===false||b.isActive==='false'||b.is_active==='false')?false:true,
    updated_by:b.email||'',
    updated_at:nowIso()
  };
  if (existing && existing[0] && existing[0].id) row.id = existing[0].id;
  const saved=await dbUpsert(env,'email_templates',row,'tenant_id,template_key');
  await writeAuditLog(env,TENANT,b.email||'','announce','email_template_saved','email_templates',key,null,{template_key:key,is_active:row.is_active},{});
  return jsonOk({success:true, template:saved});
}
function formatMemberRow(r){ const fastPass=r.fast_pass===true||r.fast_pass==='true'; return {id:r.id||'', email:r.email||'', name:r.name||r.display_name||'', phone:r.phone||'', brand:r.brand_name||'', brandName:r.brand_name||'', fb:r.fb_url||r.facebook||r.fb||'', ig:r.ig_url||r.instagram||r.ig||'', category:r.category||r.sale_category||'', intro:r.intro||r.brand_intro||r.description||'', fastPass, fast_pass:fastPass, adminNote:r.admin_note||'', admin_note:r.admin_note||'', adminNoteAt:r.admin_note_updated_at||'', createdAt:r.created_at||'', updatedAt:r.updated_at||''}; }
async function hSaveMemberNote(env,b){
  const TENANT=b._tenantId;if(!await verifyStaff(env,b.email,b.token,TENANT,'review'))return jsonErr('無權限');
  const target=normEmail(b.memberEmail||b.targetEmail||'');if(!target)return jsonErr('缺少會員 Email');const note=String(b.note||'').trim();if(!note)return jsonErr('請輸入備註');
  const rows=await dbGet(env,'members',`tenant_id=eq.${TENANT}&email=ilike.${encodeURIComponent(target)}&select=*`);if(!rows.length)return jsonErr('找不到這位會員');
  const now=nowIso(),line=`[${nowTaipeiText()}｜${b.email||'管理者'}] ${note}`,prev=String(rows[0].admin_note||'').trim(),merged=prev?prev+'\n'+line:line;
  await dbUpdate(env,'members',`tenant_id=eq.${TENANT}&email=ilike.${encodeURIComponent(target)}`,{admin_note:merged,admin_note_updated_at:now,admin_note_updated_by:String(b.email||''),updated_at:now});
  const regs=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&email=ilike.${encodeURIComponent(target)}&select=id,admin_note`).catch(()=>[]);for(const r of regs){const rp=String(r.admin_note||'').trim();await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(r.id)}`,{admin_note:rp?rp+'\n'+line:line}).catch(()=>{});}return jsonOk({success:true,note:merged});
}
async function hGetMembers(env, p) {
  const TENANT = (p && p._tenantId);
  if (!await verifyStaff(env,p.email,p.token,TENANT,'review')) return jsonErr('無權限');
  const members=await dbGet(env,'members',`tenant_id=eq.${TENANT}&select=*`).catch(()=>[]);
  return jsonOk(members.map(formatMemberRow));
}
async function hGetMemberHistory(env, p) {
  const TENANT = (p && p._tenantId);
  if (!await verifyStaff(env,p.email,p.token,TENANT,'review')) return jsonErr('無權限');
  const key=String(p.memberKey||p.key||p.email||p.phone||p.brand||'').trim();
  if(!key) return jsonOk([]);
  const q=encodeURIComponent('*'+key+'*');
  const [regs,sessions,events]=await Promise.all([dbGet(env,'registrations',`tenant_id=eq.${TENANT}&or=(email.ilike.${q},phone.ilike.${q},brand_name.ilike.${q},name.ilike.${q})&select=*&order=created_at.desc`), dbGet(env,'sessions',`tenant_id=eq.${TENANT}&select=*`).catch(()=>[]), dbGet(env,'events',`tenant_id=eq.${TENANT}&select=*`).catch(()=>[])]);
  const smap={}; sessions.forEach(s=>smap[s.id]=s); const emap={}; events.forEach(e=>emap[e.id]=e);
  return jsonOk(regs.map(r=>_formatAdminRegistration(r, smap[r.session_id]||{}, emap[(smap[r.session_id]||{}).event_id]||{})));
}
async function hUpdateStaffScope(env, b) {
  const TENANT = (b && b._tenantId);
  if (!await verifyStaff(env,b.email,b.token,TENANT,'superadmin')) return jsonErr('無權限');
  const targetEmail=String(b.targetEmail||b.target_email||'').trim();
  if(!targetEmail) return jsonErr('缺少 targetEmail');
  const raw=String(b.scopeType||b.scope_type||'all').trim();
  const scopeType=raw==='sessions'?'session':(raw==='series'?'event':(['all','event','session'].includes(raw)?raw:'all'));
  const scopeEventId=scopeType==='event'?String(b.eventId||b.scopeEventId||b.scope_event_id||'').trim():'';
  const ids=(b.limitSessions||b.scopeSessionIds||b.scope_session_ids||[]).map(x=>String(x||'').trim()).filter(Boolean);
  const data={scope_type:scopeType, scope_event_id:scopeEventId, limit_sessions:scopeType==='session'?ids.join(','):'', updated_at:nowIso()};
  await dbUpdate(env,'staff',`tenant_id=eq.${TENANT}&email=eq.${encodeURIComponent(targetEmail)}`,data);
  await syncStaffSessionPermissions(env,TENANT,targetEmail,scopeType==='session'?ids:[]);
  return jsonOk({success:true,scopeType,scopeEventId,limitSessions:ids});
}


// getAgreementTemplates（取得所有範本，最多3款，向下相容舊資料）
async function hGetAgreementTemplate(env, p) {
  const TENANT = (p && p._tenantId);
  const rows = await dbGet(env, 'tenant_agreement_templates',
    `tenant_id=eq.${TENANT}&select=*&order=created_at.asc`);
  // 向下相容：舊資料沒有 slot_no，自動指派為 slot 1
  const slotMap = {};
  rows.forEach((r, i) => {
    const slot = (r.slot_no && r.slot_no >= 1 && r.slot_no <= 3) ? r.slot_no : (i + 1);
    if (!slotMap[slot]) slotMap[slot] = r;
  });
  const result = [1,2,3].map(slot => {
    const r = slotMap[slot] || {};
    return {
      slot_no: slot,
      label: r.label || (slot === 1 && r.title ? '預設合約' : `範本${slot}`),
      title: r.title || '',
      content: r.content || '',
      version: r.version || '',
    };
  });
  return jsonOk(result);
}

// saveAgreementTemplate（儲存指定 slot 的範本）
async function hSaveAgreementTemplate(env, b) {
  const TENANT = (b && b._tenantId);
  if (!await verifyStaff(env, b.email, b.token, TENANT, 'superadmin')) return jsonErr('無權限');
  const slot = Number(b.slot_no) || 1;
  if (slot < 1 || slot > 3) return jsonErr('slot_no 必須為 1~3');
  const now = new Date().toISOString();
  const rows = await dbGet(env, 'tenant_agreement_templates',
    `tenant_id=eq.${TENANT}&slot_no=eq.${slot}&select=id`);
  if (rows.length) {
    await dbUpdate(env, 'tenant_agreement_templates',
      `tenant_id=eq.${TENANT}&slot_no=eq.${slot}`, {
      label: b.label || `範本${slot}`,
      title: b.title || '',
      content: b.content || '',
      version: b.version || '',
      updated_at: now,
    });
  } else {
    await dbInsert(env, 'tenant_agreement_templates', {
      id: genId('AGT'),
      tenant_id: TENANT,
      slot_no: slot,
      label: b.label || `範本${slot}`,
      title: b.title || '',
      content: b.content || '',
      version: b.version || '',
      updated_at: now,
      created_at: now,
    });
  }
  return jsonOk({ ok: true });
}

// forceCancel（不可抗力宣告）
async function hForceCancel(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  if (!await verifyStaff(env,b.email,b.token,TENANT,'sessions')) return jsonErr('無權限');
  const dl = new Date(); dl.setHours(dl.getHours()+48);
  await dbUpdate(env,'sessions',`id=eq.${encodeURIComponent(b.sessionId)}&tenant_id=eq.${TENANT}`,{
    force_cancel:true, force_cancel_target_id:b.targetSessionId||null, force_cancel_deadline:dl.toISOString(),
  });
  const sesName = await getSessionName(env, b.sessionId, TENANT);
  let targetSesName='';
  if (b.targetSessionId) targetSesName=await getSessionName(env, b.targetSessionId, TENANT);
  const dlStr=`${dl.getMonth()+1}/${dl.getDate()} ${dl.getHours()}:00`;
  const regs = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&session_id=eq.${encodeURIComponent(b.sessionId)}&review_status=in.(%E5%B7%B2%E9%8C%84%E5%8F%96,%E5%BE%85%E5%AF%A9%E6%A0%B8)&select=*`);
  const tcForce = await getTenantCtx(env, TENANT);
  for (const r of regs) {
    const st = await getSessionType(env, r.session_id, TENANT);
    const dn = getDisplayName(r.name,r.brand_name||'',st);
    try { await mailForceCancelChoice(env,r.email,dn,sesName,targetSesName,dlStr,tcForce); } catch {}
  }
  return jsonOk({success:true, notified:regs.length});
}

// agreeTransfer（延期）
async function hAgreeTransfer(env, b) {
  const TENANT = (b && b._tenantId) ;  // M-02：tenant 已由路由層驗證（見 routeGet/routePost）
  const rows = await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  if (!rows.length) return jsonErr('找不到報名');
  const reg = rows[0];
  // 身份驗證：前台必須傳入 email，驗證與報名 email 吻合（不可讓不相關者觸發延期）
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
    email:reg.email, name:reg.name, phone:reg.phone,
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
  const reg=rows[0],own=regOwnerGuard(reg,b,'改期的');if(own)return own;
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
  const reg=rows[0],own=regOwnerGuard(reg,b,'申請退款的');if(own)return own;
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
  const reg=rows[0],own=regOwnerGuard(reg,b,'延期的');if(own)return own;
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
      email:reg.email,member_id:reg.member_id||reg.email,name:reg.name,phone:reg.phone||'',
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
  const reg=rows[0],own=regOwnerGuard(reg,b,'申請不可抗力退費的');if(own)return own;
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
async function routeGet(env, action, p, req) {
  // 不需要 tenant 的路由
  if (action==='publicDiscovery') return await hPublicDiscovery(env,p);
  if (action==='publicExposureFeed') return await hPublicExposureFeed(env,p);
  if (action==='publicPlatformProfile') return await hPublicPlatformProfile(env,p);
  if (action==='getPlatformPublicProfile') return await hGetPlatformPublicProfile(env,p);
  if (action==='getExposurePlansPlatform') return await hGetExposurePlansPlatform(env,p);
  if (action==='getPlatformExposureOrders') return await hGetPlatformExposureOrders(env,p);
  if (action==='getMyRegsGlobal') return await hGetMyRegsGlobal(env,p);
  if (action==='adminMe') return await hAdminMe(env, p);
  if (action==='listLoginWorkspaces') return await hListLoginWorkspaces(env, p);
  if (action==='applyList') return await hApplyList(env, p);
  if (action==='getTenantsAdmin') return await hGetTenantsAdmin(env, p);
  if (action==='getPlatformDashboard') return await hGetPlatformDashboard(env,p);
  if (action==='getPlatformBillingPolicy') return await hGetPlatformBillingPolicy(env,p);
  if (action==='getPublicBillingPolicy') return await hGetPublicBillingPolicy(env);
  if (action==='getPlatformSupportThreads') return await hGetPlatformSupportThreads(env,p);
  if (action==='getPlatformSupportMessages') return await hGetPlatformSupportMessages(env,p);
  if (action==='getPlatformTenantModules') return await hGetPlatformTenantModules(env,p);
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

  switch(action) {
    case 'frontBootstrap':      return hFrontBootstrap(env,p);
    case 'getOperationUnitsPublic': return hGetOperationUnitsPublic(env,p);
    case 'getOperationUnitsAdmin': return hGetOperationUnitsAdmin(env,p);
    case 'getBookingCalendarAdmin': return hGetBookingCalendarAdmin(env,p);
    case 'getPromotionRulesAdmin': return hGetPromotionRulesAdmin(env,p);
    case 'getExposureCatalog': return hGetExposureCatalog(env,p);
    case 'getMyRewards': return hGetMyRewards(env,p);
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
  if(action==='createOrganizerApplicationDraft')return hCreateOrganizerApplicationDraft(env,b);
  if(action==='approveApply')return hApproveApply(env,b);
  if(action==='requestApplySupplement')return hRequestApplySupplement(env,b);
  if(action==='rejectApply')return hRejectApply(env,b);
  if(action==='applyTrial')return hApplyTrial(env,b);
  if(action==='sendPlatformSupportMessage')return hSendPlatformSupportMessage(env,b);
  if(action==='markPlatformSupportRead')return hMarkPlatformSupportRead(env,b);
  if(action==='savePlatformTenantModules')return hSavePlatformTenantModules(env,b);
  // DOING：寫入操作的租戶由 JWT / 場次 / 報名關聯解析；正式 handler 仍會做權限與 tenant 驗證。
  const TENANT = await resolveTenantForRequest(env, b, req);
  if (!TENANT) {
    return new Response(JSON.stringify({ok:false, error:'無法辨識主辦空間'}), {status:400, headers:corsHeaders()});
  }
  b.tenant = TENANT;
  b._tenantId = TENANT;  // 注入供 handler 使用
  // 注入來源 IP 與 User-Agent（供不可抗力同意證據寫入）
  if (req) {
    b._ip = req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || req.headers.get('X-Real-IP') || null;
    b._userAgent = req.headers.get('User-Agent') || null;
  }
  const featureDenied = await enforceTenantFeature(env, TENANT, action);
  if (featureDenied) return featureDenied;
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
    case 'deleteOperationUnit': return hDeleteOperationUnit(env,b);
    case 'savePromotionRule': return hSavePromotionRule(env,b);
    case 'deletePromotionRule': return hDeletePromotionRule(env,b);
    case 'createExposureOrder': return hCreateExposureOrder(env,b);
    case 'cancelExposureOrder': return hCancelExposureOrder(env,b);
    case 'grantPartnerCredit': return grantPartnerCredit(env,b);
    case 'saveStartupCreditPolicy': return hSaveStartupCreditPolicy(env,b);
    case 'confirmOperatingPayment': return hConfirmOperatingPayment(env,b);
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
      // 舊 unified OAuth 僅做相容轉址；正式流程只有 /auth/google/start + /auth/google/callback。
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
        // 多主辦空間選擇（Google 已驗證後的短效 token，不需 tenant 前置參數）
        if (act==='selectLoginWorkspace') return await hSelectLoginWorkspace(env, body);
        if (act==='platformEnterTenant') return await hPlatformEnterTenant(env, body);
        if (act==='platformUpsertTenantOwner') return await hPlatformUpsertTenantOwner(env, body);
        if (act==='grantPartnerCredit') return await grantPartnerCredit(env, body);
        if (act==='saveStartupCreditPolicy') return await hSaveStartupCreditPolicy(env, body);
        if (act==='savePlatformBillingPolicy') return await hSavePlatformBillingPolicy(env, body);
        if (act==='confirmOperatingPayment') return await hConfirmOperatingPayment(env, body);
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
    const utcHour = new Date(event.scheduledTime).getUTCHours();
    if (utcHour===1) {
      await cronPreEventReminders(env);
      await cronGrantCompletedRewards(env);
      await cronTrialExpireReminders(env); // 試用到期提醒
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
