// DOING_MUST_FIX_CLOSURE_20260725ï¼šä»˜æ¬¾å›žå ±æ’¤å›žï¼ä¸»è¾¦å…¨æµç¨‹å–æ¶ˆï¼ä¸å¯æŠ—åŠ›å»¶æœŸå®Œæ•´è³‡æ–™èˆ‡é‡‘æµæ¬ç§»ï¼SaaS feature gate ä¿ç•™
// SAAS_TENANT_FEATURE_GATE_20260723ï¼šç§Ÿæˆ¶åŠŸèƒ½æ——æ¨™å¾Œç«¯å¼·åˆ¶é–˜é–€ï¼‹å‰å° bootstrap å›žå‚³
// SEAT_SINGLE_SOURCE_ACTUAL_FIX_20260722ï¼šå¯¦éš›ç§»é™¤èˆŠ APIã€è£œä¸Š saveSeatMapImageã€çµ±ä¸€ä½ç½®åˆ†é¡žèˆ‡è³‡æ–™ä¾†æº
// MEMBER_FASTPASS_PAYMENT_EQUIP_FIX_20260721ï¼šæœƒå“¡å…å¯©æ ¸ç‹€æ…‹å›žå‚³ï¼‹ä»˜æ¬¾å¡ç‰‡è¨­å‚™è‡ªå‚™é¡¯ç¤º
// FULL_FLOW_FIX_20260721ï¼šæœƒå“¡ã€é¸ä½ã€å ´åœ°åœ–ã€å–æ¶ˆé€€æ¬¾ã€ç¾å ´èˆ‡æ‹ç…§æ¡†é–‰ç’°ä¿®å¾©
// SEAT_FLOW_FIX_20260721ï¼šå‰å°é¸ä½æ„é¡˜ï¼å ´åœ°åœ–å¥—ç”¨ï¼24h ä¿ç•™èˆ‡é‡‹å‡ºé–‰ç’°ä¿®å¾©
// FINANCE_MODULE_CONFIRMED_20260707ï¼šåŒ…å« getPaymentProfiles / savePaymentProfile / disablePaymentProfile / getFinancePaymentGroups
// ================================================================
// DOINGï½œæ´»å‹•ç‡Ÿé‹ç®¡ç†ç³»çµ± Cloudflare Worker
// æ­£å¼ä¸»ç·šæª”æ¡ˆï¼šworker.js
// GitHub æ­£å¼ä¸»ç·šä¿ç•™ worker.jsï¼›å¦åŒæ­¥ç”¢å‡º worker.txt ä¾›äººå·¥ä¸‹è¼‰èˆ‡éƒ¨ç½²ã€‚
// Cloudflare Workers è«‹éƒ¨ç½² worker.txtï¼worker.js çš„ç›¸åŒå…§å®¹ã€‚
// æ›´æ–°æ—¥æœŸï¼š2026-06-28ï¼ˆç‰ˆæœ¬æ®˜ç•™æ¸…ç†ç‰ˆï¼‰
// ================================================================
// ç’°å¢ƒè®Šæ•¸ (Cloudflare Workers è¨­å®š)ï¼š
//   SUPABASE_URL  â€” DOING SaaS Supabase Project URL
//   SUPABASE_SERVICE_ROLE_KEY â€” Supabase service_role keyï¼ˆSUPABASE_KEY ç›¸å®¹å‚™æ´ï¼‰
//   RESEND_KEY    â€” Resend API key
//   AUTH_SECRET   â€” token é¹½å€¼ï¼ˆè‡ªè¨‚å­—ä¸²ï¼Œæ”¹å¾Œç®¡ç†å“¡éœ€é‡æ–°ç™»å…¥ï¼‰
//   OPENAI_API_KEY â€” OpenAI API é‡‘é‘°ï¼ˆAI ä¸»è¦–è¦ºç”Ÿæˆæ¨¡çµ„ï¼‰
//   OPENAI_IMAGE_MODEL â€” å¯é¸ï¼Œé è¨­ gpt-image-1.5
// wrangler.toml cronï¼š
//   [[triggers.crons]]
//   crons = ["0 1 * * *", "0 2 * * *"]
// ================================================================

// â”€â”€ SECTION 1: å¸¸æ•¸è¨­å®š â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DEFAULT_TENANT å·²ç§»é™¤ï¼šä¸»è¾¦ç©ºé–“å¿…é ˆç”±æ­£å¼ç™»å…¥ï¼è³‡æ–™é—œè¯è§£æžï¼Œä¸å…è¨±é è¨­ fallback
const PAY_DEADLINE_HOURS = 48;
const REMINDER_HOURS    = 36;
const STALL_HOLD_DAYS   = 3;
const SEAT_HOLD_HOURS   = 24; // åŠ åƒ¹é¸ä½ä¿ç•™ 24 å°æ™‚
const FORCE_CHOICE_HOURS = 48; // ä¸å¯æŠ—åŠ›é¸æ“‡æœŸé™å›ºå®š 48 å°æ™‚

// ä¸å¯æŠ—åŠ›åŽŸå› ä»£ç¢¼ï¼ˆå¾Œå°å–®é¸æ¸…å–®ï¼‰
const FORCE_REASON_CODES = {
  typhoon:                    'é¢±é¢¨è­¦å ±',
  heavy_rain:                 'è±ªé›¨ï¼å¤§é›¨ç‰¹å ±',
  earthquake_or_disaster:     'åœ°éœ‡æˆ–ç½å®³å®‰å…¨ç–‘æ…®',
  gov_work_school_suspension: 'æ”¿åºœå…¬å‘Šåœç­åœèª²',
  gov_order_cancel:           'æ”¿åºœï¼ä¸»ç®¡æ©Ÿé—œè¦æ±‚åœè¾¦',
  venue_safety_request:       'å ´åœ°æ–¹å…¬å…±å®‰å…¨è¦æ±‚',
  venue_unavailable:          'å ´åœ°çªç™¼ä¸å¯ä½¿ç”¨',
  traffic_disruption:         'äº¤é€šä¸­æ–·æˆ–é‡å¤§ç®¡åˆ¶',
  other_force_majeure:        'å…¶ä»–ä¸å¯æŠ—åŠ›å› ç´ ',
};

// fallback å¸¸æ•¸ï¼ˆç•¶ tenants è³‡æ–™åº«æ¬„ä½ç‚ºç©ºæ™‚ä½¿ç”¨ï¼‰
const FALLBACK_SITE_URL   = ''; // SaaS ä¸ç¶å›ºå®šå“ç‰Œç¶²å€ï¼›ç”± tenants.site_url / env æä¾›
// FALLBACK_LINE_URL å·²ç§»é™¤ï¼šLINE é€£çµåƒ…ç”± tenant_settings/tenants.line_url æä¾›ï¼Œç¼ºè¨­å®šä¸ fallback
// FALLBACK_BANK_INFO å·²ç§»é™¤ï¼šä»˜æ¬¾è³‡è¨Šåƒ…ç”± tenant è¨­å®šæä¾›ï¼Œç¼ºè¨­å®šä¸ fallback
const FALLBACK_EMAIL_FROM = 'DOINGï½œæ´»å‹•ç‡Ÿé‹ç®¡ç†ç³»çµ± <no-reply@ndian.live>'; // fallback onlyï¼›æ­£å¼å¯„ä»¶è³‡æ–™ä»¥ tenants è¨­å®š / env.MAIL_FROM ç‚ºæº–
const FALLBACK_EMAIL_REPLY= 'service@ndian.live'; // fallback onlyï¼›æ­£å¼å›žè¦†ä¿¡ç®±ä»¥ tenants è¨­å®š / env.MAIL_REPLY_TO ç‚ºæº–
const FALLBACK_TENANT_NAME= 'DOINGï½œæ´»å‹•ç‡Ÿé‹ç®¡ç†ç³»çµ±';
const DEFAULT_REFUND_RULES = {
  transferFeeDefault: 0,
  rules: [
    { key:'before_7', label:'æ´»å‹•å‰ 7 æ—¥ä»¥ä¸Šï¼šæ‰£è¡Œæ”¿è²» NT$500', minDays:7, adminFeeType:'fixed', adminFee:500 },
    { key:'before_3_6', label:'æ´»å‹•å‰ 3ï½ž6 æ—¥ï¼šé€€ 50%', minDays:3, maxDays:6, adminFeeType:'percent', adminFeePercent:50 },
    { key:'within_3', label:'æ´»å‹•å‰ 3 æ—¥å…§æˆ–ç•¶æ—¥ï¼šä¸é€€è²»', minDays:-9999, maxDays:2, adminFeeType:'percent', adminFeePercent:100 }
  ]
};

// â”€â”€ ä»˜æ¬¾ API è¨­å®šï¼ˆåŠŸèƒ½ä¿ç•™ã€å°šæœªå•Ÿç”¨ï¼Œkey è«‹è¨­å®šæ–¼ Cloudflare Workers ç’°å¢ƒè®Šæ•¸ï¼‰â”€â”€
const ECPAY_MERCHANT_ID = 'YOUR_ECPAY_MERCHANT_ID';
const ECPAY_HASH_KEY    = 'YOUR_ECPAY_HASH_KEY';
const ECPAY_HASH_IV     = 'YOUR_ECPAY_HASH_IV';
const ECPAY_API_URL     = 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

const LINEPAY_CHANNEL_ID = 'YOUR_LINEPAY_CHANNEL_ID';
const LINEPAY_SECRET     = 'YOUR_LINEPAY_SECRET';
const LINEPAY_API_URL    = 'https://api-pay.line.me';
const WORKER_PUBLIC_URL  = ''; // SaaS ä¸ç¶èˆŠ Workerï¼›æ­£å¼ç¶²å€ç”± env.WORKER_URL æä¾›

// â”€â”€ AI ä¸»è¦–è¦ºç”Ÿæˆæ¨¡çµ„ï¼ˆ022ï¼‰â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AI_VISUAL_BUCKET = 'session-visuals';
const AI_VISUAL_COUNT = 1;
const AI_VISUAL_SIZE = '1024x1024'; // å…¨éƒ¨å›ºå®š 1:1
const AI_VISUAL_DEFAULT_MODEL = 'gpt-image-1.5';
const AI_VISUAL_DEFAULT_QUALITY = 'medium';
const AI_VISUAL_PRESETS = {
  general_event: {
    label: 'é€šç”¨æ´»å‹•',
    rules: 'polished event key visual, clear hierarchy, coherent composition, adaptable to the event information supplied by the tenant, no fixed brand identity, no fixed mascot, no fixed logo, no fixed color palette',
    subject: 'the visual must be derived from the current tenant event title, description, date, location and optional theme note stored in the system',
    avoid: 'no unrelated brand identity, no hard-coded campaign name, no copied legacy event style, no fixed tenant-specific visual language'
  }
};


// â”€â”€ SECTION 2: å·¥å…·å‡½å¼ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ ç§Ÿæˆ¶è§£æžï¼šå¾ž GET params æˆ– POST body å–å¾— tenantId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getTenantId(p) {
  // p å¯èƒ½æ˜¯ URL searchParams æˆ– POST body
  // ç¼ºå°‘å…§éƒ¨ä¸»è¾¦è­˜åˆ¥æ™‚å›žå‚³ nullï¼Œä¸å…è¨± fallback è‡³ä»»ä½•é è¨­å€¼
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

// â”€â”€ JWT / Token å®‰å…¨å±¤ï¼ˆGoogle OAuth å‡ç´šï¼‰â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// JWT_SECRET å¿…é ˆä¾†è‡ªç’°å¢ƒè®Šæ•¸ï¼Œä¸å¾—æœ‰ä»»ä½•é è¨­å€¼
function jwtSecret(env) {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET ç’°å¢ƒè®Šæ•¸æœªè¨­å®šï¼Œè«‹æ–¼ Cloudflare Workers Secrets è¨­å®š');
  return env.JWT_SECRET;
}

// ç›¸å®¹èˆŠ token æ ¼å¼ï¼ˆéŽæ¸¡æœŸï¼Œ90 å¤©å¾Œå¯ç§»é™¤ï¼‰
function authSecret(env) {
  if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET ç’°å¢ƒè®Šæ•¸æœªè¨­å®š');
  return env.AUTH_SECRET;
}
// makeToken ä¿ç•™ä¾›èˆŠè·¯å¾‘ç›¸å®¹ï¼Œæ–°è·¯å¾‘å…¨ç”¨ signAdminJwt
function makeToken(email, tenantId, env) {
  return md5(email + tenantId + authSecret(env));
}

// â”€â”€ HS256 JWT å¯¦ä½œï¼ˆWeb Crypto APIï¼‰â”€â”€
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
    if (payload.expires_at && Date.now() > payload.expires_at) return null; // å·²éŽæœŸ
    return payload;
  } catch(e) { return null; }
}

// ç°½ç™¼å¾Œå° admin JWTï¼ˆ30 å¤©æœ‰æ•ˆï¼‰
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
    expires_at: now + 30 * 24 * 60 * 60 * 1000,  // 30 å¤©
  };
  return signAdminJwt(payload, env);
}

// å…è¼¸å…¥ä¸»è¾¦è­˜åˆ¥ç™»å…¥ï¼šå¤šå·¥ä½œç©ºé–“é¸æ“‡ç”¨çŸ­æ•ˆ JWTï¼ˆ10 åˆ†é˜ï¼‰
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

// ç°½ç™¼å‰å°æœƒå“¡ JWTï¼ˆ30 å¤©æœ‰æ•ˆï¼‰
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
    expires_at: now + 30 * 24 * 60 * 60 * 1000,  // 30 å¤©
  };
  return signAdminJwt(payload, env);
}

// æª¢æŸ¥ tenant æ˜¯å¦è¢«éŽ–å®š
async function checkTenantLocked(env, tenantId) {
  try {
    const rows = await dbGet(env, 'tenants', `id=eq.${tenantId}&select=is_locked,locked_reason,plan_type,trial_end_at`);
    const t = rows[0];
    if (!t) return { locked: false };
    if (t.is_locked) return { locked: true, reason: t.locked_reason || 'å¸³è™Ÿå·²éŽ–å®š' };
    // DOINGï¼šå¸³è™Ÿï¼è¨­å®šï¼é è¦½æœ¬èº«ä¸å› èˆŠ trial_end_at è‡ªå‹•éŽ–å®šï¼›æ­£å¼ç‡Ÿé‹æ¬Šå¦ç”±ç™¼å¸ƒï¼é ç´„ entitlement åˆ¤æ–·ã€‚
    return { locked: false };
  } catch(e) { return { locked: false }; }
}

// é©—è­‰ admin tokenï¼ˆå„ªå…ˆ JWTï¼Œå›žé€€èˆŠ makeToken æ ¼å¼ç›¸å®¹ï¼‰
async function verifyAdminToken(token, email, tenantId, env) {
  if (!token || !email) return null;
  // æ–°æ ¼å¼ï¼šJWT
  if (token.includes('.')) {
    const payload = await verifyAdminJwt(token, env);
    if (!payload) return null;
    if (payload.email !== email) return null;
    // platform_super_admin ä¸å— tenant é™åˆ¶
    if (payload.normalized_role === 'platform_super_admin' || payload.role === 'platform_super_admin') return payload;
    if (payload.tenant_id !== tenantId) return null;
    return payload;
  }
  // èˆŠæ ¼å¼ç›¸å®¹ï¼ˆéŽæ¸¡æœŸï¼‰ï¼šé‡æ–°æŸ¥ DB é©—è­‰
  const expected = makeToken(email, tenantId, env);
  const expectedPlatform = makeToken(email, 'platform', env);
  if (token !== expected && token !== expectedPlatform) return null;
  return { email, tenant_id: tenantId, role: '', legacy: true };
}

function genId(prefix) {
  // å ±åè¡¨ ID ç¸®çŸ­ä¸”å¯ä¾æ™‚é–“æŽ’åºï¼ˆè‡ªè¡Œç·¨æŽ’ã€ä¸éŽé•·ï¼‰ï¼›å…¶é¤˜ ID ç¶­æŒåŽŸæ¨£
  if (prefix === 'REG') {
    return 'R' + Date.now().toString(36).toUpperCase() + crypto.randomUUID().replace(/-/g,'').slice(0,6).toUpperCase();
  }
  // H-04ï¼šæ”¹ç”¨ crypto.randomUUIDï¼Œç§»é™¤ 4 ç¢¼å°¾ç¢¼ç¢°æ’žé¢¨éšª
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}
function secureRandomInt(min,max){
  const lo=Math.ceil(Number(min)),hi=Math.floor(Number(max));
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<lo)throw new Error('äº‚æ•¸ç¯„åœä¸æ­£ç¢º');
  const range=hi-lo+1,limit=Math.floor(0x100000000/range)*range,buf=new Uint32Array(1);
  do{crypto.getRandomValues(buf)}while(buf[0]>=limit);
  return lo+(buf[0]%range);
}
function isPaidStatus(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  if (['å·²ç¹³è²»','å·²ä»˜æ¬¾','ä»˜æ¬¾å®Œæˆ','ä»˜æ¬¾æˆåŠŸ','paid','confirmed_paid','payment_confirmed'].includes(s)) return true;
  if (s.includes('å·²ç¹³è²»') || s.includes('å·²ä»˜æ¬¾')) return true;
  return false;
}
function isBookingSecuredStatus(v){const s=String(v||'').trim();return isPaidStatus(s)||s==='å·²ä»˜è¨‚é‡‘'||s==='deposit_paid'}
function safeNum(v) {
  const n = Number(v);
  return isNaN(n) || n < 0 ? 0 : n;
}
function isCapacityInactiveTransferStatus(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  if (['å·²å»¶æœŸ','transferred','ç”³è«‹é€€è²»','é€€è²»ä¸­','é€€è²»å¾…è™•ç†','é€€æ¬¾å¾…è™•ç†','å·²é€€è²»','å·²é€€æ¬¾','refund_pending','refunded'].includes(s)) return true;
  return s.includes('é€€è²»') || s.includes('é€€æ¬¾') || s.includes('refund');
}
function isCapacityInactiveReviewStatus(v) {
  return ['å·²å–æ¶ˆ','ä¸éŒ„å–','æœªéŒ„å–'].includes(String(v || ''));
}
function isActiveForCapacity(reg) {
  if (!reg) return false;
  if (isCapacityInactiveReviewStatus(reg.review_status)) return false;
  if (isCapacityInactiveTransferStatus(reg.transfer_status)) return false;
  return true;
}
// M-01ï¼šadjustSessionCurrentCount æ”¹ç”¨åŽŸå­ RPCï¼ˆé˜²ä¸¦ç™¼ï¼‰
// delta > 0 = claimï¼ˆå ±åï¼‰ï¼Œdelta < 0 = releaseï¼ˆå–æ¶ˆ/é€€è²»ï¼‰
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
  if (typeof str !== 'string') return str;  // å·²æ˜¯ object/arrayï¼Œç›´æŽ¥å›žå‚³
  if (!str.trim()) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}
function agreementRequiredOn(v) {
  return !(v === false || v === 'false' || v === 0 || v === '0' || String(v || '').toLowerCase() === 'no' || String(v || '').toLowerCase() === 'off');
}
function getDisplayName(name, brand) { return brand || name || 'æ‚¨'; }
function nowIso() { return new Date().toISOString(); }
function nowTaipeiText() { return new Date().toLocaleString('zh-TW', {timeZone:'Asia/Taipei', hour12:false}); }

// ä¸å¯æŠ—åŠ›ä¸‰å±¤å°è±¡åˆ†é¡žï¼ˆç”±å¾Œç«¯ DB ç‹€æ…‹æ±ºå®šï¼Œå‰å°ä¸è‡ªè¡Œåˆ¤æ–·ï¼‰
// ç¬¬ä¸€å±¤ï¼šå·²éŒ„å–ï¼‹å·²ä»˜æ¬¾ or å·²éŒ„å–ï¼‹ä»˜æ¬¾å¾…ç¢ºèª â†’ å¯é¸å»¶æœŸæˆ–é€€è²»
// ç¬¬äºŒå±¤ï¼šå·²éŒ„å–æœªä»˜æ¬¾ or å¾…å¯©æ ¸ â†’ åªé€šçŸ¥ï¼Œä¸çµ¦é¸æ“‡
// ç¬¬ä¸‰å±¤ï¼šå·²å–æ¶ˆ / ä¸éŒ„å– / å·²é€€è²» / ç„¡æœ‰æ•ˆå ±å â†’ ä¸é€²å…¥æµç¨‹
function classifyForceLayer(reg) {
  const rs = String(reg.review_status || '');
  const ps = String(reg.payment_status || '');
  const ts = String(reg.transfer_status || '');
  // ç¬¬ä¸‰å±¤
  if (['å·²å–æ¶ˆ'].includes(rs)) return 3;
  if (['ä¸éŒ„å–', 'æœªéŒ„å–'].includes(rs)) return 3;
  if (['å·²é€€è²»', 'refunded'].includes(ts)) return 3;
  // ç¬¬ä¸€å±¤
  if (rs === 'å·²éŒ„å–' && (isPaidStatus(ps) || ps === 'å¾…ç¢ºèª')) return 1;
  // ç¬¬äºŒå±¤
  if (rs === 'å·²éŒ„å–' || rs === 'å¾…å¯©æ ¸') return 2;
  return 3;
}
function cleanEventId(v) {
  const s = String(v ?? '').trim();
  if (!s || s === '0' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
  return s;
}

// â”€â”€ SECTION 3: MD5ï¼ˆToken é©—è­‰ï¼‰â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ SECTION 4: åŠ å¯†å·¥å…·ï¼ˆECPay / LINE Payï¼‰â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ SECTION 5: CORS / Response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ SECTION 6: Supabase æŸ¥è©¢å·¥å…· â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
// å¤§é‡è³‡æ–™é˜²æˆªæ–·ï¼šSupabase å–®æ¬¡ä¸Šé™ 1000 ç­†ã€‚å‘¼å«ç«¯æœªè‡ªè¨‚ limit æ™‚ï¼Œ
// ä¸€æ—¦å‘½ä¸­ 1000 ç­†ä»£è¡¨å¯èƒ½è¢«æˆªæ–·ï¼Œæ”¹ç”¨ç©©å®šæŽ’åº(order=id.ascï¼Œæˆ–æ²¿ç”¨æ—¢æœ‰ order)
// ä»¥ offset é€é æŠ“é½Šå…¨éƒ¨ï¼Œé¿å…çµ±è¨ˆ/åŠ ç¸½/åŒ¯å‡ºç®—éŒ¯ã€‚æœ‰è‡ªè¨‚ limit è€…ç…§èˆŠå–®æ¬¡æŠ“ã€‚
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
      // æ¥µå°‘æ•¸ç„¡ id æ¬„ä½çš„è¡¨ï¼ŒåŠ  order=id æœƒå¤±æ•— â†’ é€€å›žä¸åŠ æŽ’åºçš„ offset ç¿»é 
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

// M-01ï¼šRPC å‘¼å«ï¼ˆç”¨æ–¼åŽŸå­åé¡æ“ä½œï¼‰
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

// â”€â”€ SECTION 6.4: ç³»çµ±ç•°å¸¸ç´€éŒ„ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// å…¨éƒ¨éŒ¯èª¤éƒ½å¯«é€² error_logsï¼Œå¾Œå°ã€Œç³»çµ±ç•°å¸¸ã€é çœ‹å¾—åˆ°ã€‚
// ä¸‰å€‹éµå‰‡ï¼š
//   1. è¨˜éŒ„å¤±æ•—çµ•ä¸å¯ä»¥åéŽä¾†å®³åˆ°ä¸»æµç¨‹ â€”â€” æ‰€ä»¥æ•´æ®µåŒ… try/catchï¼Œæ°¸ä¸ throwã€‚
//   2. ä¸è¨˜å¯†ç¢¼ã€tokenã€é‡‘é‘° â€”â€” å‡ºäº‹çš„ç´€éŒ„ä¸èƒ½è®Šæˆæ–°çš„å¤–æ´©ä¾†æºã€‚
//   3. è¨˜ä¸‹ã€Œå“ªä¸€ç­†ã€å“ªå€‹åŠŸèƒ½ã€ä»€éº¼éŒ¯èª¤ã€ï¼Œå…‰å¯«ã€Œç•°å¸¸ã€ç­‰æ–¼æ²’å¯«ã€‚
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
    // å¯«ç´€éŒ„æœ¬èº«å¤±æ•—å°±åªèƒ½åžæŽ‰ â€”â€” ä½†è‡³å°‘ç•™åœ¨ consoleï¼Œä¸èƒ½è®“å®ƒæ‹–åž®ä½¿ç”¨è€…çš„è«‹æ±‚ã€‚
    console.error('logError failed:', e && e.message ? e.message : e);
  }
}

// å¾Œå°ï¼šè®€ç³»çµ±ç•°å¸¸ç´€éŒ„
async function hGetErrorLogs(env, p) {
  const TENANT = p._tenantId;
  if (!await verifyStaff(env, p.email, p.token, TENANT, 'superadmin')) return jsonErr('ç„¡æ¬Šé™');
  const limit = Math.min(Math.max(parseInt(p.limit, 10) || 100, 1), 500);
  let q = `order=created_at.desc&limit=${limit}&select=*`;
  // å¹³å°å±¤ç´šçš„éŒ¯èª¤å¯èƒ½é‚„æ²’è§£æžå‡º tenantï¼ˆtenant_id ç‚ºç©ºï¼‰ï¼Œè¶…ç®¡è¦çœ‹å¾—åˆ°ï¼Œæ‰€ä»¥ä¸€ä½µæ’ˆã€‚
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
// å¾Œå°ï¼šæ¸…é™¤èˆŠçš„ç•°å¸¸ç´€éŒ„ï¼ˆå…¨éƒ¨éƒ½è¨˜ â†’ é‡æœƒå¾ˆå¤§ï¼Œè¦èƒ½æ¸…ï¼‰
async function hPurgeErrorLogs(env, b) {
  const TENANT = b._tenantId;
  if (!await verifyStaff(env, b.email, b.token, TENANT, 'superadmin')) return jsonErr('ç„¡æ¬Šé™');
  const days = Math.min(Math.max(parseInt(b.days, 10) || 30, 1), 365);
  const res = await dbRpc(env, 'purge_error_logs', {p_days: days});
  return jsonOk(res || {ok:true});
}

// â”€â”€ SECTION 6.5: çŸ­ç¶²å€ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ç§Ÿæˆ¶åˆ†äº«ç”¨ã€‚/s/<code> ç”±å„ç§Ÿæˆ¶è¨­å®šçš„å…¬é–‹ç¶²åŸŸå°Žå…¥æœ¬ Workerã€‚
// åŽ»æŽ‰å®¹æ˜“çœ‹éŒ¯çš„ l / o / 0 / 1ï¼Œé¿å…æ”¤å‹æ‰‹æŠ„çŸ­ç¢¼æ™‚è¼¸éŒ¯ã€‚
const SHORT_CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const SHORT_CODE_LEN = 6;
function genShortCode() {
  const arr = new Uint32Array(SHORT_CODE_LEN);
  crypto.getRandomValues(arr);
  let s = '';
  for (let i=0; i<SHORT_CODE_LEN; i++) s += SHORT_CODE_ALPHABET[arr[i] % SHORT_CODE_ALPHABET.length];
  return s;
}
// çŸ­ç¶²å€ä¸€å¾‹æŽ›åœ¨è©²ç§Ÿæˆ¶è‡ªå·±çš„ç«™å°æ ¹ç›®éŒ„åº•ä¸‹ã€‚
function shortLinkUrl(siteUrl, code) {
  if (!siteUrl) throw new Error('TENANT_SITE_URL_REQUIRED');
  return new URL('/s/' + code, siteUrl).toString();
}
// è½‰å€ç›®æ¨™ï¼å ´æ¬¡å ±åé ã€‚æ ¼å¼èˆ‡å‰å° shareUrl() ä¸€è‡´ï¼Œæ”¹ä¸€é‚Šè¦è¨˜å¾—æ”¹å¦ä¸€é‚Šã€‚
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
    + '<title>é€£çµç„¡æ•ˆ</title>'
    + '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#F8F6F0;'
    + 'font-family:-apple-system,BlinkMacSystemFont,\'Noto Sans TC\',sans-serif;color:#111111">'
    + '<div style="text-align:center;padding:24px;line-height:1.8">'
    + '<div style="font-size:20px;font-weight:900;margin-bottom:12px">' + msg + '</div>'
    + '<div style="font-weight:700;color:#666666">è«‹å›žåˆ°ä¸»è¾¦æä¾›çš„æ´»å‹•é é¢</div>'
    + '</div></body>';
  return new Response(html, {status: status, headers: {'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}});
}
async function hShortRedirect(env, code) {
  let rows;
  try {
    rows = await dbRpc(env, 'short_link_hit', {p_code: code});
  } catch(e) {
    // ä¸åžéŒ¯èª¤ï¼šè³‡æ–™åº«æŽ›æŽ‰å°±æ˜Žè¬›ï¼Œä¸è¦å‡è£é€£çµå£žæŽ‰ã€‚
    console.error('short_link_hit failed:', e && e.message); logError(env, {source:'hShortRedirect', message:'short_link_hit failed:', error:e && e.message});
    return shortLinkErrorPage('çŸ­ç¶²å€æœå‹™æš«æ™‚ç•°å¸¸ï¼Œè«‹ç¨å¾Œå†è©¦ã€‚', 500);
  }
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || !row.session_id) return shortLinkErrorPage('é€™å€‹çŸ­ç¶²å€ä¸å­˜åœ¨æˆ–å·²å¤±æ•ˆã€‚', 404);
  const ctx = await getTenantCtx(env, row.tenant_id).catch(()=>null);
  return Response.redirect(sessionShareUrl(ctx && ctx.siteUrl, row.session_id), 302);
}
// å–å¾—æˆ–å»ºç«‹å ´æ¬¡çŸ­ç¶²å€ã€‚å¾Œå°èˆ‡å‰å°å…±ç”¨åŒä¸€ä»½ï¼ˆä¸€å€‹å ´æ¬¡æ°¸é åªæœ‰ä¸€çµ„çŸ­ç¶²å€ï¼‰ã€‚
async function ensureShortLinkForSession(env, TENANT, sessionId) {
  const sid = String(sessionId || '').trim();
  if (!sid) return {error:'ç¼ºå°‘å ´æ¬¡'};
  const ses = await dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(sid)}&select=id`);
  if (!ses.length) return {error:'æ‰¾ä¸åˆ°é€™å€‹å ´æ¬¡'};
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
  if (!row) return {error:'çŸ­ç¢¼ç”¢ç”Ÿå¤±æ•—ï¼Œè«‹å†è©¦ä¸€æ¬¡ï¼š' + lastErr};
  return {sessionId:sid, code:row.code, clicks:0,
          url:shortLinkUrl(ctx && ctx.siteUrl, row.code), created:true};
}

// å¾Œå°ï¼šç‚ºå ´æ¬¡ç”¢ç”ŸçŸ­ç¶²å€ï¼ˆå«é»žæ“Šæ•¸ï¼‰
async function hCreateShortLink(env, b) {
  const TENANT = b._tenantId;
  if (!await verifyStaff(env, b.email, b.token, TENANT, 'sessions')) return jsonErr('ç„¡æ¬Šé™');
  const r = await ensureShortLinkForSession(env, TENANT, b.sessionId);
  return r.error ? jsonErr(r.error) : jsonOk(r);
}

// å‰å°ï¼ˆå…¬é–‹ï¼‰ï¼šæ”¤å‹åˆ†äº«å ´æ¬¡ç”¨ã€‚åªèƒ½ã€Œå–å¾—æŸå ´æ¬¡çš„çŸ­ç¶²å€ã€ï¼Œä¸å›žå‚³é»žæ“Šæ•¸ã€‚
async function hGetSessionShortLink(env, p) {
  const TENANT = p._tenantId;
  const r = await ensureShortLinkForSession(env, TENANT, p.sessionId);
  if (r.error) return jsonErr(r.error);
  return jsonOk({sessionId:r.sessionId, code:r.code, url:r.url});
}

// â”€â”€ SECTION 7: ç®¡ç†å“¡é©—è­‰ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AI é«˜æˆæœ¬åŠŸèƒ½å°ˆç”¨ï¼šåªå…è¨±çœŸæ­£çš„å¹³å°è¶…ç´šç®¡ç†å“¡ï¼Œä¸èƒ½ç”¨ organizer_owner æˆ–ä¸€èˆ¬ superadmin æ¬Šé™ä»£æ›¿ã€‚
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

  // é©—è­‰ tokenï¼ˆJWT æˆ–èˆŠæ ¼å¼ï¼‰
  const jwtPayload = await verifyAdminToken(token, email, tid, env);
  if (!jwtPayload) return false;

  const role = jwtPayload.normalized_role || jwtPayload.role || '';
  const limitSessions = jwtPayload.limit_sessions || '';

  // platform_super_admin ç›´é€šï¼ˆè·¨ tenantï¼‰
  if (role === 'platform_super_admin') return true;

  // tenant éš”é›¢ï¼štoken å…§çš„ tenant_id æ‰æ˜¯æº–çš„ï¼Œå‰ç«¯å‚³ä¾†çš„ä¸å¯ä¿¡
  if (jwtPayload.tenant_id !== tid && !jwtPayload.legacy) return false;

  // èˆŠæ ¼å¼å›žé€€ï¼šæŸ¥ DB ç¢ºèª
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

  // JWT æ ¼å¼ï¼šå¾ž payload å–è§’è‰²
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
    // ä¸å¯åœ¨æ­¤ç›´æŽ¥ returnã€‚ç¾å ´äººå“¡ / å ´æ¬¡ç®¡ç†å“¡é‚„å¿…é ˆç¹¼çºŒå¾€ä¸‹æª¢æŸ¥ session æŽˆæ¬Šï¼Œ
    // é¿å…æ”¹ URL æˆ–ç›´æŽ¥æ‰“ API å°±è®€åˆ°æœªæŽˆæ¬Šå ´æ¬¡ã€‚
  }

  if (requiredRole === 'review' || requiredRole === 'sessions' || requiredRole === 'events') {
    const allowed = ['organizer_owner','platform_super_admin','organizer_admin','session_admin','finance_admin'];
    return allowed.includes(normalizedRole);
  }

  if (requiredRole === 'announce') {
    const allowed = ['organizer_owner','platform_super_admin','organizer_admin'];
    return allowed.includes(normalizedRole);
  }

  // æœ‰ sessionId é™åˆ¶ï¼šsession_admin / onsite_staff åªèƒ½çœ‹æŽˆæ¬Šå ´æ¬¡
  if (sessionId && limitSessions) {
    if (['session_admin','onsite_staff'].includes(normalizedRole)) {
      const allowed = String(limitSessions).split(',').map(s=>s.trim()).filter(Boolean);
      if (allowed.length && !allowed.includes(sessionId)) return false;
    }
  }

  // JWT é©—è­‰é€šéŽå¾Œä»å›žæŸ¥ staff æœ€æ–°ç‹€æ…‹ï¼Œé¿å…åœç”¨æˆ–å ´æ¬¡æ¬Šé™è®Šæ›´å¾ŒèˆŠ token ä»å¯ä½¿ç”¨ã€‚
  const activeRows = await dbGet(env, 'staff', `tenant_id=eq.${tid}&email=eq.${encodeURIComponent(email)}&select=is_active,active,limit_sessions,role,normalized_role`).catch(()=>[]);
  if (activeRows[0]) {
    const active = activeRows[0].is_active !== undefined ? activeRows[0].is_active : activeRows[0].active;
    if (active === false) return false;
    const dbRole = activeRows[0].normalized_role || activeRows[0].role || normalizedRole;
    const dbLimitSessions = activeRows[0].limit_sessions || '';
    if (sessionId && ['onsite_staff','session_admin'].includes(dbRole)) {
      // 009 æ¬Šé™è¡¨å„ªå…ˆï¼›è‹¥å°šæœªåŸ·è¡Œ 009 æˆ–æŸ¥ä¸åˆ°è¡¨ï¼Œæ‰å›žé€€ staff.limit_sessionsã€‚
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
  return true; // é€šéŽåŸºæœ¬é©—è­‰ï¼Œç„¡ç‰¹æ®Š requiredRole
}

// â”€â”€ SECTION 8: Session æ ¼å¼åŒ– / è²»ç”¨è¨ˆç®— â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // ä¸å¯æŠ—åŠ›æ¨¡çµ„æ¬„ä½
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
    // â”€â”€ åˆç´„åŒæ„è¨­å®š â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const stalls = Math.max(parseInt(stallCount)||1, 1); // ç„¡ä¸Šé™ï¼Œç”±å¾Œå° maxStalls æŽ§åˆ¶
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
  // Aâ†’Z é˜»æ–·ä¿®æ­£ï¼šè²»ç”¨è¨ˆç®—ä»¥å¾Œå°è¨­å‚™è¨­å®š incl ç‚ºæº–ã€‚
  // å‰å°è‹¥é¡¯ç¤ºã€Œæœ¬æ¬¡å« Nã€ï¼Œå¾Œç«¯ä¹Ÿå¿…é ˆæŠŠ N ä»¶è¦–ç‚ºå…§å«ï¼Œä¸å¯å†ä¾ basic_equip æ–‡å­—çŒœæ¸¬ã€‚
  const raw = Number(def?.incl)||0;
  return raw > 0 ? raw : 0;
}
// B-04 è¨­å‚™æ­£å¼èªžæ„ï¼ˆå”¯ä¸€å®šç¾©ï¼Œå‰å¾Œç«¯ä¸€è‡´ï¼‰ï¼š
//   equipment_json = è©²å ±åã€Œå¯¦éš›é¸æ“‡çš„è¨­å‚™ç¸½é‡ã€ï¼Œä¸æ˜¯åŠ ç§Ÿé‡ã€‚
//   å…§å«ç¸½é‡ = æ¯æ”¤å…§å«æ•¸ Ã— æ”¤ä½æ•¸
//   åŠ ç§Ÿæ•¸é‡ = max(0, å·²é¸ç¸½é‡ - å…§å«ç¸½é‡)
//   è¨­å‚™è²»   = åŠ ç§Ÿæ•¸é‡ Ã— å–®åƒ¹
// åŽŸæœ¬ incl æ²’ä¹˜æ”¤ä½æ•¸ï¼ˆstalls ç®—äº†å»æ²’ç”¨ï¼‰ï¼Œå°Žè‡´ 4 æ”¤å« 1 æ¡Œé¸ 4 æ¡Œæ™‚è¢«å¤šæ”¶ 3 æ¡ŒéŒ¢ã€‚
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

// â”€â”€ SECTION 9: Email å·¥å…·ï¼ˆResend APIï¼‰â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendEmail(env, to, subject, htmlBody, tenantCtx) {
  // ç›¸å®¹èˆŠå¯«æ³• sendEmail(env,{to,subject,html})ï¼Œé¿å… SaaS å¹³å°é€šçŸ¥å¤±æ•ˆã€‚
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
// emailWrapï¼šä¾ç§Ÿæˆ¶å‹•æ…‹é¡¯ç¤ºå“ç‰Œåç¨±èˆ‡é å°¾
function emailWrap(content, tenantCtx) {
  const name    = (tenantCtx && tenantCtx.name)    || FALLBACK_TENANT_NAME;
  const footer  = (tenantCtx && tenantCtx.footer)  || (name + 'ã€€All rights reserved.');
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
  const tid = (tenantCtx && tenantCtx.id) || '';  // M-02ï¼šid ç¼ºæ¼æ™‚ä¸è¼¸å‡º 'undefined' å­—ä¸²
  const sep = base.includes('?') ? '&' : '?';
  // å‰å°ä»¥ page=member åˆ¤æ–·è¦é–‹ã€Œæˆ‘çš„ç´€éŒ„ã€ï¼›member=1 ä¸€ä½µä¿ç•™ä»¥ç›¸å®¹èˆŠé€£çµã€‚
  return base + sep + 'page=member&member=1&tenant=' + encodeURIComponent(tid) + (regId ? '&pay='+encodeURIComponent(regId) : '');
}
function emailBtn(label, href, bg, color, extraStyle='') {
  return `<a href="${href}" style="display:block;background:${bg};color:${color};border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;line-height:1.35;text-align:center;padding:11px 10px;white-space:nowrap;${extraStyle}">${label}</a>`;
}
function defaultEmailTemplates() {
  // SaaS ä¿¡ä»¶æ¨¡æ¿ï¼šåŠŸèƒ½ä¿ç•™ï¼Œæ˜¯å¦å¯„å‡ºç”± email_templates.is_active æŽ§åˆ¶ã€‚
  // DOING é è¨­é—œé–‰ã€ŒæŸ¥è©¢åž‹é€šçŸ¥ã€ï¼Œå„ä¸»è¾¦å¯ä¾ç§Ÿæˆ¶è¨­å®šåœ¨å¾Œå°é–‹å•Ÿã€‚
  return [
    {
      template_key:'registration_received',
      title:'å ±åç¢ºèªä¿¡',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘æˆ‘å€‘å·²æ”¶åˆ°æ‚¨çš„å ±å',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æˆ‘å€‘å·²æ”¶åˆ°æ‚¨å ±å [å ´æ¬¡åç¨±]ã€‚

æ—¥æœŸï¼š[å ±åæ—¥æœŸ]
æ”¤ä½æ•¸ï¼š[æ”¤ä½æ•¸] æ”¤
è¨­å‚™ï¼š[è¨­å‚™]
æ‡‰ç¹³é‡‘é¡ï¼šNT$ [æ‡‰ç¹³é‡‘é¡]

è«‹å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥çœ‹å¯©æ ¸é€²åº¦èˆ‡å ±åç‹€æ…‹ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:false,
      group:'å ±åæµç¨‹'
    },
    {
      template_key:'approval_notice',
      title:'éŒ„å–é€šçŸ¥ä¿¡',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘éŒ„å–é€šçŸ¥',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æ­å–œæ‚¨éŒ„å– [å ´æ¬¡åç¨±]ã€‚

å ´æ¬¡ï¼š[å ´æ¬¡åç¨±]
æ—¥æœŸï¼š[å ±åæ—¥æœŸ]
æ”¤ä½æ•¸ï¼š[æ”¤ä½æ•¸] æ”¤
è¨­å‚™ï¼š[è¨­å‚™]
æ‡‰ç¹³é‡‘é¡ï¼šNT$ [æ‡‰ç¹³é‡‘é¡]

æ”¤ä½è™Ÿç¢¼å°‡æ–¼æ´»å‹•å‰å…¬å¸ƒï¼Œå±†æ™‚è«‹è‡³ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥çœ‹ï¼›è¡Œå‰é€šçŸ¥ä¿¡ä¹Ÿæœƒä¸€ä½µé™„ä¸Šæ‚¨çš„æ”¤ä½èˆ‡å ´åœ°åœ–ã€‚

è«‹å›žåˆ°å ±åç³»çµ±ã€Œæˆ‘çš„ç´€éŒ„ã€ç™»å…¥æŸ¥çœ‹ç¹³è²»è³‡è¨Šã€ä»˜æ¬¾å¸³æˆ¶èˆ‡æœ€æ–°é€²åº¦ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:true,
      group:'å¯©æ ¸æµç¨‹'
    },
    {
      template_key:'rejection_notice',
      title:'æœªéŒ„å–é€šçŸ¥ä¿¡',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘å ±åçµæžœé€šçŸ¥',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æ„Ÿè¬æ‚¨å ±å [å ´æ¬¡åç¨±]ã€‚

å¾ˆæŠ±æ­‰ï¼Œæœ¬å ´æ¬¡æœªéŒ„å–ã€‚æ‚¨ä»å¯å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥çœ‹å ±åç´€éŒ„ï¼Œæˆ–æŸ¥çœ‹å…¶ä»–é–‹æ”¾å ´æ¬¡ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:false,
      group:'å¯©æ ¸æµç¨‹'
    },
    {
      template_key:'payment_reminder',
      title:'ç¹³è²»æœŸé™æé†’',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘ç¹³è²»æœŸé™æé†’',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æé†’æ‚¨ï¼Œæ‚¨å·²éŒ„å– [å ´æ¬¡åç¨±]ï¼Œç›®å‰å°šæœªå®Œæˆç¹³è²»ã€‚

æ—¥æœŸï¼š[å ±åæ—¥æœŸ]
æ”¤ä½æ•¸ï¼š[æ”¤ä½æ•¸] æ”¤
è¨­å‚™ï¼š[è¨­å‚™]
æ‡‰ç¹³é‡‘é¡ï¼šNT$ [æ‡‰ç¹³é‡‘é¡]

è«‹å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥çœ‹ä»˜æ¬¾å¸³æˆ¶ä¸¦å®Œæˆç¹³è²»ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:true,
      group:'ä»˜æ¬¾æµç¨‹'
    },
    {
      template_key:'payment_report_received',
      title:'ç¹³è²»å›žå ±æ”¶åˆ°ä¿¡',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘ç¹³è²»å›žå ±å·²æ”¶åˆ°',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æˆ‘å€‘å·²æ”¶åˆ°æ‚¨çš„ç¹³è²»å›žå ±ï¼Œä»˜æ¬¾ç‹€æ…‹ç›®å‰ç‚ºå¾…ç¢ºèªã€‚

å ´æ¬¡ï¼š[å ´æ¬¡åç¨±]
ä»˜æ¬¾æ–¹å¼ï¼š[ä»˜æ¬¾æ–¹å¼]
å›žå ±é‡‘é¡ï¼šNT$ [å›žå ±é‡‘é¡]
æœ«äº”ç¢¼ï¼š[æœ«äº”ç¢¼]

è«‹å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥çœ‹ä»˜æ¬¾ç¢ºèªé€²åº¦ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:false,
      group:'ä»˜æ¬¾æµç¨‹'
    },
    {
      template_key:'payment_confirmed',
      title:'ç¹³è²»ç¢ºèªä¿¡',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘ç¹³è²»ç¢ºèª',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æ‚¨çš„ä»˜æ¬¾å·²ç¢ºèªå®Œæˆã€‚

å ´æ¬¡ï¼š[å ´æ¬¡åç¨±]
ç¹³è²»é‡‘é¡ï¼šNT$ [æ‡‰ç¹³é‡‘é¡]
è¨­å‚™ï¼š[è¨­å‚™]
æ”¤ä½è™Ÿç¢¼ï¼š[æ”¤ä½è™Ÿç¢¼]

æ‚¨å¯å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥çœ‹æœ€æ–°å ±åç‹€æ…‹ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:false,
      group:'ä»˜æ¬¾æµç¨‹'
    },
    {
      template_key:'registration_cancelled',
      title:'å–æ¶ˆå ±åä¿¡',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘å ±åå·²å–æ¶ˆ',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æ‚¨å ±åçš„ [å ´æ¬¡åç¨±] å·²å–æ¶ˆã€‚

è©³ç´°ç‹€æ…‹å¯å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥è©¢ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:false,
      group:'å–æ¶ˆï¼é€€æ¬¾'
    },
    {
      template_key:'refund_request_received',
      title:'é€€æ¬¾ç”³è«‹é€šçŸ¥',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘é€€æ¬¾ç”³è«‹å·²æ”¶åˆ°',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æˆ‘å€‘å·²æ”¶åˆ°æ‚¨ [å ´æ¬¡åç¨±] çš„é€€æ¬¾ç”³è«‹ã€‚

ä¸»è¾¦ç¢ºèªå¾Œï¼Œå°‡ä¾é€€æ¬¾è¦å‰‡è™•ç†ã€‚æ‚¨å¯å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥çœ‹é€²åº¦ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:false,
      group:'å–æ¶ˆï¼é€€æ¬¾'
    },
    {
      template_key:'refund_done',
      title:'é€€è²»å®Œæˆä¿¡',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘é€€è²»å·²å®Œæˆ',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æ‚¨ [å ´æ¬¡åç¨±] çš„é€€è²»å·²è™•ç†å®Œæˆã€‚

é€€è²»é‡‘é¡ï¼šNT$ [é€€è²»é‡‘é¡]

æ¬¾é …å°‡ä¾å¯¦éš›é‡‘æµæˆ–å¸³å‹™è™•ç†æ™‚é–“é€€å›žã€‚è©³ç´°ç´€éŒ„å¯å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥è©¢ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:true,
      group:'å–æ¶ˆï¼é€€æ¬¾'
    },
    {
      template_key:'overdue_cancel',
      title:'é€¾æœŸæœªç¹³å–æ¶ˆä¿¡',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘å ±åå·²å› é€¾æœŸæœªç¹³è²»å–æ¶ˆ',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æ‚¨å ±åçš„ [å ´æ¬¡åç¨±] å› é€¾æœŸæœªå®Œæˆç¹³è²»ï¼Œç³»çµ±å·²å–æ¶ˆæœ¬ç­†å ±åä¸¦é‡‹å‡ºåé¡ã€‚

è©³ç´°ç‹€æ…‹å¯å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥è©¢ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:true,
      group:'ä»˜æ¬¾æµç¨‹'
    },
    {
      template_key:'event_reminder',
      title:'è¡Œå‰æé†’',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘æ´»å‹•è¡Œå‰æé†’',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æ‚¨å ±åçš„ [å ´æ¬¡åç¨±] å³å°‡é–‹å§‹ã€‚

æ—¥æœŸï¼š[æ´»å‹•æ—¥æœŸ]
åœ°é»žï¼š[åœ°é»ž]
æ‚¨çš„æ”¤ä½ï¼š[æ”¤ä½è™Ÿç¢¼]
è¨­å‚™ï¼š[è¨­å‚™]

å ´åœ°åœ–ï¼š[å ´åœ°åœ–ç¶²å€]

è«‹ç•™æ„å ±åˆ°ã€é€²å ´èˆ‡ç¾å ´è¦ç¯„ã€‚è©³ç´°è³‡è¨Šå¯å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥çœ‹ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]
[æŒ‰éˆ•:åŠ å…¥å®˜æ–¹LINE]`,
      is_active:true,
      group:'æ´»å‹•é€šçŸ¥'
    },
    {
      template_key:'force_notice',
      title:'ä¸å¯æŠ—åŠ›é€šçŸ¥',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘ä¸å¯æŠ—åŠ›è™•ç†é€šçŸ¥',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æ‚¨å ±åçš„ [å ´æ¬¡åç¨±] å› ä¸å¯æŠ—åŠ›å› ç´ å•Ÿå‹•è™•ç†æµç¨‹ã€‚

åŽŸå› ï¼š[å–æ¶ˆåŽŸå› ]
[è£œå……èªªæ˜Ž]

åŽŸå ´æ¬¡ï¼š[åŽŸå ´æ¬¡]
å»¶æœŸå ´æ¬¡ï¼š[æ–°å ´æ¬¡]
è«‹æ–¼ [é¸æ“‡æœŸé™] å‰å®Œæˆé¸æ“‡

è«‹å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€é¸æ“‡ã€Œå»¶æœŸã€æˆ–ã€Œé€€è²»ã€ã€‚
é€¾æœŸæœªé¸æ“‡è€…ï¼Œç³»çµ±å°‡è‡ªå‹•æ­¸ç‚ºé€€è²»è™•ç†ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:true,
      group:'ä¸å¯æŠ—åŠ›'
    },
    {
      template_key:'force_result_notice',
      title:'ä¸å¯æŠ—åŠ›è™•ç†çµæžœé€šçŸ¥',
      subject:'ã€[å ´æ¬¡åç¨±]ã€‘ä¸å¯æŠ—åŠ›è™•ç†çµæžœé€šçŸ¥',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

æ‚¨çš„ä¸å¯æŠ—åŠ›è™•ç†çµæžœå·²æ›´æ–°ã€‚

åŽŸå ´æ¬¡ï¼š[åŽŸå ´æ¬¡]
æ–°å ´æ¬¡ï¼š[æ–°å ´æ¬¡]
é€€è²»é‡‘é¡ï¼šNT$ [é€€è²»é‡‘é¡]

è«‹å›žåˆ°ã€Œæˆ‘çš„ç´€éŒ„ã€æŸ¥çœ‹å®Œæ•´ç‹€æ…‹ã€‚

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:true,
      group:'ä¸å¯æŠ—åŠ›'
    },
    {
      template_key:'staff_invite',
      title:'ç®¡ç†å“¡é‚€è«‹ä¿¡',
      subject:'ã€[ä¸»è¾¦åç¨±]ã€‘æ‚¨å·²è¢«æŽˆæ¬Šç‚ºæ´»å‹•ç®¡ç†å“¡',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

[ä¸»è¾¦åç¨±] é‚€è«‹æ‚¨æˆç‚ºç®¡ç†äººå“¡ã€‚

è§’è‰²ï¼š[ç®¡ç†å“¡è§’è‰²]
æ¬Šé™ï¼š[æ¬Šé™]
ç®¡ç†ç¯„åœï¼š[ç®¡ç†ç¯„åœ]

è«‹é»žä¸‹æ–¹æŒ‰éˆ•ï¼Œå†ç”¨è‡ªå·±çš„ LINE ç™»å…¥ä¸¦æŽ¥å—é‚€è«‹ã€‚æŽ¥å—å¾Œï¼Œé€™å€‹ LINEã€æ—¥å¾ŒåŒæ­¥çš„ Google èˆ‡æ­¤ Email éƒ½æœƒé€£åˆ°åŒä¸€å€‹ DOING æœƒå“¡ã€‚

[æŒ‰éˆ•:æŽ¥å—ç®¡ç†é‚€è«‹]`,
      is_active:true,
      group:'ç³»çµ±ç®¡ç†'
    },
    {
      template_key:'custom_notice',
      title:'è‡ªè¨‚é€šçŸ¥ä¿¡',
      subject:'ã€[ä¸»è¾¦åç¨±]ã€‘é€šçŸ¥',
      body:`è¦ªæ„›çš„ [é¡¯ç¤ºåç¨±]ï¼Œ

[é€šçŸ¥å…§å®¹]

[æŒ‰éˆ•:å‰å¾€æˆ‘çš„ç´€éŒ„]`,
      is_active:false,
      group:'ç³»çµ±ç®¡ç†'
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
    const m = line.match(/^\[æŒ‰éˆ•:(.+?)\]$/);
    if (m) {
      const label = m[1].trim();
      let href = '';
      if (label.includes('é‚€è«‹') || (label.includes('å¾Œå°') && vars && vars['é‚€è«‹é€£çµ'])) href = (vars && vars['é‚€è«‹é€£çµ']) || '';
      else if (label.includes('å¾Œå°')) href = (tenantCtx && tenantCtx.siteUrl) || FALLBACK_SITE_URL;
      else if (label.includes('ç¹³è²»') || label.includes('æˆ‘çš„ç´€éŒ„') || label.includes('å ±åç´€éŒ„') || label.includes('æœƒå“¡')) href = memberUrl(regId || null, tenantCtx);
      else if (label.includes('LINE') || label.includes('å®¢æœ')) href = (tenantCtx && tenantCtx.lineUrl) || '';
      else if (label.includes('æ´»å‹•')) href = (tenantCtx && tenantCtx.siteUrl) || FALLBACK_SITE_URL;
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
    }).filter(Boolean).join('ã€');
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
  const fallback = defaults.find(x => x.template_key === k) || {template_key:k,title:k,subject:'ã€[ä¸»è¾¦åç¨±]ã€‘é€šçŸ¥',body:'[é€šçŸ¥å…§å®¹]',is_active:false};
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
  const subject = applyEmailVars(tpl.subject || 'ã€[ä¸»è¾¦åç¨±]ã€‘é€šçŸ¥', vars);
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
    'æ¤…å­':'æ¤…', 'æ¤…':'æ¤…', 'æ¤…å‡³':'æ¤…',
    'æ¡Œå­':'æ¡Œ', 'æ¡Œ':'æ¡Œ', 'é•·æ¡Œ':'æ¡Œ', 'æ‘ºç–Šæ¡Œ':'æ¡Œ', 'æŠ˜ç–Šæ¡Œ':'æ¡Œ', 'æ¡Œå°':'æ¡Œ',
    'é›»':'é›»åŠ›', 'ç”¨é›»':'é›»åŠ›', 'æ’åº§':'é›»åŠ›', 'é›»æº':'é›»åŠ›',
  };
  return aliases[name] || name;
}
function equipSummaryFromJson(equip) {
  const eq = safeJson(equip, {});
  return Object.entries(eq)
    .filter(([k,v]) => Number(v) > 0)
    .map(([k,v]) => `${normalizeEquipName(k)} Ã—${Number(v)}`)
    .join('ã€');
}

function addonSummaryFromJson(addonQty, sessionRow={}) {
  const qty = safeJson(addonQty, {});
  const defs = safeJson(sessionRow.addons_json, []) || [];
  const parts = [];
  if (Array.isArray(qty)) {
    qty.forEach((it, i) => {
      if (it && typeof it === 'object') {
        const n = Number(it.qty || it.count || it.quantity || it.value || 0);
        const name = it.name || it.label || it.title || (defs[i] && defs[i].name) || `é …ç›®${i+1}`;
        if (n > 0) parts.push(`${name}Ã—${n}`);
      } else {
        const n = Number(it || 0);
        const name = (defs[i] && defs[i].name) || `é …ç›®${i+1}`;
        if (n > 0) parts.push(`${name}Ã—${n}`);
      }
    });
  } else if (qty && typeof qty === 'object') {
    Object.entries(qty).forEach(([k, v]) => {
      const n = Number((v && typeof v === 'object') ? (v.qty || v.count || v.quantity || v.value || 0) : v);
      if (n <= 0) return;
      const def = /^\d+$/.test(String(k)) && defs[Number(k)] ? defs[Number(k)] : null;
      const name = (v && typeof v === 'object' && (v.name || v.label || v.title)) || (def && def.name) || k;
      parts.push(`${name}Ã—${n}`);
    });
  }
  return parts.length ? parts.join('ã€') : 'ç„¡';
}
async function hUndoPaymentReport(env, b){
  const TENANT=b._tenantId; if(!TENANT) return jsonErr('ç„¡æ³•è¾¨è­˜ä¸»è¾¦ç©ºé–“');
  if(!b.regId) return jsonErr('ç¼ºå°‘å ±åç·¨è™Ÿ');
  const rows=await dbGet(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}&select=*`);
  const reg=(rows||[])[0];
  if(!reg) return jsonErr('æ‰¾ä¸åˆ°å ±åç´€éŒ„');
  const guard=await verifiedRegOwnerGuard(env,reg,b,'æ’¤å›žä»˜æ¬¾å›žå ±'); if(guard) return guard;
  const ps=String(reg.payment_status||'');
  if(isPaidStatus(ps)) return jsonErr('ä¸»è¾¦å·²ç¢ºèªå…¥å¸³ï¼Œç„¡æ³•æ’¤å›žã€‚è‹¥æœ‰å•é¡Œè«‹è¯ç¹«ä¸»è¾¦');
  if(!/å¾…ç¢ºèª|å›žå ±/.test(ps)) return jsonErr('ç›®å‰ç‹€æ…‹ä¸éœ€è¦æ’¤å›žï¼Œå¯ç›´æŽ¥é‡æ–°å›žå ±ä»˜æ¬¾');
  await dbUpdate(env,'registrations',`tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(b.regId)}`,{
    payment_status:'æœªç¹³è²»',
    payment_report_amount:null,
    payment_last5:'',
    payment_reported_at:null,
    admin_note:(reg.admin_note||'')+` [ä½¿ç”¨è€…æ’¤å›žä»˜æ¬¾å›žå ±] ${nowTaipeiText()}`
  });
  try {
    await dbUpdate(env,'payments',`tenant_id=eq.${TENANT}&registration_id=eq.${encodeURIComponent(b.regId)}&status=eq.%E5%BE%85%E7%A2%BA%E8%AA%8D`,{status:'å·²å–æ¶ˆ'});
  } catch(e) {
    logError(env,{source:'hUndoPaymentReport',action:'undoPaymentReport',tenantId:TENANT,regId:b.regId,message:'ä»˜æ¬¾å›žå ±æ’¤å›žæ™‚ payments ç‹€æ…‹åŒæ­¥å¤±æ•—',error:e&&e.message?e.message:e});
  }
  return jsonOk({success:true});
}

function buildPaymentLineCardText(reg, sesName, method, amount) {
  const brand = String(reg.brand_name || reg.brand || '').trim();
  const name = String(reg.name || reg.contact_name || reg.display_name || '').trim();
  const who = brand && name ? `${brand}ï¼${name}` : (brand || name || 'æœªå¡«åç¨±');
  const stallCount = Math.max(Number(reg.stall_count || 1), 1);
  const equipText = equipSummaryFromJson(reg.equipment_json);
  const deposit = Number(reg.deposit || 0);
  const lines = [
    sesName || reg.session_name || 'å ´æ¬¡',
    who,
    `æ”¤ä½ ${stallCount} æ”¤`,
    `è¨­å‚™ï¼š${equipText || 'è‡ªå‚™'}`,
  ];
  if (deposit > 0) lines.push(`ä¿è­‰é‡‘ NT$${deposit.toLocaleString()}`);
  lines.push('');
  lines.push(`ä»˜æ¬¾é‡‘é¡ï¼šNT$${Number(amount || reg.amount || 0).toLocaleString()}ï¼ˆ${method || reg.payment_method || 'ä»˜æ¬¾'}ï¼‰`);
  return lines.join('\n');
}


// â‘  å ±åç¢ºèªï¼šå¯ç”±å¾Œå°é–‹é—œæŽ§åˆ¶ï¼ŒDOING é è¨­é—œé–‰
async function mailRegConfirm(env, email, displayName, sesName, regId, total, stallCount, selectedDates, equip, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
    'å ±åæ—¥æœŸ': emailDateText(selectedDates) || 'æœªè¨­å®š',
    'æ´»å‹•æ—¥æœŸ': emailDateText(selectedDates) || 'æœªè¨­å®š',
    'æ”¤ä½æ•¸': Number(stallCount || 1) || 1,
    'è¨­å‚™': equipSummaryFromJson(equip) || 'ç„¡',
    'æ‡‰ç¹³é‡‘é¡': emailMoneyText(total),
  };
  return sendTemplateEmail(env, tenantId, 'registration_received', email, vars, tenantCtx, regId, {targetId:regId, targetTable:'registrations'});
}

// â‘¡ éŒ„å–é€šçŸ¥ï¼šè³‡æ–™ç”± DB / Worker å¸¶å…¥ï¼Œå‰å°åªå›žæˆ‘çš„ç´€éŒ„æŸ¥è©¢
async function mailApproval(env, email, displayName, sesName, regId, fee, stallCount, selectedDates, equip, sesEquipJson, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
    'å ±åæ—¥æœŸ': emailDateText(selectedDates) || 'æœªè¨­å®š',
    'æ´»å‹•æ—¥æœŸ': emailDateText(selectedDates) || 'æœªè¨­å®š',
    'æ”¤ä½æ•¸': Number(stallCount || 1) || 1,
    'è¨­å‚™': equipSummaryFromJson(equip) || 'ç„¡',
    'æ‡‰ç¹³é‡‘é¡': emailMoneyText(fee),
  };
  return sendTemplateEmail(env, tenantId, 'approval_notice', email, vars, tenantCtx, regId, {targetId:regId, targetTable:'registrations'});
}

// â‘¢ ç¹³è²»å›žå ±å·²æ”¶åˆ°ï¼šä¿ç•™ SaaS åŠŸèƒ½ï¼ŒDOING é è¨­é—œé–‰
async function mailPaymentReceived(env, email, displayName, sesName, method, amount, last5, regId, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
    'ä»˜æ¬¾æ–¹å¼': method || 'ä»˜æ¬¾',
    'å›žå ±é‡‘é¡': emailMoneyText(amount),
    'æœ«äº”ç¢¼': last5 || 'æœªæä¾›',
  };
  return sendTemplateEmail(env, tenantId, 'payment_report_received', email, vars, tenantCtx, regId, {targetId:regId, targetTable:'registrations'});
}

// â‘£ ç¹³è²»ç¢ºèªä¿¡ï¼šä¿ç•™ SaaS åŠŸèƒ½ï¼ŒDOING é è¨­é—œé–‰
async function mailPaymentConfirm(env, email, displayName, sesName, amount, equipStr, stallNo, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
    'æ‡‰ç¹³é‡‘é¡': emailMoneyText(amount),
    'è¨­å‚™': equipStr || 'ç„¡',
    'æ”¤ä½è™Ÿç¢¼': stallNo || 'å°šæœªæŒ‡å®š',
  };
  return sendTemplateEmail(env, tenantId, 'payment_confirmed', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// â‘¤ æœªéŒ„å–é€šçŸ¥ä¿¡ï¼šä¿ç•™ SaaS åŠŸèƒ½ï¼ŒDOING é è¨­é—œé–‰
async function mailRejection(env, email, displayName, sesName, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
  };
  return sendTemplateEmail(env, tenantId, 'rejection_notice', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// â‘¥ å–æ¶ˆå ±åä¿¡ï¼šä¿ç•™ SaaS åŠŸèƒ½ï¼ŒDOING é è¨­é—œé–‰
async function mailCancelReg(env, email, displayName, sesName, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
  };
  return sendTemplateEmail(env, tenantId, 'registration_cancelled', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// â‘¦ é€€æ¬¾ç”³è«‹å·²æ”¶åˆ°ï¼šä¿ç•™ SaaS åŠŸèƒ½ï¼ŒDOING é è¨­é—œé–‰
async function mailRefundRequestReceived(env, email, displayName, sesName, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
  };
  return sendTemplateEmail(env, tenantId, 'refund_request_received', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// â‘§ ä¸€èˆ¬é€€è²»å®Œæˆä¿¡ï¼šä¿ç•™ï¼ŒDOING é è¨­é–‹å•Ÿ
async function mailRefundConfirm(env, email, displayName, sesName, tenantCtx=null, refundAmount=0) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
    'é€€è²»é‡‘é¡': emailMoneyText(refundAmount),
  };
  return sendTemplateEmail(env, tenantId, 'refund_done', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// â‘¨ é€¾æœŸæœªç¹³è²»è‡ªå‹•å–æ¶ˆ
async function mailAutoCancel(env, email, displayName, sesName, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
  };
  return sendTemplateEmail(env, tenantId, 'overdue_cancel', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// ç³»çµ±å¿…è¦ä¿ç•™ï¼šç¹³è²»æœŸé™æé†’
async function mailDeadlineReminder(env, email, displayName, sesName, regId, fee, selectedDates, equip, sesEquipJson, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
    'å ±åæ—¥æœŸ': emailDateText(selectedDates) || 'æœªè¨­å®š',
    'æ´»å‹•æ—¥æœŸ': emailDateText(selectedDates) || 'æœªè¨­å®š',
    'æ”¤ä½æ•¸': '',
    'è¨­å‚™': equipSummaryFromJson(equip) || 'ç„¡',
    'æ‡‰ç¹³é‡‘é¡': emailMoneyText(fee),
  };
  return sendTemplateEmail(env, tenantId, 'payment_reminder', email, vars, tenantCtx, regId, {targetId:regId, targetTable:'registrations'});
}

// ç³»çµ±å¿…è¦ä¿ç•™ï¼šè¡Œå‰æé†’
async function mailPreEventReminder(env, email, displayName, sesName, date, venue, tenantCtx=null, regId='', equip='', stallNo='', mapUrl='') {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
    'æ´»å‹•æ—¥æœŸ': date || 'æœªè¨­å®š',
    'å ±åæ—¥æœŸ': date || 'æœªè¨­å®š',
    'åœ°é»ž': venue || 'æœªè¨­å®š',
    'è¨­å‚™': equip || 'è«‹ä»¥æˆ‘çš„ç´€éŒ„é¡¯ç¤ºç‚ºæº–',
    'æ”¤ä½è™Ÿç¢¼': stallNo || 'è«‹è‡³ç¾å ´æœå‹™å°æ´½è©¢',
    'å ´åœ°åœ–ç¶²å€': mapUrl || 'ï¼ˆæœ¬å ´ç„¡å ´åœ°åœ–ï¼Œè«‹ä»¥ç¾å ´ç‚ºæº–ï¼‰',
  };
  return sendTemplateEmail(env, tenantId, 'event_reminder', email, vars, tenantCtx, regId, {targetId:regId, targetTable:'registrations'});
}

// ç³»çµ±å¿…è¦ä¿ç•™ï¼šä¸å¯æŠ—åŠ›å–æ¶ˆï¼å»¶æœŸé€šçŸ¥
async function mailForceCancelChoice(env, email, displayName, sesName, targetSesName, deadline, tenantCtx=null, extra={}) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
    'åŽŸå ´æ¬¡': sesName || '',
    'æ–°å ´æ¬¡': targetSesName || 'ç„¡å»¶æœŸå ´æ¬¡',
    'é¸æ“‡æœŸé™': deadline || 'ä¾ç³»çµ±é¡¯ç¤º',
    'å–æ¶ˆåŽŸå› ': (extra && extra.reasonLabel) || 'ä¸å¯æŠ—åŠ›å› ç´ ',
    'è£œå……èªªæ˜Ž': (extra && extra.note) || '',
  };
  return sendTemplateEmail(env, tenantId, 'force_notice', email, vars, tenantCtx, '', {targetTable:'registrations'});
}
async function mailTransferDiffFee(env, email, displayName, newSesName, newFee, oldFee, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': newSesName || '',
    'åŽŸå ´æ¬¡': '',
    'æ–°å ´æ¬¡': newSesName || '',
    'é€€è²»é‡‘é¡': '0',
    'æ‡‰ç¹³é‡‘é¡': emailMoneyText(newFee),
  };
  return sendTemplateEmail(env, tenantId, 'force_result_notice', email, vars, tenantCtx, '', {targetTable:'registrations'});
}
async function mailTransferSameFee(env, email, displayName, newSesName, tenantCtx=null) {
  return mailTransferDiffFee(env, email, displayName, newSesName, 0, 0, tenantCtx);
}
async function mailAutoRefund(env, email, displayName, sesName, tenantCtx=null) {
  return mailRefundRequestReceived(env, email, displayName, sesName, tenantCtx);
}

// ä¸å¯æŠ—åŠ›å–æ¶ˆé€šçŸ¥ä¿¡
async function mailForceCancelNotice(env, email, displayName, sesName, tenantCtx=null, opts={}) {
  return mailForceCancelChoice(env, email, displayName, sesName,
    (opts && opts.targetSesName) || '', (opts && opts.deadlineText) || '', tenantCtx,
    {reasonLabel:(opts&&opts.reasonLabel)||'', note:(opts&&opts.note)||''});
}

// å»¶æœŸå®Œæˆä¿¡
async function mailForceTransferDone(env, email, displayName, oldSesName, newSesName, paidAmount, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': newSesName || '',
    'åŽŸå ´æ¬¡': oldSesName || '',
    'æ–°å ´æ¬¡': newSesName || '',
    'é€€è²»é‡‘é¡': '0',
    'æ‡‰ç¹³é‡‘é¡': emailMoneyText(paidAmount),
  };
  return sendTemplateEmail(env, tenantId, 'force_result_notice', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// é€€è²»å®Œæˆä¿¡ï¼ˆä¸å¯æŠ—åŠ›ï¼‰
async function mailForceRefundDone(env, email, displayName, sesName, refundAmount, tenantCtx=null) {
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': displayName || '',
    'å ´æ¬¡åç¨±': sesName || '',
    'åŽŸå ´æ¬¡': sesName || '',
    'æ–°å ´æ¬¡': '',
    'é€€è²»é‡‘é¡': emailMoneyText(refundAmount),
  };
  return sendTemplateEmail(env, tenantId, 'force_result_notice', email, vars, tenantCtx, '', {targetTable:'registrations'});
}

// ç®¡ç†å“¡é‚€è«‹
async function mailStaffInvite(env, email, name, role, perms, limitSessions, tenantCtx=null, inviteUrl='') {
  const labels = {review:'å¯©æ ¸å ±å',checkin:'ç¾å ´å ±åˆ°',sessions:'ç®¡ç†å ´æ¬¡',events:'ç®¡ç†æ´»å‹•',finance:'è²¡å‹™ç®¡ç†',announce:'å…¬å‘Šç®¡ç†'};
  const permText = (role==='superadmin'||role==='è¶…ç´šç®¡ç†å“¡'||role==='platform_super_admin')
    ? 'æ‰€æœ‰åŠŸèƒ½ï¼ˆè¶…ç´šç®¡ç†å“¡ï¼‰'
    : Object.keys(perms||{}).filter(k=>perms[k]).map(k=>labels[k]||k).join('ã€') || 'ä¾å¾Œå°æ¬Šé™è¨­å®š';
  const sesText = limitSessions?.length ? 'åƒ…é™æŒ‡å®šå ´æ¬¡' : 'æ‰€æœ‰å ´æ¬¡';
  const tenantId = tenantCtx?.id || '';
  const vars = {
    'ä¸»è¾¦åç¨±': tenantCtx?.name || FALLBACK_TENANT_NAME,
    'é¡¯ç¤ºåç¨±': name || email || '',
    'ç®¡ç†å“¡è§’è‰²': role || '',
    'æ¬Šé™': permText,
    'ç®¡ç†ç¯„åœ': sesText,
    'é‚€è«‹é€£çµ': inviteUrl || '',
  };
  return sendTemplateEmail(env, tenantId, 'staff_invite', email, vars, tenantCtx, '', {targetTable:'staff', targetId:email});
}


// â”€â”€ SECTION 10: DB æŸ¥è©¢è¼”åŠ© â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getSessionRow(env, sessionId, tenantId) {
  const tid = tenantId ;  // M-02ï¼štenant å·²ç”±è·¯ç”±å±¤é©—è­‰ï¼ˆè¦‹ routeGet/routePostï¼‰
  const rows = await dbGet(env, 'sessions', `tenant_id=eq.${tid}&id=eq.${encodeURIComponent(sessionId)}&select=*`);
  return rows[0] || null;
}
async function getSessionName(env, sessionId, tenantId) {
  const tid = tenantId ;  // M-02ï¼štenant å·²ç”±è·¯ç”±å±¤é©—è­‰ï¼ˆè¦‹ routeGet/routePostï¼‰
  const rows = await dbGet(env, 'sessions', `tenant_id=eq.${tid}&id=eq.${encodeURIComponent(sessionId)}&select=name`);
  return rows.length ? rows[0].name : sessionId;
}
async function getSessionType(){ return 'æ´»å‹•å ´æ¬¡'; }
// SaaS ç§Ÿæˆ¶åŠŸèƒ½æ——æ¨™ï¼šæœªè¨­å®šçš„èˆŠç§Ÿæˆ¶ç¶­æŒæ—¢æœ‰åŠŸèƒ½ï¼›åªæœ‰æ˜Žç¢º false æ‰é—œé–‰ã€‚
const DEFAULT_TENANT_MODULE_FLAGS = {
  registration: true, review: true, payment: true, equipment: true, seatSelection: true,
  checkin: true, invoice: true, workshopSlots: true, service: true, resource: true,
  participants: true, customFields: true, addons: true, agreement: true, i18n: true, googleCalendar: true
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
  const requested=normalizeSessionModules(raw||{}),flags=await getTenantModuleFlags(env,tenantId),labels={review:'å¯©æ ¸éŒ„å–',payment:'ä»˜æ¬¾ç¢ºèª',equipment:'è¨­å‚™ç§Ÿå€Ÿ',seatSelection:'æ”¤ä½ï¼åº§ä½é¸ä½',checkin:'ç¾å ´å ±åˆ°',invoice:'ç™¼ç¥¨è³‡æ–™',workshopSlots:'æ—¥æœŸï¼æ™‚æ®µ',service:'æœå‹™æ–¹æ¡ˆ',resource:'äººå“¡ï¼è³‡æº',participants:'ç¥¨ç¨®ï¼äººæ•¸',customFields:'è‡ªè¨‚å•é¡Œ',addons:'åŠ è³¼',agreement:'æ¢æ¬¾åˆç´„',i18n:'å¤šèªžè¨€',googleCalendar:'è¡Œäº‹æ›†'},blocked=[];
  for(const key of Object.keys(DEFAULT_TENANT_MODULE_FLAGS)){
    if(key==='registration'||flags[key]!==false)continue;
    const enabled=key==='i18n'?requested.i18n?.enabled===true:requested[key]===true;
    if(enabled)blocked.push(labels[key]||key);
  }
  return blocked;
}

async function hGetTenantModuleProfile(env,p){
  const T=p._tenantId; if(!await verifyStaff(env,p.email,p.token,T)) return jsonErr('ç„¡æ¬Šé™');
  const [profile,approvedFlags]=await Promise.all([getTenantModuleProfileValue(env,T),getTenantModuleFlags(env,T)]);
  return jsonOk({...profile,approvedFlags});
}
async function hSaveTenantModuleProfile(env,b){
  const T=b._tenantId; if(!await verifyStaff(env,b.email,b.token,T,'superadmin')) return jsonErr('åªæœ‰ç§Ÿæˆ¶è² è²¬äººå¯ä¿®æ”¹æ–°å ´æ¬¡é è¨­');
  const rows=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(T)}&select=config_json`); if(!rows.length)return jsonErr('æ‰¾ä¸åˆ°ä¸»è¾¦ç©ºé–“');
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
  const T=p._tenantId;if(!await verifyStaff(env,p.email,p.token,T))return jsonErr('ç„¡æ¬Šé™');
  return jsonOk(await getTenantTheme(env,T));
}
async function hSaveTenantTheme(env,b){
  const T=b._tenantId;if(!await verifyStaff(env,b.email,b.token,T,'settings'))return jsonErr('ç„¡æ¬Šé™');
  const key=String(b.themeKey||b.key||'').trim();if(!TENANT_THEME_KEYS.has(key))return jsonErr('ä¸æ”¯æ´çš„å“ç‰Œé¢¨æ ¼');
  const value={key,updatedAt:nowIso()};
  const row=await getTenantSettingsRow(env,T);
  if(row)await dbUpdate(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(T)}`,{theme_json:JSON.stringify(value),updated_at:nowIso()});
  else await dbInsert(env,'tenant_settings',{tenant_id:T,module_flags_json:await getTenantModuleFlags(env,T),theme_json:value});
  await writeAuditLog(env,T,b.email||'','organizer','save_tenant_theme','tenant_settings',T,null,value).catch(()=>{});
  return jsonOk(value);
}
async function hGetPlatformTenantModules(env,p){
  if(!await platformSupportAuth(env,p))return jsonErr('ç„¡æ¬Šé™');const T=String(p.target_tenant_id||'').trim().toLowerCase();if(!T)return jsonErr('è«‹é¸æ“‡ä¸»è¾¦');return jsonOk({flags:await getTenantModuleFlags(env,T)});
}
async function hSavePlatformTenantModules(env,b){
  const jwt=await platformSupportAuth(env,b);if(!jwt)return jsonErr('ç„¡æ¬Šé™');const T=String(b.target_tenant_id||'').trim().toLowerCase();if(!T)return jsonErr('è«‹é¸æ“‡ä¸»è¾¦');
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
  const T=p._tenantId;if(!await tenantSupportAuth(env,p,T))return jsonErr('ç„¡æ¬Šé™');
  const rows=await dbGet(env,'support_threads',`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=last_message_at.desc`).catch(()=>[]);
  return jsonOk({threads:rows,unread:rows.reduce((n,x)=>n+safeNum(x.tenant_unread_count),0)});
}
async function hGetSupportMessages(env,p){
  const T=p._tenantId;if(!await tenantSupportAuth(env,p,T))return jsonErr('ç„¡æ¬Šé™');const id=cleanSupportText(p.threadId,80);if(!id)return jsonErr('ç¼ºå°‘å°è©±');
  const threads=await dbGet(env,'support_threads',`id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(T)}&select=id`).catch(()=>[]);if(!threads.length)return jsonErr('æ‰¾ä¸åˆ°å°è©±');
  return jsonOk({messages:await dbGet(env,'support_messages',`thread_id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(T)}&select=*&order=created_at.asc`).catch(()=>[])});
}
async function hCreateSupportThread(env,b){
  const T=b._tenantId;if(!await tenantSupportAuth(env,b,T))return jsonErr('ç„¡æ¬Šé™');
  const body=cleanSupportText(b.body,4000),subject=cleanSupportText(b.subject,120);if(!body)return jsonErr('è«‹è¼¸å…¥è¨Šæ¯');
  const kind=['support','module_request'].includes(String(b.kind||''))?String(b.kind):'support';const id=crypto.randomUUID(),now=nowIso();
  const thread=await dbInsert(env,'support_threads',{id,tenant_id:T,kind,subject:subject||(kind==='module_request'?'ç”³è«‹æ–°å¢žåŠŸèƒ½':'ç³»çµ±å®¢æœ'),status:'open',priority:'normal',requested_module_key:kind==='module_request'?cleanSupportText(b.moduleKey,80):null,metadata_json:{},created_by_email:cleanSupportText(b.email,320),last_message_at:now,created_at:now,updated_at:now});
  await dbInsert(env,'support_messages',{id:crypto.randomUUID(),thread_id:id,tenant_id:T,sender_scope:'tenant',sender_email:cleanSupportText(b.email,320),body,created_at:now});
  return jsonOk({thread});
}
async function hSendSupportMessage(env,b){
  const T=b._tenantId;if(!await tenantSupportAuth(env,b,T))return jsonErr('ç„¡æ¬Šé™');const id=cleanSupportText(b.threadId,80),body=cleanSupportText(b.body,4000);if(!id||!body)return jsonErr('è«‹é¸æ“‡å°è©±ä¸¦è¼¸å…¥è¨Šæ¯');
  const threads=await dbGet(env,'support_threads',`id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(T)}&select=id`).catch(()=>[]);if(!threads.length)return jsonErr('æ‰¾ä¸åˆ°å°è©±');
  const message=await dbInsert(env,'support_messages',{id:crypto.randomUUID(),thread_id:id,tenant_id:T,sender_scope:'tenant',sender_email:cleanSupportText(b.email,320),body,created_at:nowIso()});return jsonOk({message});
}
async function hMarkSupportRead(env,b){
  const T=b._tenantId;if(!await tenantSupportAuth(env,b,T))return jsonErr('ç„¡æ¬Šé™');const id=cleanSupportText(b.threadId,80);if(!id)return jsonErr('ç¼ºå°‘å°è©±');
  await dbUpdate(env,'support_threads',`id=eq.${encodeURIComponent(id)}&tenant_id=eq.${encodeURIComponent(T)}`,{tenant_unread_count:0,updated_at:nowIso()});return jsonOk({ok:true});
}
async function hGetPlatformSupportThreads(env,p){
  if(!await platformSupportAuth(env,p))return jsonErr('ç„¡æ¬Šé™');const rows=await dbGet(env,'support_threads','select=*&order=last_message_at.desc').catch(()=>[]);return jsonOk({threads:rows,unread:rows.reduce((n,x)=>n+safeNum(x.platform_unread_count),0)});
}
async function hGetPlatformSupportMessages(env,p){
  if(!await platformSupportAuth(env,p))return jsonErr('ç„¡æ¬Šé™');const id=cleanSupportText(p.threadId,80);if(!id)return jsonErr('ç¼ºå°‘å°è©±');return jsonOk({messages:await dbGet(env,'support_messages',`thread_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`).catch(()=>[])});
}
async function hSendPlatformSupportMessage(env,b){
  const jwt=await platformSupportAuth(env,b);if(!jwt)return jsonErr('ç„¡æ¬Šé™');const id=cleanSupportText(b.threadId,80),body=cleanSupportText(b.body,4000);if(!id||!body)return jsonErr('è«‹é¸æ“‡å°è©±ä¸¦è¼¸å…¥è¨Šæ¯');
  const threads=await dbGet(env,'support_threads',`id=eq.${encodeURIComponent(id)}&select=id,tenant_id`).catch(()=>[]);if(!threads.length)return jsonErr('æ‰¾ä¸åˆ°å°è©±');
  const message=await dbInsert(env,'support_messages',{id:crypto.randomUUID(),thread_id:id,tenant_id:threads[0].tenant_id,sender_scope:'platform',sender_email:cleanSupportText(jwt.email,320),body,created_at:nowIso()});return jsonOk({message});
}
async function hMarkPlatformSupportRead(env,b){
  if(!await platformSupportAuth(env,b))return jsonErr('ç„¡æ¬Šé™');const id=cleanSupportText(b.threadId,80);if(!id)return jsonErr('ç¼ºå°‘å°è©±');await dbUpdate(env,'support_threads',`id=eq.${encodeURIComponent(id)}`,{platform_unread_count:0,updated_at:nowIso()});return jsonOk({ok:true});
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
    return new Response(JSON.stringify({ok:false, error:`æ­¤ç§Ÿæˆ¶æœªé–‹å•Ÿ ${feature} åŠŸèƒ½`, feature}), {
      status:403,
      headers:corsHeaders(),
    });
  }
  return null;
}

// ç§Ÿæˆ¶å¾Œå°è§’è‰²æ˜¯ API çš„æ­£å¼é‚Šç•Œï¼Œä¸åªé å‰ç«¯éš±è—æŒ‰éˆ•ã€‚
const TENANT_ROLE_ACTIONS = {
  owner: new Set(['saveTenantModuleProfile','addStaff','removeStaff','setStaffActive','setStaffScope','updateStaffPerms','updateStaffScope','updateStaffSessions']),
  settingsRead: new Set(['getTenantModuleProfile','getTenantTheme','getStaff','getCompanySettings','getSiteConfig','getEmailTemplates','getPaymentSettings','getPaymentProfiles','getAgreementTemplate','getAgreementTemplates','listVenueMaps','listPhotoActivities']),
  settings: new Set(['saveTenantTheme','saveCompanySettings','saveSiteConfig','saveEmailTemplate','testEmail','savePaymentSettings','savePaymentProfile','disablePaymentProfile','saveAgreementTemplate','saveAgreementTemplates','saveVenueMap','applyVenueMap','deleteVenueMap','savePhotoActivity','deletePhotoActivity','savePhotoActivityFrame','deletePhotoActivityFrame','savePromotionRule','deletePromotionRule']),
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
  if(!email||!token)return jsonErr('æ­¤åŠŸèƒ½éœ€è¦ç™»å…¥ä¸»è¾¦å·¥ä½œå°',401);
  const jwt=await verifyAdminToken(token,email,tenantId,env);if(!jwt)return jsonErr('ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ç™»å…¥',401);
  let role=String(jwt.normalized_role||jwt.role||'').trim();
  if(role!=='platform_super_admin'){
    const rows=await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(tenantId)}&email=eq.${encodeURIComponent(email)}&select=normalized_role,role,is_active,active&limit=1`).catch(()=>[]);
    const staff=rows[0],active=staff&&(staff.is_active!==undefined?staff.is_active:staff.active);
    if(!staff||active===false)return jsonErr('æ­¤å¸³è™Ÿæ²’æœ‰æœ‰æ•ˆçš„ç§Ÿæˆ¶æ¬Šé™',403);
    role=String(staff.normalized_role||staff.role||role).trim();
  }
  if(!(TENANT_ROLE_ALLOW[group]||[]).includes(role))return jsonErr('ä½ çš„è§’è‰²ä¸èƒ½åŸ·è¡Œé€™é …æ“ä½œ',403);
  return null;
}

// å–å¾—ç§Ÿæˆ¶ contextï¼ˆå“ç‰Œè³‡æ–™ã€ä¿¡ä»¶è¨­å®šã€SaaS åŠŸèƒ½æ——æ¨™ï¼‰
async function getTenantCtx(env, tenantId) {
  const tid = tenantId ;  // M-02ï¼štenant å·²ç”±è·¯ç”±å±¤é©—è­‰ï¼ˆè¦‹ routeGet/routePostï¼‰
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
    footer:     t.footer_text || (t.name || FALLBACK_TENANT_NAME) + 'ã€€All rights reserved.',
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


// â”€â”€ SECTION 10.9: AI ä¸»è¦–è¦ºç”Ÿæˆæ¨¡çµ„ï¼ˆ022ï¼‰â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  return out.join('ã€');
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
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY ç’°å¢ƒè®Šæ•¸æœªè¨­å®š');
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
    throw new Error('OpenAI ç”¢åœ–å¤±æ•—ï¼ˆ' + res.status + 'ï¼‰ï¼š' + msg);
  }
  const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw new Error('OpenAI ç”¢åœ–æˆåŠŸä½†æœªå›žå‚³åœ–åƒè³‡æ–™');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, model, quality, usage: data.usage || null };
}
async function _aiVisualStorageUpload(env, storagePath, bytes, mime = 'image/png') {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
  if (!base || !key) throw new Error('Supabase Storage ç’°å¢ƒè®Šæ•¸æœªè¨­å®š');
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
  if (!res.ok) throw new Error('AI ä¸»è¦–è¦º Storage ä¸Šå‚³å¤±æ•—ï¼ˆ' + res.status + 'ï¼‰ï¼š' + (await res.text()).slice(0, 500));
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
  if (!res.ok && res.status !== 404) throw new Error('Storage åˆªé™¤å¤±æ•—ï¼ˆ' + res.status + 'ï¼‰ï¼š' + (await res.text()).slice(0, 400));
}


async function hUploadCover(env,b){
  const TENANT=b&&b._tenantId;
  if(!await verifyStaff(env,b.email,b.token,TENANT,'sessions'))return jsonErr('ç„¡æ¬Šé™');
  const raw=String(b.image||'').trim();
  const m=raw.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if(!m)return jsonErr('åœ–ç‰‡æ ¼å¼ä¸æ”¯æ´ï¼Œè«‹ä½¿ç”¨ PNGã€JPG æˆ– WebP');
  let bin;
  try{bin=atob(m[2].replace(/\s+/g,''));}catch(e){return jsonErr('åœ–ç‰‡è³‡æ–™ç„¡æ³•è§£æž');}
  if(!bin.length)return jsonErr('åœ–ç‰‡å…§å®¹æ˜¯ç©ºçš„');
  if(bin.length>6*1024*1024)return jsonErr('åœ–ç‰‡éŽå¤§ï¼Œè«‹æŽ§åˆ¶åœ¨ 6MB ä»¥å…§');
  const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const ext=m[1]==='image/jpeg'?'jpg':(m[1]==='image/webp'?'webp':'png');
  const storagePath=`${TENANT}/manual/${genId('COVER')}.${ext}`;
  try{
    const url=await _aiVisualStorageUpload(env,storagePath,bytes,m[1]);
    await writeAuditLog(env,TENANT,b.email||'','admin','upload_cover','storage',storagePath,null,{url},{mime:m[1],size:bytes.length}).catch(()=>{});
    return jsonOk({success:true,url,storagePath});
  }catch(e){
    return jsonErr('åœ–ç‰‡ä¸Šå‚³å¤±æ•—ï¼š'+(e&&e.message?e.message:'Storage å¯«å…¥å¤±æ•—'));
  }
}



async function publicPlatformProfile(env){
  const p=await getPlatformSetting(env,'public_platform_profile',{});
  return {companyName:String(p.companyName||''),taxId:String(p.taxId||''),officialLineUrl:String(p.officialLineUrl||''),supportEmail:String(p.supportEmail||'Ndiangrace@gmail.com')};
}
async function hPublicPlatformProfile(env,p){return jsonOk(await publicPlatformProfile(env))}
async function hGetPlatformPublicProfile(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');return jsonOk(await publicPlatformProfile(env))}
async function hSavePlatformPublicProfile(env,b){
  const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');
  const value={companyName:String(b.companyName||'').trim(),taxId:String(b.taxId||'').trim(),officialLineUrl:String(b.officialLineUrl||'').trim(),supportEmail:normEmail(b.supportEmail||'')};
  const now=nowIso(),rows=await dbGet(env,'platform_settings','setting_key=eq.public_platform_profile&select=setting_key').catch(()=>[]);
  if(rows.length)await dbUpdate(env,'platform_settings','setting_key=eq.public_platform_profile',{value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});else await dbInsert(env,'platform_settings',{setting_key:'public_platform_profile',value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});
  return jsonOk(value);
}

// â”€â”€ DOING æ›å…‰æŽ¨å»£æ¨¡çµ„ï¼ˆ007ï¼‰â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// exposure_orders åªä¿å­˜ã€Œæ›å…‰æ¬Šç›Šã€ï¼›æ´»å‹•åç¨±ã€æ—¥æœŸã€åœ–ã€åœ°é»žæ°¸é è®€æ­£å¼ sessions/events/tenantsã€‚
const EXPOSURE_HOME_PLACEMENT='home_activity_flash';
function exposurePublicSessionStatus(v){return ['å ±åä¸­','é–‹æ”¾ä¸­','é–‹æ”¾'].includes(String(v||''))}
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
    const e=em[String(s.event_id||'')]||{};if(e.id&&String(e.tenant_id)!==String(o.tenant_id))continue;if(String(e.status||'')==='åœç”¨')continue;
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

// åŒ¿åå¹³å°æ­¸å› ï¼šåªä¿å­˜æ´»å‹•éµã€ä¾†æºã€äº‹ä»¶èˆ‡éš¨æ©Ÿæ­¸å› ç¢¼ï¼Œä¸ä¿å­˜ Emailã€æ‰‹æ©Ÿã€IP æˆ– User-Agentã€‚
const PLATFORM_ATTRIBUTION_SOURCES=new Set(['paid_exposure','global_discovery']);
const PLATFORM_ATTRIBUTION_PUBLIC_EVENTS=new Set(['impression','click']);
function cleanAttributionId(v){const x=String(v||'').trim();return /^[A-Za-z0-9_-]{8,80}$/.test(x)?x:''}
function cleanAttributionPath(v){const x=String(v||'/').trim().slice(0,200);return x.startsWith('/')?x:'/'}
async function hTrackPlatformAttribution(env,b){
  const eventType=String(b.eventType||'').trim(),source=String(b.source||'').trim();
  const tenantId=String(b.tenantId||'').trim(),sessionId=String(b.sessionId||'').trim();
  const attributionId=cleanAttributionId(b.attributionId),exposureOrderId=String(b.exposureOrderId||'').trim();
  if(!PLATFORM_ATTRIBUTION_PUBLIC_EVENTS.has(eventType)||!PLATFORM_ATTRIBUTION_SOURCES.has(source))return jsonErr('æ­¸å› äº‹ä»¶æ ¼å¼ä¸æ­£ç¢º');
  if(!tenantId||!sessionId||!attributionId)return jsonErr('æ­¸å› äº‹ä»¶ç¼ºå°‘æ´»å‹•è³‡è¨Š');
  const sessions=await dbGet(env,'sessions',`id=eq.${encodeURIComponent(sessionId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&select=id,tenant_id,status&limit=1`).catch(()=>[]);
  if(!sessions.length||!exposurePublicSessionStatus(sessions[0].status))return jsonErr('æ´»å‹•ç›®å‰æœªå…¬é–‹');
  let orderId=null;
  if(source==='paid_exposure'){
    if(!exposureOrderId)return jsonErr('ä»˜è²»æ›å…‰äº‹ä»¶ç¼ºå°‘æ›å…‰è¨‚å–®');
    const orders=await dbGet(env,'exposure_orders',`id=eq.${encodeURIComponent(exposureOrderId)}&tenant_id=eq.${encodeURIComponent(tenantId)}&session_id=eq.${encodeURIComponent(sessionId)}&select=id&limit=1`).catch(()=>[]);
    if(!orders.length)return jsonErr('æ‰¾ä¸åˆ°å°æ‡‰çš„æ›å…‰è¨‚å–®');
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
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');
  return jsonOk(await buildAttributionReport(env,{days:p.days}));
}
async function hGetExposureCatalog(env,p){
  const T=p._tenantId;if(!await verifyStaff(env,p.email,p.token,T,'settings'))return jsonErr('ç„¡æ¬Šé™');
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
  const T=b._tenantId;if(!await verifyStaff(env,b.email,b.token,T,'settings'))return jsonErr('ç„¡æ¬Šé™');
  const planId=String(b.planId||'').trim(),sessionId=String(b.sessionId||'').trim();if(!planId||!sessionId)return jsonErr('è«‹é¸æ“‡æ›å…‰æ–¹æ¡ˆèˆ‡æ´»å‹•');
  const [plans,sessions]=await Promise.all([
    dbGet(env,'exposure_plans',`id=eq.${encodeURIComponent(planId)}&is_active=eq.true&select=*`).catch(()=>[]),
    dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(sessionId)}&select=id,status,name,event_id`).catch(()=>[])
  ]);
  const plan=plans[0],ses=sessions[0];if(!plan)return jsonErr('æ›å…‰æ–¹æ¡ˆç›®å‰æœªé–‹æ”¾');if(!ses)return jsonErr('æ‰¾ä¸åˆ°æ´»å‹•');if(!exposurePublicSessionStatus(ses.status))return jsonErr('åªæœ‰æ­£å¼å…¬é–‹ä¸­çš„æ´»å‹•æ‰èƒ½è³¼è²·é¦–é æ›å…‰');
  const dup=await dbGet(env,'exposure_orders',`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sessionId)}&status=in.(pending_payment,scheduled,active)&select=id,status&limit=1`).catch(()=>[]);
  if(dup.length)return jsonErr('é€™å€‹æ´»å‹•å·²æœ‰å¾…ä»˜æ¬¾æˆ–é€²è¡Œä¸­çš„åŒæ–¹æ¡ˆæ›å…‰');
  let requested=null;if(b.requestedStartAt){const d=new Date(b.requestedStartAt);if(!Number.isNaN(d.getTime()))requested=d.toISOString()}
  const row={id:genId('EXP'),tenant_id:T,plan_id:plan.id,session_id:sessionId,placement:plan.placement||EXPOSURE_HOME_PLACEMENT,status:'pending_payment',payment_status:'pending',amount:safeNum(plan.price),requested_start_at:requested,created_by_email:b.email||'',note:String(b.note||''),created_at:nowIso(),updated_at:nowIso()};
  await dbInsert(env,'exposure_orders',row);return jsonOk({ok:true,order:row});
}
async function hCancelExposureOrder(env,b){
  const T=b._tenantId;if(!await verifyStaff(env,b.email,b.token,T,'settings'))return jsonErr('ç„¡æ¬Šé™');
  const id=String(b.orderId||'').trim();if(!id)return jsonErr('ç¼ºå°‘æ›å…‰è¨‚å–®');
  const rows=await dbGet(env,'exposure_orders',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`).catch(()=>[]);const o=rows[0];if(!o)return jsonErr('æ‰¾ä¸åˆ°æ›å…‰è¨‚å–®');
  if(String(o.payment_status)==='confirmed'||['active','scheduled'].includes(String(o.status)))return jsonErr('å·²ä»˜æ¬¾çš„æ›å…‰è«‹è¯ç¹« DOING å®¢æœè™•ç†');
  await dbUpdate(env,'exposure_orders',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,{status:'cancelled',payment_status:'cancelled',cancelled_at:nowIso(),updated_at:nowIso()});return jsonOk({ok:true});
}
async function hGetExposurePlansPlatform(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');return jsonOk(await dbGet(env,'exposure_plans','select=*&order=sort_order.desc,created_at.asc').catch(()=>[]))}
async function hSaveExposurePlanPlatform(env,b){
  const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');
  const id=String(b.id||'').trim()||genId('EXPP'),code=String(b.code||'').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');const name=String(b.name||'').trim();
  const days=Math.max(1,Math.min(365,parseInt(b.durationDays,10)||0)),price=Math.max(0,Number(b.price)||0),weight=Math.max(1,Math.min(20,parseInt(b.displayWeight,10)||1)),sort=Math.max(-9999,Math.min(9999,parseInt(b.sortOrder,10)||0));
  if(!code||!name)return jsonErr('è«‹å¡«å¯«æ–¹æ¡ˆä»£ç¢¼èˆ‡åç¨±');
  const data={code,name,placement:EXPOSURE_HOME_PLACEMENT,duration_days:days,price,display_weight:weight,sort_order:sort,is_active:b.isActive===true||b.isActive==='true',updated_at:nowIso()};
  const old=await dbGet(env,'exposure_plans',`id=eq.${encodeURIComponent(id)}&select=id`).catch(()=>[]);
  if(old.length)await dbUpdate(env,'exposure_plans',`id=eq.${encodeURIComponent(id)}`,data);else await dbInsert(env,'exposure_plans',{id,...data,config_json:{},created_at:nowIso()});
  return jsonOk({ok:true,id});
}
async function hGetPlatformExposureOrders(env,p){
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');await syncExposureStatuses(env);
  const orders=await dbGet(env,'exposure_orders','select=*&order=created_at.desc&limit=500').catch(()=>[]);if(!orders.length)return jsonOk([]);
  const tids=[...new Set(orders.map(x=>String(x.tenant_id||'')).filter(Boolean))],sids=[...new Set(orders.map(x=>String(x.session_id||'')).filter(Boolean))],pids=[...new Set(orders.map(x=>String(x.plan_id||'')).filter(Boolean))];const inQ=a=>a.map(x=>'"'+x.replace(/"/g,'')+'"').join(',');
  const [tenants,sessions,plans]=await Promise.all([dbGet(env,'tenants',`id=in.(${inQ(tids)})&select=id,name`).catch(()=>[]),dbGet(env,'sessions',`id=in.(${inQ(sids)})&select=id,tenant_id,name,status`).catch(()=>[]),dbGet(env,'exposure_plans',`id=in.(${inQ(pids)})&select=id,name,duration_days,price`).catch(()=>[])]);
  const tm=Object.fromEntries(tenants.map(x=>[x.id,x])),sm=Object.fromEntries(sessions.map(x=>[x.id,x])),pm=Object.fromEntries(plans.map(x=>[x.id,x]));
  return jsonOk(orders.map(o=>({...o,tenantName:(tm[o.tenant_id]||{}).name||o.tenant_id,sessionName:(sm[o.session_id]||{}).name||o.session_id,sessionStatus:(sm[o.session_id]||{}).status||'',planName:(pm[o.plan_id]||{}).name||o.plan_id,durationDays:(pm[o.plan_id]||{}).duration_days||0})));
}
async function hConfirmExposurePayment(env,b){
  const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');
  const id=String(b.orderId||'').trim();if(!id)return jsonErr('ç¼ºå°‘æ›å…‰è¨‚å–®');
  let startsAt=null;if(b.startsAt){const d=new Date(b.startsAt);if(!Number.isNaN(d.getTime()))startsAt=d.toISOString()}
  try{
    const result=await dbRpc(env,'confirm_exposure_payment_atomic',{p_order_id:id,p_confirmed_by:pay.email,p_starts_at:startsAt});
    return jsonOk(result&&typeof result==='object'?result:{ok:true});
  }catch(e){
    const t=String(e&&e.message||'');
    if(t.includes('EXPOSURE_ORDER_NOT_FOUND'))return jsonErr('æ‰¾ä¸åˆ°æ›å…‰è¨‚å–®');
    if(t.includes('EXPOSURE_ORDER_CANCELLED'))return jsonErr('æ­¤æ›å…‰è¨‚å–®å·²å–æ¶ˆ');
    if(t.includes('EXPOSURE_PLAN_NOT_FOUND'))return jsonErr('æ‰¾ä¸åˆ°æ›å…‰æ–¹æ¡ˆ');
    return jsonErr('æ›å…‰æ”¶æ¬¾ç¢ºèªå¤±æ•—ï¼š'+t);
  }
}
async function hCancelExposurePlatform(env,b){const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');const id=String(b.orderId||'').trim();if(!id)return jsonErr('ç¼ºå°‘æ›å…‰è¨‚å–®');await dbUpdate(env,'exposure_orders',`id=eq.${encodeURIComponent(id)}`,{status:'cancelled',cancelled_at:nowIso(),updated_at:nowIso(),note:String(b.note||'å¹³å°å–æ¶ˆæ›å…‰')});return jsonOk({ok:true})}


// â”€â”€ SECTION 11: GET Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// DOING å…¬é–‹å¹³å°é¦–é ï¼šè·¨ä¸»è¾¦åªè®€å–ã€Œæ­£å¼å…¬é–‹ã€è³‡æ–™ã€‚
// ä¸å›žå‚³ staffã€æœƒå“¡ã€ä»˜æ¬¾ã€è²¡å‹™æˆ–ä»»ä½•ä¸»è¾¦ç§æœ‰è¨­å®šã€‚
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

// ã€Œæˆ‘çš„å ±åã€è·¨ä¸»è¾¦æŸ¥è©¢ã€‚
// æ¬Šé™æ ¸å¿ƒï¼šåªä»¥ä½¿ç”¨è€…æä¾›çš„ Email æŸ¥å€™é¸ï¼Œå†ä»¥æ‰‹æ©Ÿé€ç­†é…å°ï¼›
// å›žå‚³çš„æ¯ä¸€ç­†éƒ½å¿…é ˆæ˜¯è©²æœ¬äººè‡ªå·±çš„ registrationã€‚
// ä¸»è¾¦å¾Œå°å®Œå…¨ä¸ä½¿ç”¨æ­¤ APIï¼Œå› æ­¤ä¸æœƒå–å¾—å…¶ä»– Tenant è³‡æ–™ã€‚
async function hGetMyRegsGlobal(env,p){
  const verified=await verifiedPlatformMember(env,p&&(p.member_token||p.memberToken||p.token));
  if(!verified||!platformMemberComplete(verified.row))return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥');
  const memberId=String(verified.row.id||'').trim();
  if(!memberId)return jsonErr('æ‰¾ä¸åˆ°æœƒå“¡è³‡æ–™ï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥');
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
    // é—œè¯è³‡æ–™å†é©— tenantï¼Œé˜²æ­¢éŒ¯ ID äº¤å‰ä¸²æŽ¥ã€‚
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
      seatMapUrl:s.seat_map_url||'',seatFeeTotal:safeNum(r.seat_fee_total),payMethod:r.payment_method||'',payLast5:r.payment_last5||'',checkin:r.checkin_status,teardownStatus:r.teardown_status||'æœªæ’¤å ´',clearStatus:r.clear_status||'æœªæ¸…å ´',createdAt:r.created_at,approvedAt:r.approved_at||'',paymentReportedAt:r.payment_reported_at||'',paidAt:r.paid_at||'',checkinAt:r.checkin_at||'',
      transferStatus:r.transfer_status||'',refundAmount:safeNum(r.refund_amount),refundedAt:r.refunded_at||'',refundNote:r.refund_note||'',forceStatus:r.force_status||(s.force_cancel?'pending_force_choice':null),
      forceChoiceDeadline:s.force_cancel_deadline||'',forceCancelled:s.force_cancel||false,forceTransferTargetSessionId:r.transferred_to_session_id||s.force_cancel_target_id||'',
      modules:normalizeSessionModules(u?safeJson(u.modules_json,{}):safeJson(s.modules_json,{})),
      paymentProfile:payPub,paymentProfileName:payPub.paymentProfileName,paymentOwnerMode:payPub.paymentOwnerMode,
      allowedPaymentMethods:payPub.allowedMethods,bankAccount:payPub.bankAccount,linepay:payPub.linepay,card:payPub.card
    });
  }
  return jsonOk(out);
}


// frontBootstrapï¼šå‰å°è³‡æ–™åº«ä¸»å°Žç¸½å…¥å£

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

// â”€â”€ DOING çµ±ä¸€ç‡Ÿé‹å–®å…ƒ / é€šçŸ¥ / å›žé¥‹æ ¸å¿ƒ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    const end=addCalendarMonthTaipei(nowIso()),c=await consumeCreditOrNeedPayment(env,T,fees.bookingMonthlyFee,'booking_monthly','unit:'+u.id,end);if(!c.ok){await ensurePendingBillingLog(env,T,'booking_monthly',fees.bookingMonthlyFee,'ç­‰å¾…ç§Ÿæˆ¶ç¹³äº¤é ç´„ç‡Ÿé‹æœˆè²»','',end);return {...c,mode}}
    try{await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:'booking_monthly',amount:fees.bookingMonthlyFee,tax:0,total:fees.bookingMonthlyFee,status:'confirmed',confirmed_at:nowIso(),confirmed_by:'platform_credit',period_start:nowIso(),period_end:end,note:'é ç´„ç‡Ÿé‹æœˆæ–¹æ¡ˆï½œ'+u.id,created_at:nowIso()})}catch(e){await rollbackPlatformCreditUse(env,T,fees.bookingMonthlyFee,c.ledgerId,'booking_unit_entitlement_failed').catch(()=>{});throw e}return {ok:true,mode,periodEnd:end};
  }
  if(isPaidOperatingUnit(u))return {ok:true,mode,chargeMode:'paid_activity_rate'};
  if(await hasOperationUnitEntitlement(env,T,u.id))return {ok:true,mode};
  const c=await consumeCreditOrNeedPayment(env,T,fees.freeActivityFee,'activity_unit',u.id);if(!c.ok){await ensurePendingBillingLog(env,T,billingTypeForOperationUnit(u.id),fees.freeActivityFee,'ç­‰å¾…ç§Ÿæˆ¶ç¹³äº¤å…è²»ç¨ç«‹æ´»å‹•å•Ÿç”¨è²»',u.session_id||'');return {...c,mode}}
  try{await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:billingTypeForOperationUnit(u.id),amount:fees.freeActivityFee,tax:0,total:fees.freeActivityFee,status:'confirmed',confirmed_at:nowIso(),confirmed_by:'platform_credit',period_start:nowIso(),period_end:null,note:'ç‡Ÿé‹é …ç›®æ­£å¼é–‹é€šï½œ'+u.id,created_at:nowIso()})}catch(e){await rollbackPlatformCreditUse(env,T,fees.freeActivityFee,c.ledgerId,'activity_unit_entitlement_failed').catch(()=>{});throw e}return {ok:true,mode};
}
async function anyOpenUnitEntitled(env,T,sessionId){
  const rows=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sessionId)}&status=in.(open,active,published)&select=*`).catch(()=>[]);
  for(const u of rows)if(await operationUnitEntitlementActive(env,T,u))return true;return false;
}
function unitTypeAllowed(v){return ['market','registration','booking','beauty','workshop','course','guide','staff','generic'].includes(String(v||''))?String(v):'registration'}
function unitStatusAllowed(v){return ['draft','pending_payment','open','active','published','closed','archived'].includes(String(v||''))?String(v):'draft'}
function unitCode(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)}

function formatBookingCalendar(x){return {id:String(x.id||''),name:String(x.name||'é ç´„æ—¥æ›†'),color:String(x.color||'#8bbfd1'),status:String(x.status||'active'),operationUnitId:String(x.operation_unit_id||''),ownerStaffId:String(x.owner_staff_id||''),sortOrder:safeNum(x.sort_order),config:safeJson(x.config_json,{})}}
async function bookingCalendarsForTenant(env,T){return dbGet(env,'booking_calendars',`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=sort_order.asc,created_at.asc`).catch(()=>[])}
async function ensureBookingCalendar(env,T,{id='',name='ä¸»è¦é ç´„æ—¥æ›†',operationUnitId='',color='#8bbfd1'}={}){
  const rows=await bookingCalendarsForTenant(env,T),cleanName=String(name||'ä¸»è¦é ç´„æ—¥æ›†').trim().slice(0,60)||'ä¸»è¦é ç´„æ—¥æ›†';
  let hit=id?rows.find(x=>String(x.id)===String(id)):null;if(!hit&&cleanName)hit=rows.find(x=>String(x.name).toLowerCase()===cleanName.toLowerCase()&&(!operationUnitId||!x.operation_unit_id||String(x.operation_unit_id)===String(operationUnitId)));
  if(hit)return hit;
  const now=nowIso(),calendar={id:genId('CAL'),tenant_id:T,operation_unit_id:operationUnitId||null,name:cleanName,color:/^#[0-9a-f]{6}$/i.test(color)?color:'#8bbfd1',status:'active',owner_staff_id:null,sort_order:rows.length,config_json:{},created_at:now,updated_at:now};await dbInsert(env,'booking_calendars',calendar);return calendar;
}
async function hGetBookingCalendarAdmin(env,p){
  const T=p._tenantId;if(!await verifyStaff(env,p.email,p.token,T,'sessions'))return jsonErr('ç„¡æ¬Šé™');
  const [calendars,regs]=await Promise.all([bookingCalendarsForTenant(env,T),dbGet(env,'registrations',`tenant_id=eq.${encodeURIComponent(T)}&select=id,session_id,operation_unit_id,booking_calendar_id,name,brand_name,email,phone,selected_dates_json,custom_fields_json,review_status,registration_status,payment_status,transfer_status&order=created_at.desc&limit=3000`).catch(()=>[])]);
  const slotIds=[...new Set(regs.flatMap(registrationTimeslotIds))],slots=slotIds.length?await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&id=in.(${slotIds.map(x=>encodeURIComponent(x)).join(',')})&select=id,date_key,start_text,end_text,booking_calendar_id,operation_unit_id`).catch(()=>[]):[],slotMap=Object.fromEntries(slots.map(x=>[String(x.id),x])),calByUnit={};for(const c of calendars)if(c.operation_unit_id&&!calByUnit[c.operation_unit_id])calByUnit[c.operation_unit_id]=c.id;
  const bookings=[];for(const r of regs){const ids=registrationTimeslotIds(r);for(const slotId of ids){const s=slotMap[slotId];if(!s)continue;const calendarId=String(r.booking_calendar_id||s.booking_calendar_id||calByUnit[r.operation_unit_id]||'');bookings.push({id:r.id,slotId,calendarId,date:s.date_key,time:s.start_text||'',end:s.end_text||'',name:r.brand_name||r.name||'é ç´„',email:r.email||'',phone:r.phone||'',sessionId:r.session_id||'',operationUnitId:r.operation_unit_id||'',reviewStatus:r.review_status||'',registrationStatus:r.registration_status||'',paymentStatus:r.payment_status||'',transferStatus:r.transfer_status||''})}}
  return jsonOk({calendars:calendars.map(formatBookingCalendar),bookings});
}
async function hSaveBookingCalendar(env,b){
  const T=b._tenantId;if(!await verifyStaff(env,b.email,b.token,T,'settings'))return jsonErr('ç„¡æ¬Šé™');const name=String(b.name||'').trim().slice(0,60);if(!name)return jsonErr('è«‹å¡«é ç´„æ—¥æ›†åç¨±');
  const id=String(b.id||genId('CAL')),old=await dbGet(env,'booking_calendars',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`).catch(()=>[]),operationUnitId=String(b.operationUnitId||old[0]?.operation_unit_id||'').trim(),ownerStaffId=String(b.ownerStaffId||'').trim();
  if(operationUnitId){const u=await getOperationUnitRow(env,T,operationUnitId);if(!u)return jsonErr('æ‰¾ä¸åˆ°æŒ‡å®šçš„ç‡Ÿé‹é …ç›®')}
  if(ownerStaffId){const s=await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(ownerStaffId)}&select=id`).catch(()=>[]);if(!s.length)return jsonErr('æ‰¾ä¸åˆ°æŒ‡å®šçš„å·¥ä½œäººå“¡')}
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
    let bookingCalendarId=null;if(bookingMode){const cal=await ensureBookingCalendar(env,T,{id:String(x.calendarId||''),name:String(x.calendarName||'ä¸»è¦é ç´„æ—¥æ›†'),operationUnitId:uid,color:String(x.calendarColor||'#8bbfd1')});bookingCalendarId=cal.id}
    const payload={session_id:sid,operation_unit_id:uid,booking_calendar_id:bookingCalendarId,date_key:date,label:String(x.label||date),start_text:start,end_text:end,capacity:Math.max(0,parseInt(x.capacity||x.limit||0,10)||0),status:x.status==='closed'?'closed':'open',updated_at:now};
    if(hit)await dbUpdate(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,payload);
    else await dbInsert(env,'timeslots',{id,tenant_id:T,reserved_count:0,confirmed_count:0,config_json:{},created_at:now,...payload});
  }
  for(const x of oldSlots)if(!keep.has(String(x.id)))await dbUpdate(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(x.id)}`,{status:'closed',updated_at:now}).catch(()=>{});
}

async function hGetOperationUnitsPublic(env,p){
  const T=p._tenantId,sid=String(p.sessionId||'');if(!sid)return jsonErr('è«‹æä¾›å ´æ¬¡');
  const rows=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&status=in.(open,active,published)&select=*&order=sort_order.asc,created_at.asc`).catch(()=>[]),out=[];
  for(const u of rows)if(await operationUnitEntitlementActive(env,T,u)){const f=formatOperationUnit(u);const ts=await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(u.id)}&status=eq.open&select=*&order=date_key.asc,start_text.asc`).catch(()=>[]);f.timeslots=ts.map(x=>({id:x.id,date:x.date_key,label:x.label||x.date_key,start:x.start_text||'',end:x.end_text||'',capacity:safeNum(x.capacity),remaining:safeNum(x.capacity)>0?Math.max(0,safeNum(x.capacity)-safeNum(x.reserved_count)-safeNum(x.confirmed_count)):0}));out.push(f)}
  return jsonOk(out);
}
async function hGetOperationUnitsAdmin(env,p){
  const T=p._tenantId,sid=String(p.sessionId||'');if(!await verifyStaff(env,p.email,p.token,T,'sessions',sid||undefined))return jsonErr('ç„¡æ¬Šé™');
  let q=`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=sort_order.asc,created_at.asc`;if(sid)q=`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&select=*&order=sort_order.asc,created_at.asc`;
  const calendars=await bookingCalendarsForTenant(env,T),calendarMap=Object.fromEntries(calendars.map(x=>[String(x.id),x]));const rows=await dbGet(env,'operation_units',q).catch(()=>[]),out=[];for(const u of rows){const f=formatOperationUnit(u);const ts=await dbGet(env,'timeslots',`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(u.id)}&select=*&order=date_key.asc,start_text.asc`).catch(()=>[]);f.timeslots=ts.map(x=>({id:x.id,date:x.date_key,label:x.label||x.date_key,start:x.start_text||'',end:x.end_text||'',capacity:safeNum(x.capacity),status:x.status||'open',calendarId:x.booking_calendar_id||'',calendarName:calendarMap[x.booking_calendar_id]?.name||''}));out.push(f)}return jsonOk(out);
}
async function hSaveOperationUnit(env,b){
  const T=b._tenantId,sid=String(b.sessionId||'').trim();if(!sid)return jsonErr('è«‹å…ˆæŒ‡å®šå ´æ¬¡');if(!await verifyStaff(env,b.email,b.token,T,'sessions',sid))return jsonErr('ç„¡æ¬Šé™');
  const sr=await dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(sid)}&select=id,event_id`).catch(()=>[]);if(!sr.length)return jsonErr('æ‰¾ä¸åˆ°å ´æ¬¡');
  const name=String(b.name||'').trim();if(!name)return jsonErr('è«‹å¡«ç‡Ÿé‹é …ç›®åç¨±');const blocked=await requestedUnapprovedModules(env,T,b.modules||{});if(blocked.length)return jsonErr('ä»¥ä¸‹åŠŸèƒ½å°šæœªç”±å¹³å°æ ¸å‡†ï¼š'+blocked.join('ã€'));const now=nowIso(),id=String(b.id||genId('UNT')),mods=await tenantAllowedSessionModules(env,T,b.modules||{}),pricing=(b.pricing&&typeof b.pricing==='object')?b.pricing:{},policy=(b.policy&&typeof b.policy==='object')?b.policy:{},pub=(b.publicConfig&&typeof b.publicConfig==='object')?b.publicConfig:{};
  const requestedStatus=unitStatusAllowed(b.status),wantsOpen=['open','active','published'].includes(requestedStatus),slots=Array.isArray(b.timeslots)?b.timeslots:(Array.isArray(pub.timeslots)?pub.timeslots:[]);
  if(wantsOpen&&mods.operatingMode==='booking'&&!mods.workshopSlots)return jsonErr('é ç´„åž‹ç‡Ÿé‹é …ç›®å¿…é ˆè¨­å®šæ—¥æœŸï¼æ™‚æ®µ');
  if(wantsOpen&&mods.service&&!mods.services.length)return jsonErr('å·²å•Ÿç”¨æœå‹™æ–¹æ¡ˆï¼Œè«‹è‡³å°‘å»ºç«‹ä¸€å€‹æœå‹™é …ç›®');
  if(wantsOpen&&mods.resource&&!mods.resources.length)return jsonErr('å·²å•Ÿç”¨äººå“¡ï¼è³‡æºï¼Œè«‹è‡³å°‘å»ºç«‹ä¸€å€‹å¯é¸è³‡æº');
  if(wantsOpen&&mods.workshopSlots&&!slots.length)return jsonErr('å·²å•Ÿç”¨æ—¥æœŸï¼æ™‚æ®µï¼Œè«‹è‡³å°‘å»ºç«‹ä¸€å€‹å¯é ç´„æ™‚æ®µ');
  if(wantsOpen&&mods.operatingMode==='booking'&&!mods.payment)return jsonErr('é ç´„åž‹ç‡Ÿé‹é …ç›®å¿…é ˆå•Ÿç”¨ä»˜æ¬¾åŠŸèƒ½');
  let code=unitCode(b.code)||unitCode(name)||('unit-'+id.slice(-6).toLowerCase());const same=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&code=eq.${encodeURIComponent(code)}&select=id`).catch(()=>[]);if(same.some(x=>String(x.id)!==id))code=code+'-'+id.slice(-4).toLowerCase();
  const data={event_id:String(sr[0].event_id||''),session_id:sid,code,name,unit_type:unitTypeAllowed(b.unitType),status:requestedStatus,description:String(b.description||''),capacity:Math.max(0,parseInt(b.capacity||0,10)||0),fee:Math.max(0,safeNum(b.fee)),modules_json:JSON.stringify(mods),pricing_json:JSON.stringify(pricing),policy_json:JSON.stringify(policy),public_config_json:JSON.stringify({...pub,timeslots:slots}),sort_order:Math.max(0,parseInt(b.sortOrder||0,10)||0),updated_at:now};
  const old=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`).catch(()=>[]);if(wantsOpen)data.status=old.length&&operationUnitIsOpen(old[0])?requestedStatus:'draft';if(old.length){if(String(old[0].session_id)!==sid)return jsonErr('ç‡Ÿé‹é …ç›®ä¸å¯è·¨å ´æ¬¡ç›´æŽ¥æ¬ç§»');await dbUpdate(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,data)}else await dbInsert(env,'operation_units',{id,tenant_id:T,current_count:0,created_at:now,...data});
  let fresh=(await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`))[0];if(wantsOpen&&!operationUnitIsOpen(fresh)){const ent=await ensureOperationUnitEntitlement(env,T,{...fresh,status:requestedStatus});if(!ent.ok){await dbUpdate(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,{status:'pending_payment',updated_at:nowIso()});fresh=(await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`))[0];await syncOperationUnitCatalogs(env,T,fresh);return jsonOk({...formatOperationUnit(fresh),needPayment:true,paymentAmount:ent.amount||0,platformCredit:ent.balance||0,pendingOpenStatus:requestedStatus})}await dbUpdate(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`,{status:requestedStatus,updated_at:nowIso()});fresh=(await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=*`))[0]}await syncOperationUnitCatalogs(env,T,fresh);await writeAuditLog(env,T,b.email||'','admin',old.length?'update_operation_unit':'create_operation_unit','operation_units',id,old[0]||null,fresh,{sessionId:sid}).catch(()=>{});return jsonOk(formatOperationUnit(fresh));
}
async function hDeleteOperationUnit(env,b){
  const T=b._tenantId,id=String(b.id||b.operationUnitId||''),u=await getOperationUnitRow(env,T,id);if(!u)return jsonErr('æ‰¾ä¸åˆ°ç‡Ÿé‹é …ç›®');if(!await verifyStaff(env,b.email,b.token,T,'sessions',String(u.session_id)))return jsonErr('ç„¡æ¬Šé™');
  const regs=await dbGet(env,'registrations',`tenant_id=eq.${encodeURIComponent(T)}&operation_unit_id=eq.${encodeURIComponent(id)}&select=id&limit=1`).catch(()=>[]);if(regs.length)return jsonErr('æ­¤ç‡Ÿé‹é …ç›®å·²æœ‰æ­£å¼å ±åï¼é ç´„ç´€éŒ„ï¼Œä¸èƒ½åˆªé™¤ï¼›è«‹æ”¹ç‚ºé—œé–‰æˆ–å°å­˜ï¼Œé¿å…æ­·å²è³‡æ–™æ–·éˆ');
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
async function applyRewardRedemption(env,T,email,regId,u,benefit){const amount=Math.max(0,safeNum(benefit&&benefit.rewardRedeem));if(amount<=0)return;const r=await dbRpc(env,'consume_reward_credit_atomic',{p_tenant_id:T,p_member_email:normEmail(email),p_amount:amount,p_operation_unit_id:u?.id||null,p_session_id:u?.session_id||null,p_registration_id:regId});if(!r||r.ok===false)throw new Error((r&&r.error)||'å›žé¥‹é‡‘é¤˜é¡å·²è®Šå‹•ï¼Œè«‹é‡æ–°é€å‡º')}
async function recordNotification(env,{tenantId,unitId=null,sessionId=null,registrationId=null,email='',eventKey,title,body,channel='system',status='sent',meta={}}){try{await dbInsert(env,'notifications',{id:genId('NTF'),tenant_id:tenantId,operation_unit_id:unitId,session_id:sessionId,registration_id:registrationId,member_email:normEmail(email),event_key:eventKey,channel,title:String(title||''),body:String(body||''),status,scheduled_at:null,sent_at:status==='sent'?nowIso():null,error_message:null,meta_json:JSON.stringify(meta||{}),created_at:nowIso()})}catch(e){logError(env,{source:'recordNotification',tenantId,regId:registrationId,error:e})}}

async function hGetPromotionRulesAdmin(env,p){const T=p._tenantId,sid=String(p.sessionId||'');if(!await verifyStaff(env,p.email,p.token,T,'sessions',sid||undefined))return jsonErr('ç„¡æ¬Šé™');let q=`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=created_at.desc`;if(sid)q=`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&select=*&order=created_at.desc`;return jsonOk(await dbGet(env,'promotion_rules',q).catch(()=>[]))}
async function hSavePromotionRule(env,b){
  const T=b._tenantId,uid=String(b.operationUnitId||''),u=uid?await getOperationUnitRow(env,T,uid):null,sid=String((u&&u.session_id)||b.sessionId||'');
  if(!sid||!await verifyStaff(env,b.email,b.token,T,'sessions',sid))return jsonErr('ç„¡æ¬Šé™');
  const typ=String(b.ruleType||'');if(!['early_bird','coupon','completion_reward','multi_session_bonus'].includes(typ))return jsonErr('å„ªæƒ é¡žåž‹ä¸æ­£ç¢º');
  const name=String(b.name||'').trim();if(!name)return jsonErr('è«‹å¡«åç¨±');
  const code=typ==='coupon'?String(b.code||'').trim():'';if(typ==='coupon'&&!code)return jsonErr('è«‹å¡«å„ªæƒ åˆ¸ä»£ç¢¼');
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
async function hDeletePromotionRule(env,b){const T=b._tenantId,id=String(b.id||'');const rows=await dbGet(env,'promotion_rules',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}&select=session_id`).catch(()=>[]);if(!rows.length)return jsonErr('æ‰¾ä¸åˆ°å„ªæƒ ');if(!await verifyStaff(env,b.email,b.token,T,'sessions',String(rows[0].session_id||'')))return jsonErr('ç„¡æ¬Šé™');await dbDelete(env,'promotion_rules',`tenant_id=eq.${encodeURIComponent(T)}&id=eq.${encodeURIComponent(id)}`);return jsonOk({ok:true})}
async function hGetMyRewards(env,p){const T=p._tenantId,verified=await verifiedPlatformMember(env,p&&(p.member_token||p.memberToken||p.token));if(!verified||!platformMemberComplete(verified.row))return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥');const email=platformContactEmail(verified.row);const rows=await dbGet(env,'reward_ledger',`tenant_id=eq.${encodeURIComponent(T)}&member_email=ilike.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=100`).catch(()=>[]);return jsonOk({balance:await rewardBalance(env,T,email),rows})}
async function hGetMyNotifications(env,p){const T=p._tenantId,verified=await verifiedPlatformMember(env,p&&(p.member_token||p.memberToken||p.token));if(!verified||!platformMemberComplete(verified.row))return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥');const email=platformContactEmail(verified.row);return jsonOk(await dbGet(env,'notifications',`tenant_id=eq.${encodeURIComponent(T)}&member_email=ilike.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=100`).catch(()=>[]))}
async function hGetNotificationsAdmin(env,p){const T=p._tenantId,sid=String(p.sessionId||'');if(!await verifyStaff(env,p.email,p.token,T,'announce',sid||undefined)&&!await verifyStaff(env,p.email,p.token,T,'sessions',sid||undefined))return jsonErr('ç„¡æ¬Šé™');let q=`tenant_id=eq.${encodeURIComponent(T)}&select=*&order=created_at.desc&limit=200`;if(sid)q=`tenant_id=eq.${encodeURIComponent(T)}&session_id=eq.${encodeURIComponent(sid)}&select=*&order=created_at.desc&limit=200`;return jsonOk(await dbGet(env,'notifications',q).catch(()=>[]))}

async function getPlatformSetting(env,key,fallback={}){const rows=await dbGet(env,'platform_settings',`setting_key=eq.${encodeURIComponent(key)}&select=value_json`).catch(()=>[]);return rows.length?safeJson(rows[0].value_json,fallback):fallback}
const DEFAULT_PLATFORM_BILLING_POLICY=Object.freeze({freeActivityFee:200,bookingMonthlyFee:688,paidActivityRatePercent:1,noCap:true});
function normalizePlatformBillingPolicy(raw={}){return {freeActivityFee:Math.max(0,Math.round(safeNum(raw.freeActivityFee??DEFAULT_PLATFORM_BILLING_POLICY.freeActivityFee))),bookingMonthlyFee:Math.max(0,Math.round(safeNum(raw.bookingMonthlyFee??DEFAULT_PLATFORM_BILLING_POLICY.bookingMonthlyFee))),paidActivityRatePercent:Math.max(0,Math.min(100,Math.round(safeNum(raw.paidActivityRatePercent??DEFAULT_PLATFORM_BILLING_POLICY.paidActivityRatePercent)*10000)/10000)),noCap:true}}
async function platformBillingPolicy(env){return normalizePlatformBillingPolicy(await getPlatformSetting(env,'platform_billing_policy',DEFAULT_PLATFORM_BILLING_POLICY))}

async function hGetPlatformServiceSales(env,p){
  const pay=await verifyAdminJwt(p.token,env);
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™',401);
  const T=String(p.target_tenant_id||'').trim().toLowerCase();
  if(!T)return jsonErr('è«‹é¸æ“‡ä¸»è¾¦');
  const rows=await dbGet(env,'billing_logs',`tenant_id=eq.${encodeURIComponent(T)}&status=eq.confirmed&select=id,billing_type,amount,total,note,confirmed_at,confirmed_by,created_at&order=created_at.desc&limit=100`).catch(()=>[]);
  return jsonOk(rows.filter(x=>String(x.billing_type||'').startsWith('setup_feature:')).map(x=>{
    const note=String(x.note||''),parts=note.split('ï½œ');
    return {id:x.id,billingType:x.billing_type,serviceName:parts.shift()||'å¹³å°æœå‹™',amount:safeNum(x.total||x.amount),note:parts.join('ï½œ'),confirmedAt:x.confirmed_at||x.created_at,confirmedBy:x.confirmed_by||''};
  }));
}
async function hRecordPlatformServiceSale(env,b){
  const pay=await verifyAdminJwt(b.token,env);
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™',401);
  const T=String(b.target_tenant_id||'').trim().toLowerCase(),kind=['setup','module','custom'].includes(String(b.kind||''))?String(b.kind):'custom';
  const name=String(b.name||'').trim().slice(0,100),amount=Math.max(0,Math.round(safeNum(b.amount))),moduleKey=String(b.moduleKey||'').trim(),note=String(b.note||'').trim().slice(0,500);
  if(!T||!name)return jsonErr('è«‹é¸æ“‡ä¸»è¾¦ä¸¦å¡«å¯«æœå‹™åç¨±');
  const tenant=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(T)}&select=id`).catch(()=>[]);
  if(!tenant.length)return jsonErr('æ‰¾ä¸åˆ°ä¸»è¾¦ç©ºé–“');
  if(moduleKey&&!Object.prototype.hasOwnProperty.call(DEFAULT_TENANT_MODULE_FLAGS,moduleKey))return jsonErr('ä¸æ”¯æ´çš„å°ˆæ¥­æ¨¡çµ„');
  const now=nowIso(),id=genId('SVC'),code=(moduleKey||kind+'_'+id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80);
  await dbInsert(env,'billing_logs',{id,tenant_id:T,billing_type:'setup_feature:'+kind+':'+code,amount,tax:0,total:amount,status:'confirmed',confirmed_at:now,confirmed_by:pay.email,period_start:now,period_end:null,note:name+(note?'ï½œ'+note:''),created_at:now});
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

async function hGetPlatformBillingPolicy(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');return jsonOk(await platformBillingPolicy(env))}
async function hGetPublicBillingPolicy(env){return jsonOk(await platformBillingPolicy(env))}
async function hSavePlatformBillingPolicy(env,b){const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');const value=normalizePlatformBillingPolicy(b),now=nowIso(),rows=await dbGet(env,'platform_settings','setting_key=eq.platform_billing_policy&select=setting_key').catch(()=>[]);if(rows.length)await dbUpdate(env,'platform_settings','setting_key=eq.platform_billing_policy',{value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});else await dbInsert(env,'platform_settings',{setting_key:'platform_billing_policy',value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});await writeAuditLog(env,'platform',pay.email||'','platform_super_admin','save_platform_billing_policy','platform_settings','platform_billing_policy',null,value,{}).catch(()=>{});return jsonOk(value)}
async function platformPaymentProfile(env){const p=await getPlatformSetting(env,'platform_payment_profile',{});return {bankName:String(p.bankName||'').trim(),bankCode:String(p.bankCode||'').trim(),accountName:String(p.accountName||'').trim(),accountNumber:String(p.accountNumber||'').trim(),paymentNote:String(p.paymentNote||'').trim()}}
async function hGetPlatformPaymentProfile(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');return jsonOk(await platformPaymentProfile(env))}
async function hSavePlatformPaymentProfile(env,b){const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');const value={bankName:String(b.bankName||'').trim(),bankCode:String(b.bankCode||'').trim(),accountName:String(b.accountName||'').trim(),accountNumber:String(b.accountNumber||'').replace(/\s+/g,'').trim(),paymentNote:String(b.paymentNote||'').trim().slice(0,500)},now=nowIso(),rows=await dbGet(env,'platform_settings','setting_key=eq.platform_payment_profile&select=setting_key').catch(()=>[]);if(rows.length)await dbUpdate(env,'platform_settings','setting_key=eq.platform_payment_profile',{value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});else await dbInsert(env,'platform_settings',{setting_key:'platform_payment_profile',value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});await writeAuditLog(env,'platform',pay.email||'','platform_super_admin','save_platform_payment_profile','platform_settings','platform_payment_profile',null,{...value,accountNumber:value.accountNumber?`***${value.accountNumber.slice(-4)}`:''},{}).catch(()=>{});return jsonOk(value)}
async function startupCreditPolicy(env){const p=await getPlatformSetting(env,'startup_credit_policy',{enabled:true,amount:1000});return {enabled:p.enabled!==false,amount:Math.max(0,Math.round(safeNum(p.amount)))}}
async function grantStartupCreditIfEligible(env,T){const pol=await startupCreditPolicy(env);if(!pol.enabled||pol.amount<=0)return {granted:false,amount:0};const hit=await dbGet(env,'billing_logs',`tenant_id=eq.${encodeURIComponent(T)}&billing_type=eq.startup_credit_grant&status=eq.confirmed&select=id,amount`).catch(()=>[]);if(hit.length)return {granted:false,amount:safeNum(hit[0].amount),existing:true};await dbInsert(env,'billing_logs',{id:genId('BIL'),tenant_id:T,billing_type:'startup_credit_grant',amount:pol.amount,tax:0,total:pol.amount,status:'confirmed',confirmed_at:nowIso(),confirmed_by:'system_onboarding',period_start:nowIso(),period_end:null,note:'DOING æ–°ä¸»è¾¦å‰µæ¥­é‡‘',created_at:nowIso()});return {granted:true,amount:pol.amount}}
async function hGetStartupCreditPolicy(env,p){const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');return jsonOk(await startupCreditPolicy(env))}
async function hSaveStartupCreditPolicy(env,b){const pay=await verifyAdminJwt(b.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');const value={enabled:b.enabled!==false,amount:Math.max(0,Math.round(safeNum(b.amount)))},now=nowIso(),rows=await dbGet(env,'platform_settings',`setting_key=eq.startup_credit_policy&select=setting_key`).catch(()=>[]);if(rows.length)await dbUpdate(env,'platform_settings','setting_key=eq.startup_credit_policy',{value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});else await dbInsert(env,'platform_settings',{setting_key:'startup_credit_policy',value_json:JSON.stringify(value),updated_by:pay.email,updated_at:now});return jsonOk(value)}

async function grantCompletionRewardsForRegistration(env,T,r,s,u){
  if(!u||!r||!s||!isPaidStatus(r.payment_status)||!['å·²éŒ„å–','å®Œæˆ'].includes(String(r.review_status||'')))return;
  const mods=normalizeSessionModules(safeJson(u.modules_json,{}));if(mods.checkin&&String(r.checkin_status||'')!=='å·²å ±åˆ°')return;
  const rules=(await dbGet(env,'promotion_rules',`tenant_id=eq.${encodeURIComponent(T)}&active=eq.true&select=*`).catch(()=>[])).filter(x=>promotionScopeMatches(x,u.id,s.id)&&promotionTimeActive(x));
  const baseRules=rules.filter(x=>x.rule_type==='completion_reward'),bonusRules=rules.filter(x=>x.rule_type==='multi_session_bonus'),email=normEmail(r.email);
  for(const rule of baseRules){const amount=promotionDiscountValue(rule,safeNum(r.total_amount||r.amount));if(amount<=0)continue;try{await dbInsert(env,'reward_ledger',{id:genId('RWD'),tenant_id:T,member_email:email,operation_unit_id:u.id,session_id:s.id,registration_id:r.id,entry_type:'earn',amount,note:rule.name||'å®Œæˆä¸€å ´å›žé¥‹',source_rule_id:rule.id,created_by:'system',created_at:nowIso()})}catch(e){if(!String(e.message||'').toLowerCase().includes('duplicate'))logError(env,{source:'grantCompletionRewards',tenantId:T,regId:r.id,error:e})}}
  const earned=await dbGet(env,'reward_ledger',`tenant_id=eq.${encodeURIComponent(T)}&member_email=ilike.${encodeURIComponent(email)}&entry_type=eq.earn&select=registration_id`).catch(()=>[]),completedCount=new Set(earned.map(x=>x.registration_id).filter(Boolean)).size;
  for(const rule of bonusRules){const n=Math.max(1,parseInt(rule.every_n_sessions||0,10)||0);if(!n||completedCount===0||completedCount%n!==0)continue;const amount=promotionDiscountValue(rule,safeNum(r.total_amount||r.amount));if(amount<=0)continue;try{await dbInsert(env,'reward_ledger',{id:genId('RWD'),tenant_id:T,member_email:email,operation_unit_id:u.id,session_id:s.id,registration_id:r.id,entry_type:'bonus',amount,note:rule.name||`ç¬¬ ${completedCount} å ´åŠ ç¢¼`,source_rule_id:rule.id,created_by:'system',created_at:nowIso()})}catch(e){if(!String(e.message||'').toLowerCase().includes('duplicate'))logError(env,{source:'grantCompletionRewardsBonus',tenantId:T,regId:r.id,error:e})}}
}
async function cronGrantCompletedRewards(env){
  const sessions=await dbGet(env,'sessions','select=id,tenant_id,dates_json,modules_json').catch(()=>[]),now=Date.now();
  for(const s of sessions){const dates=_sessionDateRows(s.dates_json||[]);if(!dates.length)continue;const last=Math.max(...dates.map(d=>new Date(String(d.date)+'T23:59:59+08:00').getTime()).filter(Number.isFinite));if(!last||last>now)continue;const units=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(s.tenant_id)}&session_id=eq.${encodeURIComponent(s.id)}&select=*`).catch(()=>[]);if(!units.length)continue;const um=Object.fromEntries(units.map(u=>[u.id,u]));const regs=await dbGet(env,'registrations',`tenant_id=eq.${encodeURIComponent(s.tenant_id)}&session_id=eq.${encodeURIComponent(s.id)}&operation_unit_id=not.is.null&select=*`).catch(()=>[]);for(const r of regs){const u=um[r.operation_unit_id];if(u)await grantCompletionRewardsForRegistration(env,s.tenant_id,r,s,u)}}
}
async function callAutoTranslate(env,source){
  if(!env.OPENAI_API_KEY)throw new Error('å°šæœªè¨­å®š OPENAI_API_KEY');
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
  if(!resp.ok)throw new Error(j.error?.message||'è‡ªå‹•ç¿»è­¯æœå‹™å¤±æ•—');
  let text=String(j.output_text||'');if(!text&&Array.isArray(j.output))for(const o of j.output)for(const c of o.content||[])if(c.type==='output_text')text+=c.text||'';
  const data=safeJson(text,null);if(!data)throw new Error('è‡ªå‹•ç¿»è­¯å›žå‚³æ ¼å¼éŒ¯èª¤');return data;
}
async function hAutoTranslateSession(env,b){
  const T=b._tenantId;if(!await verifyStaff(env,b.email,b.token,T,'sessions',String(b.sessionId||'')))return jsonErr('ç„¡æ¬Šé™');
  const flags=await getTenantModuleFlags(env,T);if(flags.i18n===false)return jsonErr('å¤šèªžè¨€åŠŸèƒ½å°šæœªç”±å¹³å°æ ¸å‡†');
  const rows=await dbGet(env,'sessions',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(b.sessionId)}&select=*`);if(!rows.length)return jsonErr('æ‰¾ä¸åˆ°å ´æ¬¡');
  const s=rows[0],mods=normalizeSessionModules(safeJson(s.modules_json,{}));
  const result=await callAutoTranslate(env,{name:s.name||'',venue:s.venue||'',desc:s.description||'',agreementTitle:s.agreement_title||'',agreementContent:s.agreement_content||''});
  mods.i18n=mods.i18n||{};mods.i18n.enabled=true;mods.i18n.languages=['zh-TW','en','ja','ko'];mods.i18n.translations=mods.i18n.translations||{};
  for(const locale of ['en','ja','ko']){const old=mods.i18n.translations[locale]||{},inc=result[locale]||{};mods.i18n.translations[locale]={...old};for(const k of ['name','venue','desc','agreementTitle','agreementContent'])if(b.overwrite===true||!String(old[k]||'').trim())mods.i18n.translations[locale][k]=String(inc[k]||'')}
  await dbUpdate(env,'sessions',`tenant_id=eq.${T}&id=eq.${encodeURIComponent(s.id)}`,{modules_json:JSON.stringify(mods),updated_at:nowIso()});
  await syncSessionTranslations(env,T,{...s,modules_json:JSON.stringify(mods)});
  return jsonOk({success:true,translations:mods.i18n.translations});
}

async function hFrontBootstrap(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02ï¼štenant å·²ç”±è·¯ç”±å±¤é©—è­‰ï¼ˆè¦‹ routeGet/routePostï¼‰
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
  const TENANT = (p && p._tenantId) ;  // M-02ï¼štenant å·²ç”±è·¯ç”±å±¤é©—è­‰ï¼ˆè¦‹ routeGet/routePostï¼‰
  const rows = await dbGet(env, 'events', `tenant_id=eq.${TENANT}&status=neq.%E5%81%9C%E7%94%A8&select=*`);
  return jsonOk(rows.map(r=>({id:r.id,title:r.title,desc:r.description,location:r.location,cover:r.cover_url,status:r.status})));
}

// getSessions
async function hGetSessions(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02ï¼štenant å·²ç”±è·¯ç”±å±¤é©—è­‰ï¼ˆè¦‹ routeGet/routePostï¼‰
  let qs = `tenant_id=eq.${TENANT}&status=in.(å ±åä¸­,é–‹æ”¾ä¸­)&select=*`;
  if (p.eventId) qs += `&event_id=eq.${encodeURIComponent(p.eventId)}`;
  let rows = await dbGet(env, 'sessions', qs);
  const checks=await Promise.all(rows.map(async s=>({s,ok:(await operatingEntitlementActive(env,TENANT,s))||(await anyOpenUnitEntitled(env,TENANT,s.id))})));
  return jsonOk(checks.filter(x=>x.ok).map(x=>formatSession(x.s)));
}

// getSession
async function hGetSession(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02ï¼štenant å·²ç”±è·¯ç”±å±¤é©—è­‰ï¼ˆè¦‹ routeGet/routePostï¼‰
  const id = p.id || p.sessionId;
  if (!id) return jsonErr('è«‹æä¾› id');
  const rows = await dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(id)}&select=*`);
  if (!rows.length) return jsonErr('æ‰¾ä¸åˆ°å ´æ¬¡');
  if(['å ±åä¸­','é–‹æ”¾ä¸­','é–‹æ”¾'].includes(String(rows[0].status||'')) && !(await operatingEntitlementActive(env,TENANT,rows[0])) && !(await anyOpenUnitEntitled(env,TENANT,rows[0].id))){
    const staffOk=!!(p&&p.email&&p.token&&await verifyStaff(env,p.email,p.token,TENANT));
    if(!staffOk)return jsonErr('æ­¤å ´æ¬¡å°šæœªæ­£å¼é–‹æ”¾');
  }
  const hydrated=await hydrateNormalizedSession(env,TENANT,rows[0]);
  return jsonOk(formatSession(hydrated));
}

// getSessionAgreementï¼ˆå›žå‚³å ´æ¬¡åˆç´„è¨­å®šï¼Œä¾›å‰å° Modal é¡¯ç¤ºï¼‰
async function hGetSessionAgreement(env, p) {
  const TENANT = (p && p._tenantId);
  const id = p.id || p.sessionId;
  if (!id) return jsonErr('è«‹æä¾› id');
  const rows = await dbGet(env, 'sessions',
    `tenant_id=eq.${TENANT}&id=eq.${encodeURIComponent(id)}&select=*`);
  if (!rows.length) return jsonErr('æ‰¾ä¸åˆ°å ´æ¬¡');
  const s = rows[0];
  const lang=String(p.lang||'zh-TW');
  const sessionMods=normalizeSessionModules(safeJson(s.modules_json,{}));
  let title = moduleTranslation(sessionMods,lang,'agreementTitle',s.agreement_title || 'å ±ååˆç´„ï¼æ´»å‹•ç´°å‰‡èˆ‡æ”¤å•†è¦ç¯„');
  let content = moduleTranslation(sessionMods,lang,'agreementContent',s.agreement_content || '');
  let version = s.agreement_version || '';
  let updatedAt = s.agreement_updated_at || null;

  // Aâ†’Z é˜»æ–·ä¿®æ­£ï¼šè‹¥å ´æ¬¡å°šæœªå¥—ç”¨åˆç´„æ­£æ–‡ï¼Œä½†å¾Œå°å·²æœ‰ã€Œé è¨­åˆç´„ç¯„æœ¬ã€ï¼Œ
  // å‰å°ä»è¦èƒ½è®€åˆ°åˆç´„ï¼Œé¿å…å ±åè€…å¡åœ¨ã€Œç„¡æ³•è¼‰å…¥åˆç´„å…§å®¹ã€ã€‚
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

// member lookup helpersï¼ˆå‰å°æœƒå“¡ä»¥ tenant_id + email ç‚ºä¸»ï¼Œphone ç‚ºæŸ¥æ‰¾è¼”åŠ©ï¼‰
function normEmail(v){ return String(v||'').trim().toLowerCase(); }
// æ‰‹æ©Ÿæ¯”å°ä¿®æ­£ï¼šè³‡æ–™åº«å¯èƒ½å­˜ 0955 / 886955 / +886955 / 955 ç­‰æ ¼å¼ï¼Œ
// å‰å°æŸ¥è©¢æ™‚è¦è¦–ç‚ºåŒä¸€æ”¯æ‰‹æ©Ÿï¼Œä¸å¯ç”¨å®Œå…¨ç›¸åŒå­—ä¸²å°Žè‡´ã€Œæœƒå“¡ç´€éŒ„æ¶ˆå¤±ã€ã€‚
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
// â”€â”€ åš´æ ¼èº«ä»½é©—è­‰ï¼šEmailï¼‹æ‰‹æ©Ÿå¿…é ˆæˆå°ç›¸ç¬¦ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// findMemberByEmailOrPhone æ˜¯ã€Œç›¡é‡æ‰¾åˆ°äººã€çš„å¯¬é¬†æŸ¥æ‰¾ï¼ˆåƒ…ä¾› getMyRegs å…§éƒ¨æ¯”å°ç”¨ï¼‰ï¼Œ
// ä¸å¯æ‹¿ä¾†ç•¶æ¬Šé™åˆ¤æ–·ã€‚å‡¡æ˜¯æœƒåå‡ºå€‹è³‡ã€æˆ–æœƒæ”¹å‹•æ­£å¼è³‡æ–™çš„ APIï¼Œä¸€å¾‹èµ°ä¸‹é¢å…©å€‹å‡½å¼ã€‚
async function findVerifiedMemberByEmailPhone(env, tenantId, email, phone){
  const e = normEmail(email);
  const ph = normPhone(phone);
  if (!e || !ph) return null;
  // members å·²æœ‰æ­¤ Email æ™‚ï¼Œåªèƒ½ç”¨ members ç›®å‰çš„æ‰‹æ©Ÿé©—è­‰ï¼Œ
  // ä¸å¾—é€€å›žèˆŠ registrations ç¹žéŽï¼ˆå¦å‰‡æ”¹éŽæ‰‹æ©Ÿçš„äººï¼ŒèˆŠæ‰‹æ©Ÿé‚„èƒ½ç™»å…¥ï¼‰ã€‚
  const members = await dbGet(env, 'members', `tenant_id=eq.${tenantId}&email=ilike.${encodeURIComponent(e)}&select=*`).catch(()=>[]);
  if (members.length) {
    const m = members[0];
    return phoneMatches(m.phone, ph) ? {...m, _source:'members'} : null;
  }
  // å°šæœªå»ºç«‹ members çš„äººï¼Œæ‰å…è¨±ç”¨æ­·å²å ±åç´€éŒ„çš„ Emailï¼‹æ‰‹æ©Ÿé…å°ã€‚
  const regs = await dbGet(env, 'registrations', `tenant_id=eq.${tenantId}&email=ilike.${encodeURIComponent(e)}&select=email,phone,name,brand_name,brand_intro,sell_category,sell_items,photo_url,fb_url,ig_url,tax_id,invoice_title,invoice_email,invoice_type,invoice_carrier,created_at&order=created_at.desc&limit=100`).catch(()=>[]);
  const found = regs.find(r => phoneMatches(r.phone, ph));
  return found ? {...found, _source:'registrations'} : null;
}
// å ±åæ‰€æœ‰æ¬Šï¼šä»¥ registrations é€™ç­†æœ¬èº«çš„ emailï¼‹phone é©—è­‰ï¼Œå…©è€…éƒ½å¿…é ˆç›¸ç¬¦ã€‚
function isRegistrationOwner(reg, email, phone){
  if (!reg) return false;
  const e = normEmail(email);
  const ph = normPhone(phone);
  if (!e || !ph) return false;
  return normEmail(reg.email) === e && phoneMatches(reg.phone, ph);
}
// æ‰€æœ‰ã€Œæœƒæ”¹å‹•æ­£å¼è³‡æ–™ã€çš„æ”¤å‹ç«¯ API å…±ç”¨é€™ä¸€é“é—œå¡ï¼ˆå–®ä¸€ä¾†æºï¼Œä¸å„å¯«å„çš„ï¼‰ã€‚
function regOwnerGuard(reg, b, actionLabel){
  if (!b || !b.email || !b.phone) return jsonErr('è«‹å…ˆä»¥ Email èˆ‡æ‰‹æ©Ÿå®Œæˆèº«ä»½é©—è­‰');
  if (!isRegistrationOwner(reg, b.email, b.phone)) return jsonErr('ç„¡æ¬Šé™' + actionLabel + 'æ­¤å ±å');
  return null;
}

// æ–°ç‰ˆæœƒå“¡å ±åä»¥ LINE æœƒå“¡ Token é©—è­‰ï¼›æœªå›žç¶æœƒå“¡ ID çš„æ­·å²å ±åä¿ç•™èˆŠé©—è­‰ã€‚
async function verifiedRegOwnerGuard(env, reg, b, actionLabel){
  const memberId=String(reg&&reg.platform_member_id||'').trim();
  if(!memberId)return regOwnerGuard(reg,b,actionLabel);
  const verified=await verifiedPlatformMember(env,b&&(b.member_token||b.memberToken));
  if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥');
  if(String(verified.row&&verified.row.id||'').trim()!==memberId)return jsonErr('ç„¡æ¬Šé™'+actionLabel+'æ­¤å ±å');
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
// å ±åå‰é æª¢ï¼šé€™å€‹ Email æ˜¯å¦å·²æœ‰æœƒå“¡ã€æ‰‹æ©Ÿæ˜¯å¦ä¸€è‡´ã€‚
// åªå›žå‚³å…©å€‹å¸ƒæž—å€¼ï¼Œä¸åä»»ä½•å€‹è³‡ï¼Œç”¨ä¾†æå‰æ“‹ä¸‹ã€Œå¡«å®Œæ•´å¼µè¡¨æ‰è¢«æ‹’ã€çš„æ­»è·¯ã€‚
async function hCheckMemberEmailPhone(env, p) {
  const TENANT = (p && p._tenantId);
  if (!TENANT) return jsonErr('ç„¡æ³•è¾¨è­˜ä¸»è¾¦ç©ºé–“');
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
  const TENANT = (p && p._tenantId) ;  // M-02ï¼štenant å·²ç”±è·¯ç”±å±¤é©—è­‰ï¼ˆè¦‹ routeGet/routePostï¼‰
  const email = normEmail(p && p.email);
  const phone = normPhone(p && p.phone);
  // B-01ï¼šåªçµ¦ Email å°±æ’ˆå¾—åˆ°å§“åï¼æ‰‹æ©Ÿï¼çµ±ç·¨ï¼ç™¼ç¥¨ä¿¡ç®±ï¼å€‹è³‡å¤–æ´©ã€‚å¿…é ˆæˆå°é©—è­‰ã€‚
  if (!email || !phone) return jsonErr('è«‹æä¾› Email èˆ‡æ‰‹æ©Ÿ');
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

// â”€â”€ æœƒå“¡ï¼å“ç‰Œï¼å ±åå”ä½œæ¨¡åž‹ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// å“ç‰Œåç¨±åªåšå€™é¸æ¯”å°ï¼Œä¸æ˜¯èº«åˆ†è­‰æ˜Žï¼›åŒåå“ç‰Œå¯ä¸¦å­˜ï¼Œå¿…é ˆç”±æœƒå“¡æ˜Žç¢ºé¸æ“‡ã€‚
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
  if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥',401);
  const memberId=String(verified.row.id||''),links=await activeBrandMemberships(env,memberId,{includePending:true});
  const requests=await dbGet(env,'brand_access_requests',`platform_member_id=eq.${encodeURIComponent(memberId)}&select=*&order=created_at.desc&limit=50`).catch(()=>[]);
  return jsonOk({brands:links.map(x=>brandMembershipPayload(x.membership,x.brand)),requests:requests.map(x=>({id:x.id,brandId:x.brand_id,status:x.status,requestType:x.request_type,requestedRole:x.requested_role,note:x.note||'',createdAt:x.created_at||'',resolvedAt:x.resolved_at||''}))});
}

async function hMatchBrandCandidates(env,p){
  const verified=await verifiedPlatformMember(env,p.member_token||p.memberToken||p.token);
  if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥',401);
  const name=String(p.brandName||p.brand_name||p.name||'').trim();if(!name)return jsonOk({matches:[]});
  const rows=await exactBrandCandidates(env,name,String(verified.row.id||''));
  return jsonOk({matches:rows.map(x=>({id:x.id,name:x.display_name||'',category:x.category||'',company:x.company_name||'',profileUrl:x.profile_url||'',status:x.status||'active'})),rule:'å“ç‰ŒåŒååªæç¤ºï¼Œä¸æœƒè‡ªå‹•åˆä½µæœƒå“¡æˆ–å“ç‰Œ'});
}

async function syncPrimaryBrandSnapshot(env,memberId,brand){
  if(!brand)return;
  const vendorJson={brandId:brand.id||'',brandName:brand.display_name||'',brandIntro:brand.intro||'',category:brand.category||'',items:brand.items||'',facebook:brand.facebook_url||'',instagram:brand.instagram_url||'',photoUrl:brand.profile_url||'',company:brand.company_name||'',taxId:brand.tax_id||''};
  await dbUpdate(env,'platform_members',`id=eq.${encodeURIComponent(memberId)}`,{vendor_json:vendorJson,updated_at:nowIso()});
}

async function hSaveMemberBrand(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);
  if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥',401);
  const memberId=String(verified.row.id||''),data=b.brand&&typeof b.brand==='object'?b.brand:b;
  const name=String(data.displayName||data.brandName||data.name||'').trim(),key=normalizeBrandName(name);
  if(!name||!key)return jsonErr('è«‹å¡«å¯«å“ç‰Œåç¨±');
  const allowed=['é¤é£²ç¾Žé£Ÿ','æ‰‹ä½œè¨­è¨ˆ','æ–‡å‰µé¸ç‰©','æœé£¾é…ä»¶','ç”Ÿæ´»ç”¨å“','è¦ªå­å…’ç«¥','å¯µç‰©ç›¸é—œ','æ”¶è—å¨›æ¨‚','ç¾Žé¡ž','ç¾Žæ¥­æœå‹™','é«”é©—ï¼æœå‹™','å…¶ä»–'];
  const category=String(data.category||'').trim();if(category&&!allowed.includes(category))return jsonErr('è«‹é‡æ–°é¸æ“‡æ­£å¼å“ç‰Œé¡žåˆ¥');
  const values={display_name:name,normalized_name:key,category,intro:String(data.intro||data.brandIntro||'').trim(),items:String(data.items||'').trim(),facebook_url:String(data.facebook||'').trim(),instagram_url:String(data.instagram||'').trim(),profile_url:String(data.photoUrl||data.profileUrl||'').trim(),company_name:String(data.company||data.companyName||'').trim(),tax_id:String(data.taxId||'').trim(),updated_at:nowIso()};
  const brandId=String(data.brandId||b.brandId||'').trim();
  if(brandId){
    const links=await dbGet(env,'brand_members',`brand_id=eq.${encodeURIComponent(brandId)}&platform_member_id=eq.${encodeURIComponent(memberId)}&status=eq.active&select=*`).catch(()=>[]),link=links[0];
    if(!link||!['owner','manager'].includes(String(link.role||''))||safeJson(link.permissions_json,{}).edit_brand===false)return jsonErr('ä½ æ²’æœ‰ç·¨è¼¯é€™å€‹å“ç‰Œçš„æ¬Šé™',403);
    await dbUpdate(env,'brands',`id=eq.${encodeURIComponent(brandId)}&status=neq.merged`,values);
    const brand={id:brandId,...values};await syncPrimaryBrandSnapshot(env,memberId,brand);
    return jsonOk({ok:true,brand:brandMembershipPayload(link,brand),updated:true});
  }
  const candidates=await exactBrandCandidates(env,name,memberId),resolution=String(b.resolution||data.resolution||'').trim();
  if(candidates.length&&!resolution)return jsonOk({needsResolution:true,matches:candidates.map(x=>({id:x.id,name:x.display_name||'',category:x.category||'',company:x.company_name||'',profileUrl:x.profile_url||''})),message:'ç³»çµ±æ‰¾åˆ°å¯èƒ½ç›¸åŒçš„å“ç‰Œï¼Œè«‹ç¢ºèªä¸€æ¬¡å³å¯'});
  if(candidates.length&&resolution==='join'){
    const target=String(b.candidateBrandId||data.candidateBrandId||candidates[0].id),candidate=candidates.find(x=>String(x.id)===target);
    if(!candidate)return jsonErr('è«‹é‡æ–°é¸æ“‡è¦åŠ å…¥çš„å“ç‰Œ');
    const requestType='brand_member',requestId=genId('BAR'),now=nowIso();
    const existing=await dbGet(env,'brand_access_requests',`brand_id=eq.${encodeURIComponent(target)}&platform_member_id=eq.${encodeURIComponent(memberId)}&request_type=eq.${requestType}&status=eq.pending&select=*`).catch(()=>[]);
    if(!existing[0])await dbInsert(env,'brand_access_requests',{id:requestId,brand_id:target,platform_member_id:memberId,request_type:requestType,status:'pending',requested_role:'member',note:String(b.note||data.note||'').trim(),created_at:now,updated_at:now});
    if(requestType==='brand_member'){
      const links=await dbGet(env,'brand_members',`brand_id=eq.${encodeURIComponent(target)}&platform_member_id=eq.${encodeURIComponent(memberId)}&select=*`).catch(()=>[]);
      if(!links[0])await dbInsert(env,'brand_members',{id:genId('BM'),brand_id:target,platform_member_id:memberId,role:'member',status:'pending',permissions_json:{},invited_by_member_id:null,joined_at:null,created_at:now,updated_at:now});
    }
    return jsonOk({ok:true,pendingApproval:true,brandId:target,message:'å·²é€å‡ºåŠ å…¥å“ç‰Œç”³è«‹ï¼Œå“ç‰Œç®¡ç†è€…ç¢ºèªå¾Œå³å¯å…±åŒç®¡ç†'});
  }
  if(candidates.length&&resolution!=='separate')return jsonErr('è«‹ç¢ºèªä½ èˆ‡åŒåå“ç‰Œçš„é—œä¿‚');
  if(candidates.length&&resolution==='separate'){
    const distinguish=String(b.distinguishingInfo||data.distinguishingInfo||values.company_name||values.profile_url||'').trim();
    if(!distinguish)return jsonErr('åŒåä½†ä¸åŒå“ç‰Œæ™‚ï¼Œè«‹è£œå……åœ°å€ã€å…¬å¸åç¨±æˆ–ä»‹ç´¹ç¶²å€ï¼Œé¿å…å¾Œå°å†æ¬¡èª¤åˆ¤');
    values.intro=[values.intro,`è¾¨è­˜è³‡è¨Šï¼š${distinguish}`].filter(Boolean).join('\n');
  }
  const id=genId('BRD'),now=nowIso(),brand={id,...values,status:'active',created_by_member_id:memberId,created_at:now,updated_at:now};
  await dbInsert(env,'brands',brand);
  const link={id:genId('BM'),brand_id:id,platform_member_id:memberId,role:'owner',status:'active',permissions_json:brandOwnerPermissions(),invited_by_member_id:memberId,joined_at:now,created_at:now,updated_at:now};
  try{await dbInsert(env,'brand_members',link)}catch(e){await dbDelete(env,'brands',`id=eq.${encodeURIComponent(id)}`).catch(()=>{});throw e}
  await syncPrimaryBrandSnapshot(env,memberId,brand);
  return jsonOk({ok:true,created:true,brand:brandMembershipPayload(link,brand)});
}

async function hGetBrandAccessRequests(env,p){
  const verified=await verifiedPlatformMember(env,p.member_token||p.memberToken||p.token);if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆ',401);
  const memberId=String(verified.row.id||''),links=await activeBrandMemberships(env,memberId),managed=links.filter(x=>['owner','manager'].includes(String(x.membership.role||''))&&safeJson(x.membership.permissions_json,{}).manage_members!==false);
  const brandIds=managed.map(x=>String(x.brand.id||''));if(!brandIds.length)return jsonOk([]);
  const rows=await dbGet(env,'brand_access_requests',`brand_id=in.(${brandIds.map(x=>'"'+x.replace(/"/g,'')+'"').join(',')})&status=eq.pending&select=*&order=created_at.asc`).catch(()=>[]),memberIds=[...new Set(rows.map(x=>String(x.platform_member_id||'')).filter(Boolean))];
  const members=memberIds.length?await dbGet(env,'platform_members',`id=in.(${memberIds.map(x=>'"'+x.replace(/"/g,'')+'"').join(',')})&select=id,name,display_name`).catch(()=>[]):[],mm=Object.fromEntries(members.map(x=>[String(x.id),x]));
  return jsonOk(rows.map(x=>({id:x.id,brandId:x.brand_id,memberId:x.platform_member_id,memberName:mm[x.platform_member_id]?.name||mm[x.platform_member_id]?.display_name||'DOING æœƒå“¡',requestType:x.request_type,requestedRole:x.requested_role,note:x.note||'',createdAt:x.created_at||''})));
}

async function hResolveBrandAccessRequest(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆ',401);
  const memberId=String(verified.row.id||''),requestId=String(b.requestId||b.id||''),approved=b.approved===true||b.approved==='true';
  const rows=await dbGet(env,'brand_access_requests',`id=eq.${encodeURIComponent(requestId)}&status=eq.pending&select=*`).catch(()=>[]),req=rows[0];if(!req)return jsonErr('æ‰¾ä¸åˆ°å¾…è™•ç†ç”³è«‹');
  const links=await dbGet(env,'brand_members',`brand_id=eq.${encodeURIComponent(req.brand_id)}&platform_member_id=eq.${encodeURIComponent(memberId)}&status=eq.active&select=*`).catch(()=>[]),link=links[0];
  if(!link||!['owner','manager'].includes(String(link.role||''))||safeJson(link.permissions_json,{}).manage_members===false)return jsonErr('ä½ æ²’æœ‰ç®¡ç†é€™å€‹å“ç‰Œæˆå“¡çš„æ¬Šé™',403);
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
  if(requested){const found=links.find(x=>String(x.brand.id)===requested);if(!found)return {error:'ä½ ç›®å‰æ²’æœ‰ä½¿ç”¨é€™å€‹å“ç‰Œå ±åçš„æ¬Šé™'};if(safeJson(found.membership.permissions_json,{}).submit_registration===false)return {error:'ä½ å¯ä»¥æŸ¥çœ‹é€™å€‹å“ç‰Œï¼Œä½†å°šæœªå–å¾—é€å‡ºå ±åçš„æ¬Šé™'};return {brandId:requested,brand:found.brand}}
  const key=normalizeBrandName(name),own=links.filter(x=>normalizeBrandName(x.brand.display_name)===key);
  if(own.length===1){if(safeJson(own[0].membership.permissions_json,{}).submit_registration===false)return {error:'ä½ å¯ä»¥æŸ¥çœ‹é€™å€‹å“ç‰Œï¼Œä½†å°šæœªå–å¾—é€å‡ºå ±åçš„æ¬Šé™'};return {brandId:own[0].brand.id,brand:own[0].brand}}
  if(own.length>1)return {error:'ä½ æœ‰å¤šå€‹åŒåå“ç‰Œï¼Œè«‹å…ˆåˆ°ã€Œæˆ‘çš„ DOINGã€é¸æ“‡æ­£ç¢ºå“ç‰Œ'};
  const candidates=await exactBrandCandidates(env,name,memberId);
  if(candidates.length)return {error:'ç³»çµ±æ‰¾åˆ°åŒåå“ç‰Œã€‚è«‹å…ˆåˆ°ã€Œæˆ‘çš„ DOINGã€ç¢ºèªæ˜¯åŠ å…¥æ—¢æœ‰å“ç‰Œï¼Œæˆ–å»ºç«‹åŒåä½†ä¸åŒçš„å“ç‰Œï¼›ä¸æœƒè‡ªå‹•åˆä½µ'};
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
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆ',401);
  const memberId=String(verified.row.id||''),regId=String(b.registrationId||b.regId||''),membership=await registrationMembership(env,regId,memberId);
  if(!membership||safeJson(membership.permissions_json,{}).invite_team!==true)return jsonErr('åªæœ‰å ±åé€å‡ºè€…æˆ–è¢«æŽˆæ¬Šç®¡ç†è€…å¯ä»¥é‚€è«‹å‡ºæ”¤å¤¥ä¼´',403);
  const regs=await dbGet(env,'registrations',`id=eq.${encodeURIComponent(regId)}&select=id,tenant_id,brand_id,review_status,transfer_status`).catch(()=>[]),reg=regs[0];if(!reg)return jsonErr('æ‰¾ä¸åˆ°å ±å');
  if(['å·²å–æ¶ˆ','ä¸éŒ„å–'].includes(String(reg.review_status||''))||['å·²é€€è²»','å·²é€€æ¬¾'].includes(String(reg.transfer_status||'')))return jsonErr('å·²çµæŸçš„å ±åä¸èƒ½å†é‚€è«‹å‡ºæ”¤å¤¥ä¼´');
  const role=String(b.role||'onsite_representative');if(!['onsite_representative','assistant'].includes(role))return jsonErr('é‚€è«‹è§’è‰²ä¸æ­£ç¢º');
  const now=nowIso(),id=genId('RMI'),expires=new Date(Date.now()+7*24*60*60*1000).toISOString(),invite={id,tenant_id:reg.tenant_id,registration_id:reg.id,brand_id:reg.brand_id||null,role,status:'pending',invited_by_member_id:memberId,accepted_by_member_id:null,expires_at:expires,accepted_at:null,revoked_at:null,created_at:now,updated_at:now};
  await dbInsert(env,'registration_member_invites',invite);const token=await issueRegistrationInviteToken(env,invite);
  return jsonOk({ok:true,inviteId:id,url:registrationInviteUrl(env,token),expiresAt:expires,message:'æŠŠé€£çµå‚³çµ¦å¯¦éš›å‡ºæ”¤è€…ï¼›å°æ–¹ç”¨è‡ªå·±çš„ LINE æŽ¥å—å¾Œï¼Œå°±èƒ½å ±åˆ°èˆ‡ç”³è«‹æ’¤å ´'});
}

async function hAcceptRegistrationMemberInvite(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);if(!verified)return jsonErr('è«‹å…ˆä½¿ç”¨è‡ªå·±çš„ LINE ç™»å…¥ï¼Œå†æŽ¥å—å‡ºæ”¤é‚€è«‹',401);
  const token=await verifyRegistrationInviteToken(env,b.invite_token||b.inviteToken||b.registration_invite);if(!token)return jsonErr('å‡ºæ”¤é‚€è«‹å·²å¤±æ•ˆï¼Œè«‹å ±åäººé‡æ–°åˆ†äº«',400);
  const result=await dbRpc(env,'accept_registration_member_invite_atomic',{p_invite_id:String(token.invite_id),p_member_id:String(verified.row.id||''),p_now:nowIso()}).catch(e=>({ok:false,error:e&&e.message?e.message:'æŽ¥å—é‚€è«‹å¤±æ•—'}));
  if(!result||result.ok===false)return jsonErr(result?.error||'å‡ºæ”¤é‚€è«‹å·²å¤±æ•ˆï¼Œè«‹å ±åäººé‡æ–°åˆ†äº«',409);
  return jsonOk({ok:true,accepted:true,alreadyAccepted:!!result.alreadyAccepted,registrationId:result.registrationId||token.registration_id,message:result.alreadyAccepted?'ä½ å·²ç¶“åŠ å…¥é€™ç­†æ´»å‹•':'å·²åŠ å…¥é€™ç­†æ´»å‹•ï¼›ä½ å¯ä»¥æŸ¥çœ‹ä½ç½®ã€è¨­å‚™ã€å ±åˆ°èˆ‡ç”³è«‹æ’¤å ´'});
}

async function hGetRegistrationTeam(env,p){
  const verified=await verifiedPlatformMember(env,p.member_token||p.memberToken||p.token);if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆ',401);
  const regId=String(p.registrationId||p.regId||''),memberId=String(verified.row.id||''),self=await registrationMembership(env,regId,memberId);if(!self)return jsonErr('ä½ ä¸æ˜¯é€™ç­†å ±åçš„æˆå“¡',403);
  const rows=await dbGet(env,'registration_members',`registration_id=eq.${encodeURIComponent(regId)}&status=eq.active&select=*&order=created_at.asc`).catch(()=>[]),ids=[...new Set(rows.map(x=>String(x.platform_member_id||'')).filter(Boolean))];
  const members=ids.length?await dbGet(env,'platform_members',`id=in.(${ids.map(x=>'"'+x.replace(/"/g,'')+'"').join(',')})&select=id,name,display_name`).catch(()=>[]):[],mm=Object.fromEntries(members.map(x=>[String(x.id),x]));
  return jsonOk(rows.map(x=>({memberId:x.platform_member_id,name:mm[x.platform_member_id]?.name||mm[x.platform_member_id]?.display_name||'DOING æœƒå“¡',role:x.role,status:x.status,permissions:safeJson(x.permissions_json,{}),isMe:String(x.platform_member_id)===memberId})));
}

async function hMemberOnsiteAction(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.memberToken||b.token);if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆ',401);
  const regId=String(b.registrationId||b.regId||''),memberId=String(verified.row.id||''),membership=await registrationMembership(env,regId,memberId);if(!membership)return jsonErr('ä½ ä¸æ˜¯é€™ç­†å ±åçš„ç¾å ´äººå“¡',403);
  const perms=safeJson(membership.permissions_json,{}),action=String(b.onsiteAction||b.mode||'');
  const rows=await dbGet(env,'registrations',`id=eq.${encodeURIComponent(regId)}&select=*`).catch(()=>[]),reg=rows[0];if(!reg)return jsonErr('æ‰¾ä¸åˆ°å ±å');
  const now=nowIso(),operator=verified.row.name||verified.row.display_name||memberId;
  if(action==='checkin'){
    if(perms.checkin!==true)return jsonErr('ä½ æ²’æœ‰é€™ç­†å ±åçš„å ±åˆ°æ¬Šé™',403);const err=checkinGuard(reg,false);if(err)return jsonErr(err);
    if(String(reg.checkin_status)==='å·²å ±åˆ°')return jsonOk({ok:true,alreadyDone:true,status:'å·²å ±åˆ°',at:reg.checkin_at||''});
    await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(regId)}&tenant_id=eq.${encodeURIComponent(reg.tenant_id)}`,checkinData(false,now));
    await dbInsert(env,'seat_operation_logs',{id:genId('OPL'),tenant_id:reg.tenant_id,session_id:reg.session_id||null,registration_id:regId,stall_id:null,action:'participant_checkin',operator_type:'participant',operator_id:operator,note:'member:'+memberId,created_at:now}).catch(()=>{});
    return jsonOk({ok:true,status:'å·²å ±åˆ°',at:now});
  }
  if(action==='request_teardown'){
    if(perms.request_teardown!==true)return jsonErr('ä½ æ²’æœ‰é€™ç­†å ±åçš„æ’¤å ´æ¬Šé™',403);if(String(reg.checkin_status)!=='å·²å ±åˆ°')return jsonErr('å°šæœªå®Œæˆå ±åˆ°ï¼Œä¸èƒ½ç”³è«‹æ’¤å ´');
    if(String(reg.teardown_status)==='å·²ç”³è«‹æ’¤å ´'||String(reg.clear_status)==='å·²æ¸…å ´')return jsonOk({ok:true,alreadyDone:true,status:reg.clear_status==='å·²æ¸…å ´'?'å·²æ¸…å ´':'å·²ç”³è«‹æ’¤å ´'});
    await dbUpdate(env,'registrations',`id=eq.${encodeURIComponent(regId)}&tenant_id=eq.${encodeURIComponent(reg.tenant_id)}`,{teardown_status:'å·²ç”³è«‹æ’¤å ´',updated_at:now});
    await dbInsert(env,'seat_operation_logs',{id:genId('OPL'),tenant_id:reg.tenant_id,session_id:reg.session_id||null,registration_id:regId,stall_id:null,action:'participant_teardown_request',operator_type:'participant',operator_id:operator,note:'member:'+memberId,created_at:now}).catch(()=>{});
    return jsonOk({ok:true,status:'å·²ç”³è«‹æ’¤å ´',at:now});
  }
  return jsonErr('æœªçŸ¥çš„ç¾å ´æ“ä½œ');
}

async function hGetPlatformMemberProfile(env,p){
  const verified=await verifiedPlatformMember(env,p.member_token||p.token);
  if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ç™»å…¥');
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
  return jsonOk({profile:{id:memberId,email,name:verified.row.name||verified.row.display_name||'',phone:verified.row.phone||'',lineId:verified.row.line_id||'',city:verified.row.city||'',primaryBrandId:primary?.id||v.brandId||'',brand:brandName,brand_name:brandName,brandIntro,sellCat:brandCategory,sellItem:brandItems,fb:primary?.facebook||v.facebook||'',ig:primary?.instagram||v.instagram||'',photo:primary?.photoUrl||v.photoUrl||'',company:primary?.company||v.company||'',taxId:primary?.taxId||v.taxId||''},brands,complete:platformMemberComplete(verified.row),provider:verified.row._identity?.provider||'',linkedProviders:[...new Set(identities.map(x=>String(x.provider||'')).filter(Boolean))],roles,platformAccess:platformStaff?{role:'platform_super_admin',name:platformStaff.name||'DOING å¹³å°ç¸½ç®¡ç†è€…'}:null,applications:applications.map(x=>{const a=safeJson(x.application_json,{});return{id:x.id,unitName:a.unitName||x.brand_name||'',industryCategories:Array.isArray(a.industryCategories)?a.industryCategories:[],useCases:Array.isArray(a.useCases)?a.useCases:[],status:x.status||'pending',createdAt:x.created_at||'',approvedAt:x.approved_at||a.approvedAt||'',supplementRequestedAt:x.supplement_requested_at||a.supplementRequestedAt||'',supplementSubmittedAt:x.supplement_submitted_at||a.supplementSubmittedAt||'',rejectedAt:x.rejected_at||a.rejectedAt||'',tenantId:x.tenant_id||'',timeline:Array.isArray(a.timeline)?a.timeline:[]}}),workspaces:workspaces.map(x=>({id:x.tenant_id||x.id,name:x.name||x.tenant_id||x.id,role:x.role||'',isLocked:!!x.is_locked,lockedReason:x.locked_reason||''}))});
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
  // æ‰‹æ©Ÿç›®å‰åªæ˜¯è¯çµ¡ï¼é¢¨éšªæç¤ºè³‡æ–™ï¼Œå°šæœªåš SMS OTPï¼Œä¸èƒ½æ“šæ­¤åˆä½µæœƒå“¡ã€æŽˆæ¬Šæˆ–é˜»æ“‹ç™»å…¥ã€‚
  // ä¾‹å¦‚å¤«å¦»å¯èƒ½å…±ç”¨è¯çµ¡é›»è©±ï¼›å…©å€‹ä¸åŒ LINE èº«åˆ†ä»å¿…é ˆä¿ç•™ç‚ºå…©ä½æœƒå“¡ã€‚
  return {found:emailMatch,emailMatch,phoneMatch,phoneVerified:false};
}

async function hSavePlatformMemberProfile(env,b){
  const verified=await verifiedPlatformMember(env,b.member_token||b.token);
  if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ç™»å…¥');
  const name=String(b.name||'').trim(),email=normEmail(b.email),phone=normPhone(b.phone);
  if(!name||!email||!phone)return jsonErr('å§“åã€Email èˆ‡æ‰‹æ©Ÿç‚ºå¿…å¡«');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return jsonErr('Email æ ¼å¼ä¸æ­£ç¢º');
  if(phone.length<9)return jsonErr('æ‰‹æ©Ÿæ ¼å¼ä¸æ­£ç¢º');
  const collision=await platformIdentityCollision(env,verified.row.id,email,phone);
  if(collision.found)return jsonErr('ç™»å…¥å·²æˆåŠŸï¼Œä½†é€™å€‹ Email å·²é€£çµæ—¢æœ‰ DOING å¸³è™Ÿã€‚è«‹å…ˆä½¿ç”¨åŽŸ LINEï¼Google ç™»å…¥ä¸¦é€£çµå¸³è™Ÿï¼›ç„¡æ³•ä½¿ç”¨èˆŠç™»å…¥æ™‚è«‹è¯çµ¡å¹³å°å”åŠ©ã€‚');
  const hasVendor=Object.prototype.hasOwnProperty.call(b,'vendor'),vendor=hasVendor&&b.vendor&&typeof b.vendor==='object'?b.vendor:safeJson(verified.row.vendor_json,{});
  const allowedVendorCategories=['é¤é£²ç¾Žé£Ÿ','æ‰‹ä½œè¨­è¨ˆ','æ–‡å‰µé¸ç‰©','æœé£¾é…ä»¶','ç”Ÿæ´»ç”¨å“','è¦ªå­å…’ç«¥','å¯µç‰©ç›¸é—œ','æ”¶è—å¨›æ¨‚','ç¾Žé¡ž','ç¾Žæ¥­æœå‹™','é«”é©—ï¼æœå‹™','å…¶ä»–'];
  const vendorCategory=String(vendor.category||'').trim();
  if(vendorCategory&&!allowedVendorCategories.includes(vendorCategory))return jsonErr('è«‹é‡æ–°é¸æ“‡æ­£å¼å“ç‰Œé¡žåˆ¥');
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
    if(!unitName||!industries.length||!useCases.length)return jsonErr('ç³»çµ±ç”³è«‹è«‹å®Œæ•´å¡«å¯«å–®ä½åç¨±ã€ç”¢æ¥­é¡žåˆ¥èˆ‡ä½¿ç”¨åŠŸèƒ½');
    const submittedAt=nowIso(),applicationJson={unitName,ownerName:name,phone,industryCategories:industries,useCases,publicLinks:[vendor.facebook,vendor.instagram,vendor.photoUrl].filter(Boolean),memberId:verified.row.id,loginProvider:verified.row._identity?.provider||'',createdAt:submittedAt,submittedAt,timeline:[{key:'application_created',label:'å»ºç«‹ç”³è«‹',at:submittedAt},{key:'application_submitted',label:'å·²é©—è­‰ä¸¦é€å‡º',at:submittedAt}]};
    const existing=await dbGet(env,'tenant_apply_logs',`contact_email=eq.${encodeURIComponent(email)}&brand_name=eq.${encodeURIComponent(unitName)}&status=in.(pending,supplement_required)&select=id`).catch(()=>[]);
    if(existing[0]){applicationId=existing[0].id;await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{contact_name:name,contact_phone:phone,event_type:useCases.join(','),application_json:applicationJson})}
    else{applicationId=genId('APL');await dbInsert(env,'tenant_apply_logs',{id:applicationId,brand_name:unitName,contact_name:name,contact_email:email,contact_phone:phone,event_type:useCases.join(','),plan_type:'review',note:'ç”±å·²é©—è­‰ DOING æœƒå“¡é€å‡º',status:'pending',application_json:applicationJson,created_at:submittedAt})}
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
  if(!verified||!platformMemberComplete(verified.row))return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥');
  const platformMemberId=String(verified.row.id||'').trim();
  const email=platformContactEmail(verified.row);
  if(!platformMemberId)return jsonErr('æ‰¾ä¸åˆ°æœƒå“¡è³‡æ–™ï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥');

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
      payMethod:r.payment_method||'', payLast5:r.payment_last5||'', checkin:r.checkin_status,teardownStatus:r.teardown_status||'æœªæ’¤å ´',clearStatus:r.clear_status||'æœªæ¸…å ´', createdAt:r.created_at, approvedAt:r.approved_at||'', paymentReportedAt:r.payment_reported_at||'', paidAt:r.paid_at||'', checkinAt:r.checkin_at||'',
      transferStatus:r.transfer_status||'', transferChosenAt:r.transfer_chosen_at||'', refundAmount:safeNum(r.refund_amount),
      refundAdminFee:safeNum(r.refund_admin_fee), refundTransferFee:safeNum(r.refund_transfer_fee), refundRuleLabel:r.refund_rule_label||'', refundedAt:r.refunded_at||'', refundNote:r.refund_note||'',
      forceStatus:r.force_status || (s.force_cancel ? (r.transfer_status==='ç”³è«‹é€€è²»'?'refund_requested':(r.transfer_status==='å·²å»¶æœŸ'?'transferred':'pending_force_choice')) : null),
      forceChoiceDeadline:s.force_cancel_deadline||'', forceCancelled:s.force_cancel||false, forceMode:s.force_cancel?'cancel':'', forceCancelReasonLabel:s.force_cancel_reason_label||'',
      forceTransferTargetSessionId:r.transferred_to_session_id||s.force_cancel_target_id||'', forceRefundRequestedAt:r.force_refund_requested_at||'', forceRefundedAt:r.force_refunded_at||'',
      agreementAccepted:r.agreement_accepted||false, agreementVersion:r.agreement_version||'',
      modules:normalizeSessionModules(u?safeJson(u.modules_json,{}):safeJson(s.modules_json,{})), rewardBalance:await rewardBalance(env,TENANT,email), rescheduleCount:safeNum(selectedModuleSnapshot(r).rescheduleCount), bookingPolicy:selectedModuleSnapshot(r).bookingPolicy||normalizeSessionModules(safeJson(s.modules_json,{})).bookingPolicy,
      paymentProfile:payPub, paymentProfileName:payPub.paymentProfileName, paymentOwnerMode:payPub.paymentOwnerMode,
      allowedPaymentMethods:payPub.allowedMethods, bankAccount:payPub.bankAccount, linepay:payPub.linepay, card:payPub.card,
    };
  })));
}
// getRegLookupï¼ˆä¿¡ä»¶æ·±é€£çµç”¨ï¼šä¾ regId åæŸ¥ emailï¼Œä¸ä¾è³´ç€è¦½å™¨æš«å­˜ï¼‰
// B-02ï¼šæœ¬ API åŽŸæœ¬å¯ç”¨ regId åæŸ¥ Emailï¼Œè€Œ regId åˆèƒ½ä¸²å–æ¶ˆï¼é¸ä½ï¼ä»˜æ¬¾ï¼é€€è²»ï¼Œ
// å½¢æˆå®Œæ•´æ”»æ“Šéˆã€‚å·²åœç”¨ï¼Œæ”¹ç”± Emailï¼‹æ‰‹æ©Ÿç™»å…¥ã€Œæˆ‘çš„ç´€éŒ„ã€å–å¾—è‡ªå·±çš„å ±åã€‚
async function hGetRegLookup(env, p) {
  return jsonErr('ç‚ºä¿è­·å€‹è³‡ï¼Œæ­¤æŸ¥è©¢å·²åœç”¨ã€‚è«‹ä½¿ç”¨ Emailï¼‹æ‰‹æ©Ÿç™»å…¥ã€Œæˆ‘çš„ç´€éŒ„ã€ã€‚');
}

// getAnnouncements
async function hGetAnnouncements(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02ï¼štenant å·²ç”±è·¯ç”±å±¤é©—è­‰ï¼ˆè¦‹ routeGet/routePostï¼‰
  const rows = await dbGet(env, 'announcements', `tenant_id=eq.${TENANT}&select=*&order=created_at.desc`);
  return jsonOk(rows.map(r=>({id:r.id,title:r.title,content:r.content,url:r.url,urlText:r.url_text,createdAt:r.created_at,paymentProfileId:r.payment_profile_id||'',paymentProfile:_paymentSnapshotPublic(safeJson(r.payment_profile_snapshot,null))})));
}

// â”€â”€ èˆŠ Google unified OAuth å·²åœç”¨ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// DOING ç¾è¡Œå…¬é–‹å…¥å£ä½¿ç”¨ LINEï¼›Google OAuth è·¯ç”±å®Œæ•´ä¿ç•™ä½†ä¸é¡¯ç¤ºã€‚
// ä¸‹æ–¹ staff/member è¼”åŠ©å‡½å¼ä¿ç•™ä¾›æ—¢æœ‰å…¶ä»–æµç¨‹ç›¸å®¹ã€‚

// è¼”åŠ©ï¼šæª¢æŸ¥æ˜¯å¦ç‚º staff
async function checkIsStaff(env, email, tenantId) {
  const platformRows = await dbGet(env, 'platform_staff', `email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=email`).catch(()=>[]);
  if (platformRows[0]) return true;
  const rows = await dbGet(env, 'staff', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}&select=email,is_active,active`).catch(()=>[]);
  if (!rows[0]) return false;
  const active = rows[0].is_active !== undefined ? rows[0].is_active : rows[0].active;
  return active !== false;
}

// è¼”åŠ©ï¼šæª¢æŸ¥æ˜¯å¦ç‚º member
async function checkIsMember(env, email, tenantId) {
  const rows = await dbGet(env, 'members', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}&select=email`).catch(()=>[]);
  return rows.length > 0;
}

// è¼”åŠ©ï¼šç”¨ email ç°½ç™¼ staff token
async function issueStaffTokenByEmail(env, email, tenantId) {
  const platformRows = await dbGet(env, 'platform_staff', `email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=*`).catch(()=>[]);
  if (platformRows[0]) return issueAdminToken({ ...platformRows[0], email }, 'platform', env);
  const rows = await dbGet(env, 'staff', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}&select=*`).catch(()=>[]);
  if (!rows[0]) throw new Error('staff not found');
  const active = rows[0].is_active !== undefined ? rows[0].is_active : rows[0].active;
  if (active === false) throw new Error('staff inactive');
  return issueAdminToken({ ...rows[0], email }, tenantId, env);
}

// è¼”åŠ©ï¼šæ›´æ–° staff æœ€å¾Œç™»å…¥
async function updateStaffLastLogin(env, email, tenantId, displayName) {
  await dbUpdate(env, 'staff', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}`,
    { last_login_at: new Date().toISOString(), display_name: displayName }).catch(()=>{});
}

// è¼”åŠ©ï¼šæ›´æ–° member æœ€å¾Œç™»å…¥ + Google è³‡æ–™
async function updateMemberLastLogin(env, email, tenantId, googleSub, displayName, avatarUrl) {
  const rows = await dbGet(env, 'members', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}&select=email`).catch(()=>[]);
  if (rows[0]) {
    await dbUpdate(env, 'members', `tenant_id=eq.${tenantId}&email=eq.${encodeURIComponent(email)}`,
      { last_login_at: new Date().toISOString(), google_sub: googleSub, display_name: displayName, avatar_url: avatarUrl, login_provider: 'google' }).catch(()=>{});
  } else {
    // æ–°æœƒå“¡ï¼šå»ºç«‹è¨˜éŒ„
    await dbInsert(env, 'members', {
      email, tenant_id: tenantId, google_sub: googleSub,
      display_name: displayName, avatar_url: avatarUrl,
      login_provider: 'google', last_login_at: new Date().toISOString(),
      joined_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).catch(()=>{});
  }
}

// â”€â”€ ç”³è«‹è©¦ç”¨ API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ç‡Ÿé‹å¸³è™Ÿç”³è«‹å…ˆå®Œæ•´å¯«å…¥è³‡æ–™åº«ï¼Œå†ä»¥ç”³è«‹ç·¨è™Ÿé€²è¡Œ LINE é©—è­‰ï¼›Google æµç¨‹ä¿ç•™ä½†ä¸å¾žå…¬é–‹å…¥å£è§¸ç™¼ã€‚
async function hCreateOrganizerApplicationDraft(env,b){
  const app=(b&&b.application&&typeof b.application==='object')?b.application:{};
  const unitName=String(app.unitName||'').trim(),ownerName=String(app.ownerName||'').trim(),phone=String(app.phone||'').trim(),contactEmail=normEmail(app.contactEmail||app.email||'');
  const industries=Array.isArray(app.industryCategories)?app.industryCategories.map(String).filter(Boolean).slice(0,20):[];
  const useCases=Array.isArray(app.useCases)?app.useCases.map(String).filter(Boolean).slice(0,20):[];
  const publicLinks=Array.isArray(app.publicLinks)?app.publicLinks.map(x=>String(x||'').trim()).filter(Boolean).slice(0,8):[];
  if(!unitName||!ownerName||!phone||!contactEmail)return jsonErr('ç‡Ÿé‹å–®ä½ã€å§“åã€Email èˆ‡è¯çµ¡é›»è©±ä¸å¯ç©ºç™½');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))return jsonErr('Email æ ¼å¼ä¸æ­£ç¢º');
  if(!industries.length)return jsonErr('è«‹è‡³å°‘é¸æ“‡ä¸€å€‹ç”¢æ¥­é¡žåˆ¥');
  if(!useCases.length)return jsonErr('è«‹è‡³å°‘é¸æ“‡ä¸€å€‹ DOING ä½¿ç”¨æƒ…å¢ƒ');
  if(!publicLinks.length&&app.noPublicLink!==true)return jsonErr('è«‹è‡³å°‘æä¾›ä¸€é …å…¬é–‹è³‡è¨Š');
  const confirmations=(app.confirmations&&typeof app.confirmations==='object')?app.confirmations:{};
  if(confirmations.confirmReal!==true||confirmations.confirmUse!==true||confirmations.confirmReview!==true)return jsonErr('è«‹å…ˆå®Œæˆé€å‡ºå‰ç¢ºèª');
  const id=genId('APL'),createdAt=nowIso();
  const applicationJson={...app,contactEmail,ownerName,contactName:ownerName,billingName:ownerName,industryCategories:industries,useCases,publicLinks,createdAt,timeline:[...(Array.isArray(app.timeline)?app.timeline:[]),{key:'application_created',label:'å»ºç«‹ç”³è«‹',at:createdAt}]};
  await dbInsert(env,'tenant_apply_logs',{
    id,brand_name:unitName,contact_name:ownerName,contact_email:contactEmail,contact_phone:phone,
    event_type:useCases.join(','),plan_type:'review',note:'ç­‰å¾… LINE é©—è­‰',status:'line_verification_pending',application_json:applicationJson,created_at:createdAt
  });
  return jsonOk({ok:true,applicationId:id});
}

// ä¸»è¾¦ç”³è«‹ç‚ºã€ŒLINE é©—è­‰å¾Œé€å¯©ã€ï¼Œå¯©æ ¸é€šéŽæ‰å»ºç«‹ Tenant / Owner / å‰µæ¥­é‡‘ï¼›Google é©—è­‰ç¨‹å¼ä¿ç•™å‚™ç”¨ã€‚
async function hApplyTrial(env,b){
  const brand=String(b.brand_name||'').trim(),contact=String(b.contact_name||'').trim(),email=normEmail(b.contact_email||''),phone=String(b.contact_phone||'').trim();
  if(!brand||!contact||!email||!phone)return jsonErr('ä¸»è¾¦åŸºæœ¬è³‡æ–™ä¸å®Œæ•´');
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
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™',401);
  const applyId=String(b.apply_id||'').trim();if(!applyId)return jsonErr('ç¼ºå°‘ç”³è«‹è³‡æ–™');
  const rows=await dbGet(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}&select=*`).catch(()=>[]);
  const apply=rows[0];if(!apply)return jsonErr('æ‰¾ä¸åˆ°ç”³è«‹è³‡æ–™');
  if(String(apply.status)!=='pending')return jsonErr('æ­¤ç”³è«‹å·²è™•ç†');
  const email=normEmail(apply.contact_email),brand=String(apply.brand_name||'').trim(),contact=String(apply.contact_name||brand).trim();
  if(!email||!brand)return jsonErr('ç”³è«‹è³‡æ–™ä¸å®Œæ•´');
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
      application_json:{...app,approvedModuleFlags:approvedFlags,approvedModuleFlagsAt:now,approvedAt:now,timeline:[...(Array.isArray(app.timeline)?app.timeline:[]),{key:'application_approved',label:'å¯©æ ¸é€šéŽä¸¦å»ºç«‹å¸³è™Ÿ',at:now}]}
    });
    try{
      const baseUrl=String(env.DOING_SITE_URL||env.FRONTEND_SITE_URL||'https://ndiangrace-create.github.io/DOING/').replace(/\/+$/,'/');
      await sendEmail(env,email,'ã€DOINGã€‘ç‡Ÿé‹å¸³è™Ÿç”³è«‹å·²é€šéŽ',emailWrap(`<p>${contact} æ‚¨å¥½ï¼š</p><p>æ‚¨çš„ DOING ç‡Ÿé‹å¸³è™Ÿç”³è«‹å·²é€šéŽï¼Œå¯ä»¥é–‹å§‹ä½¿ç”¨ä¸»è¾¦å·¥ä½œå°ã€‚</p><p><a href="${baseUrl}">å‰å¾€ DOING</a></p>`));
    }catch(e){}
    return jsonOk({ok:true,tenantId:tid,moduleFlags:approvedFlags,adminUrl:`admin.html?tenant=${encodeURIComponent(tid)}`});
  }catch(e){
    await dbDelete(env,'billing_logs',`tenant_id=eq.${encodeURIComponent(tid)}&billing_type=eq.startup_credit_grant&confirmed_by=eq.system_onboarding`).catch(()=>{});
    await dbDelete(env,'staff',`tenant_id=eq.${encodeURIComponent(tid)}&email=eq.${encodeURIComponent(email)}`).catch(()=>{});
    await dbDelete(env,'tenant_settings',`tenant_id=eq.${encodeURIComponent(tid)}`).catch(()=>{});
    await dbDelete(env,'tenants',`id=eq.${encodeURIComponent(tid)}`).catch(()=>{});
    return jsonErr('é–‹é€šå¤±æ•—ï¼š'+(e&&e.message?e.message:'è³‡æ–™å»ºç«‹å¤±æ•—'));
  }
}
async function hRejectApply(env,b){
  const pay=await verifyAdminJwt(b.token,env);
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™',401);
  const applyId=String(b.apply_id||'').trim(),reason=String(b.reason||'').trim();
  if(!applyId)return jsonErr('ç¼ºå°‘ç”³è«‹è³‡æ–™');
  const rows=await dbGet(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}&select=*`).catch(()=>[]);
  const apply=rows[0];if(!apply)return jsonErr('æ‰¾ä¸åˆ°ç”³è«‹è³‡æ–™');
  if(String(apply.status)!=='pending')return jsonErr('æ­¤ç”³è«‹å·²è™•ç†');
  const rejectedAt=nowIso(),app=safeJson(apply.application_json,{});
  await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}`,{
    status:'rejected',rejected_at:rejectedAt,rejected_by:pay.email,rejection_reason:reason||'ç”³è«‹è³‡æ–™æœªé€šéŽå¯©æ ¸',application_json:{...app,rejectedAt,timeline:[...(Array.isArray(app.timeline)?app.timeline:[]),{key:'application_rejected',label:'ç”³è«‹æœªé€šéŽ',at:rejectedAt}]}
  });
  try{await sendEmail(env,apply.contact_email,'ã€DOINGã€‘ç‡Ÿé‹å¸³è™Ÿç”³è«‹çµæžœ',emailWrap(`<p>${apply.contact_name||''} æ‚¨å¥½ï¼š</p><p>æœ¬æ¬¡ DOING ç‡Ÿé‹å¸³è™Ÿç”³è«‹å°šæœªé€šéŽå¯©æ ¸ã€‚</p>${reason?`<p>èªªæ˜Žï¼š${reason}</p>`:''}<p>å¦‚è³‡æ–™éœ€è¦è£œå……ï¼Œå¯é‡æ–°æå‡ºç”³è«‹ã€‚</p>`));}catch(e){}
  return jsonOk({ok:true});
}

// GET /apply/list â€” æŸ¥è©¢ç”³è«‹åˆ—è¡¨ï¼ˆå¹³å°ç®¡ç†å“¡ç”¨ï¼‰
// GET /getTenantsAdmin â€” å¹³å°ç®¡ç†å“¡æŸ¥è©¢æ‰€æœ‰ç§Ÿæˆ¶
// BUG-B FIX 2025-06
async function hGetPlatformDashboard(env,p){
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');
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
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');
  const kind=String(p.kind||'').trim(),allowed=new Set(['activeTenants','sessions','operationUnits','registrations','platformRevenue','startupCredit']);if(!allowed.has(kind))return jsonErr('ä¸æ”¯æ´çš„çµ±è¨ˆæ˜Žç´°');
  const tenants=await dbGet(env,'tenants','select=id,name,status,is_locked,created_at&limit=1000').catch(()=>[]),tenantMap=Object.fromEntries(tenants.map(x=>[String(x.id),x]));
  const tenantName=id=>String(tenantMap[String(id||'')]?.name||'ç§Ÿæˆ¶åç¨±å¾…è¨­å®š').trim(),tenantMeta=id=>({tenantId:String(id||''),tenantName:tenantName(id)});
  if(kind==='sessions'){
    const list=await dbGet(env,'sessions','select=id,tenant_id,name,status,created_at&order=created_at.desc&limit=500').catch(()=>[]);
    return jsonOk({kind,title:'æ´»å‹•å ´æ¬¡',rows:list.map(x=>({...tenantMeta(x.tenant_id),id:x.id,title:x.name||x.id,meta:[tenantName(x.tenant_id),x.status||'æœªè¨­å®šç‹€æ…‹'].join('ï½œ'),createdAt:x.created_at||''}))});
  }
  if(kind==='operationUnits'){
    const list=await dbGet(env,'operation_units','select=id,tenant_id,session_id,name,status,unit_type,created_at&order=created_at.desc&limit=500').catch(()=>[]);
    return jsonOk({kind,title:'ç‡Ÿé‹é …ç›®',rows:list.map(x=>({...tenantMeta(x.tenant_id),id:x.id,title:x.name||x.id,meta:[tenantName(x.tenant_id),x.unit_type||'æ´»å‹•',x.status||'æœªè¨­å®šç‹€æ…‹'].join('ï½œ'),createdAt:x.created_at||''}))});
  }
  if(kind==='registrations'){
    const list=await dbGet(env,'registrations','select=id,tenant_id,session_id,operation_unit_id,payment_status,review_status,created_at&order=created_at.desc&limit=500').catch(()=>[]),sessionIds=[...new Set(list.map(x=>String(x.session_id||'')).filter(Boolean))],sessionRows=sessionIds.length?await dbGet(env,'sessions',`id=in.(${sessionIds.map(x=>'"'+x.replaceAll('"','')+'"').join(',')})&select=id,name`).catch(()=>[]):[],sessionMap=Object.fromEntries(sessionRows.map(x=>[String(x.id),x.name||x.id]));
    return jsonOk({kind,title:'å…¨å¹³å°å ±åï¼é ç´„',rows:list.map(x=>({...tenantMeta(x.tenant_id),id:x.id,title:sessionMap[String(x.session_id||'')]||x.operation_unit_id||'å ±åï¼é ç´„',meta:[tenantName(x.tenant_id),x.review_status||'æœªå¯©æ ¸',x.payment_status||'æœªä»˜æ¬¾'].join('ï½œ'),createdAt:x.created_at||''}))});
  }
  if(kind==='activeTenants'){
    const monthAgo=new Date(Date.now()-30*86400000).toISOString(),[sessions,regs]=await Promise.all([dbGet(env,'sessions',`created_at=gte.${encodeURIComponent(monthAgo)}&select=tenant_id,created_at`).catch(()=>[]),dbGet(env,'registrations',`created_at=gte.${encodeURIComponent(monthAgo)}&select=tenant_id,created_at`).catch(()=>[])]),last={};for(const x of [...sessions,...regs]){const id=String(x.tenant_id||'');if(id&&(!last[id]||new Date(x.created_at)>new Date(last[id])))last[id]=x.created_at}
    return jsonOk({kind,title:'è¿‘ 30 æ—¥æ´»èºä¸»è¾¦',rows:Object.entries(last).sort((a,b)=>new Date(b[1])-new Date(a[1])).map(([id,at])=>({...tenantMeta(id),id,title:tenantName(id),meta:tenantMap[id]?.status||'æœªè¨­å®šç‹€æ…‹',createdAt:at}))});
  }
  const logs=await dbGet(env,'billing_logs','status=eq.confirmed&select=id,tenant_id,billing_type,amount,total,note,created_at&order=created_at.desc&limit=1000').catch(()=>[]),isRevenue=x=>{const t=String(x.billing_type||'');return t==='booking_monthly'||t.startsWith('activity_publish:')||t.startsWith('activity_rate:')||t.startsWith('activity_unit:')||t.startsWith('setup_feature:')||t.startsWith('exposure:')},list=kind==='startupCredit'?logs.filter(x=>String(x.billing_type)==='startup_credit_grant'):logs.filter(isRevenue);
  return jsonOk({kind,title:kind==='startupCredit'?'å·²ç™¼å‰µæ¥­é‡‘':'å¹³å°æ”¶å…¥',rows:list.map(x=>({...tenantMeta(x.tenant_id),id:x.id,title:tenantName(x.tenant_id),meta:String(x.note||x.billing_type||''),amount:Math.max(0,safeNum(x.total||x.amount)),createdAt:x.created_at||''}))});
}

async function hGetPlatformMembersAdmin(env,p){
  const pay=await verifyAdminJwt(p.token,env);if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™');
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
  if(!owner)return jsonErr('åªæœ‰å¹³å°ç®¡ç†è€…å¯ä»¥è¨­å®šäººå“¡æ¬Šé™',403);
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
  if(!owner)return jsonErr('åªæœ‰å¹³å°ç®¡ç†è€…å¯ä»¥æ–°å¢žç®¡ç†äººå“¡',403);
  const accessType=String(b.accessType||b.access_type||'').trim(),email=normEmail(b.targetEmail||b.email),name=String(b.targetName||b.name||'').trim();
  if(!['platform','system','onsite'].includes(accessType))return jsonErr('è«‹é¸æ“‡ç®¡ç†è§’è‰²');
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return jsonErr('è«‹è¼¸å…¥æ­£ç¢ºçš„ Email');
  let assignmentId='',tenantId='',role='',perms={},limitSessions=[];
  if(accessType==='platform'){
    role='platform_super_admin';
    const existing=await dbGet(env,'platform_staff',`email=eq.${encodeURIComponent(email)}&select=*`).catch(()=>[]),row=existing[0];
    assignmentId=row?.id||genId('PST');
    const data={email,name,display_name:name,role,normalized_role:role,is_active:true,updated_at:nowIso(),note:'ç”±å¹³å°äººå“¡èˆ‡æ¬Šé™è¨­å®šé é‚€è«‹'};
    if(row){if(row.platform_member_id)return jsonErr('é€™å€‹ Email å·²æ˜¯å¹³å°ç®¡ç†è€…');await dbUpdate(env,'platform_staff',`id=eq.${encodeURIComponent(assignmentId)}`,data)}
    else await dbInsert(env,'platform_staff',{id:assignmentId,...data});
  }else{
    tenantId=String(b.tenantId||b.tenant_id||'').trim().toLowerCase();
    if(!tenantId)return jsonErr('è«‹é¸æ“‡ç®¡ç†çš„ç‡Ÿé‹å¸³è™Ÿ');
    const tenantRows=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(tenantId)}&select=id,name&limit=1`).catch(()=>[]);
    if(!tenantRows[0])return jsonErr('æ‰¾ä¸åˆ°é€™å€‹ç‡Ÿé‹å¸³è™Ÿ');
    role=accessType==='system'?'organizer_admin':'onsite_staff';perms=accessType==='system'?{events:true,sessions:true,review:true,finance:true,checkin:true,announce:true,members:true,settings:true}:{checkin:true};
    limitSessions=accessType==='onsite'?[...new Set((b.sessionIds||b.limitSessions||[]).map(x=>String(x||'').trim()).filter(Boolean))]:[];
    if(accessType==='onsite'&&!limitSessions.length)return jsonErr('ç¾å ´ç®¡ç†è‡³å°‘è¦é¸æ“‡ä¸€å€‹å ´æ¬¡');
    if(limitSessions.length){const valid=await dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(tenantId)}&id=in.(${limitSessions.map(x=>encodeURIComponent(x)).join(',')})&select=id`).catch(()=>[]);if(valid.length!==limitSessions.length)return jsonErr('é¸æ“‡çš„å ´æ¬¡ä¸å±¬æ–¼é€™å€‹ç‡Ÿé‹å¸³è™Ÿ')}
    const existing=await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(tenantId)}&email=eq.${encodeURIComponent(email)}&select=*`).catch(()=>[]),row=existing[0];
    assignmentId=row?.id||crypto.randomUUID();
    if(row?.platform_member_id)return jsonErr('æ­¤äººå·²æ˜¯é€™å€‹ç‡Ÿé‹å¸³è™Ÿçš„ç®¡ç†è€…ï¼Œè«‹ç›´æŽ¥èª¿æ•´æ—¢æœ‰æ¬Šé™');
    const data={email,tenant_id:tenantId,name,display_name:name,role,normalized_role:role,role_id:null,perms_json:JSON.stringify(perms),limit_sessions:limitSessions.join(','),scope_type:accessType==='system'?'all':'session',scope_event_id:'',active:true,is_active:true,updated_at:nowIso()};
    if(row)await dbUpdate(env,'staff',`id=eq.${encodeURIComponent(assignmentId)}`,data);else await dbInsert(env,'staff',{id:assignmentId,...data});
    await syncStaffSessionPermissions(env,tenantId,email,limitSessions);
  }
  const invite=await prepareStaffInvite(env,{assignmentType:accessType==='platform'?'platform':'tenant',assignmentId,tenantId,email,role});
  const tc=accessType==='platform'?{id:'',name:'DOING å¹³å°',siteUrl:doingSiteUrl(env)}:await getTenantCtx(env,tenantId);
  const mail=await mailStaffInvite(env,email,name,role,perms,limitSessions,tc,invite.url).catch(()=>null);
  return jsonOk({success:true,assignmentId,invitationStatus:'pending',emailSent:!!(mail&&mail.ok&&!mail.skipped)});
}

async function hSetPlatformAccessActive(env,b){
  const owner=await requirePlatformOwner(env,b.token);
  if(!owner)return jsonErr('åªæœ‰å¹³å°ç®¡ç†è€…å¯ä»¥åœç”¨æˆ–å•Ÿç”¨ç®¡ç†äººå“¡',403);
  const assignmentType=String(b.assignmentType||b.assignment_type||''),id=String(b.assignmentId||b.assignment_id||''),active=b.active===true||b.active==='true'||b.active===1||b.active==='1';
  if(!id||!['platform','tenant'].includes(assignmentType))return jsonErr('ç¼ºå°‘ç®¡ç†äººå“¡è³‡æ–™');
  if(assignmentType==='platform'){
    if(!active&&id===owner.row.id)return jsonErr('ä¸èƒ½åœç”¨ç›®å‰ç™»å…¥ä¸­çš„å¹³å°ç®¡ç†è€…');
    if(!active){const rows=await dbGet(env,'platform_staff','is_active=eq.true&normalized_role=eq.platform_super_admin&select=id').catch(()=>[]);if(rows.length<=1)return jsonErr('è‡³å°‘è¦ä¿ç•™ä¸€ä½å¯ç™»å…¥çš„å¹³å°ç®¡ç†è€…')}
    await dbUpdate(env,'platform_staff',`id=eq.${encodeURIComponent(id)}`,{is_active:active,updated_at:nowIso()});
  }else await dbUpdate(env,'staff',`id=eq.${encodeURIComponent(id)}`,{is_active:active,active,updated_at:nowIso()});
  return jsonOk({success:true,active});
}

async function hGetTenantsAdmin(env, p) {
  const payload = await verifyAdminJwt(p.token, env);
  if (!payload || payload.normalized_role !== 'platform_super_admin') return jsonErr('ç„¡æ¬Šé™', 401);
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
  if(!payload || payload.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™',401);

  const tenantId=String(b.target_tenant_id||b.tenant_id||'').trim().toLowerCase();
  const ownerEmail=normEmail(b.owner_email||b.target_email||'');
  const ownerName=String(b.owner_name||b.target_name||'').trim();
  const active=b.active!==false && b.active!=='false' && b.active!==0 && b.active!=='0';

  if(!tenantId)return jsonErr('è«‹é¸æ“‡ç§Ÿæˆ¶');
  if(!ownerEmail)return jsonErr('è«‹è¼¸å…¥æ“æœ‰è€… Email');

  const tenants=await dbGet(env,'tenants',`id=eq.${encodeURIComponent(tenantId)}&select=id,name,is_locked`);
  if(!tenants.length)return jsonErr('æ‰¾ä¸åˆ°ç§Ÿæˆ¶');

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
  const payload=await verifyAdminJwt(p.token,env);if(!payload||payload.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™',401);const T=String(p.target_tenant_id||'').trim().toLowerCase();if(!T)return jsonErr('è«‹é¸æ“‡ä¸»è¾¦');const rows=await dbGet(env,'sessions',`tenant_id=eq.${encodeURIComponent(T)}&select=id,name,status,modules_json&order=created_at.desc`).catch(()=>[]);return jsonOk(rows.map(s=>({id:s.id,name:s.name||s.id,status:s.status||'',operatingMode:normalizeSessionModules(safeJson(s.modules_json,{})).operatingMode,entitled:false})));
}

async function hPlatformTenantOperationUnits(env,p){
  const payload=await verifyAdminJwt(p.token,env);if(!payload||payload.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™',401);const T=String(p.target_tenant_id||'').trim().toLowerCase();if(!T)return jsonErr('è«‹é¸æ“‡ä¸»è¾¦');const rows=await dbGet(env,'operation_units',`tenant_id=eq.${encodeURIComponent(T)}&select=id,session_id,name,status,modules_json&order=created_at.desc`).catch(()=>[]);return jsonOk(rows.map(u=>({id:u.id,sessionId:u.session_id,name:u.name||u.id,status:u.status||'',operatingMode:normalizeSessionModules(safeJson(u.modules_json,{})).operatingMode||'activity'})));
}

async function hPlatformTenantOwnerStatus(env,p){
  const payload=await verifyAdminJwt(p.token,env);
  if(!payload || payload.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™',401);
  const tenantId=String(p.target_tenant_id||p.tenant_id||'').trim().toLowerCase();
  const ownerEmail=normEmail(p.owner_email||p.target_email||'');
  if(!tenantId||!ownerEmail)return jsonErr('ç¼ºå°‘ç§Ÿæˆ¶æˆ– Email');
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
  if (!payload || payload.normalized_role !== 'platform_super_admin') return jsonErr('ç„¡æ¬Šé™', 401);
  const target = String(b.target_workspace_id || b.tenant_id || b.tenant || '').trim().toLowerCase();
  if (!target) return jsonErr('è«‹é¸æ“‡ä¸»è¾¦ç©ºé–“');
  const rows = await dbGet(env,'tenants',`id=eq.${encodeURIComponent(target)}&select=id,name,status,is_locked`);
  const tenant = rows[0];
  if (!tenant) return jsonErr('æ‰¾ä¸åˆ°ä¸»è¾¦ç©ºé–“');
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
  if (!payload || payload.normalized_role !== 'platform_super_admin') return jsonErr('ç„¡æ¬Šé™', 401);
  const rows = await dbGet(env, 'tenant_apply_logs', `order=created_at.desc&limit=50&select=*`);
  return jsonOk(rows.filter(row=>!isQaApplication(row)));
}
async function hRequestApplySupplement(env,b){
  const pay=await verifyAdminJwt(b.token,env);
  if(!pay||pay.normalized_role!=='platform_super_admin')return jsonErr('ç„¡æ¬Šé™',401);
  const applyId=String(b.apply_id||'').trim(),reason=String(b.reason||'').trim();
  if(!applyId)return jsonErr('ç¼ºå°‘ç”³è«‹è³‡æ–™');
  if(!reason)return jsonErr('è«‹å¡«å¯«è£œä»¶èªªæ˜Ž');
  const rows=await dbGet(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}&select=*`).catch(()=>[]);
  const apply=rows[0];if(!apply)return jsonErr('æ‰¾ä¸åˆ°ç”³è«‹è³‡æ–™');
  const requestedAt=nowIso(),app=safeJson(apply.application_json,{});
  await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applyId)}`,
    {status:'supplement_required',supplement_requested_at:requestedAt,supplement_requested_by:pay.email,supplement_reason:reason,rejected_at:null,rejected_by:null,rejection_reason:null,application_json:{...app,supplementRequestedAt:requestedAt,timeline:[...(Array.isArray(app.timeline)?app.timeline:[]),{key:'supplement_requested',label:'å¹³å°è¦æ±‚è£œä»¶',at:requestedAt}]}}
  );
  try{
    const page=doingPageUrl(env,'about.html');
    await sendEmail(env,apply.contact_email,'ã€DOINGã€‘ç‡Ÿé‹å¸³è™Ÿç”³è«‹éœ€è¦è£œä»¶',emailWrap(`<p>${apply.contact_name||''} æ‚¨å¥½ï¼š</p><p>ä½ çš„ DOING ç‡Ÿé‹å¸³è™Ÿç”³è«‹éœ€è¦è£œå……è³‡æ–™å¾Œå†ç¹¼çºŒå¯©æ ¸ã€‚</p><p><b>è£œä»¶èªªæ˜Žï¼š</b><br>${reason}</p><p>è«‹å›žåˆ°ç”³è«‹é é‡æ–°å¡«å¯«ä¸¦ä½¿ç”¨åŽŸ Google å¸³è™Ÿå®Œæˆé€å‡ºï¼š</p><p><a href="${page}#apply">å‰å¾€ DOING ç‡Ÿé‹å¸³è™Ÿç”³è«‹</a></p>`));
  }catch(e){}
  return jsonOk({ok:true});
}


// â”€â”€ éŽ–å®š / åœç”¨æ©Ÿåˆ¶ API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// POST /lockTenant â€” éŽ–å®šç§Ÿæˆ¶ï¼ˆå¹³å°ç®¡ç†å“¡ç”¨ï¼‰
async function hLockTenant(env, b) {
  const payload = await verifyAdminJwt(b.token, env);
  if (!payload || payload.normalized_role !== 'platform_super_admin') return jsonErr('ç„¡æ¬Šé™', 401);
  await dbUpdate(env, 'tenants', `id=eq.${b.tenant_id}`, {
    is_locked: true,
    locked_at: new Date().toISOString(),
    locked_reason: b.reason || 'å¸³è™ŸéŽ–å®š',
    updated_at: new Date().toISOString(),
  });
  return jsonOk({ ok: true });
}

// POST /unlockTenant â€” è§£éŽ–ç§Ÿæˆ¶ï¼ˆæ”¶åˆ°ä»˜æ¬¾å¾Œï¼‰
async function hUnlockTenant(env, b) { return jsonErr('èˆŠè©¦ç”¨è§£éŽ–æµç¨‹å·²åœç”¨ï¼›æ­£å¼ç‡Ÿé‹æ¬Šè«‹ä½¿ç”¨è¨ˆè²»ï¼é¡åº¦æµç¨‹'); }

// â”€â”€ å ´æ¬¡ä¸‹è¼‰ Excel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /downloadSession â€” ä¸‹è¼‰å–®å ´æ¬¡å®Œæ•´ Excel
async function hDownloadSession(env,p){
  const TENANT=p._tenantId;
  if(!await verifyStaff(env,p.email,p.token,TENANT))return jsonErr('ç„¡æ¬Šé™');
  const lockCheck=await checkTenantLocked(env,TENANT);
  if(lockCheck.locked)return jsonErr('å¸³è™Ÿå·²éŽ–å®šï¼Œç„¡æ³•ä¸‹è¼‰è³‡æ–™ï¼Œè«‹å…ˆçºŒè²»');
  const sesId=String(p.sessionId||'').trim();
  if(!sesId)return jsonErr('è«‹æŒ‡å®šå ´æ¬¡');

  const sessions=await dbGet(env,'sessions',`id=eq.${encodeURIComponent(sesId)}&tenant_id=eq.${TENANT}&select=*`);
  const session=sessions[0];if(!session)return jsonErr('æ‰¾ä¸åˆ°å ´æ¬¡');
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
    ['æ¬„ä½','å…§å®¹'],
    ['ç³»åˆ—',event.title||''],
    ['å ´æ¬¡',session.name||''],
    ['æ—¥æœŸ',_sessionDateRows(safeJson(session.dates_json,[])).map(x=>x.date).filter(Boolean).join('ã€')],
    ['åœ°é»ž',session.venue||''],
    ['ç‹€æ…‹',session.status||''],
    ['å ±åç­†æ•¸',regs.length],
    ['æœ‰æ•ˆå ±åç­†æ•¸',activeRegs.length],
    ['æ‡‰æ”¶ç¸½é¡',totalReceivable],
    ['å·²æ”¶ç¸½é¡',totalReceived],
    ['æœªæ”¶ç¸½é¡',Math.max(0,totalReceivable-totalReceived)],
    ['å·²æ”¶æŠ¼é‡‘',totalDeposit],
    ['å·²é€€æ¬¾',refundTotal],
    ['å ´æ¬¡æ”¶å…¥',cashbook.totals.income],
    ['å ´æ¬¡æ”¯å‡º',cashbook.totals.expense],
    ['å ´æ¬¡çµé¤˜',cashbook.totals.balance],
  ];

  const regHeaders=[
    'å ±åç·¨è™Ÿ','ç³»åˆ—','å ´æ¬¡','å“ç‰Œåç¨±','å“ç‰Œä»‹ç´¹','è¯çµ¡äºº','Email','é›»è©±',
    'è²©å”®åˆ†é¡ž','è²©å”®å…§å®¹','å“ç‰Œé€£çµ','Facebook','Instagram','ç…§ç‰‡é€£çµ',
    'å ±åæ—¥æœŸ','æ”¤ä½æ•¸','è¨­å‚™','åŠ è³¼å…§å®¹','ä½ç½®','é¸ä½æ„é¡˜','é¸ä½ç‹€æ…‹',
    'æ‡‰æ”¶é‡‘é¡','å¯¦æ”¶é‡‘é¡','æŠ¼é‡‘','å¯©æ ¸ç‹€æ…‹','ç¹³è²»ç‹€æ…‹','ä»˜æ¬¾æ–¹å¼','ä»˜æ¬¾æœ«ç¢¼',
    'é€€æ¬¾é‡‘é¡','é€€æ¬¾ç‹€æ…‹','ç™¼ç¥¨é¡žåž‹','çµ±ä¸€ç·¨è™Ÿ','ç™¼ç¥¨æŠ¬é ­','ç™¼ç¥¨ Email','ç™¼ç¥¨ç‹€æ…‹',
    'å ±åˆ°ç‹€æ…‹','æ¸…å ´ç‹€æ…‹','æŠ¼é‡‘é€€é‚„ç‹€æ…‹','è‡ªè¨‚æ¬„ä½','åƒåŠ è€…è³‡æ–™','ç”³è«‹æ™‚é–“'
  ];
  const regRows=regs.map(r=>{
    const money=_regFinanceAmounts(r,session,itemMap[r.id]);
    return [
      r.registration_no||r.id,event.title||'',session.name||'',
      r.brand_name||'',r.brand_intro||'',r.name||'',r.email||'',r.phone||'',
      r.sell_category||'',r.sell_items||'',r.sell_link||'',r.fb_url||'',r.ig_url||'',r.photo_url||'',
      safeJson(r.selected_dates_json,[]).join('ã€'),safeNum(r.stall_count)||1,
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

  const incomeRows=cashbook.rows.filter(x=>x.kind==='æ”¶å…¥').map(x=>[x.date,x.category,x.amount,x.note,x.source,x.referenceType,x.referenceId]);
  const expenseRows=cashbook.rows.filter(x=>x.kind==='æ”¯å‡º').map(x=>[x.date,x.category,x.amount,x.note,x.source,x.referenceType,x.referenceId]);
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
    filename:`${String(session.name||sesId).replace(/[\\/:*?"<>|]/g,'_')}_å®Œæ•´å ±è¡¨.xlsx`,
    session:{id:sesId,name:session.name||'',eventName:event.title||'',date:_sessionFirstDate(session),venue:session.venue||''},
    sheets:[
      {name:'å ´æ¬¡ç¸½è¦½',rows:summary},
      {name:'å®Œæ•´å ±ååå–®',rows:[regHeaders,...regRows]},
      {name:'æ”¶å…¥æ˜Žç´°',rows:[['æ—¥æœŸ','åˆ†é¡ž','é‡‘é¡','å‚™è¨»','ä¾†æº','é—œè¯é¡žåž‹','é—œè¯ç·¨è™Ÿ'],...incomeRows]},
      {name:'æ”¯å‡ºæ˜Žç´°',rows:[['æ—¥æœŸ','åˆ†é¡ž','é‡‘é¡','å‚™è¨»','ä¾†æº','é—œè¯é¡žåž‹','é—œè¯ç·¨è™Ÿ'],...expenseRows]},
      {name:'ä»˜æ¬¾ç´€éŒ„',rows:[['ä»˜æ¬¾ç·¨è™Ÿ','å ±åç·¨è™Ÿ','Email','é‡‘é¡','æ–¹å¼','ç‹€æ…‹','æœ«ç¢¼ï¼äº¤æ˜“è™Ÿ','ç¢ºèªæ™‚é–“','å»ºç«‹æ™‚é–“'],...payRows]},
      {name:'ä»˜æ¬¾åˆ†é…',rows:[['åˆ†é…ç·¨è™Ÿ','ä»˜æ¬¾ç·¨è™Ÿ','å ±åç·¨è™Ÿ','é¡žåž‹','é‡‘é¡','å»ºç«‹æ™‚é–“'],...allocRows]},
      {name:'è¨­å‚™èˆ‡ä½ç½®',rows:[['å ±åç·¨è™Ÿ','å“ç‰Œï¼å§“å','æ”¤ä½æ•¸','è¨­å‚™','ä½ç½®','é¸ä½æ„é¡˜','é¸ä½ç‹€æ…‹','å ±åˆ°','æ¸…å ´'],...equipRows]}
    ]
  });
}


// â”€â”€ Cronï¼šè©¦ç”¨åˆ°æœŸæé†’ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function cronTrialExpireReminders(env) {
  // èˆŠ trial_end_at åˆ°æœŸæé†’ï¼è‡ªå‹•éŽ–å®šæ­£å¼åœç”¨ã€‚
  // DOING ç¾è¡Œè¦å‰‡ï¼šå…è²»å¸³è™Ÿå¯æŒçºŒè¨­å®šèˆ‡é è¦½ï¼Œæ­£å¼ç‡Ÿé‹æ¬Šç”± billing entitlement æŽ§åˆ¶ã€‚
  return {ok:true, skipped:'legacy_trial_disabled'};
}


// å…è¼¸å…¥ä¸»è¾¦è­˜åˆ¥ç™»å…¥ï¼šä¾ Google email æ‰¾å‡ºå¯ç®¡ç†çš„ä¸»è¾¦ç©ºé–“
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
  if(!verified)return jsonErr('æœƒå“¡ç™»å…¥å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥');
  const provider=String(b.provider||'').trim().toLowerCase();
  if(!['line','google'].includes(provider))return jsonErr('ä¸æ”¯æ´çš„ç™»å…¥æ–¹å¼');
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
  if(!verified)return jsonErr('è«‹å…ˆä½¿ç”¨è‡ªå·±çš„ LINE ç™»å…¥ï¼Œå†æŽ¥å—ç®¡ç†é‚€è«‹',401);
  const invite=await verifyStaffInviteToken(env,b.invite_token||b.inviteToken||b.staff_invite);
  if(!invite)return jsonErr('ç®¡ç†é‚€è«‹å·²å¤±æ•ˆï¼Œè«‹ç®¡ç†è€…é‡æ–°å¯„é€',400);
  const assignmentType=String(invite.assignment_type||'tenant'),table=assignmentType==='platform'?'platform_staff':'staff';
  const filter=`id=eq.${encodeURIComponent(invite.assignment_id)}&select=*`;
  const rows=await dbGet(env,table,filter).catch(()=>[]),assignment=rows[0];
  if(!assignment)return jsonErr('æ‰¾ä¸åˆ°é€™ç­†ç®¡ç†é‚€è«‹ï¼Œè«‹ç®¡ç†è€…é‡æ–°å¯„é€',404);
  const active=assignment.is_active!==undefined?assignment.is_active:assignment.active;
  if(active===false)return jsonErr('é€™ç­†ç®¡ç†é‚€è«‹å·²è¢«åœç”¨ï¼Œè«‹è¯çµ¡ç®¡ç†è€…',403);
  if(normEmail(assignment.email)!==normEmail(invite.email))return jsonErr('ç®¡ç†é‚€è«‹è³‡æ–™å·²æ›´æ–°ï¼Œè«‹ä½¿ç”¨æœ€æ–°é‚€è«‹ä¿¡',409);
  if(assignmentType!=='platform'&&String(assignment.tenant_id||'').toLowerCase()!==String(invite.tenant_id||'').toLowerCase())return jsonErr('ç®¡ç†é‚€è«‹çš„ç‡Ÿé‹ç©ºé–“ä¸ä¸€è‡´',409);
  if(assignment.platform_member_id&&String(assignment.platform_member_id)!==String(verified.row.id))return jsonErr('é€™ç­†é‚€è«‹å·²ç”±å¦ä¸€å€‹ DOING æœƒå“¡æŽ¥å—ï¼Œè«‹ç®¡ç†è€…ç¢ºèªå¾Œé‡æ–°é‚€è«‹',409);

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
  return jsonOk({ok:true,accepted:true,assignmentType,tenantId,role,memberId:member.id,message:assignmentType==='platform'?'å·²å®Œæˆå¹³å°ç®¡ç†è€…ç¶å®š':'å·²å®Œæˆç®¡ç†è€…ç¶å®š'});
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
  if(!env.LINE_LOGIN_CHANNEL_ID)return new Response('LINE Login å°šæœªè¨­å®š Channel ID',{status:500});
  const mode=String(url.searchParams.get('mode')||'member').trim().toLowerCase(),tenant=String(url.searchParams.get('tenant')||'').trim().toLowerCase(),nonce=crypto.randomUUID();
  const link=mode==='link'?await verifyIdentityLinkStart(env,url.searchParams.get('link_token'),'line'):null;
  if(mode==='link'&&!link)return new Response('å¸³è™Ÿé€£çµå·²å¤±æ•ˆï¼Œè«‹å›žæœƒå“¡ä¸­å¿ƒé‡æ–°æ“ä½œ',{status:400});
  const fallback=mode==='platform'||tenant==='platform'?platformSiteUrl(env):mode==='organizer_signup'?doingSiteUrl(env)+'#apply':doingSiteUrl(env);
  const state=await issueLineOAuthState(env,{mode,tenant,application_id:url.searchParams.get('application_id')||'',return_url:link?.return_url||url.searchParams.get('return_url')||fallback,link_member_id:link?.member_id||'',nonce});
  // LINE Email æ¬Šé™éœ€ç¶“ LINE Developers å¦è¡Œå¯©æ ¸ã€‚å°šæœªæ ¸å‡†æ™‚ä»ä»¥å›ºå®š provider subject
  // å®Œæˆå®‰å…¨ç™»å…¥ï¼›æœ‰æ ¸å‡†ä¸¦æ˜Žç¢ºé–‹å•Ÿè¨­å®šæ™‚ï¼Œæ‰é¡å¤–å–å¾—å·²é©—è­‰ Email åšè·¨æœå‹™è‡ªå‹•åˆä½µã€‚
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
      if(collision.found){const memberToken=await issueMemberToken({email:member.email,provider:'line',provider_subject:lineSubject,display_name:lineName,avatar_url:lineAvatar},env);await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{note:'ç™»å…¥æˆåŠŸï¼›åµæ¸¬åˆ°æ—¢æœ‰å¸³è™Ÿï¼Œç”³è«‹ä¿ç•™è‰ç¨¿ç­‰å¾…é€£çµå¸³è™Ÿ',application_json:{...appPayload,memberId:member.id,loginProvider:'line',identityResolutionRequired:true}}).catch(()=>{});applicationTarget.searchParams.set('member_token',memberToken);applicationTarget.searchParams.set('member_status',platformMemberComplete(member)?'ready':'profile_required');applicationTarget.searchParams.set('member_login_error','identity_resolution_required');applicationTarget.searchParams.set('application_status','identity_resolution_required');applicationTarget.searchParams.set('application_id',applicationId);return Response.redirect(applicationTarget.toString(),302)}
      const signupProfile=appPayload.moduleProfile||{},signupDefaults=normalizeSessionModules(signupProfile&&signupProfile.defaults?signupProfile.defaults:{}),profileConfig={configured:true,useType:String(signupProfile.useType||'generic'),useCases:Array.isArray(signupProfile.useCases)?signupProfile.useCases.map(String).slice(0,12):[],defaults:signupDefaults,updatedAt:nowIso()};
      const submittedAt=nowIso(),applicationJson={...appPayload,ownerName:contact,contactName:contact,billingName:contact,moduleProfile:profileConfig,memberId:member.id,loginProvider:'line',lineSubject,lineDisplayName:lineName,submittedAt,timeline:[...(Array.isArray(appPayload.timeline)?appPayload.timeline:[]),{key:'application_submitted',label:'LINE é©—è­‰ä¸¦é€å‡º',at:submittedAt}]};
      const existingRows=await dbGet(env,'tenant_apply_logs',`contact_email=eq.${encodeURIComponent(contactEmail)}&status=eq.supplement_required&select=id,status,supplement_count,brand_name`).catch(()=>[]),supplement=existingRows.find(x=>String(x.brand_name||'').trim().toLowerCase()===brand.toLowerCase());
      if(supplement){await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(supplement.id)}`,{brand_name:brand,contact_name:contact,contact_email:contactEmail,contact_phone:phone,event_type:(appPayload.useCases||[]).join(','),status:'pending',plan_type:'review',note:'LINE é©—è­‰å¾Œè£œä»¶é‡æ–°é€å‡º',application_json:applicationJson,supplement_submitted_at:submittedAt,supplement_count:safeNum(supplement.supplement_count)+1,rejected_at:null,rejected_by:null,rejection_reason:null});await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{status:'replaced',note:'å·²ä½µå…¥è£œä»¶ç”³è«‹'}).catch(()=>{});applicationTarget.searchParams.set('application_status','supplement_submitted');applicationTarget.searchParams.set('application_id',supplement.id);return Response.redirect(applicationTarget.toString(),302)}
      await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{brand_name:brand,contact_name:contact,contact_email:contactEmail,contact_phone:phone,event_type:(appPayload.useCases||[]).join(','),plan_type:'review',note:'LINE é©—è­‰å®Œæˆ',status:'pending',application_json:applicationJson});
      try{await sendEmail(env,contactEmail,'ã€DOINGã€‘ç‡Ÿé‹å¸³è™Ÿç”³è«‹å·²é€å‡º',emailWrap(`<p>${contact} æ‚¨å¥½ï¼š</p><p>ä½ çš„ DOING ç‡Ÿé‹å¸³è™Ÿç”³è«‹å·²é€å‡ºï¼Œç›®å‰ç­‰å¾…å¹³å°å¯©æ ¸ã€‚</p><p><b>ç”³è«‹ç·¨è™Ÿï¼š</b>${applicationId}</p><p>å¯©æ ¸é€šéŽæˆ–éœ€è¦è£œä»¶æ™‚ï¼Œç³»çµ±æœƒå†å¯„ä¿¡é€šçŸ¥ã€‚</p>`))}catch(e){}
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
  if (!payload) return jsonErr('ç™»å…¥é¸æ“‡å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥');
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
  if (!payload) return jsonErr('ç™»å…¥é¸æ“‡å·²å¤±æ•ˆï¼Œè«‹é‡æ–°ä½¿ç”¨ LINE ç™»å…¥');
  const tenant = String(b.target_workspace_id || b.tenant || b.tenant_id || '').trim().toLowerCase();
  const allowed = payload.tenant_ids.map(v=>String(v).toLowerCase());
  if (!tenant || !allowed.includes(tenant)) return jsonErr('æ­¤ä¸»è¾¦ç©ºé–“ä¸åœ¨æœ¬æ¬¡ç™»å…¥æŽˆæ¬Šç¯„åœ');

  const staff = payload.platform_member_id?await findStaffForPlatformMember(env,payload.platform_member_id,tenant):(await dbGet(env, 'staff', `tenant_id=eq.${encodeURIComponent(tenant)}&email=eq.${encodeURIComponent(payload.email)}&select=*`).catch(()=>[])).find(r=>((r.is_active !== undefined ? r.is_active : r.active) !== false));
  if (!staff) return jsonErr('æ­¤å¸³è™Ÿå·²ç„¡è©²ä¸»è¾¦ç©ºé–“ç®¡ç†æ¬Šé™ï¼Œè«‹é‡æ–°ç™»å…¥');

  const adminToken = await issueAdminToken({ ...staff, email: staff.email||payload.email }, tenant, env);
  await dbUpdate(env, 'staff', `id=eq.${encodeURIComponent(staff.id)}`, { last_login_at: new Date().toISOString() }).catch(()=>{});
  await logAdminLogin(env, tenant, staff.id, staff.email||payload.email, payload.provider||'google', 'success', 'workspace_selected', '', '');

  const adminUrl = adminSiteUrl(env);
  return jsonOk({ ok:true, tenant, admin_token:adminToken, admin_url:adminUrl });
}

// GET /auth/google/start
async function hGoogleStart(env, url) {
  // å…¬é–‹ç•«é¢ç¾éšŽæ®µåªé¡¯ç¤º LINEï¼›Google OAuth ä¿ç•™ä¸¦å¯ä¾›æ—¢æœ‰å¸³è™Ÿé€£çµèˆ‡æœªä¾†é‡æ–°å•Ÿç”¨ã€‚
  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
  if (!GOOGLE_CLIENT_ID) {
    return new Response('Google OAuth æœªè¨­å®šï¼šç¼ºå°‘ GOOGLE_CLIENT_ID', { status: 500 });
  }

  const GOOGLE_REDIRECT_URI = googleRedirectUri(env, url);
  const tenant = String(url.searchParams.get('tenant') || '').trim().toLowerCase();
  const mode=String(url.searchParams.get('mode')||'').trim().toLowerCase(),link=mode==='link'?await verifyIdentityLinkStart(env,url.searchParams.get('link_token'),'google'):null;
  if(mode==='link'&&!link)return new Response('å¸³è™Ÿé€£çµå·²å¤±æ•ˆï¼Œè«‹å›žæœƒå“¡ä¸­å¿ƒé‡æ–°æ“ä½œ',{status:400});
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
    return failRedirect('token_exchange_failed', tenant === 'platform' ? platformUrl : loginUrl);
  }

  if (!tokenRes.id_token) {
    await logAdminLogin(env, tenant, null, '', 'google', 'error', 'no_id_token', '', '').catch(()=>{});
    return failRedirect('no_id_token', tenant === 'platform' ? platformUrl : loginUrl);
  }

  let userInfo;
  try {
    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenRes.id_token)}`);
    userInfo = await infoRes.json();
    if (!infoRes.ok || userInfo.error || userInfo.aud !== GOOGLE_CLIENT_ID) throw new Error('invalid_token');
  } catch(e) {
    await logAdminLogin(env, tenant, null, '', 'google', 'denied', 'id_token_verify_failed', '', '').catch(()=>{});
    return failRedirect('id_token_verify_failed', tenant === 'platform' ? platformUrl : loginUrl);
  }

  const googleEmail = String(userInfo.email || '').trim().toLowerCase();
  const googleEmailVerified=userInfo.email_verified===true||String(userInfo.email_verified||'').toLowerCase()==='true';
  const googleName = userInfo.name || '';
  if (!googleEmail||!googleEmailVerified) return failRedirect('no_verified_email', tenant === 'platform' ? platformUrl : loginUrl);
  const googleSubject=String(userInfo.sub||googleEmail);
  let member;
  try{member=await upsertPlatformIdentity(env,{provider:'google',subject:googleSubject,email:googleEmail,displayName:googleName,avatarUrl:String(userInfo.picture||''),preferredMemberId:statePayload.mode==='link'?statePayload.link_member_id:''})}
  catch(e){return failRedirect(e&&e.message==='email_link_requires_existing_login'?'email_link_requires_existing_login':'google_member_login_failed',['member','link'].includes(statePayload.mode)?safeDoingReturnUrl(env,statePayload.return_url||doingSiteUrl(env)):tenant==='platform'?platformUrl:loginUrl)}

  if(statePayload.mode==='link'){
    const target=safeDoingReturnUrl(env,statePayload.return_url||doingPageUrl(env,'member.html'));
    const original=await getPlatformMemberById(env,statePayload.link_member_id);if(!original)return failRedirect('identity_link_target_not_found',target);
    member=await mergeVerifiedPlatformMembers(env,original,member,googleEmail,original.id);
    const memberToken=await issueMemberToken({email:member.email,provider:'google',provider_subject:googleSubject,google_sub:googleSubject,display_name:googleName,avatar_url:String(userInfo.picture||'')},env);target.searchParams.set('member_token',memberToken);target.searchParams.set('member_status',platformMemberComplete(member)?'ready':'profile_required');target.searchParams.set('member_linked','google');return Response.redirect(target.toString(),302);
  }

  if(statePayload.mode==='member'){
    const target=safeDoingReturnUrl(env,statePayload.return_url||doingSiteUrl(env));
    const memberToken=await issueMemberToken({email:member.email,provider:'google',provider_subject:googleSubject,google_sub:googleSubject,display_name:googleName,avatar_url:String(userInfo.picture||'')},env);target.searchParams.set('member_token',memberToken);target.searchParams.set('member_status',platformMemberComplete(member)?'ready':'profile_required');return Response.redirect(target.toString(),302);
  }

  if(statePayload.mode==='organizer_signup'){
    const applicationId=String(statePayload.application_id||'').trim();
    if(!applicationId)return failRedirect('signup_missing_profile',doingSiteUrl(env)+'#apply');
    const draftRows=await dbGet(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}&status=in.(line_verification_pending,google_verification_pending)&select=*`).catch(()=>[]);
    const draft=draftRows[0];
    if(!draft)return failRedirect('signup_draft_not_found',doingSiteUrl(env)+'#apply');
    const appPayload=safeJson(draft.application_json,{});
    const brand=String(appPayload.unitName||draft.brand_name||'').trim();
    const contact=String(appPayload.ownerName||appPayload.contactName||draft.contact_name||googleName||'').trim();
    const phone=String(appPayload.phone||draft.contact_phone||'').trim();
    const contactEmail=normEmail(appPayload.contactEmail||draft.contact_email||googleEmail);
    if(!brand||!contact||!phone||!contactEmail)return failRedirect('signup_missing_profile',doingSiteUrl(env)+'#apply');
    const collision=await platformIdentityCollision(env,member.id,contactEmail,phone);
    if(collision.found){const memberToken=await issueMemberToken({email:member.email,provider:'google',provider_subject:googleSubject,google_sub:googleSubject,display_name:googleName,avatar_url:String(userInfo.picture||'')},env);await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{note:'ç™»å…¥æˆåŠŸï¼›åµæ¸¬åˆ°æ—¢æœ‰å¸³è™Ÿï¼Œç”³è«‹ä¿ç•™è‰ç¨¿ç­‰å¾…é€£çµå¸³è™Ÿ',application_json:{...appPayload,memberId:member.id,loginProvider:'google',identityResolutionRequired:true}}).catch(()=>{});const u=new URL(doingSiteUrl(env));u.hash='apply';u.searchParams.set('member_token',memberToken);u.searchParams.set('member_status',platformMemberComplete(member)?'ready':'profile_required');u.searchParams.set('member_login_error','identity_resolution_required');u.searchParams.set('application_status','identity_resolution_required');u.searchParams.set('application_id',applicationId);return Response.redirect(u.toString(),302)}
    let signupProfile=appPayload.moduleProfile||{};
    const signupDefaults=normalizeSessionModules(signupProfile&&signupProfile.defaults?signupProfile.defaults:{});
    const profile={configured:true,useType:String(signupProfile.useType||'generic'),useCases:Array.isArray(signupProfile.useCases)?signupProfile.useCases.map(String).slice(0,12):[],defaults:signupDefaults,updatedAt:nowIso()};
    const submittedAt=nowIso(),applicationJson={...appPayload,ownerName:contact,contactName:contact,billingName:contact,moduleProfile:profile,memberId:member.id,loginProvider:'google',googleName,googleSub:googleSubject,submittedAt,timeline:[...(Array.isArray(appPayload.timeline)?appPayload.timeline:[]),{key:'application_submitted',label:'Google é©—è­‰ä¸¦é€å‡º',at:submittedAt}]};
    const existingRows=await dbGet(env,'tenant_apply_logs',`contact_email=eq.${encodeURIComponent(contactEmail)}&status=eq.supplement_required&select=id,status,supplement_count,brand_name`).catch(()=>[]);
    const supplement=existingRows.find(x=>String(x.brand_name||'').trim().toLowerCase()===brand.toLowerCase());
    if(supplement){
      await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(supplement.id)}`,
        {
          brand_name:brand,contact_name:contact,contact_email:contactEmail,contact_phone:phone,event_type:(appPayload.useCases||[]).join(','),status:'pending',
          plan_type:'review',note:'è£œä»¶å¾Œé‡æ–°é€å‡º',application_json:applicationJson,
          supplement_submitted_at:submittedAt,supplement_count:safeNum(supplement.supplement_count)+1,
          rejected_at:null,rejected_by:null,rejection_reason:null
        }
      );
      await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{status:'replaced',note:'å·²ä½µå…¥è£œä»¶ç”³è«‹'}).catch(()=>{});
      const u=new URL(doingSiteUrl(env));u.hash='apply';u.searchParams.set('application_status','supplement_submitted');u.searchParams.set('application_id',supplement.id);
      return Response.redirect(u.toString(),302);
    }
    await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{
      brand_name:brand,contact_name:contact,contact_email:contactEmail,contact_phone:phone,
      event_type:(appPayload.useCases||[]).join(','),plan_type:'review',note:'Google é©—è­‰å®Œæˆ',status:'pending',application_json:applicationJson
    });
    try{await sendEmail(env,contactEmail,'ã€DOINGã€‘ç‡Ÿé‹å¸³è™Ÿç”³è«‹å·²é€å‡º',emailWrap(`<p>${contact} æ‚¨å¥½ï¼š</p><p>ä½ çš„ DOING ç‡Ÿé‹å¸³è™Ÿç”³è«‹å·²é€å‡ºï¼Œç›®å‰ç­‰å¾…å¹³å°å¯©æ ¸ã€‚</p><p><b>ç”³è«‹ç·¨è™Ÿï¼š</b>${applicationId}</p><p>å¯©æ ¸é€šéŽæˆ–éœ€è¦è£œä»¶æ™‚ï¼Œç³»çµ±æœƒå†å¯„ä¿¡é€šçŸ¥ã€‚</p>`));}catch(e){}
    const u=new URL(doingSiteUrl(env));u.hash='apply';u.searchParams.set('application_status','pending');u.searchParams.set('application_id',applicationId);
    return Response.redirect(u.toString(),302);
  }

  if(statePayload.mode==='platform'||tenant==='platform'){
    let rows=await dbGet(env,'platform_staff',`platform_member_id=eq.${encodeURIComponent(member.id)}&is_active=eq.true&select=*`).catch(()=>[]),staff=rows[0];
    if(!staff){rows=await dbGet(env,'platform_staff',`email=eq.${encodeURIComponent(googleEmail)}&is_active=eq.true&select=*`).catch(()=>[]);staff=rows[0];if(staff)await dbUpdate(env,'platform_staff',`id=eq.${encodeURIComponent(staff.id)}`,{platform_member_id:member.id,last_login_at:nowIso()}).catch(()=>{})}
    if(!staff){await logAdminLogin(env,'platform',null,googleEmail,'google','denied','not_platform_staff','','').catch(()=>{});return failRedirect('not_authorized',platformUrl)}
    const platformToken=await issueAdminToken({...staff,email:staff.email||googleEmail,name:staff.name||googleName},'platform',env);await dbUpdate(env,'platform_staff',`id=eq.${encodeURIComponent(staff.id)}`,{last_login_at:nowIso()}).catch(()=>{});await logAdminLogin(env,'platform',staff.id,staff.email||googleEmail,'google','success','platform_login','','').catch(()=>{});const u=new URL(platformUrl);u.searchParams.set('admin_token',platformToken);return Response.redirect(u.toString(),302);
  }

  if(statePayload.mode==='admin'||tenant){
    const workspaces=tenant?((await findStaffForPlatformMember(env,member.id,tenant))?await findAdminWorkspacesByMemberId(env,member.id):[]):await findAdminWorkspacesByMemberId(env,member.id);
    if(!workspaces.length){await logAdminLogin(env,tenant,null,googleEmail,'google','denied','member_not_in_staff','','').catch(()=>{});return failRedirect('not_authorized',loginUrl)}
    if(tenant||workspaces.length===1){const selected=tenant?workspaces.find(w=>w.tenant_id===tenant):workspaces[0];if(!selected)return failRedirect('not_authorized',loginUrl);const staff=await findStaffForPlatformMember(env,member.id,selected.tenant_id);if(!staff)return failRedirect('not_authorized',loginUrl);const adminToken=await issueAdminToken({...staff,email:staff.email||googleEmail},selected.tenant_id,env);await dbUpdate(env,'staff',`id=eq.${encodeURIComponent(staff.id)}`,{last_login_at:nowIso(),display_name:staff.display_name||googleName,platform_member_id:member.id}).catch(()=>{});await logAdminLogin(env,selected.tenant_id,staff.id,staff.email||googleEmail,'google','success','tenant_login','','').catch(()=>{});const u=new URL(adminUrl);u.searchParams.set('tenant',selected.tenant_id);u.searchParams.set('admin_token',adminToken);return Response.redirect(u.toString(),302)}
    const selectionToken=await issueWorkspaceSelectionToken(googleEmail,workspaces.map(w=>w.tenant_id),env,{provider:'google',platform_member_id:member.id});const u=new URL(loginUrl);u.searchParams.set('workspace_token',selectionToken);return Response.redirect(u.toString(),302);
  }


  if (tenant === 'platform') {
    const platformRows = await dbGet(env,'platform_staff',`email=eq.${encodeURIComponent(googleEmail)}&is_active=eq.true&select=*`).catch(()=>[]);
    const ps = platformRows[0];
    if (!ps) {
      await logAdminLogin(env, 'platform', null, googleEmail, 'google', 'denied', 'not_platform_staff', '', '').catch(()=>{});
      return failRedirect('not_authorized', platformUrl);
    }
    const platformToken = await issueAdminToken({ ...ps, email: googleEmail, name: ps.name || googleName }, 'platform', env);
    await dbUpdate(env,'platform_staff',`email=eq.${encodeURIComponent(googleEmail)}`,{ last_login_at: new Date().toISOString() }).catch(()=>{});
    await logAdminLogin(env, 'platform', ps.id, googleEmail, 'google', 'success', 'platform_login', '', '').catch(()=>{});
    const u = new URL(platformUrl);
    u.searchParams.set('admin_token', platformToken);
    return Response.redirect(u.toString(), 302);
  }

  if (!tenant) {
    const platformRows = await dbGet(env,'platform_staff',`email=eq.${encodeURIComponent(googleEmail)}&is_active=eq.true&select=*`).catch(()=>[]);
    if (platformRows[0]) {
      const ps = platformRows[0];
      const platformToken = await issueAdminToken({ ...ps, email: googleEmail, name: ps.name || googleName }, 'platform', env);
      await dbUpdate(env,'platform_staff',`email=eq.${encodeURIComponent(googleEmail)}`,{ last_login_at: new Date().toISOString() }).catch(()=>{});
      await logAdminLogin(env, 'platform', ps.id, googleEmail, 'google', 'success', 'platform_login_from_home', '', '').catch(()=>{});
      const u = new URL(platformUrl);
      u.searchParams.set('admin_token', platformToken);
      return Response.redirect(u.toString(), 302);
    }

    const workspaces = await findAdminWorkspacesByEmail(env, googleEmail);
    if (!workspaces.length) {
      await logAdminLogin(env, '', null, googleEmail, 'google', 'denied', 'email_not_in_staff', '', '').catch(()=>{});
      return failRedirect('not_authorized', loginUrl);
    }

    if (workspaces.length === 1) {
      const workspace = workspaces[0];
      const staffRows = await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(workspace.tenant_id)}&email=eq.${encodeURIComponent(googleEmail)}&select=*`).catch(()=>[]);
      const staff = staffRows.find(r=>((r.is_active !== undefined ? r.is_active : r.active) !== false));
      if (!staff) return failRedirect('not_authorized', loginUrl);
      const adminToken = await issueAdminToken({ ...staff, email: googleEmail }, workspace.tenant_id, env);
      await dbUpdate(env,'staff',`id=eq.${encodeURIComponent(staff.id)}`,{ last_login_at: new Date().toISOString(), display_name: staff.display_name || googleName }).catch(()=>{});
      await logAdminLogin(env, workspace.tenant_id, staff.id, googleEmail, 'google', 'success', 'single_workspace', '', '').catch(()=>{});
      const u = new URL(adminUrl);
      u.searchParams.set('admin_token', adminToken);
      return Response.redirect(u.toString(), 302);
    }

    const selectionToken = await issueWorkspaceSelectionToken(googleEmail, workspaces.map(w=>w.tenant_id), env);
    const u = new URL(loginUrl);
    u.searchParams.set('workspace_token', selectionToken);
    return Response.redirect(u.toString(), 302);
  }

  const rows = await dbGet(env,'staff',`tenant_id=eq.${encodeURIComponent(tenant)}&email=eq.${encodeURIComponent(googleEmail)}&select=*`).catch(()=>[]);
  const staff = rows.find(r=>((r.is_active !== undefined ? r.is_active : r.active) !== false));
  if (!staff) {
    await logAdminLogin(env, tenant, null, googleEmail, 'google', 'denied', 'email_not_in_staff', '', '').catch(()=>{});
    return failRedirect('not_authorized', loginUrl);
  }

  await dbUpdate(env,'staff',`id=eq.${encodeURIComponent(staff.id)}`,{ last_login_at: new Date().toISOString(), display_name: staff.display_name || googleName }).catch(()=>{});
  const adminToken = await issueAdminToken({ ...staff, email: googleEmail }, tenant, env);
  await logAdminLogin(env, tenant, staff.id, googleEmail, 'google', 'success', 'tenant_login', '', '').catch(()=>{});
  const u = new URL(adminUrl);
  u.searchParams.set('tenant', tenant);
  u.searchParams.set('admin_token', adminToken);
  return Response.redirect(u.toString(), 302);
}

// POST /admin/logout
async function hAdminLogout(env, b) {
  // å‰ç«¯è² è²¬æ¸…é™¤ tokenï¼›å¾Œç«¯å¯åœ¨æ­¤å°‡ token åŠ å…¥é»‘åå–®ï¼ˆå¯æ“´å……ï¼‰
  // ç›®å‰ï¼šè¨˜éŒ„ç™»å‡ºäº‹ä»¶
  if (b && b.email && b.token) {
    const payload = await verifyAdminJwt(b.token, env).catch(()=>null);
    if (payload) {
      await logAdminLogin(env, payload.tenant_id||'', payload.staff_id||'', payload.email||b.email, 'google', 'success', 'logout', '', '');
    }
  }
  return jsonOk({ ok: true, message: 'å·²ç™»å‡º' });
}

// GET /admin/me
async function hAdminMe(env, p) {
  const token = p.token || p.admin_token;
  const email = p.email;
  if (!token) return jsonErr('æœªå¸¶ token', 401);
  const payload = await verifyAdminJwt(token, env);
  if (!payload) return jsonErr('token ç„¡æ•ˆæˆ–å·²éŽæœŸï¼Œè«‹é‡æ–°ç™»å…¥', 401);
  // email=_ è¡¨ç¤ºç”± JWT è‡ªè¡Œé©—è­‰ï¼Œä¸åš email æ¯”å°
  if (email && email !== '_' && email !== '__jwt__' && payload.email !== email) return jsonErr('token èˆ‡ email ä¸ç¬¦', 401);
  let tenant = { id: payload.tenant_id, name: payload.tenant_id, is_locked:false, locked_reason:'' };
  if (payload.tenant_id && payload.tenant_id !== 'platform') {
    const [ctx, lock] = await Promise.all([
      getTenantCtx(env, payload.tenant_id).catch(()=>null),
      checkTenantLocked(env, payload.tenant_id),
    ]);
    const agreementTemplates = await dbGet(
      env,
      'tenant_agreement_templates',
      `tenant_id=eq.${encodeURIComponent(payload.tenant_id)}&select=slot_no,label,title,content,version&order=slot_no.asc`
    ).catch(()=>[]);
    tenant = {
      id: payload.tenant_id,
      name: (ctx && ctx.name) || payload.tenant_id,
      is_locked: !!lock.locked,
      locked_reason: lock.reason || '',
      default_refund_rules: (ctx && ctx.defaultRefundRules) || DEFAULT_REFUND_RULES,
      payment_config: (ctx && ctx.paymentConfig) || {},
      agreement_templates: agreementTemplates,
    };
  }
  return jsonOk({
    email: payload.email,
    tenant_id: payload.tenant_id,
    tenant_name: tenant.name,
    tenant,
    locked: tenant.is_locked,
    locked_reason: tenant.locked_reason,
    staff_id: payload.staff_id,
    role: payload.role,
    normalized_role: payload.normalized_role,
    limit_sessions: payload.limit_sessions,
    display_name: payload.display_name,
    issued_at: payload.issued_at,
    expires_at: payload.expires_at,
  });
}

// è¨˜éŒ„ç™»å…¥ log
async function logAdminLogin(env, tenantId, staffId, email, provider, status, reason, ip, ua) {
  try {
    await dbInsert(env, 'admin_login_logs', {
      id: genId('LOG'),
      tenant_id: tenantId || '',
      staff_id: staffId || null,
      email: email || '',
      provider: provider || 'google',
      login_status: status || 'error',
      reason: reason || '',
      ip: ip || '',
      user_agent: ua || '',
      created_at: new Date().toISOString(),
    });
  } catch(e) { /* ç™»å…¥ log å¤±æ•—ä¸å½±éŸ¿ä¸»æµç¨‹ */ }
}

// adminLoginï¼ˆä¿ç•™ç”¨æ–¼ç·Šæ€¥æ¢å¾©ï¼Œä½†æ”¹ç‚ºéœ€è¦ç³»çµ±è¨­å®šçš„ EMERGENCY_ADMIN_KEYï¼‰
async function hAdminLogin(env, p) {
  // OAuth ç™»å…¥å•Ÿç”¨å¾Œï¼Œæ­¤ endpoint åƒ…ä¾›ç·Šæ€¥æ¢å¾©ç”¨
  // å¿…é ˆæä¾› EMERGENCY_ADMIN_KEY ç’°å¢ƒè®Šæ•¸æ‰èƒ½ä½¿ç”¨
  const emergencyKey = env.EMERGENCY_ADMIN_KEY;
  if (!emergencyKey) return jsonErr('Email ç›´æŽ¥ç™»å…¥å·²åœç”¨ï¼Œè«‹ä½¿ç”¨ LINE ç™»å…¥');
  if (!p.emergency_key || p.emergency_key !== emergencyKey) return jsonErr('ç„¡æ•ˆçš„ç·Šæ€¥ç™»å…¥é‡‘é‘°');

  const TENANT = p && p._tenantId;
  if (!TENANT) return jsonErr('ç„¡æ³•è¾¨è­˜ä¸»è¾¦ç©ºé–“');
  if (!p.email) return jsonErr('è«‹æä¾› email');

  const platformRows = await dbGet(env, 'platform_staff',
    `email=eq.${encodeURIComponent(p.email)}&is_active=eq.true&select=*`).catch(()=>[]);
  if (platformRows.length) {
    const ps = platformRows[0];
    const token = await issueAdminToken({ ...ps, email: p.email }, 'platform', env);
    const tc = await getTenantCtx(env, TENANT);
    return jsonOk({ success:true, role:ps.role, name:ps.name||'', token, tenantId:TENANT, tenantName:tc.name, isPlatformStaff:true });
  }

  const rows = await dbGet(env, 'staff', `tenant_id=eq.${TENANT}&email=eq.${encodeURIComponent(p.email)}&select=*`);
  if (!rows.length) return jsonErr('æ­¤å¸³è™Ÿç„¡ç®¡ç†å“¡æ¬Šé™');
  const isActive = rows[0].is_active;
  if (!isActive) return jsonErr('æ­¤å¸³è™Ÿå·²åœç”¨');
  const token = await issueAdminToken({ ...rows[0], email: p.email }, TENANT, env);
  const tc = await getTenantCtx(env, TENANT);
  return jsonOk({ success:true, role:rows[0].role, name:rows[0].name||'', token, tenantId:TENANT, tenantName:tc.name });
}

// getDashboard
async function hGetDashboard(env, p) {
  const TENANT = (p && p._tenantId) ;  // M-02ï¼štenant å·²ç”±è·¯ç”±å±¤é©—è­‰ï¼ˆè¦‹ routeGet/routePostï¼‰
  if (!await verifyStaff(env, p.email, p.token, TENANT)) return jsonErr('ç„¡æ¬Šé™');
  let qs = `tenant_id=eq.${TENANT}&select=review_status,payment_status,amount,transfer_status,refund_amount`;
  if (p.sessionId) qs += `&session_id=eq.${encodeURIComponent(p.sessionId)}`;
  if (p.eventId)   qs += `&event_id=eq.${encodeURIComponent(p.eventId)}`;
  const [regs, sesCnt, evtCnt] = await Promise.all([
    dbGet(env, 'registrations', qs),
    dbGet(env, 'sessions', `tenant_id=eq.${TENANT}&status=eq.%E5%A0%B1%E5%90%8D%E4%B8%AD&select=id`),
    dbGet(env, 'events', `tenant_id=eq.${TENANT}&status=neq.%E5%81%9C%E7%94%A8&select=id`),
  ]);
  const activeRegs = regs.filter(r => !_isCancelledReg(r));
  const paidList = activeRegs.filter(r=>isPaidStatus(r.payment_status));
  return jsonOk({
    total:activeRegs.length,
    pending:activeRegs.filter(r=>r.review_status==='å¾…å¯©æ ¸').length,
    approved:activeRegs.filter(r=>r.review_status==='å·²éŒ„å–').length,
    rejected:regs.filter(r=>r.review_status==='ä¸éŒ„å–').length,
    paid:paidList.length,
    revenue:paidList.reduce((s,r)=>s+(Number(r.amount)||0),0) - regs.reduce((s,r)=>s+safeNum(r.refund_amount),0),
    sessionCount:sesCnt.length, eventCount:evtCnt.length,
  });
}


// adminBusinessOverviewï¼šå¾Œå°ã€Œç¸½è¦½ã€é ä½¿ç”¨ã€‚
// åŽŸå‰‡ï¼šæ‰€æœ‰æ•¸å­—ç”± Worker å¾žåŒä¸€ä»½ Supabase å³æ™‚è¨ˆç®—ï¼Œå‰ç«¯åªè² è²¬é¡¯ç¤ºã€‚
function _adminDateInRange(dateStr, start, end){
  const d = new Date(dateStr || '');
  if (isNaN(d.getTime())) return false;
  return d >= start && d < end;
}
function _adminMonthStart(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function _adminNextMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 1); }
function _adminQuarterStart(d){ const q=Math.floor(d.getMonth()/3)*3; return new Date(d.getFullYear(), q, 1); }
function _adminNextQuarter(d){ const q=Math.floor(d.getMonth()/3)*3; return new Date(d.getFullYear(), q+3, 1); }
function _adminYearStart(d){ return new Date(d.getFullYear(),0,1); }
function _adminNextYear(d){ return new Date(d.getFullYear()+1,0,1); }
function _sessionDateValue(s){
  const dates = safeJson(s.dates_json || s.dates || s.date_json, []);
  if (Array.isArray(dates) && dates.length) {
    const parts = dates.map(d => typeof d === 'object' ? (d.date || d.day || d.start || d.startDate || '') : String(d||'')).filter(Boolean);
    if (parts.length) return parts.join('ã€');
  }
  return s.date || s.event_date || s.start_date || s.created_at || '';
}
function _sessionVenueValue(s){ return String(s.region||s.location||s.venue||s.place||'æœªè¨­å®šå ´åŸŸ').trim() || 'æœªè¨­å®šå ´åŸŸ'; }
function _sessionTypeValue(){ return 'æ´»å‹•å ´æ¬¡'; }
function _regStatus(r){ return String(r.status || r.reg_status || '').trim(); }
function _reviewStatus(r){ return String(r.review_status || r.status || '').trim(); }
function _payStatus(r){ return String(r.payment_status || '').trim(); }
function _transferStatus(r){ return String(r.transfer_status || r.refund_status || '').trim(); }
function _checkinStatus(r){ return String(r.checkin_status || r.checkin || '').trim(); }
function _clearStatus(r){ return String(r.clear_status || r.clearStatus || '').trim(); }
function _depositStatus(r){ return String(r.deposit_refunded || r.depositRefunded || '').trim(); }
function _invoiceStatus(r){ return String(r.invoice_status || r.invoiceStatus || '').trim(); }
function _firstNum() {
  for (const v of arguments) {
    if (v === null || v === undefined || v === '') continue;
    const n = Number(v);
    if (!isNaN(n)) return n;
  }
  return 0;
}
function _isFreePay(r){ return _payStatus(r)==='å…è²»' || (safeNum(r.amount)===0 && safeNum(r.total_amount)===0 && _payStatus(r).includes('å…è²»')); }
function _isPaidReg(r){ return isPaidStatus(_payStatus(r)) || _isFreePay(r); }
function _isConfirmedPaidReg(r){ return isPaidStatus(_payStatus(r)); }
function _isCancelledReg(r){
  const rev=_reviewStatus(r), st=_regStatus(r), tr=_transferStatus(r), pay=_payStatus(r);
  if (['å·²å–æ¶ˆ','ä¸éŒ„å–','æœªéŒ„å–'].includes(rev) || st==='cancelled') return true;
  if (isCapacityInactiveTransferStatus(tr)) return true;
  if (['å·²é€€è²»','å·²é€€æ¬¾'].includes(pay)) return true;
  return false;
}
function _isApprovedReg(r){ return _reviewStatus(r)==='å·²éŒ„å–'; }
function _isReceivableReg(r){
  if (_isCancelledReg(r)) return false;
  const p = _payStatus(r);
  // æ‡‰æ”¶åªèªã€Œå·²éŒ„å–å¾Œã€çš„æ­£å¼é‡‘é¡ï¼šæœªç¹³è²»ã€ä»˜æ¬¾å¾…ç¢ºèªã€å·²ç¹³è²»ï¼å·²ä»˜æ¬¾ã€å…è²»ã€‚
  return _isApprovedReg(r) || _isPendingPaymentReg(r) || _isPaidReg(r) || p === 'æœªç¹³è²»';
}
function _officialAmount(r){ return safeNum(_firstNum(r.amount, r.total_amount, r.total, r.registration_total_amount)); }
function _sessionDeposit(s){ return safeNum(_firstNum(s && s.deposit, s && s.deposit_amount, s && s.deposit_total)); }
function _regDeposit(r, s){
  const own = safeNum(_firstNum(r.deposit, r.deposit_total, r.deposit_amount));
  if (own > 0) return own;
  return _sessionDeposit(s);
}
function _officialDeposit(r, s){ return _regDeposit(r, s); }
function _officialRefund(r){ return safeNum(_firstNum(r.refund_amount, r.refund_total)); }
function _equipmentEntries(r){
  // å¾žè³‡æ–™åº«æ—¢æœ‰æ¬„ä½æŠ½å–è¨­å‚™ï¼Œä¸ç”¨å‰ç«¯çŒœã€ä¸ç”¨å‡è³‡æ–™ã€‚
  // å ±åè¨­å‚™å”¯ä¸€ä¾†æºï¼šregistrations.equipment_jsonã€‚
  const out = [];
  const push = (name, qty) => {
    name = normalizeEquipName(String(name || '').trim().replace(/^è¨­å‚™[:ï¼š]?/, ''));
    const n = Number(qty) || 0;
    if (!name || n <= 0) return;
    if (/^(ç„¡|æ²’æœ‰|æœªåŠ è³¼|ä¸éœ€|none)$/i.test(name)) return;
    out.push([name, n]);
  };
  const parseObj = (obj) => {
    obj = safeJson(obj, null);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    Object.entries(obj).forEach(([k,v]) => {
      if (v && typeof v === 'object') {
        push(k, v.qty ?? v.count ?? v.quantity ?? v.value ?? v.num ?? 0);
      } else {
        push(k, v);
      }
    });
  };
  parseObj(r.equipment_json);
  parseObj(r.equipment);
  parseObj(r.equip);

  const text = String(r.equipment_text || r.equipmentText || r.equip_text || r.equipment_summary || '').trim();
  if (text && !/^(ç„¡|æ²’æœ‰|æœªåŠ è³¼|ä¸éœ€|none)$/i.test(text)) {
    text.split(/[ã€,ï¼Œ;ï¼›\n]+/).forEach(part => {
      let s = String(part || '').trim();
      if (!s) return;
      s = s.replace(/^è¨­å‚™[:ï¼š]/, '').trim();
      let m = s.match(/^(.+?)[xXÃ—ï¼Š*]\s*(\d+(?:\.\d+)?)$/);
      if (!m) m = s.match(/^(.+?)[ï¼š:]\s*(\d+(?:\.\d+)?)$/);
      if (!m) m = s.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
      if (m) push(m[1], m[2]);
    });
  }
  const merged = {};
  out.forEach(([k,v]) => { merged[k] = (merged[k] || 0) + Number(v || 0); });
  return Object.entries(merged);
}
function _inc(map, key, n=1){ key=String(key||'æœªè¨­å®š').trim()||'æœªè¨­å®š'; map[key]=(map[key]||0)+n; }
function _mapToRows(map){ return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count})); }
function _aggregateBiz(sessions, regs, members, staff, start, end){
  const sesMap={}; sessions.forEach(s=>{sesMap[s.id]=s;});
  const ses = sessions.filter(s => !start || _adminDateInRange(_sessionDateValue(s), start, end));
  const sesIds = new Set(ses.map(s=>s.id));
  const rgs = regs.filter(r => !start ? true : (sesIds.has(r.session_id) || _adminDateInRange(r.created_at, start, end)));
  const paid = rgs.filter(_isPaidReg);
  const brandSet = new Set();
  rgs.forEach(r=>{ const k=String(r.brand_name||r.name||r.email||'').trim(); if(k) brandSet.add(k); });
  const memberSet = new Set();
  (members||[]).forEach(m=>{ if(!start || _adminDateInRange(m.updated_at||m.joined_at, start, end)){ const k=String(m.email||'').trim(); if(k) memberSet.add(k); } });
  const venueSet = new Set();
  ses.forEach(s=>{ const v=_sessionVenueValue(s); if(v) venueSet.add(v); });
  const equipmentMap={};
  rgs.forEach(r=>Object.entries(_effectiveEquipmentMapForReg(r, sesMap[r.session_id] || {})).forEach(([k,v])=>_inc(equipmentMap,k,v)));
  const gross = paid.reduce((sum,r)=>sum+_officialAmount(r),0);
  const depositTotal = paid.filter(_isConfirmedPaidReg).reduce((sum,r)=>sum+_regDeposit(r, sesMap[r.session_id]),0);
  const refundTotal = rgs.reduce((sum,r)=>sum+_officialRefund(r),0);
  return {
    sessions: ses.length,
    activeSessions: ses.filter(s=>!['åœç”¨','é—œé–‰','å·²é—œé–‰','å°å­˜'].includes(String(s.status||''))).length,
    registrations: rgs.length,
    members: memberSet.size,
    pending: rgs.filter(r=>_reviewStatus(r)==='å¾…å¯©æ ¸').length,
    approved: rgs.filter(r=>_reviewStatus(r)==='å·²éŒ„å–').length,
    waitlist: rgs.filter(r=>_reviewStatus(r)==='å‚™å–').length,
    rejected: rgs.filter(r=>_reviewStatus(r)==='ä¸éŒ„å–').length,
    cancelled: rgs.filter(r=>_reviewStatus(r)==='å·²å–æ¶ˆ' || _regStatus(r)==='cancelled').length,
    unpaid: rgs.filter(r=>_payStatus(r)==='æœªç¹³è²»').length,
    paymentPending: rgs.filter(r=>_payStatus(r)==='å¾…ç¢ºèª').length,
    paid: paid.length,
    free: rgs.filter(_isFreePay).length,
    grossRevenue: gross,
    depositTotal,
    refundTotal,
    netRevenue: Math.max(0, gross - refundTotal),
    brands: brandSet.size,
    venues: venueSet.size,
    checkinDone: rgs.filter(r=>_checkinStatus(r)==='å·²å ±åˆ°').length,
    checkinNotYet: rgs.filter(r=>_checkinStatus(r)==='æœªå ±åˆ°' || !_checkinStatus(r)).length,
    absent: rgs.filter(r=>_checkinStatus(r)==='æœªåˆ°').length,
    clearDone: rgs.filter(r=>_clearStatus(r)==='å·²æ¸…å ´').length,
    depositRefunded: rgs.filter(r=>_depositStatus(r)==='å·²é€€æŠ¼é‡‘').length,
    depositForfeited: rgs.filter(r=>_depositStatus(r)==='æŠ¼é‡‘æ²’æ”¶').length,
    invoiceCount: rgs.filter(r=>String(r.invoice_type||r.invoice_title||r.tax_id||r.invoice_email||'').trim()).length,
    invoiceIssued: rgs.filter(r=>_invoiceStatus(r)==='å·²é–‹ç«‹' || _invoiceStatus(r)==='å·²å¯„å‡º').length,
    equipmentTotal: Object.values(equipmentMap).reduce((a,b)=>a+b,0),
    equipmentItems: _mapToRows(equipmentMap).slice(0,10),
  };
}
function _financeIssuesForReg(r){
  const issues=[];
  const st=_payStatus(r), rev=_reviewStatus(r), tr=_transferStatus(r);
  const amt=_officialAmount(r), total=safeNum(r.total_amount), deposit=_officialDeposit(r);
  if(_isPaidReg(r) && amt<=0 && !_isFreePay(r)) issues.push('å·²ä»˜æ¬¾ä½†é‡‘é¡ç‚º 0 æˆ–ç¼ºå¤±');
  if(st==='å¾…ç¢ºèª' && amt<=0) issues.push('ä»˜æ¬¾å¾…ç¢ºèªä½†é‡‘é¡ç‚º 0 æˆ–ç¼ºå¤±');
  if((rev==='å·²å–æ¶ˆ' || _regStatus(r)==='cancelled') && _isPaidReg(r) && !['å·²é€€è²»','refunded'].includes(tr)) issues.push('å·²å–æ¶ˆä½†ä»ç‚ºå·²ä»˜æ¬¾ä¸”æœªå®Œæˆé€€è²»');
  if(deposit<0) issues.push('æŠ¼é‡‘é‡‘é¡ç•°å¸¸');
  if(total>0 && amt>0 && Math.abs(total-amt)>1 && !String(st).includes('å¾…')) issues.push('amount èˆ‡ total_amount ä¸ä¸€è‡´');
  if(st==='å¾…ç¢ºèª' && !String(r.payment_method||r.payment_last5||r.payment_reported_at||'').trim()) issues.push('ä»˜æ¬¾å¾…ç¢ºèªä½†ç¼ºä»˜æ¬¾è³‡æ–™');
  return issues;
}

// â”€â”€ æ¬Šé™ç¸®æ”¾é‡‘æµç¸½è¦½ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _financePeriodBounds(period,date,startDate,endDate){
  const now=new Date(),raw=String(date||'');
  let y=Number(raw.slice(0,4))||now.getUTCFullYear(),m=Number(raw.slice(5,7))||now.getUTCMonth()+1;
  if(period==='custom'){
    const s=String(startDate||'').slice(0,10),e=String(endDate||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!/^\d{4}-\d{2}-\d{2}$/.test(e))return {error:'è«‹é¸æ“‡è‡ªè¨‚èµ·è¨–æ—¥æœŸ'};
    const end=new Date(`${e}T00:00:00+08:00`);end.setDate(end.getDate()+1);
    return {start:`${s}T00:00:00+08:00`,end:end.toISOString(),label:`${s.replaceAll('-','/')}ï½ž${e.replaceAll('-','/')}`,startDate:s,endDate:e};
  }
  if(period==='all')return {start:null,end:null,label:'å…¨éƒ¨å ´æ¬¡æç›Š',startDate:'',endDate:''};
  if(period==='week'){
    const base=/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Date(`${raw}T12:00:00+08:00`):now;
    const day=(base.getDay()+6)%7,start=new Date(base);start.setDate(base.getDate()-day);
    const end=new Date(start);end.setDate(start.getDate()+7);
    const sd=start.toISOString().slice(0,10),ed=new Date(end.getTime()-86400000).toISOString().slice(0,10);
    return {start:`${sd}T00:00:00+08:00`,end:end.toISOString(),label:`æœ¬é€±å ´æ¬¡æç›Š ${sd.replaceAll('-','/')}ï½ž${ed.replaceAll('-','/')}`,startDate:sd,endDate:ed};
  }
  if(period==='year')return {start:`${y}-01-01T00:00:00+08:00`,end:`${y+1}-01-01T00:00:00+08:00`,label:`${y} å¹´å ´æ¬¡æç›Š`,startDate:`${y}-01-01`,endDate:`${y}-12-31`};
  if(period==='quarter'){
    const q=Math.floor((m-1)/3),sm=q*3+1,ey=sm+3>12?y+1:y,em=(sm+2)%12+1,last=new Date(y,sm+2,0).getDate();
    return {start:`${y}-${String(sm).padStart(2,'0')}-01T00:00:00+08:00`,end:`${ey}-${String(em).padStart(2,'0')}-01T00:00:00+08:00`,label:`${y} å¹´ç¬¬ ${q+1} å­£å ´æ¬¡æç›Š`,startDate:`${y}-${String(sm).padStart(2,'0')}-01`,endDate:`${y}-${String(sm+2).padStart(2,'0')}-${String(last).padStart(2,'0')}`};
  }
  const ey=m===12?y+1:y,em=m===12?1:m+1,last=new Date(y,m,0).getDate();
  return {start:`${y}-${String(m).padStart(2,'0')}-01T00:00:00+08:00`,end:`${ey}-${String(em).padStart(2,'0')}-01T00:00:00+08:00`,label:`${y} å¹´ ${m} æœˆå ´æ¬¡æç›Š`,startDate:`${y}-${String(m).padStart(2,'0')}-01`,endDate:`${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`};
}
function _finInRange(v,b){if(!b.start)return true;const t=new Date(v||0).getTime();return t>=new Date(b.start).getTime()&&t<new Date(b.end).getTime()}
function _finBucket(v,period){
  const d=new Date(v||0);if(isNaN(d))return '';
  const y=d.getUTCFullYear(),m=d.getUTCMonth()+1,day=d.getUTCDate();
  if(period==='year'||period==='quarter'||period==='all')return `${y}-${String(m).padStart(2,'0')}`;
  if(period==='week'||period==='custom')return `${String(m).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
  return `${String(day).padStart(2,'0')}æ—¥`;
}
async function hFinanceReport(env,p){
  const TENANT=p&&p._tenantId;
  if(!await verifyStaff(env,p.email,p.token,TENANT,'finance'))return jsonErr('ç„¡æ¬Šé™',403);
  const jwt=await verifyAdminJwt(p.token,env);
  const role=String((jwt&&(jwt.normalized_role||jwt.role))||'');
  const allowed=await getStaffScopedSessionIds(env,TENANT,p.email,role);
  const period=String(p.period||'month');
  const bounds=_financePeriodBounds(period,p.date,p.startDate,p.endDate);
  if(bounds.error)return jsonErr(bounds.error);
  const eventId=String(p.eventId||'');

  const [sessionsRaw,events,regs,pays,allocs,items,ledger,regItems]=await Promise.all([
    dbGet(env,'sessions',`tenant_id=eq.${TENANT}&select=*`),
    dbGet(env,'events',`tenant_id=eq.${TENANT}&select=id,title`),
    dbGet(env,'registrations',`tenant_id=eq.${TENANT}&select=*`),
    dbGet(env,'payments',`tenant_id=eq.${TENANT}&select=*`),
    dbGet(env,'payment_allocations',`tenant_id=eq.${TENANT}&select=*`),
    dbGet(env,'finance_items',`tenant_id=eq.${TENANT}&select=*`),
    dbGet(env,'finance_ledger',`tenant_id=eq.${TENANT}&select=*`),
    dbGet(env,'registration_items',`tenant_id=eq.${TENANT}&select=*`)
  ]);

  let sessions=Array.isArray(allowed)?sessionsRaw.filter(s=>allowed.includes(String(s.id))):sessionsRaw;
  if(eventId)sessions=sessions.filter(s=>String(s.event_id||'')===eventId);
  // å ±è¡¨æœŸé–“ç¯©é¸çš„æ˜¯ã€Œå ´æ¬¡æ—¥æœŸã€ï¼›é¸ä¸­çš„å ´æ¬¡æœƒç´å…¥å®Œæ•´ç”Ÿå‘½é€±æœŸæ”¶æ”¯ï¼Œæ‰èƒ½ç®—å‡ºçœŸå¯¦å–®å ´æç›Šã€‚
  if(period!=='all')sessions=sessions.filter(s=>_finInRange(_sessionFirstDate(s),bounds));
  const ids=new Set(sessions.map(s=>String(s.id)));
  const sm={},regMap={},itemMap={};
  sessions.forEach(s=>sm[String(s.id)]=s);
  regs.forEach(r=>regMap[String(r.id||'')]=r);
  regItems.forEach(it=>{const rid=String(it.registration_id||'');if(!rid)return;(itemMap[rid]||(itemMap[rid]=[])).push(it)});

  const newRow=s=>({
    id:String(s.id),eventId:String(s.event_id||''),name:s.name||String(s.id),date:_sessionFirstDate(s),venue:s.venue||'',
    revenueCash:0,otherIncome:0,operatingIncome:0,depositCollected:0,cashInflow:0,
    operatingExpense:0,revenueRefunded:0,depositRefunded:0,cashOutflow:0,cashNet:0,
    activityProfit:0,receivableClosing:0,outstanding:0,overpaid:0,depositDeducted:0,depositHeld:0,
    internalTransferIn:0,internalTransferOut:0
  });
  const sessionRows={};sessions.forEach(s=>sessionRows[String(s.id)]=newRow(s));
  const inPeriod=()=>true;
  const beforeEnd=()=>true;
  const timeline={},transactions=[],anomalies=[];
  const addTimeline=(at,side,amt)=>{if(!inPeriod(at))return;const b=_finBucket(at,period);if(!timeline[b])timeline[b]={label:b,income:0,expense:0,net:0};timeline[b][side]+=amt;timeline[b].net=timeline[b].income-timeline[b].expense};
  const addTx=x=>{transactions.push(x);addTimeline(x.date,x.side==='income'?'income':'expense',x.amount)};
  const addAnomaly=(type,label,detail,sessionId,registrationId,referenceId)=>anomalies.push({type,label,detail:detail||'',sessionId:sessionId||'',registrationId:registrationId||'',referenceId:referenceId||''});
  const paidStatus=pay=>{const s=String(pay.status||'').toLowerCase();return s.includes('ç¢ºèª')||s.includes('å·²ç¹³')||s==='paid'||s==='confirmed'||s==='success'};

  // å»ºç«‹æ¯ç­†å ±åçš„æ­£å¼æ‡‰æ”¶çµæ§‹ï¼Œæ˜Žç´°å„ªå…ˆã€registrations å„²å­˜å€¼æ¬¡ä¹‹ã€‚
  const regFinance={};
  for(const r of regs){
    const sid=String(r.session_id||'');if(!ids.has(sid))continue;
    const m=_regFinanceAmounts(r,sm[sid]||{},itemMap[String(r.id||'')]||[]);
    regFinance[String(r.id||'')]={...m,sid,reg:r};
    if(m.cashTotal>0&&m.depositTotal>m.cashTotal)addAnomaly('deposit_over_total','æŠ¼é‡‘é«˜æ–¼ç¸½æ‡‰æ”¶',`ç¸½æ‡‰æ”¶ ${m.cashTotal}ï¼ŒæŠ¼é‡‘ ${m.depositTotal}`,sid,r.id,'');
    if(m.source==='none'&&(_isApprovedReg(r)||_isConfirmedPaidReg(r)))addAnomaly('missing_receivable','å·²éŒ„å–ï¼å·²ä»˜æ¬¾ä½†æ‰¾ä¸åˆ°æ­£å¼æ‡‰æ”¶é‡‘é¡','è«‹æª¢æŸ¥ registration_items æˆ– registrations.total_amount/amount',sid,r.id,'');
  }

  // ä»˜æ¬¾ä»¥ allocation ç‚ºå„ªå…ˆï¼›åŒä¸€ payment æœ‰ allocation æ™‚ä¸å† fallback paymentï¼Œé¿å…é‡è¤‡ã€‚
  const paymentEvents=[];
  const allocatedPaymentIds=new Set();
  for(const a of allocs){
    const rid=String(a.registration_id||'');const rf=regFinance[rid];
    const sid=String(a.session_id||(rf&&rf.sid)||'');
    if(!ids.has(sid))continue;
    if(String(a.allocation_type||'payment').toLowerCase()==='refund')continue;
    const amt=Math.max(0,safeNum(a.amount));if(!amt)continue;
    allocatedPaymentIds.add(String(a.payment_id||''));
    paymentEvents.push({rid,sid,amount:amt,date:a.created_at,source:'payment_allocation',referenceId:String(a.id||''),paymentId:String(a.payment_id||'')});
  }
  for(const pay of pays){
    const pid=String(pay.id||'');if(allocatedPaymentIds.has(pid)||!paidStatus(pay))continue;
    const rid=String(pay.registration_id||'');const rf=regFinance[rid];
    const sid=String(pay.session_id||(rf&&rf.sid)||'');
    if(!ids.has(sid)){if(rid||pid)addAnomaly('orphan_payment','å·²ç¢ºèªä»˜æ¬¾æ‰¾ä¸åˆ°å¯æ­¸å±¬å ´æ¬¡',`ä»˜æ¬¾é‡‘é¡ ${safeNum(pay.amount)}`,'',rid,pid);continue}
    const amt=Math.max(0,safeNum(pay.amount));if(!amt)continue;
    paymentEvents.push({rid,sid,amount:amt,date:pay.paid_at||pay.created_at,source:'payment',referenceId:pid,paymentId:pid});
  }
  paymentEvents.sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));

  // å°æ¯ç­†å ±åä¾ã€Œç‡Ÿæ¥­æ”¶å…¥å„ªå…ˆã€æŠ¼é‡‘å…¶æ¬¡ã€æ‹†åˆ†å¯¦æ”¶ï¼Œé¿å…æŠ¼é‡‘èª¤åˆ—æ”¶å…¥ã€‚
  const paidRunning={};
  for(const e of paymentEvents){
    const rf=regFinance[e.rid];const row=sessionRows[e.sid];if(!row)continue;
    const prev=paidRunning[e.rid]||0,next=prev+e.amount;paidRunning[e.rid]=next;
    const revenueCap=rf?rf.revenueTotal:0,depositCap=rf?rf.depositTotal:0;
    const prevRevenue=Math.min(revenueCap,prev),nextRevenue=Math.min(revenueCap,next);
    const prevDeposit=Math.min(depositCap,Math.max(0,prev-revenueCap)),nextDeposit=Math.min(depositCap,Math.max(0,next-revenueCap));
    const revenuePart=Math.max(0,nextRevenue-prevRevenue),depositPart=Math.max(0,nextDeposit-prevDeposit),unclassified=Math.max(0,e.amount-revenuePart-depositPart);
    if(inPeriod(e.date)){
      if(revenuePart){row.revenueCash+=revenuePart;row.operatingIncome+=revenuePart;row.cashInflow+=revenuePart;addTx({date:e.date,side:'income',category:'å ±åæ”¶å…¥',amount:revenuePart,sessionId:e.sid,sessionName:row.name,registrationId:e.rid,source:e.source,referenceId:e.referenceId,note:'ä¸å«æŠ¼é‡‘'})}
      if(depositPart){row.depositCollected+=depositPart;row.cashInflow+=depositPart;addTx({date:e.date,side:'income',category:'ä»£æ”¶æŠ¼é‡‘',amount:depositPart,sessionId:e.sid,sessionName:row.name,registrationId:e.rid,source:e.source,referenceId:e.referenceId,note:'è² å‚µæ€§è³ªï¼Œä¸åˆ—æ´»å‹•æ”¶å…¥'})}
      if(unclassified){row.cashInflow+=unclassified;row.overpaid+=unclassified;addTx({date:e.date,side:'income',category:'å¾…é‡æ¸…æº¢æ”¶',amount:unclassified,sessionId:e.sid,sessionName:row.name,registrationId:e.rid,source:e.source,referenceId:e.referenceId,note:'è¶…éŽæ­£å¼æ‡‰æ”¶ï¼Œæš«ä¸åˆ—æ´»å‹•æ”¶å…¥'});addAnomaly('overpayment','ä»˜æ¬¾è¶…éŽæ­£å¼æ‡‰æ”¶',`æº¢æ”¶ ${unclassified}`,e.sid,e.rid,e.referenceId)}
    }
  }

  // æœŸæœ«æ‡‰æ”¶ï¼æœªæ”¶ï¼æº¢æ”¶ï¼šä½¿ç”¨æˆªè‡³æœŸæœ«ç´¯è¨ˆä»˜æ¬¾ï¼Œä¸å—å ±è¡¨é–‹å§‹æ—¥å½±éŸ¿ã€‚
  const paidToEnd={};
  for(const e of paymentEvents){if(beforeEnd(e.date))paidToEnd[e.rid]=(paidToEnd[e.rid]||0)+e.amount}
  for(const [rid,rf] of Object.entries(regFinance)){
    const r=rf.reg,row=sessionRows[rf.sid];if(!row)continue;
    const created=r.created_at||_sessionFirstDate(sm[rf.sid]);if(!beforeEnd(created)||!_isActiveFinanceReg(r)||!_isApprovedReg(r)||_isFreePay(r))continue;
    row.receivableClosing+=rf.cashTotal;
    const paid=paidToEnd[rid]||0;
    row.outstanding+=Math.max(0,rf.cashTotal-paid);
    row.overpaid+=Math.max(0,paid-rf.cashTotal);
  }

  // ä¸»è¾¦æ‰‹å‹•æ”¶æ”¯ï¼šåªèªæ­£å¼ finance_itemsï¼Œæ—¥æœŸå„ªå…ˆä½¿ç”¨å¸³å‹™æ—¥æœŸï¼ˆè‹¥è³‡æ–™åº«åªæœ‰ created_at å‰‡æ²¿ç”¨ created_atï¼‰ã€‚
  for(const it of items){
    const sid=String(it.session_id||'');if(!ids.has(sid)||it.is_auto===true)continue;
    const at=it.item_date||it.occurred_at||it.created_at;if(!inPeriod(at))continue;
    const row=sessionRows[sid],amt=Math.max(0,safeNum(it.amount));if(!amt)continue;
    const kind=_financeItemKind(it.type),part=_financeItemParts(it.name);
    if(kind==='æ”¯å‡º'){
      row.operatingExpense+=amt;row.cashOutflow+=amt;
      addTx({date:at,side:'expense',category:part.category||'å…¶ä»–æ”¯å‡º',amount:amt,sessionId:sid,sessionName:row.name,source:'finance_item',referenceId:String(it.id||''),note:part.note||'',editable:true});
    }else{
      row.otherIncome+=amt;row.operatingIncome+=amt;row.cashInflow+=amt;
      addTx({date:at,side:'income',category:part.category||'å…¶ä»–æ”¶å…¥',amount:amt,sessionId:sid,sessionName:row.name,source:'finance_item',referenceId:String(it.id||''),note:part.note||'',editable:true});
    }
  }

  // é€€æ¬¾èˆ‡æŠ¼é‡‘äº‹ä»¶ï¼šé€€æ¬¾ã€æŠ¼é‡‘é€€å›žã€æŠ¼é‡‘æ‰£é™¤åˆ†é–‹ï¼›å»¶æœŸè½‰å…¥è½‰å‡ºæ˜¯å…§éƒ¨é‡åˆ†é¡žï¼Œä¸çŒå¤§å…¬å¸ç¾é‡‘æ”¶æ”¯ã€‚
  const depositEventsByReg={};
  for(const l of ledger){
    const sid=String(l.session_id||'');if(!ids.has(sid))continue;
    const row=sessionRows[sid],at=l.created_at,amt=Math.max(0,Math.abs(safeNum(l.amount)));if(!amt)continue;
    const et=String(l.entry_type||'').toLowerCase(),dir=String(l.direction||'').toLowerCase(),rid=String(l.registration_id||'');
    if(et.includes('deposit_refund')){
      if(inPeriod(at)){row.depositRefunded+=amt;row.cashOutflow+=amt;addTx({date:at,side:'expense',category:'é€€é‚„æŠ¼é‡‘',amount:amt,sessionId:sid,sessionName:row.name,registrationId:rid,source:'finance_ledger',referenceId:String(l.id||''),note:l.memo||'æŠ¼é‡‘é€€é‚„ï¼Œä¸åˆ—æ´»å‹•æ”¯å‡º'})}
      if(beforeEnd(at)){(depositEventsByReg[rid]||(depositEventsByReg[rid]={refund:0,deduct:0})).refund+=amt}
    }else if(et.includes('deposit_forfeit')||et.includes('deposit_deduct')){
      if(inPeriod(at)){row.depositDeducted+=amt;row.otherIncome+=amt;row.operatingIncome+=amt;addTx({date:at,side:'income',category:'æŠ¼é‡‘æ‰£æ¬¾è½‰æ”¶å…¥',amount:amt,sessionId:sid,sessionName:row.name,registrationId:rid,source:'finance_ledger',referenceId:String(l.id||''),note:l.memo||'ç”±ä»£ç®¡æŠ¼é‡‘è½‰ç‚ºæ”¶å…¥ï¼Œæ²’æœ‰æ–°å¢žç¾é‡‘æµ'})}
      if(beforeEnd(at)){(depositEventsByReg[rid]||(depositEventsByReg[rid]={refund:0,deduct:0})).deduct+=amt}
    }else if(et==='transfer_credit_in'){
      row.internalTransferIn+=inPeriod(at)?amt:0;
    }else if(et==='transfer_credit_out'){
      row.internalTransferOut+=inPeriod(at)?amt:0;
    }else if(et.includes('refund')||et.includes('é€€æ¬¾')||et.includes('é€€è²»')){
      if(inPeriod(at)){row.revenueRefunded+=amt;row.cashOutflow+=amt;addTx({date:at,side:'expense',category:'ç‡Ÿæ¥­é€€æ¬¾',amount:amt,sessionId:sid,sessionName:row.name,registrationId:rid,source:'finance_ledger',referenceId:String(l.id||''),note:l.memo||''})}
    }else if(dir==='in'||dir==='credit'){
      if(inPeriod(at)){row.otherIncome+=amt;row.operatingIncome+=amt;row.cashInflow+=amt;addTx({date:at,side:'income',category:'å…¶ä»–å¸³æœ¬æ”¶å…¥',amount:amt,sessionId:sid,sessionName:row.name,registrationId:rid,source:'finance_ledger',referenceId:String(l.id||''),note:l.memo||''})}
    }else if(dir==='out'||dir==='debit'){
      if(inPeriod(at)){row.operatingExpense+=amt;row.cashOutflow+=amt;addTx({date:at,side:'expense',category:'å…¶ä»–å¸³æœ¬æ”¯å‡º',amount:amt,sessionId:sid,sessionName:row.name,registrationId:rid,source:'finance_ledger',referenceId:String(l.id||''),note:l.memo||''})}
    }
  }

  // æœŸæœ«ä»£ç®¡æŠ¼é‡‘ï¼šä¾å¯¦éš›æ”¶æ¬¾æ‹†åˆ†å‡ºçš„æŠ¼é‡‘ï¼Œæ‰£é™¤é€€é‚„èˆ‡æ‰£æ¬¾ï¼›é€ç­†å¯è¿½æº¯ã€‚
  const depositPaidEnd={};
  for(const [rid,rf] of Object.entries(regFinance)){
    const paid=paidToEnd[rid]||0;depositPaidEnd[rid]=Math.min(rf.depositTotal,Math.max(0,paid-rf.revenueTotal));
    const ev=depositEventsByReg[rid]||{refund:0,deduct:0};
    const held=Math.max(0,depositPaidEnd[rid]-ev.refund-ev.deduct);
    if(sessionRows[rf.sid])sessionRows[rf.sid].depositHeld+=held;
    if(ev.refund+ev.deduct>depositPaidEnd[rid]+0.01)addAnomaly('deposit_negative','æŠ¼é‡‘é€€é‚„ï¼æ‰£é™¤è¶…éŽå¯¦æ”¶æŠ¼é‡‘',`å¯¦æ”¶æŠ¼é‡‘ ${depositPaidEnd[rid]}ï¼Œå·²é€€ï¼æ‰£ ${ev.refund+ev.deduct}`,rf.sid,rid,'');
  }

  const bySession=Object.values(sessionRows).map(x=>{
    x.activityProfit=x.operatingIncome-x.operatingExpense-x.revenueRefunded;
    x.cashNet=x.cashInflow-x.cashOutflow;
    return x;
  }).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.name).localeCompare(String(b.name)));
  const sessionTimeline={};
  for(const row of bySession){
    const bucket=_finBucket(row.date,period);if(!bucket)continue;
    if(!sessionTimeline[bucket])sessionTimeline[bucket]={label:bucket,income:0,expense:0,net:0};
    sessionTimeline[bucket].income+=safeNum(row.operatingIncome);
    sessionTimeline[bucket].expense+=safeNum(row.operatingExpense)+safeNum(row.revenueRefunded);
    sessionTimeline[bucket].net=sessionTimeline[bucket].income-sessionTimeline[bucket].expense;
  }

  const keys=['revenueCash','otherIncome','operatingIncome','depositCollected','cashInflow','operatingExpense','revenueRefunded','depositRefunded','cashOutflow','cashNet','activityProfit','receivableClosing','outstanding','overpaid','depositDeducted','depositHeld','internalTransferIn','internalTransferOut'];
  const totals={};keys.forEach(k=>totals[k]=0);bySession.forEach(x=>keys.forEach(k=>totals[k]+=safeNum(x[k])));
  // ç›¸å®¹èˆŠå‰ç«¯æ¬„ä½ï¼Œä½†å€¼æ”¹ç‚ºæ­£ç¢ºæœƒè¨ˆå£å¾‘ã€‚
  totals.registrationRevenue=totals.revenueCash;totals.totalIncome=totals.operatingIncome;totals.totalExpense=totals.operatingExpense+totals.revenueRefunded;totals.netProfit=totals.activityProfit;totals.receivable=totals.receivableClosing;totals.received=totals.revenueCash+totals.depositCollected;

  const expenseMap={};
  for(const tx of transactions.filter(x=>x.side==='expense')){
    const name=String(tx.category||'å…¶ä»–æ”¯å‡º');if(!expenseMap[name])expenseMap[name]={name,amount:0,sessions:{}};expenseMap[name].amount+=safeNum(tx.amount);
    const sid=String(tx.sessionId||'');if(!expenseMap[name].sessions[sid])expenseMap[name].sessions[sid]={id:sid,name:tx.sessionName||sid,date:(sm[sid]&&_sessionFirstDate(sm[sid]))||'',amount:0};expenseMap[name].sessions[sid].amount+=safeNum(tx.amount);
  }
  const expenseCategories=Object.values(expenseMap).map(x=>({name:x.name,amount:x.amount,sessions:Object.values(x.sessions).sort((a,b)=>b.amount-a.amount)})).sort((a,b)=>b.amount-a.amount);
  transactions.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.sessionName).localeCompare(String(b.sessionName)));

  const duplicateNames={};bySession.forEach(x=>duplicateNames[String(x.name||'')]=(duplicateNames[String(x.name||'')]||0)+1);
  const alerts=[];
  const loss=bySession.filter(x=>x.activityProfit<0),unpaid=bySession.filter(x=>x.outstanding>0),dup=bySession.filter(x=>duplicateNames[String(x.name||'')]>1);
  if(loss.length)alerts.push({type:'loss',label:`${loss.length} å€‹å ´æ¬¡æ´»å‹•æç›Šç‚ºè² æ•¸`,sessionIds:loss.map(x=>x.id)});
  if(unpaid.length)alerts.push({type:'unpaid',label:`æœŸæœ«å°šæœ‰ NT$ ${unpaid.reduce((n,x)=>n+x.outstanding,0).toLocaleString('zh-TW')} æœªæ”¶`,sessionIds:unpaid.map(x=>x.id)});
  if(totals.overpaid>0)alerts.push({type:'overpaid',label:`æœ‰ NT$ ${totals.overpaid.toLocaleString('zh-TW')} æº¢æ”¶ï¼å¾…é‡æ¸…æ¬¾`,sessionIds:bySession.filter(x=>x.overpaid>0).map(x=>x.id)});
  if(dup.length)alerts.push({type:'duplicate',label:'ç™¼ç¾åŒåå ´æ¬¡ï¼›å ±è¡¨ä»¥å ´æ¬¡ ID åˆ†é–‹ï¼Œä¸æœƒè‡ªè¡Œåˆä½µã€‚',sessionIds:dup.map(x=>x.id)});
  if(anomalies.length)alerts.push({type:'data',label:`ç™¼ç¾ ${anomalies.length} ç­†å¸³å‹™è³‡æ–™éœ€è¦æ ¸å°`,sessionIds:[...new Set(anomalies.map(x=>x.sessionId).filter(Boolean))]});

  return jsonOk({
    period,bounds,reportTitle:bounds.label,
    accountingBasis:'å…ˆä¾æ¯å€‹å ´æ¬¡å½™æ•´å®Œæ•´ç”Ÿå‘½é€±æœŸçš„æ”¶å…¥ã€æ”¯å‡ºã€é€€æ¬¾èˆ‡æŠ¼é‡‘ï¼Œå†æŒ‰ç…§å ´æ¬¡æ—¥æœŸåŠ ç¸½åˆ°æ‰€é¸æœˆä»½ï¼›æŠ¼é‡‘ä¸åˆ—æ´»å‹•æç›Šï¼Œå»¶æœŸè½‰å…¥ï¼è½‰å‡ºä¸é‡è¤‡è¨ˆå…¥ã€‚',
    counts:{transactions:transactions.length,sessions:bySession.length,anomalies:anomalies.length},alerts,anomalies,totals,
    statements:{
      cashFlow:[{label:'ç‡Ÿæ¥­æ¬¾å¯¦æ”¶',amount:totals.revenueCash},{label:'å…¶ä»–ç¾é‡‘æ”¶å…¥',amount:totals.otherIncome},{label:'æŠ¼é‡‘æ”¶å–',amount:totals.depositCollected},{label:'ç¾é‡‘æµå…¥åˆè¨ˆ',amount:totals.cashInflow,total:true},{label:'ç‡Ÿé‹æ”¯å‡º',amount:totals.operatingExpense},{label:'ç‡Ÿæ¥­é€€æ¬¾',amount:totals.revenueRefunded},{label:'æŠ¼é‡‘é€€é‚„',amount:totals.depositRefunded},{label:'ç¾é‡‘æµå‡ºåˆè¨ˆ',amount:totals.cashOutflow,total:true},{label:'ç¾é‡‘æ·¨è®Šå‹•',amount:totals.cashNet,total:true,net:true}],
      profitLoss:[{label:'å ±åæ¬¾å¯¦æ”¶ï¼ˆä¸å«æŠ¼é‡‘ï¼‰',amount:totals.revenueCash},{label:'å…¶ä»–ç‡Ÿæ¥­æ”¶å…¥',amount:totals.otherIncome},{label:'æŠ¼é‡‘æ‰£æ¬¾è½‰æ”¶å…¥',amount:totals.depositDeducted},{label:'ç‡Ÿæ¥­æ”¶å…¥åˆè¨ˆ',amount:totals.operatingIncome,total:true},{label:'ç‡Ÿé‹æ”¯å‡º',amount:totals.operatingExpense},{label:'ç‡Ÿæ¥­é€€æ¬¾',amount:totals.revenueRefunded},{label:'æ´»å‹•æç›Š',amount:totals.activityProfit,total:true,net:true}],
      receivables:[{label:'æœŸæœ«æ­£å¼æ‡‰æ”¶',amount:totals.receivableClosing},{label:'æœŸæœ«å°šæœªæ”¶åˆ°',amount:totals.outstanding},{label:'æº¢æ”¶ï¼å¾…é‡æ¸…',amount:totals.overpaid}],
      deposits:[{label:'æœ¬æœŸæ”¶å–æŠ¼é‡‘',amount:totals.depositCollected},{label:'æœ¬æœŸé€€é‚„æŠ¼é‡‘',amount:totals.depositRefunded},{label:'æœ¬æœŸæ‰£æ¬¾è½‰æ”¶å…¥',amount:totals.depositDeducted},{label:'æœŸæœ«ä»£ç®¡æŠ¼é‡‘',amount:totals.depositHeld,total:true}]
    },
    timeline:Object.values(sessionTimeline).sort((a,b)=>a.label.localeCompare(b.label)),expenseCategories,bySession,transactions,
    events:events.map(e=>({id:e.id,title:e.title||e.id})),generatedAt:nowIso()
  });
}
async function hFinanceOverview(env,p){
  const TENANT=p&&p._tenantId;
  if(!await verifyStaff(env,p.email,p.token,TENANT,'finance'))return jsonErr('ç„¡æ¬Šé™',403);
  const jwt=await verifyAdminJwt(p.token,env);
  const role=String((jwt&&(jwt.normalized_role||jwt.role))||'').trim();
  const allowedIds=await getStaffScopedSessionIds(env,TENANT,p.email,role);
  const month=String(p.month||'').trim();
  const eventId=String(p.eventId||p.event_id||'').trim();

  const [sessionsRaw,events]=await Promise.all([
    dbGet(env,'sessions',`tenant_id=eq.${TENANT}&select=*`).catch(()=>[]),
    dbGet(env,'events',`tenant_id=eq.${TENANT}&select=*`).catch(()=>[])
  ]);
  let sessions=Array.isArray(allowedIds)?sessionsRaw.filter(s=>allowedIds.includes(String(s.id))):sesß~½é¼­zÊ&ŠÛ^t°Í•ÍÍ¥½¹ÍI…Ü°•Ù•¹ÑÍt€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€•Ù•¹ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€t¤ì(€½¹ÍÐÍ•ÍÍ¥½¹Ì€ôÉÉ…ä¹¥ÍÉÉ…ä¡…±±½Ý•‘M•Í%‘Ì¤€üÍ•ÍÍ¥½¹ÍI…Ü¹™¥±Ñ•È¡Ì€ôø…±±½Ý•‘M•Í%‘Ì¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡Ì¹¥¤¤¤€èÍ•ÍÍ¥½¹ÍI…Üì(€½¹ÍÐ¥Ñ•µ5…À€ô…Ý…¥Ð}•ÑI•¥ÍÑÉ…Ñ¥½¹%Ñ•µÍ½ÉI•Ì¡•¹Ø°…±±I•Ì¤ì(€½¹ÍÐ•ÙÑ5…À€ôíôì•Ù•¹ÑÌ¹™½É… ¡”ôù•ÙÑ5…Ám”¹¥‘tõ”¤ì(€É•ÑÕÉ¸©Í½¹=¬¡Í•ÍÍ¥½¹Ì¹µ…À¡Ì€ôø}‰Õ¥±‘‘µ¥¹M•ÍÍ¥½¹I½Ü¡Ì°…±±I•Ì¹™¥±Ñ•È¡ÈôùMÑÉ¥¹œ¡È¹Í•ÍÍ¥½¹}¥¤ôôõMÑÉ¥¹œ¡Ì¹¥¤¤°•ÙÑ5…ÁmÌ¹•Ù•¹Ñ}¥‘tñðíô°¥Ñ•µ5…À¤¤¤ì)ô((¼¼•ÑI•Ì)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑI•Ì¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€±•ÐÅÌ€ôÑ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€ì(€¥˜€¡À¹Í•ÍÍ¥½¹%¤ÅÌ€¬ô€™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡À¹Í•ÍÍ¥½¹%¥õ€ì(€¥˜€¡À¹•Ù•¹Ñ%¤€€ÅÌ€¬ô€™•Ù•¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡À¹•Ù•¹Ñ%¥õ€ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°ÅÌ¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É½ÝÌ¹µ…À¡Èôø¡ì(€€€¥éÈ¹¥°Í•ÍÍ¥½¹%éÈ¹Í•ÍÍ¥½¹}¥°•Ù•¹Ñ%éÈ¹•Ù•¹Ñ}¥°(€€€•µ…¥°éÈ¹•µ…¥°°¹…µ”éÈ¹¹…µ”°Á¡½¹”éÈ¹Á¡½¹”°(€€€‰É…¹éÈ¹‰É…¹‘}¹…µ”°‰É…¹‘%¹ÑÉ¼éÈ¹‰É…¹‘}¥¹ÑÉ½ñðœœ°Í•±±…ÐéÈ¹Í•±±}…Ñ•½Éä°(€€€ÁÉ½‘ÕÑÌéÈ¹Í•±±}¥Ñ•µÍñðœœ°Á¡½Ñ¼éÈ¹Á¡½Ñ½}ÕÉ°°(€€€™ˆéÈ¹™‰}ÕÉ±ñðœœ°¥œéÈ¹¥}ÕÉ±ñðœœ°(€€€•ÅÕ¥ÀéÈ¹•ÅÕ¥Áµ•¹Ñ}©Í½¸°ÕÍÑ½µ¥•±‘ÌéÈ¹ÕÍÑ½µ}™¥•±‘Í}©Í½¸°(€€€Á…ÉÑ¥¥Á…¹ÑÌéÍ…™•)Í½¸¡È¹Á…ÉÑ¥¥Á…¹ÑÍ}©Í½¸±íô¤°(€€€ÍÑ…ÑÕÌéÈ¹É•Ù¥•Ý}ÍÑ…ÑÕÌ°Á…åMÑ…ÑÕÌéÈ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ°(€€€ÍÑ…±±½Õ¹ÐéÍ…™•9Õ´¡È¹ÍÑ…±±}½Õ¹Ð¥ñðÄ°(€€€Í•±•Ñ•‘…Ñ•ÌéÍ…™•)Í½¸¡È¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸±mt¤°(€€€…µ½Õ¹ÐéÍ…™•9Õ´¡È¹…µ½Õ¹Ð¤°Ñ½Ñ…±µ½Õ¹ÐéÍ…™•9Õ´¡È¹Ñ½Ñ…±}…µ½Õ¹Ð¤°‘•Á½Í¥ÐéÍ…™•9Õ´¡È¹‘•Á½Í¥Ð¤°(€€€Á…å5•Ñ¡½éÈ¹Á…åµ•¹Ñ}µ•Ñ¡½‘ñðœœ°Á…å1…ÍÐÔéÈ¹Á…åµ•¹Ñ}±…ÍÐÕñðœœ°Á…åI•Á½ÉÑµ½Õ¹ÐéÍ…™•9Õ´¡È¹Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹Ð¤°(€€€Á…åµ•¹Ñ1¥¹•…É‘Q•áÐéÈ¹Á…åµ•¹Ñ}±¥¹•}…É‘}Ñ•áÑñðœœ°Á…åµ•¹ÑMÉ••¹Í¡½ÑMÑ…ÑÕÌéÈ¹Á…åµ•¹Ñ}ÍÉ••¹Í¡½Ñ}ÍÑ…ÑÕÍñðœœ°Á…åµ•¹ÑI•Á½ÉÑ•‘ÐéÈ¹Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ññðœœ°Á…åµ•¹ÑÉ½ÕÁ%éÈ¹Á…åµ•¹Ñ}É½ÕÁ}¥‘ñðœœ°(€€€Á…¥‘ÐéÈ¹Á…¥‘}…Ññðœœ°(€€€¡•­¥¸éÈ¹¡•­¥¹}ÍÑ…ÑÕÌ°±•…ÉMÑ…ÑÕÌéÈ¹±•…É}ÍÑ…ÑÕÌ°(€€€‘•Á½Í¥ÑI•™Õ¹‘•éÈ¹‘•Á½Í¥Ñ}É•™Õ¹‘•‘ñðŸšr«¦š*ó¦Dœ°(€€€ÑÉ…¹Í™•ÉMÑ…ÑÕÌéÈ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ°ÑÉ…¹Í™•É¡½Í•¹ÐéÈ¹ÑÉ…¹Í™•É}¡½Í•¹}…Ññðœœ°(€€€É•™Õ¹‘µ½Õ¹ÐéÍ…™•9Õ´¡È¹É•™Õ¹‘}…µ½Õ¹Ð¤°É•™Õ¹‘‘µ¥¹•”éÍ…™•9Õ´¡È¹É•™Õ¹‘}…‘µ¥¹}™•”¤°(€€€É•™Õ¹‘QÉ…¹Í™•É•”éÍ…™•9Õ´¡È¹É•™Õ¹‘}ÑÉ…¹Í™•É}™•”¤°É•™Õ¹‘IÕ±•1…‰•°éÈ¹É•™Õ¹‘}ÉÕ±•}±…‰•±ñðœœ°É•™Õ¹‘•‘ÐéÈ¹É•™Õ¹‘•‘}…Ññðœœ°É•™Õ¹‘9½Ñ”éÈ¹É•™Õ¹‘}¹½Ñ•ñðœœ°(€€€…‘µ¥¹9½Ñ”éÈ¹…‘µ¥¹}¹½Ñ”°É•…Ñ•‘ÐéÈ¹É•…Ñ•‘}…Ð°(€€€€¼¼ƒŠRŠR ƒ–B#žÒ–B3š?žÒ¦2ƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR (€€€…É••µ•¹Ñ•ÁÑ•è€€€€€È¹…É••µ•¹Ñ}…•ÁÑ•ñð™…±Í”°(€€€…É••µ•¹ÑY¥•Ý•è€€€€€€€È¹…É••µ•¹Ñ}Ù¥•Ý•€€ñð™…±Í”°(€€€…É••µ•¹ÑY¥•Ý•‘Ðè€€€€€È¹…É••µ•¹Ñ}Ù¥•Ý•‘}…Ð€€ñð€œœ°(€€€…É••µ•¹Ñ•ÁÑ•‘Ðè€€€È¹…É••µ•¹Ñ}…•ÁÑ•‘}…Ðñð€œœ°(€€€…É••µ•¹Ñµ…¥°è€€€€€€€€È¹…É••µ•¹Ñ}•µ…¥°€€€ñð€œœ°(€€€…É••µ•¹ÑY•ÉÍ¥½¸è€€€€€€È¹…É••µ•¹Ñ}Ù•ÉÍ¥½¸€ñð€œœ°(€€€…É••µ•¹ÑQ¥Ñ±•M¹…ÁÍ¡½ÐèÈ¹…É••µ•¹Ñ}Ñ¥Ñ±•}Í¹…ÁÍ¡½Ð€€ñð€œœ°(€ô¤¤¤ì)ô((¼¼•ÑI•Í	åM•ÍÍ¥½¸)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑI•Í	åM•ÍÍ¥½¸¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ%€ôÀ¹Í•ÍÍ¥½¹%ñðÀ¹Í•ÍÍ¥½¹}¥ì(€¥˜€ …Í%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úlÍ•ÍÍ¥½¹%œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™Í•±•Ðô©€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É½ÝÌ¹µ…À¡Èôø¡ì(€€€¥éÈ¹¥°Í•ÍÍ¥½¹%éÈ¹Í•ÍÍ¥½¹}¥°•Ù•¹Ñ%éÈ¹•Ù•¹Ñ}¥°(€€€•µ…¥°éÈ¹•µ…¥°°¹…µ”éÈ¹¹…µ”°Á¡½¹”éÈ¹Á¡½¹”°(€€€‰É…¹éÈ¹‰É…¹‘}¹…µ”°‰É…¹‘%¹ÑÉ¼éÈ¹‰É…¹‘}¥¹ÑÉ½ñðœœ°(€€€Í•±±…ÐéÈ¹Í•±±}…Ñ•½Éåñðœœ°ÁÉ½‘ÕÑÌéÈ¹Í•±±}¥Ñ•µÍñðœœ°(€€€™ˆéÈ¹™‰}ÕÉ±ñðœœ°¥œéÈ¹¥}ÕÉ±ñðœœ°(€€€ÍÑ…±±½Õ¹ÐéÍ…™•9Õ´¡È¹ÍÑ…±±}½Õ¹Ð¥ñðÄ°(€€€•ÅÕ¥ÀéÈ¹•ÅÕ¥Áµ•¹Ñ}©Í½¹ñðíôœ°(€€€…‘‘½¹EÑäéÍ…™•)Í½¸¡È¹…‘‘½¹}ÅÑå}©Í½¸±íô¤°(€€€Í•±•Ñ•‘…Ñ•ÌéÍ…™•)Í½¸¡È¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸±mt¤°(€€€ÕÍÑ½µ¥•±‘ÌéÍ…™•)Í½¸¡È¹ÕÍÑ½µ}™¥•±‘Í}©Í½¸±mt¤°(€€€Á…ÉÑ¥¥Á…¹ÑÌéÍ…™•)Í½¸¡È¹Á…ÉÑ¥¥Á…¹ÑÍ}©Í½¸±íô¤°(€€€ÍÑ…ÑÕÌéÈ¹É•Ù¥•Ý}ÍÑ…ÑÕÍñðŸ–ú–¾§š‚àœ°(€€€Á…åMÑ…ÑÕÌéÈ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðŸšr«žæÏ¢Êìœ°(€€€Á…å5•Ñ¡½éÈ¹Á…åµ•¹Ñ}µ•Ñ¡½‘ñðœœ°(€€€Á…¥‘ÐéÈ¹Á…¥‘}…Ññðœœ°(€€€Á…å1…ÍÐÔéÈ¹Á…åµ•¹Ñ}±…ÍÐÕñðœœ°(€€€Á…åI•Á½ÉÑµ½Õ¹ÐéÍ…™•9Õ´¡È¹Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹Ð¤°(€€€…µ½Õ¹ÐéÍ…™•9Õ´¡È¹…µ½Õ¹Ð¤°‘•Á½Í¥ÐéÍ…™•9Õ´¡È¹‘•Á½Í¥Ð¤°(€€€¡•­¥¸éÈ¹¡•­¥¹}ÍÑ…ÑÕÍñðŸšr«–‚Ç–"Àœ°(€€€±•…ÉMÑ…ÑÕÌéÈ¹±•…É}ÍÑ…ÑÕÍñðŸšr«šâ–‚Ðœ°(€€€‘•Á½Í¥ÑI•™Õ¹‘•éÈ¹‘•Á½Í¥Ñ}É•™Õ¹‘•‘ñðŸšr«¦š*ó¦Dœ°(€€€É•™Õ¹‘µ½Õ¹ÐéÍ…™•9Õ´¡È¹É•™Õ¹‘}…µ½Õ¹Ð¤°É•™Õ¹‘‘µ¥¹•”éÍ…™•9Õ´¡È¹É•™Õ¹‘}…‘µ¥¹}™•”¤°(€€€É•™Õ¹‘QÉ…¹Í™•É•”éÍ…™•9Õ´¡È¹É•™Õ¹‘}ÑÉ…¹Í™•É}™•”¤°É•™Õ¹‘IÕ±•1…‰•°éÈ¹É•™Õ¹‘}ÉÕ±•}±…‰•±ñðœœ°(€€€É•™Õ¹‘•‘ÐéÈ¹É•™Õ¹‘•‘}…Ññðœœ°É•™Õ¹‘9½Ñ”éÈ¹É•™Õ¹‘}¹½Ñ•ñðœœ°(€€€ÍÑ…±±9¼éÈ¹ÍÑ…±±}¹Õµ‰•Éñðœœ°(€€€Ñ…á%éÈ¹Ñ…á}¥‘ñðœœ°¥¹Ù½¥•Q¥Ñ±”éÈ¹¥¹Ù½¥•}Ñ¥Ñ±•ñðœœ°(€€€¥¹Ù½¥•µ…¥°éÈ¹¥¹Ù½¥•}•µ…¥±ñðœœ°¥¹Ù½¥•MÑ…ÑÕÌéÈ¹¥¹Ù½¥•}ÍÑ…ÑÕÍñðœœ°(€€€ÑÉ…¹Í™•ÉMÑ…ÑÕÌéÈ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ°(€€€É•…Ñ•‘ÐéÈ¹É•…Ñ•‘}…Ññðœœ°…‘µ¥¹9½Ñ”éÈ¹…‘µ¥¹}¹½Ñ•ñðœœ°(€ô¤¤¤ì)ô(()™Õ¹Ñ¥½¸}…‘µ¥¹I•Ù…¥±…‰±•Ñ¥½¹Ì¡È¤ì(€½¹ÍÐÉ•Ù¥•Ü€ô}É•Ù¥•ÝMÑ…ÑÕÌ¡È¤ì(€½¹ÍÐÁ…ä€ô}Á…åMÑ…ÑÕÌ¡È¤ì(€½¹ÍÐ¡•¬€ô}¡•­¥¹MÑ…ÑÕÌ¡È¤ì(€½¹ÍÐÑÉ…¹Í™•È€ô}ÑÉ…¹Í™•ÉMÑ…ÑÕÌ¡È¤ì(€½¹ÍÐ…Ñ¥½¹Ì€ômtì(€¥˜€¡É•Ù¥•Ü€ôôô€Ÿ–ú–¾§š‚àœñðÉ•Ù¥•Ü€ôôô€Ÿ–‚Ç–B7š"C–*|œñðÉ•Ù¥•Ü€ôôô€œœ¤…Ñ¥½¹Ì¹ÁÕÍ  …ÁÁÉ½Ù”œ°É•©•Ðœ°Ý…¥Ñ±¥ÍÐœ¤ì(€¥˜€¡É•Ù¥•Ü€ôôô€Ÿ–ÞË¦2–>Xœ€˜˜€…¥ÍA…¥‘MÑ…ÑÕÌ¡Á…ä¤€˜˜Á…ä€„ôô€Ÿ–7¢Êìœ€˜˜€…lŸžRÏ¢®/¦¢Êìœ°Ÿ–ÞË¦¢Êìœ°É•™Õ¹‘•t¹¥¹±Õ‘•Ì¡ÑÉ…¹Í™•È¤¤ì(€€€¥˜€¡Á…ä€ôôô€Ÿ–úžŠë¢ª4œñðÁ…ä€ôôô€Ÿ’îcš²û–úžŠë¢ª4œ¤…Ñ¥½¹Ì¹ÁÕÍ  ½¹™¥ÉµA…åµ•¹Ðœ°µ…É­U¹Á…¥œ¤ì(€€€•±Í”…Ñ¥½¹Ì¹ÁÕÍ  µ…É­A…åµ•¹ÑI•Á½ÉÑ•œ°…¹•±U¹Á…¥œ¤ì(€ô(€¥˜€¡É•Ù¥•Ü€ôôô€Ÿ–ÞË¦2–>Xœ€˜˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡Á…ä¤ñðÁ…ä€ôôô€Ÿ–7¢Êìœ¤€˜˜€…lŸžRÏ¢®/¦¢Êìœ°Ÿ–ÞË¦¢Êìœ°É•™Õ¹‘•t¹¥¹±Õ‘•Ì¡ÑÉ…¹Í™•È¤¤ì(€€€¥˜€¡¡•¬€ôôô€Ÿ–ÞË–‚Ç–"Àœ¤…Ñ¥½¹Ì¹ÁÕÍ  Õ¹‘½¡•­¥¸œ¤ì(€€€•±Í”…Ñ¥½¹Ì¹ÁÕÍ  ¡•­¥¸œ¤ì(€ô(€É•ÑÕÉ¸…Ñ¥½¹Ìì)ô)™Õ¹Ñ¥½¸}™½Éµ…Ñ‘µ¥¹I•¥ÍÑÉ…Ñ¥½¸¡È°Í•ÍÍ¥½¹I½Ü°•Ù•¹ÑI½Ü¤ì(€½¹ÍÐÍ•Í9…µ”€ô€¡Í•ÍÍ¥½¹I½Ü€˜˜Í•ÍÍ¥½¹I½Ü¹¹…µ”¤ñðÈ¹Í•ÍÍ¥½¹}¹…µ”ñð€œœì(€½¹ÍÐ•Ù•¹Ñ9…µ”€ô€¡•Ù•¹ÑI½Ü€˜˜€¡•Ù•¹ÑI½Ü¹Ñ¥Ñ±”ñð•Ù•¹ÑI½Ü¹¹…µ”¤¤ñð€œœì(€½¹ÍÐ‰É…¹‘9…µ”€ôÈ¹‰É…¹‘}¹…µ”ñðÈ¹¹…µ”ñð€œœì(€É•ÑÕÉ¸ì(€€€¥éÈ¹¥°É•%éÈ¹¥°(€€€Ñ•¹…¹Ñ%éÈ¹Ñ•¹…¹Ñ}¥°Ñ•¹…¹Ñ}¥éÈ¹Ñ•¹…¹Ñ}¥°(€€€Í•ÍÍ¥½¹%éÈ¹Í•ÍÍ¥½¹}¥°Í•ÍÍ¥½¹}¥éÈ¹Í•ÍÍ¥½¹}¥°(€€€•Ù•¹Ñ%éÈ¹•Ù•¹Ñ}¥°•Ù•¹Ñ}¥éÈ¹•Ù•¹Ñ}¥°(€€€Í•ÍÍ¥½¹9…µ”éÍ•Í9…µ”°•Ù•¹Ñ9…µ”°(€€€•µ…¥°éÈ¹•µ…¥±ñðœœ°¹…µ”éÈ¹¹…µ•ñðœœ°Á¡½¹”éÈ¹Á¡½¹•ñðœœ°(€€€‰É…¹é‰É…¹‘9…µ”°‰É…¹‘9…µ”°‰É…¹‘}¹…µ”é‰É…¹‘9…µ”°(€€€‰É…¹‘%¹ÑÉ¼éÈ¹‰É…¹‘}¥¹ÑÉ½ñðœœ°Í•±±…ÐéÈ¹Í•±±}…Ñ•½Éåñðœœ°ÁÉ½‘ÕÑÌéÈ¹Í•±±}¥Ñ•µÍñðœœ°(€€€™ˆéÈ¹™‰}ÕÉ±ññÈ¹™‰ñðœœ°¥œéÈ¹¥}ÕÉ±ññÈ¹¥ñðœœ°(€€€•ÅÕ¥ÀéÈ¹•ÅÕ¥Áµ•¹Ñ}©Í½¸ñðÈ¹•ÅÕ¥Áµ•¹Ñ}Ñ•áÐñð€íôœ°(€€€•ÅÕ¥Áµ•¹ÐéÈ¹•ÅÕ¥Áµ•¹Ñ}©Í½¸ñðÈ¹•ÅÕ¥Áµ•¹Ñ}Ñ•áÐñð€íôœ°(€€€•ÅÕ¥Áµ•¹ÑQ•áÐé•ÅÕ¥ÁMÕµµ…ÉåÉ½µ)Í½¸¡È¹•ÅÕ¥Áµ•¹Ñ}©Í½¸ñðíô¤°(€€€…‘‘½¹EÑäéÍ…™•)Í½¸¡È¹…‘‘½¹}ÅÑå}©Í½¸±íô¤°…‘‘½¹}ÅÑå}©Í½¸éÈ¹…‘‘½¹}ÅÑå}©Í½¸ñð€íôœ°(€€€…‘‘½¹µ½Õ¹ÐéÍ…™•9Õ´¡È¹…‘‘½¹}…µ½Õ¹Ð¤°…‘‘½¹Q•áÐé…‘‘½¹MÕµµ…ÉåÉ½µ)Í½¸¡È¹…‘‘½¹}ÅÑå}©Í½¸ñðíô°Í•ÍÍ¥½¹I½Ü¤°(€€€ÕÍÑ½µ¥•±‘ÌéÍ…™•)Í½¸¡È¹ÕÍÑ½µ}™¥•±‘Í}©Í½¸±mt¤°Á…ÉÑ¥¥Á…¹ÑÌéÍ…™•)Í½¸¡È¹Á…ÉÑ¥¥Á…¹ÑÍ}©Í½¸±íô¤°(€€€É•Ù¥•ÝMÑ…ÑÕÌé}É•Ù¥•ÝMÑ…ÑÕÌ¡È¤ñð€Ÿ–ú–¾§š‚àœ°ÍÑ…ÑÕÌé}É•Ù¥•ÝMÑ…ÑÕÌ¡È¤ñð€Ÿ–ú–¾§š‚àœ°(€€€Á…åµ•¹ÑMÑ…ÑÕÌé}Á…åMÑ…ÑÕÌ¡È¤ñð€Ÿšr«žæÏ¢Êìœ°Á…åMÑ…ÑÕÌé}Á…åMÑ…ÑÕÌ¡È¤ñð€Ÿšr«žæÏ¢Êìœ°(€€€¡•­¥¹MÑ…ÑÕÌé}¡•­¥¹MÑ…ÑÕÌ¡È¤ñð€Ÿšr«–‚Ç–"Àœ°¡•­¥¸é}¡•­¥¹MÑ…ÑÕÌ¡È¤ñð€Ÿšr«–‚Ç–"Àœ°(€€€±•…ÉMÑ…ÑÕÌé}±•…ÉMÑ…ÑÕÌ¡È¤ñð€Ÿšr«šâ–‚Ðœ°‘•Á½Í¥ÑI•™Õ¹‘•é}‘•Á½Í¥ÑMÑ…ÑÕÌ¡È¤ñð€Ÿšr«¦š*ó¦Dœ°(€€€Ñ•…É‘½Ý¸éÈ¹Ñ•…É‘½Ý¹}ÍÑ…ÑÕÍñðŸšr«šJ“–‚Ðœ°Ñ•…É‘½Ý¹MÑ…ÑÕÌéÈ¹Ñ•…É‘½Ý¹}ÍÑ…ÑÕÍñðŸšr«šJ“–‚Ðœ°Ù¥½±…Ñ¥½¸éÈ¹Ù¥½±…Ñ¥½¹}™±…Íñðœœ°(€€€ÑÉ…¹Í™•ÉMÑ…ÑÕÌé}ÑÉ…¹Í™•ÉMÑ…ÑÕÌ¡È¤ñð€œœ°É•™Õ¹‘MÑ…ÑÕÌé}ÑÉ…¹Í™•ÉMÑ…ÑÕÌ¡È¤ñð€œœ°(€€€‰Õ¹‘±•É½ÕÁ%éÈ¹‰Õ¹‘±•}É½ÕÁ}¥‘ñðœœ°‰Õ¹‘±•}É½ÕÁ}¥éÈ¹‰Õ¹‘±•}É½ÕÁ}¥‘ñðœœ°(€€€ÍÑ…±±½Õ¹ÐéÍ…™•9Õ´¡È¹ÍÑ…±±}½Õ¹Ð¥ñðÄ°ÍÑ…±±}½Õ¹ÐéÍ…™•9Õ´¡È¹ÍÑ…±±}½Õ¹Ð¥ñðÄ°(€€€Í•±•Ñ•‘…Ñ•ÌéÍ…™•)Í½¸¡È¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸±mt¤°(€€€…µ½Õ¹Ðé}½™™¥¥…±µ½Õ¹Ð¡È¤°Ñ½Ñ…±µ½Õ¹ÐéÍ…™•9Õ´¡}™¥ÉÍÑ9Õ´¡È¹Ñ½Ñ…±}…µ½Õ¹Ð°È¹Ñ½Ñ…°°È¹É•¥ÍÑÉ…Ñ¥½¹}Ñ½Ñ…±}…µ½Õ¹Ð°È¹…µ½Õ¹Ð¤¤°(€€€‘•Á½Í¥Ðé}É••Á½Í¥Ð¡È°Í•ÍÍ¥½¹I½Ü¤°(€€€Á…å5•Ñ¡½éÈ¹Á…åµ•¹Ñ}µ•Ñ¡½‘ñðœœ°Á…å1…ÍÐÔéÈ¹Á…åµ•¹Ñ}±…ÍÐÕñðœœ°Á…åI•Á½ÉÑµ½Õ¹ÐéÍ…™•9Õ´¡È¹Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹Ð¤°(€€€Á…åµ•¹Ñ1¥¹•…É‘Q•áÐéÈ¹Á…åµ•¹Ñ}±¥¹•}…É‘}Ñ•áÑñðœœ°Á…åµ•¹ÑMÉ••¹Í¡½ÑMÑ…ÑÕÌéÈ¹Á…åµ•¹Ñ}ÍÉ••¹Í¡½Ñ}ÍÑ…ÑÕÍñðœœ°Á…åµ•¹ÑI•Á½ÉÑ•‘ÐéÈ¹Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ññðœœ°Á…åµ•¹ÑÉ½ÕÁ%éÈ¹Á…åµ•¹Ñ}É½ÕÁ}¥‘ñðœœ°(€€€Á…¥‘ÐéÈ¹Á…¥‘}…Ññðœœ°É•™Õ¹‘µ½Õ¹ÐéÍ…™•9Õ´¡È¹É•™Õ¹‘}…µ½Õ¹Ð¤°É•™Õ¹‘‘µ¥¹•”éÍ…™•9Õ´¡È¹É•™Õ¹‘}…‘µ¥¹}™•”¤°(€€€É•™Õ¹‘QÉ…¹Í™•É•”éÍ…™•9Õ´¡È¹É•™Õ¹‘}ÑÉ…¹Í™•É}™•”¤°É•™Õ¹‘IÕ±•1…‰•°éÈ¹É•™Õ¹‘}ÉÕ±•}±…‰•±ñðœœ°É•™Õ¹‘•‘ÐéÈ¹É•™Õ¹‘•‘}…Ññðœœ°É•™Õ¹‘9½Ñ”éÈ¹É•™Õ¹‘}¹½Ñ•ñðœœ°(€€€ÍÑ…±±9¼éÈ¹ÍÑ…±±}¹Õµ‰•Éñðœœ°Ñ…á%éÈ¹Ñ…á}¥‘ñðœœ°¥¹Ù½¥•Q¥Ñ±”éÈ¹¥¹Ù½¥•}Ñ¥Ñ±•ñðœœ°¥¹Ù½¥•µ…¥°éÈ¹¥¹Ù½¥•}•µ…¥±ñðœœ°¥¹Ù½¥•MÑ…ÑÕÌé}¥¹Ù½¥•MÑ…ÑÕÌ¡È¤°(€€€…‘µ¥¹9½Ñ”éÈ¹…‘µ¥¹}¹½Ñ•ñðœœ°É•…Ñ•‘ÐéÈ¹É•…Ñ•‘}…Ññðœœ°É•…Ñ•‘}…ÐéÈ¹É•…Ñ•‘}…Ññðœœ°(€€€Á…åµ•¹ÑAÉ½™¥±”é}Á…åµ•¹ÑM¹…ÁÍ¡½ÑAÕ‰±¥Œ¡}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µI•œ¡È¤¤°(€€€Á…åµ•¹ÑAÉ½™¥±•9…µ”é}Á…åµ•¹ÑM¹…ÁÍ¡½ÑAÕ‰±¥Œ¡}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µI•œ¡È¤¤¹Á…åµ•¹ÑAÉ½™¥±•9…µ”°(€€€Á…åµ•¹Ñ=Ý¹•É5½‘”é}Á…åµ•¹ÑM¹…ÁÍ¡½ÑAÕ‰±¥Œ¡}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µI•œ¡È¤¤¹Á…åµ•¹Ñ=Ý¹•É5½‘”°(€€€…Ù…¥±…‰±•Ñ¥½¹Ìé}…‘µ¥¹I•Ù…¥±…‰±•Ñ¥½¹Ì¡È¤°(€ôì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑM•ÍÍ¥½¹I•¥ÍÑÉ…Ñ¥½¹Ì¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôÀ¹Í•ÍÍ¥½¹%ñðÀ¹Í•ÍÍ¥½¹}¥ì(€¥˜€ …Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úlÍ•ÍÍ¥½¹%œ¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P°€œœ°Í•ÍÍ¥½¹%¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐmÍ•ÍÍ¥½¹I½ÝÌ°É•Ì°•Ù•¹ÑÍt€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€•Ù•¹ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€t¤ì(€½¹ÍÐÍ•ÍÍ¥½¹I½Ü€ôÍ•ÍÍ¥½¹I½ÝÍlÁtñðíôì(€½¹ÍÐ•ÙÑ5…À€ôíôì•Ù•¹ÑÌ¹™½É… ¡”ôù•ÙÑ5…Ám”¹¥‘tõ”¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É•Ì¹µ…À¡Èôù}™½Éµ…Ñ‘µ¥¹I•¥ÍÑÉ…Ñ¥½¸¡È°Í•ÍÍ¥½¹I½Ü°•ÙÑ5…ÁmÍ•ÍÍ¥½¹I½Ü¹•Ù•¹Ñ}¥‘tñðíô¤¤¤ì)ô(()…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑQ½‘½Ì¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐmÉ•Ì±Í•ÍÍ¥½¹Ì±•Ù•¹ÑÍt€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€€€‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€€€‘‰•Ð¡•¹Ø°•Ù•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€t¤ì(€½¹ÍÐÍµ…ÀõíôìÍ•ÍÍ¥½¹Ì¹™½É… ¡ÌôùÍµ…ÁmÌ¹¥‘tõÌ¤ì(€½¹ÍÐ•µ…Àõíôì•Ù•¹ÑÌ¹™½É… ¡”ôù•µ…Ám”¹¥‘tõ”¤ì(€½¹ÍÐ½ÕÐõmtì(€™½È€¡½¹ÍÐÈ½˜É•Ì¤ì(€€€½¹ÍÐÉ•Ù¥•Üõ}É•Ù¥•ÝMÑ…ÑÕÌ¡È¤°Á…äõ}Á…åMÑ…ÑÕÌ¡È¤°ÑÉ…¹Í™•Èõ}ÑÉ…¹Í™•ÉMÑ…ÑÕÌ¡È¤ì(€€€±•Ð­¥¹ôœœ°±…‰•°ôœœì(€€€€¼¼ƒ¦¢Êïž.š/–«–#šZóŽ3šr«žæÏ¢Êï¾ò?–ú’îcš²ûŽ7¾ò3¦ÿ–7¦š²û’â·žj¢ÎšZg¢Š¯¦2¿–"–"Ã–ú’îcš²ûŽ(€€€¥˜€¡¥Í…Á…¥Ñå%¹…Ñ¥Ù•QÉ…¹Í™•ÉMÑ…ÑÕÌ¡ÑÉ…¹Í™•È¤€˜˜€…lŸ–ÞË¦¢Êìœ°Ÿ–ÞË¦š²øœ°É•™Õ¹‘•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡ÑÉ…¹Í™•Éñðœœ¤¤¤ì­¥¹ôÉ•™Õ¹œì±…‰•°ôŸ¦š²û–ú¢fWžBœìô(€€€•±Í”¥˜€¡É•Ù¥•ÜôôôŸ–ú–¾§š‚àœñðÉ•Ù¥•ÜôôôŸ–‚Ç–B7š"C–*|œñðÉ•Ù¥•Üôôôœœ¤ì­¥¹ôÁ•¹‘¥¹œœì±…‰•°ôŸ–ú–¾§š‚àœìô(€€€•±Í”¥˜€¡Á…äôôôŸ–úžŠë¢ª4œñðÁ…äôôôŸ’îcš²û–úžŠë¢ª4œ¤ì­¥¹ôÁ…åµ•¹ÑA•¹‘¥¹œœì±…‰•°ôŸ’îcš²û–úžŠë¢ª4œìô(€€€•±Í”¥˜€¡É•Ù¥•ÜôôôŸ–ÞË¦2–>Xœ€˜˜€ …Á…äñðÁ…äôôôŸšr«žæÏ¢Êìœ¤¤ì­¥¹ôÕ¹Á…¥œì±…‰•°ôŸšr«žæÏ¢Êìœìô(€€€¥˜€ …­¥¹¤½¹Ñ¥¹Õ”ì(€€€½¹ÍÐÌõÍµ…ÁmÈ¹Í•ÍÍ¥½¹}¥‘uññíôì(€€€½ÕÐ¹ÁÕÍ ¡ì¸¸¹}™½Éµ…Ñ‘µ¥¹I•¥ÍÑÉ…Ñ¥½¸¡È°Ì°•µ…ÁmÌ¹•Ù•¹Ñ}¥‘uññíô¤°­¥¹°±…‰•±ô¤ì(€ô(€€¼¼ƒ¦–.W–‚Óš²‡¦š²ûšb¿’â–/šVÓžÖ–.W’ös¾òk–ú¢ú›–>«¦†¿ž’ë’â–ò×¾ò3¦î{’âš²‡žRÄ½¹™¥ÉµI•™Õ¹ƒ–º3š"CšVÓžÖŽ(€½¹ÍÐÉ½ÕÁ½Õ¹ÑÌõíôì(€™½È¡½¹ÍÐà½˜½ÕÐ¥ì¥˜¡à¹­¥¹ôôôÉ•™Õ¹œ˜™à¹‰Õ¹‘±•É½ÕÁ%¤É½ÕÁ½Õ¹ÑÍmà¹‰Õ¹‘±•É½ÕÁ%‘tô¡É½ÕÁ½Õ¹ÑÍmà¹‰Õ¹‘±•É½ÕÁ%‘uñðÀ¤¬Äìô(€½¹ÍÐÍ••¸õ¹•ÜM•Ð ¤ì(€½¹ÍÐ‘•‘ÕÀõmtì(€™½È¡½¹ÍÐà½˜½ÕÐ¥ì(€€€¥˜¡à¹­¥¹ôôôÉ•™Õ¹œ˜™à¹‰Õ¹‘±•É½ÕÁ%¥ì(€€€€€¥˜¡Í••¸¹¡…Ì¡à¹‰Õ¹‘±•É½ÕÁ%¤¤½¹Ñ¥¹Õ”ì(€€€€€Í••¸¹…‘¡à¹‰Õ¹‘±•É½ÕÁ%¤ì(€€€€€à¹‰Õ¹‘±•½Õ¹ÐõÉ½ÕÁ½Õ¹ÑÍmà¹‰Õ¹‘±•É½ÕÁ%‘uñðÄì(€€€€€¥˜¡à¹‰Õ¹‘±•½Õ¹ÐøÄ¤à¹±…‰•°ôŸ¦š²û–ú¢fWžB¾ò#¦–.T€œ­à¹‰Õ¹‘±•½Õ¹Ð¬œƒ–‚Ó¾ò$œì(€€€ô(€€€‘•‘ÕÀ¹ÁÕÍ ¡à¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡‘•‘ÕÀ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•I•9½Ñ”¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐÉ•%€ôÀ¹É•%ñðÀ¹É•}¥ì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôÀ¹Í•ÍÍ¥½¹%ñðÀ¹Í•ÍÍ¥½¹}¥ñð€œœì(€½¹ÍÐ¹½Ñ”€ôMÑÉ¥¹œ¡À¹¹½Ñ”ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …É•%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úlÉ•%œ¤ì(€¥˜€ …¹½Ñ”¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–†¯–¾¯–
g¢¢ï–Ÿ–ºäœ¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P°€œœ°Í•ÍÍ¥½¹%¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Í•±•Ðõ…‘µ¥¹}¹½Ñ•€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÁÉ•Ø€ôMÑÉ¥¹œ¡É½ÝÍlÁt¹…‘µ¥¹}¹½Ñ”ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐÍÑ…µÀ€ô¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°ÄØ¤¹É•Á±…” Pœ°œ€œ¤ì(€½¹ÍÐ±¥¹”€ô€lœ€¬ÍÑ…µÀ€¬€t€œ€¬¹½Ñ”ì(€½¹ÍÐµ•É•€ôÁÉ•Ø€ü€¡ÁÉ•Ø€¬€q¸œ€¬±¥¹”¤€è±¥¹”ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€°ì…‘µ¥¹}¹½Ñ”èµ•É•ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡ìÍÕ•ÍÌéÑÉÕ”°É•%°…‘µ¥¹9½Ñ”èµ•É•ô¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑM•ÍÍ¥½¹ÅÕ¥Áµ•¹Ñ•Ñ…¥±Ì¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôÀ¹Í•ÍÍ¥½¹%ñðÀ¹Í•ÍÍ¥½¹}¥ì(€¥˜€ …Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úlÍ•ÍÍ¥½¹%œ¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P°€œœ°Í•ÍÍ¥½¹%¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐmÍ•ÍI½ÝÌ°É•Ít€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðô©€¤°(€t¤ì(€½¹ÍÐÌ€ôÍ•ÍI½ÝÍlÁtñðíôì(€½¹ÍÐ…Ñ¥Ù”€ôÉ•Ì¹™¥±Ñ•È¡}¥ÍÑ¥Ù•¥¹…¹•I•œ¤ì(€½¹ÍÐ…ÁÁÉ½Ù•€ô…Ñ¥Ù”¹™¥±Ñ•È¡}¥ÍÁÁÉ½Ù•‘I•œ¤ì(€€¼¼ƒžRË–>–úG¾òkšVÓ–‚Ó¢¢·–
gžâ÷¢¢#¾òw–ÞË¦2–>Xƒ’âS¾ò#–ÞËžæÏ¢Êï¾ò?–7¢Êï¾ò'¾òwžrš¶¢ššê[–
gŽ¢š¢¢žj¦?Ž(€½¹ÍÐÁÉ•Á…É”€ô…Ñ¥Ù”¹™¥±Ñ•È¡È€ôø}¥ÍÁÁÉ½Ù•‘I•œ¡È¤€˜˜}¥ÍA…¥‘I•œ¡È¤¤ì(€½¹ÍÐ…ÁÁÉ½Ù•‘5…À€ô}•ÅÕ¥Áµ•¹Ñ5…ÁÉ½µI•Ì¡…ÁÁÉ½Ù•°Ì¤ì€€€¼¼ƒ¦ršÆ¾ò#–B¯šr«žæÏ¢Êï¾ò3––>¢¾ò$(€½¹ÍÐÁÉ•Á…É•5…À€€ô}•ÅÕ¥Áµ•¹Ñ5…ÁÉ½µI•Ì¡ÁÉ•Á…É”°Ì¤ì€€€€¼¼ƒšVÓ–‚Óžâ÷¢¢#¾òkš¾?ž¶žº_’âš²‡¾ò3’â7’æc–’§šVà(€€¼¼ƒš¾?š^—¢¢·–
g¾òk’úw–‚Ç–B7¦ãžjš^—šrš.Ž’âžÖ¢¢·–
gšNë’â'–’§’î7žº_’âš²‡¾òo’ö’â'–’§žVÛš^—šâ–Z»¦÷šr–ëž>û¾ò#ž>û–‚Ó¦
’â'–’§¦÷–r£¾ò'Ž(€½¹ÍÐ}‘¬€ô€¡à¤ôø€¡à€˜˜ÑåÁ•½˜à€ôôô€½‰©•Ðœ¤€üMÑÉ¥¹œ¡à¹‘…Ñ”ñðà¹­•äñðà¹Ù…±Õ”ñð€œœ¤€èMÑÉ¥¹œ¡àñð€œœ¤ì(€½¹ÍÐÍ•ÍÍ¥½¹…Ñ•Ì€ô€¡Í…™•)Í½¸¡Ì¹‘…Ñ•Í}©Í½¸°mt¤ñðmt¤¹µ…À¡}‘¬¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€½¹ÍÐÉ•…Ñ•Ì€ô€¡È¤ôùì½¹ÍÐ…ÉÈ€ô€¡Í…™•)Í½¸¡È¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸°mt¤ñðmt¤¹µ…À¡}‘¬¤¹™¥±Ñ•È¡	½½±•…¸¤ìÉ•ÑÕÉ¸…ÉÈ¹±•¹Ñ €ü…ÉÈ€èÍ•ÍÍ¥½¹…Ñ•Ì¹Í±¥” ¤ìôì(€½¹ÍÐ‘…¥±åI½ÝÌ€ôÍ•ÍÍ¥½¹…Ñ•Ì¹µ…À¡ôùì(€€€½¹ÍÐ‘…åI•Ì€ôÁÉ•Á…É”¹™¥±Ñ•È¡È€ôøÉ•…Ñ•Ì¡È¤¹¥¹±Õ‘•Ì¡¤¤ì(€€€½¹ÍÐ‘…å5…À€ô}•ÅÕ¥Áµ•¹Ñ5…ÁÉ½µI•Ì¡‘…åI•Ì°Ì¤ì€¼¼ƒ¢¦Ëš^—š¾?ž¶žº_’âš²„(€€€½¹ÍÐÍÑ…±±½Õ¹Ð€ô‘…åI•Ì¹É•‘Õ” ¡„±È¤ôø„€¬€¡Í…™•9Õ´¡È¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤°€À¤ì(€€€É•ÑÕÉ¸ì‘…Ñ”é°­•äé°±…‰•°é°ÍÑ…±±½Õ¹Ð°•ÅÕ¥Áµ•¹ÑQ•áÐé}•ÅÕ¥Áµ•¹ÑQ•áÑÉ½µ5…À¡‘…å5…À¤ôì(€ô¤¹™¥±Ñ•È¡à€ôøà¹•ÅÕ¥Áµ•¹ÑQ•áÐ€˜˜à¹•ÅÕ¥Áµ•¹ÑQ•áÐ€„ôô€Ÿž„œ¤ì(€½¹ÍÐ‘…¥±åQ•áÐ€ô‘…¥±åI½ÝÌ¹±•¹Ñ €ü‘…¥±åI½ÝÌ¹µ…À¡à€ôøà¹±…‰•°€¬€Ÿ¾òhœ€¬à¹•ÅÕ¥Áµ•¹ÑQ•áÐ¤¹©½¥¸ Ÿ¾öpœ¤€è€Ÿž„œì(€½¹ÍÐÉ½ÝÌ€ô…Ñ¥Ù”¹µ…À¡Èôùì(€€€½¹ÍÐ½¹•5…À€ô}•ÅÕ¥Áµ•¹Ñ5…ÁÉ½µI•Ì¡mÉt°Ì¤ì(€€€½¹ÍÐ¥¹±5…À€ô}Í•ÍÍ¥½¹	…Í•ÅÕ¥Áµ•¹Ñ5…À¡Ì°Í…™•9Õ´¡È¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤ì(€€€½¹ÍÐ•áÑÉ…5…À€ô}Í•±•Ñ•‘ÅÕ¥Áµ•¹Ñ5…ÁÉ½µI•œ¡È¤ì(€€€½¹ÍÐÉ…Ñ•Ì€ôÉ•…Ñ•Ì¡È¤ì(€€€½¹ÍÐ½¹•Q•áÐ€ô}•ÅÕ¥Áµ•¹ÑQ•áÑÉ½µ5…À¡½¹•5…À¤ì(€€€É•ÑÕÉ¸ì(€€€€€¥éÈ¹¥°(€€€€€Í•ÍÍ¥½¹%éÍ•ÍÍ¥½¹%°(€€€€€‰É…¹éÈ¹‰É…¹‘}¹…µ”ñðÈ¹¹…µ”ñðÈ¹•µ…¥°ñð€œœ°(€€€€€¹…µ”éÈ¹¹…µ”ñð€œœ°(€€€€€Á¡½¹”éÈ¹Á¡½¹”ñð€œœ°(€€€€€•µ…¥°éÈ¹•µ…¥°ñð€œœ°(€€€€€É•Ù¥•ÝMÑ…ÑÕÌé}É•Ù¥•ÝMÑ…ÑÕÌ¡È¤ñð€Ÿ–ú–¾§š‚àœ°(€€€€€Á…åµ•¹ÑMÑ…ÑÕÌé}Á…åMÑ…ÑÕÌ¡È¤ñð€Ÿšr«žæÏ¢Êìœ°(€€€€€ÍÑ…±±½Õ¹ÐéÍ…™•9Õ´¡È¹ÍÑ…±±}½Õ¹Ð¥ñðÄ°(€€€€€Í•±•Ñ•‘…Ñ•ÍQ•áÐèÉ…Ñ•Ì¹©½¥¸ ŸŽœ¤°(€€€€€‘…¥±åÅÕ¥Áµ•¹ÑI½ÝÌèÉ…Ñ•Ì¹µ…À¡ôø¡í‘…Ñ”é°­•äé°±…‰•°é°•ÅÕ¥Áµ•¹ÑQ•áÐé½¹•Q•áÑô¤¤°(€€€€€•ÅÕ¥Áµ•¹Ñ5…Àé½¹•5…À°(€€€€€•ÅÕ¥Áµ•¹ÑQ•áÐé½¹•Q•áÐ°(€€€€€Ý¡½±•ÅÕ¥Áµ•¹ÑQ•áÐé½¹•Q•áÐ°(€€€€€‘…¥±åÅÕ¥Áµ•¹ÑQ•áÐé½¹•Q•áÐ°(€€€€€¥¹±Õ‘•‘ÅÕ¥Áµ•¹ÑQ•áÐé}•ÅÕ¥Áµ•¹ÑQ•áÑÉ½µ5…À¡¥¹±5…À¤°(€€€€€•áÑÉ…ÅÕ¥Áµ•¹ÑQ•áÐé}•ÅÕ¥Áµ•¹ÑQ•áÑÉ½µ5…À¡•áÑÉ…5…À¤°(€€€€€É•…Ñ•‘ÐéÈ¹É•…Ñ•‘}…Ðñð€œœ°(€€€ôì(€ô¤¹™¥±Ñ•È¡àôùà¹•ÅÕ¥Áµ•¹ÑQ•áÐ€„ôô€Ÿž„œ¤ì(€É•ÑÕÉ¸©Í½¹=¬¡ì(€€€Í•ÍÍ¥½¸éí¥éÍ•ÍÍ¥½¹%°¹…µ”éÌ¹¹…µ”ñðÍ•ÍÍ¥½¹%‘ô°(€€€ÍÕµµ…Éäéì(€€€€€Ñ½Ñ…±Q•áÐé}•ÅÕ¥Áµ•¹ÑQ•áÑÉ½µ5…À¡ÁÉ•Á…É•5…À¤°€€€¼¼ƒšVÓ–‚Ó¢¢·–
gžâ÷¢¢#¾ò#žRË¾òk–ÞË¦2–>[¾ò/–ÞËžæÏ¢Êï¾ò?–7¢Êï¾ò$(€€€€€¹••‘•‘Q•áÐé}•ÅÕ¥Áµ•¹ÑQ•áÑÉ½µ5…À¡…ÁÁÉ½Ù•‘5…À¤°€€¼¼ƒ¦ršÆ–>¢¾ò#–B¯šr«žæÏ¢Êï¾ò$(€€€€€‘…¥±åQ•áÐé‘…¥±åQ•áÐ°(€€€€€‘…¥±åI½ÝÌé‘…¥±åI½ÝÌ°(€€€€€€¼¼ƒ¢"+š²’ö7žnã–ºä(€€€€€…ÁÁÉ½Ù•‘9••‘•‘Q•áÐé}•ÅÕ¥Áµ•¹ÑQ•áÑÉ½µ5…À¡…ÁÁÉ½Ù•‘5…À¤°(€€€€€Á…¥‘9••‘•‘Q•áÐé}•ÅÕ¥Áµ•¹ÑQ•áÑÉ½µ5…À¡ÁÉ•Á…É•5…À¤°(€€€€€…±±I•ÅÕ•ÍÑ•‘Q•áÐé}•ÅÕ¥Áµ•¹ÑQ•áÑÉ½µ5…À¡ÁÉ•Á…É•5…À¤°(€€€ô°(€€€É½ÝÌ(€ô¤ì)ô(((¼¼ƒŠRŠR ƒž>û–‚Óžº‡žBš¢‡žÖ¾òkž6£ž®,½¹Í¥Ñ”¹¡Ñµ°ƒ’öÿžR£¾ò3’â7¦Ë–º3šVÓ–ú3–>ÀƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR )™Õ¹Ñ¥½¸½¹Í¥Ñ•A…åµ•¹ÑQ•áÐ¡È¤ì(€½¹ÍÐÍÑ…ÑÕÌ€ôMÑÉ¥¹œ¡È¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌñð€œœ¤ì(€¥˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡ÍÑ…ÑÕÌ¤¤É•ÑÕÉ¸€Ÿ–ÞËžæÏ¢Êìœì(€¥˜€¡ÍÑ…ÑÕÌ€ôôô€Ÿ–7¢Êìœ¤É•ÑÕÉ¸€Ÿ–7¢Êìœì(€É•ÑÕÉ¸ÍÑ…ÑÕÌñð€Ÿšr«žæÏ¢Êìœì)ô)™Õ¹Ñ¥½¸™½Éµ…Ñ=¹Í¥Ñ•I•œ¡È¤ì(€É•ÑÕÉ¸ì(€€€¥èÈ¹¥°(€€€Í•ÍÍ¥½¹%èÈ¹Í•ÍÍ¥½¹}¥°(€€€‰É…¹èÈ¹‰É…¹‘}¹…µ”ñðÈ¹¹…µ”ñðÈ¹•µ…¥°ñð€œœ°(€€€¹…µ”èÈ¹¹…µ”ñð€œœ°(€€€Á¡½¹”èÈ¹Á¡½¹”ñð€œœ°(€€€•µ…¥°èÈ¹•µ…¥°ñð€œœ°(€€€ÍÑ…ÑÕÌèÈ¹É•Ù¥•Ý}ÍÑ…ÑÕÌñð€œœ°(€€€Á…åMÑ…ÑÕÌè½¹Í¥Ñ•A…åµ•¹ÑQ•áÐ¡È¤°(€€€ÍÑ…±±½Õ¹ÐèÍ…™•9Õ´¡È¹ÍÑ…±±}½Õ¹Ð¤ñð€Ä°(€€€•ÅÕ¥ÀèÍ…™•)Í½¸¡È¹•ÅÕ¥Áµ•¹Ñ}©Í½¸°íô¤°(€€€…‘‘½¹EÑäèÍ…™•)Í½¸¡È¹…‘‘½¹}ÅÑå}©Í½¸°íô¤°(€€€Í•±•Ñ•‘…Ñ•ÌèÍ…™•)Í½¸¡È¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸°mt¤°(€€€…µ½Õ¹ÐèÍ…™•9Õ´¡È¹…µ½Õ¹Ð¤°(€€€Ñ½Ñ…±µ½Õ¹ÐèÍ…™•9Õ´¡È¹Ñ½Ñ…±}…µ½Õ¹Ð¤°(€€€‘•Á½Í¥ÐèÍ…™•9Õ´¡È¹‘•Á½Í¥Ð¤°(€€€Á…¥‘ÐèÈ¹Á…¥‘}…Ðñð€œœ°(€€€Á…å5•Ñ¡½èÈ¹Á…åµ•¹Ñ}µ•Ñ¡½ñð€œœ°(€€€Á…å1…ÍÐÔèÈ¹Á…åµ•¹Ñ}±…ÍÐÔñð€œœ°(€€€¡•­¥¸èÈ¹¡•­¥¹}ÍÑ…ÑÕÌñð€Ÿšr«–‚Ç–"Àœ°(€€€¡•­¥¹ÐèÈ¹¡•­¥¹}…Ðñð€œœ°(€€€±•…ÉMÑ…ÑÕÌèÈ¹±•…É}ÍÑ…ÑÕÌñð€œœ°(€€€‘•Á½Í¥ÑI•™Õ¹‘•èÈ¹‘•Á½Í¥Ñ}É•™Õ¹‘•ñð€œœ°(€€€Ñ•…É‘½Ý¸èÈ¹Ñ•…É‘½Ý¹}ÍÑ…ÑÕÌñð€Ÿšr«šJ“–‚Ðœ°(€€€Ù¥½±…Ñ¥½¸èÈ¹Ù¥½±…Ñ¥½¹}™±…Ìñð€œœ°(€€€ÑÉ…¹Í™•ÉMÑ…ÑÕÌèÈ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌñð€œœ°(€€€…‘µ¥¹9½Ñ”èÈ¹…‘µ¥¹}¹½Ñ”ñð€œœ°(€€€É•…Ñ•‘ÐèÈ¹É•…Ñ•‘}…Ðñð€œœ°(€ôì)ô()…Íå¹Œ™Õ¹Ñ¥½¸•ÑÉ•Í¡=¹Í¥Ñ•±±½Ý•‘M•ÍÍ¥½¹%‘Ì¡•¹Ø°Ñ•¹…¹Ñ%°•µ…¥°°Ñ½­•¸¤ì(€½¹ÍÐÁ…å±½…€ô…Ý…¥ÐÙ•É¥™å‘µ¥¹)ÝÐ¡Ñ½­•¸°•¹Ø¤ì(€¥˜€ …Á…å±½…¤É•ÑÕÉ¸¹Õ±°ì(€½¹ÍÐÉ½±”€ôÁ…å±½…¹¹½Éµ…±¥é•‘}É½±”ñðÁ…å±½…¹É½±”ñð€œœì(€¥˜€¡É½±”€ôôô€Á±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ¤É•ÑÕÉ¸¹Õ±°ì€¼¼ƒ–æÏ–>Ã¢Úžº‡’â7¦fC–"Ø(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€ÍÑ…™˜œ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡•µ…¥°¥ô™Í•±•Ðõ¥±±¥µ¥Ñ}Í•ÍÍ¥½¹Ì±É½±”±¹½Éµ…±¥é•‘}É½±”±¥Í}…Ñ¥Ù”±…Ñ¥Ù”±Í½Á•}ÑåÁ”±Í½Á•}•Ù•¹Ñ}¥‘€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐÌ€ôÉ½ÝÍlÁtì(€¥˜€ …Ì¤É•ÑÕÉ¸mtì(€½¹ÍÐ…Ñ¥Ù”€ôÌ¹¥Í}…Ñ¥Ù”€„ôôÕ¹‘•™¥¹•€üÌ¹¥Í}…Ñ¥Ù”€èÌ¹…Ñ¥Ù”ì(€¥˜€¡…Ñ¥Ù”€ôôô™…±Í”¤É•ÑÕÉ¸mtì(€½¹ÍÐ‘‰I½±”€ôÌ¹¹½Éµ…±¥é•‘}É½±”ñðÌ¹É½±”ñðÉ½±”ì(€½¹ÍÐÍ½Á•QåÁ”€ôÌ¹Í½Á•}ÑåÁ”ñð€…±°œì(€€¼¼Í½Á•}ÑåÁ”ô…±°œƒ’âS¢žK¢&Ëšb¼½É…¹¥é•É}½Ý¹•È½½É…¹¥é•É}…‘µ¥¸ƒŠHƒ’â7¦fC–"Û¾ò3žr/–£¦£–‚Óš²„(€¥˜€¡Í½Á•QåÁ”€ôôô€…±°œ€˜˜€¡‘‰I½±”€ôôô€½É…¹¥é•É}½Ý¹•Èœñð‘‰I½±”€ôôô€½É…¹¥é•É}…‘µ¥¸œ¤¤É•ÑÕÉ¸¹Õ±°ì(€€¼¼Í½Á•}ÑåÁ”ô•Ù•¹ÐœƒŠHƒ’út•Ù•¹Ñ}¥ƒ¦;šþûšVÓ–/žÎï–"_žj–‚Óš²„(€¥˜€¡Í½Á•QåÁ”€ôôô€•Ù•¹Ðœ€˜˜Ì¹Í½Á•}•Ù•¹Ñ}¥¤ì(€€€½¹ÍÐÍ•ÍI½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™•Ù•¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹Í½Á•}•Ù•¹Ñ}¥¥ô™Í•±•Ðõ¥‘€¤¹…Ñ   ¤ôùmt¤ì(€€€É•ÑÕÉ¸Í•ÍI½ÝÌ¹µ…À¡àôùMÑÉ¥¹œ¡à¹¥‘ñðœœ¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€ô(€±•Ð¥‘Ì€ômtì(€€¼¼ƒš¶–ò?š:#š²+’úšêC–«–#’öÿžR €ÀÀäƒšZÃ–Š{žjÍÑ…™™}Í•ÍÍ¥½¹}Á•Éµ¥ÍÍ¥½¹Ï¾òo¢.—¢†£–Âkšr«–~ß¢†3¾ò3–n{¦ ÍÑ…™˜¹±¥µ¥Ñ}Í•ÍÍ¥½¹ÏŽ(€½¹ÍÐÁ•ÉµI½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€ÍÑ…™™}Í•ÍÍ¥½¹}Á•Éµ¥ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™ÍÑ…™™}•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡•µ…¥°¥ô™¥Í}…Ñ¥Ù”õ•Ä¹ÑÉÕ”™Í•±•ÐõÍ•ÍÍ¥½¹}¥‘€¤¹…Ñ   ¤ôù¹Õ±°¤ì(€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡Á•ÉµI½ÝÌ¤¤¥‘Ì€ôÁ•ÉµI½ÝÌ¹µ…À¡àôùMÑÉ¥¹œ¡à¹Í•ÍÍ¥½¹}¥‘ñðœœ¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€¥˜€ …¥‘Ì¹±•¹Ñ ¤¥‘Ì€ôMÑÉ¥¹œ¡Ì¹±¥µ¥Ñ}Í•ÍÍ¥½¹Ìñð€œœ¤¹ÍÁ±¥Ð œ°œ¤¹µ…À¡àôùà¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€¥˜€¡‘‰I½±”€ôôô€½¹Í¥Ñ•}ÍÑ…™˜œ¤É•ÑÕÉ¸¥‘Ìì(€¥˜€¡‘‰I½±”€ôôô€Í•ÍÍ¥½¹}…‘µ¥¸œ¤É•ÑÕÉ¸¥‘Ì¹±•¹Ñ €ü¥‘Ì€è¹Õ±°ì(€É•ÑÕÉ¸¹Õ±°ì)ô((¼¼ƒ¦kžR£¾òk’útÍÑ…™˜ƒžjš:#š²+ž¾–r7¾ò!…±°½•Ù•¹Ð½Í•ÍÍ¥½»¾ò'–>[–ú_–>¿¢š/žj–‚Óš²…%šâ–Z»¾ò1¹Õ±°÷’â7¦fC–"Ø)…Íå¹Œ™Õ¹Ñ¥½¸•ÑMÑ…™™M½Á•‘M•ÍÍ¥½¹%‘Ì¡•¹Ø°Ñ•¹…¹Ñ%°•µ…¥°°É½±”¤ì(€¥˜€¡É½±”€ôôô€Á±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ¤É•ÑÕÉ¸¹Õ±°ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€ÍÑ…™˜œ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡•µ…¥°¥ô™Í•±•Ðõ±¥µ¥Ñ}Í•ÍÍ¥½¹Ì±Í½Á•}ÑåÁ”±Í½Á•}•Ù•¹Ñ}¥±¹½Éµ…±¥é•‘}É½±”±É½±•€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐÌ€ôÉ½ÝÍlÁtì(€¥˜€ …Ì¤É•ÑÕÉ¸mtì(€½¹ÍÐ‘‰I½±”€ôÌ¹¹½Éµ…±¥é•‘}É½±”ñðÌ¹É½±”ñðÉ½±”ì(€½¹ÍÐÍ½Á•QåÁ”€ôÌ¹Í½Á•}ÑåÁ”ñð€…±°œì(€¥˜€¡Í½Á•QåÁ”€ôôô€…±°œ¤ì(€€€€¼¼ƒ¢Ê‡–.g’î—’â+¢žK¢&Ë¢.—¢¢·–ºkž
ëŽ3–£¦£Ž7¾ò3–>¿žr/šVÓžžš"Û¾òo–‚Óš²‡¾ò?ž>û–‚Ó¢žK¢&Ë’î7’úwš¶–ò?š:#š²+žâ»¦fCŽ(€€€¥˜€¡l½É…¹¥é•É}½Ý¹•Èœ°½É…¹¥é•É}…‘µ¥¸œ°™¥¹…¹•}…‘µ¥¸t¹¥¹±Õ‘•Ì¡‘‰I½±”¤¤É•ÑÕÉ¸¹Õ±°ì(€ô(€¥˜€¡Í½Á•QåÁ”€ôôô€•Ù•¹Ðœ€˜˜Ì¹Í½Á•}•Ù•¹Ñ}¥¤ì(€€€½¹ÍÐÍ•ÍI½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™•Ù•¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹Í½Á•}•Ù•¹Ñ}¥¥ô™Í•±•Ðõ¥‘€¤¹…Ñ   ¤ôùmt¤ì(€€€É•ÑÕÉ¸Í•ÍI½ÝÌ¹µ…À¡àôùMÑÉ¥¹œ¡à¹¥‘ñðœœ¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€ô(€€¼¼Í½Á•}ÑåÁ”ôôôÍ•ÍÍ¥½¸œƒš"[–Û’î[¾òk–n{¦žR ±¥µ¥Ñ}Í•ÍÍ¥½¹Ì(€½¹ÍÐ¥‘Ì€ôMÑÉ¥¹œ¡Ì¹±¥µ¥Ñ}Í•ÍÍ¥½¹Ìñð€œœ¤¹ÍÁ±¥Ð œ°œ¤¹µ…À¡àôùà¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€É•ÑÕÉ¸¥‘Ìì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡=¹Í¥Ñ•M•ÍÍ¥½¹Ì¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P°€¡•­¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ…±±½Ý•‘%‘Ì€ô…Ý…¥Ð•ÑÉ•Í¡=¹Í¥Ñ•±±½Ý•‘M•ÍÍ¥½¹%‘Ì¡•¹Ø°Q99P°À¹•µ…¥°°À¹Ñ½­•¸¤ì(€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡…±±½Ý•‘%‘Ì¤€˜˜…±±½Ý•‘%‘Ì¹±•¹Ñ €ôôô€À¤É•ÑÕÉ¸©Í½¹=¬¡mt¤ì((€½¹ÍÐmÍ•ÍÍ¥½¹Ì°É•Ít€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•ÐõÍ•ÍÍ¥½¹}¥±É•Ù¥•Ý}ÍÑ…ÑÕÌ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌ±¡•­¥¹}ÍÑ…ÑÕÌ±ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ±ÍÑ…±±}½Õ¹Ð±…µ½Õ¹Ð±‘•Á½Í¥Ñ€¤°(€t¤ì(€±•Ð±¥ÍÐ€ôÍ•ÍÍ¥½¹Ìì(€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡…±±½Ý•‘%‘Ì¤¤±¥ÍÐ€ôÍ•ÍÍ¥½¹Ì¹™¥±Ñ•È¡Ì€ôø…±±½Ý•‘%‘Ì¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡Ì¹¥¤¤¤ì(€€¼¼ƒž>û–‚Óžº‡žB–>«šr7–.gŽ3žVÛ–’§žržj¢š–‚Ç–"ÃŽ7žj–‚Óš²‡¾òh(€€¼¼€Ä¤ƒš:K¦f“–Â–¶c¾ò?–ÞË–>[šÚ#žj–‚Óš²‡Ž È¤ƒš:K¦f“šÊKšr'’îï’öW–>¿–‚Ç–"Ã–B7–Z»¾ò#–ÞË¦2–>[¾ò/–ÞËžæÏ¢Êïš"[–7¢Êï¾ò'žj–‚Óš²„(€±¥ÍÐ€ô±¥ÍÐ¹™¥±Ñ•È¡Ì€ôøì(€€€½¹ÍÐÍÐ€ôMÑÉ¥¹œ¡Ì¹ÍÑ…ÑÕÌñð€œœ¤¹ÑÉ¥´ ¤ì(€€€¥˜€¡ÍÐ€ôôô€Ÿ–Â–¶`œñðÍÐ€ôôô€Ÿ–ÞË–>[šÚ œ¤É•ÑÕÉ¸™…±Í”ì(€€€½¹ÍÐÉÌ€ôÉ•Ì¹™¥±Ñ•È¡È€ôøÈ¹Í•ÍÍ¥½¹}¥€ôôôÌ¹¥¤ì(€€€½¹ÍÐÁ…å…‰±”€ôÉÌ¹™¥±Ñ•È¡È€ôøMÑÉ¥¹œ¡È¹É•Ù¥•Ý}ÍÑ…ÑÕÌñð€œœ¤€ôôô€Ÿ–ÞË¦2–>Xœ(€€€€€€˜˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡È¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤ñð¥Í	½½­¥¹M•ÕÉ•‘MÑ…ÑÕÌ¡È¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤ñðMÑÉ¥¹œ¡È¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌñð€œœ¤€ôôô€Ÿ–7¢Êìœ¤(€€€€€€˜˜€…lŸžRÏ¢®/¦¢Êìœ°Ÿ–ÞË¦¢Êìt¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡È¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌñð€œœ¤¤¤ì(€€€É•ÑÕÉ¸Á…å…‰±”¹±•¹Ñ €ø€Àì(€ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡±¥ÍÐ¹µ…À¡Ì€ôøì(€€€½¹ÍÐÉÌ€ôÉ•Ì¹™¥±Ñ•È¡È€ôøÈ¹Í•ÍÍ¥½¹}¥€ôôôÌ¹¥¤ì(€€€½¹ÍÐ…ÁÁÉ½Ù•€ôÉÌ¹™¥±Ñ•È¡È€ôøMÑÉ¥¹œ¡È¹É•Ù¥•Ý}ÍÑ…ÑÕÌñð€œœ¤€ôôô€Ÿ–ÞË¦2–>Xœ¤ì(€€€½¹ÍÐÁ…¥€ô…ÁÁÉ½Ù•¹™¥±Ñ•È¡È€ôø¥ÍA…¥‘MÑ…ÑÕÌ¡È¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤ñð¥Í	½½­¥¹M•ÕÉ•‘MÑ…ÑÕÌ¡È¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤ñðMÑÉ¥¹œ¡È¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌñð€œœ¤€ôôô€Ÿ–7¢Êìœ¤ì(€€€½¹ÍÐ¡•­•€ôÁ…¥¹™¥±Ñ•È¡È€ôøMÑÉ¥¹œ¡È¹¡•­¥¹}ÍÑ…ÑÕÌñð€œœ¤€ôôô€Ÿ–ÞË–‚Ç–"Àœ¤ì(€€€½¹ÍÐ™±…•€ôÉÌ¹™¥±Ñ•È¡È€ôøMÑÉ¥¹œ¡È¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌñð€œœ¤¹¥¹±Õ‘•Ì Ÿ¦¢Êìœ¤ñðMÑÉ¥¹œ¡È¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌñð€œœ¤¹¥¹±Õ‘•Ì Ÿ¦š²øœ¤¤ì(€€€½¹ÍÐ™µÐ€ô™½Éµ…ÑM•ÍÍ¥½¸¡Ì¤ì(€€€É•ÑÕÉ¸ì(€€€€€¥è™µÐ¹¥°(€€€€€¹…µ”è™µÐ¹¹…µ”°(€€€€€ÑåÁ”è™µÐ¹ÑåÁ”ñð€œœ°(€€€€€É•¥½¸è™µÐ¹É•¥½¸ñð€œœ°(€€€€€‘…Ñ•Ìè™µÐ¹‘…Ñ•Ìñðmt°(€€€€€ÍÑ…ÑÕÌè™µÐ¹ÍÑ…ÑÕÌñðÌ¹ÍÑ…ÑÕÌñð€œœ°(€€€€€Ñ½Ñ…°èÉÌ¹±•¹Ñ °(€€€€€…ÁÁÉ½Ù•è…ÁÁÉ½Ù•¹±•¹Ñ °(€€€€€Á…å…‰±”èÁ…¥¹±•¹Ñ °(€€€€€¡•­•‘%¸è¡•­•¹±•¹Ñ °(€€€€€É•™Õ¹‘±…œè™±…•¹±•¹Ñ °(€€€€€ÍÑ…±±½Õ¹ÐèÁ…¥¹É•‘Õ” ¡ÍÕ´±È¤ôùÍÕ´¬¡Í…™•9Õ´¡È¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤°À¤°(€€€€€Á…¥‘µ½Õ¹ÐèÁ…¥¹É•‘Õ” ¡ÍÕ´±È¤ôùÍÕ´­Í…™•9Õ´¡È¹…µ½Õ¹Ð¤°À¤°(€€€€€‘•Á½Í¥ÑQ½Ñ…°èÁ…¥¹É•‘Õ” ¡ÍÕ´±È¤ôùÍÕ´­Í…™•9Õ´¡È¹‘•Á½Í¥Ð¤°À¤°(€€€€€µ½‘Õ±•Ìè¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ì¹µ½‘Õ±•Í}©Í½¸±íô¤¤°(€€€ôì(€ô¤¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡=¹Í¥Ñ•I•Ì¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐÍ%€ôÀ¹Í•ÍÍ¥½¹%ñðÀ¹Í•ÍÍ¥½¹}¥ì(€¥˜€ …Í%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úlÍ•ÍÍ¥½¹%œ¤ì(€½¹ÍÐÁ=¬€ôÀ¹Á…ÍÍ½‘”€ü…Ý…¥ÐÙ•É¥™åA…ÍÍ½‘”¡•¹Ø°Q99P°Í%°MÑÉ¥¹œ¡À¹Á…ÍÍ½‘”¤¤€è¹Õ±°ì(€¥˜€ …Á=¬€˜˜€……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P°€¡•­¥¸œ°Í%¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™Í•±•Ðô©€¤ì(€€¼¼ƒž>û–‚Ó–B7–Z»¾òk–>«–ëž>ûŽ3–ÞË¦2–>[¾ò/–ÞËžæÏ¢Êï¾ò#–B¯–7¢Êï¾ò'¾ò/¦v{¦¢ÊïšÖž¢/’â·Ž7žjšR“–>/¾ò#¢"–‚Ç–"Ã¢š?–&’â¢Ó¾ò$(€½¹ÍÐ½¹Í¥Ñ•I½ÝÌ€ôÉ½ÝÌ¹™¥±Ñ•È¡È€ôø€…¡•­¥¹Õ…É¡È°™…±Í”¤¤ì(€É•ÑÕÉ¸©Í½¹=¬¡½¹Í¥Ñ•I½ÝÌ¹µ…À¡™½Éµ…Ñ=¹Í¥Ñ•I•œ¤¤ì)ô((¼¼ƒŠRŠR ƒž>û–‚Ó¦k¢†3žŠó¾ò Ó’ö7šVã¾ò3’â–‚Ó’âžŠó¾ò3¦fC–‚Ç–"Ãžnã¦^s¾ò$ƒŠRŠR )…Íå¹Œ™Õ¹Ñ¥½¸Ù•É¥™åA…ÍÍ½‘”¡•¹Ø°Ñ¥°Í•ÍÍ¥½¹%°½‘”¤ì(€¥˜€ …½‘”¤É•ÑÕÉ¸¹Õ±°ì(€ÑÉäì(€€€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€½¹Í¥Ñ•}Á…ÍÍ½‘•Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ¥‘ô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™½‘”õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½‘”¥ô™…Ñ¥Ù”õ•Ä¹ÑÉÕ”™Í•±•Ðô©€¤ì(€€€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸¹Õ±°ì(€€€½¹ÍÐÀ€ôÉ½ÝÍlÁtì½¹ÍÐ¹½Ü€ô…Ñ”¹¹½Ü ¤ì(€€€¥˜€¡À¹½Á•¹}™É½´€˜˜¹½Ü€ð¹•Ü…Ñ”¡À¹½Á•¹}™É½´¤¹•ÑQ¥µ” ¤¤É•ÑÕÉ¸¹Õ±°ì(€€€¥˜€¡À¹½Á•¹}Õ¹Ñ¥°€˜˜¹½Ü€ø¹•Ü…Ñ”¡À¹½Á•¹}Õ¹Ñ¥°¤¹•ÑQ¥µ” ¤¤É•ÑÕÉ¸¹Õ±°ì(€€€É•ÑÕÉ¸Àì(€ô…Ñ €¡”¤ìÉ•ÑÕÉ¸¹Õ±°ìô)ô)…Íå¹Œ™Õ¹Ñ¥½¸ÍÑ…™™¥ÍÁ±…å9…µ”¡•¹Ø°Ñ¥°•µ…¥°¤ì(€ÑÉäì(€€€½¹ÍÐÈ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€ÍÑ…™˜œ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ¥‘ô™•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡•µ…¥°¥ô™Í•±•Ðõ¹…µ”±‘¥ÍÁ±…å}¹…µ”±•µ…¥±€¤ì(€€€½¹ÍÐÌ€ôÉlÁtñðíôìÉ•ÑÕÉ¸Ì¹¹…µ”ñðÌ¹‘¥ÍÁ±…å}¹…µ”ñðÌ¹•µ…¥°ñð•µ…¥°ñð€Ÿžº‡žB¢œì(€ô…Ñ €¡”¤ìÉ•ÑÕÉ¸•µ…¥°ñð€Ÿžº‡žB¢œìô)ô(¼¼ƒž>û–‚Ó¢òã–—žŠðƒŠHƒš&û–ë–Â7š'–‚Óš²‡¾ò#–³¦Z/¾ò3’â7¦ržfï–—¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡=¹Í¥Ñ•A…ÍÍ½‘•Y•É¥™ä¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐ½‘”€ôMÑÉ¥¹œ ¡ˆ€˜˜ˆ¹½‘”¤ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ „½yq‘ìÑô¼¹Ñ•ÍÐ¡½‘”¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¢òã–”€Ðƒ’ö7šVã–¶_¦k¢†3žŠðœ¤ì(€½¹ÍÐ¹½Ü€ô…Ñ”¹¹½Ü ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€½¹Í¥Ñ•}Á…ÍÍ½‘•Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™½‘”õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½‘”¥ô™…Ñ¥Ù”õ•Ä¹ÑÉÕ”™Í•±•Ðô©€¤¹…Ñ   ¤€ôømt¤ì(€½¹ÍÐÙ…±¥€ôÉ½ÝÌ¹™¥±Ñ•È¡À€ôøì(€€€¥˜€¡À¹½Á•¹}™É½´€˜˜¹½Ü€ð¹•Ü…Ñ”¡À¹½Á•¹}™É½´¤¹•ÑQ¥µ” ¤¤É•ÑÕÉ¸™…±Í”ì(€€€¥˜€¡À¹½Á•¹}Õ¹Ñ¥°€˜˜¹½Ü€ø¹•Ü…Ñ”¡À¹½Á•¹}Õ¹Ñ¥°¤¹•ÑQ¥µ” ¤¤É•ÑÕÉ¸™…±Í”ì(€€€É•ÑÕÉ¸ÑÉÕ”ì(€ô¤ì(€¥˜€ …Ù…±¥¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦k¢†3žŠóž‡šV#š"[–ÞË¦;šr|œ¤ì(€½¹ÍÐÀ€ôÙ…±¥‘lÁtì(€½¹ÍÐÍ•Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡À¹Í•ÍÍ¥½¹}¥¥ô™Í•±•Ðõ¥±¹…µ”±µ½‘Õ±•Í}©Í½¹€¤¹…Ñ   ¤€ôømt¤ì(€É•ÑÕÉ¸©Í½¹=¬¡ìÍ•ÍÍ¥½¹%èÀ¹Í•ÍÍ¥½¹}¥°Í•ÍÍ¥½¹9…µ”è€¡Í•ÍlÁt€˜˜Í•ÍlÁt¹¹…µ”¤ñð€œœ°µ½‘Õ±•Ìé¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Í•ÍlÁt˜™Í•ÍlÁt¹µ½‘Õ±•Í}©Í½¸±íô¤¤ô¤ì)ô(¼¼ƒ–ú3–>Ã¾òk–"_–ë¦k¢†3žŠð)…Íå¹Œ™Õ¹Ñ¥½¸¡=¹Í¥Ñ•A…ÍÍ½‘•1¥ÍÐ¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P°€¡•­¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€½¹Í¥Ñ•}Á…ÍÍ½‘•Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤€ôømt¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É½ÝÌ¹µ…À¡È€ôø€¡ì¥èÈ¹¥°Í•ÍÍ¥½¹%èÈ¹Í•ÍÍ¥½¹}¥°½‘”èÈ¹½‘”°½Á•¹É½´èÈ¹½Á•¹}™É½´°½Á•¹U¹Ñ¥°èÈ¹½Á•¹}Õ¹Ñ¥°°…Ñ¥Ù”èÈ¹…Ñ¥Ù”ô¤¤¤ì)ô(¼¼ƒ–ú3–>Ã¾òkžR‹žR|€¼ƒš>ožŠó¾ò#¢«–.Wžº_¦Z/šRûšf¦ZO¾ò0Ó’ö7’â7¢"ž>ûšr'–VžR£žŠó¦7¢’¾ò3’â–‚Ó’âžŠó¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡=¹Í¥Ñ•A…ÍÍ½‘••¹•É…Ñ”¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°ˆ¹•µ…¥°°ˆ¹Ñ½­•¸°Q99P°€¡•­¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôMÑÉ¥¹œ ¡ˆ€˜˜ˆ¹Í•ÍÍ¥½¹%¤ñð€œœ¤ì(€¥˜€ …Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÍ•ÍÍ¥½¹%œ¤ì(€½¹ÍÐÍ•Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …Í•Ì¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Óš²„œ¤ì(€½¹ÍÐÌ€ôÍ•ÍlÁtì(€½¹ÍÐ‘…Ñ•Ì€ô€¡Í…™•)Í½¸¡Ì¹‘…Ñ•Í}©Í½¸°mt¤ñðmt¤¹µ…À¡€ôø€¡€˜˜¹‘…Ñ”¤€ü¹‘…Ñ”€è¤¹™¥±Ñ•È¡	½½±•…¸¤¹Í½ÉÐ ¤ì(€±•Ð½Á•¹É½´€ô¹Õ±°°½Á•¹U¹Ñ¥°€ô¹Õ±°ì(€¥˜€¡‘…Ñ•Ì¹±•¹Ñ ¤ì(€€€½¹ÍÐ™¥ÉÍÐ€ô¹•Ü…Ñ”¡‘…Ñ•ÍlÁt€¬€PÀÀèÀÀèÀÀ¬ÀàèÀÀœ¤ì(€€€½¹ÍÐ±…ÍÐ€ô¹•Ü…Ñ”¡‘…Ñ•Ím‘…Ñ•Ì¹±•¹Ñ €´€Åt€¬€PÈÌèÔäèÔä¬ÀàèÀÀœ¤ì(€€€½Á•¹É½´€ô¹•Ü…Ñ”¡™¥ÉÍÐ¹•ÑQ¥µ” ¤€´€È€¨€ÈÐ€¨€ÌØÀÀ€¨€ÄÀÀÀ¤¹Ñ½%M=MÑÉ¥¹œ ¤ì(€€€½Á•¹U¹Ñ¥°€ô¹•Ü…Ñ”¡±…ÍÐ¹•ÑQ¥µ” ¤€¬€à€¨€ÌØÀÀ€¨€ÄÀÀÀ¤¹Ñ½%M=MÑÉ¥¹œ ¤ì(€ô(€½¹ÍÐ•á¥ÍÑ¥¹œ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€½¹Í¥Ñ•}Á…ÍÍ½‘•Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™…Ñ¥Ù”õ•Ä¹ÑÉÕ”™Í•±•Ðõ½‘•€¤¹…Ñ   ¤€ôømt¤ì(€½¹ÍÐÕÍ•€ô¹•ÜM•Ð¡•á¥ÍÑ¥¹œ¹µ…À¡à€ôøMÑÉ¥¹œ¡à¹½‘”¤¤¤ì(€±•Ð½‘”€ô€œœì(€™½È€¡±•Ð¤€ô€Àì¤€ð€ØÀì¤¬¬¤ì½¹ÍÐŒ€ôMÑÉ¥¹œ¡Í•ÕÉ•I…¹‘½µ%¹Ð ÄÀÀÀ°ääää¤¤ì¥˜€ …ÕÍ•¹¡…Ì¡Œ¤¤ì½‘”€ôŒì‰É•…¬ìôô(€¥˜€ …½‘”¤½‘”€ôMÑÉ¥¹œ¡Í•ÕÉ•I…¹‘½µ%¹Ð ÄÀÀÀ°ääää¤¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€½¹Í¥Ñ•}Á…ÍÍ½‘•Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™…Ñ¥Ù”õ•Ä¹ÑÉÕ•€°ì…Ñ¥Ù”è™…±Í”°ÕÁ‘…Ñ•‘}…Ðè¹½Ý%Í¼ ¤ô¤¹…Ñ   ¤€ôøíô¤ì(€½¹ÍÐ¥€ô•¹% Aœ¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€½¹Í¥Ñ•}Á…ÍÍ½‘•Ìœ°ì¥°Ñ•¹…¹Ñ}¥èQ99P°Í•ÍÍ¥½¹}¥èÍ•ÍÍ¥½¹%°½‘”°½Á•¹}™É½´è½Á•¹É½´°½Á•¹}Õ¹Ñ¥°è½Á•¹U¹Ñ¥°°…Ñ¥Ù”èÑÉÕ”°É•…Ñ•‘}…Ðè¹½Ý%Í¼ ¤°ÕÁ‘…Ñ•‘}…Ðè¹½Ý%Í¼ ¤ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡ì¥°½‘”°½Á•¹É½´°½Á•¹U¹Ñ¥°ô¤ì)ô(¼¼ƒ–ú3–>Ã¾òk–sžR €¼ƒ–VžR )…Íå¹Œ™Õ¹Ñ¥½¸¡=¹Í¥Ñ•A…ÍÍ½‘•Q½±”¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°ˆ¹•µ…¥°°ˆ¹Ñ½­•¸°Q99P°€¡•­¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ¥€ôMÑÉ¥¹œ ¡ˆ€˜˜ˆ¹¥¤ñð€œœ¤ì(€¥˜€ …¥¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂD¥œ¤ì(€½¹ÍÐ…Ñ¥Ù”€ô€¡ˆ¹…Ñ¥Ù”€ôôôÑÉÕ”ñðˆ¹…Ñ¥Ù”€ôôô€ÑÉÕ”œ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€½¹Í¥Ñ•}Á…ÍÍ½‘•Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€°ì…Ñ¥Ù”°ÕÁ‘…Ñ•‘}…Ðè¹½Ý%Í¼ ¤ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡ìÍÕ•ÍÌèÑÉÕ”ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡=¹Í¥Ñ•5…É¬¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐÉ•%€ôˆ¹É•%ñðˆ¹¥ì(€½¹ÍÐµ½‘”€ôMÑÉ¥¹œ¡ˆ¹µ½‘”ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …É•%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÉ•%œ¤ì(€¥˜€ …µ½‘”¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDµ½‘”œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€€¼¼ƒ¢ª7¢¶'¾òi½½±”ƒžº‡žB¢ƒš"Xƒž>û–‚Ó¦k¢†3žŠó¾ò#’ê3šN’â¾ò'¾òo’â›¢¢c¦2šN7’ös¢(€±•Ð½Á•É…Ñ½È€ô€œœì(€½¹ÍÐAMM}5=L€ôl¡•­¥¸œ°Õ¹‘½¡•­¥¸œ°¹½M¡½Üœ°±…Ñ•±…œœ°ÉÕ±•±…œœ°•…É±å±…œœ°Ñ•…É‘½Ý¹½¹”œ°Ñ•…É‘½Ý¹U¹‘¼œ°‘•Á½Í¥ÑI•™Õ¹œ°‘•Á½Í¥Ñ½É™•¥Ñ•œ°‘•Á½Í¥ÑU¹É•™Õ¹œ°¹½Ñ”tì(€½¹ÍÐÁŒ€ôˆ¹Á…ÍÍ½‘”€ü…Ý…¥ÐÙ•É¥™åA…ÍÍ½‘”¡•¹Ø°Q99P°É•œ¹Í•ÍÍ¥½¹}¥°MÑÉ¥¹œ¡ˆ¹Á…ÍÍ½‘”¤¤€è¹Õ±°ì(€¥˜€¡ÁŒ¤ì(€€€¥˜€ …AMM}5=L¹¥¹±Õ‘•Ì¡µ½‘”¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž>û–‚Ó¦k¢†3žŠóž‡š²+¦fC–kš¶“šN7’öpœ¤ì(€€€½¹ÍÐÝ¡¼€ôMÑÉ¥¹œ¡ˆ¹½Á•É…Ñ½É9…µ”ñð€œœ¤¹ÑÉ¥´ ¤ì(€€€½Á•É…Ñ½È€ô€¡Ý¡¼ñð€Ÿž>û–‚Ó’êë–N„œ¤€¬€Ÿ
ßž>û–‚ÓžŠðœì(€ô•±Í”ì(€€€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°¡•­¥¸œ±É•œ¹Í•ÍÍ¥½¹}¥¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€€€½Á•É…Ñ½È€ô…Ý…¥ÐÍÑ…™™¥ÍÁ±…å9…µ”¡•¹Ø°Q99P°ˆ¹•µ…¥°¤ì(€ô((€½¹ÍÐ¹½Ü€ô¹½Ý%Í¼ ¤ì(€½¹ÍÐ¹½Ñ•Q•áÐ€ôMÑÉ¥¹œ¡ˆ¹¹½Ñ”ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ½±‘9½Ñ”€ôMÑÉ¥¹œ¡É•œ¹…‘µ¥¹}¹½Ñ”ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ…ÁÁ•¹‘9½Ñ”€ô€¡±…‰•°¤€ôø€‘í½±‘9½Ñ”€ü½±‘9½Ñ”€¬€œ€œ€è€œõož>û–‚Ó
Ü‘í½Á•É…Ñ½Éõt€‘í±…‰•±ô€‘í¹½ÝQ…¥Á•¥Q•áÐ ¥ô‘í¹½Ñ•Q•áÐ€ü€Ÿ¾öpœ€¬¹½Ñ•Q•áÐ€è€œõ€ì(€½¹ÍÐ‘…Ñ„€ôíôì((€¥˜€¡µ½‘”€ôôô€¡•­¥¸œ¤ì(€€€½¹ÍÐ•ÉÈ€ô¡•­¥¹Õ…É¡É•œ°™…±Í”¤ì(€€€¥˜€¡•ÉÈ¤É•ÑÕÉ¸©Í½¹ÉÈ¡•ÉÈ¤ì(€€€=‰©•Ð¹…ÍÍ¥¸¡‘…Ñ„°¡•­¥¹…Ñ„¡™…±Í”°¹½Ü¤¤ì(€€€‘…Ñ„¹…‘µ¥¹}¹½Ñ”€ô…ÁÁ•¹‘9½Ñ” Ÿ–ÞË–‚Ç–"Àœ¤ì(€ô•±Í”¥˜€¡µ½‘”€ôôô€Õ¹‘½¡•­¥¸œ¤ì(€€€=‰©•Ð¹…ÍÍ¥¸¡‘…Ñ„°¡•­¥¹…Ñ„¡ÑÉÕ”°¹½Ü¤¤ì(€€€‘…Ñ„¹…‘µ¥¹}¹½Ñ”€ô…ÁÁ•¹‘9½Ñ” Ÿ–>[šÚ#–‚Ç–"Àœ¤ì(€ô•±Í”¥˜€¡µ½‘”€ôôô€¹½M¡½Üœ¤ì(€€€‘…Ñ„¹¡•­¥¹}ÍÑ…ÑÕÌ€ô€Ÿšr«–"Àœì(€€€‘…Ñ„¹…‘µ¥¹}¹½Ñ”€ô…ÁÁ•¹‘9½Ñ” Ÿš¢g¢¢cšr«–"Àœ¤ì(€ô•±Í”¥˜€¡µ½‘”€ôôô€É•™Õ¹‘±…œœ¤ì(€€€‘…Ñ„¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ€ô€Ÿ¦¢Êï–ú¢fWžBœì(€€€‘…Ñ„¹…‘µ¥¹}¹½Ñ”€ô…ÁÁ•¹‘9½Ñ” Ÿž&çšº+¾ò?¦¢Êï–ú¢fWžBœ¤ì(€ô•±Í”¥˜€¡µ½‘”€ôôô€‘•Á½Í¥ÑI•™Õ¹œ¤ì(€€€€¼¼ƒš¶–âã¦š*ó¦G¾òkš*ó¦Gš¶ã¦
šR“–V¾ò3¢¢c¦2¦¦
šf¦ZL(€€€¥˜€¡MÑÉ¥¹œ¡É•œ¹‘•Á½Í¥Ñ}É•™Õ¹‘•‘ñðœœ¤€ôôô€Ÿ–ÞË¦š*ó¦Dœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7š*ó¦G–ÞË¦¦
œ¤ì(€€€‘…Ñ„¹‘•Á½Í¥Ñ}É•™Õ¹‘•€ô€Ÿ–ÞË¦š*ó¦Dœì(€€€‘…Ñ„¹…‘µ¥¹}¹½Ñ”€ô…ÁÁ•¹‘9½Ñ” Ÿš*ó¦G–ÞË¦¦
šR“–Vœ¤ì(€ô•±Í”¥˜€¡µ½‘”€ôôô€‘•Á½Í¥Ñ½É™•¥Ñ•œ¤ì(€€€€¼¼ƒ¦WžÒšÊKšRÛš*ó¦G¾òkš*ó¦G¢ö'ž
ë’âï¢ú›šRÛ–”(€€€¥˜€¡MÑÉ¥¹œ¡É•œ¹‘•Á½Í¥Ñ}É•™Õ¹‘•‘ñðœœ¤€ôôô€Ÿš*ó¦GšÊKšRØœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7š*ó¦G–ÞËš¢g¢¢cšÊKšRØœ¤ì(€€€‘…Ñ„¹‘•Á½Í¥Ñ}É•™Õ¹‘•€ô€Ÿš*ó¦GšÊKšRØœì(€€€½¹ÍÐ…µÐõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡Í…™•9Õ´¡É•œ¹‘•Á½Í¥Ð¤±Í…™•9Õ´¡ˆ¹‘•‘ÕÑµ½Õ¹Ð¥ññÍ…™•9Õ´¡É•œ¹‘•Á½Í¥Ð¤¤¤±É•…Í½¸õMÑÉ¥¹œ¡ˆ¹‘•‘ÕÑI•…Í½¹ññ¹½Ñ•Q•áÑñðœœ¤¹ÑÉ¥´ ¤í‘…Ñ„¹…‘µ¥¹}¹½Ñ”õ…ÁÁ•¹‘9½Ñ” Ÿš&š*ó¦D9Pœ­…µÐ¬¡É•…Í½¸üŸ¾ös–:–nƒ¾òhœ­É•…Í½¸èœœ¤¤ì(€ô•±Í”¥˜€¡µ½‘”€ôôô€±…Ñ•±…œœñðµ½‘”€ôôô€ÉÕ±•±…œœñðµ½‘”€ôôô€•…É±å±…œœ¤ì(€€€½¹ÍÐ±…‰•±5…À€ôì±…Ñ•±…œèŸ¦Ë–"Àœ°ÉÕ±•±…œèŸ’â7¦×–º#¢š?–ºhœ°•…É±å±…œèŸš^§¦ œôì(€€€½¹ÍÐ±…‰•°€ô±…‰•±5…Ámµ½‘•tì(€€€½¹ÍÐÕÈ€ôMÑÉ¥¹œ¡É•œ¹Ù¥½±…Ñ¥½¹}™±…Ìñð€œœ¤¹ÍÁ±¥Ð œ°œ¤¹µ…À¡Ì€ôøÌ¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€¥˜€ …ÕÈ¹¥¹±Õ‘•Ì¡±…‰•°¤¤ÕÈ¹ÁÕÍ ¡±…‰•°¤ì(€€€‘…Ñ„¹Ù¥½±…Ñ¥½¹}™±…Ì€ôÕÈ¹©½¥¸ œ°œ¤ì(€€€½¹ÍÐµ¥¹Ìõ5…Ñ ¹µ…à À±Í…™•9Õ´¡ˆ¹±…Ñ•5¥¹ÕÑ•Ì¤¤í½¹ÍÐ½¹Ñ…Ðõmˆ¹±¥¹•9½Ñ¥™¥•ü1%9ƒ–ÞË¦kž~”œèœœ±ˆ¹Á¡½¹•½¹Ñ…Ñ•üŸ¦nï¢¦Ç–ÞË¢¿žÖ„œèœt¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ Ÿ¾öpœ¤í‘…Ñ„¹…‘µ¥¹}¹½Ñ”õ…ÁÁ•¹‘9½Ñ”¡±…‰•°¬¡µ½‘”ôôô±…Ñ•±…œœ˜™µ¥¹Ìü œ€œ­µ¥¹Ì¬œƒ–"¦B`œ¤èœœ¤¬¡½¹Ñ…ÐüŸ¾öpœ­½¹Ñ…Ðèœœ¤¤ì(€ô•±Í”¥˜€¡µ½‘”€ôôô€Ñ•…É‘½Ý¹½¹”œ¤ì(€€€‘…Ñ„¹Ñ•…É‘½Ý¹}ÍÑ…ÑÕÌ€ô€Ÿ–ÞËšJ“–‚Ðœì(€€€‘…Ñ„¹…‘µ¥¹}¹½Ñ”€ô…ÁÁ•¹‘9½Ñ” Ÿ–ÞËšJ“–‚Ðœ¤ì(€ô•±Í”¥˜€¡µ½‘”€ôôô€Ñ•…É‘½Ý¹U¹‘¼œ¤ì(€€€‘…Ñ„¹Ñ•…É‘½Ý¹}ÍÑ…ÑÕÌ€ô€Ÿšr«šJ“–‚Ðœì(€€€‘…Ñ„¹…‘µ¥¹}¹½Ñ”€ô…ÁÁ•¹‘9½Ñ” ŸšRçž
ëšr«šJ“–‚Ðœ¤ì(€ô•±Í”¥˜€¡µ½‘”€ôôô€‘•Á½Í¥ÑU¹É•™Õ¹œ¤ì(€€€‘…Ñ„¹‘•Á½Í¥Ñ}É•™Õ¹‘•€ô€Ÿšr«¦š*ó¦Dœì(€€€‘…Ñ„¹…‘µ¥¹}¹½Ñ”€ô…ÁÁ•¹‘9½Ñ” Ÿš*ó¦GšRçž
ëšr«¦ œ¤ì(€ô•±Í”¥˜€¡µ½‘”€ôôô€¹½Ñ”œ¤ì(€€€‘…Ñ„¹…‘µ¥¹}¹½Ñ”€ô…ÁÁ•¹‘9½Ñ” Ÿž>û–‚Ó–
g¢¢ìœ¤ì(€ô•±Í”ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿšr«ž~—ž>û–‚ÓšN7’ös¾òhœ€¬µ½‘”¤ì(€ô(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±‘…Ñ„¤ì(€¥˜¡‘…Ñ„¹…‘µ¥¹}¹½Ñ”˜™É•œ¹•µ…¥°¥í½¹ÍÐµ•´õ…Ý…¥Ð‘‰•Ð¡•¹Ø°µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹•µ…¥°¥ô™Í•±•Ðõ¥±…‘µ¥¹}¹½Ñ•€¤¹…Ñ   ¤ôùmt¤í¥˜¡µ•´¹±•¹Ñ ¥í½¹ÍÐ±¥¹”õ‘…Ñ„¹…‘µ¥¹}¹½Ñ”¹ÍÁ±¥Ð q¸œ¤¹Í±¥” ´Ä¥lÁt±µÀõMÑÉ¥¹œ¡µ•µlÁt¹…‘µ¥¹}¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤í…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡µ•µlÁt¹¥¥õ€±í…‘µ¥¹}¹½Ñ”éµÀýµÀ¬q¸œ­±¥¹”é±¥¹”±…‘µ¥¹}¹½Ñ•}ÕÁ‘…Ñ•‘}…Ðé¹½Ü±…‘µ¥¹}¹½Ñ•}ÕÁ‘…Ñ•‘}‰äé½Á•É…Ñ½È±ÕÁ‘…Ñ•‘}…Ðé¹½Ýô¤¹…Ñ   ¤ôùíô¤íõô(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Í•…Ñ}½Á•É…Ñ¥½¹}±½Ìœ±ì¥è•¹% =A0œ¤°Ñ•¹…¹Ñ}¥èQ99P°Í•ÍÍ¥½¹}¥èÉ•œ¹Í•ÍÍ¥½¹}¥°É•¥ÍÑÉ…Ñ¥½¹}¥èÉ•%°ÍÑ…±±}¥è¹Õ±°°…Ñ¥½¸èµ½‘”°½Á•É…Ñ½É}ÑåÁ”èÁŒ€ü€½¹Í¥Ñ•}Á…ÍÍ½‘”œ€è€…‘µ¥¸œ°½Á•É…Ñ½É}¥è½Á•É…Ñ½È°¹½Ñ”è¹½Ñ•Q•áÐñð¹Õ±°°É•…Ñ•‘}…Ðè¹½Üô¤¹…Ñ   ¤ôùíô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°µ½‘”°É•%‘ô¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡=¹Í¥Ñ•M¡¥™ÑMÑ…ÉÐ¡•¹Ø±ˆ¥í½¹ÍÐQ99Põˆ¹}Ñ•¹…¹Ñ%±½‘”õMÑÉ¥¹œ¡ˆ¹½‘•ññˆ¹Á…ÍÍ½‘•ñðœœ¤¹ÑÉ¥´ ¤±¹…µ”õMÑÉ¥¹œ¡ˆ¹½Á•É…Ñ½É9…µ•ñðœœ¤¹ÑÉ¥´ ¤í¥˜ …¹…µ”¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¢òã–—šN7’ös’êë–N‡–žO–B4œ¤í½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°½¹Í¥Ñ•}Á…ÍÍ½‘•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™½‘”õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½‘”¥ô™…Ñ¥Ù”õ•Ä¹ÑÉÕ”™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤í¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦k¢†3žŠóž‡šV#š"[–ÞË¦;šr|œ¤í½¹ÍÐÀõÉ½ÝÍlÁt±¹½Üõ¹½Ý%Í¼ ¤±¥õ•¹% M!%Pœ¤í…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Í•…Ñ}½Á•É…Ñ¥½¹}±½Ìœ±í¥±Ñ•¹…¹Ñ}¥éQ99P±Í•ÍÍ¥½¹}¥éÀ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±ÍÑ…±±}¥é¹Õ±°±…Ñ¥½¸èÍ¡¥™Ñ}ÍÑ…ÉÐœ±½Á•É…Ñ½É}ÑåÁ”è½¹Í¥Ñ•}Á…ÍÍ½‘”œ±½Á•É…Ñ½É}¥é¹…µ”±¹½Ñ”èŸ¦Z/–ž/–Þ—’öpœ±É•…Ñ•‘}…Ðé¹½Ýô¤í½¹ÍÐÍ•Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡À¹Í•ÍÍ¥½¹}¥¥ô™Í•±•Ðõ¥±¹…µ•€¤¹…Ñ   ¤ôùmt¤íÉ•ÑÕÉ¸©Í½¹=¬¡íÍ¡¥™Ñ%é¥±Í•ÍÍ¥½¹%éÀ¹Í•ÍÍ¥½¹}¥±Í•ÍÍ¥½¹9…µ”è¡Í•ÍlÁt˜™Í•ÍlÁt¹¹…µ”¥ñðœœ±½Á•É…Ñ½É9…µ”é¹…µ”±ÍÑ…ÉÑ•‘Ðé¹½Ýô¤íô)…Íå¹Œ™Õ¹Ñ¥½¸¡=¹Í¥Ñ•M¡¥™Ñ¹¡•¹Ø±ˆ¥í½¹ÍÐQ99Põˆ¹}Ñ•¹…¹Ñ%±Í¡¥™Ñ%õMÑÉ¥¹œ¡ˆ¹Í¡¥™Ñ%‘ñðœœ¤¹ÑÉ¥´ ¤±¹…µ”õMÑÉ¥¹œ¡ˆ¹½Á•É…Ñ½É9…µ•ñðœœ¤¹ÑÉ¥´ ¤í½¹ÍÐÍÑ…ÉÑÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•…Ñ}½Á•É…Ñ¥½¹}±½Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í¡¥™Ñ%¥ô™…Ñ¥½¸õ•Ä¹Í¡¥™Ñ}ÍÑ…ÉÐ™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤í¥˜ …ÍÑ…ÉÑÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã¦Z/–ž/–Þ—’ösžÒ¦2œ¤í½¹ÍÐÌõÍÑ…ÉÑÍlÁt±¹½Üõ¹½Ý%Í¼ ¤í…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Í•…Ñ}½Á•É…Ñ¥½¹}±½Ìœ±í¥é•¹% M!%Pœ¤±Ñ•¹…¹Ñ}¥éQ99P±Í•ÍÍ¥½¹}¥éÌ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±ÍÑ…±±}¥é¹Õ±°±…Ñ¥½¸èÍ¡¥™Ñ}•¹œ±½Á•É…Ñ½É}ÑåÁ”è½¹Í¥Ñ•}Á…ÍÍ½‘”œ±½Á•É…Ñ½É}¥é¹…µ•ññÌ¹½Á•É…Ñ½É}¥±¹½Ñ”èŸžÖCšv–Þ—’ös¾öqÍ¡¥™Ðèœ­Í¡¥™Ñ%±É•…Ñ•‘}…Ðé¹½Ýô¤íÉ•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±•¹‘•‘Ðé¹½Ýô¤íô)…Íå¹Œ™Õ¹Ñ¥½¸¡=¹Í¥Ñ•M¡¥™Ñ1¥ÍÐ¡•¹Ø±À¥í½¹ÍÐQ99PõÀ¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P°¡•­¥¸œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤í½¹ÍÐm±½Ì±Í•ÍÍ¥½¹Ítõ…Ý…¥ÐAÉ½µ¥Í”¹…±°¡m‘‰•Ð¡•¹Ø°Í•…Ñ}½Á•É…Ñ¥½¹}±½Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™…Ñ¥½¸õ¥¸¸¡Í¡¥™Ñ}ÍÑ…ÉÐ±Í¡¥™Ñ}•¹¤™Í•±•Ðô¨™½É‘•ÈõÉ•…Ñ•‘}…Ð¹‘•Í€¤¹…Ñ   ¤ôùmt¤±‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðõ¥±¹…µ•€¤¹…Ñ   ¤ôùmt¥t¤í½¹ÍÐÍ´õíôíÍ•ÍÍ¥½¹Ì¹™½É… ¡ÌôùÍµmÌ¹¥‘tõÌ¹¹…µ•ññÌ¹¥¤í½¹ÍÐ•¹‘Ìõ±½Ì¹™¥±Ñ•È¡àôùà¹…Ñ¥½¸ôôôÍ¡¥™Ñ}•¹œ¤íÉ•ÑÕÉ¸©Í½¹=¬¡±½Ì¹™¥±Ñ•È¡àôùà¹…Ñ¥½¸ôôôÍ¡¥™Ñ}ÍÑ…ÉÐœ¤¹µ…À¡Ìôùí½¹ÍÐ”õ•¹‘Ì¹™¥¹¡àôùMÑÉ¥¹œ¡à¹¹½Ñ•ñðœœ¤¹¥¹±Õ‘•Ì Í¡¥™Ðèœ­Ì¹¥¤¤±ÍÑ…ÉÐõ¹•Ü…Ñ”¡Ì¹É•…Ñ•‘}…Ð¤±•¹õ”ý¹•Ü…Ñ”¡”¹É•…Ñ•‘}…Ð¤é¹Õ±°±¡½ÕÉÌõ•¹ý5…Ñ ¹É½Õ¹  ¡•¹µÍÑ…ÉÐ¤¼ÌØÀÀÀÀÀ¤¨ÄÀÀ¤¼ÄÀÀé¹Õ±°íÉ•ÑÕÉ¹íÍ¡¥™Ñ%éÌ¹¥±Í•ÍÍ¥½¹%éÌ¹Í•ÍÍ¥½¹}¥±Í•ÍÍ¥½¹9…µ”éÍµmÌ¹Í•ÍÍ¥½¹}¥‘uññÌ¹Í•ÍÍ¥½¹}¥±½Á•É…Ñ½É9…µ”éÌ¹½Á•É…Ñ½É}¥±ÍÑ…ÉÑ•‘ÐéÌ¹É•…Ñ•‘}…Ð±•¹‘•‘Ðé”ý”¹É•…Ñ•‘}…ÐèŸ¦Ë¢†3’â´œ±¡½ÕÉÌé¡½ÕÉÌôõ¹Õ±°üŸŠPœé¡½ÕÉÌ±½Á•É…Ñ¥½¹½Õ¹ÐèÁõô¤¤íô((¼¼•ÑMÑ…™˜)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑMÑ…™˜¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€ÍÑ…™˜œ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É½ÝÌ¹µ…À¡Èôø¡ì(€€€•µ…¥°éÈ¹•µ…¥°°(€€€¹…µ”éÈ¹¹…µ”ñðÈ¹‘¥ÍÁ±…å}¹…µ”ñð€œœ°(€€€É½±”éÈ¹¹½Éµ…±¥é•‘}É½±”ñðÈ¹É½±”°(€€€É…ÝI½±”éÈ¹É½±”°(€€€¥ÍÑ¥Ù”èÈ¹¥Í}…Ñ¥Ù”€„ôôÕ¹‘•™¥¹•€üÈ¹¥Í}…Ñ¥Ù”€èÈ¹…Ñ¥Ù”°(€€€Á•ÉµÍ)Í½¸éÈ¹Á•ÉµÍ}©Í½¹ñðíôœ°(€€€±¥µ¥ÑM•ÍÍ¥½¹ÌéÈ¹±¥µ¥Ñ}Í•ÍÍ¥½¹Ì€üMÑÉ¥¹œ¡È¹±¥µ¥Ñ}Í•ÍÍ¥½¹Ì¤¹ÍÁ±¥Ð œ°œ¤¹™¥±Ñ•È¡	½½±•…¸¤€èmt°(€€€Í½Á•QåÁ”éÈ¹Í½Á•}ÑåÁ”ñð€…±°œ°(€€€Í½Á•Ù•¹Ñ%éÈ¹Í½Á•}•Ù•¹Ñ}¥ñð€œœ°(€€€µ•µ‰•É%éÈ¹Á±…Ñ™½Éµ}µ•µ‰•É}¥ñð€œœ°(€€€¥¹Ù¥Ñ…Ñ¥½¹MÑ…ÑÕÌéÈ¹Á±…Ñ™½Éµ}µ•µ‰•É}¥€ü€…•ÁÑ•œ€è€Á•¹‘¥¹œœ°(€€€©½¥¹•‘ÐéÈ¹É•…Ñ•‘}…Ð°(€€€±…ÍÑ1½¥¹ÐéÈ¹±…ÍÑ}±½¥¹}…Ðñð€œœ°(€ô¤¤¤ì)ô((¼¼•ÑÙ•¹ÑÍ‘µ¥¸)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑÙ•¹ÑÍ‘µ¥¸¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€•Ù•¹ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É½ÝÌ¹µ…À¡Èôø¡í¥éÈ¹¥±Ñ¥Ñ±”éÈ¹Ñ¥Ñ±”±‘•ÍŒéÈ¹‘•ÍÉ¥ÁÑ¥½¸±±½…Ñ¥½¸éÈ¹±½…Ñ¥½¸±½Ù•ÈéÈ¹½Ù•É}ÕÉ°±ÍÑ…ÑÕÌéÈ¹ÍÑ…ÑÕÌ±É•…Ñ•‘ÐéÈ¹É•…Ñ•‘}…Ð±Á…åµ•¹ÑAÉ½™¥±•%éÈ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥‘ñðœœ±Á…åµ•¹ÑAÉ½™¥±”é}Á…åµ•¹ÑM¹…ÁÍ¡½ÑAÕ‰±¥Œ¡Í…™•)Í½¸¡È¹Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½Ð±¹Õ±°¤¥ô¤¤¤ì)ô((¼¼•ÑM•ÍÍ¥½¹Í‘µ¥¸)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑM•ÍÍ¥½¹Í‘µ¥¸¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€±•ÐÅÌ€ôÑ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€ì(€¥˜€¡À¹•Ù•¹Ñ%¤ÅÌ€¬ô€™•Ù•¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡À¹•Ù•¹Ñ%¥õ€ì(€½¹ÍÐmÍ•ÍÍ¥½¹ÍI…Ü°…±±I•Ì°•Ù•¹ÑÍt€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°ÅÌ¤°(€€€‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€•Ù•¹ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€t¤ì(€½¹ÍÐ¥Ñ•µ5…À€ô…Ý…¥Ð}•ÑI•¥ÍÑÉ…Ñ¥½¹%Ñ•µÍ½ÉI•Ì¡•¹Ø°…±±I•Ì¤ì(€½¹ÍÐ•ÙÑ5…À€ôíôì•Ù•¹ÑÌ¹™½É… ¡”ôù•ÙÑ5…Ám”¹¥‘tõ”¤ì(€É•ÑÕÉ¸©Í½¹=¬¡Í•ÍÍ¥½¹ÍI…Ü¹µ…À¡Ì€ôø}‰Õ¥±‘‘µ¥¹M•ÍÍ¥½¹I½Ü (€€€Ì°(€€€…±±I•Ì¹™¥±Ñ•È¡ÈôùMÑÉ¥¹œ¡È¹Í•ÍÍ¥½¹}¥¤ôôõMÑÉ¥¹œ¡Ì¹¥¤¤°(€€€•ÙÑ5…ÁmÌ¹•Ù•¹Ñ}¥‘tñðíô°(€€€¥Ñ•µ5…À(€€¤¤¤ì)ô((¼¼•ÑA…åµ•¹ÑÌ)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑA…åµ•¹ÑÌ¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P°€™¥¹…¹”œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Á…åµ•¹ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É½ÝÌ¹µ…À¡Èôø¡í¥éÈ¹¥±É•%éÈ¹É•¥ÍÑÉ…Ñ¥½¹}¥±Í•ÍÍ¥½¹%éÈ¹Í•ÍÍ¥½¹}¥±•µ…¥°éÈ¹•µ…¥°±…µ½Õ¹ÐéÈ¹…µ½Õ¹Ð±µ•Ñ¡½éÈ¹µ•Ñ¡½±ÍÑ…ÑÕÌéÈ¹ÍÑ…ÑÕÌ±ÑÉ…‘•9¼éÈ¹ÑÉ…‘•}¹¼±Á…¥‘ÐéÈ¹Á…¥‘}…Ð±É•…Ñ•‘ÐéÈ¹É•…Ñ•‘}…Ð±Á…åµ•¹ÑAÉ½™¥±•%éÈ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥‘ñðœœ±Á…åµ•¹ÑAÉ½™¥±”é}Á…åµ•¹ÑM¹…ÁÍ¡½ÑAÕ‰±¥Œ¡Í…™•)Í½¸¡È¹Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½Ð±¹Õ±°¤¥ô¤¤¤ì)ô(()™Õ¹Ñ¥½¸}™¥¹…¹•%Ñ•µ-¥¹¡Ø¥ì(€½¹ÍÐÌõMÑÉ¥¹œ¡Ùñðœœ¤¹ÑÉ¥´ ¤ì(€É•ÑÕÉ¸lŸšR¿–èœ°•áÁ•¹Í”œ°½ÕÐœ°‘•‰¥Ðt¹¥¹±Õ‘•Ì¡Ì¹Ñ½1½Ý•É…Í” ¤¥ññÌôôôŸšR¿–èœüŸšR¿–èœèŸšRÛ–”œì)ô)™Õ¹Ñ¥½¸}™¥¹…¹•%Ñ•µA…ÉÑÌ¡¹…µ”¥ì(€½¹ÍÐÌõMÑÉ¥¹œ¡¹…µ•ñðœœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ¤õÌ¹¥¹‘•á=˜ Ÿ¾öpœ¤ì(€É•ÑÕÉ¸¤ðÀýí…Ñ•½ÉäéÍñðŸ–Û’îXœ±¹½Ñ”èœôéí…Ñ•½ÉäéÌ¹Í±¥” À±¤¤¹ÑÉ¥´ ¥ñðŸ–Û’îXœ±¹½Ñ”éÌ¹Í±¥”¡¤¬Ä¤¹ÑÉ¥´ ¥ôì)ô)™Õ¹Ñ¥½¸}™¥¹…¹•%Ñ•µMÑ½É•‘9…µ”¡…Ñ•½Éä±¹½Ñ”¥ì(€½¹ÍÐŒõMÑÉ¥¹œ¡…Ñ•½ÉåñðŸ–Û’îXœ¤¹ÑÉ¥´ ¥ñðŸ–Û’îXœì(€½¹ÍÐ¸õMÑÉ¥¹œ¡¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤ì(€É•ÑÕÉ¸¸ý€‘í÷¾öp‘í¹õ€éŒì)ô)™Õ¹Ñ¥½¸}™¥¹…¹•…Ñ”¡Ø¥ì(€½¹ÍÐõ¹•Ü…Ñ”¡ÙñðÀ¤ì(€É•ÑÕÉ¸9Õµ‰•È¹¥Í¥¹¥Ñ”¡¹•ÑQ¥µ” ¤¤ý¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°ÄÀ¤èœœì)ô)™Õ¹Ñ¥½¸}Í•ÍÍ¥½¹¥ÉÍÑ…Ñ”¡Ì¥ì(€½¹ÍÐÉ½ÝÌõ}Í•ÍÍ¥½¹…Ñ•I½ÝÌ¡Í…™•)Í½¸¡Ì˜™Ì¹‘…Ñ•Í}©Í½¸±mt¤¤ì(€½¹ÍÐ‘ÌõÉ½ÝÌ¹µ…À¡àôùMÑÉ¥¹œ¡à¹‘…Ñ•ñðœœ¤¹Í±¥” À°ÄÀ¤¤¹™¥±Ñ•È¡	½½±•…¸¤¹Í½ÉÐ ¤ì(€É•ÑÕÉ¸‘ÍlÁuñðœœì)ô)…Íå¹Œ™Õ¹Ñ¥½¸}•ÑM•ÍÍ¥½¹…Í¡‰½½¬¡•¹Ø±Q99P±Í%¥ì(€½¹ÍÐmÍ•ÍI½ÝÌ±Á…åµ•¹ÑÌ±É•™Õ¹‘±±½Ì±ÑÉ…¹Í™•É1•‘•È±µ…¹Õ…±%Ñ•µÌ±É•Ít€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€€€‘‰•Ð¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™ÍÑ…ÑÕÌõ•Ä¸•Ô•Ü•È•Ü•È•	•à•”á™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€€€‘‰•Ð¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™…±±½…Ñ¥½¹}ÑåÁ”õ•Ä¹É•™Õ¹™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€€€‘‰•Ð¡•¹Ø°™¥¹…¹•}±•‘•Èœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™•¹ÑÉå}ÑåÁ”õ¥¸¸¡ÑÉ…¹Í™•É}É•‘¥Ñ}¥¸±ÑÉ…¹Í™•É}É•‘¥Ñ}½ÕÐ¤™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€€€‘‰•Ð¡•¹Ø°™¥¹…¹•}¥Ñ•µÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™Í•±•Ðô¨™½É‘•ÈõÉ•…Ñ•‘}…Ð¹…Í€¤¹…Ñ   ¤ôùmt¤°(€€€‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™Í•±•Ðõ¥±•µ…¥°±¹…µ”±‰É…¹‘}¹…µ”±‘•Á½Í¥Ð±Á…åµ•¹Ñ}ÍÑ…ÑÕÌ±Á…¥‘}…µ½Õ¹Ð±É•™Õ¹‘}…µ½Õ¹Ð±É•™Õ¹‘•‘}…Ð±É•…Ñ•‘}…Ñ€¤¹…Ñ   ¤ôùmt¤°(€t¤ì(€½¹ÍÐÍ•ÍÍ¥½¸õÍ•ÍI½ÝÍlÁuññíôì(€½¹ÍÐÉ•5…ÀõíôìÉ•Ì¹™½É… ¡ÈôùÉ•5…ÁmMÑÉ¥¹œ¡È¹¥¥tõÈ¤ì(€½¹ÍÐÉ½ÝÌõmtì((€™½È¡½¹ÍÐÀ½˜Á…åµ•¹ÑÌ¥ì(€€€½¹ÍÐÈõÉ•5…ÁmMÑÉ¥¹œ¡À¹É•¥ÍÑÉ…Ñ¥½¹}¥¥uññíôì(€€€É½ÝÌ¹ÁÕÍ ¡ì(€€€€€¥éMÑÉ¥¹œ¡À¹¥¤±Í•ÍÍ¥½¹%éÍ%±‘…Ñ”é}™¥¹…¹•…Ñ”¡À¹Á…¥‘}…ÑññÀ¹É•…Ñ•‘}…Ð¤°(€€€€€­¥¹èŸšRÛ–”œ±…Ñ•½ÉäèŸ–‚Ç–B7šRÛš²øœ±…µ½Õ¹Ðé5…Ñ ¹µ…à À±Í…™•9Õ´¡À¹…µ½Õ¹Ð¤¤°(€€€€€¹½Ñ”émÈ¹‰É…¹‘}¹…µ•ññÈ¹¹…µ•ññÈ¹•µ…¥±ñðœœ±À¹µ•Ñ¡½‘ñðœœ±À¹ÑÉ…‘•}¹¼ü Ÿšr¯žŠó¾ò?’ê“šbO¢f|€œ­À¹ÑÉ…‘•}¹¼¤èœt¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ Ÿ¾öpœ¤°(€€€€€Í½ÕÉ”èŸžÎïžÖÇ¢«–.Tœ±•‘¥Ñ…‰±”é™…±Í”±É•™•É•¹•QåÁ”èÁ…åµ•¹Ðœ±É•™•É•¹•%éMÑÉ¥¹œ¡À¹¥¤(€€€ô¤ì(€ô(€™½È¡½¹ÍÐà½˜É•™Õ¹‘±±½Ì¥ì(€€€½¹ÍÐÈõÉ•5…ÁmMÑÉ¥¹œ¡à¹É•¥ÍÑÉ…Ñ¥½¹}¥¥uññíôì(€€€É½ÝÌ¹ÁÕÍ ¡ì(€€€€€¥éMÑÉ¥¹œ¡à¹¥¤±Í•ÍÍ¥½¹%éÍ%±‘…Ñ”é}™¥¹…¹•…Ñ”¡à¹É•…Ñ•‘}…Ð¤°(€€€€€­¥¹èŸšR¿–èœ±…Ñ•½ÉäèŸ¦š²øœ±…µ½Õ¹Ðé5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹…µ½Õ¹Ð¤¤°(€€€€€¹½Ñ”éÈ¹‰É…¹‘}¹…µ•ññÈ¹¹…µ•ññÈ¹•µ…¥±ñðœœ°(€€€€€Í½ÕÉ”èŸžÎïžÖÇ¢«–.Tœ±•‘¥Ñ…‰±”é™…±Í”±É•™•É•¹•QåÁ”èÉ•™Õ¹œ±É•™•É•¹•%éMÑÉ¥¹œ¡à¹Á…åµ•¹Ñ}¥‘ññà¹¥¤(€€€ô¤ì(€ô(€™½È¡½¹ÍÐà½˜ÑÉ…¹Í™•É1•‘•È¥ì(€€€½¹ÍÐ¥Í%¸õMÑÉ¥¹œ¡à¹•¹ÑÉå}ÑåÁ”¤ôôôÑÉ…¹Í™•É}É•‘¥Ñ}¥¸œì(€€€É½ÝÌ¹ÁÕÍ ¡ì(€€€€€¥éMÑÉ¥¹œ¡à¹¥¤±Í•ÍÍ¥½¹%éÍ%±‘…Ñ”é}™¥¹…¹•…Ñ”¡à¹É•…Ñ•‘}…Ð¤°(€€€€€­¥¹é¥Í%¸üŸšRÛ–”œèŸšR¿–èœ±…Ñ•½Éäé¥Í%¸üŸ–îÛšr¢ö'–”œèŸ–îÛšr¢ö'–èœ°(€€€€€…µ½Õ¹Ðé5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹…µ½Õ¹Ð¤¤±¹½Ñ”éà¹µ•µ½ñðœœ°(€€€€€Í½ÕÉ”èŸžÎïžÖÇ¢«–.Tœ±•‘¥Ñ…‰±”é™…±Í”±É•™•É•¹•QåÁ”èÑÉ…¹Í™•Èœ±É•™•É•¹•%éMÑÉ¥¹œ¡à¹Í•ÑÑ±•µ•¹Ñ}¥‘ññà¹¥¤(€€€ô¤ì(€ô(€™½È¡½¹ÍÐà½˜µ…¹Õ…±%Ñ•µÌ¥ì(€€€¥˜¡à¹¥Í}…ÕÑ¼ôôõÑÉÕ”¥½¹Ñ¥¹Õ”ì(€€€½¹ÍÐÁ…ÉÐõ}™¥¹…¹•%Ñ•µA…ÉÑÌ¡à¹¹…µ”¤ì(€€€É½ÝÌ¹ÁÕÍ ¡ì(€€€€€¥éMÑÉ¥¹œ¡à¹¥¤±Í•ÍÍ¥½¹%éÍ%±‘…Ñ”é}™¥¹…¹•…Ñ”¡à¹É•…Ñ•‘}…Ð¤°(€€€€€­¥¹é}™¥¹…¹•%Ñ•µ-¥¹¡à¹ÑåÁ”¤±…Ñ•½ÉäéÁ…ÉÐ¹…Ñ•½Éä±…µ½Õ¹Ðé5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹…µ½Õ¹Ð¤¤°(€€€€€¹½Ñ”éÁ…ÉÐ¹¹½Ñ”±Í½ÕÉ”èŸš&/–.WšZÃ–Šxœ±•‘¥Ñ…‰±”éÑÉÕ”±É•™•É•¹•QåÁ”èµ…¹Õ…°œ±É•™•É•¹•%éMÑÉ¥¹œ¡à¹¥¤(€€€ô¤ì(€ô(€É½ÝÌ¹Í½ÉÐ ¡à±ä¤ôùMÑÉ¥¹œ¡à¹‘…Ñ”¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ä¹‘…Ñ”¤¥ññMÑÉ¥¹œ¡à¹¥¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ä¹¥¤¤¤ì(€½¹ÍÐ¥¹½µ”õÉ½ÝÌ¹™¥±Ñ•È¡àôùà¹­¥¹ôôôŸšRÛ–”œ¤¹É•‘Õ” ¡¸±à¤ôù¸­Í…™•9Õ´¡à¹…µ½Õ¹Ð¤°À¤ì(€½¹ÍÐ•áÁ•¹Í”õÉ½ÝÌ¹™¥±Ñ•È¡àôùà¹­¥¹ôôôŸšR¿–èœ¤¹É•‘Õ” ¡¸±à¤ôù¸­Í…™•9Õ´¡à¹…µ½Õ¹Ð¤°À¤ì(€½¹ÍÐ‘•Á½Í¥ÑÌõÉ•Ì¹™¥±Ñ•È¡}¥Í½¹™¥Éµ•‘A…¥‘I•œ¤¹É•‘Õ” ¡¸±È¤ôù¸­5…Ñ ¹µ…à À±Í…™•9Õ´¡È¹‘•Á½Í¥Ð¤¤°À¤ì(€É•ÑÕÉ¸ì(€€€Í•ÍÍ¥½¸éí¥éÍ%±¹…µ”éÍ•ÍÍ¥½¸¹¹…µ•ñðœœ±•Ù•¹Ñ%éÍ•ÍÍ¥½¸¹•Ù•¹Ñ}¥‘ñðœœ±‘…Ñ”é}Í•ÍÍ¥½¹¥ÉÍÑ…Ñ”¡Í•ÍÍ¥½¸¤±Ù•¹Õ”éÍ•ÍÍ¥½¸¹Ù•¹Õ•ñðœô°(€€€Ñ½Ñ…±Ìéí¥¹½µ”±•áÁ•¹Í”±‰…±…¹”é¥¹½µ”µ•áÁ•¹Í”±‘•Á½Í¥Ðé‘•Á½Í¥ÑÍô°(€€€É½ÝÌ(€ôì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑM•ÍÍ¥½¹…Í¡‰½½¬¡•¹Ø±À¥ì(€½¹ÍÐQ99PõÀ˜™À¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ%õMÑÉ¥¹œ¡À¹Í•ÍÍ¥½¹%‘ññÀ¹Í•ÍÍ¥½¹}¥‘ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …Í%¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úlÍ•ÍÍ¥½¹%œ¤ì(€É•ÑÕÉ¸©Í½¹=¬¡…Ý…¥Ð}•ÑM•ÍÍ¥½¹…Í¡‰½½¬¡•¹Ø±Q99P±Í%¤¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•M•ÍÍ¥½¹…Í¡%Ñ•´¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ˜™ˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ%õMÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%‘ññˆ¹Í•ÍÍ¥½¹}¥‘ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …Í%¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¦ãšN–‚Óš²„œ¤ì(€½¹ÍÐ­¥¹õ}™¥¹…¹•%Ñ•µ-¥¹¡ˆ¹­¥¹‘ññˆ¹ÑåÁ”¤ì(€½¹ÍÐ…µ½Õ¹Ðõ5…Ñ ¹µ…à À±Í…™•9Õ´¡ˆ¹…µ½Õ¹Ð¤¤ì(€¥˜¡…µ½Õ¹ÐðôÀ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦G¦†7–þ¦‚#–’ŸšZð€Àœ¤ì(€½¹ÍÐ…Ñ•½ÉäõMÑÉ¥¹œ¡ˆ¹…Ñ•½ÉåñðŸ–Û’îXœ¤¹ÑÉ¥´ ¥ñðŸ–Û’îXœì(€½¹ÍÐ¹½Ñ”õMÑÉ¥¹œ¡ˆ¹¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤¹Í±¥” À°ÌÀÀ¤ì(€½¹ÍÐ‘…Ñ”õMÑÉ¥¹œ¡ˆ¹‘…Ñ•ñðœœ¤¹Í±¥” À°ÄÀ¤ì(€½¹ÍÐÉ•…Ñ•‘Ðô½yq‘ìÑôµq‘ìÉôµq‘ìÉô¼¹Ñ•ÍÐ¡‘…Ñ”¤ý€‘í‘…Ñ•õPÄÈèÀÀèÀÀ¸ÀÀÁi€é¹½Ý%Í¼ ¤ì((€¥˜¡ˆ¹¥¥ì(€€€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°™¥¹…¹•}¥Ñ•µÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥ô™Í•±•Ðô©€¤ì(€€€¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã¦gž¶–âÌœ¤ì(€€€¥˜¡É½ÝÍlÁt¹¥Í}…ÕÑ¼ôôõÑÉÕ”¥É•ÑÕÉ¸©Í½¹ÉÈ ŸžÎïžÖÇ¢«–.W–âÏ’â7–>¿žnÓš:—’þ»šRäœ¤ì(€€€¥˜¡MÑÉ¥¹œ¡É½ÝÍlÁt¹Í•ÍÍ¥½¹}¥¤„ôõÍ%¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦gž¶–âÏ’â7–Æ³šZóžn»–&7–‚Óš²„œ¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°™¥¹…¹•}¥Ñ•µÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥õ€±ì(€€€€€ÑåÁ”é­¥¹±¹…µ”é}™¥¹…¹•%Ñ•µMÑ½É•‘9…µ”¡…Ñ•½Éä±¹½Ñ”¤±…µ½Õ¹Ð±É•…Ñ•‘}…ÐéÉ•…Ñ•‘Ð(€€€ô¤ì(€€€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P±ˆ¹•µ…¥±ñðœœ°™¥¹…¹•}…‘µ¥¸œ°µ…¹Õ…±}…Í¡}¥Ñ•µ}ÕÁ‘…Ñ•œ°™¥¹…¹•}¥Ñ•µÌœ±MÑÉ¥¹œ¡ˆ¹¥¤±É½ÝÍlÁt±íÍ•ÍÍ¥½¹}¥éÍ%±ÑåÁ”é­¥¹±…Ñ•½Éä±…µ½Õ¹Ð±‘…Ñ•ô±í¹½Ñ•ô¤¹…Ñ   ¤ôùíô¤ì(€€€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥éMÑÉ¥¹œ¡ˆ¹¥¤±¥Ñ•´éí¥éMÑÉ¥¹œ¡ˆ¹¥¤±Í•ÍÍ¥½¹%éÍ%±­¥¹±…Ñ•½Éä±…µ½Õ¹Ð±¹½Ñ”±‘…Ñ”±Í½ÕÉ”èŸ’âï¢ú›š&/–.Wžfï¦2õô¤ì(€ô((€½¹ÍÐ¥õ•¹% %8œ¤ì(€½¹ÍÐÉ½Üõí¥±Ñ•¹…¹Ñ}¥éQ99P±Í•ÍÍ¥½¹}¥éÍ%±ÑåÁ”é­¥¹±¹…µ”é}™¥¹…¹•%Ñ•µMÑ½É•‘9…µ”¡…Ñ•½Éä±¹½Ñ”¤±…µ½Õ¹Ð±¥Í}…ÕÑ¼é™…±Í”±É•…Ñ•‘}…ÐéÉ•…Ñ•‘Ñôì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°™¥¹…¹•}¥Ñ•µÌœ±É½Ü¤ì(€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P±ˆ¹•µ…¥±ñðœœ°™¥¹…¹•}…‘µ¥¸œ°µ…¹Õ…±}…Í¡}¥Ñ•µ}É•…Ñ•œ°™¥¹…¹•}¥Ñ•µÌœ±¥±¹Õ±°±íÍ•ÍÍ¥½¹}¥éÍ%±ÑåÁ”é­¥¹±…Ñ•½Éä±…µ½Õ¹Ð±‘…Ñ•ô±í¹½Ñ•ô¤¹…Ñ   ¤ôùíô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥±¥Ñ•´éí¥±Í•ÍÍ¥½¹%éÍ%±­¥¹±…Ñ•½Éä±…µ½Õ¹Ð±¹½Ñ”±‘…Ñ”±Í½ÕÉ”èŸ’âï¢ú›š&/–.Wžfï¦2õô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•±•Ñ•M•ÍÍ¥½¹…Í¡%Ñ•´¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ˜™ˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ¥õMÑÉ¥¹œ¡ˆ¹¥‘ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …¥¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úo–âÏžn¸%œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°™¥¹…¹•}¥Ñ•µÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥ô™Í•±•Ðô©€¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã¦gž¶–âÌœ¤ì(€¥˜¡É½ÝÍlÁt¹¥Í}…ÕÑ¼ôôõÑÉÕ”¥É•ÑÕÉ¸©Í½¹ÉÈ ŸžÎïžÖÇ¢«–.W–âÏ’â7–>¿–"«¦fœ¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°™¥¹…¹•}¥Ñ•µÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤ì(€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P±ˆ¹•µ…¥±ñðœœ°™¥¹…¹•}…‘µ¥¸œ°µ…¹Õ…±}…Í¡}¥Ñ•µ}‘•±•Ñ•œ°™¥¹…¹•}¥Ñ•µÌœ±¥±É½ÝÍlÁt±¹Õ±°±íô¤¹…Ñ   ¤ôùíô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô((¼¼•Ñ¥¹…¹”)…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñ¥¹…¹”¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ%€ôÀ¹Í•ÍÍ¥½¹%‘ññÀ¹Í•ÍÍ¥½¹}¥ì(€¥˜€ …Í%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úlÍ•ÍÍ¥½¹%œ¤ì(€½¹ÍÐmÍ•ÍI½ÝÌ°É•Ì°µ…¹Õ…±%Ñ•µÍt€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€™¥¹…¹•}¥Ñ•µÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™Í•±•Ðô¨™½É‘•ÈõÉ•…Ñ•‘}…Ð¹…Í€¤¹…Ñ   ¤ôùmt¤°(€t¤ì(€½¹ÍÐÍ•Ì€ôÍ•ÍI½ÝÍlÁtñðíôì(€½¹ÍÐ¥Ñ•µ5…À€ô…Ý…¥Ð}•ÑI•¥ÍÑÉ…Ñ¥½¹%Ñ•µÍ½ÉI•Ì¡•¹Ø°É•Ì¤ì(€½¹ÍÐ½ÕÐ€ômtì(€™½È€¡½¹ÍÐÈ½˜É•Ì¹™¥±Ñ•È¡}¥ÍI••¥Ù…‰±•I•œ¤¤ì(€€€½¹ÍÐµ½¹•ä€ô}É•¥¹…¹•µ½Õ¹ÑÌ¡È°Í•Ì°¥Ñ•µ5…ÁmÈ¹¥‘t¤ì(€€€½¹ÍÐ‰É…¹€ôÈ¹‰É…¹‘}¹…µ”ñðÈ¹¹…µ”ñðÈ¹•µ…¥°ñðÈ¹¥ì(€€€¥˜€¡µ½¹•ä¹¥Ñ•µI½ÝÌ€˜˜µ½¹•ä¹¥Ñ•µI½ÝÌ¹±•¹Ñ ¤ì(€€€€€™½È€¡½¹ÍÐ¥Ð½˜µ½¹•ä¹¥Ñ•µI½ÝÌ¤ì(€€€€€€€½ÕÐ¹ÁÕÍ ¡í¥éÈ¹¥°Í•ÍÍ¥½¹%éÍ%°ÑåÁ”é¥Ð¹­¥¹ñð€Ÿ¦‚žn¸œ°¹…µ”é€‘í‰É…¹‘÷¾öp‘í¥Ð¹¹…µ•õ€°…µ½Õ¹Ðé¥Ð¹…µ½Õ¹Ð°¹½Ñ”é€‘í}É•Ù¥•ÝMÑ…ÑÕÌ¡È¥÷¾ò<‘í}Á…åMÑ…ÑÕÌ¡È¥÷¾öp‘í¥Ð¹¹½Ñ”ñðµ½¹•ä¹Í½ÕÉ•õ€°Á…åµ•¹ÑAÉ½™¥±•9…µ”é}Á…åµ•¹ÑM¹…ÁÍ¡½ÑAÕ‰±¥Œ¡}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µI•œ¡È¤¤¹Á…åµ•¹ÑAÉ½™¥±•9…µ•ñðŸšr«’þw–¶c–þ¯žœô¤ì(€€€€€ô(€€€ô•±Í”ì(€€€€€½ÕÐ¹ÁÕÍ ¡í¥éÈ¹¥°Í•ÍÍ¥½¹%éÍ%°ÑåÁ”èŸš'šRÛš²øœ°¹…µ”é‰É…¹°…µ½Õ¹Ðéµ½¹•ä¹…Í¡Q½Ñ…°°¹½Ñ”é€‘í}É•Ù¥•ÝMÑ…ÑÕÌ¡È¥÷¾ò<‘í}Á…åMÑ…ÑÕÌ¡È¥÷¾ös’úšêC¾òh‘íµ½¹•ä¹Í½ÕÉ•õ€°Á…åµ•¹ÑAÉ½™¥±•9…µ”é}Á…åµ•¹ÑM¹…ÁÍ¡½ÑAÕ‰±¥Œ¡}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µI•œ¡È¤¤¹Á…åµ•¹ÑAÉ½™¥±•9…µ•ñðŸšr«’þw–¶c–þ¯žœô¤ì(€€€€€¥˜€¡µ½¹•ä¹‘•Á½Í¥ÑQ½Ñ…°€ø€À¤½ÕÐ¹ÁÕÍ ¡í¥éÈ¹¥¬œµ‘•Á½Í¥Ðœ°Í•ÍÍ¥½¹%éÍ%°ÑåÁ”èŸš*ó¦Dœ°¹…µ”é‰É…¹°…µ½Õ¹Ðéµ½¹•ä¹‘•Á½Í¥ÑQ½Ñ…°°¹½Ñ”èŸš*ó¦Gž6£ž®/–"_¾ò3’â7–"_–—žfóž– ô¤ì(€€€ô(€ô(€™½È¡½¹ÍÐà½˜µ…¹Õ…±%Ñ•µÌ¹™¥±Ñ•È¡àôùà¹¥Í}…ÕÑ¼„ôõÑÉÕ”¤¥ì(€€€½¹ÍÐÁ…ÉÐõ}™¥¹…¹•%Ñ•µA…ÉÑÌ¡à¹¹…µ”¤ì(€€€½ÕÐ¹ÁÕÍ ¡í¥éà¹¥±Í•ÍÍ¥½¹%éÍ%±ÑåÁ”é}™¥¹…¹•%Ñ•µ-¥¹¡à¹ÑåÁ”¤±¹…µ”éÁ…ÉÐ¹…Ñ•½Éä±…µ½Õ¹ÐéÍ…™•9Õ´¡à¹…µ½Õ¹Ð¤±¹½Ñ”éÁ…ÉÐ¹¹½Ñ•ñðŸš&/–.WšZÃ–Šxœ±Í½ÕÉ”èŸš&/–.WšZÃ–Šxœ±‘…Ñ”é}™¥¹…¹•…Ñ”¡à¹É•…Ñ•‘}…Ð¤±•‘¥Ñ…‰±”éÑÉÕ•ô¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡½ÕÐ¤ì)ô((¼¼•Ñ%¹Ù½¥•1¥ÍÐ)…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñ%¹Ù½¥•1¥ÍÐ¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P°€™¥¹…¹”œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ%€ôÀ¹Í•ÍÍ¥½¹%‘ññÀ¹Í•ÍÍ¥½¹}¥ì(€¥˜€ …Í%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úlÍ•ÍÍ¥½¹%œ¤ì(€½¹ÍÐmÍ•ÍI½ÝÌ°É•Ít€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥ô™Í•±•Ðô©€¤°(€t¤ì(€½¹ÍÐÍ•Ì€ôÍ•ÍI½ÝÍlÁtñðíôì(€½¹ÍÐ¥Ñ•µ5…À€ô…Ý…¥Ð}•ÑI•¥ÍÑÉ…Ñ¥½¹%Ñ•µÍ½ÉI•Ì¡•¹Ø°É•Ì¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É•Ì¹™¥±Ñ•È¡}¥ÍI••¥Ù…‰±•I•œ¤¹µ…À¡Èôùì(€€€½¹ÍÐµ½¹•ä€ô}É•¥¹…¹•µ½Õ¹ÑÌ¡È°Í•Ì°¥Ñ•µ5…ÁmÈ¹¥‘t¤ì(€€€½¹ÍÐ¥¹Ù½¥•µ½Õ¹Ð€ô5…Ñ ¹µ…à À°µ½¹•ä¹…Í¡Q½Ñ…°€´µ½¹•ä¹‘•Á½Í¥ÑQ½Ñ…°¤ì(€€€½¹ÍÐÕ¹Ñ…á•€ô5…Ñ ¹É½Õ¹¡¥¹Ù½¥•µ½Õ¹Ð€¼€Ä¸ÀÔ¤ì(€€€½¹ÍÐÑ…à€ô¥¹Ù½¥•µ½Õ¹Ð€´Õ¹Ñ…á•ì(€€€É•ÑÕÉ¸ì(€€€€€¥éÈ¹¥°•µ…¥°éÈ¹•µ…¥°°¹…µ”éÈ¹¹…µ”°‰É…¹éÈ¹‰É…¹‘}¹…µ”°Á¡½¹”éÈ¹Á¡½¹”°(€€€€€¥¹Ù½¥•QåÁ”éÈ¹Ñ…á}¥€ü€Ÿ–³–>ã¾ò?š¦¦^pœ€è€Ÿ–/’êèœ°(€€€€€Ñ…á%éÈ¹Ñ…á}¥‘ñðœœ°¥¹Ù½¥•Q¥Ñ±”éÈ¹¥¹Ù½¥•}Ñ¥Ñ±•ññÈ¹‰É…¹‘}¹…µ•ñðœœ°(€€€€€¥¹Ù½¥•µ…¥°éÈ¹¥¹Ù½¥•}•µ…¥±ññÈ¹•µ…¥°°(€€€€€‘•Á½Í¥Ðéµ½¹•ä¹‘•Á½Í¥ÑQ½Ñ…°°…µ½Õ¹Ðé¥¹Ù½¥•µ½Õ¹Ð°(€€€€€Õ¹Ñ…á•‘µ½Õ¹ÐéÕ¹Ñ…á•°Ñ…áµ½Õ¹ÐéÑ…à°(€€€€€¥¹Ù½¥•MÑ…ÑÕÌéÈ¹¥¹Ù½¥•}ÍÑ…ÑÕÍñðŸ–ú¦Z/ž®,œ°(€€€€€¹½Ñ”éÈ¹…‘µ¥¹}¹½Ñ•ñðœœ°(€€€ôì(€ô¤¤ì)ô((¼¼•ÑM¥Ñ•½¹™¥œ)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑM¥Ñ•½¹™¥œ¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Ñ•¹…¹ÑÌœ°¥õ•Ä¸‘íQ99Qô™Í•±•Ðõ½¹™¥}©Í½¸±±¥¹•}ÕÉ°±‰…¹­}¥¹™½€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹=¬¡í¡•É½%µœèœœ±¥¹™½Q•áÐèœô¤ì(€½¹ÍÐ™œ€ôÍ…™•)Í½¸¡É½ÝÍlÁt¹½¹™¥}©Í½¸°íô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡ì(€€€¡•É½%µœé™œ¹¡•É½%µñðœœ°±½½UÉ°é™œ¹±½½UÉ±ñðœœ°¥¹™½Q•áÐé™œ¹¥¹™½Q•áÑñðœœ°(€€€±¥¹•UÉ°éÉ½ÝÍlÁt¹±¥¹•}ÕÉ±ñðœœ°(€€€‰…¹­%¹™¼éÉ½ÝÍlÁt¹‰…¹­}¥¹™½ñðœœ°(€€€¤Äá¸è¡™œ¹¤Äá¸˜™ÑåÁ•½˜™œ¹¤Äá¸ôôô½‰©•Ðœ¤ý™œ¹¤Äá¸éí•¹…‰±•é™…±Í”±‘•™…Õ±Ñ1…¹Õ…”èé µQ\œ±±…¹Õ…•Ìélé µQ\uô°(€ô¤ì)ô((¼¼•Ñ½É•I•™Õ¹‘1¥ÍÐ)…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñ½É•I•™Õ¹‘1¥ÍÐ¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P°€™¥¹…¹”œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€€¼¼ƒš¶–ò?¢ÎšZg–ê¯žn»–&7’î”ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ÷žRÏ¢®/¦¢Êìƒ’ösž
ë’â7–>¿š*_–*o¾ò?’â¢"³¦¢Êï–ú¢fWžBž.š/Ž(€€¼¼ƒ’â7š~—’â7–¶c–r£žjÉ•¥ÍÑÉ…Ñ¥½¹Ì¹™½É•}ÍÑ…ÑÕÏ¾ò3¦ÿ–7–&7–>À¿–ú3–>Ã–nƒš²’ö7’â7–B3š¶—’â·šZßŽ(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™ÑÉ…¹Í™•É}ÍÑ…ÑÕÌõ•Ä¸•Ü”äÐ•Ì•à•”á•ä”àÀ”àÀ•à•È•	™Í•±•Ðô©€¤ì(€€¼¼ƒ–>[–ú_–‚Óš²‡–B7ž¢Ä(€½¹ÍÐÍ•Í%‘Ì€ôl¸¸¹¹•ÜM•Ð¡É½ÝÌ¹µ…À¡ÈôùÈ¹Í•ÍÍ¥½¹}¥¤¹™¥±Ñ•È¡	½½±•…¸¤¥tì(€½¹ÍÐÍ•Í9…µ•Ì€ôíôì(€¥˜€¡Í•Í%‘Ì¹±•¹Ñ ¤ì(€€€½¹ÍÐÍ•ÍI½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ¥¸¸ ‘íÍ•Í%‘Ì¹µ…À¡¥ôù•¹½‘•UI%½µÁ½¹•¹Ð¡¥¤¤¹©½¥¸ œ°œ¥ô¤™Í•±•Ðõ¥±¹…µ•€¤ì(€€€Í•ÍI½ÝÌ¹™½É… ¡ÌôùÍ•Í9…µ•ÍmÌ¹¥‘tõÌ¹¹…µ•ññÌ¹¥¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡É½ÝÌ¹µ…À¡Èôùì(€€€½¹ÍÐ™½É•L€ôMÑÉ¥¹œ¡È¹™½É•}ÍÑ…ÑÕÍñðœœ¤ì(€€€±•Ð…ÁÁ±åM½ÕÉ”€ô€Ÿ’â¢"³žRÏ¢®/¦¢Êìœì(€€€¥˜€¡™½É•L€ôôô€…ÕÑ½}É•™Õ¹‘}É•ÅÕ•ÍÑ•œ¤…ÁÁ±åM½ÕÉ”€ô€Ÿ¦ûšr¢«–.WžRÏ¢®/¦¢Êìœì(€€€•±Í”¥˜€¡™½É•L€ôôô€É•™Õ¹‘}½¹±å}…ÕÑ¼œ¤…ÁÁ±åM½ÕÉ”€ô€Ÿž‡–îÛšr–‚Óš²‡¢«–.W¦Ë–—¦¢Êìœì(€€€•±Í”¥˜€¡™½É•L€ôôô€É•™Õ¹‘}É•ÅÕ•ÍÑ•œ¤…ÁÁ±åM½ÕÉ”€ô€Ÿ’âï–.WžRÏ¢®/¦¢Êï¾ò#’â7–>¿š*_–*o¾ò$œì(€€€É•ÑÕÉ¸ì(€€€€€¥éÈ¹¥°Í•ÍÍ¥½¹%éÈ¹Í•ÍÍ¥½¹}¥°Í•ÍÍ¥½¹9…µ”éÍ•Í9…µ•ÍmÈ¹Í•ÍÍ¥½¹}¥‘uññÈ¹Í•ÍÍ¥½¹}¥°(€€€€€•µ…¥°éÈ¹•µ…¥°°¹…µ”éÈ¹¹…µ”°‰É…¹éÈ¹‰É…¹‘}¹…µ”°Á¡½¹”éÈ¹Á¡½¹•ñðœœ°(€€€€€…µ½Õ¹ÐéÍ…™•9Õ´¡È¹…µ½Õ¹Ð¤°‘•Á½Í¥ÐéÍ…™•9Õ´¡È¹‘•Á½Í¥Ð¤°(€€€€€Á…åMÑ…ÑÕÌéÈ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ°(€€€€€ÑÉ…¹Í™•É¡½Í•¹ÐéÈ¹ÑÉ…¹Í™•É}¡½Í•¹}…Ññðœœ°‘•Á½Í¥ÑI•™Õ¹‘•éÈ¹‘•Á½Í¥Ñ}É•™Õ¹‘•‘ñðŸšr«¦š*ó¦Dœ°(€€€€€É•™Õ¹‘µ½Õ¹ÐéÍ…™•9Õ´¡È¹É•™Õ¹‘}…µ½Õ¹Ð¤°É•™Õ¹‘‘µ¥¹•”éÍ…™•9Õ´¡È¹É•™Õ¹‘}…‘µ¥¹}™•”¤°(€€€€€É•™Õ¹‘QÉ…¹Í™•É•”éÍ…™•9Õ´¡È¹É•™Õ¹‘}ÑÉ…¹Í™•É}™•”¤°É•™Õ¹‘IÕ±•1…‰•°éÈ¹É•™Õ¹‘}ÉÕ±•}±…‰•±ñðœœ°(€€€€€É•™Õ¹‘•‘ÐéÈ¹É•™Õ¹‘•‘}…Ññðœœ°É•™Õ¹‘9½Ñ”éÈ¹É•™Õ¹‘}¹½Ñ•ñðœœ°(€€€€€€¼¼ƒ’â7–>¿š*_–*oš²’ö4(€€€€€™½É•MÑ…ÑÕÌé™½É•Mñðœœ°(€€€€€…ÁÁ±åM½ÕÉ”°(€€€€€™½É•I•™Õ¹‘I•ÅÕ•ÍÑ•‘ÐéÈ¹™½É•}É•™Õ¹‘}É•ÅÕ•ÍÑ•‘}…ÑññÈ¹ÑÉ…¹Í™•É}¡½Í•¹}…Ññðœœ°(€€€€€™½É•I•™Õ¹‘•‘ÐéÈ¹™½É•}É•™Õ¹‘•‘}…Ññðœœ°(€€€€€™½É•I•™Õ¹‘9½Ñ”éÈ¹™½É•}É•™Õ¹‘}¹½Ñ•ñðœœ°(€€€ôì(€ô¤¤ì)ô((¼¼ƒŠRŠR MQ%=8€ÄÈèA=MP!…¹‘±•ÉÌƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR ((¼¼É•¥ÍÑ•È(¼¼ƒŠRŠR ƒ–‚Óš²‡žÖ–B#––_žÖ¾ò#¢«žRÇžÖ–B#Ž–B3¦Ë¦¾òoš*ó¦D¿žfóž– ¿–B#žÒž¶'–Û’î[¢š?–&–B3–Z»–‚Ó¾ò$ƒŠRŠR )…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñ	Õ¹‘±•Ì¡•¹Ø°À¤ì(€½¹ÍÐP€ôÀ¹}Ñ•¹…¹Ñ%ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹}‰Õ¹‘±•Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðô©€¤¹…Ñ   ¤€ôømt¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É½ÝÌ¹µ…À¡È€ôø€¡ì¥èÈ¹¥°¹…µ”èÈ¹¹…µ”°Í•ÍÍ¥½¹%‘ÌèMÑÉ¥¹œ¡È¹Í•ÍÍ¥½¹}¥‘Ìñð€œœ¤¹ÍÁ±¥Ð œ°œ¤¹™¥±Ñ•È¡	½½±•…¸¤°‰Õ¹‘±•AÉ¥”èÈ¹‰Õ¹‘±•}ÁÉ¥”°…Ñ¥Ù”èÈ¹…Ñ¥Ù”ô¤¤¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•	Õ¹‘±”¡•¹Ø°ˆ¤ì(€½¹ÍÐP€ôˆ¹}Ñ•¹…¹Ñ%ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°ˆ¹•µ…¥°°ˆ¹Ñ½­•¸°P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ¹…µ”€ôMÑÉ¥¹œ¡ˆ¹¹…µ”ñð€œœ¤¹ÑÉ¥´ ¤ì¥˜€ …¹…µ”¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–†¯––_žÖ–B7ž¢Äœ¤ì(€½¹ÍÐÍ¥‘Ì€ô€¡ÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹Í•ÍÍ¥½¹%‘Ì¤€üˆ¹Í•ÍÍ¥½¹%‘Ì€èMÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%‘Ìñð€œœ¤¹ÍÁ±¥Ð œ°œ¤¤¹µ…À¡à€ôøMÑÉ¥¹œ¡à¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€¥˜€¡Í¥‘Ì¹±•¹Ñ €„ôô€È¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–§–‚ÓžÖ–B#–ç–þ¦‚#–&o––÷žÚ–ºh€Èƒ–/–‚Óš²„œ¤ì(€½¹ÍÐÁÉ¥”€ô9Õµ‰•È¡ˆ¹‰Õ¹‘±•AÉ¥”¤ñð€Àì(€¥˜€ „¡ÁÉ¥”øÀ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–§–‚ÓžÖ–B#–ç–þ¦‚#–’ŸšZð€Àœ¤ì(€¥˜€¡ˆ¹¥¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€Í•ÍÍ¥½¹}‰Õ¹‘±•Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥õ€°ì¹…µ”°Í•ÍÍ¥½¹}¥‘ÌèÍ¥‘Ì¹©½¥¸ œ°œ¤°‰Õ¹‘±•}ÁÉ¥”èÁÉ¥”°…Ñ¥Ù”è€¡ˆ¹…Ñ¥Ù”€„ôô™…±Í”¤°ÕÁ‘…Ñ•‘}…Ðè¹½Ý%Í¼ ¤ô¤ì(€€€É•ÑÕÉ¸©Í½¹=¬¡ì¥èˆ¹¥ô¤ì(€ô(€½¹ÍÐ¥€ô•¹% 	9œ¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€Í•ÍÍ¥½¹}‰Õ¹‘±•Ìœ°ì¥°Ñ•¹…¹Ñ}¥èP°¹…µ”°Í•ÍÍ¥½¹}¥‘ÌèÍ¥‘Ì¹©½¥¸ œ°œ¤°‰Õ¹‘±•}ÁÉ¥”èÁÉ¥”°…Ñ¥Ù”èÑÉÕ”°É•…Ñ•‘}…Ðè¹½Ý%Í¼ ¤°ÕÁ‘…Ñ•‘}…Ðè¹½Ý%Í¼ ¤ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡ì¥ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•±•Ñ•	Õ¹‘±”¡•¹Ø°ˆ¤ì(€½¹ÍÐP€ôˆ¹}Ñ•¹…¹Ñ%ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åA±…Ñ™½ÉµMÕÁ•É‘µ¥¸¡•¹Ø°ˆ¹•µ…¥°°ˆ¹Ñ½­•¸°P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–"«¦f“––_žÖ–¦fC–æÏ–>Ã¢ÚžÒkžº‡žB–N„œ¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°€Í•ÍÍ¥½¹}‰Õ¹‘±•Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥õ€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡ìÍÕ•ÍÌèÑÉÕ”ô¤ì)ô()™Õ¹Ñ¥½¸‰Õ¹‘±•M•ÍÍ¥½¹½µÁ…Ñ¥‰±”¡Ì¥ì(€¥˜ …Ì¥É•ÑÕÉ¸™…±Í”ì(€¥˜ …lŸ–‚Ç–B7’â´œ°Ÿ¦Z/šRøt¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡Ì¹ÍÑ…ÑÕÍñðœœ¤¤¥É•ÑÕÉ¸™…±Í”ì(€½¹ÍÐµ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ì¹µ½‘Õ±•Í}©Í½¸±íô¤¤ì(€€¼¼ƒ–§–‚ÓžÖ–B#–ÇžR£–B3’â–ò×–‚Ç–B7¢†£¾òo¦r¢š¦C–‚Ó¦7šZÃ¦ãšNžj¢’¦nsš¢‡žÖ’â7–>¿¢«–.W––_žR£Ž(€¥˜¡µ½‘Ì¹Ý½É­Í¡½ÁM±½ÑÍññµ½‘Ì¹Í•ÉÙ¥•ññµ½‘Ì¹É•Í½ÕÉ•ññµ½‘Ì¹Á…ÉÑ¥¥Á…¹ÑÌ¥É•ÑÕÉ¸™…±Í”ì(€½¹ÍÐ‘…Ñ•Ìõ}Í•ÍÍ¥½¹…Ñ•I½ÝÌ¡Ì¹‘…Ñ•Í}©Í½¸¤ì(€€¼¼ƒžn»–&7Ž3–§–‚ÓžÖ–B#Ž7–ºkžú§¾òkš¾?–/–‚Óš²‡šr³¢ê¯šb¿’â–/šb;žŠë–‚Óš²‡¾ò3’â7žR£–r£ž²³’ê3–‚Ó–7ž2sš^—šrŽ(€É•ÑÕÉ¸‘…Ñ•Ì¹±•¹Ñ ôôôÄì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñ	Õ¹‘±•ÍAÕ‰±¥Œ¡•¹Ø±À¥ì(€½¹ÍÐPõÀ¹}Ñ•¹…¹Ñ%ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹}‰Õ¹‘±•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™…Ñ¥Ù”õ•Ä¹ÑÉÕ”™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐÍ•ÍÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐÍ5…ÀõíôíÍ•ÍÌ¹™½É… ¡ÌôùÍ5…ÁmÌ¹¥‘tõÌ¤ì(€½¹ÍÐ½ÕÐõmtì(€™½È¡½¹ÍÐÈ½˜É½ÝÌ¥ì(€€€½¹ÍÐÍ¥‘ÌõMÑÉ¥¹œ¡È¹Í•ÍÍ¥½¹}¥‘Íñðœœ¤¹ÍÁ±¥Ð œ°œ¤¹µ…À¡àôùà¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€¥˜¡Í¥‘Ì¹±•¹Ñ „ôôÉñð…Í¥‘Ì¹•Ù•Éä¡¥ôù‰Õ¹‘±•M•ÍÍ¥½¹½µÁ…Ñ¥‰±”¡Í5…Ám¥‘t¤¤¥½¹Ñ¥¹Õ”ì(€€€ÑÉåì(€€€€€½¹ÍÐÀÄõ…Ý…¥Ð}É•Í½±Ù•A…åµ•¹ÑAÉ½™¥±•½ÉM•ÍÍ¥½¸¡•¹Ø±P±Í5…ÁmÍ¥‘ÍlÁut¤ì(€€€€€½¹ÍÐÀÈõ…Ý…¥Ð}É•Í½±Ù•A…åµ•¹ÑAÉ½™¥±•½ÉM•ÍÍ¥½¸¡•¹Ø±P±Í5…ÁmÍ¥‘ÍlÅut¤ì(€€€€€¥˜¡MÑÉ¥¹œ¡ÀÄü¹¥‘ñðœœ¤„ôõMÑÉ¥¹œ¡ÀÈü¹¥‘ñðœœ¤¥½¹Ñ¥¹Õ”ì€¼¼ƒ–þ¦‚#–B3’âšRÛš²û–âÏš"Û¾ò3š&7¢÷’â¢ÖßžæÏ¢ÊïŽ(€€€õ…Ñ ¡”¥í½¹Ñ¥¹Õ•ô(€€€½ÕÐ¹ÁÕÍ ¡í¥éÈ¹¥±¹…µ”éÈ¹¹…µ”±‰Õ¹‘±•AÉ¥”éÍ…™•9Õ´¡È¹‰Õ¹‘±•}ÁÉ¥”¤±Í•ÍÍ¥½¹ÌéÍ¥‘Ì¹µ…À¡¥ôø¡í¥±¹…µ”éÍ5…Ám¥‘t¹¹…µ”±ÍÑ…ÑÕÌéÍ5…Ám¥‘t¹ÍÑ…ÑÕÍô¤¥ô¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡½ÕÐ¤ì)ô(¼¼ƒŠRŠR ƒ–‚Ç–B7–îëž®/¾òk¢¢#žº_¢"–¾¯–—–"¦n‹¾ò!´À×¾ò'ŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR (¼¼ÁÉ•Á…É•I•¥ÍÑÉ…Ñ¥½»¾òk–>«–k¦¦_¢¶'¢"¢¢#žº_¾ò3’â–/–¶_¦÷’â7–¾¯¦Ë¢ÎšZg–ê¯¾ò3–n{–
Ï–º3šVÓžjÉ•¥ÍÑÉ…Ñ¥½¹Ìƒ–"_Ž(¼¼€€ƒ–Z»–‚Ó¢"žÖ–B#–ÇžR£–B3’â’î÷¾ò3š&’î—–¾§š‚ã¢š?–&Ž¢ÊïžR£Ž¢¢·–
gŽžfóž–£–>«šršr'’â––_žº_šÎWŽ(¼¼™¥¹…±¥é•I•¥ÍÑÉ…Ñ¥½»¾òk’ê“šbOš"C–*Ž3’æ/–ú3Ž7š&7–kžj¦v{’ê“šbOšŸ–ú3žê3¾ò#¢Ê‡–.gšb;žÒÃŽšr–N‡ŽšR“’ö7Ž–¾’þ‡¾ò'Ž(¼¼ƒ–¾›¦jo–¾¯–—¾òk–Z»–‚Ó¢ÖÀ±…¥µ}Í•ÍÍ¥½¹}Í±½Ó¾òožÖ–B#¢ÖÀME0€ÀÈÄƒžj–Z»’â’ê“šbLIA¾ò3–£š"Cš"[–£’â7š"CŽ)…Íå¹Œ™Õ¹Ñ¥½¸ÁÉ•Á…É•I•¥ÍÑÉ…Ñ¥½¸¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€ˆ¹•µ…¥°€ô¹½Éµµ…¥°¡ˆ¹•µ…¥°¤ì(€ˆ¹Á¡½¹”€ô¹½ÉµA¡½¹”¡ˆ¹Á¡½¹”¤ì(€¥˜€ …ˆ¹•µ…¥°¤É•ÑÕÉ¸í•ÉÉ½ÈèŸ¢®/–†¯–¾¬µ…¥°ôì(€¥˜€ …ˆ¹Á¡½¹”¤É•ÑÕÉ¸í•ÉÉ½ÈèŸ¢®/–†¯–¾¯š&/š¦|ôì(€½¹ÍÐÍ•Ì€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹I½Ü¡•¹Ø°ˆ¹Í•ÍÍ¥½¹%°Q99P¤ì(€¥˜€ …Í•Ì¤É•ÑÕÉ¸í•ÉÉ½ÈèŸš&û’â7–"Ã–‚Óš²„ôì(€¥˜€¡Í•Ì¹ÍÑ…ÑÕÌôôôŸ¦^s¦Z$ññÍ•Ì¹ÍÑ…ÑÕÌôôôŸ–sžR œ¤É•ÑÕÉ¸í•ÉÉ½ÈèŸš¶“–‚Óš²‡–ÞË¦^s¦Z'–‚Ç–B4ôì(€½¹ÍÐ½Á•É…Ñ¥½¹U¹¥Ñ%õMÑÉ¥¹œ¡ˆ¹½Á•É…Ñ¥½¹U¹¥Ñ%‘ñðœœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ½Á•É…Ñ¥½¹U¹¥Ðõ½Á•É…Ñ¥½¹U¹¥Ñ%ý…Ý…¥Ð•Ñ=Á•É…Ñ¥½¹U¹¥ÑI½Ü¡•¹Ø±Q99P±½Á•É…Ñ¥½¹U¹¥Ñ%±ˆ¹Í•ÍÍ¥½¹%¤é¹Õ±°ì(€¥˜¡½Á•É…Ñ¥½¹U¹¥Ñ%˜˜…½Á•É…Ñ¥½¹U¹¥Ð¥É•ÑÕÉ¸í•ÉÉ½ÈèŸš&û’â7–"Ã¦g–/ž¦/¦‚žn¸ôì(€¥˜¡½Á•É…Ñ¥½¹U¹¥Ð˜˜…½Á•É…Ñ¥½¹U¹¥Ñ%Í=Á•¸¡½Á•É…Ñ¥½¹U¹¥Ð¤¥É•ÑÕÉ¸í•ÉÉ½ÈèŸš¶“ž¦/¦‚žn»žn»–&7šr«¦Z/šRøôì(€¥˜¡½Á•É…Ñ¥½¹U¹¥Ð¥í¥˜ ……Ý…¥Ð½Á•É…Ñ¥½¹U¹¥Ñ¹Ñ¥Ñ±•µ•¹ÑÑ¥Ù”¡•¹Ø±Q99P±½Á•É…Ñ¥½¹U¹¥Ð¤¥É•ÑÕÉ¸í•ÉÉ½ÈèŸš¶“ž¦/¦‚žn»–Âkšr«–>[–ú_š¶–ò?ž¦/š²+¾ò3šj¯’â7š:—–>_–‚Ç–B7¾ò?¦‚CžÒõô(€•±Í”¥˜€ ……Ý…¥Ð½Á•É…Ñ¥¹¹Ñ¥Ñ±•µ•¹ÑÑ¥Ù”¡•¹Ø°Q99P°Í•Ì¤¤É•ÑÕÉ¸í•ÉÉ½ÈèŸš¶“–‚Óš²‡–Âkšr«–>[–ú_š¶–ò?ž¦/š²+¾ò3šj¯’â7š:—–>_–‚Ç–B7¾ò?¦‚CžÒôì((€€¼¼ƒŠRŠR =%9ƒ¦kžR£š¢‡žÖ–òWšN;¾òkšZÃ¢ÎšZg’î”=Á•É…Ñ¥½¸U¹¥Ðƒž
ëš¶–ò?’úšêC¾òo¢"+–‚Óš²‡ž„U¹¥ÐƒšfšÊÿžR Í•ÍÍ¥½¹Ì¹µ½‘Õ±•Í}©Í½»Ž(€½¹ÍÐµ½‘Õ±•Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡½Á•É…Ñ¥½¹U¹¥ÐýÍ…™•)Í½¸¡½Á•É…Ñ¥½¹U¹¥Ð¹µ½‘Õ±•Í}©Í½¸±íô¤éÍ…™•)Í½¸¡Í•Ì¹µ½‘Õ±•Í}©Í½¸±íô¤¤ì(€½¹ÍÐµ½‘Õ±•M•±•Ñ¥½¹Ìô¡ˆ¹µ½‘Õ±•M•±•Ñ¥½¹Ì˜™ÑåÁ•½˜ˆ¹µ½‘Õ±•M•±•Ñ¥½¹Ìôôô½‰©•Ðœ¤ýˆ¹µ½‘Õ±•M•±•Ñ¥½¹Ìéíôì(€½¹ÍÐÍ•ÍÍ¥½¹…Ñ•I½ÝÌõÍ…™•)Í½¸¡Í•Ì¹‘…Ñ•Í}©Í½¸±mt¤±Í•±•Ñ•‘…Ñ•1¥ÍÐõÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹Í•±•Ñ•‘…Ñ•Ì¤ýˆ¹Í•±•Ñ•‘…Ñ•Ì¹µ…À¡MÑÉ¥¹œ¤émtì(€¥˜¡µ½‘Õ±•Ì¹½Á•É…Ñ¥¹5½‘”ôôô…Ñ¥Ù¥Ñäœ˜™µ½‘Õ±•Ì¹…Ñ¥Ù¥Ñå…Ñ•ÍQ½•Ñ¡•È˜™Í•ÍÍ¥½¹…Ñ•I½ÝÌ¹±•¹Ñ øÄ¥ì(€€€½¹ÍÐ…±±…Ñ•ÌõÍ•ÍÍ¥½¹…Ñ•I½ÝÌ¹µ…À¡àôùMÑÉ¥¹œ¡à˜™à¹‘…Ñ•ñðœœ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€¥˜¡Í•±•Ñ•‘…Ñ•1¥ÍÐ¹±•¹Ñ „ôõ…±±…Ñ•Ì¹±•¹Ñ¡ñð……±±…Ñ•Ì¹•Ù•Éä¡ôùÍ•±•Ñ•‘…Ñ•1¥ÍÐ¹¥¹±Õ‘•Ì¡¤¤¥É•ÑÕÉ¸í•ÉÉ½ÈèŸš¶“ž
ë–B3’â–º3šVÓ–’kš^—šÒï–.W¾ò3–þ¦‚#’âš²‡–‚Ç–B7–£¦£š^—šr|ôì(€ô(€±•Ðµ½‘Õ±•áÑÉ…Q½Ñ…°ôÀ°•¹•É¥A…ÉÑ¥¥Á…¹ÑQ½Ñ…°ôÀì(€½¹ÍÐµ½‘Õ±•M¹…ÁÍ¡½ÐõíÅÕ…¹Ñ¥Ñå5½‘”éµ½‘Õ±•Ì¹ÅÕ…¹Ñ¥Ñå5½‘”±Ñ¥µ•Í±½Ñ%‘Ìémuôì(€±•Ð±…¥µ•‘Q¥µ•Í±½Ñ%‘ÌõÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹Ñ¥µ•Í±½Ñ%‘Ì¤ýˆ¹Ñ¥µ•Í±½Ñ%‘Ì¹µ…À¡MÑÉ¥¹œ¤¹™¥±Ñ•È¡	½½±•…¸¤émtì(€¥˜¡µ½‘Õ±•Ì¹Ý½É­Í¡½ÁM±½ÑÌ¥ì(€€€½¹ÍÐÍõÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹Í•±•Ñ•‘…Ñ•Ì¤ýˆ¹Í•±•Ñ•‘…Ñ•Ìémtì(€€€¥˜¡Í¹±•¹Ñ „ôôÄ¥É•ÑÕÉ¸í•ÉÉ½ÈèŸ¢®/¦ãšN’â–/¦‚CžÒš^—šr¾ò?šfšºÔôì(€€€¥˜¡±…¥µ•‘Q¥µ•Í±½Ñ%‘Ì¹±•¹Ñ „ôôÄ¥É•ÑÕÉ¸í•ÉÉ½ÈèŸ¦‚CžÒšfšº×¢ÎšZg–ÞËšnÓšZÃ¾ò3¢®/¦7šZÃ¦ãšNôì(€€€½¹ÍÐÕ¹¥ÑM±½Ñ¥±Ñ•Èõ½Á•É…Ñ¥½¹U¹¥Ðý€™½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½Á•É…Ñ¥½¹U¹¥Ð¹¥¥õ€èœ™½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥õ¥Ì¹¹Õ±°œì(€€€½¹ÍÐÍ±½ÑÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Ñ¥µ•Í±½ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥ô‘íÕ¹¥ÑM±½Ñ¥±Ñ•Éô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡±…¥µ•‘Q¥µ•Í±½Ñ%‘ÍlÁt¥ô™ÍÑ…ÑÕÌõ•Ä¹½Á•¸™Í•±•Ðõ¥±‰½½­¥¹}…±•¹‘…É}¥‘€¤ì(€€€¥˜ …Í±½ÑÌ¹±•¹Ñ ¥É•ÑÕÉ¸í•ÉÉ½ÈèŸš¶“¦‚CžÒšfšº×–ÞË–sš¶‹¦Z/šRû¾ò3¢®/¦7šZÃ¦ãšNôì(€€€µ½‘Õ±•M¹…ÁÍ¡½Ð¹‰½½­¥¹…±•¹‘…É%õMÑÉ¥¹œ¡Í±½ÑÍlÁt¹‰½½­¥¹}…±•¹‘…É}¥‘ñðœœ¤ì(€ô(€¥˜¡µ½‘Õ±•Ì¹Í•ÉÙ¥”¥ì(€€€½¹ÍÐÍÙŒõµ½‘Õ±•%Ñ•µ	å%¡µ½‘Õ±•Ì¹Í•ÉÙ¥•Ì±µ½‘Õ±•M•±•Ñ¥½¹Ì¹Í•ÉÙ¥•%¤ì(€€€¥˜ …ÍÙŒ¥É•ÑÕÉ¸í•ÉÉ½ÈèŸ¢®/¦ãšNšr7–.g¦‚žn¸ôì(€€€µ½‘Õ±•M¹…ÁÍ¡½Ð¹Í•ÉÙ¥”õí¥éMÑÉ¥¹œ¡ÍÙŒ¹¥¤±±…‰•°éMÑÉ¥¹œ¡ÍÙŒ¹±…‰•±ññÍÙŒ¹¹…µ•ñðœœ¤±ÁÉ¥”éÍ…™•9Õ´¡ÍÙŒ¹ÁÉ¥”¥ôì(€€€µ½‘Õ±•áÑÉ…Q½Ñ…°¬õÍ…™•9Õ´¡ÍÙŒ¹ÁÉ¥”¤ì(€ô(€¥˜¡µ½‘Õ±•Ì¹É•Í½ÕÉ”¥ì(€€€½¹ÍÐÉ•Ìõµ½‘Õ±•%Ñ•µ	å%¡µ½‘Õ±•Ì¹É•Í½ÕÉ•Ì±µ½‘Õ±•M•±•Ñ¥½¹Ì¹É•Í½ÕÉ•%¤ì(€€€¥˜ …É•Ì¥É•ÑÕÉ¸í•ÉÉ½ÈèŸ¢®/¦ãšNšr7–.g’êë–N‡¾ò?¢Îšê@ôì(€€€µ½‘Õ±•M¹…ÁÍ¡½Ð¹É•Í½ÕÉ”õí¥éMÑÉ¥¹œ¡É•Ì¹¥¤±±…‰•°éMÑÉ¥¹œ¡É•Ì¹±…‰•±ññÉ•Ì¹¹…µ•ñðœœ¤±ÁÉ¥”éÍ…™•9Õ´¡É•Ì¹ÁÉ¥”¥ôì(€€€µ½‘Õ±•áÑÉ…Q½Ñ…°¬õÍ…™•9Õ´¡É•Ì¹ÁÉ¥”¤ì(€ô(€µ½‘Õ±•M¹…ÁÍ¡½Ð¹Ñ¥µ•Í±½Ñ%‘Ìõ±…¥µ•‘Q¥µ•Í±½Ñ%‘Ìì(€½¹ÍÐÁ…ÉÑ¥¥Á…¹ÑEÑäô¡ˆ¹Á…ÉÑ¥¥Á…¹ÑEÑä˜™ÑåÁ•½˜ˆ¹Á…ÉÑ¥¥Á…¹ÑEÑäôôô½‰©•Ðœ¤ýˆ¹Á…ÉÑ¥¥Á…¹ÑEÑäéíôì(€¥˜¡µ½‘Õ±•Ì¹Á…ÉÑ¥¥Á…¹ÑÌ¥ì(€€€½¹ÍÐÍ¹…Àõíôì(€€€™½È¡½¹ÍÐÁÐ½˜µ½‘Õ±•Ì¹Á…ÉÑ¥¥Á…¹ÑQåÁ•Ì¥ì(€€€€€½¹ÍÐ¥õMÑÉ¥¹œ¡ÁÐ¹¥‘ñðœœ¤±ÅÑäõ5…Ñ ¹µ…à À±Á…ÉÍ•%¹Ð¡Á…ÉÑ¥¥Á…¹ÑEÑåm¥‘t°ÄÀ¥ñðÀ¤ì(€€€€€¥˜¡ÅÑä¥íÍ¹…Ám¥‘tõí±…‰•°éMÑÉ¥¹œ¡ÁÐ¹±…‰•±ññÁÐ¹¹…µ•ññ¥¤±ÅÑä±ÁÉ¥”éÍ…™•9Õ´¡ÁÐ¹ÁÉ¥”¥ôí•¹•É¥A…ÉÑ¥¥Á…¹ÑQ½Ñ…°¬õÅÑäíµ½‘Õ±•áÑÉ…Q½Ñ…°¬õÅÑä©Í…™•9Õ´¡ÁÐ¹ÁÉ¥”¥ô(€€€ô(€€€¥˜¡•¹•É¥A…ÉÑ¥¥Á…¹ÑQ½Ñ…°ðÄ¥É•ÑÕÉ¸í•ÉÉ½ÈèŸ¢®/¦ãšN–>–*ƒ’êëšVàôì(€€€µ½‘Õ±•M¹…ÁÍ¡½Ð¹Á…ÉÑ¥¥Á…¹ÑÌõÍ¹…Àì(€ô((€€¼¼ƒŠRŠR ƒ–B#žÒ–B3š?¦¦_¢¶'¾ò#–ú3ž®¿ž†³šŸ¢š?–&¾ò'ŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR (€½¹ÍÐ…É••µ•¹ÑI•ÅÕ¥É•€ôµ½‘Õ±•Ì¹…É••µ•¹Ð€˜˜…É••µ•¹ÑI•ÅÕ¥É•‘=¸¡Í•Ì¹…É••µ•¹Ñ}É•ÅÕ¥É•¤ì(€¥˜€¡…É••µ•¹ÑI•ÅÕ¥É•¤ì(€€€¥˜€ …ˆ¹…É••µ•¹ÑY¥•Ý•¤€€É•ÑÕÉ¸í•ÉÉ½ÈèŸ¢®/–#¦î{¦Z/’â›¦ZÇ¢º–‚Ç–B7–B#žÒ¾ò3š&7¢÷¦–ë–‚Ç–B7Žôì(€€€¥˜€ …ˆ¹…É••µ•¹Ñ•ÁÑ•¤É•ÑÕÉ¸í•ÉÉ½ÈèŸ¢®/–.û¦ã–B3š?–‚Ç–B7–B#žÒ–ú3¾ò3š&7¢÷¦–ë–‚Ç–B7Žôì(€ô((€½¹ÍÐÍÑ…±±5…àõµ½‘Õ±•Ì¹ÅÕ…¹Ñ¥Ñå5½‘”ôôôÍÑ…±°œý5…Ñ ¹µ…à Ä±Í…™•9Õ´¡Í•Ì¹µ…á}ÍÑ…±±Ì¥ñðÌ¤èäääì(€½¹ÍÐÉ•ÅÕ•ÍÑ•‘U¹¥ÑÌõµ½‘Õ±•Ì¹ÅÕ…¹Ñ¥Ñå5½‘”ôôôÁ…ÉÑ¥¥Á…¹Ðœý5…Ñ ¹µ…à Ä±•¹•É¥A…ÉÑ¥¥Á…¹ÑQ½Ñ…°¤è¡µ½‘Õ±•Ì¹ÅÕ…¹Ñ¥Ñå5½‘”ôôô‰½½­¥¹œœüÄé5…Ñ ¹µ…à¡Á…ÉÍ•%¹Ð¡ˆ¹ÍÑ…±±½Õ¹Ð¥ñðÄ°Ä¤¤ì(€½¹ÍÐÍÑ…±±½Õ¹Ðõ5…Ñ ¹µ¥¸¡É•ÅÕ•ÍÑ•‘U¹¥ÑÌ±ÍÑ…±±5…à¤ì(€½¹ÍÐÍ•±•Ñ•‘…Ñ•Ì€ôÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹Í•±•Ñ•‘…Ñ•Ì¤€üˆ¹Í•±•Ñ•‘…Ñ•Ì€èmtì(€½¹ÍÐ‘…Ñ•Ì€ôÍ…™•)Í½¸¡Í•Ì¹‘…Ñ•Í}©Í½¸°mt¤ì((€€¼¼ƒ¦Cš^—¾ò=U¹¥Ðƒ–B7¦†7–#–k¦†¿ž’ë–Æ“šª‹š~—¾òošržÖ’î7žRÄƒ–:–¶@IAƒš*+¦^sŽ(€¥˜¡½Á•É…Ñ¥½¹U¹¥Ð¥ì(€€€½¹ÍÐ±¥´õÍ…™•9Õ´¡½Á•É…Ñ¥½¹U¹¥Ð¹…Á…¥Ñä¤±ÕÈõÍ…™•9Õ´¡½Á•É…Ñ¥½¹U¹¥Ð¹ÕÉÉ•¹Ñ}½Õ¹Ð¤ì(€€€¥˜¡±¥´øÀ˜™ÕÈ­ÍÑ…±±½Õ¹Ðù±¥´¥É•ÑÕÉ¸í•ÉÉ½ÈèŸ–B7¦†7’â7¢ÚÏ¾ò3–&¤€œ­5…Ñ ¹µ…à À±±¥´µÕÈ¤¬œƒ–B4ôì(€ô•±Í”¥˜€¡‘…Ñ•Ì¹±•¹Ñ øÀ€˜˜Í•±•Ñ•‘…Ñ•Ì¹±•¹Ñ øÀ¤ì(€€€½¹ÍÐ•á¥ÍÑ¥¹œ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°(€€€€€Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥ô™Í•±•ÐõÍ•±•Ñ•‘}‘…Ñ•Í}©Í½¸±ÍÑ…±±}½Õ¹Ð±É•Ù¥•Ý}ÍÑ…ÑÕÌ±ÑÉ…¹Í™•É}ÍÑ…ÑÕÍ€¤ì(€€€™½È€¡½¹ÍÐÍ½˜Í•±•Ñ•‘…Ñ•Ì¤ì(€€€€€½¹ÍÐ‘•˜€ô‘…Ñ•Ì¹™¥¹¡ôù¹‘…Ñ”ôôõÍ¤ì(€€€€€¥˜€ …‘•˜¤½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐ‘…å1¥µ¥Ð€ô9Õµ‰•È¡‘•˜¹±¥µ¥Ð¥ñðÀì(€€€€€¥˜€ …‘…å1¥µ¥Ð¤½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐ‘…åUÍ•€ô•á¥ÍÑ¥¹œ¹É•‘Õ” ¡Ì±È¤ôùì(€€€€€€€¥˜€ …¥ÍÑ¥Ù•½É…Á…¥Ñä¡È¤¤É•ÑÕÉ¸Ìì(€€€€€€€½¹ÍÐÉ€ôÍ…™•)Í½¸¡È¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸±mt¤ì(€€€€€€€É•ÑÕÉ¸Ì¬¡É¹¥¹±Õ‘•Ì¡Í¤ü¡9Õµ‰•È¡È¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤èÀ¤ì(€€€€€ô°À¤ì(€€€€€¥˜€¡‘…åUÍ•­ÍÑ…±±½Õ¹Ðù‘…å1¥µ¥Ð¤É•ÑÕÉ¸í•ÉÉ½ÈèÍ¹Í±¥” Ô¤¹É•Á±…” œ´œ°œ¼œ¤¬ŸžVÛš^—–B7¦†7’â7¢ÚÏ¾ò3–&¤€œ¬¡‘…å1¥µ¥Ðµ‘…åUÍ•¤¬œƒšRôì(€€€ô(€ô•±Í”ì(€€€½¹ÍÐÕÈ€ôÍ…™•9Õ´¡Í•Ì¹ÕÉÉ•¹Ñ}½Õ¹Ð¤°±¥´€ôÍ…™•9Õ´¡Í•Ì¹±¥µ¥Ñ}½Õ¹Ð¤ì(€€€¥˜€¡±¥´øÀ€˜˜ÕÈ­ÍÑ…±±½Õ¹Ðù±¥´¤É•ÑÕÉ¸í•ÉÉ½ÈèŸ–B7¦†7’â7¢ÚÏ¾ò3–&¤€œ¬¡±¥´µÕÈ¤¬œƒšRôì(€ô(((€€¼¼´ÀÇ¾òiµ…¥°ƒ–ÞËšr'šr–N‡’öš&/š¦’â7ž²˜ƒŠHƒžnÓš:—šN/’â/Ž(€€¼¼ƒ–þ¦‚#–r£’îï’öW–¾¯–—¾ò#–6ƒ–B7¦†7¾ò?–îë–‚Ç–B7¾ò?¢š–¾¬µ•µ‰•ÉÏ¾ò'’æ/–&7Ž(€½¹ÍÐ•á¥ÍÑ¥¹5•µ‰•ÉI½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€µ•µ‰•ÉÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹•µ…¥°¥ô™Í•±•Ðõ•µ…¥°±Á¡½¹•€¤¹…Ñ   ¤ôùmt¤ì(€¥˜€¡•á¥ÍÑ¥¹5•µ‰•ÉI½ÝÌ¹±•¹Ñ €˜˜€…Á¡½¹•5…Ñ¡•Ì¡•á¥ÍÑ¥¹5•µ‰•ÉI½ÝÍlÁt¹Á¡½¹”°ˆ¹Á¡½¹”¤¤ì(€€€É•ÑÕÉ¸í•ÉÉ½ÈèŸš¶µ…¥°ƒ–ÞËšr'šr–N‡¢ÎšZg¾ò3’öš&/š¦’â7’â¢ÓŽ¢®/’öÿžR£–:–‚Ç–B7š&/š¦žfï–—¾ò3š"[¢¿žæ¯’âï¢ú›–6S–*§Žôì(€ô((€€¼¼ƒ¦7¢’–‚Ç–B7šª‹š~—¾òk–ÞË–>[šÚ#Ž’â7¦2–>[Ž–ÞË¦¢ÊìƒŠHƒ¢š[ž
ëžÖCšv¾ò3–¢¢Ç¦7šZÃ–‚Ç–B4(€½¹ÍÐ‘ÕÁá±Õ‘”€ô•¹½‘•UI%½µÁ½¹•¹Ð Ÿ’â7¦2–>Xœ¤€¬€œ°œ€¬•¹½‘•UI%½µÁ½¹•¹Ð Ÿ–ÞË–>[šÚ œ¤ì(€½¹ÍÐ‘ÕÁU¹¥Ñ¥±Ñ•Èõ½Á•É…Ñ¥½¹U¹¥Ðý€™½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½Á•É…Ñ¥½¹U¹¥Ð¹¥¥õ€èœ™½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥õ¥Ì¹¹Õ±°œì(€½¹ÍÐ‘ÕÁ±¥…Ñ•=Ý¹•É¥±Ñ•Èõˆ¹‰É…¹‘%ý‰É…¹‘}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹‰É…¹‘%¥õ€é•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹•µ…¥°¥õ€ì(€½¹ÍÐ‘ÕÁI…Ü€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°(€€€Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥ô‘í‘ÕÁU¹¥Ñ¥±Ñ•Éô˜‘í‘ÕÁ±¥…Ñ•=Ý¹•É¥±Ñ•Éô™É•Ù¥•Ý}ÍÑ…ÑÕÌõ¹½Ð¹¥¸¸ ‘í‘ÕÁá±Õ‘•ô¤™Í•±•Ðõ¥±ÑÉ…¹Í™•É}ÍÑ…ÑÕÍ€(€€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐ‘ÕÀ€ô‘ÕÁI…Ü¹™¥±Ñ•È¡È€ôøì(€€€½¹ÍÐÑÌ€ôMÑÉ¥¹œ¡È¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌñð€œœ¤¹ÑÉ¥´ ¤ì(€€€É•ÑÕÉ¸ÑÌ€„ôô€Ÿ–ÞË¦¢Êìœ€˜˜ÑÌ€„ôô€Ÿ–ÞË¦š²øœì(€ô¤ì(€¥˜€¡‘ÕÀ¹±•¹Ñ ¤É•ÑÕÉ¸í•ÉÉ½Èéˆ¹‰É…¹‘%üŸ¦g–/–Nž&3–ÞË–‚Ç–B7š¶“–‚Óš²‡¾òo¢®/–*ƒ–—š^‹šr'–‚Ç–B7š"Cž
ëž>û–‚Ó’î¢†£¾ò3’â7¢š–7–îëž®/ž²³’ê3ž¶œèŸš
£–ÞË–‚Ç–B7š¶“–‚Óš²„ôì((€€¼¼ƒ–¾§š‚ã¢š?–&¾òk’î—–‚Óš²‡¢¢·–ºkž
ë–~ëž’;¾òmµ•µ‰•ÉÌ¹™…ÍÑ}Á…ÍÏ¾ò#–7–¾§š‚ãšr–N‡¾ò'žnÓš:—¦2–>[Ž	™…ÍÑ}Á…ÍÌƒ–>«’þ‡¢ÎšZg–ê¯Ž(€½¹ÍÐ¹••‘I•Ù¥•Ü€ôµ½‘Õ±•Ì¹É•Ù¥•Ü€˜˜€¡Í•Ì¹¹••‘}É•Ù¥•ÜôôõÑÉÕ•ññÍ•Ì¹¹••‘}É•Ù¥•ÜôôôÑÉÕ”œ¤ì(€±•Ð™…ÍÑA…ÍÌ€ô™…±Í”ì(€¥˜€¡¹••‘I•Ù¥•Ü€˜˜ˆ¹•µ…¥°¤ì(€€€½¹ÍÐµÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡MÑÉ¥¹œ¡ˆ¹•µ…¥°¤¹ÑÉ¥´ ¤¥ô™Í•±•Ðõ™…ÍÑ}Á…ÍÍ€¤¹…Ñ   ¤ôùmt¤ì(€€€™…ÍÑA…ÍÌ€ô€„„¡µÉ½ÝÍlÁt€˜˜€¡µÉ½ÝÍlÁt¹™…ÍÑ}Á…ÍÌ€ôôôÑÉÕ”ñðµÉ½ÝÍlÁt¹™…ÍÑ}Á…ÍÌ€ôôô€ÑÉÕ”œ¤¤ì(€ô(€½¹ÍÐÍÑ…ÑÕÌ€ô€¡¹••‘I•Ù¥•Ü€˜˜€…™…ÍÑA…ÍÌ¤€ü€Ÿ–ú–¾§š‚àœ€è€Ÿ–ÞË¦2–>Xœì((€€¼¼ƒ¢ÊïžR£¢¢#žº_¾ò#’â–ú/–ú3ž®¿žº_¾ò3–&7ž®¿¦G¦†7’â7–>¿’þ‡¾ò$(€½¹ÍÐ‰…Í••”€ôˆ¹‰Õ¹‘±•É½ÕÁ%€ü€¡9Õµ‰•È¡ˆ¹‰Õ¹‘±••”¥ñðÀ¤€è€¡½Á•É…Ñ¥½¹U¹¥Ðý5…Ñ ¹µ…à À±Í…™•9Õ´¡½Á•É…Ñ¥½¹U¹¥Ð¹™•”¤¤©5…Ñ ¹µ…à Ä±ÍÑ…±±½Õ¹Ð¤é…±•”¡Í•Ì°Í•±•Ñ•‘…Ñ•Ì°ÍÑ…±±½Õ¹Ð¤¤ì(€½¹ÍÐÉ½ÍÍ•”õ5…Ñ ¹µ…à À±‰…Í••”­µ½‘Õ±•áÑÉ…Q½Ñ…°¤ì(€½¹ÍÐ‰•¹•™¥Ðõ…Ý…¥Ð…±Õ±…Ñ•I•¥ÍÑÉ…Ñ¥½¹	•¹•™¥ÑÌ¡•¹Ø±Q99P±ˆ±½Á•É…Ñ¥½¹U¹¥Ð±É½ÍÍ•”¤ì(€½¹ÍÐ™•”õ5…Ñ ¹µ…à À±‰•¹•™¥Ð¹¹•Ñµ½Õ¹Ð¤ì(€µ½‘Õ±•M¹…ÁÍ¡½Ð¹‰•¹•™¥Ðõ‰•¹•™¥Ðì(€½¹ÍÐ•™™•Ñ¥Ù••Á½Í¥Ñ-¥¹€ôµ½‘Õ±•Ì¹‘•Á½Í¥Ñ-¥¹ì(€½¹ÍÐ‘•Á½Í¥Ñ	…Í•µ½Õ¹Ð€ô™•”ì(€½¹ÍÐÉ•™Õ¹‘…‰±••Á½Í¥Ð€ô•™™•Ñ¥Ù••Á½Í¥Ñ-¥¹ôôôÉ•™Õ¹‘…‰±”œ€ü…±½¹™¥ÕÉ•‘•Á½Í¥Ð¡µ½‘Õ±•Ì±‘•Á½Í¥Ñ	…Í•µ½Õ¹Ð±É•ÅÕ•ÍÑ•‘U¹¥ÑÌ¤€è€Àì(€½¹ÍÐ‘•Á½Í¥Ð€ôÉ•™Õ¹‘…‰±••Á½Í¥Ðì(€µ½‘Õ±•M¹…ÁÍ¡½Ð¹‘•Á½Í¥Ñ-¥¹õ•™™•Ñ¥Ù••Á½Í¥Ñ-¥¹ì(€µ½‘Õ±•M¹…ÁÍ¡½Ð¹‘•Á½Í¥ÑA½±¥äõµ½‘Õ±•Ì¹‘•Á½Í¥ÑA½±¥äì(€µ½‘Õ±•M¹…ÁÍ¡½Ð¹‰½½­¥¹A½±¥äõµ½‘Õ±•Ì¹‰½½­¥¹A½±¥äì(€½¹ÍÐ•ÅÕ¥ÁQ½Ñ…°€ôµ½‘Õ±•Ì¹•ÅÕ¥Áµ•¹Ð€ü…±ÅÕ¥ÁQ½Ñ…°¡ˆ¹•ÅÕ¥Áññíô°Í•Ì¹•ÅÕ¥Á}©Í½¸°ÍÑ…±±½Õ¹Ð°Í•Ì¹‰…Í¥}•ÅÕ¥Áñðœœ¤€è€Àì(€±•Ð…‘‘½¹Q½Ñ…°ôÀì(€ÑÉäì(€€€½¹ÍÐ…‘‘½¹•™Ì€ôµ½‘Õ±•Ì¹…‘‘½¹Ì€üÍ…™•)Í½¸¡Í•Ì¹…‘‘½¹Í}©Í½¸±mt¤€èmtì(€€€½¹ÍÐ…‘‘½¹EÑä€ôµ½‘Õ±•Ì¹…‘‘½¹Ì€ü€¡ˆ¹…‘‘½¹EÑåññíô¤€èíôì(€€€…‘‘½¹•™Ì¹™½É…  ¡„±¤¤ôùì¥˜¡„˜™„¹½Á•¸ôôõÑÉÕ”¤…‘‘½¹Q½Ñ…°¬ô¡9Õµ‰•È¡„¹ÁÉ¥”¥ñðÀ¤¨¡9Õµ‰•È¡…‘‘½¹EÑåm¥t¥ñðÀ¤ìô¤ì(€ô…Ñ íô(€½¹ÍÐ¡…É•	•™½É•	½½­¥¹•Á½Í¥Ð€ô™•”€¬•ÅÕ¥ÁQ½Ñ…°€¬…‘‘½¹Q½Ñ…°ì(€½¹ÍÐ‰½½­¥¹•Á½Í¥Ð€ô•™™•Ñ¥Ù••Á½Í¥Ñ-¥¹ôôô‰½½­¥¹œœ€ü…±	½½­¥¹•Á½Í¥Ð¡ì¸¸¹µ½‘Õ±•Ì±‘•Á½Í¥Ñ-¥¹é•™™•Ñ¥Ù••Á½Í¥Ñ-¥¹‘ô±¡…É•	•™½É•	½½­¥¹•Á½Í¥Ð¤€è€Àì(€µ½‘Õ±•M¹…ÁÍ¡½Ð¹‰½½­¥¹•Á½Í¥Ðõ‰½½­¥¹•Á½Í¥Ðì(€½¹ÍÐÑ½Ñ…°€ô™•”­‘•Á½Í¥Ð­•ÅÕ¥ÁQ½Ñ…°­…‘‘½¹Q½Ñ…°ì(€µ½‘Õ±•M¹…ÁÍ¡½Ð¹…µ½Õ¹ÑÕ•9½Ü€ô•™™•Ñ¥Ù••Á½Í¥Ñ-¥¹ôôô‰½½­¥¹œœ€ü‰½½­¥¹•Á½Í¥Ð€èÑ½Ñ…°ì(€µ½‘Õ±•M¹…ÁÍ¡½Ð¹‰…±…¹•Õ”€ô•™™•Ñ¥Ù••Á½Í¥Ñ-¥¹ôôô‰½½­¥¹œœ€ü5…Ñ ¹µ…à À±Ñ½Ñ…°µ‰½½­¥¹•Á½Í¥Ð¤€è€Àì((€½¹ÍÐÁ©MÉŒ€ô€¡ˆ¹Á…ÉÑ¥¥Á…¹ÑÍ)Í½¸€˜˜ÑåÁ•½˜ˆ¹Á…ÉÑ¥¥Á…¹ÑÍ)Í½¸ôôô½‰©•Ðœ¤€üˆ¹Á…ÉÑ¥¥Á…¹ÑÍ)Í½¸€èíôì(€½¹ÍÐ…‘Õ±Ñ½Õ¹Ð€ô5…Ñ ¹µ…à À°Á…ÉÍ•%¹Ð¡ˆ¹…‘Õ±Ñ½Õ¹Ð€üüÁ©MÉŒ¹…‘Õ±Ñ½Õ¹Ð€üü€À°€ÄÀ¤ñð€À¤ì(€½¹ÍÐ¡¥±‘½Õ¹Ð€ô5…Ñ ¹µ…à À°Á…ÉÍ•%¹Ð¡ˆ¹¡¥±‘½Õ¹Ð€üüÁ©MÉŒ¹¡¥±‘½Õ¹Ð€üü€À°€ÄÀ¤ñð€À¤ì(€½¹ÍÐ¡¥±‘•ÍI…Ü€ôÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹¡¥±‘•Ì¤€üˆ¹¡¥±‘•Ì€è€¡ÉÉ…ä¹¥ÍÉÉ…ä¡Á©MÉŒ¹¡¥±‘•Ì¤€üÁ©MÉŒ¹¡¥±‘•Ì€èmt¤ì(€½¹ÍÐ¡¥±‘•Ì€ô¡¥±‘•ÍI…Ü¹Í±¥” À°¡¥±‘½Õ¹Ð¤¹µ…À¡àôù9Õµ‰•È¡à¤¤¹™¥±Ñ•È¡àôù9Õµ‰•È¹¥Í¥¹¥Ñ”¡à¤€˜˜àøôÀ¤ì(€½¹ÍÐÁ…ÉÑ¥¥Á…¹ÑÍ)Í½¸€ôí…‘Õ±Ñ½Õ¹Ð±¡¥±‘½Õ¹Ð±¡¥±‘•Ì±Ñ½Ñ…±½Õ¹Ðéµ½‘Õ±•Ì¹Á…ÉÑ¥¥Á…¹ÑÌý•¹•É¥A…ÉÑ¥¥Á…¹ÑQ½Ñ…°è¡…‘Õ±Ñ½Õ¹Ð­¡¥±‘½Õ¹Ð¤±ÑåÁ•Ìéµ½‘Õ±•M¹…ÁÍ¡½Ð¹Á…ÉÑ¥¥Á…¹ÑÍññíõôì((€¥˜¡µ½‘Õ±•Ì¹¥¹Ù½¥”€˜˜ˆ¹¹••‘%¹Ù½¥”„ôõ™…±Í”€˜˜ˆ¹¥¹Ù½¥•QåÁ”€˜˜ˆ¹¥¹Ù½¥•QåÁ”„ôôŸ’â7¦r¢šœ¥ì(€€€¥˜ …MÑÉ¥¹œ¡ˆ¹¥¹Ù½¥•µ…¥±ññˆ¹•µ…¥±ñðœœ¤¹ÑÉ¥´ ¤¤É•ÑÕÉ¸í•ÉÉ½ÈèŸ¢®/–†¯–¾¯žfóž– µ…¥°ôì(€€€¥˜¡MÑÉ¥¹œ¡ˆ¹¥¹Ù½¥•QåÁ”¤ôôôŸ–³–>ã¾ò?š¦¦^pœ¥ì(€€€€€¥˜ …MÑÉ¥¹œ¡ˆ¹Ñ…á%‘ñðœœ¤¹ÑÉ¥´ ¤¤É•ÑÕÉ¸í•ÉÉ½ÈèŸ–³–>ã¾ò?š¦¦^sžfóž–£¢®/–†¯žÖÇ’âžÞ£¢f¢"š*³¦‚´ôì(€€€€€¥˜ …MÑÉ¥¹œ¡ˆ¹¥¹Ù½¥•Q¥Ñ±•ñðœœ¤¹ÑÉ¥´ ¤¤É•ÑÕÉ¸í•ÉÉ½ÈèŸ–³–>ã¾ò?š¦¦^sžfóž–£¢®/–†¯žÖÇ’âžÞ£¢f¢"š*³¦‚´ôì(€€€ô(€ô(€½¹ÍÐ¥¹Ù½¥•MÑ…ÑÕÌ€ô€ …µ½‘Õ±•Ì¹¥¹Ù½¥”ñðˆ¹¹••‘%¹Ù½¥”ôôõ™…±Í”ñðˆ¹¥¹Ù½¥•QåÁ”ôôôŸ’â7¦r¢šœ¤€ü€œœ€è€Ÿ–ú¦Z/ž®,œì((€½¹ÍÐ¥€ô•¹% Iœ¤ì(€½¹ÍÐÉ½Ü€ôì(€€€¥°Ñ•¹…¹Ñ}¥éQ99P°‰Õ¹‘±•}¥éˆ¹‰Õ¹‘±•%‘ñðœœ°‰Õ¹‘±•}É½ÕÁ}¥éˆ¹‰Õ¹‘±•É½ÕÁ%‘ñðœœ°(€€€Í•ÍÍ¥½¹}¥éˆ¹Í•ÍÍ¥½¹%°½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥é½Á•É…Ñ¥½¹U¹¥Ðý½Á•É…Ñ¥½¹U¹¥Ð¹¥é¹Õ±°°‰½½­¥¹}…±•¹‘…É}¥éµ½‘Õ±•M¹…ÁÍ¡½Ð¹‰½½­¥¹…±•¹‘…É%‘ññ¹Õ±°°•Ù•¹Ñ}¥é±•…¹Ù•¹Ñ%¡Í•Ì¹•Ù•¹Ñ}¥¤°(€€€•µ…¥°éˆ¹•µ…¥°°Á±…Ñ™½Éµ}µ•µ‰•É}¥éˆ¹Á±…Ñ™½Éµ5•µ‰•É%‘ññ¹Õ±°°ÍÕ‰µ¥ÑÑ•‘}‰å}µ•µ‰•É}¥éˆ¹Á±…Ñ™½Éµ5•µ‰•É%‘ññ¹Õ±°°‰É…¹‘}¥éˆ¹‰É…¹‘%‘ññ¹Õ±°°¹…µ”éˆ¹¹…µ”°Á¡½¹”éMÑÉ¥¹œ¡ˆ¹Á¡½¹•ñðœœ¤°(€€€‰É…¹‘}¹…µ”éˆ¹‰É…¹‘ñðœœ°‰É…¹‘}¥¹ÑÉ¼éˆ¹‰É…¹‘%¹ÑÉ½ñðœœ°(€€€Í•±±}…Ñ•½Éäéˆ¹Í•±±…Ñ•½Éåññˆ¹Í•±±…Ññðœœ°Í•±±}¥Ñ•µÌéˆ¹Í•±±%Ñ•µÍññˆ¹Í•±±%Ñ•µñðœœ°(€€€Í•±±}±¥¹¬éˆ¹Í•±±1¥¹­ñðœœ°Á¡½Ñ½}ÕÉ°éˆ¹Á¡½Ñ½ñðœœ°™‰}ÕÉ°éˆ¹™‰ñðœœ°¥}ÕÉ°éˆ¹¥ñðœœ°(€€€•ÅÕ¥Áµ•¹Ñ}©Í½¸è¡ˆ¹•ÅÕ¥Áññíô¤°(€€€ÕÍÑ½µ}™¥•±‘Í}©Í½¸él¸¸¸¡µ½‘Õ±•Ì¹ÕÍÑ½µ¥•±‘Ì˜™ÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹ÕÍÑ½µ¥•±‘Ì¤ýˆ¹ÕÍÑ½µ¥•±‘Ìémt¤±í­•äè}}‘½¥¹}µ½‘Õ±•Ìœ±Ù…±Õ”éµ½‘Õ±•M¹…ÁÍ¡½Ñõt°(€€€Á…ÉÑ¥¥Á…¹ÑÍ}©Í½¸éÁ…ÉÑ¥¥Á…¹ÑÍ)Í½¸°(€€€ÍÑ…±±}½Õ¹ÐéÍÑ…±±½Õ¹Ð°‘•Á½Í¥Ð°(€€€É•Ù¥•Ý}ÍÑ…ÑÕÌéÍÑ…ÑÕÌ°(€€€Á…åµ•¹Ñ}ÍÑ…ÑÕÌéÑ½Ñ…°ôôôÀüŸ–7¢ÊìœèŸšr«žæÏ¢Êìœ°(€€€€€…µ½Õ¹ÐéÑ½Ñ…°°Ñ½Ñ…±}…µ½Õ¹ÐéÑ½Ñ…°°…‘‘½¹}…µ½Õ¹Ðé…‘‘½¹Q½Ñ…°°(€€€Á…¥‘}…µ½Õ¹Ðè€À°(€€€¡•­¥¹}ÍÑ…ÑÕÌèŸšr«–‚Ç–"Àœ°±•…É}ÍÑ…ÑÕÌèŸšr«šâ–‚Ðœ°(€€€‘•Á½Í¥Ñ}É•™Õ¹‘•èŸšr«¦š*ó¦Dœ°ÍÑ…±±}¹Õµ‰•Èèœœ°(€€€Í•…Ñ}¡½¥•}¥¹Ñ•¹Ðè€¡µ½‘Õ±•Ì¹Í•…ÑM•±•Ñ¥½¸€˜˜ˆ¹Í•…Ñ¡½¥•%¹Ñ•¹ÐôôôÁ…¥œüÁ…¥œè…ÕÑ¼œ¤°(€€€Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌè€Á•¹‘¥¹œœ°(€€€Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸éÍ•±•Ñ•‘…Ñ•Ì°(€€€…‘‘½¹}ÅÑå}©Í½¸è¡ˆ¹…‘‘½¹EÑåññíô¤°(€€€Ñ…á}¥éˆ¹Ñ…á%‘ñðœœ°¥¹Ù½¥•}Ñ¥Ñ±”éˆ¹¥¹Ù½¥•Q¥Ñ±•ñðœœ°(€€€¥¹Ù½¥•}ÑåÁ”éˆ¹¥¹Ù½¥•QåÁ•ñðœœ°¥¹Ù½¥•}•µ…¥°éˆ¹¥¹Ù½¥•µ…¥±ñðœœ°¥¹Ù½¥•}…ÉÉ¥•Èéˆ¹¥¹Ù½¥•…ÉÉ¥•Éñðœœ°(€€€¥¹Ù½¥•}ÍÑ…ÑÕÌé¥¹Ù½¥•MÑ…ÑÕÌ°(€€€É•µ¥¹‘•É}Í•¹Ðé™…±Í”°É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¤°(€€€€¸¸¸¡ÍÑ…ÑÕÌôôôŸ–ÞË¦2–>Xœ€üÁ…åµ•¹Ñ•…‘±¥¹•A…å±½…¡Í•Ì±¹½Ý%Í¼ ¤±Ñ½Ñ…°¤€èíô¤°(€€€€¼¼ƒŠRŠR ƒ–B#žÒ–B3š?–þ¯žœƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR (€€€…É••µ•¹Ñ}…•ÁÑ•è…É••µ•¹ÑI•ÅÕ¥É•€üÑÉÕ”€è€¡ˆ¹…É••µ•¹Ñ•ÁÑ•ôôõÑÉÕ”¤°(€€€…É••µ•¹Ñ}Ù¥•Ý•è€€…É••µ•¹ÑI•ÅÕ¥É•€üÑÉÕ”€è€¡ˆ¹…É••µ•¹ÑY¥•Ý•ôôõÑÉÕ”¤°(€ôì((€É•ÑÕÉ¸íÍ•Ì°¥°É½Ü°µ•Ñ„éì(€€€Í•ÍQåÁ”°ÍÑ…±±½Õ¹Ð°Í•±•Ñ•‘…Ñ•Ì°¹••‘I•Ù¥•Ü°™…ÍÑA…ÍÌ°ÍÑ…ÑÕÌ°(€€€™•”°É½ÍÍ•”°‰•¹•™¥Ð°½Á•É…Ñ¥½¹U¹¥Ð°½Á•É…Ñ¥½¹U¹¥Ñ%é½Á•É…Ñ¥½¹U¹¥Ðý½Á•É…Ñ¥½¹U¹¥Ð¹¥èœœ°‘•Á½Í¥Ð°•ÅÕ¥ÁQ½Ñ…°°…‘‘½¹Q½Ñ…°°µ½‘Õ±•áÑÉ…Q½Ñ…°°Ñ½Ñ…°°¥¹Ù½¥•MÑ…ÑÕÌ°Ñ¥µ•Í±½Ñ%‘Ìé±…¥µ•‘Q¥µ•Í±½Ñ%‘Ì°(€õôì)ô((¼¼ƒ’ê“šbOš"C–*’æ/–ú3š&7¢ÞGŽ¦g¢Ž‡–’ÇšV_’â7šr–n{š6Ë–‚Ç–B7¾ò#–‚Ç–B7–ÞËš"Cž®/¾ò'¾ò3’ö’â–ú/¢¢c¦2¾ò3’â7¦vs¦îc–B{š:'Ž)…Íå¹Œ™Õ¹Ñ¥½¸™¥¹…±¥é•I•¥ÍÑÉ…Ñ¥½¸¡•¹Ø°Q99P°ˆ°Í•Ì°¥°µ•Ñ„°Ñà°½ÁÑÌõíô¤ì(€¥˜ …½ÁÑÌ¹Í­¥Á¥¹…¹”¥ì(€€€€¼¼É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌ€¼¥¹Ù½¥”ƒ–Æ³šZóš¶–ò?–‚Ç–B7¢ÎšZg¾òo–’ÇšV_–þ¦‚#–ú’â+š./¾ò3’â7¢÷žVg’â/Ž3–‚Ç–B7š"C–*’ö¢Ê‡–.gžòë¢ÎšZgŽ7Ž(€€€…Ý…¥ÐÉ•…Ñ•I•¥ÍÑÉ…Ñ¥½¹¥¹…¹•I•½É‘Ì¡•¹Ø°Q99P°¥°ˆ¹Í•ÍÍ¥½¹%°ˆ¹•µ…¥°°(€€€€€µ•Ñ„¹™•”°µ•Ñ„¹‘•Á½Í¥Ð°µ•Ñ„¹•ÅÕ¥ÁQ½Ñ…°°µ•Ñ„¹…‘‘½¹Q½Ñ…°°ì(€€€€€€€¥¹Ù½¥•}ÍÑ…ÑÕÌèµ•Ñ„¹¥¹Ù½¥•MÑ…ÑÕÌ°(€€€€€€€¥¹Ù½¥•}ÑåÁ”èˆ¹¥¹Ù½¥•QåÁ”ñð€œœ°(€€€€€€€¥¹Ù½¥•}Ñ¥Ñ±”èˆ¹¥¹Ù½¥•Q¥Ñ±”ñð€œœ°(€€€€€€€Ñ…á}¥èˆ¹Ñ…á%ñð€œœ°(€€€€€€€¥¹Ù½¥•}•µ…¥°èˆ¹¥¹Ù½¥•µ…¥°ñð€œœ°(€€€€€€€¥¹Ù½¥•}…ÉÉ¥•Èèˆ¹¥¹Ù½¥•…ÉÉ¥•Èñð€œœ°(€€€€€ô°í½Á•É…Ñ¥½¹U¹¥Ñ%éµ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ñ%‘ñðœœ±É½ÍÍ•”éµ•Ñ„¹É½ÍÍ••ññµ•Ñ„¹™•”±‰•¹•™¥Ðéµ•Ñ„¹‰•¹•™¥Ñññ¹Õ±±ô¤ì(€ô(€¥˜¡µ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ð¥…Ý…¥Ð…ÁÁ±åI•Ý…É‘I•‘•µÁÑ¥½¸¡•¹Ø±Q99P±ˆ¹•µ…¥°±¥±µ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ð±µ•Ñ„¹‰•¹•™¥Ð¤ì(€…Ý…¥ÐÉ•½É‘9½Ñ¥™¥…Ñ¥½¸¡•¹Ø±íÑ•¹…¹Ñ%éQ99P±Õ¹¥Ñ%éµ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ñ%‘ññ¹Õ±°±Í•ÍÍ¥½¹%éˆ¹Í•ÍÍ¥½¹%±É•¥ÍÑÉ…Ñ¥½¹%é¥±•µ…¥°éˆ¹•µ…¥°±•Ù•¹Ñ-•äèÉ•¥ÍÑÉ…Ñ¥½¹}É•…Ñ•œ±Ñ¥Ñ±”èŸ–‚Ç–B7¾ò?¦‚CžÒ–ÞË–îëž®,œ±‰½‘äè¡Í•Ì¹¹…µ•ñðŸšÒï–.Tœ¤¬¡µ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ðü Ÿ¾öpœ­µ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ð¹¹…µ”¤èœœ¤¬œƒ–ÞË–îëž®/š"C–*|œ±µ•Ñ„éíÍÑ…ÑÕÌéµ•Ñ„¹ÍÑ…ÑÕÌ±Ñ½Ñ…°éµ•Ñ„¹Ñ½Ñ…±õô¤ì((€ÑÉåì(€€€½¹ÍÐ•á¥ÍÑ¥¹5•µ‰•Èõ…Ý…¥Ð‘‰•Ð¡•¹Ø°µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¹½Éµµ…¥°¡ˆ¹•µ…¥°¤¥ô™Í•±•Ðõ•µ…¥±€¤ì(€€€¥˜ …•á¥ÍÑ¥¹5•µ‰•È¹±•¹Ñ ñðˆ¹Íå¹5•µ‰•ÉAÉ½™¥±”ôôõÑÉÕ”ñðˆ¹Íå¹5•µ‰•ÉAÉ½™¥±”ôôôÑÉÕ”œ¤…Ý…¥ÐÕÁÍ•ÉÑ5•µ‰•È¡•¹Ø±ˆ¤ì(€õ…Ñ ¡”¥ì±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è™¥¹…±¥é•I•¥ÍÑÉ…Ñ¥½¸œ±Ñ•¹…¹Ñ%éQ99P±É•%é¥±µ•ÍÍ…”èµ•µ‰•ÈÍå¹ŒÍ­¥ÁÁ•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìô((€¥˜€¡ˆ¹ÍÑ…±±9Õµ‰•È¤ì(€€€ÑÉäì…Ý…¥Ð¡½±‘MÑ…±°¡•¹Ø°ˆ¹Í•ÍÍ¥½¹%°ˆ¹ÍÑ…±±9Õµ‰•È°¥°ˆ¹•µ…¥±ñðœœ°Q99P¤ìô…Ñ íô(€ô((€€¼¼ƒ–¾’þ‡’â7–>¿¦bï–†{–&7–>Ãš"C–*žV¯¦v‹¾òiµ…¥°ƒšr7–.gš‹š"[–’ÇšV_šf¾ò3’öÿžR£¢’â7¢¦Ë–6‡–r£–‚Ç–B7¦‚Ž(€½¹ÍÐÍ•¹‘½¹™¥Éµ5…¥°€ô…Íå¹Œ€ ¤€ôøì(€€€ÑÉäì(€€€€€½¹ÍÐÑI•œ€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€€€€€½¹ÍÐ‘¸€ô•Ñ¥ÍÁ±…å9…µ”¡ˆ¹¹…µ”°ˆ¹‰É…¹ñð€œœ°µ•Ñ„¹Í•ÍQåÁ”¤ì(€€€€€…Ý…¥Ðµ…¥±I•½¹™¥É´¡•¹Ø°ˆ¹•µ…¥°°‘¸°Í•Ì¹¹…µ”ñðˆ¹Í•ÍÍ¥½¹%°¥°µ•Ñ„¹Ñ½Ñ…°°µ•Ñ„¹ÍÑ…±±½Õ¹Ð°µ•Ñ„¹Í•±•Ñ•‘…Ñ•Ì°ˆ¹•ÅÕ¥Àñðíô°ÑI•œ¤ì(€€€€€€¼¼ƒ–7–¾§š‚ãšr–N‡–‚Ç–B7¦r–¾§š‚ãžj–‚Óš²‡šržnÓš:—¦2–>[¾ò3–þ¦‚#’â’ö×–¾¦2–>[’þ‡¾ò3–B›–&šR“–>/š.ÿ’â7–"ÃžæÏ¢Êïš2–òWŽ(€€€€€¥˜€¡µ•Ñ„¹¹••‘I•Ù¥•Ü€˜˜µ•Ñ„¹™…ÍÑA…ÍÌ¤ì(€€€€€€€…Ý…¥Ðµ…¥±ÁÁÉ½Ù…°¡•¹Ø°ˆ¹•µ…¥°°‘¸°Í•Ì¹¹…µ”ñðˆ¹Í•ÍÍ¥½¹%°¥°µ•Ñ„¹Ñ½Ñ…°°µ•Ñ„¹ÍÑ…±±½Õ¹Ð°µ•Ñ„¹Í•±•Ñ•‘…Ñ•Ì°ˆ¹•ÅÕ¥Àñðíô°Í•Ì¹‰…Í¥}•ÅÕ¥Àñð€œœ°ÑI•œ¤ì(€€€€€ô(€€€ô…Ñ ¡”¤ì(€€€€€½¹Í½±”¹•ÉÉ½È µ…¥±I•½¹™¥É´…™Ñ•ÈÉ•¥ÍÑ•È™…¥±•èœ°”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€èMÑÉ¥¹œ¡”¤¤ì±½ÉÉ½È¡•¹Ø°íÍ½ÕÉ”è™¥¹…±¥é•I•¥ÍÑÉ…Ñ¥½¸œ°µ•ÍÍ…”èµ…¥±I•½¹™¥É´…™Ñ•ÈÉ•¥ÍÑ•È™…¥±•èœ°•ÉÉ½Èé”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€èMÑÉ¥¹œ¡”¥ô¤ì(€€€ô(€ôì(€¥˜€¡Ñà€˜˜ÑåÁ•½˜Ñà¹Ý…¥ÑU¹Ñ¥°€ôôô€™Õ¹Ñ¥½¸œ¤Ñà¹Ý…¥ÑU¹Ñ¥°¡Í•¹‘½¹™¥Éµ5…¥° ¤¤ì(€•±Í”Í•¹‘½¹™¥Éµ5…¥° ¤ì)ô((¼¼ƒš&û–ë¦g–,µ…¥°ƒ–r£š~C–‚Óš²‡Ž3¦
šr'šV#Ž7žjš^‹šr'–‚Ç–B7¾ò#–ÞË–>[šÚ#¾ò?’â7¦2–>[¾ò?–ÞË¦¢Êìƒ¢š[ž
ëžÖCšv¾ò3’â7žº_¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸™¥¹‘Ñ¥Ù•I•½ÉM•ÍÍ¥½¸¡•¹Ø°Q99P°Í•ÍÍ¥½¹%°•µ…¥°°‰É…¹‘%ôœœ¤ì(€½¹ÍÐ•á±Õ‘”€ô•¹½‘•UI%½µÁ½¹•¹Ð Ÿ’â7¦2–>Xœ¤€¬€œ°œ€¬•¹½‘•UI%½µÁ½¹•¹Ð Ÿ–ÞË–>[šÚ œ¤ì(€½¹ÍÐ½Ý¹•É¥±Ñ•Èõ‰É…¹‘%ý‰É…¹‘}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡‰É…¹‘%¥õ€é•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡•µ…¥°¥õ€ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°(€€€Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô˜‘í½Ý¹•É¥±Ñ•Éô™É•Ù¥•Ý}ÍÑ…ÑÕÌõ¹½Ð¹¥¸¸ ‘í•á±Õ‘•ô¤™Í•±•Ðô©€(€€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐ±¥Ù”€ôÉ½ÝÌ¹™¥±Ñ•È¡È€ôøì(€€€½¹ÍÐÑÌ€ôMÑÉ¥¹œ¡È¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌñð€œœ¤¹ÑÉ¥´ ¤ì(€€€É•ÑÕÉ¸ÑÌ€„ôô€Ÿ–ÞË¦¢Êìœ€˜˜ÑÌ€„ôô€Ÿ–ÞË¦š²øœì(€ô¤ì(€É•ÑÕÉ¸±¥Ù”¹±•¹Ñ €ü±¥Ù•lÁt€è¹Õ±°ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡I•¥ÍÑ•É	Õ¹‘±”¡•¹Ø±ˆ±Ñà¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì(€ˆ¹•µ…¥°õ¹½Éµµ…¥°¡ˆ¹•µ…¥°¤íˆ¹Á¡½¹”õ¹½ÉµA¡½¹”¡ˆ¹Á¡½¹”¤ì(€¥˜ …ˆ¹•µ…¥±ñð…ˆ¹Á¡½¹”¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–†¯–¾¬µ…¥°ƒ¢"š&/š¦|œ¤ì(€½¹ÍÐµ•µ‰•ÉY•É¥™¥•õ…Ý…¥ÐÙ•É¥™¥•‘A±…Ñ™½Éµ5•µ‰•È¡•¹Ø±ˆ¹µ•µ‰•É}Ñ½­•¹ññˆ¹µ•µ‰•ÉQ½­•¸¤ì(€¥˜ …µ•µ‰•ÉY•É¥™¥•‘ñð…Á±…Ñ™½Éµ5•µ‰•É½µÁ±•Ñ”¡µ•µ‰•ÉY•É¥™¥•¹É½Ü¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–#žfï–—’â›–º3š"@=%9ƒšr–N‡¢ÎšZdœ¤ì(€¥˜¡Á±…Ñ™½Éµ½¹Ñ…Ñµ…¥°¡µ•µ‰•ÉY•É¥™¥•¹É½Ü¤„ôõˆ¹•µ…¥±ñð…Á¡½¹•5…Ñ¡•Ì¡µ•µ‰•ÉY•É¥™¥•¹É½Ü¹Á¡½¹”±ˆ¹Á¡½¹”¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–‚Ç–B7¢¿žÖ‡¢ÎšZg–þ¦‚#¢"žfï–—’â·žjšr–N‡¢ÎšZg’â¢Ðœ¤ì(€ˆ¹Á±…Ñ™½Éµ5•µ‰•É%õMÑÉ¥¹œ¡µ•µ‰•ÉY•É¥™¥•¹É½Ü¹¥‘ñðœœ¤ì(€½¹ÍÐ‰É…¹‘I•Í½±ÕÑ¥½¸õ…Ý…¥Ð•¹ÍÕÉ•I•¥ÍÑÉ…Ñ¥½¹	É…¹¡•¹Ø±ˆ¹Á±…Ñ™½Éµ5•µ‰•É%±ˆ¤í¥˜¡‰É…¹‘I•Í½±ÕÑ¥½¸¹•ÉÉ½È¥É•ÑÕÉ¸©Í½¹ÉÈ¡‰É…¹‘I•Í½±ÕÑ¥½¸¹•ÉÉ½È¤íˆ¹‰É…¹‘%õ‰É…¹‘I•Í½±ÕÑ¥½¸¹‰É…¹‘%‘ñðœœì(€½¹ÍÐ‰Õ¹‘±•%õMÑÉ¥¹œ¡ˆ¹‰Õ¹‘±•%‘ñðœœ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹}‰Õ¹‘±•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡‰Õ¹‘±•%¥ô™…Ñ¥Ù”õ•Ä¹ÑÉÕ”™Í•±•Ðô©€¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–§–‚ÓžÖ–B#šZçš† œ¤ì(€½¹ÍÐ‰Õ¹‘±”õÉ½ÝÍlÁt±Í¥‘ÌõMÑÉ¥¹œ¡‰Õ¹‘±”¹Í•ÍÍ¥½¹}¥‘Íñðœœ¤¹ÍÁ±¥Ð œ°œ¤¹µ…À¡àôùà¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€¥˜¡Í¥‘Ì¹±•¹Ñ „ôôÈ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“šZçš†#’â7šb¿šr'šV#žj–§–‚ÓžÖ–B œ¤ì(€½¹ÍÐÍ•ÍÍ¥½¹Ìõmtì(€™½È¡½¹ÍÐÍ¥½˜Í¥‘Ì¥ì(€€€½¹ÍÐÍ•Ìõ…Ý…¥Ð•ÑM•ÍÍ¥½¹I½Ü¡•¹Ø±Í¥±P¤ì(€€€¥˜ …‰Õ¹‘±•M•ÍÍ¥½¹½µÁ…Ñ¥‰±”¡Í•Ì¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–§–‚ÓžÖ–B#–>«šR¿š>Ó–§–/–ÞË¦Z/šRûŽ–B¢«š^—šršb;žŠë’âS–>¿–ÇžR£–B3’â–ò×¢†£–Z»žj–‚Óš²„œ¤ì(€€€Í•ÍÍ¥½¹Ì¹ÁÕÍ ¡Í•Ì¤ì(€€€½¹ÍÐ•á¥ÍÑ¥¹œõ…Ý…¥Ð™¥¹‘Ñ¥Ù•I•½ÉM•ÍÍ¥½¸¡•¹Ø±P±Í¥±ˆ¹•µ…¥°±ˆ¹‰É…¹‘%¤ì(€€€¥˜¡•á¥ÍÑ¥¹œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–§–‚ÓžÖ–B#–þ¦‚#’âš²‡’â¢Öß–‚Ç–B7¾òoš
£–ÞËžÚOšr'–Û’â·’â–‚Óžjšr'šV#–‚Ç–B7¾ò3’â7¢÷’ê/–ú3’ö×š"CžÖ–B#–äœ¤ì(€ô(€€¼¼ƒ’â¢Öß’îcš²ûžj–&7š>C¾òk–§–‚Ó–þ¦‚#’öÿžR£–B3’â–/š¶–ò?šRÛš²û¢¢·–ºkŽ(€±•ÐÁÉ½™¥±•%ôœœì(€™½È¡½¹ÍÐÍ•Ì½˜Í•ÍÍ¥½¹Ì¥ì(€€€½¹ÍÐÁÉ½˜õ…Ý…¥Ð}É•Í½±Ù•A…åµ•¹ÑAÉ½™¥±•½ÉM•ÍÍ¥½¸¡•¹Ø±P±Í•Ì¤ì(€€€½¹ÍÐÁ¥õMÑÉ¥¹œ¡ÁÉ½˜ü¹¥‘ñðœœ¤ì(€€€¥˜ …ÁÉ½™¥±•%¥ÁÉ½™¥±•%õÁ¥ì(€€€•±Í”¥˜¡ÁÉ½™¥±•%„ôõÁ¥¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–§–‚ÓžjšRÛš²û–âÏš"Û’â7–B3¾ò3’â7¢÷–îëž®/¦r¢š’â¢Öß’îcš²ûžjžÖ–B#šZçš† œ¤ì(€ô((€½¹ÍÐÉ½ÕÁ%õ•¹% 	I@œ¤±‰Õ¹‘±•Q½Ñ…°õ5…Ñ ¹µ…à À±Í…™•9Õ´¡‰Õ¹‘±”¹‰Õ¹‘±•}ÁÉ¥”¤¤ì(€½¹ÍÐ™¥ÉÍÑM¡…É”õ5…Ñ ¹•¥°¡‰Õ¹‘±•Q½Ñ…°¼È¤±Í•½¹‘M¡…É”õ‰Õ¹‘±•Q½Ñ…°µ™¥ÉÍÑM¡…É”ì(€½¹ÍÐÍ¡…É•Ìõm™¥ÉÍÑM¡…É”±Í•½¹‘M¡…É•t±ÁÉ•ÁÌõmtì((€€¼¼ƒ–§–‚Ó¦÷–#–º3šVÓ¢¦›žº_¾òo’îï’â–‚Ó–’ÇšV_¾ò3’â7–¾¯¢ÎšZgŽ(€™½È¡±•Ð¤ôÀí¤ðÈí¤¬¬¥ì(€€€½¹ÍÐÍ•ÌõÍ•ÍÍ¥½¹Ím¥t±Í¥õÍ¥‘Ím¥tì(€€€½¹ÍÐ‘…Ñ•Ìõ}Í•ÍÍ¥½¹…Ñ•I½ÝÌ¡Í•Ì¹‘…Ñ•Í}©Í½¸¤¹µ…À¡àôùà¹‘…Ñ”¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€€€½¹ÍÐ‰ˆõì¸¸¹ˆ±Í•ÍÍ¥½¹%éÍ¥±‰Õ¹‘±•%±‰Õ¹‘±•É½ÕÁ%éÉ½ÕÁ%±‰Õ¹‘±••”éÍ¡…É•Ím¥t°(€€€€€Í•±•Ñ•‘…Ñ•Ìé‘…Ñ•Ì±Ñ¥µ•Í±½Ñ%‘Ìémt±¥‘•µÁ½Ñ•¹å-•äéMÑÉ¥¹œ¡ˆ¹¥‘•µÁ½Ñ•¹å-•åñðœœ¤¬œèœ­Í¥‘ôì(€€€½¹ÍÐÁÉ•Àõ…Ý…¥ÐÁÉ•Á…É•I•¥ÍÑÉ…Ñ¥½¸¡•¹Ø±‰ˆ¤ì(€€€¥˜¡ÁÉ•À¹•ÉÉ½È¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–§–‚ÓžÖ–B#–‚Ç–B7–’ÇšV_¾òhœ­ÁÉ•À¹•ÉÉ½È¤ì(€€€ÁÉ•ÁÌ¹ÁÕÍ ¡í‰ˆ±ÁÉ•Áô¤ì(€ô((€€¼¼ƒ–B3’â–,A½ÍÑÉ•ME0ÑÉ…¹Í…Ñ¥½¸ƒ¦:[–§–/–‚Óš²‡–B7¦†7¾ò/–¾¯–—–§ž¶É•¥ÍÑÉ…Ñ¥½¹ÏŽ(€±•ÐÉ•Ìì(€ÑÉåì(€€€É•Ìõ…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•…Ñ•}‰Õ¹‘±•}É•¥ÍÑÉ…Ñ¥½¹Í}…Ñ½µ¥Œœ±ì(€€€€€Á}Ñ•¹…¹Ñ}¥éP±Á}‰Õ¹‘±•}É½ÕÁ}¥éÉ½ÕÁ%±Á}É½ÝÌéÁÉ•ÁÌ¹µ…À¡àôùà¹ÁÉ•À¹É½Ü¤±Á}µ•É•Ìémt(€€€ô¤ì(€õ…Ñ ¡”¥ì(€€€±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è¡I•¥ÍÑ•É	Õ¹‘±”œ±Ñ•¹…¹Ñ%éP±µ•ÍÍ…”è‰Õ¹‘±”…Ñ½µ¥Œ™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–§–‚ÓžÖ–B#–‚Ç–B7–’ÇšV_¾ò3šr«–îëž®/’îï’öW–‚Ç–B7¾òhœ¬ ¡”˜™”¹µ•ÍÍ…”¥ñðŸ¢ÎšZg–ê¯’ê“šbO–’ÇšV\œ¤¤ì(€ô(€¥˜ …É•ÍññÉ•Ì¹½¬ôôõ™…±Í”¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–§–‚ÓžÖ–B#–‚Ç–B7–’ÇšV_¾ò3šr«–îëž®/’îï’öW–‚Ç–B7¾òhœ¬ ¡É•Ì˜™É•Ì¹•ÉÉ½È¥ñðŸ–B7¦†7’â7¢ÚÌœ¤¤ì((€€¼¼ƒ–§–‚Ð™¥¹…¹”¥Ñ•µÌ€¼¥¹Ù½¥”ƒ–#–£¦£–îëž®/š"C–*¾ò3š&7¦Ë–—šr–N‡–B3š¶—¢"–¾’þ‡Ž(€ÑÉåì(€€€™½È¡½¹ÍÐí‰ˆ±ÁÉ•Áô½˜ÁÉ•ÁÌ¥ì(€€€€€…Ý…¥Ð•¹ÍÕÉ•I•¥ÍÑÉ…Ñ¥½¹MÕ‰µ¥ÑÑ•È¡•¹Ø±P±ÁÉ•À¹¥±ˆ¹Á±…Ñ™½Éµ5•µ‰•É%±ˆ¹‰É…¹‘%¤ì(€€€€€…Ý…¥ÐÉ•…Ñ•I•¥ÍÑÉ…Ñ¥½¹¥¹…¹•I•½É‘Ì¡•¹Ø±P±ÁÉ•À¹¥±‰ˆ¹Í•ÍÍ¥½¹%±‰ˆ¹•µ…¥°°(€€€€€€€ÁÉ•À¹µ•Ñ„¹™•”±ÁÉ•À¹µ•Ñ„¹‘•Á½Í¥Ð±ÁÉ•À¹µ•Ñ„¹•ÅÕ¥ÁQ½Ñ…°±ÁÉ•À¹µ•Ñ„¹…‘‘½¹Q½Ñ…°±ì(€€€€€€€€€¥¹Ù½¥•}ÍÑ…ÑÕÌéÁÉ•À¹µ•Ñ„¹¥¹Ù½¥•MÑ…ÑÕÌ±¥¹Ù½¥•}ÑåÁ”é‰ˆ¹¥¹Ù½¥•QåÁ•ñðœœ±¥¹Ù½¥•}Ñ¥Ñ±”é‰ˆ¹¥¹Ù½¥•Q¥Ñ±•ñðœœ°(€€€€€€€€€Ñ…á}¥é‰ˆ¹Ñ…á%‘ñðœœ±¥¹Ù½¥•}•µ…¥°é‰ˆ¹¥¹Ù½¥•µ…¥±ñðœœ±¥¹Ù½¥•}…ÉÉ¥•Èé‰ˆ¹¥¹Ù½¥•…ÉÉ¥•Éñðœœ(€€€€€€€ô¤ì(€€€ô(€õ…Ñ ¡”¥ì(€€€™½È¡½¹ÍÐí‰ˆ±ÁÉ•Áô½˜ÁÉ•ÁÌ¥ì(€€€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°¥¹Ù½¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÁÉ•À¹¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÁÉ•À¹¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÁÉ•À¹¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€€€…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Í•ÍÍ¥½¹}Í±½Ðœ±íÁ}Ñ•¹…¹Ñ}¥éP±Á}Í•ÍÍ¥½¹}¥é‰ˆ¹Í•ÍÍ¥½¹%±Á}ÍÑ…±±}½Õ¹ÐéÁÉ•À¹µ•Ñ„¹ÍÑ…±±½Õ¹Ñô¤¹…Ñ   ¤ôùíô¤ì(€€€ô(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–§–‚ÓžÖ–B#¢Ê‡–.g¢ÎšZg–îëž®/–’ÇšV_¾ò3šVÓžÖ–‚Ç–B7¢"–B7¦†7–ÞË–n{–ú§¾òhœ¬¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸ¢ÎšZg–¾¯–—–’ÇšV\œ¤¤ì(€ô(€™½È¡½¹ÍÐí‰ˆ±ÁÉ•Áô½˜ÁÉ•ÁÌ¥ì(€€€…Ý…¥Ð™¥¹…±¥é•I•¥ÍÑÉ…Ñ¥½¸¡•¹Ø±P±‰ˆ±ÁÉ•À¹Í•Ì±ÁÉ•À¹¥±ÁÉ•À¹µ•Ñ„±Ñà±íÍ­¥Á¥¹…¹”éÑÉÕ•ô¤ì(€€€…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±P±‰ˆ¹Í•ÍÍ¥½¹%¤ì(€€€½¹ÍÐ…ÑÑÉ¥‰ÕÑ¥½¹)½ˆõÉ•½É‘I•¥ÍÑÉ…Ñ¥½¹ÑÑÉ¥‰ÕÑ¥½¸¡•¹Ø±P±‰ˆ±ÁÉ•À¹¥±‰ˆ¹Í•ÍÍ¥½¹%¤¹…Ñ ¡”ôù±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”èÉ•½É‘I•¥ÍÑÉ…Ñ¥½¹ÑÑÉ¥‰ÕÑ¥½¸œ±Ñ•¹…¹Ñ%éP±Í•ÍÍ¥½¹%é‰ˆ¹Í•ÍÍ¥½¹%±É•%éÁÉ•À¹¥±µ•ÍÍ…”è‰Õ¹‘±”…ÑÑÉ¥‰ÕÑ¥½¸™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤¤ì(€€€¥˜¡Ñà˜™ÑåÁ•½˜Ñà¹Ý…¥ÑU¹Ñ¥°ôôô™Õ¹Ñ¥½¸œ¥Ñà¹Ý…¥ÑU¹Ñ¥°¡…ÑÑÉ¥‰ÕÑ¥½¹)½ˆ¤í•±Í”…ÑÑÉ¥‰ÕÑ¥½¹)½ˆì(€ô((€É•ÑÕÉ¸©Í½¹=¬¡ì(€€€ÍÕ•ÍÌéÑÉÕ”±‰Õ¹‘±•É½ÕÁ%éÉ½ÕÁ%±½Õ¹ÐèÈ±‰Õ¹‘±•AÉ¥”é‰Õ¹‘±•Q½Ñ…°±‘Õ•Q½Ñ…°éÁÉ•ÁÌ¹É•‘Õ” ¡¸±à¤ôù¸­à¹ÁÉ•À¹µ•Ñ„¹Ñ½Ñ…°°À¤°(€€€É•¥ÍÑÉ…Ñ¥½¹ÌéÁÉ•ÁÌ¹µ…À ¡à±¤¤ôø¡ì(€€€€€¥éà¹ÁÉ•À¹¥±Í•ÍÍ¥½¹%éà¹‰ˆ¹Í•ÍÍ¥½¹%±Í•ÍÍ¥½¹9…µ”éà¹ÁÉ•À¹Í•Ì¹¹…µ•ññà¹‰ˆ¹Í•ÍÍ¥½¹%°(€€€€€‰Õ¹‘±•••M¡…É”éÍ¡…É•Ím¥t±‘•Á½Í¥Ðéà¹ÁÉ•À¹µ•Ñ„¹‘•Á½Í¥Ð±•ÅÕ¥Áµ•¹Ðéà¹ÁÉ•À¹µ•Ñ„¹•ÅÕ¥ÁQ½Ñ…°°(€€€€€…‘‘½¸éà¹ÁÉ•À¹µ•Ñ„¹…‘‘½¹Q½Ñ…°±Ñ½Ñ…°éà¹ÁÉ•À¹µ•Ñ„¹Ñ½Ñ…°±ÍÑ…ÑÕÌéà¹ÁÉ•À¹µ•Ñ„¹ÍÑ…ÑÕÌ(€€€ô¤¤(€ô¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡I•¥ÍÑ•È¡•¹Ø°ˆ°Ñà¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€½¹ÍÐµ•µ‰•ÉY•É¥™¥•õ…Ý…¥ÐÙ•É¥™¥•‘A±…Ñ™½Éµ5•µ‰•È¡•¹Ø±ˆ¹µ•µ‰•É}Ñ½­•¹ññˆ¹µ•µ‰•ÉQ½­•¸¤ì(€¥˜ …µ•µ‰•ÉY•É¥™¥•‘ñð…Á±…Ñ™½Éµ5•µ‰•É½µÁ±•Ñ”¡µ•µ‰•ÉY•É¥™¥•¹É½Ü¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–#žfï–—’â›–º3š"@=%9ƒšr–N‡¢ÎšZdœ¤ì(€¥˜¡Á±…Ñ™½Éµ½¹Ñ…Ñµ…¥°¡µ•µ‰•ÉY•É¥™¥•¹É½Ü¤„ôõ¹½Éµµ…¥°¡ˆ¹•µ…¥°¥ñð…Á¡½¹•5…Ñ¡•Ì¡µ•µ‰•ÉY•É¥™¥•¹É½Ü¹Á¡½¹”±ˆ¹Á¡½¹”¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–‚Ç–B7¢¿žÖ‡¢ÎšZg–þ¦‚#¢"žfï–—’â·žjšr–N‡¢ÎšZg’â¢Ðœ¤ì(€ˆ¹Á±…Ñ™½Éµ5•µ‰•É%õMÑÉ¥¹œ¡µ•µ‰•ÉY•É¥™¥•¹É½Ü¹¥‘ñðœœ¤ì(€½¹ÍÐ‰É…¹‘I•Í½±ÕÑ¥½¸õ…Ý…¥Ð•¹ÍÕÉ•I•¥ÍÑÉ…Ñ¥½¹	É…¹¡•¹Ø±ˆ¹Á±…Ñ™½Éµ5•µ‰•É%±ˆ¤í¥˜¡‰É…¹‘I•Í½±ÕÑ¥½¸¹•ÉÉ½È¥É•ÑÕÉ¸©Í½¹ÉÈ¡‰É…¹‘I•Í½±ÕÑ¥½¸¹•ÉÉ½È¤íˆ¹‰É…¹‘%õ‰É…¹‘I•Í½±ÕÑ¥½¸¹‰É…¹‘%‘ñðœœì(€½¹ÍÐÁÉ•À€ô…Ý…¥ÐÁÉ•Á…É•I•¥ÍÑÉ…Ñ¥½¸¡•¹Ø°ˆ¤ì(€¥˜€¡ÁÉ•À¹•ÉÉ½È¤É•ÑÕÉ¸©Í½¹ÉÈ¡ÁÉ•À¹•ÉÉ½È¤ì(€½¹ÍÐìÍ•Ì°¥°É½Ü°µ•Ñ„ô€ôÁÉ•Àì((€€¼¼4´ÀÇ¾òi¥¹Í•ÉÐƒ’æ/–&7–:–¶C¦:[–ºk–B7¦†7Ž(€€¼¼´À×¾òk¢"+–¾¯šÎT¥˜€ …ˆ¹‰Õ¹‘±•É½ÕÁ%€˜˜±…¥´ƒ–’ÇšV\¤ƒšr¢ºO––_žÖš–ŠžV—¦;¦g¦Ošª‹š~—Ž	±…¥´ƒ–’ÇšV_šÂã¦ƒ¢ššN/Ž(€½¹ÍÐ±…¥µ•‘M±½Ñ%‘Ìõmtì(€™½È¡½¹ÍÐÑÍ¥½˜€¡µ•Ñ„¹Ñ¥µ•Í±½Ñ%‘Íññmt¤¥ì(€€€½¹ÍÐÑÌõ…Ý…¥Ð‘‰IÁŒ¡•¹Ø°±…¥µ}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}Ñ¥µ•Í±½Ñ}¥éÑÍ¥±Á}ÅÑäéµ•Ñ„¹ÍÑ…±±½Õ¹Ñô¤ì(€€€¥˜ …ÑÍññÑÌ¹½¬ôôõ™…±Í”¥í™½È¡½¹ÍÐà½˜±…¥µ•‘M±½Ñ%‘Ì¥…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}Ñ¥µ•Í±½Ñ}¥éà±Á}ÅÑäéµ•Ñ„¹ÍÑ…±±½Õ¹Ñô¤¹…Ñ   ¤ôùíô¤íÉ•ÑÕÉ¸©Í½¹ÉÈ¡ÑÌü¡ÑÌ¹•ÉÉ½ÉñðŸš¶“šfšº×–B7¦†7’â7¢ÚÌœ¤èŸšfšº×–B7¦†7¦:[–ºk–’ÇšV\œ¥ô(€€€±…¥µ•‘M±½Ñ%‘Ì¹ÁÕÍ ¡ÑÍ¥¤ì(€ô(€½¹ÍÐ±…¥µI•ÍÕ±Ð€ôµ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ñ%€ü…Ý…¥Ð‘‰IÁŒ¡•¹Ø°±…¥µ}½Á•É…Ñ¥½¹}Õ¹¥Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éµ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ñ%±Á}ÅÑäéµ•Ñ„¹ÍÑ…±±½Õ¹Ñô¤€è…Ý…¥Ð‘‰IÁŒ¡•¹Ø°€±…¥µ}Í•ÍÍ¥½¹}Í±½Ðœ°ì(€€€Á}Ñ•¹…¹Ñ}¥èQ99P°Á}Í•ÍÍ¥½¹}¥èˆ¹Í•ÍÍ¥½¹%°Á}ÍÑ…±±}½Õ¹Ðèµ•Ñ„¹ÍÑ…±±½Õ¹Ð(€ô¤ì(€¥˜€ …±…¥µI•ÍÕ±Ðñð±…¥µI•ÍÕ±Ð¹½¬€ôôô™…±Í”¤ì(€€€™½È¡½¹ÍÐà½˜±…¥µ•‘M±½Ñ%‘Ì¥…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}Ñ¥µ•Í±½Ñ}¥éà±Á}ÅÑäéµ•Ñ„¹ÍÑ…±±½Õ¹Ñô¤¹…Ñ   ¤ôùíô¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ¡±…¥µI•ÍÕ±Ð€ü€¡±…¥µI•ÍÕ±Ð¹•ÉÉ½Èñð€Ÿ–B7¦†7’â7¢ÚÌœ¤€è€Ÿ–B7¦†7¦:[–ºk–’ÇšV_¾ò3¢®/ž¢7–ú3–7¢¦˜œ¤ì(€ô((€ÑÉäì(€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°É½Ü¤ì(€€€…Ý…¥Ð•¹ÍÕÉ•I•¥ÍÑÉ…Ñ¥½¹MÕ‰µ¥ÑÑ•È¡•¹Ø±Q99P±¥±ˆ¹Á±…Ñ™½Éµ5•µ‰•É%±ˆ¹‰É…¹‘%¤ì(€ô…Ñ ¡”¤ì(€€€½¹Í½±”¹•ÉÉ½È %9MIPÉ•¥ÍÑÉ…Ñ¥½¹Ì™…¥±•èœ°”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€è”¤ì±½ÉÉ½È¡•¹Ø°íÍ½ÕÉ”è¡I•¥ÍÑ•Èœ°µ•ÍÍ…”è%9MIPÉ•¥ÍÑÉ…Ñ¥½¹Ì™…¥±•èœ°•ÉÉ½Èé”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€è•ô¤ì(€€€€¼¼%`´ÀË¾òiÉ•¥ÍÑÉ…Ñ¥½¹Ìƒ–¾¯–—–’ÇšV_¾ò3š*+–B7¦†7¢"šfšº×¦÷¦
–n{–:ì(€€€™½È¡½¹ÍÐà½˜±…¥µ•‘M±½Ñ%‘Ì¥ÑÉåí…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}Ñ¥µ•Í±½Ñ}¥éà±Á}ÅÑäéµ•Ñ„¹ÍÑ…±±½Õ¹Ñô¥õ…Ñ ¡}”¥íô(€€€ÑÉäì(€€€€€¥˜¡µ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ñ%¥…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}½Á•É…Ñ¥½¹}Õ¹¥Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éµ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ñ%±Á}ÅÑäéµ•Ñ„¹ÍÑ…±±½Õ¹Ñô¤ì(€€€€€•±Í”…Ý…¥Ð‘‰IÁŒ¡•¹Ø°€É•±•…Í•}Í•ÍÍ¥½¹}Í±½Ðœ°ì(€€€€€€€Á}Ñ•¹…¹Ñ}¥èQ99P°Á}Í•ÍÍ¥½¹}¥èˆ¹Í•ÍÍ¥½¹%°Á}ÍÑ…±±}½Õ¹Ðèµ•Ñ„¹ÍÑ…±±½Õ¹Ð(€€€€€ô¤ì(€€€ô…Ñ ¡É”¤ì½¹Í½±”¹•ÉÉ½È É•±•…Í•}Í•ÍÍ¥½¹}Í±½Ð™…¥±•…™Ñ•ÈÉ•¥ÍÑ•È•ÉÉ½Èœ°É”˜™É”¹µ•ÍÍ…”¤ì±½ÉÉ½È¡•¹Ø°íÍ½ÕÉ”è¡I•¥ÍÑ•Èœ°µ•ÍÍ…”èÉ•±•…Í•}Í•ÍÍ¥½¹}Í±½Ð™…¥±•…™Ñ•ÈÉ•¥ÍÑ•È•ÉÉ½Èœ°•ÉÉ½ÈéÉ”˜™É”¹µ•ÍÍ…•ô¤ìô(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–‚Ç–B7–îëž®/–’ÇšV_¾ò3¢®/ž¢7–ú3–7¢¦›¾ò#–B7¦†7–ÞË¦/šRû¾ò$œ¤ì(€ô((€ÑÉåì(€€€…Ý…¥Ð™¥¹…±¥é•I•¥ÍÑÉ…Ñ¥½¸¡•¹Ø±Q99P±ˆ±Í•Ì±¥±µ•Ñ„±Ñà¤ì(€õ…Ñ ¡”¥ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°¥¹Ù½¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€™½È¡½¹ÍÐà½˜±…¥µ•‘M±½Ñ%‘Ì¥…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}Ñ¥µ•Í±½Ñ}¥éà±Á}ÅÑäéµ•Ñ„¹ÍÑ…±±½Õ¹Ñô¤¹…Ñ   ¤ôùíô¤ì(€€€¥˜¡µ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ñ%¥…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}½Á•É…Ñ¥½¹}Õ¹¥Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éµ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ñ%±Á}ÅÑäéµ•Ñ„¹ÍÑ…±±½Õ¹Ñô¤¹…Ñ   ¤ôùíô¤ì(€€€•±Í”…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Í•ÍÍ¥½¹}Í±½Ðœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}Í•ÍÍ¥½¹}¥éˆ¹Í•ÍÍ¥½¹%±Á}ÍÑ…±±}½Õ¹Ðéµ•Ñ„¹ÍÑ…±±½Õ¹Ñô¤¹…Ñ   ¤ôùíô¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–‚Ç–B7¢Ê‡–.g¢ÎšZg–îëž®/–’ÇšV_¾ò3šr³š²‡–‚Ç–B7¢"–B7¦†7–ÞË–n{–ú§¾òhœ¬¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸ¢ÎšZg–¾¯–—–’ÇšV\œ¤¤ì(€ô(€½¹ÍÐ…ÑÑÉ¥‰ÕÑ¥½¹)½ˆõÉ•½É‘I•¥ÍÑÉ…Ñ¥½¹ÑÑÉ¥‰ÕÑ¥½¸¡•¹Ø±Q99P±ˆ±¥±ˆ¹Í•ÍÍ¥½¹%¤¹…Ñ ¡”ôù±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”èÉ•½É‘I•¥ÍÑÉ…Ñ¥½¹ÑÑÉ¥‰ÕÑ¥½¸œ±Ñ•¹…¹Ñ%éQ99P±Í•ÍÍ¥½¹%éˆ¹Í•ÍÍ¥½¹%±É•%é¥±µ•ÍÍ…”èÉ•¥ÍÑÉ…Ñ¥½¸…ÑÑÉ¥‰ÕÑ¥½¸™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤¤ì(€¥˜¡Ñà˜™ÑåÁ•½˜Ñà¹Ý…¥ÑU¹Ñ¥°ôôô™Õ¹Ñ¥½¸œ¥Ñà¹Ý…¥ÑU¹Ñ¥°¡…ÑÑÉ¥‰ÕÑ¥½¹)½ˆ¤í•±Í”…ÑÑÉ¥‰ÕÑ¥½¹)½ˆì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±½¬éÑÉÕ”±¥±ÍÑ…ÑÕÌéµ•Ñ„¹ÍÑ…ÑÕÌ±Ñ½Ñ…°éµ•Ñ„¹Ñ½Ñ…°±½Á•É…Ñ¥½¹U¹¥Ñ%éµ•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ñ%‘ñðœœ±‰•¹•™¥Ðéµ•Ñ„¹‰•¹•™¥Ñññ¹Õ±°±É•Ý…É‘	…±…¹”é…Ý…¥ÐÉ•Ý…É‘	…±…¹”¡•¹Ø±Q99P±ˆ¹•µ…¥°¥ô¤ì)ô(()…Íå¹Œ™Õ¹Ñ¥½¸É•…Ñ•I•¥ÍÑÉ…Ñ¥½¹¥¹…¹•I•½É‘Ì¡•¹Ø°Q99P°É•%°Í•ÍÍ¥½¹%°•µ…¥°°™•”°‘•Á½Í¥Ð°•ÅÕ¥ÁQ½Ñ…°°…‘‘½¹Q½Ñ…°°¥¹Ù½¥•A…å±½…°™¥¹…¹•5•Ñ„õíô¤ì(€½¹ÍÐ¥Ñ•µÌ€ômt±Õ¥õMÑÉ¥¹œ¡™¥¹…¹•5•Ñ„¹½Á•É…Ñ¥½¹U¹¥Ñ%‘ñðœœ¥ññ¹Õ±°±É½ÍÍ•”õ5…Ñ ¹µ…à¡Í…™•9Õ´¡™•”¤±Í…™•9Õ´¡™¥¹…¹•5•Ñ„¹É½ÍÍ•”¤¤ì(€¥˜€¡É½ÍÍ•”€ø€À¤¥Ñ•µÌ¹ÁÕÍ ¡í¥é•¹% %Q4œ¤°É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•%°½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÕ¥°¥Ñ•µ}ÑåÁ”èÍÑ…±±}™•”œ°¥Ñ•µ}¹…µ”èŸ–‚Ç–B7¢Êï¾ò?šR“’ö7¢Êìœ°ÅÕ…¹Ñ¥ÑäèÄ°Õ¹¥Ñ}ÁÉ¥”éÉ½ÍÍ•”°…µ½Õ¹ÐéÉ½ÍÍ•”°¹½Ñ”èÑ…á}¥¹±Õ‘•ô¤ì(€½¹ÍÐ‘¥Í½Õ¹Ðõ5…Ñ ¹µ…à À±É½ÍÍ•”µÍ…™•9Õ´¡™•”¤¤ì(€¥˜¡‘¥Í½Õ¹ÐøÀ¥¥Ñ•µÌ¹ÁÕÍ ¡í¥é•¹% %Q4œ¤±É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•%±½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÕ¥±¥Ñ•µ}ÑåÁ”è‘¥Í½Õ¹Ðœ±¥Ñ•µ}¹…µ”èŸ–«šƒ¾ò?–n{¦–/š*cš*Ôœ±ÅÕ…¹Ñ¥ÑäèÄ±Õ¹¥Ñ}ÁÉ¥”èµ‘¥Í½Õ¹Ð±…µ½Õ¹Ðèµ‘¥Í½Õ¹Ð±¹½Ñ”èÑ…á}¥¹±Õ‘•ô¤ì(€¥˜€¡Í…™•9Õ´¡‘•Á½Í¥Ð¤€ø€À¤¥Ñ•µÌ¹ÁÕÍ ¡í¥é•¹% %Q4œ¤°É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•%°½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÕ¥°¥Ñ•µ}ÑåÁ”è‘•Á½Í¥Ðœ°¥Ñ•µ}¹…µ”èŸš*ó¦Dœ°ÅÕ…¹Ñ¥ÑäèÄ°Õ¹¥Ñ}ÁÉ¥”éÍ…™•9Õ´¡‘•Á½Í¥Ð¤°…µ½Õ¹ÐéÍ…™•9Õ´¡‘•Á½Í¥Ð¤°¹½Ñ”è•á±Õ‘•}™É½µ}¥¹Ù½¥”ô¤ì(€¥˜€¡Í…™•9Õ´¡•ÅÕ¥ÁQ½Ñ…°¤€ø€À¤¥Ñ•µÌ¹ÁÕÍ ¡í¥é•¹% %Q4œ¤°É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•%°½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÕ¥°¥Ñ•µ}ÑåÁ”è•ÅÕ¥Áµ•¹Ðœ°¥Ñ•µ}¹…µ”èŸ¢¢·–
g¢Êìœ°ÅÕ…¹Ñ¥ÑäèÄ°Õ¹¥Ñ}ÁÉ¥”éÍ…™•9Õ´¡•ÅÕ¥ÁQ½Ñ…°¤°…µ½Õ¹ÐéÍ…™•9Õ´¡•ÅÕ¥ÁQ½Ñ…°¤°¹½Ñ”èœô¤ì(€¥˜€¡Í…™•9Õ´¡…‘‘½¹Q½Ñ…°¤€ø€À¤¥Ñ•µÌ¹ÁÕÍ ¡í¥é•¹% %Q4œ¤°É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•%°½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÕ¥°¥Ñ•µ}ÑåÁ”è…‘‘½¸œ°¥Ñ•µ}¹…µ”èŸ–*ƒ¢Îó¦‚žn¸œ°ÅÕ…¹Ñ¥ÑäèÄ°Õ¹¥Ñ}ÁÉ¥”éÍ…™•9Õ´¡…‘‘½¹Q½Ñ…°¤°…µ½Õ¹ÐéÍ…™•9Õ´¡…‘‘½¹Q½Ñ…°¤°¹½Ñ”èÑ…á}¥¹±Õ‘•ô¤ì(€™½È€¡½¹ÍÐ¥Ð½˜¥Ñ•µÌ¤…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌœ°=‰©•Ð¹…ÍÍ¥¸¡íÑ•¹…¹Ñ}¥èQ99Qô°¥Ð¤¤ì((€½¹ÍÐ¥¹Ù½¥•Q½Ñ…°€ôÍ…™•9Õ´¡™•”¤€¬Í…™•9Õ´¡•ÅÕ¥ÁQ½Ñ…°¤€¬Í…™•9Õ´¡…‘‘½¹Q½Ñ…°¤ì(€¥˜€¡¥¹Ù½¥•Q½Ñ…°€ø€À€˜˜¥¹Ù½¥•A…å±½…€˜˜¥¹Ù½¥•A…å±½…¹¥¹Ù½¥•}ÍÑ…ÑÕÌ¤ì(€€€½¹ÍÐÕ¹Ñ…á•€ô5…Ñ ¹É½Õ¹¡¥¹Ù½¥•Q½Ñ…°€¼€Ä¸ÀÔ¤ì(€€€½¹ÍÐÑ…à€ô¥¹Ù½¥•Q½Ñ…°€´Õ¹Ñ…á•ì(€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€¥¹Ù½¥•Ìœ°ì(€€€€€Ñ•¹…¹Ñ}¥èQ99P°(€€€€€¥è•¹% %9Xœ¤°(€€€€€É•¥ÍÑÉ…Ñ¥½¹}¥èÉ•%°(€€€€€½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥èÕ¥°(€€€€€¥¹Ù½¥•}ÑåÁ”è¥¹Ù½¥•A…å±½…¹¥¹Ù½¥•}ÑåÁ”ñð€œœ°(€€€€€¥¹Ù½¥•}Ñ¥Ñ±”è¥¹Ù½¥•A…å±½…¹¥¹Ù½¥•}Ñ¥Ñ±”ñð€œœ°(€€€€€Ñ…á}¥è¥¹Ù½¥•A…å±½…¹Ñ…á}¥ñð€œœ°(€€€€€•µ…¥°è¥¹Ù½¥•A…å±½…¹¥¹Ù½¥•}•µ…¥°ñð•µ…¥°ñð€œœ°(€€€€€…ÉÉ¥•Èè¥¹Ù½¥•A…å±½…¹¥¹Ù½¥•}…ÉÉ¥•Èñð€œœ°(€€€€€…µ½Õ¹Ðè¥¹Ù½¥•Q½Ñ…°°(€€€€€ÍÑ…ÑÕÌè¥¹Ù½¥•A…å±½…¹¥¹Ù½¥•}ÍÑ…ÑÕÌ°(€€€€€É•…Ñ•‘}…Ðè¹½Ý%Í¼ ¤°(€€€€€ÕÁ‘…Ñ•‘}…Ðè¹½Ý%Í¼ ¤°(€€€ô¤ì(€ô)ô((¼¼ÕÁÍ•ÉÑ5•µ‰•È)…Íå¹Œ™Õ¹Ñ¥½¸ÕÁÍ•ÉÑ5•µ‰•È¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€ˆ¹•µ…¥°€ô¹½Éµµ…¥°¡ˆ¹•µ…¥°¤ì(€ˆ¹Á¡½¹”€ô¹½ÉµA¡½¹”¡ˆ¹Á¡½¹”¤ì(€¥˜€ …ˆ¹•µ…¥°¤É•ÑÕÉ¸ì(€½¹ÍÐ¹½Ü€ô¹½Ý%Í¼ ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€µ•µ‰•ÉÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹•µ…¥°¥ô™Í•±•Ðõ©½¥¹•‘}…Ñ€¤ì(€½¹ÍÐ‘…Ñ„€ôì(€€€•µ…¥°éˆ¹•µ…¥°°Ñ•¹…¹Ñ}¥éQ99P°(€€€¹…µ”éˆ¹¹…µ•ñðœœ°Á¡½¹”éMÑÉ¥¹œ¡ˆ¹Á¡½¹•ñðœœ¤°(€€€‰É…¹‘}¹…µ”éˆ¹‰É…¹‘ñðœœ°‰É…¹‘}¥¹ÑÉ¼éˆ¹‰É…¹‘%¹ÑÉ½ñðœœ°(€€€Í•±±}…Ñ•½Éäéˆ¹Í•±±…Ñññˆ¹Í•±±…Ñ•½Éåñðœœ°Í•±±}¥Ñ•µÌéˆ¹Í•±±%Ñ•µññˆ¹Í•±±%Ñ•µÍñðœœ°(€€€Á¡½Ñ½}ÕÉ°éˆ¹Á¡½Ñ½ñðœœ°™‰}ÕÉ°éˆ¹™‰ñðœœ°¥}ÕÉ°éˆ¹¥ñðœœ°(€€€½±±…‰}ÕÉ°éˆ¹½±±…‰UÉ±ñðœœ°½±±…‰}‘•ÍŒéˆ¹½±±…‰•Íñðœœ°(€€€½µÁ…¹äéˆ¹½µÁ…¹åññˆ¹¥¹Ù½¥•Q¥Ñ±•ñðœœ°Ñ…á}¥éˆ¹Ñ…á%‘ñðœœ°(€€€¥¹Ù½¥•}ÑåÁ”éˆ¹¥¹Ù½¥•QåÁ•ñðœœ°¥¹Ù½¥•}Ñ¥Ñ±”éˆ¹¥¹Ù½¥•Q¥Ñ±•ññˆ¹½µÁ…¹åñðœœ°(€€€¥¹Ù½¥•}•µ…¥°éˆ¹¥¹Ù½¥•µ…¥±ñðœœ°¥¹Ù½¥•}…ÉÉ¥•Èéˆ¹¥¹Ù½¥•…ÉÉ¥•Éñðœœ°(€€€½±±…‰}¥Ñ•µÌéˆ¹½±±…‰%Ñ•µÍñðœœ°¥Ñäéˆ¹¥Ñåñðœœ°±¥¹•}¥éˆ¹±¥¹•%‘ñðœœ°ÕÁ‘…Ñ•‘}…Ðé¹½Ü°(€ôì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤ì(€€€‘…Ñ„¹©½¥¹•‘}…Ð€ô¹½Üì‘…Ñ„¹™…ÍÑ}Á…ÍÌ€ô™…±Í”ì(€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€µ•µ‰•ÉÌœ°‘…Ñ„¤ì(€ô•±Í”ì(€€€‘…Ñ„¹©½¥¹•‘}…Ð€ôÉ½ÝÍlÁt¹©½¥¹•‘}…Ðì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€µ•µ‰•ÉÌœ°•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹•µ…¥°¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€°‘…Ñ„¤ì(€ô)ô((¼¼¡½±‘MÑ…±°¡•±Á•È)…Íå¹Œ™Õ¹Ñ¥½¸¡½±‘MÑ…±°¡•¹Ø°Í•ÍÍ¥½¹%°ÍÑ…±±9Õµ‰•È°É•%°•µ…¥°°Ñ•¹…¹Ñ%¤ì(€½¹ÍÐQ99P€ôÑ•¹…¹Ñ%€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€ÍÑ…±±Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™ÍÑ…±±}¹¼õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÍÑ…±±9Õµ‰•È¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸ì(€½¹ÍÐÌ€ôÉ½ÝÍlÁtì(€¥˜€ ¡Ì¹ÍÑ…ÑÕÌôôôŸ¦:[–ºhññÌ¹ÍÑ…ÑÕÌôôôŸ¦‚CžVdœ¤€˜˜MÑÉ¥¹œ¡Ì¹É•¥ÍÑÉ…Ñ¥½¹}¥‘ñðœœ¤„ôõMÑÉ¥¹œ¡É•%¤¤É•ÑÕÉ¸ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€ÍÑ…±±Ìœ°¥õ•Ä¸‘íÌ¹¥‘ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€°íÍÑ…ÑÕÌèŸ¦‚CžVdœ±É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•%±•µ…¥°±¡½±‘}Ñ¥µ”é¹½Ý%Í¼ ¥ô¤ì)ô((¼¼Í…Ù•5•µ‰•È)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•5•µ‰•È¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€½¹ÍÐ•µ…¥°€ô¹½Éµµ…¥°¡ˆ€˜˜ˆ¹•µ…¥°¤ì(€€¼¼…ÕÑ¡A¡½¹—¾òwžn»–&7–ÞË¦¦_¢¶'žjŽ3¢"+š&/š¦Ž7¾òmˆ¹Á¡½¹—¾òw¢š–¶c¦Ë–:ïžjŽ3šZÃš&/š¦Ž7Ž–§¢žÖW’â7–>¿šÞßžR£¾ò0(€€¼¼ƒ–B›–&šRçš&/š¦šfšrš.ÿšZÃš&/š¦¦¦_¢«–ÞÇ¾ò3ž¶'šZó¢ªÃ¦÷¢÷šRçŽ(€½¹ÍÐ…ÕÑ¡A¡½¹”€ô¹½ÉµA¡½¹”¡ˆ€˜˜ˆ¹…ÕÑ¡A¡½¹”¤ì(€¥˜€ …•µ…¥°ñð€……ÕÑ¡A¡½¹”¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–#’î”µ…¥°ƒ¢"š&/š¦–º3š"C¢ê¯’î÷¦¦_¢¶$œ¤ì(€½¹ÍÐÙ•É¥™¥•€ô…Ý…¥Ð™¥¹‘Y•É¥™¥•‘5•µ‰•É	åµ…¥±A¡½¹”¡•¹Ø°Q99P°•µ…¥°°…ÕÑ¡A¡½¹”¤ì(€¥˜€ …Ù•É¥™¥•ñð¹½Éµµ…¥°¡Ù•É¥™¥•¹•µ…¥°¤€„ôô•µ…¥°¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢ê¯’î÷¦¦_¢¶'–’ÇšV_¾ò3ž‡š²+¦fC’þ»šRçš¶“šr–N‡¢ÎšZdœ¤ì(€ˆ¹•µ…¥°€ô•µ…¥°ì(€…Ý…¥ÐÕÁÍ•ÉÑ5•µ‰•È¡•¹Ø°ˆ¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô((¼¼…¹•±I•œ(¼¼ƒŠRŠR ƒžÖ–B#––_žÖ–B3¦Ë¦–ÇžR£š‚ã–þƒŠRŠR (¼¼ƒ¢š?–&¾òkžÖ–B#––_žÖ¾ò!‰Õ¹‘±•}É½ÕÁ}¥ƒžnã–B3¾ò'šb¿žÚ–ºk–«šƒ¾ò3¦’â–‚Ó¾òwšVÓžÖ’â¢Öß¦¾ò?–>[šÚ#¾ò0(¼¼ƒ’â7–>¿–>«¦–Û’â·’â–‚Ó¾ò#–B›–&ž¶'šZóžR£žÖ–B#–ç¢Êß–Z»–‚Ó¾ò'Ž’â'šŠw¢Þ¿¾ò#–&7–>Ã–>[šÚ#¾ò?–ú3–>Ã–>[šÚ#¾ò?žRÏ¢®/¦¢Êï¾ò'–ÇžR£š¶“š‚ã–þŽ)…Íå¹Œ™Õ¹Ñ¥½¸•Ñ	Õ¹‘±•É½ÕÁI•Ì¡•¹Ø°Q99P°É•œ¥ì(€½¹ÍÐ¥õMÑÉ¥¹œ¡É•œ˜™É•œ¹‰Õ¹‘±•}É½ÕÁ}¥‘ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …¥¥É•ÑÕÉ¸mÉ•tì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™‰Õ¹‘±•}É½ÕÁ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸mÉ•tì(€€¼¼ƒ–îÛšr–ú3–:–‚Ó¦
ž¶šb¿š¶ß–>Ë’úšêC¾ò3’â7–>¿–7¢Š¯–>[šÚ#¾ò?’îcš²û¾ò?¦š²ûžVÛš"Cžn»–&7žÖ–B#š"C–N‡¦7¢’¢fWžBŽ(€½¹ÍÐÕÉÉ•¹ÐõÉ½ÝÌ¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¹ÑÉ¥´ ¤„ôôŸ–ÞË–îÛšr|œ¤ì(€É•ÑÕÉ¸ÕÉÉ•¹Ð¹±•¹Ñ ýÕÉÉ•¹ÐémÉ•tì)ô)…Íå¹Œ™Õ¹Ñ¥½¸É•±•…Í•I•¥ÍÑÉ…Ñ¥½¹M•…ÑÌ¡•¹Ø±Q99P±É•œ±É•…Í½¸¥ì(€±•Ð½Õ¹ÐôÀì(€ÑÉåì(€€€½¹ÍÐÍÐõ…Ý…¥Ð‘‰•Ð¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥ô™Í•±•Ðõ¥‘€¤ì(€€€™½È¡½¹ÍÐÌ½˜ÍÐ¥ì…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥õ€±íÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°±ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì½Õ¹Ð¬¬ìô(€õ…Ñ ¡”¥ì±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”èÉ•±•…Í•I•¥ÍÑÉ…Ñ¥½¹M•…ÑÌœ±µ•ÍÍ…”éÉ•…Í½¹ñðÉ•±•…Í”Í•…ÑÌ™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìô(€ÑÉåì…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±íÍÑ…±±}¹Õµ‰•Èé¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÉ•±•…Í•œ±Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ìõ…Ñ ¡”¥íô(€É•ÑÕÉ¸½Õ¹Ðì)ô()™Õ¹Ñ¥½¸É•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½Ñ%‘Ì¡É•œ¥ì(€½¹ÍÐÉ½ÝÌõÍ…™•)Í½¸¡É•œü¹ÕÍÑ½µ}™¥•±‘Í}©Í½¸±mt¤±¡¥Ðô¡ÉÉ…ä¹¥ÍÉÉ…ä¡É½ÝÌ¤ýÉ½ÝÌémt¤¹™¥¹¡àôùà˜™à¹­•äôôô}}‘½¥¹}µ½‘Õ±•Ìœ¤ì(€É•ÑÕÉ¸¡¥Ðü¹Ù…±Õ”˜™ÉÉ…ä¹¥ÍÉÉ…ä¡¡¥Ð¹Ù…±Õ”¹Ñ¥µ•Í±½Ñ%‘Ì¤ý¡¥Ð¹Ù…±Õ”¹Ñ¥µ•Í±½Ñ%‘Ì¹µ…À¡MÑÉ¥¹œ¤¹™¥±Ñ•È¡	½½±•…¸¤émtì)ô)…Íå¹Œ™Õ¹Ñ¥½¸É•±•…Í•I•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½ÑÌ¡•¹Ø±P±É•œ¥ì(€½¹ÍÐÅÑäõ5…Ñ ¹µ…à Ä±Í…™•9Õ´¡É•œü¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤ì(€™½È¡½¹ÍÐ¥½˜É•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½Ñ%‘Ì¡É•œ¤¥…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éP±Á}Ñ¥µ•Í±½Ñ}¥é¥±Á}ÅÑäéÅÑåô¤¹…Ñ   ¤ôùíô¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸…ÁÑÕÉ•I•™Õ¹‘I•Í½ÕÉ•MÑ…Ñ”¡•¹Ø±P±É•œ¥ì(€½¹ÍÐÍ•…ÑÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€É•ÑÕÉ¸ì(€€€É•œéì¸¸¹É•ô°(€€€Í•…ÑÌ°(€€€Ñ¥µ•Í±½Ñ%‘ÌéÉ•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½Ñ%‘Ì¡É•œ¤°(€€€…Ñ¥Ù”é¥ÍÑ¥Ù•½É…Á…¥Ñä¡É•œ¤°(€€€ÅÑäé5…Ñ ¹µ…à Ä±Í…™•9Õ´¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤°(€€€É•Í½ÕÉ•ÍI•±•…Í•é™…±Í”°(€€€½Õ¹Ñ‘©ÕÍÑ•é™…±Í”(€ôì)ô)…Íå¹Œ™Õ¹Ñ¥½¸É•±•…Í•I•™Õ¹‘I•Í½ÕÉ•ÍMÑÉ¥Ð¡•¹Ø±P±ÍÑ…Ñ”±É•…Í½¸¥ì(€½¹ÍÐÉ•±•…Í•‘M•…ÑÌõmt±É•±•…Í•‘M±½ÑÌõmtì(€ÑÉåì(€€€™½È¡½¹ÍÐÌ½˜ÍÑ…Ñ”¹Í•…ÑÌ¥ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥õ€±ì(€€€€€€€ÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°±ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¤(€€€€€ô¤ì(€€€€€É•±•…Í•‘M•…ÑÌ¹ÁÕÍ ¡Ì¤ì(€€€ô(€€€™½È¡½¹ÍÐ¥½˜ÍÑ…Ñ”¹Ñ¥µ•Í±½Ñ%‘Ì¥ì(€€€€€½¹ÍÐÈõ…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éP±Á}Ñ¥µ•Í±½Ñ}¥é¥±Á}ÅÑäéÍÑ…Ñ”¹ÅÑåô¤ì(€€€€€¥˜ …ÉññÈ¹½¬ôôõ™…±Í”¥Ñ¡É½Ü¹•ÜÉÉ½È ¡È˜™È¹•ÉÉ½È¥ñðŸšfšº×–B7¦†7¦/šRû–’ÇšV\œ¤ì(€€€€€É•±•…Í•‘M±½ÑÌ¹ÁÕÍ ¡¥¤ì(€€€ô(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÍÑ…Ñ”¹É•œ¹¥¥õ€±ì(€€€€€ÍÑ…±±}¹Õµ‰•Èé¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÉ•±•…Í•œ±Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°(€€€ô¤ì(€€€ÍÑ…Ñ”¹É•Í½ÕÉ•ÍI•±•…Í•õÑÉÕ”ì(€€€É•ÑÕÉ¸ÑÉÕ”ì(€õ…Ñ ¡”¥ì(€€€™½È¡½¹ÍÐÌ½˜É•±•…Í•‘M•…ÑÌ¥ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥õ€±ì(€€€€€€€ÍÑ…ÑÕÌéÌ¹ÍÑ…ÑÕÍñðŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥éÌ¹É•¥ÍÑÉ…Ñ¥½¹}¥‘ññ¹Õ±°±•µ…¥°éÌ¹•µ…¥±ññ¹Õ±°±¡½±‘}Ñ¥µ”éÌ¹¡½±‘}Ñ¥µ•ññ¹Õ±°°(€€€€€€€Í•…Ñ}¡½±‘}•áÁ¥É•Í}…ÐéÌ¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ñññ¹Õ±°±ÕÁ‘…Ñ•‘}…ÐéÌ¹ÕÁ‘…Ñ•‘}…Ñññ¹½Ý%Í¼ ¤(€€€€€ô¤¹…Ñ   ¤ôùíô¤ì(€€€ô(€€€™½È¡½¹ÍÐ¥½˜É•±•…Í•‘M±½ÑÌ¥ì(€€€€€…Ý…¥Ð‘‰IÁŒ¡•¹Ø°±…¥µ}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éP±Á}Ñ¥µ•Í±½Ñ}¥é¥±Á}ÅÑäéÍÑ…Ñ”¹ÅÑåô¤¹…Ñ   ¤ôùíô¤ì(€€€ô(€€€Ñ¡É½Ü¹•ÜÉÉ½È¡É•…Í½¸¬œè€œ¬¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸ¢ÎšêC¦/šRû–’ÇšV\œ¤¤ì(€ô)ô)…Íå¹Œ™Õ¹Ñ¥½¸É•ÍÑ½É•I•™Õ¹‘I•Í½ÕÉ•MÑ…Ñ”¡•¹Ø±P±ÍÑ…Ñ”¥ì(€¥˜ …ÍÑ…Ñ•ñð…ÍÑ…Ñ”¹É•Í½ÕÉ•ÍI•±•…Í•¥É•ÑÕÉ¸ì(€™½È¡½¹ÍÐÌ½˜ÍÑ…Ñ”¹Í•…ÑÌ¥ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥õ€±ì(€€€€€ÍÑ…ÑÕÌéÌ¹ÍÑ…ÑÕÍñðŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥éÌ¹É•¥ÍÑÉ…Ñ¥½¹}¥‘ññ¹Õ±°±•µ…¥°éÌ¹•µ…¥±ññ¹Õ±°±¡½±‘}Ñ¥µ”éÌ¹¡½±‘}Ñ¥µ•ññ¹Õ±°°(€€€€€Í•…Ñ}¡½±‘}•áÁ¥É•Í}…ÐéÌ¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ñññ¹Õ±°±ÕÁ‘…Ñ•‘}…ÐéÌ¹ÕÁ‘…Ñ•‘}…Ñññ¹½Ý%Í¼ ¤(€€€ô¤¹…Ñ   ¤ôùíô¤ì(€ô(€™½È¡½¹ÍÐ¥½˜ÍÑ…Ñ”¹Ñ¥µ•Í±½Ñ%‘Ì¥ì(€€€…Ý…¥Ð‘‰IÁŒ¡•¹Ø°±…¥µ}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éP±Á}Ñ¥µ•Í±½Ñ}¥é¥±Á}ÅÑäéÍÑ…Ñ”¹ÅÑåô¤¹…Ñ   ¤ôùíô¤ì(€ô(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÍÑ…Ñ”¹É•œ¹¥¥õ€±ì(€€€ÍÑ…±±}¹Õµ‰•ÈéÍÑ…Ñ”¹É•œ¹ÍÑ…±±}¹Õµ‰•Éññ¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌéÍÑ…Ñ”¹É•œ¹Í•…Ñ}¡½¥•}ÍÑ…ÑÕÍññ¹Õ±°°(€€€Í•…Ñ}¡½¥•}ÑåÁ”éÍÑ…Ñ”¹É•œ¹Í•…Ñ}¡½¥•}ÑåÁ•ññ¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…ÐéÍÑ…Ñ”¹É•œ¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ñññ¹Õ±°(€ô¤¹…Ñ   ¤ôùíô¤ì(€ÍÑ…Ñ”¹É•Í½ÕÉ•ÍI•±•…Í•õ™…±Í”ì)ô(()…Íå¹Œ™Õ¹Ñ¥½¸¡…¹•±I•œ¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œõÉ½ÝÍlÁtì(€½¹ÍÐ½Ý¸õ…Ý…¥ÐÙ•É¥™¥•‘I•=Ý¹•ÉÕ…É¡•¹Ø±É•œ±ˆ°Ÿ–>[šÚ œ¤ì¥˜¡½Ý¸¤É•ÑÕÉ¸½Ý¸ì(€¥˜¡¥ÍA…¥‘MÑ…ÑÕÌ¡}Á…åMÑ…ÑÕÌ¡É•œ¤¤ñðÍ…™•9Õ´¡É•œ¹Á…¥‘}…µ½Õ¹Ð¤øÀ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–ÞËšr'–¾›šRÛ¦G¦†7¾ò3¢®/¢ÖÃ¦š²ûžRÏ¢®/šÖž¢,œ¤ì(€¥˜¡¥Í…Á…¥Ñå%¹…Ñ¥Ù•QÉ…¹Í™•ÉMÑ…ÑÕÌ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË¦Ë–—¦š²ûš"[¦¢Êï–º3š"CšÖž¢/¾ò3’â7¢÷žR£–>[šÚ#šÖž¢/¢fWžBœ¤ì(€½¹ÍÐÉ½ÕÀõ…Ý…¥Ð•Ñ	Õ¹‘±•É½ÕÁI•Ì¡•¹Ø±Q99P±É•œ¤ì(€¥˜¡É½ÕÀ¹Í½µ”¡œôù¥ÍA…¥‘MÑ…ÑÕÌ¡}Á…åMÑ…ÑÕÌ¡œ¤¥ññÍ…™•9Õ´¡œ¹Á…¥‘}…µ½Õ¹Ð¤øÀ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“žÖ–B#–ÞËšr'–¾›šRÛ¦G¦†7¾ò3šVÓžÖ–þ¦‚#¢ÖÃ¦š²ûžRÏ¢®/šÖž¢,œ¤ì(€™½È¡½¹ÍÐœ½˜É½ÕÀ¥ì(€€€¥˜¡}É•Ù¥•ÝMÑ…ÑÕÌ¡œ¤ôôôŸ–ÞË–>[šÚ œ¤½¹Ñ¥¹Õ”ì(€€€½¹ÍÐ…Ñ¥Ù”õ¥ÍÑ¥Ù•½É…Á…¥Ñä¡œ¤ì(€€€½¹ÍÐ¹½Ñ”ô¡MÑÉ¥¹œ¡œ¹…‘µ¥¹}¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤¬œo–&7–>Átƒ–>[šÚ#šr«žæÏ¢Êï–‚Ç–B4œ¬¡É½ÕÀ¹±•¹Ñ øÄüŸ¾ò#žÖ–B#šVÓžÖ–>[šÚ#¾ò$œèœœ¤¬œ€œ­¹½ÝQ…¥Á•¥Q•áÐ ¤¤¹ÑÉ¥´ ¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥õ€±ì(€€€€€É•Ù¥•Ý}ÍÑ…ÑÕÌèŸ–ÞË–>[šÚ œ°Á…åµ•¹Ñ}ÍÑ…ÑÕÌèŸ–ÞË–>[šÚ œ°ÑÉ…¹Í™•É}ÍÑ…ÑÕÌé¹Õ±°°(€€€€€Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹ÐèÀ±Á…åµ•¹Ñ}±…ÍÐÔé¹Õ±°±Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ðé¹Õ±°°(€€€€€ÍÑ…±±}¹Õµ‰•Èé¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÉ•±•…Í•œ±Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°±…‘µ¥¹}¹½Ñ”é¹½Ñ”(€€€ô¤ì(€€€¥˜¡…Ñ¥Ù”¤…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø±Q99P±œ°´¡Í…™•9Õ´¡œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤¤ì(€€€…Ý…¥ÐÉ•±•…Í•I•¥ÍÑÉ…Ñ¥½¹M•…ÑÌ¡•¹Ø±Q99P±œ°µ•µ‰•É}…¹•°œ¤ì(€€€…Ý…¥ÐÉ•±•…Í•I•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½ÑÌ¡•¹Ø±Q99P±œ¤ì(€€€ÑÉåì…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥ô™ÍÑ…ÑÕÌõ•Ä¸•Ô•	”àÔ•Ü•È•	•à•”á€±íÍÑ…ÑÕÌèŸ–ÞË–>[šÚ ô¤ìõ…Ñ ¡”¥íô(€ô(€™½È¡½¹ÍÐÍ¥½˜l¸¸¹¹•ÜM•Ð¡É½ÕÀ¹µ…À¡àôùà¹Í•ÍÍ¥½¹}¥¤¹™¥±Ñ•È¡	½½±•…¸¤¥t¥…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±Q99P±Í¥¤ì(€ÑÉåì½¹ÍÐÍ•Í9…µ”õ…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø±É•œ¹Í•ÍÍ¥½¹}¥±Q99P¤ì½¹ÍÐÑŒõ…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø±Q99P¤ì…Ý…¥Ðµ…¥±…¹•±I•œ¡•¹Ø±É•œ¹•µ…¥°±•Ñ¥ÍÁ±…å9…µ”¡É•œ¹¹…µ”±É•œ¹‰É…¹‘}¹…µ•ñðœœ°œœ¤±Í•Í9…µ”±ÑŒ¤ìõ…Ñ ¡”¥íô(€™½È¡½¹ÍÐœ½˜É½ÕÀ¥…Ý…¥ÐÉ•½É‘9½Ñ¥™¥…Ñ¥½¸¡•¹Ø±íÑ•¹…¹Ñ%éQ99P±Õ¹¥Ñ%éœ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±Í•ÍÍ¥½¹%éœ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹%éœ¹¥±•µ…¥°éœ¹•µ…¥°±•Ù•¹Ñ-•äèÉ•¥ÍÑÉ…Ñ¥½¹}…¹•±±•œ±Ñ¥Ñ±”èŸ–‚Ç–B7¾ò?¦‚CžÒ–ÞË–>[šÚ œ±‰½‘äèŸš
£žj–‚Ç–B7¾ò?¦‚CžÒ–ÞË–>[šÚ#Žœ±µ•Ñ„éíÍ½ÕÉ”èµ•µ‰•Èõô¤¹…Ñ   ¤ôùíô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±‰Õ¹‘±•½Õ¹ÐéÉ½ÕÀ¹±•¹Ñ¡ô¤ì)ô(¼¼ƒŠRŠR ƒ–*ƒ–ç¦ã’ö7š¢‡žÖ¾ò!Xã¾ò'ŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR )™Õ¹Ñ¥½¸Í•…ÑQåÁ•1…‰•°¡Ð¥ìÉ•ÑÕÉ¸€¡í…ÕÑ¼èŸ¢«–.Wš:K’ö4œ°Á…¥èŸ–*ƒ–ç¦ã’ö4œ°Í•ÉÙ¥”èŸšr7–.g–>Àœ°±½Í•èŸ’â7¦Z/šRøô¥mMÑÉ¥¹œ¡Ññð…ÕÑ¼œ¥tñð€Ÿ¢«–.Wš:K’ö4œìô)™Õ¹Ñ¥½¸¹½Éµ…±¥é•M•…ÑQåÁ”¡Ð¥ì(€½¹ÍÐØõMÑÉ¥¹œ¡Ññð…ÕÑ¼œ¤¹ÑÉ¥´ ¤ì(€¥˜¡l…ÕÑ¼œ°Á…¥œ°Í•ÉÙ¥”œ°±½Í•t¹¥¹±Õ‘•Ì¡Ø¤¤É•ÑÕÉ¸Øì(€¥˜¡Ø¹¥¹±Õ‘•Ì Ÿ–*ƒ–äœ¤¤É•ÑÕÉ¸€Á…¥œì(€¥˜¡Ø¹¥¹±Õ‘•Ì Ÿšr7–.dœ¤¤É•ÑÕÉ¸€Í•ÉÙ¥”œì(€¥˜¡Ø¹¥¹±Õ‘•Ì Ÿ’â7¦Z,œ¤¤É•ÑÕÉ¸€±½Í•œì(€É•ÑÕÉ¸€…ÕÑ¼œì)ô)™Õ¹Ñ¥½¸¥ÍM•…Ñ=ÕÁ¥•‘Ñ¥Ù”¡É½Ü¥ì(€½¹ÍÐÍÐõMÑÉ¥¹œ¡É½Ü¹ÍÑ…ÑÕÍñðœœ¤ì(€¥˜¡ÍÐôôôŸ¦:[–ºhœ¤É•ÑÕÉ¸ÑÉÕ”ì(€¥˜¡ÍÐôôôŸ¦‚CžVdœ¥ì(€€€½¹ÍÐ•áÀõÉ½Ü¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…ÑññÉ½Ü¹¡½±‘}•áÁ¥É•Í}…Ññðœœì(€€€¥˜ …•áÀ¤É•ÑÕÉ¸ÑÉÕ”ì(€€€É•ÑÕÉ¸…Ñ”¹Á…ÉÍ”¡•áÀ¤€ø…Ñ”¹¹½Ü ¤ì(€ô(€É•ÑÕÉ¸™…±Í”ì)ô)™Õ¹Ñ¥½¸Í•…Ñ½‘•=˜¡É½Ü¥ìÉ•ÑÕÉ¸É½Ü¹ÍÑ…±±}¹¼ñð€œœìô)™Õ¹Ñ¥½¸Í•…ÑI•%¡É½Ü¥ìÉ•ÑÕÉ¸É½Ü¹É•¥ÍÑÉ…Ñ¥½¹}¥ñð€œœìô)™Õ¹Ñ¥½¸…‘‘!½ÕÉÍ%Í¼¡ ¥ìÉ•ÑÕÉ¸¹•Ü…Ñ”¡…Ñ”¹¹½Ü ¤€¬€¡9Õµ‰•È¡ ¥ñðÈÐ¤¨ØÀ¨ØÀ¨ÄÀÀÀ¤¹Ñ½%M=MÑÉ¥¹œ ¤ìô)™Õ¹Ñ¥½¸¥Í!½±‘áÁ¥É•‘Ð¡Ø¥ìÉ•ÑÕÉ¸€„…Ø€˜˜…Ñ”¹Á…ÉÍ”¡Ø¤€ðô…Ñ”¹¹½Ü ¤ìô)™Õ¹Ñ¥½¸¥ÍA…¥‘M•…Ñ!½±‘áÁ¥É•¡É•œ¥ì(€É•ÑÕÉ¸MÑÉ¥¹œ¡É•œü¹Í•…Ñ}¡½¥•}¥¹Ñ•¹Ññðœœ¤ôôôÁ…¥œ€˜˜MÑÉ¥¹œ¡É•œü¹Í•…Ñ}¡½¥•}ÍÑ…ÑÕÍñðœœ¤ôôôÉ•Í•ÉÙ•œ€˜˜¥Í!½±‘áÁ¥É•‘Ð¡É•œü¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ð¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸•Ñá¥ÍÑ¥¹M•…Ñ••É½µ%Ñ•µÌ¡•¹Ø°É•%°Ñ•¹…¹Ñ%¥ì(€ÑÉäì(€€€½¹ÍÐ}ÐõMÑÉ¥¹œ¡Ñ•¹…¹Ñ%‘ñðœœ¤¹ÑÉ¥´ ¤ì(€€€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌœ±€‘í}ÐýÑ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡}Ð¥ô™€èœõÉ•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™¥Ñ•µ}ÑåÁ”õ•Ä¹Í•…Ñ}™•”™Í•±•Ðõ…µ½Õ¹Ñ€¤ì(€€€É•ÑÕÉ¸É½ÝÌ¹É•‘Õ” ¡ÍÕ´±È¤ôùÍÕ´­Í…™•9Õ´¡È¹…µ½Õ¹Ð¤°À¤ì(€ô…Ñ ¡”¤ìÉ•ÑÕÉ¸€Àìô)ô)…Íå¹Œ™Õ¹Ñ¥½¸É•±•…Í•A…¥‘M•…Ñ!½±¡•¹Ø°Ñ•¹…¹Ñ%°É•œ°É•…Í½¸ô•áÁ¥É•œ¥ì(€¥˜ …É•œñð€…É•œ¹¥¤É•ÑÕÉ¸ì(€ÑÉåì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥ô™ÍÑ…ÑÕÌõ•Ä»¦‚CžVe€±íÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€õ…Ñ ¡”¥ì½¹Í½±”¹•ÉÉ½È É•±•…Í•A…¥‘M•…Ñ!½±ÍÑ…±±ÌÍ­¥ÁÁ•œ°”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é”¤ì±½ÉÉ½È¡•¹Ø°íÍ½ÕÉ”èÉ•±•…Í•A…¥‘M•…Ñ!½±œ°µ•ÍÍ…”èÉ•±•…Í•A…¥‘M•…Ñ!½±ÍÑ…±±ÌÍ­¥ÁÁ•œ°•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìô(€½¹ÍÐ½±‘M•…Ñ•”€ô…Ý…¥Ð•Ñá¥ÍÑ¥¹M•…Ñ••É½µ%Ñ•µÌ¡•¹Ø°É•œ¹¥°Ñ•¹…¹Ñ%¤ì(€ÑÉåì…Ý…¥ÐÉ•‰Õ¥±‘M•…Ñ••%Ñ•´¡•¹Ø±Ñ•¹…¹Ñ%±É•œ±É•œ¹Í•ÍÍ¥½¹}¥°À¤ìõ…Ñ ¡”¥íô(€½¹ÍÐ‰…Í•µ½Õ¹Ðõ5…Ñ ¹µ…à À°¡Í…™•9Õ´¡É•œ¹Ñ½Ñ…±}…µ½Õ¹Ð¥ññÍ…™•9Õ´¡É•œ¹…µ½Õ¹Ð¥ñðÀ¤µ½±‘M•…Ñ•”¤ì(€ÑÉåì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±ì(€€€€€ÍÑ…±±}¹Õµ‰•Èé¹Õ±°°Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÉ•±•…Í•œ°Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°°(€€€€€Í•…Ñ}™••}Ñ½Ñ…°èÀ°Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°°…µ½Õ¹Ðé‰…Í•µ½Õ¹Ð°Ñ½Ñ…±}…µ½Õ¹Ðé‰…Í•µ½Õ¹Ð(€€€ô¤ì(€õ…Ñ ¡”¥ì½¹Í½±”¹•ÉÉ½È É•±•…Í•A…¥‘M•…Ñ!½±É•œÍ­¥ÁÁ•œ°”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é”¤ì±½ÉÉ½È¡•¹Ø°íÍ½ÕÉ”èÉ•±•…Í•A…¥‘M•…Ñ!½±œ°µ•ÍÍ…”èÉ•±•…Í•A…¥‘M•…Ñ!½±É•œÍ­¥ÁÁ•œ°•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìô)ô)…Íå¹Œ™Õ¹Ñ¥½¸±…¥µM•…ÑI½ÝÑ½µ¥Œ¡•¹Ø°Ñ•¹…¹Ñ%°Í•…Ð°É•œ°•áÁ¥É•ÍÐ¥ì(€½¹ÍÐ½‘”õÍ•…Ñ½‘•=˜¡Í•…Ð¤ì(€¥˜¡MÑÉ¥¹œ¡Í•…ÑI•%¡Í•…Ð¥ñðœœ¤ôôõMÑÉ¥¹œ¡É•œ¹¥‘ñðœœ¤€˜˜MÑÉ¥¹œ¡Í•…Ð¹ÍÑ…ÑÕÍñðœœ¤ôôôŸ¦‚CžVdœ€˜˜€…¥Í!½±‘áÁ¥É•‘Ð¡Í•…Ð¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ð¤¥ì(€€€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰UÁ‘…Ñ•I•ÑÕÉ¹¥¹œ¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•…Ð¹¥¥ô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±íÍÑ…ÑÕÌèŸ¦‚CžVdœ±•µ…¥°éÉ•œ¹•µ…¥°±¡½±‘}Ñ¥µ”é¹½Ý%Í¼ ¤±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé•áÁ¥É•ÍÑô¤ì(€€€¥˜ …É½ÝÌ¹±•¹Ñ ¤Ñ¡É½Ü¹•ÜÉÉ½È Ÿš¶“’ö7žö»–ÞË¢Š¯¦ã¢ÖÃ¾ò3¢®/¦7šZÃ¦ãšN–Û’î[’ö7žö»Žœ¤ì(€€€É•ÑÕÉ¸É½ÝÍlÁtì(€ô(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰UÁ‘…Ñ•I•ÑÕÉ¹¥¹œ¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•…Ð¹¥¥ô™ÍÑ…ÑÕÌõ•Ä»ž¦ë¦ZH™É•¥ÍÑÉ…Ñ¥½¹}¥õ¥Ì¹¹Õ±°™¥Í}…Ñ¥Ù”õ•Ä¹ÑÉÕ•€±íÍÑ…ÑÕÌèŸ¦‚CžVdœ±É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•œ¹¥±•µ…¥°éÉ•œ¹•µ…¥°±¡½±‘}Ñ¥µ”é¹½Ý%Í¼ ¤±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé•áÁ¥É•ÍÑô¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¤Ñ¡É½Ü¹•ÜÉÉ½È¡½‘”¬œƒ–ÞË¢Š¯¦ã¢ÖÃ¾ò3¢®/¦7šZÃ¦ãšN–Û’î[’ö7žö»Žœ¤ì(€É•ÑÕÉ¸É½ÝÍlÁtì)ô)…Íå¹Œ™Õ¹Ñ¥½¸•ÑM•ÍÍ¥½¹M•…ÑM•ÑÑ¥¹œ¡•¹Ø°Ñ•¹…¹Ñ%°Í•ÍÍ¥½¹%¥ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðõ¥±Í•…Ñ}ÁÉ¥¥¹}•¹…‰±•±Í•…Ñ}¡½±‘}¡½ÕÉÌ±Í•…Ñ}µ…Á}ÕÉ±€¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸í•¹…‰±•é™…±Í”°¡½±‘!½ÕÉÌéMQ}!=1}!=UIL°µ…ÁUÉ°èœôì(€½¹ÍÐÌõÉ½ÝÍlÁtì(€É•ÑÕÉ¸í•¹…‰±•éÌ¹Í•…Ñ}ÁÉ¥¥¹}•¹…‰±•ôôõÑÉÕ•ññÌ¹Í•…Ñ}ÁÉ¥¥¹}•¹…‰±•ôôôÑÉÕ”œ°¡½±‘!½ÕÉÌéÍ…™•9Õ´¡Ì¹Í•…Ñ}¡½±‘}¡½ÕÉÌ¥ññMQ}!=1}!=UIL°µ…ÁUÉ°éÌ¹Í•…Ñ}µ…Á}ÕÉ±ñðœôì)ô)…Íå¹Œ™Õ¹Ñ¥½¸•ÑM•…ÑI½ÝÌ¡•¹Ø°Ñ•¹…¹Ñ%°Í•ÍÍ¥½¹%¥ì(€É•ÑÕÉ¸…Ý…¥Ð‘‰•Ð¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðô¨™½É‘•Èõµ…Á}½É‘•È¹…ÍŒ±ÍÑ…±±}¹¼¹…Í€¤ì)ô(¼¼´ÀË¾òk–³¦Z/¦ã’ö7–r[’â7–ú_–n{–
Ì¥“¾ò=É•%“¾ò=•µ…¥³Ž(¼¼ƒ–&7–>Ã–>«¦r¢šž~—¦OŽ3¦gš‚óšb¿’â7šb¿š"GžjŽ7¾ò3š&’î—šRç–nxµ¥¹”ƒš^_š¢g¾òm½Ý¹I•%ƒžRÇ–ú3ž®¿¦¦_¢¶'–ú3–âÛ–—¾ò0(¼¼ƒ–Fó–>¯ž®¿ž‡šÎW¢«¢†3š2–ºk–"—’êëžjÉ•%ƒ’úš:‹šâ³Ž)™Õ¹Ñ¥½¸ÁÕ‰±¥M•…Ð¡É½Ü°½Ý¹I•%¥ì(€½¹ÍÐ½‘”õÍ•…Ñ½‘•=˜¡É½Ü¤ì(€½¹ÍÐÑåÁ”õ¹½Éµ…±¥é•M•…ÑQåÁ”¡É½Ü¹Í•…Ñ}ÑåÁ”¤ì(€½¹ÍÐÉ¥õMÑÉ¥¹œ¡Í•…ÑI•%¡É½Ü¥ñðœœ¤ì(€É•ÑÕÉ¸ì(€€€½‘”°ÍÑ…±±9¼é½‘”°Í•…Ñ½‘”é½‘”°(€€€ÑåÁ”°ÑåÁ•1…‰•°éÍ•…ÑQåÁ•1…‰•°¡ÑåÁ”¤°(€€€ÁÉ¥”éÍ…™•9Õ´¡É½Ü¹ÁÉ¥•}‘•±Ñ„¤°ÁÉ¥••±Ñ„éÍ…™•9Õ´¡É½Ü¹ÁÉ¥•}‘•±Ñ„¤°(€€€àéÍ…™•9Õ´¡É½Ü¹µ…Á}à¤°äéÍ…™•9Õ´¡É½Ü¹µ…Á}ä¤°É½Ñ…Ñ¥½¸è ¡Í…™•9Õ´¡É½Ü¹µ…Á}É½Ñ…Ñ¥½¸¤”ÌØÀ¤¬ÌØÀ¤”ÌØÀ°½É‘•ÈéÍ…™•9Õ´¡É½Ü¹µ…Á}½É‘•È¤°(€€€…Ñ¥Ù”è€¡ÑåÁ”ôôô…ÕÑ¼ññÑåÁ”ôôôÁ…¥œ¤€˜˜É½Ü¹¥Í}…Ñ¥Ù”„ôõ™…±Í”€˜˜É½Ü¹¥Í}…Ñ¥Ù”„ôô™…±Í”œ°(€€€¹½Ñ”éÉ½Ü¹¹½Ñ•ñðœœ°ÍÑ…ÑÕÌéÉ½Ü¹ÍÑ…ÑÕÍñðŸž¦ë¦ZHœ°(€€€µ¥¹”è€„„¡½Ý¹I•%€˜˜É¥€˜˜É¥ôôõMÑÉ¥¹œ¡½Ý¹I•%¤¤°(€€€¡½±‘áÁ¥É•ÍÐéÉ½Ü¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ññðœœ°(€€€½ÕÁ¥•é¥ÍM•…Ñ=ÕÁ¥•‘Ñ¥Ù”¡É½Ü¤(€ôì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑM•…Ñ5…À¡•¹Ø±À¥ì(€½¹ÍÐQ99PõÀ¹}Ñ•¹…¹Ñ%ì(€¥˜ …À¹Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG–‚Óš²‡žÞ£¢f|œ¤ì(€½¹ÍÐÍ•ÑÑ¥¹œõ…Ý…¥Ð•ÑM•ÍÍ¥½¹M•…ÑM•ÑÑ¥¹œ¡•¹Ø±Q99P±À¹Í•ÍÍ¥½¹%¤ì(€±•ÐÉ½ÝÌõmtìÑÉåìÉ½ÝÌõ…Ý…¥Ð•ÑM•…ÑI½ÝÌ¡•¹Ø±Q99P±À¹Í•ÍÍ¥½¹%¤ìõ…Ñ ¡”¥ìÉ½ÝÌõmtìô(€€¼¼ƒ–>«šr'¦k¦8µ…¥³¾ò/š&/š¦¦¦_¢¶'žjšr³’êë¾ò3š&7šrš.ÿ–"Ã¢«–ÞÇ¦
š‚óžjµ¥¹”õÑÉÕ—¾òl(€€¼¼ƒšr«¦¦_¢¶'¢’â–ú/žr/–"ÃŽ3–ÞË¢Š¯’öSžR£Ž7¾ò3žr/’â7–ëšb¿¢ªÃŽ(€±•Ð½Ý¹I•%ôœœì(€¥˜€¡À¹É•%€˜˜À¹•µ…¥°€˜˜À¹Á¡½¹”¤ì(€€€½¹ÍÐÉ•I½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡À¹É•%¥ô™Í•±•Ðõ¥±•µ…¥°±Á¡½¹•€¤¹…Ñ   ¤ôùmt¤ì(€€€¥˜€¡É•I½ÝÌ¹±•¹Ñ €˜˜¥ÍI•¥ÍÑÉ…Ñ¥½¹=Ý¹•È¡É•I½ÝÍlÁt°À¹•µ…¥°°À¹Á¡½¹”¤¤½Ý¹I•%õMÑÉ¥¹œ¡É•I½ÝÍlÁt¹¥¤ì(€ô(€½¹ÍÐÍ•…ÑÌõÉ½ÝÌ¹µ…À¡ÈôùÁÕ‰±¥M•…Ð¡È°½Ý¹I•%¤¤ì(€É•ÑÕÉ¸©Í½¹=¬¡í•¹…‰±•éÍ•ÑÑ¥¹œ¹•¹…‰±•°¡½±‘!½ÕÉÌéÍ•ÑÑ¥¹œ¹¡½±‘!½ÕÉÌ°µ…ÁUÉ°éÍ•ÑÑ¥¹œ¹µ…ÁUÉ°°Í•…ÑÍô¤ì)ô(¼¼ƒŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠV@(¼¼ƒšÒï–.W¦fC–ºkš.7žŸš†¾ò#¢†3¦*ß–Þ—–ß¾ò$(¼¼€€ƒ¦†¿ž’ëšŠw’îÛ¾òk¦Z/¦^s¦Z,9¾ò#ž‡¦fCšr|ƒš"Xƒž>û–r£–r£–6¦ZO–Ÿ¾ò%9ƒž¾–r7žnãž²˜(¼¼€€ƒ–«–#–ê?¾òk–‚Óš²‡š†€øƒšÒï–.Wš†€øƒ–£ž®gš†¾òo–B3–Æ“–>XÍÑ…ÉÑ}…Ðƒ¢òšfk¢¾ò#šZÃ’â+šzÛ–.w–ë¾ò$(¼¼ƒŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠVCŠV@)™Õ¹Ñ¥½¸Á¡½Ñ½Ñ¥Ù¥ÑåÑ¥Ù•9½Ü¡„°¹½Ý5Ì¥ì(€¥˜ …„ñð„¹¥Í}…Ñ¥Ù”ôôõ™…±Í”ñð„¹¥Í}…Ñ¥Ù”ôôô™…±Í”œ¤É•ÑÕÉ¸™…±Í”ì(€¥˜¡„¹¥Í}Õ¹±¥µ¥Ñ•ôôõÑÉÕ”ñð„¹¥Í}Õ¹±¥µ¥Ñ•ôôôÑÉÕ”œ¤É•ÑÕÉ¸ÑÉÕ”ì(€½¹ÍÐÍÐõ„¹ÍÑ…ÉÑ}…Ðý…Ñ”¹Á…ÉÍ”¡„¹ÍÑ…ÉÑ}…Ð¤é9…8ì(€½¹ÍÐ•¸õ„¹•¹‘}…Ðý…Ñ”¹Á…ÉÍ”¡„¹•¹‘}…Ð¤é9…8ì(€¥˜ …¥Í9…8¡ÍÐ¤˜™¹½Ý5ÌñÍÐ¤É•ÑÕÉ¸™…±Í”ì(€¥˜ …¥Í9…8¡•¸¤˜™¹½Ý5Ìù•¸¤É•ÑÕÉ¸™…±Í”ì(€É•ÑÕÉ¸ÑÉÕ”ì)ô)™Õ¹Ñ¥½¸¹½Éµ…±¥é•A¡½Ñ½M±Õœ¡É…Ü¥ì(€É•ÑÕÉ¸MÑÉ¥¹œ¡É…Ýñðœœ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤¹É•Á±…” ½my„µèÀ´äµt¬½œ°œ´œ¤¹É•Á±…” ½x´­ð´¬½œ°œœ¤¹Í±¥” À°àÀ¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸•ÑA¡½Ñ½Ñ¥Ù¥ÑåÉ…µ•Ì¡•¹Ø±P±…Ñ¥Ù¥Ñå%±…Ñ¥Ù•=¹±ä¥ì(€±•ÐÅÌõÑ•¹…¹Ñ}¥õ•Ä¸‘íQô™…Ñ¥Ù¥Ñå}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡…Ñ¥Ù¥Ñå%¥ô™Í•±•Ðô©€ì(€¥˜¡…Ñ¥Ù•=¹±ä¤ÅÌ¬ôœ™¥Í}…Ñ¥Ù”õ•Ä¹ÑÉÕ”œì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñå}™É…µ•Ìœ±ÅÌ¤ì(€É•ÑÕÉ¸€¡É½ÝÍññmt¤¹Í½ÉÐ ¡„±ˆ¤ôø¡9Õµ‰•È¡„¹Í½ÉÑ}½É‘•È¥ñðÀ¤´¡9Õµ‰•È¡ˆ¹Í½ÉÑ}½É‘•È¥ñðÀ¥ññMÑÉ¥¹œ¡„¹É•…Ñ•‘}…Ññðœœ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹É•…Ñ•‘}…Ññðœœ¤¤¤ì)ô(¼¼ƒ–³¦Z/¾òk–"_–ëžn»–&7šr'šV#žjš.7žŸšÒï–.W¾ò#’úošÒï–.W–6‡š"[–Û’î[–³¦Z/¦‚’öÿžR£¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡1¥ÍÑÑ¥Ù•A¡½Ñ½Ñ¥Ù¥Ñ¥•Ì¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì¥˜ …P¤É•ÑÕÉ¸©Í½¹=¬¡í…Ñ¥Ù¥Ñ¥•Ìémuô¤ì(€±•ÐÉ½ÝÌõmtì(€ÑÉåìÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñ¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðô©€¤ìô(€…Ñ ¡”¥ì±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è¡1¥ÍÑÑ¥Ù•A¡½Ñ½Ñ¥Ù¥Ñ¥•Ìœ±µ•ÍÍ…”èÉ•……Ñ¥Ù¥Ñ¥•Ì™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìÉ•ÑÕÉ¸©Í½¹=¬¡í…Ñ¥Ù¥Ñ¥•Ìémuô¤ìô(€½¹ÍÐ¹½Üõ…Ñ”¹¹½Ü ¤°½ÕÐõmtì(€™½È¡½¹ÍÐ„½˜€¡É½ÝÍññmt¤¹™¥±Ñ•È¡àôùÁ¡½Ñ½Ñ¥Ù¥ÑåÑ¥Ù•9½Ü¡à±¹½Ü¤¤¥ì(€€€½¹ÍÐ™É…µ•Ìõ…Ý…¥Ð•ÑA¡½Ñ½Ñ¥Ù¥ÑåÉ…µ•Ì¡•¹Ø±P±„¹¥±ÑÉÕ”¤¹…Ñ   ¤ôùmt¤ì(€€€¥˜ …™É…µ•Ì¹±•¹Ñ ¤½¹Ñ¥¹Õ”ì(€€€½ÕÐ¹ÁÕÍ ¡í¥é„¹¥±¹…µ”é„¹¹…µ•ñðœœ±Í±Õœé„¹Í±Õñðœœ±™É…µ•5½‘”é„¹™É…µ•}µ½‘•ñðÍ¥¹±”œ±‘•™…Õ±ÑÉ…µ•%é„¹‘•™…Õ±Ñ}™É…µ•}¥‘ñðœœ±Í½Á•QåÁ”é„¹Í½Á•}ÑåÁ•ñð¹½¹”œ±Í½Á•Ù•¹Ñ%é„¹Í½Á•}•Ù•¹Ñ}¥‘ñðœœ±Í½Á•M•ÍÍ¥½¹%é„¹Í½Á•}Í•ÍÍ¥½¹}¥‘ñðœœ±™É…µ•½Õ¹Ðé™É…µ•Ì¹±•¹Ñ ±ÁÉ•Ù¥•ÝUÉ°è¡™É…µ•Ì¹™¥¹¡˜ôùMÑÉ¥¹œ¡˜¹¥¤ôôõMÑÉ¥¹œ¡„¹‘•™…Õ±Ñ}™É…µ•}¥¤¥ññ™É…µ•ÍlÁuññíô¤¹™É…µ•}ÕÉ±ñðœô¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡í…Ñ¥Ù¥Ñ¥•Ìé½ÕÑô¤ì)ô(¼¼ƒ–³¦Z/¾òk’úw–në–ºkž~·žÚË–v–>[–ú_šÒï–.W¢"–£¦£–>¿žR£š†)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑA¡½Ñ½Ñ¥Ù¥Ñå	åM±Õœ¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì¥˜ …P¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡šÎW¢ú£¢¶c’âï¢ú›ž¦ë¦ZLœ¤ì(€½¹ÍÐÍ±Õœõ¹½Éµ…±¥é•A¡½Ñ½M±Õœ¡ˆ¹Í±Õññˆ¹…Ñ¥Ù¥ÑåM±Õñðœœ¤ì(€¥˜ …Í±Õœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂGš.7žŸšÒï–.Wž~·žÚË–v œ¤ì(€±•ÐÉ½ÝÌõmtì(€ÑÉåìÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñ¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í±Õœõ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í±Õœ¥ô™Í•±•Ðô©€¤ìô(€…Ñ ¡”¥ì±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è¡•ÑA¡½Ñ½Ñ¥Ù¥Ñå	åM±Õœœ±µ•ÍÍ…”èÉ•……Ñ¥Ù¥Ñä™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìÉ•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢º–>[–’ÇšV\œ¤ìô(€½¹ÍÐ„ô¡É½ÝÍññmt¥lÁtì(€¥˜ …„¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã¦g–/š.7žŸšÒï–.Tœ¤ì(€¥˜ …Á¡½Ñ½Ñ¥Ù¥ÑåÑ¥Ù•9½Ü¡„±…Ñ”¹¹½Ü ¤¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦g–/š.7žŸšÒï–.Wžn»–&7šr«¦Z/šRøœ¤ì(€½¹ÍÐ™É…µ•Ìõ…Ý…¥Ð•ÑA¡½Ñ½Ñ¥Ù¥ÑåÉ…µ•Ì¡•¹Ø±P±„¹¥±ÑÉÕ”¤¹…Ñ   ¤ôùmt¤ì(€¥˜ …™É…µ•Ì¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦g–/š.7žŸšÒï–.W–Âkšr«¢¢·–ºk–>¿žR£š.7žŸš†œ¤ì(€±•Ð‘•˜õ™É…µ•Ì¹™¥¹¡˜ôùMÑÉ¥¹œ¡˜¹¥¤ôôõMÑÉ¥¹œ¡„¹‘•™…Õ±Ñ}™É…µ•}¥¤¤ì¥˜ …‘•˜¤‘•˜õ™É…µ•ÍlÁtì(€É•ÑÕÉ¸©Í½¹=¬¡í…Ñ¥Ù¥Ñäéí¥é„¹¥±¹…µ”é„¹¹…µ•ñðœœ±Í±Õœé„¹Í±Õñðœœ±Á…•Q¥Ñ±”é„¹Á…•}Ñ¥Ñ±•ññ„¹¹…µ•ñðœœ±Á…•½¹Ñ•¹Ðé„¹Á…•}½¹Ñ•¹Ññðœœ±¡…Í¡Ñ…œé„¹¡…Í¡Ñ…ñðœœ±É•Ý…É‘Q•áÐé„¹É•Ý…É‘}Ñ•áÑñðœœ±™É…µ•5½‘”é„¹™É…µ•}µ½‘•ñðÍ¥¹±”œ±‘•™…Õ±ÑÉ…µ•%é‘•˜¹¥±Í½Á•QåÁ”é„¹Í½Á•}ÑåÁ•ñð¹½¹”ô±™É…µ•Ìé™É…µ•Ì¹µ…À¡˜ôø¡í¥é˜¹¥±¹…µ”é˜¹¹…µ•ñðœœ±™É…µ•UÉ°é˜¹™É…µ•}ÕÉ±ñðœœ±Í½ÉÑ=É‘•Èé9Õµ‰•È¡˜¹Í½ÉÑ}½É‘•È¥ñðÀ±¥ÍÑ¥Ù”éÑÉÕ•ô¤¥ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡MÕ‰µ¥ÑA¡½Ñ½1•…¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì¥˜ …P¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡šÎW¢ú£¢¶c’âï¢ú›ž¦ë¦ZLœ¤ì(€½¹ÍÐ…Ñ¥Ù¥Ñå%õMÑÉ¥¹œ¡ˆ¹…Ñ¥Ù¥Ñå%‘ñðœœ¤¹ÑÉ¥´ ¤°™É…µ•%õMÑÉ¥¹œ¡ˆ¹™É…µ•%‘ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ ……Ñ¥Ù¥Ñå%‘ñð…™É…µ•%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂGš.7žŸšÒï–.Wš"[š.7žŸš†œ¤ì(€½¹ÍÐÙ…±¥õ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñå}™É…µ•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™…Ñ¥Ù¥Ñå}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡…Ñ¥Ù¥Ñå%¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡™É…µ•%¥ô™¥Í}…Ñ¥Ù”õ•Ä¹ÑÉÕ”™Í•±•Ðõ¥‘€¤¹…Ñ   ¤ôùmt¤ì(€¥˜ …Ù…±¥‘lÁt¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš.7žŸš†’â7–¶c–r£š"[–ÞË–sžR œ¤ì(€½¹ÍÐ¹…µ”õMÑÉ¥¹œ¡ˆ¹¹…µ•ñðœœ¤¹ÑÉ¥´ ¤°•µ…¥°õMÑÉ¥¹œ¡ˆ¹•µ…¥±ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …¹…µ”¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–†¯–žO–B7š"[šjÇž¢Äœ¤ì(€¥˜ „½ymyqÍt­myqÍt­p¹myqÍt¬¼¹Ñ•ÍÐ¡•µ…¥°¤¤É•ÑÕÉ¸©Í½¹ÉÈ µ…¥°ƒš‚ó–ò?’â7š¶žŠèœ¤ì(€½¹ÍÐ¥õ•¹% A1œ¤ì(€ÑÉåì…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á¡½Ñ½}±•…‘Ìœ±í¥±Ñ•¹…¹Ñ}¥éP±…Ñ¥Ù¥Ñå}¥é…Ñ¥Ù¥Ñå%±™É…µ•}¥é™É…µ•%±•Ù•¹Ñ}¥éMÑÉ¥¹œ¡ˆ¹•Ù•¹Ñ%‘ñðœœ¥ññ¹Õ±°±Í•ÍÍ¥½¹}¥éMÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%‘ñðœœ¥ññ¹Õ±°±¹…µ”±•µ…¥°±Á¡½¹”éMÑÉ¥¹œ¡ˆ¹Á¡½¹•ñðœœ¤¹ÑÉ¥´ ¤±™¥ÉÍÑ}Ñ¥µ”éMÑÉ¥¹œ¡ˆ¹™¥ÉÍÑQ¥µ•ñðœœ¤±Í½ÕÉ”éMÑÉ¥¹œ¡ˆ¹Í½ÕÉ•ñðœœ¤±µ…É­•Ñ¥¹}½¹Í•¹Ðè¡ˆ¹½¹Í•¹ÐôôõÑÉÕ•ññˆ¹½¹Í•¹ÐôôôÑÉÕ”œ¤±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ìô(€…Ñ ¡”¥ì±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è¡MÕ‰µ¥ÑA¡½Ñ½1•…œ±µ•ÍÍ…”è¥¹Í•ÉÐ±•…™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìÉ•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦–ë–’ÇšV_¾ò3¢®/ž¢7–ú3–7¢¦˜œ¤ìô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥‘ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡1¥ÍÑA¡½Ñ½Ñ¥Ù¥Ñ¥•Ì¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ…ÑÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñ¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðô©€¤ì(€½¹ÍÐ™É…µ•Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñå}™É…µ•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐ±•…‘Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}±•…‘Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðõ…Ñ¥Ù¥Ñå}¥±™É…µ•}¥±µ…É­•Ñ¥¹}½¹Í•¹Ñ€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐ½ÕÐô¡…ÑÍññmt¤¹µ…À¡„ôùì(€€€½¹ÍÐ™Ìô¡™É…µ•Íññmt¤¹™¥±Ñ•È¡˜ôùMÑÉ¥¹œ¡˜¹…Ñ¥Ù¥Ñå}¥¤ôôõMÑÉ¥¹œ¡„¹¥¤¤¹Í½ÉÐ ¡à±ä¤ôø¡9Õµ‰•È¡à¹Í½ÉÑ}½É‘•È¥ñðÀ¤´¡9Õµ‰•È¡ä¹Í½ÉÑ}½É‘•È¥ñðÀ¤¤ì(€€€½¹ÍÐ±Ìô¡±•…‘Íññmt¤¹™¥±Ñ•È¡°ôùMÑÉ¥¹œ¡°¹…Ñ¥Ù¥Ñå}¥¤ôôõMÑÉ¥¹œ¡„¹¥¤¤ì(€€€É•ÑÕÉ¸=‰©•Ð¹…ÍÍ¥¸¡íô±„±í™É…µ•Ìé™Ì±±•…‘}½Õ¹Ðé±Ì¹±•¹Ñ ±½¹Í•¹Ñ}½Õ¹Ðé±Ì¹™¥±Ñ•È¡°ôù°¹µ…É­•Ñ¥¹}½¹Í•¹ÐôôõÑÉÕ•ññ°¹µ…É­•Ñ¥¹}½¹Í•¹ÐôôôÑÉÕ”œ¤¹±•¹Ñ¡ô¤ì(€ô¤¹Í½ÉÐ ¡„±ˆÈ¤ôùMÑÉ¥¹œ¡ˆÈ¹É•…Ñ•‘}…Ññðœœ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹É•…Ñ•‘}…Ññðœœ¤¤¤ì(€É•ÑÕÉ¸©Í½¹=¬¡í…Ñ¥Ù¥Ñ¥•Ìé½ÕÐ±Ñ½Ñ…±}±•…‘Ìè¡±•…‘Íññmt¤¹±•¹Ñ¡ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•A¡½Ñ½Ñ¥Ù¥Ñä¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ¹…µ”õMÑÉ¥¹œ¡ˆ¹¹…µ•ñðœœ¤¹ÑÉ¥´ ¤ì¥˜ …¹…µ”¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–†¯š.7žŸšÒï–.W–B7ž¢Äœ¤ì(€±•ÐÍ±Õœõ¹½Éµ…±¥é•A¡½Ñ½M±Õœ¡ˆ¹Í±Õñðœœ¤ì¥˜ …Í±Õœ¤Í±ÕœôÁ¡½Ñ¼´œ­ÉåÁÑ¼¹É…¹‘½µUU% ¤¹É•Á±…” ¼´½œ°œœ¤¹Í±¥” À°à¤ì(€½¹ÍÐµ½‘”õMÑÉ¥¹œ¡ˆ¹™É…µ•5½‘•ñðÍ¥¹±”œ¤ôôôµÕ±Ñ¥Á±”œüµÕ±Ñ¥Á±”œèÍ¥¹±”œì(€½¹ÍÐÍ½Á”õl¹½¹”œ°…±°œ°•Ù•¹Ðœ°Í•ÍÍ¥½¸t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡ˆ¹Í½Á•QåÁ•ñðœœ¤¤ýMÑÉ¥¹œ¡ˆ¹Í½Á•QåÁ”¤è¹½¹”œì(€¥˜¡Í½Á”ôôô•Ù•¹Ðœ˜˜…MÑÉ¥¹œ¡ˆ¹Í½Á•Ù•¹Ñ%‘ñðœœ¤¹ÑÉ¥´ ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¦ãšNšÒï–.Tœ¤ì(€¥˜¡Í½Á”ôôôÍ•ÍÍ¥½¸œ˜˜…MÑÉ¥¹œ¡ˆ¹Í½Á•M•ÍÍ¥½¹%‘ñðœœ¤¹ÑÉ¥´ ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¦ãšN–‚Óš²„œ¤ì(€½¹ÍÐÕ¹±¥µ¥Ñ•õˆ¹¥ÍU¹±¥µ¥Ñ•ôôõÑÉÕ•ññˆ¹¥ÍU¹±¥µ¥Ñ•ôôôÑÉÕ”œ°ÍÑ…ÉÑÐõMÑÉ¥¹œ¡ˆ¹ÍÑ…ÉÑÑñðœœ¤¹ÑÉ¥´ ¤°•¹‘ÐõMÑÉ¥¹œ¡ˆ¹•¹‘Ññðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …Õ¹±¥µ¥Ñ•˜™ÍÑ…ÉÑÐ˜™•¹‘Ð˜™…Ñ”¹Á…ÉÍ”¡•¹‘Ð¤ñ…Ñ”¹Á…ÉÍ”¡ÍÑ…ÉÑÐ¤¤É•ÑÕÉ¸©Í½¹ÉÈ ŸžÖCšvšf¦ZO’â7–>¿š^§šZó¦Z/–ž/šf¦ZLœ¤ì(€½¹ÍÐ¥õMÑÉ¥¹œ¡ˆ¹…Ñ¥Ù¥Ñå%‘ñðœœ¤¹ÑÉ¥´ ¥ññ•¹% A!œ¤ì(€½¹ÍÐ‘ÕÁ”õ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñ¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í±Õœõ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í±Õœ¥ô™Í•±•Ðõ¥‘€¤¹…Ñ   ¤ôùmt¤ì(€¥˜¡‘ÕÁ”¹Í½µ”¡àôùMÑÉ¥¹œ¡à¹¥¤„ôõ¥¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž~·žÚË–v’îžŠó–ÞË¢Š¯’öÿžR œ¤ì(€½¹ÍÐÁ…å±½…õíÑ•¹…¹Ñ}¥éP±¹…µ”±Í±Õœ±Á…•}Ñ¥Ñ±”éMÑÉ¥¹œ¡ˆ¹Á…•Q¥Ñ±•ñðœœ¤¹ÑÉ¥´ ¥ññ¹…µ”±Á…•}½¹Ñ•¹ÐéMÑÉ¥¹œ¡ˆ¹Á…•½¹Ñ•¹Ññðœœ¤±¡…Í¡Ñ…œéMÑÉ¥¹œ¡ˆ¹¡…Í¡Ñ…ñðœœ¤±É•Ý…É‘}Ñ•áÐéMÑÉ¥¹œ¡ˆ¹É•Ý…É‘Q•áÑñðœœ¤±™É…µ•}µ½‘”éµ½‘”±Í½Á•}ÑåÁ”éÍ½Á”±Í½Á•}•Ù•¹Ñ}¥éÍ½Á”ôôô•Ù•¹ÐœýMÑÉ¥¹œ¡ˆ¹Í½Á•Ù•¹Ñ%‘ñðœœ¤¹ÑÉ¥´ ¤é¹Õ±°±Í½Á•}Í•ÍÍ¥½¹}¥éÍ½Á”ôôôÍ•ÍÍ¥½¸œýMÑÉ¥¹œ¡ˆ¹Í½Á•M•ÍÍ¥½¹%‘ñðœœ¤¹ÑÉ¥´ ¤é¹Õ±°±¥Í}Õ¹±¥µ¥Ñ•éÕ¹±¥µ¥Ñ•±ÍÑ…ÉÑ}…Ðè …Õ¹±¥µ¥Ñ•˜™ÍÑ…ÉÑÐ¤ýÍÑ…ÉÑÐé¹Õ±°±•¹‘}…Ðè …Õ¹±¥µ¥Ñ•˜™•¹‘Ð¤ý•¹‘Ðé¹Õ±°±¥Í}…Ñ¥Ù”è„¡ˆ¹¥ÍÑ¥Ù”ôôõ™…±Í•ññˆ¹¥ÍÑ¥Ù”ôôô™…±Í”œ¤±¹½Ñ”éMÑÉ¥¹œ¡ˆ¹¹½Ñ•ñðœœ¤±ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ôì(€¥˜¡ˆ¹…Ñ¥Ù¥Ñå%¤…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñ¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€±Á…å±½…¤ì(€•±Í”…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñ¥•Ìœ±=‰©•Ð¹…ÍÍ¥¸¡í¥±‘•™…Õ±Ñ}™É…µ•}¥é¹Õ±°±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô±Á…å±½…¤¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥±Í±Õô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•A¡½Ñ½Ñ¥Ù¥ÑåÉ…µ”¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ…Ñ¥Ù¥Ñå%õMÑÉ¥¹œ¡ˆ¹…Ñ¥Ù¥Ñå%‘ñðœœ¤¹ÑÉ¥´ ¤ì¥˜ ……Ñ¥Ù¥Ñå%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂGš.7žŸšÒï–.Tœ¤ì(€½¹ÍÐ¹…µ”õMÑÉ¥¹œ¡ˆ¹¹…µ•ñðœœ¤¹ÑÉ¥´ ¤°™É…µ•UÉ°õMÑÉ¥¹œ¡ˆ¹™É…µ•UÉ±ñðœœ¤¹ÑÉ¥´ ¤ì¥˜ …¹…µ”¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–†¯š†–B7ž¢Äœ¤ì¥˜ …™É…µ•UÉ°¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/’â+–
Ïš.7žŸš†œ¤ì(€½¹ÍÐ…Ðõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñ¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡…Ñ¥Ù¥Ñå%¥ô™Í•±•Ðõ¥±™É…µ•}µ½‘”±‘•™…Õ±Ñ}™É…µ•}¥‘€¤¹…Ñ   ¤ôùmt¤ì¥˜ ……ÑlÁt¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ãš.7žŸšÒï–.Tœ¤ì(€½¹ÍÐ¥õMÑÉ¥¹œ¡ˆ¹™É…µ•%‘ñðœœ¤¹ÑÉ¥´ ¥ññ•¹% Aœ¤ì(€½¹ÍÐÁ…å±½…õíÑ•¹…¹Ñ}¥éP±…Ñ¥Ù¥Ñå}¥é…Ñ¥Ù¥Ñå%±¹…µ”±™É…µ•}ÕÉ°é™É…µ•UÉ°±Í½ÉÑ}½É‘•Èé5…Ñ ¹µ…à À±9Õµ‰•È¡ˆ¹Í½ÉÑ=É‘•È¥ñðÀ¤±¥Í}…Ñ¥Ù”è„¡ˆ¹¥ÍÑ¥Ù”ôôõ™…±Í•ññˆ¹¥ÍÑ¥Ù”ôôô™…±Í”œ¤±ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ôì(€¥˜¡ˆ¹™É…µ•%¤…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñå}™É…µ•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™…Ñ¥Ù¥Ñå}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡…Ñ¥Ù¥Ñå%¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€±Á…å±½…¤ì(€•±Í”…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñå}™É…µ•Ìœ±=‰©•Ð¹…ÍÍ¥¸¡í¥±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô±Á…å±½…¤¤ì(€¥˜¡ˆ¹¥Í•™…Õ±ÐôôõÑÉÕ•ññˆ¹¥Í•™…Õ±ÐôôôÑÉÕ”ñð……ÑlÁt¹‘•™…Õ±Ñ}™É…µ•}¥¤…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñ¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡…Ñ¥Ù¥Ñå%¥õ€±í‘•™…Õ±Ñ}™É…µ•}¥é¥±ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥‘ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•±•Ñ•A¡½Ñ½Ñ¥Ù¥ÑåÉ…µ”¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ…Ñ¥Ù¥Ñå%õMÑÉ¥¹œ¡ˆ¹…Ñ¥Ù¥Ñå%‘ñðœœ¤¹ÑÉ¥´ ¤°™É…µ•%õMÑÉ¥¹œ¡ˆ¹™É…µ•%‘ñðœœ¤¹ÑÉ¥´ ¤ì¥˜ ……Ñ¥Ù¥Ñå%‘ñð…™É…µ•%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂGš.7žŸšÒï–.Wš"[š†œ¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñå}™É…µ•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™…Ñ¥Ù¥Ñå}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡…Ñ¥Ù¥Ñå%¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡™É…µ•%¥õ€¤ì(€½¹ÍÐ±•™Ðõ…Ý…¥Ð•ÑA¡½Ñ½Ñ¥Ù¥ÑåÉ…µ•Ì¡•¹Ø±P±…Ñ¥Ù¥Ñå%±™…±Í”¤¹…Ñ   ¤ôùmt¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñ¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡…Ñ¥Ù¥Ñå%¥õ€±í‘•™…Õ±Ñ}™É…µ•}¥é±•™ÑlÁtü¹¥‘ññ¹Õ±°±ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•±•Ñ•A¡½Ñ½Ñ¥Ù¥Ñä¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ¥õMÑÉ¥¹œ¡ˆ¹…Ñ¥Ù¥Ñå%‘ñðœœ¤¹ÑÉ¥´ ¤ì¥˜ …¥¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂGš.7žŸšÒï–.Tœ¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Á¡½Ñ½}…Ñ¥Ù¥Ñ¥•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡1¥ÍÑA¡½Ñ½1•…‘Ì¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€±•ÐÅÌõÑ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðô©€ì(€¥˜¡ˆ¹…Ñ¥Ù¥Ñå%¤ÅÌ¬õ€™…Ñ¥Ù¥Ñå}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹…Ñ¥Ù¥Ñå%¥õ€ì(€¥˜¡ˆ¹™É…µ•%¤ÅÌ¬õ€™™É…µ•}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹™É…µ•%¥õ€ì(€¥˜¡ˆ¹Í½ÕÉ”¤ÅÌ¬õ€™Í½ÕÉ”õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í½ÕÉ”¥õ€ì(€¥˜¡ˆ¹½¹Í•¹Ñ=¹±äôôõÑÉÕ•ññˆ¹½¹Í•¹Ñ=¹±äôôôÑÉÕ”œ¤ÅÌ¬ôœ™µ…É­•Ñ¥¹}½¹Í•¹Ðõ•Ä¹ÑÉÕ”œì(€¥˜¡ˆ¹™É½´¤ÅÌ¬õ€™É•…Ñ•‘}…ÐõÑ”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹™É½´¥õ€ì(€¥˜¡ˆ¹Ñ¼¤ÅÌ¬õ€™É•…Ñ•‘}…Ðõ±Ñ”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Ñ¼¥õ€ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}±•…‘Ìœ±ÅÌ¤°±¥ÍÐô¡É½ÝÍññmt¤¹Í½ÉÐ ¡„±ˆÈ¤ôùMÑÉ¥¹œ¡ˆÈ¹É•…Ñ•‘}…Ññðœœ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹É•…Ñ•‘}…Ññðœœ¤¤¤ì(€½¹ÍÐ‰åM½ÕÉ”õíôì™½È¡½¹ÍÐ°½˜±¥ÍÐ¥í½¹ÍÐ¬õMÑÉ¥¹œ¡°¹Í½ÕÉ•ñðŸšr«–†¬œ¤í‰åM½ÕÉ•m­tô¡‰åM½ÕÉ•m­uñðÀ¤¬Äíô(€É•ÑÕÉ¸©Í½¹=¬¡í±•…‘Ìé±¥ÍÐ±Ñ½Ñ…°é±¥ÍÐ¹±•¹Ñ ±½¹Í•¹Ñ}Ñ½Ñ…°é±¥ÍÐ¹™¥±Ñ•È¡°ôù°¹µ…É­•Ñ¥¹}½¹Í•¹ÐôôõÑÉÕ•ññ°¹µ…É­•Ñ¥¹}½¹Í•¹ÐôôôÑÉÕ”œ¤¹±•¹Ñ ±‰å}Í½ÕÉ”é‰åM½ÕÉ•ô¤ì)ô((¼¼ƒšÒï–.W–B7–Z»¾òkš*+Ž3š.7žŸš†–B7–Z»¾ò#šÂGžrû¾ò'Ž7¢"Ž3šr–N‡¾ò#šR“–V¾ò'Ž7’î”µ…¥°ƒ–B#’ö×–:ï¦7¾ò0(¼¼ƒžR‹žR–Z»’â’î÷–>¿–7¢†3¦*ßžj’êë–B7–Z»Ž–>«¢º’â7–¾¯¾ò3’â7–îëž®/’îï’öWšr–N‡Ž)…Íå¹Œ™Õ¹Ñ¥½¸¡1¥ÍÑ½¹Ñ…Ñ1•…‘Ì¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€±•Ð±•…‘Ìõmt°µ•µÌõmtì(€ÑÉåì±•…‘Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á¡½Ñ½}±•…‘Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðõ¹…µ”±•µ…¥°±Á¡½¹”±Í½ÕÉ”±™¥ÉÍÑ}Ñ¥µ”±µ…É­•Ñ¥¹}½¹Í•¹Ð±™É…µ•}¥±Í•ÍÍ¥½¹}¥±É•…Ñ•‘}…Ñ€¤ìõ…Ñ ¡”¥ì±•…‘Ìõmtìô(€ÑÉåìµ•µÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðõ¹…µ”±‘¥ÍÁ±…å}¹…µ”±‰É…¹‘}¹…µ”±•µ…¥°±Á¡½¹”±©½¥¹•‘}…Ð±±…ÍÑ}±½¥¹}…Ñ€¤ìõ…Ñ ¡”¥ìµ•µÌõmtìô(€½¹ÍÐµ…Àõíôì(€½¹ÍÐ­•å=˜õ”ôùMÑÉ¥¹œ¡•ñðœœ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤ì(€™½È¡½¹ÍÐ°½˜€¡±•…‘Íññmt¤¥ì(€€€½¹ÍÐ¬õ­•å=˜¡°¹•µ…¥°¤ì¥˜ …¬¤½¹Ñ¥¹Õ”ì(€€€½¹ÍÐÕÈõµ…Ám­uññí•µ…¥°éMÑÉ¥¹œ¡°¹•µ…¥±ñðœœ¤¹ÑÉ¥´ ¤±¹…µ”èœœ±Á¡½¹”èœœ±¥ÍAÕ‰±¥Œé™…±Í”±¥ÍY•¹‘½Èé™…±Í”±‰É…¹èœœ±½¹Í•¹Ðé™…±Í”±Í½ÕÉ•Ìémt±±…ÍÑÐèœôì(€€€ÕÈ¹¹…µ”õÕÈ¹¹…µ•ññMÑÉ¥¹œ¡°¹¹…µ•ñðœœ¤ì(€€€ÕÈ¹Á¡½¹”õÕÈ¹Á¡½¹•ññMÑÉ¥¹œ¡°¹Á¡½¹•ñðœœ¤ì(€€€ÕÈ¹¥ÍAÕ‰±¥ŒõÑÉÕ”ì(€€€¥˜¡°¹µ…É­•Ñ¥¹}½¹Í•¹ÐôôõÑÉÕ•ññ°¹µ…É­•Ñ¥¹}½¹Í•¹ÐôôôÑÉÕ”œ¤ÕÈ¹½¹Í•¹ÐõÑÉÕ”ì(€€€½¹ÍÐÍÉŒõMÑÉ¥¹œ¡°¹Í½ÕÉ•ñðœœ¤¹ÑÉ¥´ ¤ì¥˜¡ÍÉŒ€˜˜ÕÈ¹Í½ÕÉ•Ì¹¥¹‘•á=˜¡ÍÉŒ¤ðÀ¤ÕÈ¹Í½ÕÉ•Ì¹ÁÕÍ ¡ÍÉŒ¤ì(€€€½¹ÍÐÐõMÑÉ¥¹œ¡°¹É•…Ñ•‘}…Ññðœœ¤ì¥˜¡ÐùÕÈ¹±…ÍÑÐ¤ÕÈ¹±…ÍÑÐõÐì(€€€µ…Ám­tõÕÈì(€ô(€™½È¡½¹ÍÐ´½˜€¡µ•µÍññmt¤¥ì(€€€½¹ÍÐ¬õ­•å=˜¡´¹•µ…¥°¤ì¥˜ …¬¤½¹Ñ¥¹Õ”ì(€€€½¹ÍÐÕÈõµ…Ám­uññí•µ…¥°éMÑÉ¥¹œ¡´¹•µ…¥±ñðœœ¤¹ÑÉ¥´ ¤±¹…µ”èœœ±Á¡½¹”èœœ±¥ÍAÕ‰±¥Œé™…±Í”±¥ÍY•¹‘½Èé™…±Í”±‰É…¹èœœ±½¹Í•¹Ðé™…±Í”±Í½ÕÉ•Ìémt±±…ÍÑÐèœôì(€€€ÕÈ¹¹…µ”õÕÈ¹¹…µ•ññMÑÉ¥¹œ¡´¹¹…µ•ññ´¹‘¥ÍÁ±…å}¹…µ•ñðœœ¤ì(€€€ÕÈ¹Á¡½¹”õÕÈ¹Á¡½¹•ññMÑÉ¥¹œ¡´¹Á¡½¹•ñðœœ¤ì(€€€ÕÈ¹‰É…¹õÕÈ¹‰É…¹‘ññMÑÉ¥¹œ¡´¹‰É…¹‘}¹…µ•ñðœœ¤ì(€€€ÕÈ¹¥ÍY•¹‘½ÈõÑÉÕ”ì(€€€½¹ÍÐÐõMÑÉ¥¹œ¡´¹±…ÍÑ}±½¥¹}…Ñññ´¹©½¥¹•‘}…Ññðœœ¤ì¥˜¡ÐùÕÈ¹±…ÍÑÐ¤ÕÈ¹±…ÍÑÐõÐì(€€€µ…Ám­tõÕÈì(€ô(€½¹ÍÐ±¥ÍÐõ=‰©•Ð¹­•åÌ¡µ…À¤¹µ…À¡¬ôùµ…Ám­t¤¹Í½ÉÐ ¡„±ˆÈ¤ôùMÑÉ¥¹œ¡ˆÈ¹±…ÍÑÑñðœœ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡„¹±…ÍÑÑñðœœ¤¤¤ì(€É•ÑÕÉ¸©Í½¹=¬¡ì(€€€½¹Ñ…ÑÌé±¥ÍÐ°(€€€Ñ½Ñ…°é±¥ÍÐ¹±•¹Ñ °(€€€½¹Í•¹Ñ}Ñ½Ñ…°é±¥ÍÐ¹™¥±Ñ•È¡àôùà¹½¹Í•¹Ð¤¹±•¹Ñ °(€€€ÁÕ‰±¥}Ñ½Ñ…°é±¥ÍÐ¹™¥±Ñ•È¡àôùà¹¥ÍAÕ‰±¥Œ¤¹±•¹Ñ °(€€€Ù•¹‘½É}Ñ½Ñ…°é±¥ÍÐ¹™¥±Ñ•È¡àôùà¹¥ÍY•¹‘½È¤¹±•¹Ñ °(€€€‰½Ñ¡}Ñ½Ñ…°é±¥ÍÐ¹™¥±Ñ•È¡àôùà¹¥ÍAÕ‰±¥Œ˜™à¹¥ÍY•¹‘½È¤¹±•¹Ñ (€ô¤ì)ô((¼¼ƒŠRŠR ƒ–âãžR£–‚Ó–rÃ–r[–ê¯¾ò#žžš"Û–Æ“žÒk–>¿¦7žR£¾òk–r[ž&€¬ƒšVÓ’î÷šR“’ö7šâ–Z»¾ò$ƒŠRŠR )™Õ¹Ñ¥½¸¹½Éµ…±¥é•Y•¹Õ•5…ÁM•…ÑÌ¡É…Ü¥ì(€½¹ÍÐÁ…ÉÍ•õÍ…™•)Í½¸¡É…Ü±mt¤ì(€¥˜¡ÉÉ…ä¹¥ÍÉÉ…ä¡Á…ÉÍ•¤¤É•ÑÕÉ¸Á…ÉÍ•ì(€¥˜¡Á…ÉÍ•€˜˜ÉÉ…ä¹¥ÍÉÉ…ä¡Á…ÉÍ•¹Í•…ÑÌ¤¤É•ÑÕÉ¸Á…ÉÍ•¹Í•…ÑÌì(€¥˜¡Á…ÉÍ•€˜˜ÉÉ…ä¹¥ÍÉÉ…ä¡Á…ÉÍ•¹¥Ñ•µÌ¤¤É•ÑÕÉ¸Á…ÉÍ•¹¥Ñ•µÌì(€É•ÑÕÉ¸mtì)ô(¼¼ƒ¦ã’ö7¢¢·–ºk–R¿’âš¶¢š?–2[’úšêC¾òk–ú3–>Ã–>«žº‡žBŽ3šR“’ö7¾ò#–në–ºk¾ò'¾ò?šr7–.g–>Ã¾ò?žšžR£Ž7Ž(¼¼ƒ–në–ºkšR“’ö7žRÄÁÉ¥”ƒ¢«–.Wšbƒ–Âž
è…ÕÑ¿¾ò Àƒ–¾ò'š"XÁ…¥“¾ò øÀƒ–¾ò'¾òo¢"(…Ñ•½Éäƒ’â7–7šÊÿžR£Ž)™Õ¹Ñ¥½¸¹½Éµ…±¥é•M•…Ñ½¹™¥%Ñ•´¡É…Üõíô°¥¹‘•àôÀ¥ì(€½¹ÍÐ½‘”õMÑÉ¥¹œ¡É…Ü¹½‘•ññÉ…Ü¹ÍÑ…±±9½ññÉ…Ü¹ÍÑ…±±}¹½ñðœœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ½±‘QåÁ”õ¹½Éµ…±¥é•M•…ÑQåÁ”¡É…Ü¹ÑåÁ•ññÉ…Ü¹Í•…ÑQåÁ•ññÉ…Ü¹Í•…Ñ}ÑåÁ•ñð…ÕÑ¼œ¤ì(€½¹ÍÐ±•…å%¹…Ñ¥Ù”ô¡É…Ü¹…Ñ¥Ù”ôôõ™…±Í•ññÉ…Ü¹…Ñ¥Ù”ôôô™…±Í”ññÉ…Ü¹¥Í}…Ñ¥Ù”ôôõ™…±Í•ññÉ…Ü¹¥Í}…Ñ¥Ù”ôôô™…±Í”œ¤ì(€±•Ð­¥¹ô¡½±‘QåÁ”ôôôÍ•ÉÙ¥”œ¤üÍ•ÉÙ¥”œè ¡½±‘QåÁ”ôôô±½Í•ññ±•…å%¹…Ñ¥Ù”¤ü±½Í•œè™¥á•œ¤ì(€±•ÐÁÉ¥”õ5…Ñ ¹µ…à À±Í…™•9Õ´¡É…Ü¹ÁÉ¥•ññÉ…Ü¹ÁÉ¥••±Ñ…ññÉ…Ü¹ÁÉ¥•}‘•±Ñ„¤¤ì(€¥˜¡­¥¹„ôô™¥á•œ¤ÁÉ¥”ôÀì(€½¹ÍÐÑåÁ”õ­¥¹ôôôÍ•ÉÙ¥”œüÍ•ÉÙ¥”œé­¥¹ôôô±½Í•œü±½Í•œè¡ÁÉ¥”øÀüÁ…¥œè…ÕÑ¼œ¤ì(€É•ÑÕÉ¸ì(€€€½‘”°(€€€ÑåÁ”°(€€€ÁÉ¥”°(€€€àéÍ…™•9Õ´¡É…Ü¹àüýÉ…Ü¹µ…Á`üýÉ…Ü¹µ…Á}à¤°(€€€äéÍ…™•9Õ´¡É…Ü¹äüýÉ…Ü¹µ…ÁdüýÉ…Ü¹µ…Á}ä¤°(€€€É½Ñ…Ñ¥½¸è ¡Í…™•9Õ´¡É…Ü¹É½Ñ…Ñ¥½¸üýÉ…Ü¹µ…ÁI½Ñ…Ñ¥½¸üýÉ…Ü¹µ…Á}É½Ñ…Ñ¥½¸¤”ÌØÀ¤¬ÌØÀ¤”ÌØÀ°(€€€½É‘•ÈéÍ…™•9Õ´¡É…Ü¹½É‘•ÉññÉ…Ü¹µ…Á=É‘•ÉññÉ…Ü¹µ…Á}½É‘•È¥ññ¥¹‘•à¬Ä°(€€€¹½Ñ”éMÑÉ¥¹œ¡É…Ü¹¹½Ñ•ñðœœ¤°(€€€…Ñ¥Ù”éÑåÁ”ôôô…ÕÑ¼ññÑåÁ”ôôôÁ…¥œ°(€€€…Ñ•½Éäèœœ(€ôì)ô)™Õ¹Ñ¥½¸¹½Éµ…±¥é•M•…Ñ½¹™¥1¥ÍÐ¡É…Ü¥ì(€É•ÑÕÉ¸¹½Éµ…±¥é•Y•¹Õ•5…ÁM•…ÑÌ¡É…Ü¤¹µ…À ¡¥Ñ•´±¥¹‘•à¤ôù¹½Éµ…±¥é•M•…Ñ½¹™¥%Ñ•´¡¥Ñ•´±¥¹‘•à¤¤¹™¥±Ñ•È¡¥Ñ•´ôù¥Ñ•´¹½‘”¤ì)ô)™Õ¹Ñ¥½¸Í•…Ñ5…ÁÁÁ±åÉÉ½É5•ÍÍ…”¡•ÉÈ¥ì(€½¹ÍÐ´õMÑÉ¥¹œ¡•ÉÈ˜™•ÉÈ¹µ•ÍÍ…”ý•ÉÈ¹µ•ÍÍ…”é•ÉÉñðœœ¤ì(€¥˜ ½½±Õµ¸¸©¹Õµ‰•Éñ½Õ±¹½Ð™¥¹¸©¹Õµ‰•È½¤¹Ñ•ÍÐ¡´¤¤É•ÑÕÉ¸€Ÿ¢ÎšZg–ê¯šR“’ö7š²’ö7ž&#šr³’â7’â¢Ó¾ò#¢"(¹Õµ‰•Èƒš²’ö7¾ò'¾ò3¢®/šnÓšZÀ]½É­•Èƒ–ú3–7¢¦›Žœì(€¥˜ ½Í•…Ñ}…ÍÍ¥¹}‘…åÍ}‰•™½É”½¤¹Ñ•ÍÐ¡´¤¤É•ÑÕÉ¸€Ÿ¢ÎšZg–ê¯žòë–ÂG¢«–.Wš:K’ö7¢¢·–ºkš²’ö7¾ò3¢®/–#–~ß¢†3š¶–ò?–‚Ó–rÃ–r[¢ÎšZg–ê¯šnÓšZÃŽœì(€¥˜ ½Ù•¹Õ•}µ…Á}Ñ•µÁ±…Ñ•}¥½¤¹Ñ•ÍÐ¡´¤¤É•ÑÕÉ¸€Ÿ¢ÎšZg–ê¯žòë–ÂG–âãžR£–‚Ó–rÃ–r[¦^s¢¿š²’ö7¾ò3¢®/–#–~ß¢†3š¶–ò?–‚Ó–rÃ–r[¢ÎšZg–ê¯šnÓšZÃŽœì(€¥˜ ½‘ÕÁ±¥…Ñ”­•åñÕ¹¥ÅÕ”½¹ÍÑÉ…¥¹Ð½¤¹Ñ•ÍÐ¡´¤¤É•ÑÕÉ¸€Ÿ–‚Ó–rÃ–r[–Ÿšr'¦7¢’šR“’ö7¢fžŠó¾ò3¢®/šª‹š~—–âãžR£–r[¢fžŠóŽœì(€É•ÑÕÉ¸€Ÿ¢ÎšZg–ê¯–¾¯–—–’ÇšV_¾ò3¦2¿¢ª“–ÞË¢¢c¦2Žœì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡1¥ÍÑY•¹Õ•5…ÁÌ¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Ù•¹Õ•}µ…Á}Ñ•µÁ±…Ñ•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô¨™½É‘•ÈõÕÁ‘…Ñ•‘}…Ð¹‘•Í€¤ì(€€¼¼Í•…ÑÍ}©Í½¸ƒž
è)M=9¾òo¢"+¢ÎšZg–>¿¢÷šnû¢Š¯–¶cš"@)M=8ƒ–¶_’âË¾ò3–n{–
Ï–&7’â–ú/š¶¢š?–2[š"C¦f–"_Ž(€½¹ÍÐµ…ÁÌô¡É½ÝÍññmt¤¹µ…À¡Èôø¡ì¸¸¹È±Í•…ÑÍ}©Í½¸é¹½Éµ…±¥é•M•…Ñ½¹™¥1¥ÍÐ¡È¹Í•…ÑÍ}©Í½¸¥ô¤¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íµ…ÁÍô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•Y•¹Õ•5…À¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ¹…µ”õMÑÉ¥¹œ¡ˆ¹¹…µ•ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …¹…µ”¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–†¯–âãžR£–r[–B7ž¢Äœ¤ì(€½¹ÍÐÍ•…ÑÌõ¹½Éµ…±¥é•M•…Ñ½¹™¥1¥ÍÐ¡ˆ¹Í•…ÑÍññmt¤ì(€€¼¼)M=9ƒžnÓš:—–¾¯š¶¢š?–2[¦f–"_¾òm…Ñ•½Éç¾ò=…Ñ¥Ù”ƒ’â7–7–ö‹š"Cž²³’ê3––_š:Ÿ–"Û’úšêCŽ(€½¹ÍÐÁ…å±½…õìÑ•¹…¹Ñ}¥éQ99P°¹…µ”°Í•…Ñ}µ…Á}ÕÉ°éˆ¹µ…ÁUÉ±ñðœœ°Í•…ÑÍ}©Í½¸éÍ•…ÑÌ°¹½Ñ”éˆ¹¹½Ñ•ñðœœ°ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¤ôì(€½¹ÍÐ•á¥ÍÐõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Ù•¹Õ•}µ…Á}Ñ•µÁ±…Ñ•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¹…µ”õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¹…µ”¥ô™Í•±•Ðõ¥‘€¤ì(€¥˜¡•á¥ÍÐ˜™•á¥ÍÐ¹±•¹Ñ ¥ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Ù•¹Õ•}µ…Á}Ñ•µÁ±…Ñ•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡•á¥ÍÑlÁt¹¥¥õ€±Á…å±½…¤ì(€€€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥é•á¥ÍÑlÁt¹¥±ÕÁ‘…Ñ•éÑÉÕ•ô¤ì(€ô(€½¹ÍÐ¥õ•¹% Y5Pœ¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Ù•¹Õ•}µ…Á}Ñ•µÁ±…Ñ•Ìœ±í¥°¸¸¹Á…å±½…±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥‘ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡ÁÁ±åY•¹Õ•5…À¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜ …ˆ¹Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG–‚Óš²‡žÞ£¢f|œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Ù•¹Õ•}µ…Á}Ñ•µÁ±…Ñ•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹µ…Á%¥ô™Í•±•Ðô©€¤ì(€¥˜ …É½ÝÍñð…É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–âãžR£–rXœ¤ì(€½¹ÍÐÑÁ°õÉ½ÝÍlÁtì(€½¹ÍÐÍ•…ÑÌõ¹½Éµ…±¥é•M•…Ñ½¹™¥1¥ÍÐ¡ÑÁ°¹Í•…ÑÍ}©Í½¸¤ì(€ÑÉåì(€€€½¹ÍÐÈõ…Ý…¥Ð¡M…Ù•M•…Ñ5…À¡•¹Ø±í}Ñ•¹…¹Ñ%éQ99P±•µ…¥°éˆ¹•µ…¥°±Ñ½­•¸éˆ¹Ñ½­•¸±Í•ÍÍ¥½¹%éˆ¹Í•ÍÍ¥½¹%±•¹…‰±•éˆ¹•¹…‰±•„ôõ™…±Í”±¡½±‘!½ÕÉÌéˆ¹¡½±‘!½ÕÉÌ±…ÍÍ¥¹…åÍ	•™½É”éˆ¹…ÍÍ¥¹…åÍ	•™½É”±µ…ÁUÉ°éÑÁ°¹Í•…Ñ}µ…Á}ÕÉ°±Í•…ÑÍô¤ì(€€€ÑÉåì…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥õ€±íÙ•¹Õ•}µ…Á}Ñ•µÁ±…Ñ•}¥éÑÁ°¹¥‘ô¤ìõ…Ñ ¡”¥ì±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è¡ÁÁ±åY•¹Õ•5…Àœ±µ•ÍÍ…”èÍ•ÐÑ•µÁ±…Ñ”¥™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìô(€€€É•ÑÕÉ¸Èì(€õ…Ñ ¡”¥ì(€€€±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è¡ÁÁ±åY•¹Õ•5…Àœ±µ•ÍÍ…”è…ÁÁ±äÙ•¹Õ”µ…À™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é”±µ•Ñ„éíÍ•ÍÍ¥½¹%éˆ¹Í•ÍÍ¥½¹%±µ…Á%éˆ¹µ…Á%‘õô¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ––_žR£–‚Ó–rÃ–r[–’ÇšV_¾òhœ­Í•…Ñ5…ÁÁÁ±åÉÉ½É5•ÍÍ…”¡”¤¤ì(€ô)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•±•Ñ•Y•¹Õ•5…À¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜ …ˆ¹µ…Á%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG–âãžR£–r[žÞ£¢f|œ¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Ù•¹Õ•}µ…Á}Ñ•µÁ±…Ñ•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹µ…Á%¥õ€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•M•…Ñ5…Á%µ…”¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜ …ˆ¹Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG–‚Óš²‡žÞ£¢f|œ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥õ€±ì(€€€Í•…Ñ}µ…Á}ÕÉ°éMÑÉ¥¹œ¡ˆ¹µ…ÁUÉ±ñðœœ¤¹ÑÉ¥´ ¤(€ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±µ…ÁUÉ°éMÑÉ¥¹œ¡ˆ¹µ…ÁUÉ±ñðœœ¤¹ÑÉ¥´ ¥ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•M•…Ñ5…À¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜ …ˆ¹Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG–‚Óš²‡žÞ£¢f|œ¤ì(€½¹ÍÐÍ•…ÑÌõ¹½Éµ…±¥é•M•…Ñ½¹™¥1¥ÍÐ¡ˆ¹Í•…ÑÍññmt¤ì(€½¹ÍÐ½‘•Ìõ¹•ÜM•Ð ¤ì(€™½È¡½¹ÍÐÌ½˜Í•…ÑÌ¥ì(€€€½¹ÍÐ½‘”õMÑÉ¥¹œ¡Ì¹½‘•ññÌ¹Í•…Ñ½‘•ññÌ¹ÍÑ…±±9½ñðœœ¤¹ÑÉ¥´ ¤ì(€€€¥˜ …½‘”¤É•ÑÕÉ¸©Í½¹ÉÈ ŸšR“’ö7’îžŠó’â7–>¿ž¦ëžfôœ¤ì(€€€¥˜¡½‘•Ì¹¡…Ì¡½‘”¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–B3’â–‚Óš²‡šR“’ö7’îžŠó’â7–>¿¦7¢’¾òhœ­½‘”¤ì(€€€½‘•Ì¹…‘¡½‘”¤ì(€ô(€½¹ÍÐ}Í•ÍUÁõì(€€€Í•…Ñ}ÁÉ¥¥¹}•¹…‰±•è€„…ˆ¹•¹…‰±•°(€€€Í•…Ñ}¡½±‘}¡½ÕÉÌè9Õµ‰•È¡ˆ¹¡½±‘!½ÕÉÌ¥ññMQ}!=1}!=UIL°(€€€Í•…Ñ}µ…Á}ÕÉ°èˆ¹µ…ÁUÉ±ñðœœ(€ôì(€¥˜¡ˆ¹…ÍÍ¥¹…åÍ	•™½É”„õ¹Õ±°€˜˜ˆ¹…ÍÍ¥¹…åÍ	•™½É”„ôôœœ¤}Í•ÍUÁ¹Í•…Ñ}…ÍÍ¥¹}‘…åÍ}‰•™½É”õ5…Ñ ¹µ…à Ì±9Õµ‰•È¡ˆ¹…ÍÍ¥¹…åÍ	•™½É”¥ñðÜ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥õ€±}Í•ÍUÁ¤ì(€½¹ÍÐ•á¥ÍÑ¥¹œõ…Ý…¥Ð•ÑM•…ÑI½ÝÌ¡•¹Ø±Q99P±ˆ¹Í•ÍÍ¥½¹%¤ì(€™½È¡½¹ÍÐ¥Ñ•´½˜Í•…ÑÌ¥ì(€€€½¹ÍÐ½‘”õ¥Ñ•´¹½‘”ì(€€€½¹ÍÐÑåÁ”õ¥Ñ•´¹ÑåÁ”ì(€€€½¹ÍÐ‘…Ñ„õì(€€€€€Ñ•¹…¹Ñ}¥éQ99P°Í•ÍÍ¥½¹}¥éˆ¹Í•ÍÍ¥½¹%°(€€€€€ÍÑ…±±}¹¼é½‘”°(€€€€€Í•…Ñ}ÑåÁ”éÑåÁ”°ÁÉ¥•}‘•±Ñ„éÑåÁ”ôôôÁ…¥œý¥Ñ•´¹ÁÉ¥”èÀ°(€€€€€…Ñ•½Éäèœœ°(€€€€€µ…Á}àé¥Ñ•´¹à°µ…Á}äé¥Ñ•´¹ä°µ…Á}É½Ñ…Ñ¥½¸é¥Ñ•´¹É½Ñ…Ñ¥½¸°µ…Á}½É‘•Èé¥Ñ•´¹½É‘•È°(€€€€€¥Í}…Ñ¥Ù”é¥Ñ•´¹…Ñ¥Ù”°¹½Ñ”é¥Ñ•´¹¹½Ñ”°(€€€€€ÍÑ…ÑÕÌé¥Ñ•´¹…Ñ¥Ù”üŸž¦ë¦ZHœèŸ–sžR œ°(€€€€€É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°°•µ…¥°é¹Õ±°°¡½±‘}Ñ¥µ”é¹Õ±°°Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°°(€€€€€ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¤(€€€ôì(€€€½¹ÍÐ½±õ•á¥ÍÑ¥¹œ¹™¥¹¡àôùÍ•…Ñ½‘•=˜¡à¤ôôõ½‘”¤ì(€€€¥˜¡½±¤ì(€€€€€¥˜€¡Í•…ÑI•%¡½±¤€˜˜¥ÍM•…Ñ=ÕÁ¥•‘Ñ¥Ù”¡½±¤¤ì(€€€€€€€€¼¼ƒ––_žR£–âãžR£–r[’â7–ú_šÒ_š:'–ÞË¦‚CžVg¾ò?–ÞË¦:[–ºkžj’ö7žö»Ž(€€€€€€€‘…Ñ„¹ÍÑ…ÑÕÌ€ô½±¹ÍÑ…ÑÕÌì‘…Ñ„¹É•¥ÍÑÉ…Ñ¥½¹}¥€ôÍ•…ÑI•%¡½±¤ì‘…Ñ„¹•µ…¥°€ô½±¹•µ…¥°ì‘…Ñ„¹¡½±‘}Ñ¥µ”€ô½±¹¡½±‘}Ñ¥µ”ì‘…Ñ„¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ð€ô½±¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðì(€€€€€ô(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½±¹¥¥õ€±‘…Ñ„¤ì(€€€ô(€€€•±Í”…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°ÍÑ…±±Ìœ±í¥é•¹% MQ0œ¤°¸¸¹‘…Ñ„±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€ô(€€¼¼ƒšâ–Z»šÊK–âÛ–"ÃžjŽ’âSšr«¢Š¯–6ƒžR£¢¾ò3¢«–.W–sžR£¾ò3’â7žnÓš:—–"«¦f“¾ò3¦ÿ–7¢ª“–"«š¶ß–>ËŽ(€™½È¡½¹ÍÐ½±½˜•á¥ÍÑ¥¹œ¥ì(€€€½¹ÍÐ½‘”õÍ•…Ñ½‘•=˜¡½±¤ì(€€€¥˜¡½‘”€˜˜€…½‘•Ì¹¡…Ì¡½‘”¤€˜˜€…Í•…ÑI•%¡½±¤¥ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½±¹¥¥õ€±í¥Í}…Ñ¥Ù”é™…±Í”±ÍÑ…ÑÕÌèŸ–sžR œ±ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€€€ô(€ô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±½Õ¹ÐéÍ•…ÑÌ¹±•¹Ñ¡ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸É•‰Õ¥±‘M•…Ñ••%Ñ•´¡•¹Ø°Ñ•¹…¹Ñ%°É•œ°Í•ÍÍ¥½¹%°Í•…Ñ•”¥ì(€½¹ÍÐ}ÐõMÑÉ¥¹œ¡Ñ•¹…¹Ñ%‘ñðœœ¤¹ÑÉ¥´ ¤ì(€ÑÉåì…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌœ±€‘í}ÐýÑ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡}Ð¥ô™€èœõÉ•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥ô™¥Ñ•µ}ÑåÁ”õ•Ä¹Í•…Ñ}™••€¤ìõ…Ñ ¡”¥íô(€¥˜¡Í…™•9Õ´¡Í•…Ñ•”¤øÀ¥ì(€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌœ±í¥é•¹% %Q4œ¤±Ñ•¹…¹Ñ}¥é}Ð±É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•œ¹¥±¥Ñ•µ}ÑåÁ”èÍ•…Ñ}™•”œ±¥Ñ•µ}¹…µ”èŸ–*ƒ–ç¦ã’ö7¢Êìœ±ÅÕ…¹Ñ¥ÑäèÄ±Õ¹¥Ñ}ÁÉ¥”éÍ…™•9Õ´¡Í•…Ñ•”¤±…µ½Õ¹ÐéÍ…™•9Õ´¡Í•…Ñ•”¤±¹½Ñ”èÑ…á}¥¹±Õ‘•ô¤ì(€ô)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡±…¥µA…¥‘M•…Ð¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ …ˆ¹É•%‘ñð…ˆ¹Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG–‚Ç–B7š"[–‚Óš²‡žÞ£¢f|œ¤ì(€½¹ÍÐÉ•I½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜ …É•I½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B7žÒ¦2œ¤ì(€½¹ÍÐÉ•œõÉ•I½ÝÍlÁtì(€¥˜¡¥ÍA…¥‘M•…Ñ!½±‘áÁ¥É•¡É•œ¤¥ì…Ý…¥ÐÉ•±•…Í•A…¥‘M•…Ñ!½±¡•¹Ø±Q99P±É•œ°•áÁ¥É•‘}‰•™½É•}±…¥´œ¤ìÉ•ÑÕÉ¸©Í½¹ÉÈ Ÿ–:¦ã’ö7’þwžVg–ÞË¦ûšr¾ò3’ö7žö»–ÞË¦/–ë¾ò3¢®/¦7šZÃšVÓžB–ú3–7¦ãšN’ö7žö»Žœ¤ìô(€¥˜¡MÑÉ¥¹œ¡É•œ¹Í•ÍÍ¥½¹}¥‘ñðœœ¤„ôõMÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%‘ñðœœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–‚Ç–B7¢"–‚Óš²‡’â7’â¢Ðœ¤ì(€½¹ÍÐ½Ý¸õ…Ý…¥ÐÙ•É¥™¥•‘I•=Ý¹•ÉÕ…É¡•¹Ø±É•œ±ˆ°Ÿ¦ãšN’ö7žö»žjœ¤ì¥˜¡½Ý¸¤É•ÑÕÉ¸½Ý¸ì(€¥˜¡MÑÉ¥¹œ¡É•œ¹É•Ù¥•Ý}ÍÑ…ÑÕÍñðœœ¤„ôôŸ–ÞË¦2–>Xœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–Âkšr«¦2–>[¾ò3’â7¢÷–*ƒ–ç¦ã’ö4œ¤ì(€¥˜¡MÑÉ¥¹œ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ¤ôôôŸ–7¢Êìœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–7¢Êï–‚Ç–B7’â7¦Z/šRû–*ƒ–ç¦ã’ö4œ¤ì(€¥˜¡MÑÉ¥¹œ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ¤ôôôŸ–úžŠë¢ª4ññMÑÉ¥¹œ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ¤ôôôŸ’îcš²û–úžŠë¢ª4œ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ’îcš²ûš¶–r£žŠë¢ª7’â·¾ò3¢®/–#ž¶'–ú’âï¢ú›žŠë¢ª7–ú3–7¦ã’ö4œ¤ì(€¥˜¡¥Í…Á…¥Ñå%¹…Ñ¥Ù•QÉ…¹Í™•ÉMÑ…ÑÕÌ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË–>[šÚ#š"[¦Ë–—¦¢ÊïšÖž¢,œ¤ì(€¥˜¡MÑÉ¥¹œ¡É•œ¹Í•…Ñ}¡½¥•}¥¹Ñ•¹Ññðœœ¤„ôôÁ…¥œ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–‚Ç–B7šfšr«¦ãšN–*ƒ–ç¦ã’ö7š?¦†c¾ò3’â7¢÷–*ƒ¢Îó–*ƒ–ç¦ã’ö4œ¤ì(€½¹ÍÐÍ•ÑÑ¥¹œõ…Ý…¥Ð•ÑM•ÍÍ¥½¹M•…ÑM•ÑÑ¥¹œ¡•¹Ø±Q99P±ˆ¹Í•ÍÍ¥½¹%¤ì(€¥˜ …Í•ÑÑ¥¹œ¹•¹…‰±•¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Óš²‡šr«¦Z/šRû–*ƒ–ç¦ã’ö4œ¤ì(€½¹ÍÐ½‘•Ìô¡ÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹Í•…ÑÌ¤ýˆ¹Í•…ÑÌémˆ¹Í•…Ñ½‘•ññˆ¹ÍÑ…±±9Õµ‰•Ét¤¹µ…À¡àôùMÑÉ¥¹œ¡áñðœœ¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€½¹ÍÐµ…àõ5…Ñ ¹µ…à Ä±9Õµ‰•È¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤ì(€¥˜ …½‘•Ì¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¦ãšN’ö7žö¸œ¤ì(€¥˜¡½‘•Ì¹±•¹Ñ „ôõµ…à¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¦ãšîü€œ­µ…à¬œƒ–/’ö7žö»¾ò3¦r¢"–‚Ç–B7šR“’ö7šVã’â¢Ðœ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð•ÑM•…ÑI½ÝÌ¡•¹Ø±Q99P±ˆ¹Í•ÍÍ¥½¹%¤ì±•ÐÍ•…Ñ•”ôÀì(€™½È¡½¹ÍÐ½‘”½˜½‘•Ì¥ì(€€€½¹ÍÐÍ•…ÐõÉ½ÝÌ¹™¥¹¡àôùÍ•…Ñ½‘•=˜¡à¤ôôõ½‘”¤ì¥˜ …Í•…Ð¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã’ö7žö¸€œ­½‘”¤ì(€€€¥˜¡¹½Éµ…±¥é•M•…ÑQåÁ”¡Í•…Ð¹Í•…Ñ}ÑåÁ”¤„ôôÁ…¥œ¤É•ÑÕÉ¸©Í½¹ÉÈ¡½‘”¬œƒ’â7šb¿–*ƒ–ç¦ã’ö7’ö7žö¸œ¤ì(€€€¥˜¡Í•…Ð¹¥Í}…Ñ¥Ù”ôôõ™…±Í•ññÍ•…Ð¹¥Í}…Ñ¥Ù”ôôô™…±Í”œ¤É•ÑÕÉ¸©Í½¹ÉÈ¡½‘”¬œƒšr«¦Z/šRøœ¤ì(€€€¥˜¡MÑÉ¥¹œ¡Í•…Ð¹ÍÑ…ÑÕÍñðœœ¤ôôôŸ¦‚CžVdœ˜™¥Í!½±‘áÁ¥É•‘Ð¡Í•…Ð¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ð¤¥ì(€€€€€¥˜¡Í•…ÑI•%¡Í•…Ð¤¥ìÑÉåí…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•…ÑI•%¡Í•…Ð¤¥ô™Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌõ•Ä¹É•Í•ÉÙ•‘€±íÍÑ…±±}¹Õµ‰•Èé¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÉ•±•…Í•œ±Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤íõ…Ñ ¡”¥íôô(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•…Ð¹¥¥õ€±íÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€€€€€Í•…Ð¹ÍÑ…ÑÕÌôŸž¦ë¦ZHœìÍ•…Ð¹É•¥ÍÑÉ…Ñ¥½¹}¥õ¹Õ±°ìÍ•…Ð¹•µ…¥°õ¹Õ±°ìÍ•…Ð¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðõ¹Õ±°ì(€€€ô(€€€¥˜¡¥ÍM•…Ñ=ÕÁ¥•‘Ñ¥Ù”¡Í•…Ð¤˜™MÑÉ¥¹œ¡Í•…ÑI•%¡Í•…Ð¥ñðœœ¤„ôõMÑÉ¥¹œ¡É•œ¹¥¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“’ö7žö»–ÞË¢Š¯¦ã¢ÖÃ¾ò3¢®/¦7šZÃ¦ãšN–Û’î[’ö7žö»Žœ¤ì(€€€Í•…Ñ•”¬õÍ…™•9Õ´¡Í•…Ð¹ÁÉ¥•}‘•±Ñ„¤ì(€ô(€½¹ÍÐ½±‘M•…Ñ•”õ…Ý…¥Ð•Ñá¥ÍÑ¥¹M•…Ñ••É½µ%Ñ•µÌ¡•¹Ø±É•œ¹¥±Q99P¤ì(€½¹ÍÐ‰…Í•µ½Õ¹Ðõ5…Ñ ¹µ…à À°¡Í…™•9Õ´¡É•œ¹Ñ½Ñ…±}…µ½Õ¹Ð¥ññÍ…™•9Õ´¡É•œ¹…µ½Õ¹Ð¥ñðÀ¤µ½±‘M•…Ñ•”¤ì(€½¹ÍÐ¹•ÝQ½Ñ…°õ‰…Í•µ½Õ¹Ð­Í•…Ñ•”ì(€½¹ÍÐÝ…ÍA…¥õ¥ÍA…¥‘MÑ…ÑÕÌ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤ì(€½¹ÍÐÁ…¥‘µ½Õ¹ÐõÍ…™•9Õ´¡É•œ¹Á…¥‘}…µ½Õ¹Ð¥ñð¡Ý…ÍA…¥ý‰…Í•µ½Õ¹ÐèÀ¤ì(€½¹ÍÐ‘Õ”õ5…Ñ ¹µ…à À±¹•ÝQ½Ñ…°µÁ…¥‘µ½Õ¹Ð¤ì(€½¹ÍÐ•áÁ¥É•ÍÐõ…‘‘!½ÕÉÍ%Í¼¡Í•ÑÑ¥¹œ¹¡½±‘!½ÕÉÌ¤ì(€™½È¡½¹ÍÐÌ½˜É½ÝÌ¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡Í•…ÑI•%¡à¥ñðœœ¤ôôõMÑÉ¥¹œ¡É•œ¹¥¤˜™¹½Éµ…±¥é•M•…ÑQåÁ”¡à¹Í•…Ñ}ÑåÁ”¤ôôôÁ…¥œ˜˜…½‘•Ì¹¥¹±Õ‘•Ì¡Í•…Ñ½‘•=˜¡à¤¤¤¥ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥õ€±íÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€ô(€½¹ÍÐ±…¥µ•õmtì(€™½È¡½¹ÍÐ½‘”½˜½‘•Ì¥ì(€€€½¹ÍÐÍ•…ÐõÉ½ÝÌ¹™¥¹¡àôùÍ•…Ñ½‘•=˜¡à¤ôôõ½‘”¤ì(€€€ÑÉåì…Ý…¥Ð±…¥µM•…ÑI½ÝÑ½µ¥Œ¡•¹Ø±Q99P±Í•…Ð±É•œ±•áÁ¥É•ÍÐ¤ì±…¥µ•¹ÁÕÍ ¡Í•…Ð¤ìô(€€€…Ñ ¡”¥ì™½È¡½¹ÍÐ½Ð½˜±…¥µ•¥íÑÉåí…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½Ð¹¥¥ô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥ô™ÍÑ…ÑÕÌõ•Ä»¦‚CžVe€±íÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤íõ…Ñ ¡}”¥íõôÉ•ÑÕÉ¸©Í½¹ÉÈ¡”¹µ•ÍÍ…•ñðŸš¶“’ö7žö»–ÞË¢Š¯¦ã¢ÖÃ¾ò3¢®/¦7šZÃ¦ãšN–Û’î[’ö7žö»Žœ¤ìô(€ô(€½¹ÍÐ±½­•õ‘Õ”ðôÀì(€¥˜¡±½­•¥ì™½È¡½¹ÍÐ½Ð½˜±…¥µ•¤…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½Ð¹¥¥ô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±íÍÑ…ÑÕÌèŸ¦:[–ºhœ±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ìô(€½¹ÍÐÕÁõíÍÑ…±±}¹Õµ‰•Èé½‘•Ì¹©½¥¸ œ°œ¤±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌé±½­•ü±½­•œèÉ•Í•ÉÙ•œ±Í•…Ñ}¡½¥•}ÑåÁ”èÁ…¥œ±Í•…Ñ}™••}Ñ½Ñ…°éÍ•…Ñ•”±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé±½­•ý¹Õ±°é•áÁ¥É•ÍÐ±…µ½Õ¹Ðé¹•ÝQ½Ñ…°±Ñ½Ñ…±}…µ½Õ¹Ðé¹•ÝQ½Ñ…±ôì(€€¼¼ƒ¢"+–ÞËžæÏ¢ÎšZg¢.—–Âkšr«–n{–†¬Á…¥‘}…µ½Õ¹Ó¾ò3–#š*+–:–ÞËžæÏ¦G¦†7–¾¯–n{¾ò3¢Žsš²ûšfš&7–>«šršRÛ¦ã’ö7–Þ»¦†7Ž(€¥˜¡Ý…ÍA…¥€˜˜Á…¥‘µ½Õ¹ÐùÍ…™•9Õ´¡É•œ¹Á…¥‘}…µ½Õ¹Ð¤¤ÕÁ¹Á…¥‘}…µ½Õ¹ÐõÁ…¥‘µ½Õ¹Ðì(€¥˜¡Ý…ÍA…¥˜™‘Õ”øÀ¤=‰©•Ð¹…ÍÍ¥¸¡ÕÁ±íÁ…åµ•¹Ñ}ÍÑ…ÑÕÌèŸšr«žæÏ¢Êìœ±Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹ÐèÀ±Á…åµ•¹Ñ}±…ÍÐÔé¹Õ±°±Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ðé¹Õ±±ô¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±ÕÁ¤ì(€…Ý…¥ÐÉ•‰Õ¥±‘M•…Ñ••%Ñ•´¡•¹Ø±Q99P±É•œ±ˆ¹Í•ÍÍ¥½¹%±Í•…Ñ•”¤ì(€½¹ÍÐµ•ÍÍ…”õ±½­•üŸ’ö7žö»–ÞËš¶–ò?¦:[–ºkŽœè¡Ý…ÍA…¥üŸ’ö7žö»–ÞË’þwžVd€œ­Í•ÑÑ¥¹œ¹¡½±‘!½ÕÉÌ¬œƒ–Â?šf¾ò3¢®/¢ŽsžæÏ–*ƒ–ç–Þ»¦†49Pœ­‘Õ”¬ŸŽœèŸš¶“’ö7žö»–ÞËž
ëš
£’þwžVd€œ­Í•ÑÑ¥¹œ¹¡½±‘!½ÕÉÌ¬œƒ–Â?šf¾ò3¢®/šZóšr¦fC–Ÿ–º3š"C’îcš²ûŽœ¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±Í•…ÑÌé½‘•Ì±Í•…Ñ•”±Ñ½Ñ…°é¹•ÝQ½Ñ…°±Á…¥éÁ…¥‘µ½Õ¹Ð±‘Õ”±•áÁ¥É•ÍÐé±½­•üœœé•áÁ¥É•ÍÐ±±½­•±µ•ÍÍ…•ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸…ÕÑ½ÍÍ¥¹M•…Ñ½ÉA…¥‘I•œ¡•¹Ø°Ñ•¹…¹Ñ%°É•œ¥ì(€¥˜¡É•œ¹ÍÑ…±±}¹Õµ‰•È¤É•ÑÕÉ¸íÍ­¥ÁÁ•éÑÉÕ”±É•…Í½¸è…±É•…‘å}¡…Í}ÍÑ…±°ôì(€¥˜¡MÑÉ¥¹œ¡É•œ¹Í•…Ñ}¡½¥•}¥¹Ñ•¹Ññð…ÕÑ¼œ¤ôôôÁ…¥œ¤É•ÑÕÉ¸íÍ­¥ÁÁ•éÑÉÕ”±É•…Í½¸èÁ…¥‘}¡½¥”ôì(€½¹ÍÐ¹••õ5…Ñ ¹µ…à Ä±9Õµ‰•È¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð•ÑM•…ÑI½ÝÌ¡•¹Ø±Ñ•¹…¹Ñ%±É•œ¹Í•ÍÍ¥½¹}¥¤ì(€½¹ÍÐ™É•”õÉ½ÝÌ¹™¥±Ñ•È¡Ìôù¹½Éµ…±¥é•M•…ÑQåÁ”¡Ì¹Í•…Ñ}ÑåÁ”¤ôôô…ÕÑ¼œ€˜˜Ì¹¥Í}…Ñ¥Ù”„ôõ™…±Í”€˜˜Ì¹¥Í}…Ñ¥Ù”„ôô™…±Í”œ€˜˜€…¥ÍM•…Ñ=ÕÁ¥•‘Ñ¥Ù”¡Ì¤¤¹Í½ÉÐ ¡„±ˆ¤ôùí½¹ÍÐ½„õ9Õµ‰•È¡„¹µ…Á}½É‘•È¥ñðÀ±½ˆõ9Õµ‰•È¡ˆ¹µ…Á}½É‘•È¥ñðÀíÉ•ÑÕÉ¸½„„ôõ½ˆý½„µ½ˆéMÑÉ¥¹œ¡Í•…Ñ½‘•=˜¡„¤¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡Í•…Ñ½‘•=˜¡ˆ¤¤¤íô¤ì(€¥˜¡™É•”¹±•¹Ñ ñ¹••¤É•ÑÕÉ¸íÍ­¥ÁÁ•éÑÉÕ”±É•…Í½¸è¹½}…ÕÑ½}Í•…Ðôì(€½¹ÍÐÁ¥­•õ™É•”¹Í±¥” À±¹••¤ì(€™½È¡½¹ÍÐÌ½˜Á¥­•¥ì…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥õ€±íÍÑ…ÑÕÌèŸ¦:[–ºhœ±É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•œ¹¥±•µ…¥°éÉ•œ¹•µ…¥±ñðœœ±¡½±‘}Ñ¥µ”é¹½Ý%Í¼ ¤±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ìô(€½¹ÍÐ½‘•ÌõÁ¥­•¹µ…À¡Í•…Ñ½‘•=˜¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±íÍÑ…±±}¹Õµ‰•Èé½‘•Ì¹©½¥¸ œ°œ¤±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌè±½­•œ±Í•…Ñ}¡½¥•}ÑåÁ”è…ÕÑ¼ô¤ì(€É•ÑÕÉ¸íÍÕ•ÍÌéÑÉÕ”±Í•…ÑÌé½‘•Íôì)ô()™Õ¹Ñ¥½¸Í•ÍÍ¥½¹¥ÉÍÑMÑ…ÉÑ5Ì¡Í•ÍÍ¥½¸¥ì(€½¹ÍÐÉ½ÝÌõÍ…™•)Í½¸¡Í•ÍÍ¥½¸€˜˜Í•ÍÍ¥½¸¹‘…Ñ•Í}©Í½¸±mt¤ì(€½¹ÍÐµÌõmtì(€™½È¡½¹ÍÐÉ½Ü½˜É½ÝÌ¥ì(€€€½¹ÍÐ‘…Ñ”õMÑÉ¥¹œ ¡É½Ü˜™É½Ü¹‘…Ñ”¥ñðœœ¤¹ÑÉ¥´ ¤ì(€€€¥˜ …‘…Ñ”¤½¹Ñ¥¹Õ”ì(€€€½¹ÍÐÍÑ…ÉÐõMÑÉ¥¹œ ¡É½Ü˜™É½Ü¹ÍÑ…ÉÐ¥ñðœœ¤¹ÑÉ¥´ ¤ì(€€€±•ÐÉ…Üõ‘…Ñ”ì(€€€€¼¼=%9ƒ–‚Óš²‡š^—šr¦k–âãšb¼eeedµ54µ¾òožR£–>Ãžšf–6¢ž¢º¾ò3¦ÿ–4UQƒ¦ƒš"C¢Þ£š^—¢ª“–Þ»Ž(€€€¥˜ ½yq‘ìÑôµq‘ìÉôµq‘ìÉô¼¹Ñ•ÍÐ¡‘…Ñ”¤¤É…Üõ€‘í‘…Ñ•õP‘íÍÑ…ÉÑñðœÀÀèÀÀôèÀÀ¬ÀàèÀÁ€ì(€€€½¹ÍÐÐõ…Ñ”¹Á…ÉÍ”¡É…Ü¤ì(€€€¥˜¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡Ð¤¤µÌ¹ÁÕÍ ¡Ð¤ì(€ô(€É•ÑÕÉ¸µÌ¹±•¹Ñ ý5…Ñ ¹µ¥¸ ¸¸¹µÌ¤é9…8ì)ô()™Õ¹Ñ¥½¸Í•ÍÍ¥½¹ÕÑ½ÍÍ¥¹]¥¹‘½Ü¡Í•ÍÍ¥½¸°¹½Ý5Ìõ…Ñ”¹¹½Ü ¤¥ì(€½¹ÍÐÍÑ…ÉÑ5ÌõÍ•ÍÍ¥½¹¥ÉÍÑMÑ…ÉÑ5Ì¡Í•ÍÍ¥½¸¤ì(€½¹ÍÐ‘…åÌõ5…Ñ ¹µ…à Ì±9Õµ‰•È¡Í•ÍÍ¥½¸˜™Í•ÍÍ¥½¸¹Í•…Ñ}…ÍÍ¥¹}‘…åÍ}‰•™½É”¥ñðÜ¤ì(€¥˜ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÍÑ…ÉÑ5Ì¤¤É•ÑÕÉ¸í…Ñ¥Ù”é™…±Í”±‘…åÌ±ÍÑ…ÉÑ5Ìé¹Õ±±ôì(€½¹ÍÐÝ¥¹‘½ÝMÑ…ÉÐõÍÑ…ÉÑ5Ìµ‘…åÌ¨ÈÐ¨ØÀ¨ØÀ¨ÄÀÀÀì(€É•ÑÕÉ¸í…Ñ¥Ù”é¹½Ý5ÌøõÝ¥¹‘½ÝMÑ…ÉÐ€˜˜¹½Ý5ÌñÍÑ…ÉÑ5Ì±‘…åÌ±ÍÑ…ÉÑ5Ì±Ý¥¹‘½ÝMÑ…ÉÑôì)ô((¼¼ƒŠRŠR ƒšÒï–.W–&7š2žê3¢«–.W¦7’ö4ƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR (¼¼ƒ¢š?–&¾òk¦Ë–”Í•…Ñ}…ÍÍ¥¹}‘…åÍ}‰•™½É—¾ò#¦‚C¢¢´€Üƒ–’§Žšr’ö8€Ìƒ–’§¾ò'–ú3¾ò3–"ÃšÒï–.W¦Z/–ž/–&7¾ò0(¼¼ƒš&šr'Ž3–ÞË¦2–>[¾ò/–ÞËžŠë¢ª7’îcš²û¾ò/¦v{–*ƒ–ç¦ã’ö7¾ò/–Âkšr«¦7’ö7Ž7žj–‚Ç–B7¾ò3¦÷š2žê3’úw’îcš²ûžŠë¢ª7¦‚–ê?¢Žs’ö7Ž(¼¼ƒ’â7–7’î”Í•…Ñ}…ÍÍ¥¹}‘½¹•}…ÐƒžVÛ’ösŽ3–>«¢ÞG’âš²‡Ž7žj¦bïšZßš^_š¢g¾òo¢¦Ëš²’ö7–>«¢¢c¦2šr¢þG’âš²‡¢«–.W¦7’ö7–~ß¢†3šf¦ZOŽ)…Íå¹Œ™Õ¹Ñ¥½¸‰…Ñ¡ÍÍ¥¹M•…ÑÍ½ÉM•ÍÍ¥½¸¡•¹Ø°Ñ•¹…¹Ñ%°Í•ÍÍ¥½¸¥ì(€½¹ÍÐÍ¥õÍ•ÍÍ¥½¸¹¥ì(€½¹ÍÐÉ•Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í¥¥ô™É•Ù¥•Ý}ÍÑ…ÑÕÌõ•Ä¸•Ô•Ü•È•ä”á”àÐ•Ô”á”äØ™Í•±•Ðô©€¤ì(€½¹ÍÐÅÕ•Õ”ô¡É•Íññmt¤(€€€€¹™¥±Ñ•È¡Èôù¥ÍA…¥‘MÑ…ÑÕÌ¡È¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤€˜˜€…È¹ÍÑ…±±}¹Õµ‰•È€˜˜MÑÉ¥¹œ¡È¹Í•…Ñ}¡½¥•}¥¹Ñ•¹Ññð…ÕÑ¼œ¤„ôôÁ…¥œ¤(€€€€¹Í½ÉÐ ¡„±ˆ¤ôùì(€€€€€€¼¼É•¥ÍÑÉ…Ñ¥½¹Ì¹Á…¥‘}…ÐƒžRÇŽ3žŠë¢ª7’îcš²ûŽ7–¾¯–—¾ò3šb¿š¶–ò?’îcš²ûžŠë¢ª7¦‚–ê?¾òož‡–óšfš&7¦–n{–n{–‚Çšf¦ZO¾ò?–îëž®/šf¦ZOŽ(€€€€€½¹ÍÐÁ„õ„¹Á…¥‘}…Ñññ„¹Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ñññ„¹É•…Ñ•‘}…Ññðœœì(€€€€€½¹ÍÐÁˆõˆ¹Á…¥‘}…Ñññˆ¹Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ñññˆ¹É•…Ñ•‘}…Ññðœœì(€€€€€½¹ÍÐŒõMÑÉ¥¹œ¡Á„¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡Áˆ¤¤ì(€€€€€É•ÑÕÉ¸Œ„ôôÀýŒéMÑÉ¥¹œ¡„¹É•…Ñ•‘}…Ññðœœ¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹É•…Ñ•‘}…Ññðœœ¤¤ì(€€€ô¤ì(€±•Ð…ÍÍ¥¹•ôÀ°Í­¥ÁÁ•ôÀì(€™½È¡½¹ÍÐÈ½˜ÅÕ•Õ”¥ì(€€€ÑÉåì(€€€€€½¹ÍÐÉ•Ìõ…Ý…¥Ð…ÕÑ½ÍÍ¥¹M•…Ñ½ÉA…¥‘I•œ¡•¹Ø±Ñ•¹…¹Ñ%±È¤ì(€€€€€¥˜¡É•Ì˜™É•Ì¹ÍÕ•ÍÌ¤…ÍÍ¥¹•¬¬ì•±Í”Í­¥ÁÁ•¬¬ì(€€€õ…Ñ ¡”¥ì(€€€€€Í­¥ÁÁ•¬¬ì(€€€€€±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è‰…Ñ¡ÍÍ¥¹M•…ÑÍ½ÉM•ÍÍ¥½¸œ±µ•ÍÍ…”è…ÍÍ¥¸½¹”™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ì(€€€ô(€ô(€É•ÑÕÉ¸í…ÍÍ¥¹•±Í­¥ÁÁ•±Ñ½Ñ…°éÅÕ•Õ”¹±•¹Ñ¡ôì)ô(((¼¼ƒŠRŠR =%9ƒ’âï¢ú›¦ã’ö7ž¦,ƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR )…Íå¹Œ™Õ¹Ñ¥½¸¡‘µ¥¹M•…Ñ	½…É¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ±MÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%‘ñðœœ¤¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜ …ˆ¹Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG–‚Óš²‡žÞ£¢f|œ¤ì(€½¹ÍÐÍ•…ÑI½ÝÌõ…Ý…¥Ð•ÑM•…ÑI½ÝÌ¡•¹Ø±P±ˆ¹Í•ÍÍ¥½¹%¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐÍ•ÍÍ¥½¹I½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥ô™Í•±•Ðõ¥±¹…µ”±Ù•¹Õ”±Í•…Ñ}µ…Á}ÕÉ±€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐÉ•I½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥ô™É•Ù¥•Ý}ÍÑ…ÑÕÌõ•Ä¸•Ô•Ü•È•ä”á”àÐ•Ô”á”äØ™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐÍ•…ÑÌô¡Í•…ÑI½ÝÍññmt¤¹µ…À¡Ìôø¡ì(€€€½‘”éÍ•…Ñ½‘•=˜¡Ì¤°ÑåÁ”é¹½Éµ…±¥é•M•…ÑQåÁ”¡Ì¹Í•…Ñ}ÑåÁ”¤°ÑåÁ•1…‰•°éÍ•…ÑQåÁ•1…‰•°¡¹½Éµ…±¥é•M•…ÑQåÁ”¡Ì¹Í•…Ñ}ÑåÁ”¤¤°ÁÉ¥”éÍ…™•9Õ´¡Ì¹ÁÉ¥•}‘•±Ñ„¤°(€€€…Ñ¥Ù”éÌ¹¥Í}…Ñ¥Ù”„ôõ™…±Í”˜™Ì¹¥Í}…Ñ¥Ù”„ôô™…±Í”œ˜™¹½Éµ…±¥é•M•…ÑQåÁ”¡Ì¹Í•…Ñ}ÑåÁ”¤„ôô±½Í•œ°ÍÑ…ÑÕÌéÌ¹ÍÑ…ÑÕÍñðŸž¦ë¦ZHœ°½ÕÁ¥•é¥ÍM•…Ñ=ÕÁ¥•‘Ñ¥Ù”¡Ì¤°(€€€É•%éÍ•…ÑI•%¡Ì¥ñðœœ°¡½±‘áÁ¥É•ÍÐéÌ¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ññðœœ°¹½Ñ”éÌ¹¹½Ñ•ñðœœ°½É‘•ÈéÍ…™•9Õ´¡Ì¹µ…Á}½É‘•È¤±àéÍ…™•9Õ´¡Ì¹µ…Á}à¤±äéÍ…™•9Õ´¡Ì¹µ…Á}ä¤±É½Ñ…Ñ¥½¸è ¡Í…™•9Õ´¡Ì¹µ…Á}É½Ñ…Ñ¥½¸¤”ÌØÀ¤¬ÌØÀ¤”ÌØÀ(€ô¤¤ì(€½¹ÍÐÉ•Ìô¡É•I½ÝÍññmt¤¹µ…À¡Èôø¡íÉ•%éÈ¹¥±‰É…¹éÈ¹‰É…¹‘}¹…µ•ññÈ¹‰É…¹‘ñðœœ±¹…µ”éÈ¹¹…µ•ñðœœ±•µ…¥°éÈ¹•µ…¥±ñðœœ±ÍÑ…±±9Õµ‰•ÈéÈ¹ÍÑ…±±}¹Õµ‰•Éñðœœ±ÍÑ…±±½Õ¹Ðé5…Ñ ¹µ…à Ä±9Õµ‰•È¡È¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤±¥¹Ñ•¹ÐéMÑÉ¥¹œ¡È¹Í•…Ñ}¡½¥•}¥¹Ñ•¹Ññð…ÕÑ¼œ¤ôôôÁ…¥œüÁ…¥œè…ÕÑ¼œ±Á…åMÑ…ÑÕÌéÈ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ±Á…¥‘ÐéÈ¹Á…¥‘}…ÑññÈ¹Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ññðœœ±Í•…ÑMÑ…ÑÕÌéÈ¹Í•…Ñ}¡½¥•}ÍÑ…ÑÕÍñðœœ±•ÅÕ¥Áµ•¹ÑQ•áÐé•ÅÕ¥ÁMÕµµ…ÉåÉ½µ)Í½¸¡È¹•ÅÕ¥Áµ•¹Ñ}©Í½¹ññÈ¹•ÅÕ¥Á}©Í½¸¥ñðŸ¢¢·–
g¢«–
dô¤¤ì(€½¹ÍÐÍ•ÌõÍ•ÍÍ¥½¹I½ÝÍlÁuññíôì(€É•ÑÕÉ¸©Í½¹=¬¡íÍ•ÍÍ¥½¹%éˆ¹Í•ÍÍ¥½¹%±Í•ÍÍ¥½¹9…µ”éÍ•Ì¹¹…µ•ññˆ¹Í•ÍÍ¥½¹%±Ù•¹Õ”éÍ•Ì¹Ù•¹Õ•ñðœœ±µ…ÁUÉ°éÍ•Ì¹Í•…Ñ}µ…Á}ÕÉ±ñðœœ±Í•…ÑÌ±É•Íô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡‘µ¥¹ÍÍ¥¹M•…Ð¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ±½¬õ…Ý…¥Ð¡•­Q•¹…¹Ñ1½­•¡•¹Ø±P¤ì¥˜¡±½¬¹±½­•¤É•ÑÕÉ¸©Í½¹ÉÈ¡±½¬¹É•…Í½¹ñðŸš¶“’âï¢ú›ž¦ë¦ZOžn»–&7ž
ë–R¿¢º¦:[–ºhœ¤ì(€½¹ÍÐÉ•%õMÑÉ¥¹œ¡ˆ¹É•%‘ñðœœ¤¹ÑÉ¥´ ¤ì¥˜ …É•%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG–‚Ç–B7žÞ£¢f|œ¤ì(€½¹ÍÐÉ•Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì¥˜ …É•Ì¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B7žÒ¦2œ¤ì(€½¹ÍÐÉ•œõÉ•ÍlÁtì¥˜¡MÑÉ¥¹œ¡É•œ¹É•Ù¥•Ý}ÍÑ…ÑÕÍñðœœ¤„ôôŸ–ÞË¦2–>Xœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–>«šr'–ÞË¦2–>[–‚Ç–B7–>¿–º'š:K’ö7žö¸œ¤ì(€½¹ÍÐ½‘•Ìô¡ÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹Í•…ÑÌ¤ýˆ¹Í•…ÑÌéMÑÉ¥¹œ¡ˆ¹Í•…ÑÍñðœœ¤¹ÍÁ±¥Ð ½l³¾ò1qÍt¬¼¤¤¹µ…À¡àôùMÑÉ¥¹œ¡áñðœœ¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€½¹ÍÐ¹••õ5…Ñ ¹µ…à Ä±9Õµ‰•È¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤ì¥˜¡½‘•Ì¹±•¹Ñ „ôõ¹••¤É•ÑÕÉ¸©Í½¹ÉÈ¡ƒš¶“–‚Ç–B7¦r¢š€‘í¹••‘ôƒ–/’ö7žö¹€¤ì¥˜¡¹•ÜM•Ð¡½‘•Ì¤¹Í¥é”„ôõ½‘•Ì¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ’ö7žö»¢fžŠó’â7–>¿¦7¢’œ¤ì(€½¹ÍÐ…±°õ…Ý…¥Ð•ÑM•…ÑI½ÝÌ¡•¹Ø±P±É•œ¹Í•ÍÍ¥½¹}¥¤ì½¹ÍÐÑ…É•ÑÌõmtì(€™½È¡½¹ÍÐ½‘”½˜½‘•Ì¥í½¹ÍÐÌõ…±°¹™¥¹¡àôùÍ•…Ñ½‘•=˜¡à¤ôôõ½‘”¤í¥˜ …Ì¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã’ö7žö¸€œ­½‘”¤í½¹ÍÐÑåÀõ¹½Éµ…±¥é•M•…ÑQåÁ”¡Ì¹Í•…Ñ}ÑåÁ”¤í¥˜ „¡ÑåÀôôô…ÕÑ¼ññÑåÀôôôÁ…¥œ¥ññÌ¹¥Í}…Ñ¥Ù”ôôõ™…±Í•ññÌ¹¥Í}…Ñ¥Ù”ôôô™…±Í”œ¥É•ÑÕÉ¸©Í½¹ÉÈ¡½‘”¬œƒ’â7–>¿’öÿžR œ¤í¥˜¡¥ÍM•…Ñ=ÕÁ¥•‘Ñ¥Ù”¡Ì¤˜™MÑÉ¥¹œ¡Í•…ÑI•%¡Ì¥ñðœœ¤„ôõÉ•%¥É•ÑÕÉ¸©Í½¹ÉÈ¡½‘”¬œƒ–ÞË¢Š¯–Û’î[–‚Ç–B7’öÿžR œ¤íÑ…É•ÑÌ¹ÁÕÍ ¡Ì¤íô(€¥˜¡¹••øÄ˜˜…Í•…ÑQ…É•ÑÍÉ•‘©…•¹Ð¡Ñ…É•ÑÌ¤¥É•ÑÕÉ¸©Í½¹ÉÈ ŸžžžR£–’kšR“–þ¦‚#–º'š:K–r£žnã¦Ã’ö7žö»¾ò3’â7¢÷š.¦Z,œ¤ì(€½¹ÍÐ¹•Ý±äõmtì(€™½È¡½¹ÍÐÌ½˜Ñ…É•ÑÌ¥í¥˜¡MÑÉ¥¹œ¡Í•…ÑI•%¡Ì¥ñðœœ¤ôôõÉ•%¥½¹Ñ¥¹Õ”í½¹ÍÐ½Ðõ…Ý…¥Ð‘‰UÁ‘…Ñ•I•ÑÕÉ¹¥¹œ¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥ô™ÍÑ…ÑÕÌõ•Ä¸•Ü•ä•	•ä”äØ”äÈ™É•¥ÍÑÉ…Ñ¥½¹}¥õ¥Ì¹¹Õ±°™¥Í}…Ñ¥Ù”õ•Ä¹ÑÉÕ•€±íÍÑ…ÑÕÌèŸ¦:[–ºhœ±É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•%±•µ…¥°éÉ•œ¹•µ…¥±ñðœœ±¡½±‘}Ñ¥µ”é¹½Ý%Í¼ ¤±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤í¥˜ …½Ð¹±•¹Ñ ¥í™½È¡½¹ÍÐà½˜¹•Ý±ä¥í…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡à¹¥¥ô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥õ€±íÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤¹…Ñ   ¤ôùíô¤íõÉ•ÑÕÉ¸©Í½¹ÉÈ¡Í•…Ñ½‘•=˜¡Ì¤¬œƒ–&o¢Š¯–Û’î[’êë’öÿžR£¾ò3¢®/¦7šZÃšVÓžBœ¤íõ¹•Ý±ä¹ÁÕÍ ¡Ì¤íô(€™½È¡½¹ÍÐ½±½˜…±°¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡Í•…ÑI•%¡à¥ñðœœ¤ôôõÉ•%˜˜…½‘•Ì¹¥¹±Õ‘•Ì¡Í•…Ñ½‘•=˜¡à¤¤¤¤…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½±¹¥¥ô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥õ€±íÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥õ€±íÍÑ…±±}¹Õµ‰•Èé½‘•Ì¹©½¥¸ œ°œ¤±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌè±½­•œ±Í•…Ñ}¡½¥•}ÑåÁ”éMÑÉ¥¹œ¡É•œ¹Í•…Ñ}¡½¥•}¥¹Ñ•¹Ññð…ÕÑ¼œ¤ôôôÁ…¥œüÁ…¥œè…ÕÑ¼œ±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Í•…Ñ}½Á•É…Ñ¥½¹}±½Ìœ±í¥é•¹% MPœ¤±Ñ•¹…¹Ñ}¥éP±Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•%±ÍÑ…±±}¥é¹Õ±°±…Ñ¥½¸è…‘µ¥¹}…ÍÍ¥¸œ±½Á•É…Ñ½É}ÑåÁ”èÍÑ…™˜œ±½Á•É…Ñ½É}¥éˆ¹•µ…¥±ñðœœ±¹½Ñ”é½‘•Ì¹©½¥¸ œ°œ¤±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤¹…Ñ   ¤ôùíô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±Í•…ÑÌé½‘•Íô¤ì)ô)™Õ¹Ñ¥½¸Í•…ÑQ…É•ÑÍÉ•‘©…•¹Ð¡É½ÝÌ¥ì(€¥˜¡É½ÝÌ¹±•¹Ñ ðÈ¥É•ÑÕÉ¸ÑÉÕ”ì(€½¹ÍÐ½¹¹•Ñ•õ¹•ÜM•Ð¡lÁt¤±ÅÕ•Õ”õlÁtì(€Ý¡¥±”¡ÅÕ•Õ”¹±•¹Ñ ¥ì(€€€½¹ÍÐ¤õÅÕ•Õ”¹Í¡¥™Ð ¤±„õÉ½ÝÍm¥tì(€€€™½È¡±•Ð¨ôÀí¨ñÉ½ÝÌ¹±•¹Ñ í¨¬¬¥ì(€€€€€¥˜¡½¹¹•Ñ•¹¡…Ì¡¨¤¥½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐˆõÉ½ÝÍm©t±‘àõÍ…™•9Õ´¡„¹µ…Á}à¤µÍ…™•9Õ´¡ˆ¹µ…Á}à¤±‘äõÍ…™•9Õ´¡„¹µ…Á}ä¤µÍ…™•9Õ´¡ˆ¹µ…Á}ä¤ì(€€€€€¥˜¡5…Ñ ¹ÍÅÉÐ¡‘à©‘à­‘ä©‘ä¤ðôÈÈ¥í½¹¹•Ñ•¹…‘¡¨¤íÅÕ•Õ”¹ÁÕÍ ¡¨¤íô(€€€ô(€ô(€É•ÑÕÉ¸½¹¹•Ñ•¹Í¥é”ôôõÉ½ÝÌ¹±•¹Ñ ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡‘µ¥¹UÁ‘…Ñ•M•…ÑA½Í¥Ñ¥½¹Ì¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%±Í¥õMÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%‘ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …Í¥‘ñð……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ±Í¥¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ±½¬õ…Ý…¥Ð¡•­Q•¹…¹Ñ1½­•¡•¹Ø±P¤í¥˜¡±½¬¹±½­•¥É•ÑÕÉ¸©Í½¹ÉÈ¡±½¬¹É•…Í½¹ñðŸš¶“’âï¢ú›ž¦ë¦ZOžn»–&7ž
ë–R¿¢º¦:[–ºhœ¤ì(€½¹ÍÐ¥Ñ•µÌô¡ÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹¥Ñ•µÌ¤ýˆ¹¥Ñ•µÌémt¤¹Í±¥” À°ÌÀ¤í¥˜ …¥Ñ•µÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG¢š–Ë–¶cžj’ö7žö¸œ¤ì(€™½È¡½¹ÍÐ¥Ñ•´½˜¥Ñ•µÌ¥ì(€€€½¹ÍÐ½‘”õMÑÉ¥¹œ¡¥Ñ•´¹½‘•ñðœœ¤¹ÑÉ¥´ ¤í¥˜ …½‘”¥½¹Ñ¥¹Õ”ì(€€€½¹ÍÐ‘…Ñ„õíµ…Á}àé5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸ ÄÀÀ±Í…™•9Õ´¡¥Ñ•´¹à¤¤¤±µ…Á}äé5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸ ÄÀÀ±Í…™•9Õ´¡¥Ñ•´¹ä¤¤¤±µ…Á}É½Ñ…Ñ¥½¸è ¡Í…™•9Õ´¡¥Ñ•´¹É½Ñ…Ñ¥½¸¤”ÌØÀ¤¬ÌØÀ¤”ÌØÀ±ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ôì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í¥¥ô™ÍÑ…±±}¹¼õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½‘”¥õ€±‘…Ñ„¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±½Õ¹Ðé¥Ñ•µÌ¹±•¹Ñ¡ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡‘µ¥¹U¹…ÍÍ¥¹M•…Ð¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%±É•%õMÑÉ¥¹œ¡ˆ¹É•%‘ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …É•%¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG–‚Ç–B7žÞ£¢f|œ¤ì(€½¹ÍÐÉ•Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤í¥˜ …É•Ì¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B7žÒ¦2œ¤ì(€½¹ÍÐÉ•œõÉ•ÍlÁtí¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ±MÑÉ¥¹œ¡É•œ¹Í•ÍÍ¥½¹}¥‘ñðœœ¤¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ±½¬õ…Ý…¥Ð¡•­Q•¹…¹Ñ1½­•¡•¹Ø±P¤í¥˜¡±½¬¹±½­•¥É•ÑÕÉ¸©Í½¹ÉÈ¡±½¬¹É•…Í½¹ñðŸš¶“’âï¢ú›ž¦ë¦ZOžn»–&7ž
ë–R¿¢º¦:[–ºhœ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹Í•ÍÍ¥½¹}¥¥ô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥õ€±íÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°±ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥õ€±íÍÑ…±±}¹Õµ‰•Èé¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ±Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Í•…Ñ}½Á•É…Ñ¥½¹}±½Ìœ±í¥é•¹% MPœ¤±Ñ•¹…¹Ñ}¥éP±Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•%±ÍÑ…±±}¥é¹Õ±°±…Ñ¥½¸è…‘µ¥¹}Õ¹…ÍÍ¥¸œ±½Á•É…Ñ½É}ÑåÁ”èÍÑ…™˜œ±½Á•É…Ñ½É}¥éˆ¹•µ…¥±ñðœœ±¹½Ñ”èŸ¦–n{–úš:Hœ±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤¹…Ñ   ¤ôùíô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡IÕ¹	…Ñ¡ÍÍ¥¸¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÍÍ¥½¹Ìœ±MÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%‘ñðœœ¤¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ±½¬õ…Ý…¥Ð¡•­Q•¹…¹Ñ1½­•¡•¹Ø±P¤ì¥˜¡±½¬¹±½­•¤É•ÑÕÉ¸©Í½¹ÉÈ¡±½¬¹É•…Í½¹ñðŸš¶“’âï¢ú›ž¦ë¦ZOžn»–&7ž
ë–R¿¢º¦:[–ºhœ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%‘ñðœœ¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Óš²„œ¤ì(€½¹ÍÐÈõ…Ý…¥Ð‰…Ñ¡ÍÍ¥¹M•…ÑÍ½ÉM•ÍÍ¥½¸¡•¹Ø±P±É½ÝÍlÁt¤ìÉ•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°¸¸¹Éô¤ì)ô((¼¼Í•±•ÑMÑ…±³¾ò#žnã–ºç¢"(…Ñ¥½»¾ò3š¶–ò?¢ö'’ê“–*ƒ–ç¦ã’ö4±…¥µA…¥‘M•…Ó¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡M•±•ÑMÑ…±°¡•¹Ø°ˆ¤ì(€É•ÑÕÉ¸¡±…¥µA…¥‘M•…Ð¡•¹Ø°ˆ¤ì)ô((¼¼ƒŠRŠR ƒ–B#’ö×žÖC–âÏ¾ò#¢Îóž&§¢î+¾ò'¾òk–’kž¶–‚Ç–B7’âš²‡’îcš²ûŽ’âš²‡–n{–‚ÇŽ’â–ò×–B#’ö×–6‡ž&ƒŠRŠR (¼¼ƒ¢š?–&¾òk–Ž3–B3’â–/šRÛš²û¢¢·–ºkŽ7žj–‚Ç–B7–>¿–B#’ö×¾ò#–’k’âï¢ú›’â7–>¿šÞßšRÛ¾ò'¾òo–‚Ç–B7žÒ¦2’î7–"–‚Óš²‡–B’âž¶¾ò0(¼¼ƒ’î”Á…åµ•¹Ñ}É½ÕÁ}¥ƒžÚ–ºkž
ë–B3’âš²‡’îcš²û¾ò3–ú3–>Ã–>¿’âš²‡žŠë¢ª7Ž)™Õ¹Ñ¥½¸‰Õ¥±‘5•É•‘A…åµ•¹Ñ…É‘Q•áÐ¡¥Ñ•µÌ°Ý¡¼°µ•Ñ¡½°Ñ½Ñ…°°É½ÕÁ9¼¥ì(€½¹ÍÐ±¥¹•Ì€ôlŸŽC–B#’ö×žæÏ¢ÊïŽG–Ä€œ€¬¥Ñ•µÌ¹±•¹Ñ €¬€œƒ–‚Ðœ°€œtì(€™½È€¡½¹ÍÐ¥Ð½˜¥Ñ•µÌ¤ì(€€€½¹ÍÐ‘•À€ô9Õµ‰•È¡¥Ð¹É•œ¹‘•Á½Í¥ÑñðÀ¤ì(€€€½¹ÍÐ•ÅÕ¥ÁQ•áÐ€ô•ÅÕ¥ÁMÕµµ…ÉåÉ½µ)Í½¸¡¥Ð¹É•œ¹•ÅÕ¥Áµ•¹Ñ}©Í½¸¤ì(€€€±¥¹•Ì¹ÁÕÍ  ŸŽìœ€¬€¡¥Ð¹Í•Í9…µ•ñðŸ–‚Óš²„œ¤¤ì(€€€±¥¹•Ì¹ÁÕÍ  ŸŽšR“’ö4€œ€¬5…Ñ ¹µ…à¡9Õµ‰•È¡¥Ð¹É•œ¹ÍÑ…±±}½Õ¹ÑñðÄ¤°Ä¤€¬€œƒšRœ¤ì(€€€±¥¹•Ì¹ÁÕÍ  ŸŽ¢¢·–
g¾òhœ€¬€¡•ÅÕ¥ÁQ•áÐñð€Ÿ¢«–
dœ¤¤ì(€€€¥˜€¡‘•À€ø€À¤±¥¹•Ì¹ÁÕÍ  ŸŽ’þw¢¶'¦D9Pœ€¬‘•À¹Ñ½1½…±•MÑÉ¥¹œ ¤¤ì(€€€±¥¹•Ì¹ÁÕÍ  ŸŽ9Pœ€¬9Õµ‰•È¡¥Ð¹…µ½Õ¹ÑñðÀ¤¹Ñ½1½…±•MÑÉ¥¹œ ¤¤ì(€ô(€±¥¹•Ì¹ÁÕÍ  œœ¤ì(€±¥¹•Ì¹ÁÕÍ ¡Ý¡¼ñð€Ÿšr«–†¯–B7ž¢Äœ¤ì(€±¥¹•Ì¹ÁÕÍ  Ÿ–B#¢¢#¦G¦†7¾òi9Pœ€¬9Õµ‰•È¡Ñ½Ñ…±ñðÀ¤¹Ñ½1½…±•MÑÉ¥¹œ ¤€¬€Ÿ¾ò œ€¬€¡µ•Ñ¡½‘ñðŸ’îcš²øœ¤€¬€Ÿ¾ò$œ¤ì(€±¥¹•Ì¹ÁÕÍ  Ÿ–B#’ö×žÞ£¢f¾òhœ€¬É½ÕÁ9¼¤ì(€É•ÑÕÉ¸±¥¹•Ì¹©½¥¸ q¸œ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡MÕ‰µ¥ÑA…åµ•¹Ñ	…Ñ ¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐ¥‘Ì€ôÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹É•%‘Ì¤€üˆ¹É•%‘Ì¹µ…À¡àôùMÑÉ¥¹œ¡áñðœœ¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤€èmtì(€¥˜€¡¥‘Ì¹±•¹Ñ €ð€È¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¢Ï–ÂG–.û¦ã–§ž¶–‚Ç–B7–7–B#’ö×žæÏ¢Êìœ¤ì(€½¹ÍÐµ•Ñ¡½€ôˆ¹µ•Ñ¡½ñð€Ÿ–2¿š²øœì(€½¹ÍÐ¥Í	…¹¬€ô€½Q5ó¦*¢†1ó¢ö'–âÍó–2¿š²ø¼¹Ñ•ÍÐ¡MÑÉ¥¹œ¡µ•Ñ¡½¤¤ì(€½¹ÍÐ±…ÍÐÔ€ô¥Í	…¹¬€üMÑÉ¥¹œ¡ˆ¹±…ÍÑ¥Ù•ññˆ¹±…ÍÐÕñðœœ¤¹ÑÉ¥´ ¤€è€œœì(€¥˜€¡¥Í	…¹¬€˜˜€…±…ÍÐÔ¤É•ÑÕÉ¸©Í½¹ÉÈ Q7¾ò?¦*¢†3¢ö'–âÏ¦r–†¯–âÏ¢fšr¯’êSžŠðœ¤ì((€½¹ÍÐ¥Ñ•µÌ€ômtì(€±•ÐÁÉ½™¥±•-•ä€ô¹Õ±°ì(€™½È€¡½¹ÍÐ¥½˜¥‘Ì¤ì(€€€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥ô™Í•±•Ðô©€¤ì(€€€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B7žÒ¦2œ¤ì(€€€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€€€€¼¼´ÀÏ¾òkš¾?’âž¶¦÷¢šžR£–B3’âžÖˆ¹•µ…¥³¾ò-ˆ¹Á¡½¹”ƒ¦¦_¾òo’îï’âž¶¦v{šr³’êë¾ò3šVÓš&çž®/–6Ï–’ÇšV_Ž(€€€€¼¼ƒš¶“¢þÓ–r#–>«–k¦¦_¢¶'¢"¢¦›žº_¾ò3’â7–¾¯–—’îï’öW¢ÎšZg¾ò3š&’î—’â7šr–ëž>ûŽ3–&7–æûž¶–ÞËšRçŽ–ú3¦v‹š&7–’ÇšV_Ž7Ž(€€€½¹ÍÐ}½Ý¹	…Ñ €ô…Ý…¥ÐÙ•É¥™¥•‘I•=Ý¹•ÉÕ…É¡•¹Ø±É•œ±ˆ°Ÿ–n{–‚Ç’îcš²ûžjœ¤ì¥˜€¡}½Ý¹	…Ñ ¤É•ÑÕÉ¸}½Ý¹	…Ñ ì(€€€¥˜€¡É•œ¹É•Ù¥•Ý}ÍÑ…ÑÕÌ€„ôô€Ÿ–ÞË¦2–>Xœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿšr'–‚Óš²‡–Âkšr«¦2–>[¾ò3ž‡šÎW–B#’ö×žæÏ¢Êìœ¤ì(€€€½¹ÍÐ}Ñ½Ñ…±µ½Õ¹Ðõ9Õµ‰•È¡É•œ¹Ñ½Ñ…±}…µ½Õ¹Ð¥ññ9Õµ‰•È¡É•œ¹…µ½Õ¹Ð¥ñðÀì(€€€½¹ÍÐ}Á…¥‘µ½Õ¹Ðõ9Õµ‰•È¡É•œ¹Á…¥‘}…µ½Õ¹Ð¥ñðÀì(€€€½¹ÍÐ}‘Õ•µ½Õ¹Ðõ5…Ñ ¹µ…à À±}Ñ½Ñ…±µ½Õ¹Ðµ}Á…¥‘µ½Õ¹Ð¤ì(€€€¥˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤€˜˜}‘Õ•µ½Õ¹ÐðôÀ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿšr'–‚Óš²‡–ÞË–º3š"CžæÏ¢Êï¾ò3¢®/¦7šZÃ–.û¦àœ¤ì(€€€¥˜€¡MÑÉ¥¹œ¡É•œ¹Í•…Ñ}¡½¥•}¥¹Ñ•¹Ññðœœ¤ôôôÁ…¥œ€˜˜€…lÉ•Í•ÉÙ•œ°±½­•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É•œ¹Í•…Ñ}¡½¥•}ÍÑ…ÑÕÍñðœœ¤¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿšr'–‚Óš²‡–Âkšr«–º3š"C–*ƒ–ç¦ã’ö7¾ò3¢®/–#–º3š"C¦ã’ö4œ¤ì(€€€½¹ÍÐÍ•ÍÍ¥½¹I½Ü€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹I½Ü¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤¹…Ñ   ¤ôù¹Õ±°¤ì(€€€±•ÐÁ…åM¹…Àì(€€€ÑÉäì(€€€€€Á…åM¹…À€ô…Ý…¥Ð•¹ÍÕÉ•A…åµ•¹ÑM¹…ÁÍ¡½Ñ½ÉI•œ¡•¹Ø±Q99P±É•œ±Í•ÍÍ¥½¹I½Ýññíô°íÝÉ¥Ñ•%™M…™”éÑÉÕ•ô¤ì(€€€ô…Ñ ¡”¤ì(€€€€€É•ÑÕÉ¸©Í½¹ÉÈ¡”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€è€Ÿšr'–‚Óš²‡žjšRÛš²û¢¢·–ºkž‡šÎW¢žšzC¾ò3¢®/¢¿žæ¯’âï¢ú˜œ¤ì(€€€ô(€€€¥˜€ …}µ•Ñ¡½‘±±½Ý•‘É½µM¹…ÁÍ¡½Ð¡Á…åM¹…À°µ•Ñ¡½¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿšr'–‚Óš²‡šr«¦Z/šRûš¶“’îcš²ûšZç–ò?¾ò3¢®/–"¦Z/žæÏ¢Êìœ¤ì(€€€€¼¼ƒ–’k’âï¢ú›–º'–£¾òk’â7–B3šRÛš²û–âÏš"Û’â7–>¿–B#’ö×šRÛš²ø(€€€½¹ÍÐ­•ä€ôMÑÉ¥¹œ ¡Á…åM¹…À€˜˜Á…åM¹…À¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥¤ñð€œœ¤ì(€€€¥˜€¡ÁÉ½™¥±•-•ä€ôôô¹Õ±°¤ÁÉ½™¥±•-•ä€ô­•äì(€€€•±Í”¥˜€¡ÁÉ½™¥±•-•ä€„ôô­•ä¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–.û¦ãžj–‚Óš²‡šRÛš²û–âÏš"Û’â7–B3¾ò3¦r–"¦Z/žæÏ¢Êìœ¤ì(€€€½¹ÍÐ…µ½Õ¹Ð€ô}‘Õ•µ½Õ¹ÐøÀý}‘Õ•µ½Õ¹Ðé}Ñ½Ñ…±µ½Õ¹Ðì(€€€½¹ÍÐÍ•Í9…µ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€€€¥Ñ•µÌ¹ÁÕÍ ¡íÉ•œ°Á…åM¹…À°…µ½Õ¹Ð°Í•Í9…µ•ô¤ì(€ô((€€¼¼ƒžÖ–B#––_žÖ–º3šVÓšŸšª‹š~—¾òk–.û¦ã’â·¢.—–B¯žÖ–B#–‚Óš²‡¾ò3¢¦ËžÖš&šr'šr«žæÏ–‚Óš²‡¦÷–þ¦‚#’â¢Öß–.û¾ò#’â7–>¿–>«žæÏ–Û’â·’â–‚Ó¾ò$(€½¹ÍÐ}É½ÕÁÌ€ôl¸¸¹¹•ÜM•Ð¡¥Ñ•µÌ¹µ…À¡¥ÐôùMÑÉ¥¹œ¡¥Ð¹É•œ¹‰Õ¹‘±•}É½ÕÁ}¥‘ñðœœ¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤¥tì(€™½È€¡½¹ÍÐœ½˜}É½ÕÁÌ¤ì(€€€½¹ÍÐÉÀ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™‰Õ¹‘±•}É½ÕÁ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¥ô™Í•±•Ðõ¥±Á…åµ•¹Ñ}ÍÑ…ÑÕÌ±Ñ½Ñ…±}…µ½Õ¹Ð±…µ½Õ¹Ð±Á…¥‘}…µ½Õ¹Ñ€¤¹…Ñ   ¤ôùmt¤ì(€€€½¹ÍÐÕ¹Á…¥€ôÉÀ¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ¤„ôôŸ–7¢Êìœ€˜˜5…Ñ ¹µ…à À°¡9Õµ‰•È¡à¹Ñ½Ñ…±}…µ½Õ¹Ð¥ññ9Õµ‰•È¡à¹…µ½Õ¹Ð¥ñðÀ¤´¡9Õµ‰•È¡à¹Á…¥‘}…µ½Õ¹Ð¥ñðÀ¤¤øÀ¤¹µ…À¡àôùMÑÉ¥¹œ¡à¹¥¤¤ì(€€€½¹ÍÐÁ¥­•€ô¹•ÜM•Ð¡¥Ñ•µÌ¹µ…À¡¥ÐôùMÑÉ¥¹œ¡¥Ð¹É•œ¹¥¤¤¤ì(€€€¥˜€¡Õ¹Á…¥¹Í½µ”¡¥ôø…Á¥­•¹¡…Ì¡¥¤¤¤É•ÑÕÉ¸©Í½¹ÉÈ ŸžÖ–B#–«šƒ–‚Óš²‡¦ršVÓžÖ’â¢ÖßžæÏ¢Êï¾ò3¢®/’â’ö×–.û¦ã–B3žÖžjš&šr'–‚Óš²„œ¤ì(€ô(€½¹ÍÐÑ½Ñ…°€ô¥Ñ•µÌ¹É•‘Õ” ¡Ì±¥Ð¤ôùÌ­9Õµ‰•È¡¥Ð¹…µ½Õ¹ÑñðÀ¤°À¤ì(€¥˜€ „¡Ñ½Ñ…°€ø€À¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–B#¢¢#¦G¦†7žVÃ–âã¾ò3¢®/¢¿žæ¯’âï¢ú˜œ¤ì(€½¹ÍÐÉ½ÕÁ%€ô•¹% AHœ¤ì(€½¹ÍÐ¹½Ü€ô¹½Ý%Í¼ ¤ì(€½¹ÍÐ™¥ÉÍÐ€ô¥Ñ•µÍlÁt¹É•œì(€½¹ÍÐ‰É…¹€ôMÑÉ¥¹œ¡™¥ÉÍÐ¹‰É…¹‘}¹…µ”ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ¹´€ôMÑÉ¥¹œ¡™¥ÉÍÐ¹¹…µ”ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐÝ¡¼€ô‰É…¹€˜˜¹´€ü€‘í‰É…¹‘÷¾ò<‘í¹µõ€€è€¡‰É…¹ñð¹´ñð€Ÿšr«–†¯–B7ž¢Äœ¤ì(€½¹ÍÐ…É‘Q•áÐ€ô‰Õ¥±‘5•É•‘A…åµ•¹Ñ…É‘Q•áÐ¡¥Ñ•µÌ°Ý¡¼°µ•Ñ¡½°Ñ½Ñ…°°É½ÕÁ%¤ì((€½¹ÍÐ…ÁÁ±¥•õmt°¥¹Í•ÉÑ•‘A…åµ•¹Ñ%‘Ìõmtì(€ÑÉåì(€€€™½È€¡½¹ÍÐ¥Ð½˜¥Ñ•µÌ¤ì(€€€€€½¹ÍÐÉ•œõ¥Ð¹É•œì(€€€€€½¹ÍÐ¹½Ñ”ô¡É•œ¹…‘µ¥¹}¹½Ñ•ñðœœ¤­€ošR“–>/–n{–‚Ç
ß–B#’öÕt€‘íµ•Ñ¡½‘ôƒ–B#¢¢!9P‘íÑ½Ñ…±ô‘í±…ÍÐÔüœƒšr¬×žŠðèœ­±…ÍÐÔèœôƒžÞ£¢f|è‘íÉ½ÕÁ%‘ôƒšf¦ZLè‘í¹½ÝQ…¥Á•¥Q•áÐ ¥õ€ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±ì(€€€€€€€Á…åµ•¹Ñ}ÍÑ…ÑÕÌèŸ–úžŠë¢ª4œ±Á…åµ•¹Ñ}µ•Ñ¡½éµ•Ñ¡½±Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹Ðé¥Ð¹…µ½Õ¹Ð±Á…åµ•¹Ñ}±…ÍÐÔé±…ÍÐÔ±Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ðé¹½Ü°(€€€€€€€Á…åµ•¹Ñ}±¥¹•}…É‘}Ñ•áÐé…É‘Q•áÐ±Á…åµ•¹Ñ}ÍÉ••¹Í¡½Ñ}ÍÑ…ÑÕÌèŸ–ú¢Žsš"«–rXœ±Á…åµ•¹Ñ}É½ÕÁ}¥éÉ½ÕÁ%±…‘µ¥¹}¹½Ñ”é¹½Ñ”°(€€€€€€€€¸¸¹}Á…åµ•¹ÑM¹…ÁÍ¡½Ñ‰A…å±½…¡¥Ð¹Á…åM¹…À¤°(€€€€€ô¤ì(€€€€€…ÁÁ±¥•¹ÁÕÍ ¡É•œ¤ì(€€€€€½¹ÍÐÁ…å%õ•¹% Adœ¤ì(€€€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á…åµ•¹ÑÌœ±í¥éÁ…å%±Ñ•¹…¹Ñ}¥éQ99P±É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•œ¹¥±Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±•µ…¥°éÉ•œ¹•µ…¥°±…µ½Õ¹Ðé¥Ð¹…µ½Õ¹Ð±µ•Ñ¡½±ÍÑ…ÑÕÌèŸ–úžŠë¢ª4œ±ÑÉ…‘•}¹¼é±…ÍÐÔ±Á…¥‘}…Ðé¹Õ±°±É•…Ñ•‘}…Ðé¹½Ü±Á…åµ•¹Ñ}ÁÉ½™¥±•}¥è¡¥Ð¹Á…åM¹…À˜™¥Ð¹Á…åM¹…À¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥¥ññ¹Õ±°±Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½Ðé¥Ð¹Á…åM¹…Áññíõô¤ì(€€€€€¥¹Í•ÉÑ•‘A…åµ•¹Ñ%‘Ì¹ÁÕÍ ¡Á…å%¤ì(€€€ô(€õ…Ñ ¡”¥ì(€€€™½È¡½¹ÍÐ¥½˜¥¹Í•ÉÑ•‘A…åµ•¹Ñ%‘Ì¤…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€™½È¡½¹ÍÐÉ•œ½˜…ÁÁ±¥•¥ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±ì(€€€€€€€Á…åµ•¹Ñ}ÍÑ…ÑÕÌéÉ•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ±Á…åµ•¹Ñ}µ•Ñ¡½éÉ•œ¹Á…åµ•¹Ñ}µ•Ñ¡½‘ñðœœ±Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹ÐéÍ…™•9Õ´¡É•œ¹Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹Ð¤°(€€€€€€€Á…åµ•¹Ñ}±…ÍÐÔéÉ•œ¹Á…åµ•¹Ñ}±…ÍÐÕñðœœ±Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…ÐéÉ•œ¹Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ñññ¹Õ±°°(€€€€€€€Á…åµ•¹Ñ}±¥¹•}…É‘}Ñ•áÐéÉ•œ¹Á…åµ•¹Ñ}±¥¹•}…É‘}Ñ•áÑñðœœ±Á…åµ•¹Ñ}ÍÉ••¹Í¡½Ñ}ÍÑ…ÑÕÌéÉ•œ¹Á…åµ•¹Ñ}ÍÉ••¹Í¡½Ñ}ÍÑ…ÑÕÍñðœœ°(€€€€€€€Á…åµ•¹Ñ}É½ÕÁ}¥éÉ•œ¹Á…åµ•¹Ñ}É½ÕÁ}¥‘ññ¹Õ±°±…‘µ¥¹}¹½Ñ”éÉ•œ¹…‘µ¥¹}¹½Ñ•ñðœœ°(€€€€€€€Á…åµ•¹Ñ}ÁÉ½™¥±•}¥éÉ•œ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥‘ññ¹Õ±°±Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½Ð±íô¤°(€€€€€€€Á…åµ•¹Ñ}½Ý¹•É}µ½‘”éÉ•œ¹Á…åµ•¹Ñ}½Ý¹•É}µ½‘•ñðœœ±Á…åµ•¹Ñ}µ•Ñ¡½‘Í}…±±½Ý•éÍ…™•)Í½¸¡É•œ¹Á…åµ•¹Ñ}µ•Ñ¡½‘Í}…±±½Ý•±íô¤°(€€€€€€€‰…¹­}…½Õ¹Ñ}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹‰…¹­}…½Õ¹Ñ}Í¹…ÁÍ¡½Ð±íô¤±±¥¹•Á…å}½¹™¥}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹±¥¹•Á…å}½¹™¥}Í¹…ÁÍ¡½Ð±íô¤°(€€€€€€€…É‘}½¹™¥}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹…É‘}½¹™¥}Í¹…ÁÍ¡½Ð±íô¤±Á…åµ•¹Ñ}Í¹…ÁÍ¡½Ñ}É•…Ñ•‘}…ÐéÉ•œ¹Á…åµ•¹Ñ}Í¹…ÁÍ¡½Ñ}É•…Ñ•‘}…Ñññ¹Õ±°(€€€€€ô¤¹…Ñ   ¤ôùíô¤ì(€€€ô(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–B#’ö×’îcš²û–n{–‚Ç–’ÇšV_¾ò3žÎïžÖÇ–ÞË–n{–ú§šr³š²‡¢º+šnÓ¾ò3¢®/¦7šZÃšN7’ös¾òhœ¬¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸ¢ÎšZg–¾¯–—–’ÇšV\œ¤¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±±¥¹•…É‘Q•áÐé…É‘Q•áÐ±Á…åµ•¹Ñ1¥¹•…É‘Q•áÐé…É‘Q•áÐ±Á…åMÑ…ÑÕÌèŸ–úžŠë¢ª4œ±Á…åµ•¹ÑÉ½ÕÁ%éÉ½ÕÁ%±Ñ½Ñ…°±½Õ¹Ðé¥Ñ•µÌ¹±•¹Ñ¡ô¤ì)ô((¼¼ÍÕ‰µ¥ÑA…åµ•¹Ó¾ò#šR“–>/–n{–‚Ç–2¿š²û¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡MÕ‰µ¥ÑA…åµ•¹Ð¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B7žÒ¦2œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€½¹ÍÐ}½Ý¹A…ä€ô…Ý…¥ÐÙ•É¥™¥•‘I•=Ý¹•ÉÕ…É¡•¹Ø±É•œ±ˆ°Ÿ–n{–‚Ç’îcš²ûžjœ¤ì¥˜€¡}½Ý¹A…ä¤É•ÑÕÉ¸}½Ý¹A…äì(€¥˜€¡É•œ¹É•Ù¥•Ý}ÍÑ…ÑÕÌ„ôôŸ–ÞË¦2–>Xœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–Âkšr«¦2–>[¾ò3ž‡šÎW–n{–‚ÇžæÏ¢Êìœ¤ì(€½¹ÍÐ}Ñ½Ñ…±Õ•	…Í”õ9Õµ‰•È¡É•œ¹Ñ½Ñ…±}…µ½Õ¹Ð¥ññ9Õµ‰•È¡É•œ¹…µ½Õ¹Ð¥ñðÀì(€½¹ÍÐ}…±É•…‘åA…¥õ9Õµ‰•È¡É•œ¹Á…¥‘}…µ½Õ¹Ð¥ñðÀì(€½¹ÍÐ}Í¹…ÁA…äõÍ•±•Ñ•‘5½‘Õ±•M¹…ÁÍ¡½Ð¡É•œ¤±}™¥ÉÍÑÕ”õÍ…™•9Õ´¡}Í¹…ÁA…ä¹…µ½Õ¹ÑÕ•9½Ü¤ì(€½¹ÍÐ}½ÕÑÍÑ…¹‘¥¹œõ5…Ñ ¹µ…à À°¡}…±É•…‘åA…¥ðôÀ˜™}™¥ÉÍÑÕ”øÀý}™¥ÉÍÑÕ”é}Ñ½Ñ…±Õ•	…Í”¤µ}…±É•…‘åA…¥¤ì(€¥˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤€˜˜5…Ñ ¹µ…à À±}Ñ½Ñ…±Õ•	…Í”µ}…±É•…‘åA…¥¤ðôÀ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË–º3š"CžæÏ¢Êìœ¤ì(€¥˜€¡MÑÉ¥¹œ¡É•œ¹Í•…Ñ}¡½¥•}¥¹Ñ•¹Ññðœœ¤ôôôÁ…¥œ€˜˜€…lÉ•Í•ÉÙ•œ°±½­•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É•œ¹Í•…Ñ}¡½¥•}ÍÑ…ÑÕÍñðœœ¤¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–#–º3š"C–*ƒ–ç¦ã’ö7¾ò3–7–n{–‚Ç’îcš²ûŽœ¤ì(€½¹ÍÐ¹½Ü€ô¹½Ý%Í¼ ¤ì(€½¹ÍÐµ•Ñ¡½€ôˆ¹µ•Ñ¡½ñð€Ÿ–2¿š²øœì(€€¼¼ƒžÖ–B#––_žÖ¾ò!‰Õ¹‘±•}É½ÕÁ}¥“¾ò'ž
ëžÚ–ºk–«šƒ¾òk–þ¦‚#šVÓžÖ’â¢ÖßžæÏ¾ò0(€€¼¼ƒ’â7–>¿–>«žæÏ–Û’â·’â–‚Ó¾ò#–B›–&ž¶'šZóžR£žÖ–B#–ç¢Êß–Z»–‚Ó¾ò3¢"¦¢Êï–B3¦Ë¦¢š?–&’â¢Ó¾ò'Ž(€½¹ÍÐ}‰œ€ôMÑÉ¥¹œ¡É•œ¹‰Õ¹‘±•}É½ÕÁ}¥ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€¡}‰œ¤ì(€€€½¹ÍÐÉÀ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™‰Õ¹‘±•}É½ÕÁ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡}‰œ¥ô™Í•±•Ðõ¥±Á…åµ•¹Ñ}ÍÑ…ÑÕÍ€¤¹…Ñ   ¤ôùmt¤ì(€€€½¹ÍÐÕ¹Á…¥€ôÉÀ¹™¥±Ñ•È¡œôø…¥ÍA…¥‘MÑ…ÑÕÌ¡œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤€˜˜MÑÉ¥¹œ¡œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ¤„ôôŸ–7¢Êìœ¤ì(€€€¥˜€¡Õ¹Á…¥¹±•¹Ñ €ø€Ä¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“ž
ëžÖ–B#–«šƒ–‚Óš²‡¾ò3¦r¢"–B3žÖ–‚Óš²‡’â¢ÖßžæÏ¢Êï¾ò3¢®/’öÿžR£Ž3–&7–úžæÏ¢Êï¾ò#žÖ–B#¾ò'Ž4œ¤ì(€ô(€½¹ÍÐÍ•ÍÍ¥½¹I½Ü€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹I½Ü¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤¹…Ñ   ¤ôù¹Õ±°¤ì(€±•ÐÁ…åM¹…Àì(€ÑÉäì(€€€Á…åM¹…À€ô…Ý…¥Ð•¹ÍÕÉ•A…åµ•¹ÑM¹…ÁÍ¡½Ñ½ÉI•œ¡•¹Ø±Q99P±É•œ±Í•ÍÍ¥½¹I½Ýññíô°íÝÉ¥Ñ•%™M…™”éÑÉÕ•ô¤ì(€ô…Ñ ¡”¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ¡”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€è€Ÿš¶“–‚Ç–B7žjšRÛš²û¢¢·–ºkž‡šÎW¢žšzC¾ò3¢®/¢¿žæ¯’âï¢ú˜œ¤ì(€ô(€¥˜ …}µ•Ñ¡½‘±±½Ý•‘É½µM¹…ÁÍ¡½Ð¡Á…åM¹…À°µ•Ñ¡½¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7šr«¦Z/šRûš¶“’îcš²ûšZç–ò?¾ò3¢®/’úwžÎïžÖÇ¦†¿ž’ëšZç–ò?’îcš²øœ¤ì(€€¼¼´ÀÛ¾òkš¶–ò?¦G¦†7–>«¢÷’ú¢«¢ÎšZg–ê¯Ž–&7ž®¼ˆ¹…µ½Õ¹Ðƒ–’úo¦†¿ž’ë¾ò3žÖW’â7–>¿–¾¯–—š¶–ò?žÒ¦2Ž(€½¹ÍÐ…µ½Õ¹Ð€ô}½ÕÑÍÑ…¹‘¥¹œøÀý}½ÕÑÍÑ…¹‘¥¹œé}Ñ½Ñ…±Õ•	…Í”ì(€¥˜€ „¡…µ½Õ¹Ð€ø€À¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7¦G¦†7žVÃ–âã¾ò3¢®/¢¿žæ¯’âï¢ú˜œ¤ì(€½¹ÍÐ¥Í	…¹¬€ô€½Q5ó¦*¢†1ó¢ö'–âÍó–2¿š²ø¼¹Ñ•ÍÐ¡MÑÉ¥¹œ¡µ•Ñ¡½¤¤ì(€½¹ÍÐ±…ÍÐÔ€ô¥Í	…¹¬€üMÑÉ¥¹œ¡ˆ¹±…ÍÑ¥Ù•ññˆ¹±…ÍÐÕñðœœ¤¹ÑÉ¥´ ¤€è€œœì(€¥˜€¡¥Í	…¹¬€˜˜€…±…ÍÐÔ¤É•ÑÕÉ¸©Í½¹ÉÈ Q7¾ò?¦*¢†3¢ö'–âÏ¦r–†¯–âÏ¢fšr¯’êSžŠðœ¤ì(€½¹ÍÐÍ•Í9…µ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€½¹ÍÐ…É‘Q•áÐ€ô‰Õ¥±‘A…åµ•¹Ñ1¥¹•…É‘Q•áÐ¡É•œ°Í•Í9…µ”°µ•Ñ¡½°…µ½Õ¹Ð¤ì(€½¹ÍÐ¹½Ñ”€ô€¡É•œ¹…‘µ¥¹}¹½Ñ•ñðœœ¤­€ošR“–>/–n{–‚Åt€‘íµ•Ñ¡½‘ô9P‘í…µ½Õ¹Ññðœô‘í±…ÍÐÔüœƒšr¬×žŠðèœ­±…ÍÐÔèœôƒšf¦ZLè‘í¹½ÝQ…¥Á•¥Q•áÐ ¥õ€ì(€ÑÉåì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±ì(€€€€€Á…åµ•¹Ñ}ÍÑ…ÑÕÌèŸ–úžŠë¢ª4œ±Á…åµ•¹Ñ}µ•Ñ¡½éµ•Ñ¡½±Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹Ðé…µ½Õ¹Ð±Á…åµ•¹Ñ}±…ÍÐÔé±…ÍÐÔ±Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ðé¹½Ü°(€€€€€Á…åµ•¹Ñ}±¥¹•}…É‘}Ñ•áÐé…É‘Q•áÐ±Á…åµ•¹Ñ}ÍÉ••¹Í¡½Ñ}ÍÑ…ÑÕÌèŸ–ú¢Žsš"«–rXœ±…‘µ¥¹}¹½Ñ”é¹½Ñ”°¸¸¹}Á…åµ•¹ÑM¹…ÁÍ¡½Ñ‰A…å±½…¡Á…åM¹…À¤°(€€€ô¤ì(€€€½¹ÍÐ•á¥ÍÑ¥¹A…åI½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™ÍÑ…ÑÕÌõ•Ä¸•Ô•	”àÔ•Ü•È•	•à•”á™Í•±•Ðõ¥‘€¤ì(€€€¥˜¡•á¥ÍÑ¥¹A…åI½ÝÌ¹±•¹Ñ ¥ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡•á¥ÍÑ¥¹A…åI½ÝÍlÁt¹¥¥õ€±íÍ•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±•µ…¥°éÉ•œ¹•µ…¥°±…µ½Õ¹Ð±µ•Ñ¡½±ÍÑ…ÑÕÌèŸ–úžŠë¢ª4œ±ÑÉ…‘•}¹¼é±…ÍÐÔ±Á…¥‘}…Ðé¹Õ±°±É•…Ñ•‘}…Ðé¹½Ü±Á…åµ•¹Ñ}ÁÉ½™¥±•}¥è¡Á…åM¹…À˜™Á…åM¹…À¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥¥ññ¹Õ±°±Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½ÐéÁ…åM¹…Áññíõô¤ì(€€€õ•±Í•ì(€€€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á…åµ•¹ÑÌœ±í¥é•¹% Adœ¤±Ñ•¹…¹Ñ}¥éQ99P±É•¥ÍÑÉ…Ñ¥½¹}¥éˆ¹É•%±Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±•µ…¥°éÉ•œ¹•µ…¥°±…µ½Õ¹Ð±µ•Ñ¡½±ÍÑ…ÑÕÌèŸ–úžŠë¢ª4œ±ÑÉ…‘•}¹¼é±…ÍÐÔ±Á…¥‘}…Ðé¹Õ±°±É•…Ñ•‘}…Ðé¹½Ü±Á…åµ•¹Ñ}ÁÉ½™¥±•}¥è¡Á…åM¹…À˜™Á…åM¹…À¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥¥ññ¹Õ±°±Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½ÐéÁ…åM¹…Áññíõô¤ì(€€€ô(€õ…Ñ ¡”¥ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥õ€±ì(€€€€€Á…åµ•¹Ñ}ÍÑ…ÑÕÌéÉ•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ±Á…åµ•¹Ñ}µ•Ñ¡½éÉ•œ¹Á…åµ•¹Ñ}µ•Ñ¡½‘ñðœœ±Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹ÐéÍ…™•9Õ´¡É•œ¹Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹Ð¤°(€€€€€Á…åµ•¹Ñ}±…ÍÐÔéÉ•œ¹Á…åµ•¹Ñ}±…ÍÐÕñðœœ±Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…ÐéÉ•œ¹Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ñññ¹Õ±°°(€€€€€Á…åµ•¹Ñ}±¥¹•}…É‘}Ñ•áÐéÉ•œ¹Á…åµ•¹Ñ}±¥¹•}…É‘}Ñ•áÑñðœœ±Á…åµ•¹Ñ}ÍÉ••¹Í¡½Ñ}ÍÑ…ÑÕÌéÉ•œ¹Á…åµ•¹Ñ}ÍÉ••¹Í¡½Ñ}ÍÑ…ÑÕÍñðœœ°(€€€€€…‘µ¥¹}¹½Ñ”éÉ•œ¹…‘µ¥¹}¹½Ñ•ñðœœ±Á…åµ•¹Ñ}ÁÉ½™¥±•}¥éÉ•œ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥‘ññ¹Õ±°±Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½Ð±íô¤°(€€€€€Á…åµ•¹Ñ}½Ý¹•É}µ½‘”éÉ•œ¹Á…åµ•¹Ñ}½Ý¹•É}µ½‘•ñðœœ±Á…åµ•¹Ñ}µ•Ñ¡½‘Í}…±±½Ý•éÍ…™•)Í½¸¡É•œ¹Á…åµ•¹Ñ}µ•Ñ¡½‘Í}…±±½Ý•±íô¤°(€€€€€‰…¹­}…½Õ¹Ñ}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹‰…¹­}…½Õ¹Ñ}Í¹…ÁÍ¡½Ð±íô¤±±¥¹•Á…å}½¹™¥}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹±¥¹•Á…å}½¹™¥}Í¹…ÁÍ¡½Ð±íô¤°(€€€€€…É‘}½¹™¥}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹…É‘}½¹™¥}Í¹…ÁÍ¡½Ð±íô¤±Á…åµ•¹Ñ}Í¹…ÁÍ¡½Ñ}É•…Ñ•‘}…ÐéÉ•œ¹Á…åµ•¹Ñ}Í¹…ÁÍ¡½Ñ}É•…Ñ•‘}…Ñññ¹Õ±°(€€€ô¤¹…Ñ   ¤ôùíô¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ’îcš²û–n{–‚Ç–’ÇšV_¾ò3žÎïžÖÇ–ÞË–n{–ú§šr³š²‡¢º+šnÓ¾ò3¢®/¦7šZÃšN7’ös¾òhœ¬¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸ¢ÎšZg–¾¯–—–’ÇšV\œ¤¤ì(€ô(€ÑÉäì(€€€½¹ÍÐÍ•ÍQåÁ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€€€½¹ÍÐ‘¸€ô•Ñ¥ÍÁ±…å9…µ”¡É•œ¹¹…µ”°É•œ¹‰É…¹‘}¹…µ•ñðœœ°Í•ÍQåÁ”¤ì(€€€½¹ÍÐÑŒ€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€€€…Ý…¥Ðµ…¥±A…åµ•¹ÑI••¥Ù•¡•¹Ø°É•œ¹•µ…¥°°‘¸°Í•Í9…µ”°µ•Ñ¡½°…µ½Õ¹Ð°±…ÍÐÔ°ˆ¹É•%°ÑŒ¤ì(€ô…Ñ ¡”¤ì½¹Í½±”¹•ÉÉ½È µ…¥±A…åµ•¹ÑI••¥Ù•™…¥±•èœ°”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é”¤ì±½ÉÉ½È¡•¹Ø°íÍ½ÕÉ”è¡MÕ‰µ¥ÑA…åµ•¹Ðœ°µ•ÍÍ…”èµ…¥±A…åµ•¹ÑI••¥Ù•™…¥±•èœ°•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°±¥¹•…É‘Q•áÐé…É‘Q•áÐ°Á…åµ•¹Ñ1¥¹•…É‘Q•áÐé…É‘Q•áÐ°Á…åMÑ…ÑÕÌèŸ–úžŠë¢ª4ô¤ì)ô((¼¼É•…Ñ•1¥¹•A…å=É‘•È)…Íå¹Œ™Õ¹Ñ¥½¸¡É•…Ñ•1¥¹•A…å=É‘•È¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€É•ÑÕÉ¸©Í½¹ÉÈ Ÿžn»–&7š:‡–’[¦£’îcš²û¦žÖC¾ò/’êë–Þ—žŠë¢ª7¾ò3šr«–VžR 1%9A…äA$œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€¥˜€¡É•œ¹É•Ù¥•Ý}ÍÑ…ÑÕÌ„ôôŸ–ÞË¦2–>Xœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–Âkšr«¦2–>Xœ¤ì(€¥˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–ÞË–º3š"CžæÏ¢Êìœ¤ì(€½¹ÍÐ…µ½Õ¹Ð€ô9Õµ‰•È¡É•œ¹…µ½Õ¹Ð¥ñðÀì(€¥˜€¡…µ½Õ¹ÐðôÀ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦G¦†7¦2¿¢ªœ¤ì(€½¹ÍÐ½É‘•É%€ô€Q	0œ­…Ñ”¹¹½Ü ¤¹Ñ½MÑÉ¥¹œ ¤¹Í±¥” ´ÄÈ¤ì(€½¹ÍÐÍ•Í9…µ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€½¹ÍÐÝ½É­•ÉUÉ°€ô€¡•¹Ø¹]=I-I}UI1ññ]=I-I}AU	1%}UI0¤¹É•Á±…” ½p¼¼°œœ¤ì(€½¹ÍÐ½¹™¥ÉµUÉ°€ôÝ½É­•ÉUÉ°¬œ¼ý…Ñ¥½¸õ±¥¹•A…å½¹™¥É´™½É‘•É%ôœ­½É‘•É%ì(€½¹ÍÐ…¹•±UÉ°€ôÝ½É­•ÉUÉ°¬œ¼ý…Ñ¥½¸õ±¥¹•A…å…¹•°œì(€½¹ÍÐÁ…å±½…€ôì(€€€…µ½Õ¹Ð°ÕÉÉ•¹äèQ]œ°½É‘•É%°(€€€Á…­…•Ìémí¥èÁ­|œ­½É‘•É%°…µ½Õ¹Ð°ÁÉ½‘ÕÑÌémí¹…µ”éÍ•Í9…µ”¹Í±¥” À°ÔÀ¤°ÅÕ…¹Ñ¥ÑäèÄ°ÁÉ¥”é…µ½Õ¹Ñõuõt°(€€€É•‘¥É•ÑUÉ±Ìéí½¹™¥ÉµUÉ°°…¹•±UÉ±ô°(€ôì(€½¹ÍÐÍ•É•Ð€ô•¹Ø¹1%9Ae}MIQññ1%9Ae}MIPì(€½¹ÍÐ¡…¹¹•±%€ô•¹Ø¹1%9Ae}!991}%ññ1%9Ae}!991}%ì(€½¹ÍÐ…Á¥UÉ°€ô•¹Ø¹1%9Ae}A%}UI1ññ1%9Ae}A%}UI0ì(€½¹ÍÐ¹½¹”€ôÉåÁÑ¼¹É…¹‘½µUU% ¤ì(€½¹ÍÐÑÌ€ô…Ñ”¹¹½Ü ¤¹Ñ½MÑÉ¥¹œ ¤ì(€½¹ÍÐÕÉ¤€ô€œ½ØÌ½Á…åµ•¹ÑÌ½É•ÅÕ•ÍÐœì(€½¹ÍÐÍ¥œ€ô…Ý…¥Ð¡µ…M¡„ÈÔÙ	…Í”ØÐ¡Í•É•Ð°Í•É•Ð­ÕÉ¤­)M=8¹ÍÑÉ¥¹¥™ä¡Á…å±½…¤­¹½¹”­ÑÌ¤ì(€ÑÉäì(€€€½¹ÍÐÉ•Ì€ô…Ý…¥Ð™•Ñ ¡…Á¥UÉ°­ÕÉ¤°ì(€€€€€µ•Ñ¡½èA=MPœ°‰½‘äé)M=8¹ÍÑÉ¥¹¥™ä¡Á…å±½…¤°(€€€€€¡•…‘•ÉÌéì½¹Ñ•¹ÐµQåÁ”œè…ÁÁ±¥…Ñ¥½¸½©Í½¸œ°`µ1%9µ¡…¹¹•±%œé¡…¹¹•±%°`µ1%9µÕÑ¡½É¥é…Ñ¥½¸µ9½¹”œé¹½¹”°`µ1%9µÕÑ¡½É¥é…Ñ¥½¸µ…Ñ”œéÑÌ°`µ1%9µÕÑ¡½É¥é…Ñ¥½¸œéÍ¥ô°(€€€ô¤ì(€€€½¹ÍÐ‘…Ñ„€ô…Ý…¥ÐÉ•Ì¹©Í½¸ ¤ì(€€€¥˜€¡‘…Ñ„¹É•ÑÕÉ¹½‘”„ôôœÀÀÀÀœ¤É•ÑÕÉ¸©Í½¹ÉÈ¡‘…Ñ„¹É•ÑÕÉ¹5•ÍÍ…•ñð1%9A…äƒ¦2¿¢ªœ¤ì(€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€Á…åµ•¹ÑÌœ°í¥é•¹% Adœ¤±Ñ•¹…¹Ñ}¥éQ99P±É•¥ÍÑÉ…Ñ¥½¹}¥éˆ¹É•%±Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±•µ…¥°éÉ•œ¹•µ…¥°±…µ½Õ¹Ð±µ•Ñ¡½è1%9A…äœ±ÍÑ…ÑÕÌèŸ–ú’îcš²øœ±ÑÉ…‘•}¹¼é½É‘•É%±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€€€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°Á…åµ•¹ÑUÉ°é‘…Ñ„¹¥¹™¼¹Á…åµ•¹ÑUÉ°¹Ý•‰ô¤ì(€ô…Ñ ¡”¤ìÉ•ÑÕÉ¸©Í½¹ÉÈ 1%9A…äƒ¦žÞk–’ÇšV\è€œ­”¹µ•ÍÍ…”¤ìô)ô((¼¼É•…Ñ•Á…å=É‘•È)…Íå¹Œ™Õ¹Ñ¥½¸¡É•…Ñ•Á…å=É‘•È¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€É•ÑÕÉ¸©Í½¹ÉÈ Ÿžn»–&7š:‡–’[¦£’îcš²û¦žÖC¾ò/’êë–Þ—žŠë¢ª7¾ò3šr«–VžR£’þ‡žR£–6„A$œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€¥˜€¡É•œ¹É•Ù¥•Ý}ÍÑ…ÑÕÌ„ôôŸ–ÞË¦2–>Xœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–Âkšr«¦2–>Xœ¤ì(€¥˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–ÞË–º3š"CžæÏ¢Êìœ¤ì(€½¹ÍÐ…µ½Õ¹Ð€ô9Õµ‰•È¡É•œ¹…µ½Õ¹Ð¥ñðÀì(€¥˜€¡…µ½Õ¹ÐðôÀ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦G¦†7¦2¿¢ªœ¤ì(€½¹ÍÐµ•É¡…¹Ñ%€ô•¹Ø¹Ae}5I!9Q}%ññAe}5I!9Q}%ì(€½¹ÍÐ¡…Í¡-•ä€ô•¹Ø¹Ae}!M!}-eññAe}!M!}-dì(€½¹ÍÐ¡…Í¡%Ø€ô•¹Ø¹Ae}!M!}%YññAe}!M!}%Xì(€½¹ÍÐ…Á¥UÉ°€ô•¹Ø¹Ae}A%}UI1ññAe}A%}UI0ì(€½¹ÍÐÑÉ…‘•9¼€ô€Q	0œ­…Ñ”¹¹½Ü ¤¹Ñ½MÑÉ¥¹œ ¤¹Í±¥” ´ÄÀ¤ì(€½¹ÍÐ¹½Ü€ô¹•Ü…Ñ” ¤ì(€½¹ÍÐÁ…€ô¸ôùMÑÉ¥¹œ¡¸¤¹Á…‘MÑ…ÉÐ È°œÀœ¤ì(€½¹ÍÐÑ€ô€‘í¹½Ü¹•ÑÕ±±e•…È ¥ô¼‘íÁ…¡¹½Ü¹•Ñ5½¹Ñ  ¤¬Ä¥ô¼‘íÁ…¡¹½Ü¹•Ñ…Ñ” ¤¥ô€‘íÁ…¡¹½Ü¹•Ñ!½ÕÉÌ ¤¥ôè‘íÁ…¡¹½Ü¹•Ñ5¥¹ÕÑ•Ì ¤¥ôè‘íÁ…¡¹½Ü¹•ÑM•½¹‘Ì ¤¥õ€ì(€½¹ÍÐÍ•Í9…µ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€½¹ÍÐÝ½É­•ÉUÉ°€ô€¡•¹Ø¹]=I-I}UI1ññ]=I-I}AU	1%}UI0¤¹É•Á±…” ½p¼¼°œœ¤ì(€½¹ÍÐÁ…É…µÌ€ôì(€€€5•É¡…¹Ñ%éµ•É¡…¹Ñ%°5•É¡…¹ÑQÉ…‘•9¼éÑÉ…‘•9¼°5•É¡…¹ÑQÉ…‘•…Ñ”éÑ°(€€€A…åµ•¹ÑQåÁ”è…¥¼œ°Q½Ñ…±µ½Õ¹ÐéMÑÉ¥¹œ¡…µ½Õ¹Ð¤°(€€€QÉ…‘••ÍŒé•¹½‘•UI%½µÁ½¹•¹Ð  ¡…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø±Q99P¤¤¹¹…µ•ññ11	-}Q99Q}95¤¬Ÿ–‚Ç–B7¢Êìœ¤°(€€€%Ñ•µ9…µ”é•¹½‘•UI%½µÁ½¹•¹Ð¡Í•Í9…µ•ñðŸ–‚Ç–B7¢Êìœ¤°(€€€I•ÑÕÉ¹UI0é€‘íÝ½É­•ÉUÉ±ô¼ý…Ñ¥½¸õ•Á…åI•ÑÕÉ¹€°(€€€=É‘•ÉI•ÍÕ±ÑUI0è¡…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø±Q99P¤¤¹Í¥Ñ•UÉ°¬œýÁ…å}É•ÍÕ±ÐôÄœ°(€€€¡½½Í•A…åµ•¹Ðè10œ°¹ÉåÁÑQåÁ”èœÄœ°±¥•¹Ñ	…­UI0è¡…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø±Q99P¤¤¹Í¥Ñ•UÉ°°(€ôì(€Á…É…µÌ¹¡•­5…Y…±Õ”€ô…Ý…¥Ð•Á…å5…Œ¡Á…É…µÌ°¡…Í¡-•ä°¡…Í¡%Ø¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€Á…åµ•¹ÑÌœ°í¥é•¹% Adœ¤±Ñ•¹…¹Ñ}¥éQ99P±É•¥ÍÑÉ…Ñ¥½¹}¥éˆ¹É•%±Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±•µ…¥°éÉ•œ¹•µ…¥°±…µ½Õ¹Ð±µ•Ñ¡½èŸžÚƒžV0œ±ÍÑ…ÑÕÌèŸ–ú’îcš²øœ±ÑÉ…‘•}¹¼éÑÉ…‘•9¼±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°Á…É…µÌ°…Á¥UÉ±ô¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸•Á…å5…Œ¡Á…É…µÌ°¡…Í¡-•ä°¡…Í¡%Ø¤ì(€½¹ÍÐÍ½ÉÑ•€ô=‰©•Ð¹­•åÌ¡Á…É…µÌ¤¹Í½ÉÐ ¡„±ˆ¤ôù„¹Ñ½1½Ý•É…Í” ¤¹±½…±•½µÁ…É”¡ˆ¹Ñ½1½Ý•É…Í” ¤¤¤ì(€±•ÐÍÑÈ€ô€!…Í¡-•äôœ­¡…Í¡-•ä¬œ˜œ­Í½ÉÑ•¹µ…À¡¬ôù¬¬œôœ­Á…É…µÍm­t¤¹©½¥¸ œ˜œ¤¬œ™!…Í¡%Xôœ­¡…Í¡%Øì(€ÍÑÈ€ô•¹½‘•UI%½µÁ½¹•¹Ð¡ÍÑÈ¤¹Ñ½1½Ý•É…Í” ¤(€€€€¹É•Á±…” ¼”ÈÀ½œ°œ¬œ¤¹É•Á±…” ¼”ÈÄ½œ°œ„œ¤¹É•Á±…” ¼”Èà½œ°œ œ¤(€€€€¹É•Á±…” ¼”Èä½œ°œ¤œ¤¹É•Á±…” ¼”É„½œ°œ¨œ¤¹É•Á±…” ¼”É½œ°œ´œ¤(€€€€¹É•Á±…” ¼”É”½œ°œ¸œ¤¹É•Á±…” ¼”Õ˜½œ°|œ¤ì(€É•ÑÕÉ¸Í¡„ÈÔÙ!•à¡ÍÑÈ¤ì)ô((¼¼$ƒ’âï¢š[¢šë¾òk¢º–>[–‚Óš²‡–r[ž&¢ÎžRˆ)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑM•ÍÍ¥½¹Y¥ÍÕ…±ÍÍ•ÑÌ¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ôÀ¹}Ñ•¹…¹Ñ%ì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôMÑÉ¥¹œ¡À¹Í•ÍÍ¥½¹%ñðÀ¹Í•ÍÍ¥½¹}¥ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÍ•ÍÍ¥½¹%œ¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åA±…Ñ™½ÉµMÕÁ•É‘µ¥¸¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹}Ù¥ÍÕ…±}…ÍÍ•ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðô¨™½É‘•ÈõÉ•…Ñ•‘}…Ð¹‘•Í€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É½ÝÌ¹µ…À¡}…¥Y¥ÍÕ…±ÍÍ•ÑAÕ‰±¥Œ¤¤ì)ô((¼¼$ƒ’âï¢š[¢šë¾òk¢º–>[žRš"C’îï–.gš¶ß–>È)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑM•ÍÍ¥½¹Y¥ÍÕ…±)½‰Ì¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ôÀ¹}Ñ•¹…¹Ñ%ì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôMÑÉ¥¹œ¡À¹Í•ÍÍ¥½¹%ñðÀ¹Í•ÍÍ¥½¹}¥ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÍ•ÍÍ¥½¹%œ¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åA±…Ñ™½ÉµMÕÁ•É‘µ¥¸¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€…¥}Ù¥ÍÕ…±}©½‰Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðô¨™½É‘•ÈõÉ•…Ñ•‘}…Ð¹‘•ÍŒ™±¥µ¥ÐôÌÁ€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É½ÝÌ¹µ…À¡È€ôø€¡ì(€€€¥éÈ¹¥°Í•ÍÍ¥½¹%éÈ¹Í•ÍÍ¥½¹}¥°ÍÑ…ÑÕÌéÈ¹ÍÑ…ÑÕÌ°ÍÑå±•AÉ•Í•ÐéÈ¹ÍÑå±•}ÁÉ•Í•Ð°(€€€É•ÅÕ•ÍÑ•‘½Õ¹Ðé9Õµ‰•È¡È¹É•ÅÕ•ÍÑ•‘}½Õ¹ÑñðÀ¤°½µÁ±•Ñ•‘½Õ¹Ðé9Õµ‰•È¡È¹½µÁ±•Ñ•‘}½Õ¹ÑñðÀ¤°(€€€µ½‘•°éÈ¹µ½‘•±ñðœœ°ÅÕ…±¥ÑäéÈ¹ÅÕ…±¥Ñåñðœœ°•ÉÉ½É5•ÍÍ…”éÈ¹•ÉÉ½É}µ•ÍÍ…•ñðœœ°(€€€É•…Ñ•‘ÐéÈ¹É•…Ñ•‘}…Ññðœœ°½µÁ±•Ñ•‘ÐéÈ¹½µÁ±•Ñ•‘}…Ññðœœ(€ô¤¤¤ì)ô((¼¼$ƒ’âï¢š[¢šë¾òk–në–ºh€ÄèÇŽš¾?š²‡žRš"@€Äƒ–òÔ)…Íå¹Œ™Õ¹Ñ¥½¸¡•¹•É…Ñ•M•ÍÍ¥½¹Y¥ÍÕ…°¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ôˆ¹}Ñ•¹…¹Ñ%ì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôMÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%ñðˆ¹Í•ÍÍ¥½¹}¥ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …Í•ÍÍ¥½¹%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÍ•ÍÍ¥½¹%œ¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åA±…Ñ™½ÉµMÕÁ•É‘µ¥¸¡•¹Ø°ˆ¹•µ…¥°°ˆ¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜€ …•¹Ø¹=A9%}A%}-d¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–Âkšr«¢¢·–ºh=A9%}A%}-g¾ò3ž‡šÎWžR‹–rXœ¤ì((€½¹ÍÐÍ•ÍI½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …Í•ÍI½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Óš²„œ¤ì(€½¹ÍÐÌ€ôÍ•ÍI½ÝÍlÁtì((€€¼¼ƒ¦bË¦7¢’š&¢Êï¾òk–B3–‚Óš²„€ÌÀƒ–"¦Bc–Ÿ–ÞËšr$ÁÉ½•ÍÍ¥¹œƒ’îï–.gšf¾ò3’â7¦7¢’¦=Á•¹'Ž(€€¼¼ƒ¢Ú¦8€ÌÀƒ–"¦Bc¢š[ž
ë’â·šZß’îï–.g¾ò3š¢g¢¢`™…¥±•ƒ–ú3–¢¢Ç¦7šZÃžRš"CŽ(€½¹ÍÐÉÕ¹¹¥¹)½‰Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€…¥}Ù¥ÍÕ…±}©½‰Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™ÍÑ…ÑÕÌõ•Ä¹ÁÉ½•ÍÍ¥¹œ™Í•±•Ðõ¥±É•…Ñ•‘}…Ñ€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐ¹½Ý5Ì€ô…Ñ”¹¹½Ü ¤ì(€™½È€¡½¹ÍÐ¨½˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡ÉÕ¹¹¥¹)½‰Ì¤€üÉÕ¹¹¥¹)½‰Ì€èmt¤¤ì(€€€½¹ÍÐ…•5Ì€ô¹½Ý5Ì€´¹•Ü…Ñ”¡¨¹É•…Ñ•‘}…Ðñð€À¤¹•ÑQ¥µ” ¤ì(€€€¥˜€¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡…•5Ì¤€˜˜…•5Ì€øô€À€˜˜…•5Ì€ð€ÌÀ€¨€ØÀ€¨€ÄÀÀÀ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Óš²‡–ÞËšr$$ƒ’âï¢š[¢šëš¶–r£žRš"C¾ò3¢®/–.ÿ¦7¢’¦–èœ¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€…¥}Ù¥ÍÕ…±}©½‰Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¨¹¥¥õ€°íÍÑ…ÑÕÌè™…¥±•œ°•ÉÉ½É}µ•ÍÍ…”èŸ¦ûšf’â·šZß¾ò3–ÞË–¢¢Ç¦7šZÃžRš"@œ°½µÁ±•Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤¹…Ñ   ¤ôùíô¤ì(€ô((€½¹ÍÐ•Ù•¹ÑI½ÝÌ€ôÌ¹•Ù•¹Ñ}¥€ü…Ý…¥Ð‘‰•Ð¡•¹Ø°€•Ù•¹ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹•Ù•¹Ñ}¥¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤€èmtì(€½¹ÍÐ•ÙÐ€ô•Ù•¹ÑI½ÝÍlÁtñð¹Õ±°ì(€½¹ÍÐÑ¥Ñ±”€ôMÑÉ¥¹œ¡Ì¹¹…µ”ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ‘…Ñ•Q•áÐ€ô}…¥Y¥ÍÕ…±…Ñ•Q•áÐ¡Ì¤ì(€½¹ÍÐ±½…Ñ¥½¸€ôMÑÉ¥¹œ¡Ì¹Ù•¹Õ”ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …Ñ¥Ñ±”¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–#¢¢·–ºk–‚Óš²‡–B7ž¢Äœ¤ì(€¥˜€ …‘…Ñ•Q•áÐ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–#¢¢·–ºkšÒï–.Wš^—šr|œ¤ì(€¥˜€ …±½…Ñ¥½¸¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/–#¢¢·–ºkšÒï–.W–rÃ¦îxœ¤ì((€½¹ÍÐÉ•ÅÕ•ÍÑ•‘AÉ•Í•Ð€ôMÑÉ¥¹œ¡ˆ¹ÍÑå±•AÉ•Í•Ðñðˆ¹ÍÑå±•}ÁÉ•Í•Ðñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐÁÉ•Í•Ñ-•ä€ô}‘•Ñ•Ñ¥Y¥ÍÕ…±AÉ•Í•Ð¡Ì°•ÙÐ°É•ÅÕ•ÍÑ•‘AÉ•Í•Ð€ôôô€…ÕÑ¼œ€ü€œœ€èÉ•ÅÕ•ÍÑ•‘AÉ•Í•Ð¤ì(€¥˜€ …ÁÉ•Í•Ñ-•ä¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂD$ƒ’âï¢š[¢šë¦Š£š‚ó¢¢·–ºhœ¤ì((€½¹ÍÐ©½‰%€ô•¹% %(œ¤ì(€½¹ÍÐÉ•…Ñ•‘Ð€ô¹½Ý%Í¼ ¤ì(€½¹ÍÐÙ¥ÍÕ…±Q¡•µ•9½Ñ”€ôMÑÉ¥¹œ¡ˆ¹Ù¥ÍÕ…±Q¡•µ•9½Ñ”ñðˆ¹Ù¥ÍÕ…±}Ñ¡•µ•}¹½Ñ”ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐÁÉ½µÁÐÄ€ô}‰Õ¥±‘¥Y¥ÍÕ…±AÉ½µÁÐ¡Ì°•ÙÐ°ÁÉ•Í•Ñ-•ä°€Ä°Ù¥ÍÕ…±Q¡•µ•9½Ñ”¤ì(€½¹ÍÐµ½‘•°€ôMÑÉ¥¹œ¡•¹Ø¹=A9%}%5}5=0ñð%}Y%MU1}U1Q}5=0¤¹ÑÉ¥´ ¤ì(€½¹ÍÐÅÕ…±¥Ñä€ôMÑÉ¥¹œ¡•¹Ø¹=A9%}%5}EU1%Qdñð%}Y%MU1}U1Q}EU1%Qd¤¹ÑÉ¥´ ¤ì((€ÑÉäì(€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€…¥}Ù¥ÍÕ…±}©½‰Ìœ°ì(€€€€€¥è©½‰%°Ñ•¹…¹Ñ}¥éQ99P°Í•ÍÍ¥½¹}¥éÍ•ÍÍ¥½¹%°©½‰}ÑåÁ”èÍ•ÍÍ¥½¹}µ…¥¹}Ù¥ÍÕ…°œ°(€€€€€ÍÑ…ÑÕÌèÁÉ½•ÍÍ¥¹œœ°ÍÑå±•}ÁÉ•Í•ÐéÁÉ•Í•Ñ-•ä°…ÍÁ•Ñ}É…Ñ¥¼èœÄèÄœ°Í¥é”é%}Y%MU1}M%i°(€€€€€Ñ¥Ñ±•}Í¹…ÁÍ¡½ÐéÑ¥Ñ±”°‘…Ñ•}Í¹…ÁÍ¡½Ðé‘…Ñ•Q•áÐ°±½…Ñ¥½¹}Í¹…ÁÍ¡½Ðé±½…Ñ¥½¸°(€€€€€‘•ÍÉ¥ÁÑ¥½¹}Í¹…ÁÍ¡½ÐéMÑÉ¥¹œ¡Ì¹‘•ÍÉ¥ÁÑ¥½¹ñðœœ¤¹Í±¥” À°ÈÀÀÀ¤°(€€€€€ÁÉ½µÁÑ}Ñ•áÐéÁÉ½µÁÐÄ°É•ÅÕ•ÍÑ•‘}½Õ¹Ðé%}Y%MU1}=U9P°½µÁ±•Ñ•‘}½Õ¹ÐèÀ°(€€€€€µ½‘•°°ÅÕ…±¥Ñä°É•…Ñ•‘}‰äéˆ¹•µ…¥±ñðœœ°É•…Ñ•‘}…ÐéÉ•…Ñ•‘Ð°(€€€ô¤ì(€ô…Ñ €¡”¤ì(€€€¥˜€¡MÑÉ¥¹œ¡”€˜˜”¹µ•ÍÍ…”ñð”¤¹¥¹±Õ‘•Ì ÕÅ}…¥}Ù¥ÍÕ…±}©½‰Í}½¹•}ÁÉ½•ÍÍ¥¹œœ¤ñðMÑÉ¥¹œ¡”€˜˜”¹µ•ÍÍ…”ñð”¤¹¥¹±Õ‘•Ì ‘ÕÁ±¥…Ñ”­•äœ¤¤ì(€€€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Óš²‡–ÞËšr$$ƒ’âï¢š[¢šëš¶–r£žRš"C¾ò3¢®/–.ÿ¦7¢’¦–èœ¤ì(€€€ô(€€€Ñ¡É½Ü”ì(€ô((€½¹ÍÐÕÁ±½…‘•‘A…Ñ¡Ì€ômtì(€½¹ÍÐ¥¹Í•ÉÑ•‘ÍÍ•Ñ%‘Ì€ômtì(€ÑÉäì(€€€½¹ÍÐ•¹•É…Ñ•€ôm…Ý…¥Ð}½Á•¹¥•¹•É…Ñ•MÅÕ…É•Y¥ÍÕ…°¡•¹Ø°ÁÉ½µÁÐÄ¥tì(€€€¥˜€¡•¹•É…Ñ•¹±•¹Ñ €„ôô%}Y%MU1}=U9P¤Ñ¡É½Ü¹•ÜÉÉ½È ŸžR‹–r[šVã¦?’â7šb¼€Äƒ–òÔœ¤ì((€€€½¹ÍÐ…ÍÍ•ÑÌ€ômtì(€€€™½È€¡±•Ð¤€ô€Àì¤€ð•¹•É…Ñ•¹±•¹Ñ ì¤¬¬¤ì(€€€€€½¹ÍÐ…ÍÍ•Ñ%€ô•¹% Y%Lœ¤ì(€€€€€½¹ÍÐ™¥¹…±	åÑ•Ì€ô•¹•É…Ñ•‘m¥t¹‰åÑ•Ìì(€€€€€½¹ÍÐ™¥¹…±5¥µ”€ô€¥µ…”½Á¹œœì(€€€€€½¹ÍÐ™¥¹…±áÐ€ô€Á¹œœì(€€€€€½¹ÍÐÍÑ½É…•A…Ñ €ô€‘íQ99Qô¼‘íÍ•ÍÍ¥½¹%‘ô¼‘í©½‰%‘ô½Ù…É¥…¹Ñ|‘í¤¬Åô¸‘í™¥¹…±áÑõ€ì(€€€€€½¹ÍÐÁÕ‰±¥UÉ°€ô…Ý…¥Ð}…¥Y¥ÍÕ…±MÑ½É…•UÁ±½…¡•¹Ø°ÍÑ½É…•A…Ñ °™¥¹…±	åÑ•Ì°™¥¹…±5¥µ”¤ì(€€€€€ÕÁ±½…‘•‘A…Ñ¡Ì¹ÁÕÍ ¡ÍÑ½É…•A…Ñ ¤ì(€€€€€½¹ÍÐÉ½Ü€ô…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€Í•ÍÍ¥½¹}Ù¥ÍÕ…±}…ÍÍ•ÑÌœ°ì(€€€€€€€¥é…ÍÍ•Ñ%°Ñ•¹…¹Ñ}¥éQ99P°Í•ÍÍ¥½¹}¥éÍ•ÍÍ¥½¹%°©½‰}¥é©½‰%°(€€€€€€€…ÍÍ•Ñ}ÑåÁ”èµ…¥¹}Ù¥ÍÕ…°œ°ÍÑå±•}ÁÉ•Í•ÐéÁÉ•Í•Ñ-•ä°ÍÑ½É…•}ÁÉ½Ù¥‘•ÈèÍÕÁ…‰…Í•}ÍÑ½É…”œ°(€€€€€€€‰Õ­•Ñ}¹…µ”é%}Y%MU1}	U-P°ÍÑ½É…•}Á…Ñ éÍÑ½É…•A…Ñ °ÁÕ‰±¥}ÕÉ°éÁÕ‰±¥UÉ°°(€€€€€€€µ¥µ•}ÑåÁ”é™¥¹…±5¥µ”°Ý¥‘Ñ èÄÀÈÐ°¡•¥¡ÐèÄÀÈÐ°™¥±•}Í¥é”é™¥¹…±	åÑ•Ì¹±•¹Ñ °(€€€€€€€Ù…É¥…¹Ñ}¹¼é¤¬Ä°¥Í}Í•±•Ñ•é™…±Í”°ÁÉ½µÁÑ}Ñ•áÐéÁÉ½µÁÐÄ°(€€€€€€€É•…Ñ•‘}‰äéˆ¹•µ…¥±ñðœœ°É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¤°(€€€€€ô¤ì(€€€€€¥¹Í•ÉÑ•‘ÍÍ•Ñ%‘Ì¹ÁÕÍ ¡…ÍÍ•Ñ%¤ì(€€€€€…ÍÍ•ÑÌ¹ÁÕÍ ¡}…¥Y¥ÍÕ…±ÍÍ•ÑAÕ‰±¥Œ¡É½Ü¤¤ì(€€€ô((€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€…¥}Ù¥ÍÕ…±}©½‰Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡©½‰%¥õ€°ì(€€€€€ÍÑ…ÑÕÌèÍÕ••‘•œ°½µÁ±•Ñ•‘}½Õ¹Ðé%}Y%MU1}=U9P°½µÁ±•Ñ•‘}…Ðé¹½Ý%Í¼ ¤°•ÉÉ½É}µ•ÍÍ…”é¹Õ±°°(€€€ô¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥õ€°ì(€€€€€…¥}Ù¥ÍÕ…±}ÁÉ•Í•ÐéÁÉ•Í•Ñ-•ä°(€€€ô¤ì(€€€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø°Q99P°ˆ¹•µ…¥±ñðœœ°€…‘µ¥¸œ°€•¹•É…Ñ•}…¥}Ù¥ÍÕ…°œ°€Í•ÍÍ¥½¹Ìœ°Í•ÍÍ¥½¹%°íô°í©½‰%±ÁÉ•Í•Ñ-•ä±½Õ¹ÐèÄ±½µÁ½Í¥Ñ¥½¸èÍÑ…¹‘…Éô°íô¤ì(€€€É•ÑÕÉ¸©Í½¹=¬¡ìÍÕ•ÍÌéÑÉÕ”°©½‰%°ÍÑå±•AÉ•Í•ÐéÁÉ•Í•Ñ-•ä°…ÍÁ•ÑI…Ñ¥¼èœÄèÄœ°…ÍÍ•ÑÌô¤ì(€ô…Ñ €¡”¤ì(€€€€¼¼ƒ¦Z'žJÃ–n{šîû¾òk’îï’â–ò×’â+–
Ïš"Xƒ–¾¯–—–’ÇšV_¾ò3šâš:'šr³š²‡š&šr'–6+š"C–NŽ(€€€™½È€¡½¹ÍÐ¥½˜¥¹Í•ÉÑ•‘ÍÍ•Ñ%‘Ì¤…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°€Í•ÍÍ¥½¹}Ù¥ÍÕ…±}…ÍÍ•ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€™½È€¡½¹ÍÐÀ½˜ÕÁ±½…‘•‘A…Ñ¡Ì¤…Ý…¥Ð}…¥Y¥ÍÕ…±MÑ½É…••±•Ñ”¡•¹Ø°À¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€…¥}Ù¥ÍÕ…±}©½‰Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡©½‰%¥õ€°ì(€€€€€ÍÑ…ÑÕÌè™…¥±•œ°½µÁ±•Ñ•‘}½Õ¹ÐèÀ°•ÉÉ½É}µ•ÍÍ…”éMÑÉ¥¹œ¡”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€è”¤¹Í±¥” À°ÈÀÀÀ¤°½µÁ±•Ñ•‘}…Ðé¹½Ý%Í¼ ¤°(€€€ô¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð±½ÉÉ½È¡•¹Ø°íÑ•¹…¹Ñ%éQ99P°Í½ÕÉ”è¡•¹•É…Ñ•M•ÍÍ¥½¹Y¥ÍÕ…°œ°…Ñ¥½¸è•¹•É…Ñ•M•ÍÍ¥½¹Y¥ÍÕ…°œ°Í•ÍÍ¥½¹%°•µ…¥°éˆ¹•µ…¥±ñðœœ°•ÉÉ½Èé•ô¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ $ƒ’âï¢š[¢šëžRš"C–’ÇšV_¾òhœ€¬€¡”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€è”¤¤ì(€ô)ô((¼¼$ƒ’âï¢š[¢šë¾òk’ê3¦ã’â¢¢·ž
ëš¶–ò?’âï–r[¾ò3’â›–B3š¶—š^‹šr$½Ù•É}ÕÉ³¾ò3–&7–>Ã’â7žR£šRçš†šzÛŽ)…Íå¹Œ™Õ¹Ñ¥½¸¡M•ÑM•ÍÍ¥½¹5…¥¹Y¥ÍÕ…°¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ôˆ¹}Ñ•¹…¹Ñ%ì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôMÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%ñðˆ¹Í•ÍÍ¥½¹}¥ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ…ÍÍ•Ñ%€ôMÑÉ¥¹œ¡ˆ¹…ÍÍ•Ñ%ñðˆ¹…ÍÍ•Ñ}¥ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …Í•ÍÍ¥½¹%ñð€……ÍÍ•Ñ%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÍ•ÍÍ¥½¹%ƒš"X…ÍÍ•Ñ%œ¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åA±…Ñ™½ÉµMÕÁ•É‘µ¥¸¡•¹Ø°ˆ¹•µ…¥°°ˆ¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹}Ù¥ÍÕ…±}…ÍÍ•ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡…ÍÍ•Ñ%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã¦g–ò×’âï¢š[¢šë¾ò3š"[–r[ž&’â7–Æ³šZóšr³–‚Óš²„œ¤ì(€½¹ÍÐ…ÍÍ•Ð€ôÉ½ÝÍlÁtì(€¥˜€ ……ÍÍ•Ð¹ÁÕ‰±¥}ÕÉ°¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–r[ž&UI0ƒžòë–’Ç¾ò3’â7¢÷¢¢·ž
ëš¶–ò?’âï–rXœ¤ì((€€¼¼€ÀÈË¾òkš¶–ò?’âï–r[’ê3¦ã’âšRçžRÄIAƒ–Z»’â’ê“šbO–º3š"C¾ò3¦ÿ–7šâž¦ë¢"+’âï–r[–ú3šZÃ’âï–r[šnÓšZÃ–’ÇšV_žj–6+––_ž.š/Ž(€½¹ÍÐÉÁI•ÍÕ±Ð€ô…Ý…¥Ð‘‰IÁŒ¡•¹Ø°€Í•Ñ}Í•ÍÍ¥½¹}µ…¥¹}Ù¥ÍÕ…±}…Ñ½µ¥Œœ°ì(€€€Á}Ñ•¹…¹Ñ}¥éQ99P°(€€€Á}Í•ÍÍ¥½¹}¥éÍ•ÍÍ¥½¹%°(€€€Á}…ÍÍ•Ñ}¥é…ÍÍ•Ñ%°(€ô¤ì(€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø°Q99P°ˆ¹•µ…¥±ñðœœ°€…‘µ¥¸œ°€Í•Ñ}…¥}µ…¥¹}Ù¥ÍÕ…°œ°€Í•ÍÍ¥½¹Ìœ°Í•ÍÍ¥½¹%°íô°í…ÍÍ•Ñ%±ÁÕ‰±¥UÉ°é…ÍÍ•Ð¹ÁÕ‰±¥}ÕÉ±ô°íô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°…ÍÍ•Ðé}…¥Y¥ÍÕ…±ÍÍ•ÑAÕ‰±¥Œ¡ì¸¸¹…ÍÍ•Ð±¥Í}Í•±•Ñ•éÑÉÕ•ô¤°½Ù•ÉUÉ°é…ÍÍ•Ð¹ÁÕ‰±¥}ÕÉ°°ÉÁŒéÉÁI•ÍÕ±Ñô¤ì)ô((¼¼$ƒ’âï¢š[¢šë¾òk–"«¦f“šr«¦ãžR£–r[ž&¾òoš¶–ò?’âï–r[žšš¶‹žnÓš:—–"«¦f“Ž)…Íå¹Œ™Õ¹Ñ¥½¸¡•±•Ñ•M•ÍÍ¥½¹Y¥ÍÕ…±ÍÍ•Ð¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ôˆ¹}Ñ•¹…¹Ñ%ì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôMÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%ñðˆ¹Í•ÍÍ¥½¹}¥ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ…ÍÍ•Ñ%€ôMÑÉ¥¹œ¡ˆ¹…ÍÍ•Ñ%ñðˆ¹…ÍÍ•Ñ}¥ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …Í•ÍÍ¥½¹%ñð€……ÍÍ•Ñ%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÍ•ÍÍ¥½¹%ƒš"X…ÍÍ•Ñ%œ¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åA±…Ñ™½ÉµMÕÁ•É‘µ¥¸¡•¹Ø°ˆ¹•µ…¥°°ˆ¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐm…ÍÍ•ÑÌ°Í•ÍÍ¥½¹Ít€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹}Ù¥ÍÕ…±}…ÍÍ•ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡…ÍÍ•Ñ%¥ô™Í•±•Ðô©€¤°(€€€‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÍÍ¥½¹%¥ô™Í•±•Ðõ¥±µ…¥¹}Ù¥ÍÕ…±}…ÍÍ•Ñ}¥‘€¤°(€t¤ì(€¥˜€ ……ÍÍ•ÑÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–r[ž&œ¤ì(€½¹ÍÐ…ÍÍ•Ð€ô…ÍÍ•ÑÍlÁtì(€¥˜€¡…ÍÍ•Ð¹¥Í}Í•±•Ñ•€ôôôÑÉÕ”ñð€¡Í•ÍÍ¥½¹ÍlÁt€˜˜MÑÉ¥¹œ¡Í•ÍÍ¥½¹ÍlÁt¹µ…¥¹}Ù¥ÍÕ…±}…ÍÍ•Ñ}¥‘ñðœœ¤€ôôô…ÍÍ•Ñ%¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶–ò?’âï–r[’â7–>¿žnÓš:—–"«¦f“¾ò3¢®/–#¦ãšN–>›’â–ò×š¶–ò?’âï–rXœ¤ì(€…Ý…¥Ð}…¥Y¥ÍÕ…±MÑ½É…••±•Ñ”¡•¹Ø°…ÍÍ•Ð¹ÍÑ½É…•}Á…Ñ ¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°€Í•ÍÍ¥½¹}Ù¥ÍÕ…±}…ÍÍ•ÑÌœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡…ÍÍ•Ñ%¥õ€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°…ÍÍ•Ñ%‘ô¤ì)ô((¼¼É•…Ñ•Ù•¹Ð)…Íå¹Œ™Õ¹Ñ¥½¸¡É•…Ñ•Ù•¹Ð¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°•Ù•¹ÑÌœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ¥€ô•¹% YPœ¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°•Ù•¹ÑÌœ±í¥±Ñ•¹…¹Ñ}¥éQ99P±Ñ¥Ñ±”éˆ¹Ñ¥Ñ±”±‘•ÍÉ¥ÁÑ¥½¸éˆ¹‘•Íñðœœ±±½…Ñ¥½¸éˆ¹±½…Ñ¥½¹ñðœœ±½Ù•É}ÕÉ°éˆ¹½Ù•Éñðœœ±ÍÑ…ÑÕÌèŸ¦Z/šRû’â´œ±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥‘ô¤ì)ô(¼¼ÕÁ‘…Ñ•Ù•¹Ð)…Íå¹Œ™Õ¹Ñ¥½¸¡UÁ‘…Ñ•Ù•¹Ð¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°•Ù•¹ÑÌœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ‘…Ñ„€ôíÑ¥Ñ±”éˆ¹Ñ¥Ñ±”±‘•ÍÉ¥ÁÑ¥½¸éˆ¹‘•Íñðœœ±±½…Ñ¥½¸éˆ¹±½…Ñ¥½¹ñðœœ±½Ù•É}ÕÉ°éˆ¹½Ù•Éñðœôì(€¥˜€¡ˆ¹ÍÑ…ÑÕÌ¤‘…Ñ„¹ÍÑ…ÑÕÌõˆ¹ÍÑ…ÑÕÌì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°•Ù•¹ÑÌœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±‘…Ñ„¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô(¼¼‘•±•Ñ•Ù•¹Ð)…Íå¹Œ™Õ¹Ñ¥½¸¡•±•Ñ•Ù•¹Ð¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åA±…Ñ™½ÉµMÕÁ•É‘µ¥¸¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–"«¦f“’âï¦†3–¦fC–æÏ–>Ã¢ÚžÒkžº‡žB–N„œ¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°•Ù•¹ÑÌœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô((¼¼É•…Ñ•M•ÍÍ¥½¸(¼¼ƒ–’úo–Âkšr«–îëž®,‰¥±±¥¹}•¹Ñ¥Ñäƒ–&7žjžRÏ¢®/¦kž~—¦†¿ž’ë¾òoš¶–ò?¦fC–"Û’î7’î”‰¥±±¥¹}•¹Ñ¥Ñ¥•Ìƒž
ëšê[Ž)½¹ÍÐQI%1}eL€ô€ÌÀì)½¹ÍÐQI%1}5a}MMM%=9L€ô€Ôì((¼¼ƒŠRŠR ƒ¢¦›žR£¦fC–"Û¾òk’î”‰¥±±¥¹}•¹Ñ¥Ñ¥•Ìƒž
ëš¶–ò?’úšêC¾ò3’â7–r ]½É­•Èƒ–¾¯š¶ï–’§šVã¾ò?–‚Óš²„ƒŠRŠR )…Íå¹Œ™Õ¹Ñ¥½¸•ÑQ•¹…¹Ñ	¥±±¥¹A½±¥ä¡•¹Ø°Q99P¤ì(€½¹ÍÐÑ•¹…¹ÑÌ€ô…Ý…¥Ð‘‰•Ð (€€€•¹Ø°(€€€€Ñ•¹…¹ÑÌœ°(€€€¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Q99P¥ô™Í•±•ÐõÁ±…¹}ÑåÁ”±ÑÉ¥…±}•¹‘}…Ð±‰¥±±¥¹}•¹Ñ¥Ñå}¥±¥Í}±½­•±±½­•‘}É•…Í½¹€(€€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐÑ•¹…¹Ð€ôÑ•¹…¹ÑÍlÁtñðíôì(€±•ÐÁ½±¥ä€ôì(€€€Á±…¹QåÁ”èÑ•¹…¹Ð¹Á±…¹}ÑåÁ”ñð€œœ°(€€€ÑÉ¥…±¹‘ÐèÑ•¹…¹Ð¹ÑÉ¥…±}•¹‘}…Ðñð¹Õ±°°(€€€ÑÉ¥…±M•ÍÍ¥½¹1¥µ¥Ðè€À°(€€€±½­•èÑ•¹…¹Ð¹¥Í}±½­•€ôôôÑÉÕ”°(€€€±½­•‘I•…Í½¸èÑ•¹…¹Ð¹±½­•‘}É•…Í½¸ñð€œœ°(€ôì(€¥˜€¡Ñ•¹…¹Ð¹‰¥±±¥¹}•¹Ñ¥Ñå}¥¤ì(€€€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð (€€€€€•¹Ø°(€€€€€€‰¥±±¥¹}•¹Ñ¥Ñ¥•Ìœ°(€€€€€¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ•¹…¹Ð¹‰¥±±¥¹}•¹Ñ¥Ñå}¥¥ô™Í•±•ÐõÑÉ¥…±}Í•ÍÍ¥½¹}±¥µ¥Ð±ÑÉ¥…±}‘…å}±¥µ¥Ð±¥Í}±½­•±±½­•‘}É•…Í½¹€(€€€€¤¹…Ñ   ¤ôùmt¤ì(€€€½¹ÍÐ‰”€ôÉ½ÝÍlÁtñðíôì(€€€Á½±¥ä¹ÑÉ¥…±M•ÍÍ¥½¹1¥µ¥Ð€ô9Õµ‰•È¡‰”¹ÑÉ¥…±}Í•ÍÍ¥½¹}±¥µ¥Ð¤ñð€Àì(€€€¥˜€¡‰”¹¥Í}±½­•€ôôôÑÉÕ”¤ì(€€€€€Á½±¥ä¹±½­•€ôÑÉÕ”ì(€€€€€Á½±¥ä¹±½­•‘I•…Í½¸€ô‰”¹±½­•‘}É•…Í½¸ñðÁ½±¥ä¹±½­•‘I•…Í½¸ñð€Ÿ–âÏ–.g¦ûšr|œì(€€€ô(€ô(€É•ÑÕÉ¸Á½±¥äì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡•­QÉ¥…±M•ÍÍ¥½¹1¥µ¥Ð¡•¹Ø°Q99P¤ì(€€¼¼ƒ¢"+¢¦›žR£–‚Óš²‡’â+¦fC–ÞË–sžR£Ž–âÏ¢f¾ò?¢¢·–ºk¾ò?¦‚C¢š÷–7¢Êï¾òoš¶–ò?ž¦/šRçžRÄ•¹Ñ¥Ñ±•µ•¹Ðƒ–"“šZßŽ(€½¹ÍÐ±½¬€ô…Ý…¥Ð¡•­Q•¹…¹Ñ1½­•¡•¹Ø°Q99P¤ì(€É•ÑÕÉ¸±½¬¹±½­•€ü€¡±½¬¹É•…Í½¸ñð€Ÿš¶“’âï¢ú›ž¦ë¦ZOžn»–&7ž
ë–R¿¢º¦:[–ºhœ¤€è€œœì)ô()™Õ¹Ñ¥½¸}Í•ÍÍ¥½¹ÉÉ…ä¡Ø¤ì(€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡Ø¤¤É•ÑÕÉ¸Øì(€É•ÑÕÉ¸Í…™•)Í½¸¡Ø°mt¤ì)ô)™Õ¹Ñ¥½¸}Í•ÍÍ¥½¹=‰©•Ð¡Ø°™…±±‰…¬õíô¤ì(€¥˜€¡Ø€˜˜ÑåÁ•½˜Ø€ôôô€½‰©•Ðœ€˜˜€…ÉÉ…ä¹¥ÍÉÉ…ä¡Ø¤¤É•ÑÕÉ¸Øì(€É•ÑÕÉ¸Í…™•)Í½¸¡Ø°™…±±‰…¬¤ì)ô)™Õ¹Ñ¥½¸}Í•ÍÍ¥½¹Q•áÑ1¥ÍÐ¡Ø¤ì(€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡Ø¤¤É•ÑÕÉ¸Ø¹µ…À¡àôùMÑÉ¥¹œ¡áñðœœ¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€É•ÑÕÉ¸MÑÉ¥¹œ¡Ùñðœœ¤¹ÍÁ±¥Ð œ°œ¤¹µ…À¡àôùà¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì)ô)™Õ¹Ñ¥½¸}Í•ÍÍ¥½¹…Ñ•I½ÝÌ¡Ø¤ì(€É•ÑÕÉ¸}Í•ÍÍ¥½¹ÉÉ…ä¡Ø¤¹µ…À¡àôùì(€€€¥˜€¡ÑåÁ•½˜à€ôôô€ÍÑÉ¥¹œœ¤É•ÑÕÉ¸í‘…Ñ”éáôì(€€€É•ÑÕÉ¸ì(€€€€€‘…Ñ”éMÑÉ¥¹œ¡à¹‘…Ñ•ñðœœ¤¹ÑÉ¥´ ¤°(€€€€€±…‰•°éMÑÉ¥¹œ¡à¹±…‰•±ññà¹¹…µ•ñðœœ¤¹ÑÉ¥´ ¤°(€€€€€ÍÑ…ÉÐéMÑÉ¥¹œ¡à¹ÍÑ…ÉÑññà¹ÍÑ…ÉÑ}Ñ¥µ•ñðœœ¤¹ÑÉ¥´ ¤°(€€€€€•¹éMÑÉ¥¹œ¡à¹•¹‘ññà¹•¹‘}Ñ¥µ•ñðœœ¤¹ÑÉ¥´ ¤°(€€€€€™•”é9Õµ‰•È¡à¹™•”¥ñðÀ°(€€€€€±¥µ¥Ðé9Õµ‰•È¡à¹±¥µ¥Ð¥ñðÀ°(€€€ôì(€ô¤¹™¥±Ñ•È¡àôùà¹‘…Ñ”¤ì)ô)™Õ¹Ñ¥½¸}Ù…±¥‘…Ñ•M•ÍÍ¥½¹%¹ÁÕÐ¡ˆ¤ì(€½¹ÍÐ¹…µ”€ôMÑÉ¥¹œ¡ˆ¹¹…µ•ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …¹…µ”¤É•ÑÕÉ¸€Ÿ¢®/–†¯–¾¯–‚Óš²‡–B7ž¢Äœì(€½¹ÍÐ‘…Ñ•Ì€ô}Í•ÍÍ¥½¹…Ñ•I½ÝÌ¡ˆ¹‘…Ñ•Ì¤ì(€½¹ÍÐÍÑ…ÑÕÌõMÑÉ¥¹œ¡ˆ¹ÍÑ…ÑÕÍñðŸ¦^s¦Z$œ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ‘É…™Ñ1¥­”õlŸ¦^s¦Z$œ°Ÿ–ÞË¦^s¦Z$œ°Ÿ–sžR œ°Ÿ–Â–¶`œ°Ÿ–ÞË–Â–¶`t¹¥¹±Õ‘•Ì¡ÍÑ…ÑÕÌ¤ì(€¥˜€ …‘…Ñ•Ì¹±•¹Ñ €˜˜€…‘É…™Ñ1¥­”¤É•ÑÕÉ¸€Ÿš¶–ò?¦Z/šRû–&7¢®/¢Ï–ÂG¢¢·–ºk’â–/šÒï–.Wš^—šr|œì(€É•ÑÕÉ¸€œœì)ô()™Õ¹Ñ¥½¸‰¥±±¥¹QåÁ•½ÉÑ¥Ù¥Ñä¡Í¥¥íÉ•ÑÕÉ¸€…Ñ¥Ù¥Ñå}ÁÕ‰±¥Í èœ­MÑÉ¥¹œ¡Í¥‘ñðœœ¥ô)™Õ¹Ñ¥½¸‰¥±±¥¹QåÁ•½É=Á•É…Ñ¥½¹U¹¥Ð¡Õ¥¥íÉ•ÑÕÉ¸€…Ñ¥Ù¥Ñå}Õ¹¥Ðèœ­MÑÉ¥¹œ¡Õ¥‘ñðœœ¥ô)…Íå¹Œ™Õ¹Ñ¥½¸‰¥±±¥¹I½ÝÌ¡•¹Ø±P¥íÉ•ÑÕÉ¸‘‰•Ð¡•¹Ø°‰¥±±¥¹}±½Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™Í•±•Ðõ¥±‰¥±±¥¹}ÑåÁ”±…µ½Õ¹Ð±Ñ½Ñ…°±ÍÑ…ÑÕÌ±Í•ÍÍ¥½¹}¥±Á•É¥½‘}ÍÑ…ÉÐ±Á•É¥½‘}•¹±¹½Ñ”±É•…Ñ•‘}…Ð±½¹™¥Éµ•‘}…Ð±½¹™¥Éµ•‘}‰ä™½É‘•ÈõÉ•…Ñ•‘}…Ð¹‘•ÍŒ™±¥µ¥ÐôÄÀÀÁ€¤¹…Ñ   ¤ôùmt¥ô)…Íå¹Œ™Õ¹Ñ¥½¸•¹ÍÕÉ•A•¹‘¥¹	¥±±¥¹1½œ¡•¹Ø±P±ÑåÁ”±…µ½Õ¹Ð±¹½Ñ”±Í•ÍÍ¥½¹%ôœœ±Á•É¥½‘¹õ¹Õ±°¥í½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°‰¥±±¥¹}±½Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™‰¥±±¥¹}ÑåÁ”õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÑåÁ”¥ô™ÍÑ…ÑÕÌõ¥¸¸¡Á•¹‘¥¹œ±Á…åµ•¹Ñ}É•Á½ÉÑ•±½¹™¥Éµ•¤™Í•±•Ðõ¥±ÍÑ…ÑÕÌ™½É‘•ÈõÉ•…Ñ•‘}…Ð¹‘•ÍŒ™±¥µ¥ÐôÅ€¤¹…Ñ   ¤ôùmt¤í¥˜¡É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸É½ÝÍlÁtí½¹ÍÐ¹½Üõ¹½Ý%Í¼ ¤±É½Üõí¥é•¹% 	%0œ¤±Ñ•¹…¹Ñ}¥éP±‰¥±±¥¹}ÑåÁ”éÑåÁ”±…µ½Õ¹Ðé5…Ñ ¹µ…à À±Í…™•9Õ´¡…µ½Õ¹Ð¤¤±Ñ…àèÀ±Ñ½Ñ…°é5…Ñ ¹µ…à À±Í…™•9Õ´¡…µ½Õ¹Ð¤¤±Í•ÍÍ¥½¹}¥éÍ•ÍÍ¥½¹%‘ññ¹Õ±°±ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ±½¹™¥Éµ•‘}…Ðé¹Õ±°±½¹™¥Éµ•‘}‰äé¹Õ±°±Á•É¥½‘}ÍÑ…ÉÐé¹½Ü±Á•É¥½‘}•¹éÁ•É¥½‘¹‘ññ¹Õ±°±¹½Ñ”éMÑÉ¥¹œ¡¹½Ñ•ñðœœ¤¹Í±¥” À°ÌÀÀ¤±É•…Ñ•‘}…Ðé¹½Ýôí…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°‰¥±±¥¹}±½Ìœ±É½Ü¤íÉ•ÑÕÉ¸É½Ýô)…Íå¹Œ™Õ¹Ñ¥½¸Á±…Ñ™½ÉµÉ•‘¥Ñ	…±…¹”¡•¹Ø±P¥í½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‰¥±±¥¹I½ÝÌ¡•¹Ø±P¤íÉ•ÑÕÉ¸5…Ñ ¹µ…à À±É½ÝÌ¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹ÍÑ…ÑÕÌ¤ôôô½¹™¥Éµ•œ˜™lÍÑ…ÉÑÕÁ}É•‘¥Ñ}É…¹Ðœ°Á…ÉÑ¹•É}É•‘¥Ñ}É…¹Ðœ°Á±…Ñ™½Éµ}É•‘¥Ñ}ÕÍ”œ°Á±…Ñ™½Éµ}É•‘¥Ñ}É½±±‰…¬t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ•ñðœœ¤¤¤¹É•‘Õ” ¡¸±à¤ôù¸¬¡9Õµ‰•È¡à¹…µ½Õ¹Ð¥ñðÀ¤°À¤¥ô)…Íå¹Œ™Õ¹Ñ¥½¸¡…ÍÑ¥Ù¥Ñå¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P±Í¥¥í½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‰¥±±¥¹I½ÝÌ¡•¹Ø±P¤íÉ•ÑÕÉ¸É½ÝÌ¹Í½µ”¡àôùMÑÉ¥¹œ¡à¹ÍÑ…ÑÕÌ¤ôôô½¹™¥Éµ•œ˜™MÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ”¤ôôõ‰¥±±¥¹QåÁ•½ÉÑ¥Ù¥Ñä¡Í¥¤¥ô)…Íå¹Œ™Õ¹Ñ¥½¸¡…Í=Á•É…Ñ¥½¹U¹¥Ñ¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P±Õ¥¥í½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‰¥±±¥¹I½ÝÌ¡•¹Ø±P¤íÉ•ÑÕÉ¸É½ÝÌ¹Í½µ”¡àôùMÑÉ¥¹œ¡à¹ÍÑ…ÑÕÌ¤ôôô½¹™¥Éµ•œ˜™MÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ”¤ôôõ‰¥±±¥¹QåÁ•½É=Á•É…Ñ¥½¹U¹¥Ð¡Õ¥¤¥ô)…Íå¹Œ™Õ¹Ñ¥½¸…Ñ¥Ù•	½½­¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P¥í½¹ÍÐ¹½Üõ…Ñ”¹¹½Ü ¤±É½ÝÌõ…Ý…¥Ð‰¥±±¥¹I½ÝÌ¡•¹Ø±P¤íÉ•ÑÕÉ¸É½ÝÌ¹™¥¹¡àôùMÑÉ¥¹œ¡à¹ÍÑ…ÑÕÌ¤ôôô½¹™¥Éµ•œ˜™MÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ”¤ôôô‰½½­¥¹}µ½¹Ñ¡±äœ˜™à¹Á•É¥½‘}•¹˜™¹•Ü…Ñ”¡à¹Á•É¥½‘}•¹¤¹•ÑQ¥µ” ¤ù¹½Ü¥ññ¹Õ±±ô)™Õ¹Ñ¥½¸¥ÍA…¥‘=Á•É…Ñ¥¹M•ÍÍ¥½¸¡Ì¥í½¹ÍÐµ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ì˜™Ì¹µ½‘Õ±•Í}©Í½¸±íô¤¤±‘…Ñ•Ìõ}Í•ÍÍ¥½¹…Ñ•I½ÝÌ¡Ì˜™Ì¹‘…Ñ•Í}©Í½¸¤íÉ•ÑÕÉ¸Í…™•9Õ´¡Ì˜™Ì¹™•”¤øÁññ‘…Ñ•Ì¹Í½µ”¡àôùÍ…™•9Õ´¡à¹™•”¤øÀ¥ñð¡ÉÉ…ä¹¥ÍÉÉ…ä¡µ½‘Ì¹Í•ÉÙ¥•Ì¤˜™µ½‘Ì¹Í•ÉÙ¥•Ì¹Í½µ”¡àôùÍ…™•9Õ´¡à˜™à¹ÁÉ¥”¤øÀ¤¥ô)™Õ¹Ñ¥½¸¥ÍA…¥‘=Á•É…Ñ¥¹U¹¥Ð¡Ô¥í½¹ÍÐÁÉ¥¥¹œõÍ…™•)Í½¸¡Ô˜™Ô¹ÁÉ¥¥¹}©Í½¸±íô¤±µ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ô˜™Ô¹µ½‘Õ±•Í}©Í½¸±íô¤¤íÉ•ÑÕÉ¸Í…™•9Õ´¡Ô˜™Ô¹™•”¤øÁññÍ…™•9Õ´¡ÁÉ¥¥¹œ¹ÁÉ¥”¤øÁññÍ…™•9Õ´¡ÁÉ¥¥¹œ¹™•”¤øÁñð¡ÉÉ…ä¹¥ÍÉÉ…ä¡µ½‘Ì¹Í•ÉÙ¥•Ì¤˜™µ½‘Ì¹Í•ÉÙ¥•Ì¹Í½µ”¡àôùÍ…™•9Õ´¡à˜™à¹ÁÉ¥”¤øÀ¤¥ô)™Õ¹Ñ¥½¸‰¥±±¥¹1½µ½Õ¹Ð¡É½ÝÌ±ÑåÁ”±ÍÑ…ÑÕÍ•Ìõl½¹™¥Éµ•t¥í½¹ÍÐ…±±½Ý•õ¹•ÜM•Ð¡ÍÑ…ÑÕÍ•Ì¤íÉ•ÑÕÉ¸É½ÝÌ¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ•ñðœœ¤ôôõÑåÁ”˜™…±±½Ý•¹¡…Ì¡MÑÉ¥¹œ¡à¹ÍÑ…ÑÕÍñðœœ¤¤¤¹É•‘Õ” ¡¸±à¤ôù¸­5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹Ñ½Ñ…±ññà¹…µ½Õ¹Ð¤¤°À¥ô)…Íå¹Œ™Õ¹Ñ¥½¸Ñ•¹…¹Ñ	¥±±¥¹M¹…ÁÍ¡½Ð¡•¹Ø±P¥ì(€½¹ÍÐÁ½±¥äõ…Ý…¥ÐÁ±…Ñ™½Éµ	¥±±¥¹A½±¥ä¡•¹Ø¤±Á…åµ•¹ÑAÉ½™¥±”õ…Ý…¥ÐÁ±…Ñ™½ÉµA…åµ•¹ÑAÉ½™¥±”¡•¹Ø¤±ÍÕÁÁ½ÉÐõ…Ý…¥ÐÁÕ‰±¥A±…Ñ™½ÉµAÉ½™¥±”¡•¹Ø¤ì(€½¹ÍÐmÍ•ÍÍ¥½¹Ì±É•Ì±±½Ì±Õ¹¥ÑÍtõ…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™Í•±•Ðõ¥±¹…µ”±ÍÑ…ÑÕÌ±™•”±‘•Á½Í¥Ð±‘…Ñ•Í}©Í½¸±µ½‘Õ±•Í}©Í½¸±É•…Ñ•‘}…Ð™½É‘•ÈõÉ•…Ñ•‘}…Ð¹‘•ÍŒ™±¥µ¥ÐôÔÀÁ€¤¹…Ñ   ¤ôùmt¤°(€€€‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™Í•±•Ðõ¥±Ñ•¹…¹Ñ}¥±Í•ÍÍ¥½¹}¥±…µ½Õ¹Ð±Ñ½Ñ…±}…µ½Õ¹Ð±‘•Á½Í¥Ð±Á…¥‘}…µ½Õ¹Ð±Á…åµ•¹Ñ}ÍÑ…ÑÕÌ±É•Ù¥•Ý}ÍÑ…ÑÕÌ±É•¥ÍÑÉ…Ñ¥½¹}ÍÑ…ÑÕÌ±ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ±ÑÉ…¹Í™•É}Ñ…É•Ñ}Í•ÍÍ¥½¹}¥±É•™Õ¹‘}…µ½Õ¹Ð±‘•Á½Í¥Ñ}É•™Õ¹‘•±É•…Ñ•‘}…Ð™±¥µ¥ÐôÄÀÀÀÁ€¤¹…Ñ   ¤ôùmt¤°(€€€‰¥±±¥¹I½ÝÌ¡•¹Ø±P¤°(€€€‘‰•Ð¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™Í•±•Ðõ¥±Í•ÍÍ¥½¹}¥±¹…µ”±ÍÑ…ÑÕÌ±™•”±ÁÉ¥¥¹}©Í½¸±µ½‘Õ±•Í}©Í½¸±É•…Ñ•‘}…Ð™½É‘•ÈõÉ•…Ñ•‘}…Ð¹‘•ÍŒ™±¥µ¥ÐôÄÀÀÁ€¤¹…Ñ   ¤ôùmt¤(€t¤ì(€½¹ÍÐ¥Ñ•µÍ	åI•œõ…Ý…¥Ð}•ÑI•¥ÍÑÉ…Ñ¥½¹%Ñ•µÍ½ÉI•Ì¡•¹Ø±É•Ì¤¹…Ñ   ¤ôø¡íô¤¤ì(€½¹ÍÐÉ•Í	åM•ÍÍ¥½¸õíôí™½È¡½¹ÍÐÈ½˜É•Ì¥í½¹ÍÐÍ¥õMÑÉ¥¹œ¡È¹Í•ÍÍ¥½¹}¥‘ñðœœ¤ì¡É•Í	åM•ÍÍ¥½¹mÍ¥‘uñð¡É•Í	åM•ÍÍ¥½¹mÍ¥‘tõmt¤¤¹ÁÕÍ ¡È¥ô(€½¹ÍÐ¡…É•Ìõmtì(€™½È¡½¹ÍÐÌ½˜Í•ÍÍ¥½¹Ì¥ì(€€€½¹ÍÐÍ¥õMÑÉ¥¹œ¡Ì¹¥‘ñðœœ¤±±¥ÍÐõÉ•Í	åM•ÍÍ¥½¹mÍ¥‘uññmt±Á…¥‘5½‘”õ¥ÍA…¥‘=Á•É…Ñ¥¹M•ÍÍ¥½¸¡Ì¥ññ±¥ÍÐ¹Í½µ”¡Èôù}É•¥¹…¹•µ½Õ¹ÑÌ¡È±Ì±¥Ñ•µÍ	åI•mMÑÉ¥¹œ¡È¹¥‘ñðœœ¥uññmt¤¹É•Ù•¹Õ•Q½Ñ…°øÀ¤±¹•ÑI••¥Ù•õ±¥ÍÐ¹™¥±Ñ•È¡Èôø…}¥ÍQÉ…¹Í™•ÉM½ÕÉ•I•œ¡È¤¤¹É•‘Õ” ¡¸±È¤ôù¸­}…Í¡MÑ…Ñ•½ÉI•œ¡È±Ì±¥Ñ•µÍ	åI•mMÑÉ¥¹œ¡È¹¥‘ñðœœ¥uññmt¤¹É•Ù•¹Õ•9•Ð°À¤±ÑåÁ”õÁ…¥‘5½‘”ü…Ñ¥Ù¥Ñå}É…Ñ”èœ­Í¥é‰¥±±¥¹QåÁ•½ÉÑ¥Ù¥Ñä¡Í¥¤±¡…Í1½œõ±½Ì¹Í½µ”¡àôùMÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ•ñðœœ¤ôôõÑåÁ”¤±½Á•¸õlŸ–‚Ç–B7’â´œ°Ÿ¦Z/šRøœ°Ÿ¦Z/šRû’â´t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡Ì¹ÍÑ…ÑÕÍñðœœ¤¤±Ñ½Ñ…±•”õÁ…¥‘5½‘”ý5…Ñ ¹µ…à À±5…Ñ ¹É½Õ¹¡¹•ÑI••¥Ù•©Í…™•9Õ´¡Á½±¥ä¹Á…¥‘Ñ¥Ù¥ÑåI…Ñ•A•É•¹Ð¤¼ÄÀÀ¤¤è ¡½Á•¹ññ¡…Í1½œ¤ýÁ½±¥ä¹™É••Ñ¥Ù¥Ñå•”èÀ¤ì(€€€¥˜¡Ñ½Ñ…±•”ðôÀ˜˜…¡…Í1½œ¥½¹Ñ¥¹Õ”ì(€€€½¹ÍÐ½¹™¥Éµ•õ‰¥±±¥¹1½µ½Õ¹Ð¡±½Ì±ÑåÁ”±l½¹™¥Éµ•t¤±É•Á½ÉÑ•õ‰¥±±¥¹1½µ½Õ¹Ð¡±½Ì±ÑåÁ”±lÁ…åµ•¹Ñ}É•Á½ÉÑ•t¤±½ÕÑÍÑ…¹‘¥¹œõ5…Ñ ¹µ…à À±Ñ½Ñ…±•”µ½¹™¥Éµ•µÉ•Á½ÉÑ•¤ì(€€€¡…É•Ì¹ÁÕÍ ¡í¡…É•-•äéÑåÁ”±¡…É•QåÁ”éÁ…¥‘5½‘”üÁ…¥‘}…Ñ¥Ù¥Ñäœè™É••}…Ñ¥Ù¥Ñäœ±Í•ÍÍ¥½¹%éÍ¥±¹…µ”éÌ¹¹…µ•ññÍ¥±ÉÕ±•1…‰•°éÁ…¥‘5½‘”ýƒšRÛ¢ÊïšÒï–.W¾ös–¾›šRØ€‘íÁ½±¥ä¹Á…¥‘Ñ¥Ù¥ÑåI…Ñ•A•É•¹Ñô—¾ò#’â7–B¯–>¿¦š*ó¦G¾ò%€éƒ–7¢ÊïšÒï–.W¾ösš¾?–/ž6£ž®/–‚Óš²„9P‘íÁ½±¥ä¹™É••Ñ¥Ù¥Ñå••õ€±¹•ÑI••¥Ù•éÁ…¥‘5½‘”ý¹•ÑI••¥Ù•éÕ¹‘•™¥¹•±Ñ½Ñ…±•”±½¹™¥Éµ•‘µ½Õ¹Ðé½¹™¥Éµ•±É•Á½ÉÑ•‘µ½Õ¹ÐéÉ•Á½ÉÑ•±½ÕÑÍÑ…¹‘¥¹œ±ÍÑ…ÑÕÌéÌ¹ÍÑ…ÑÕÍñðœô¤ì(€ô(€™½È¡½¹ÍÐÔ½˜Õ¹¥ÑÌ¥ì(€€€½¹ÍÐÕ¥õMÑÉ¥¹œ¡Ô¹¥‘ñðœœ¤±ÑåÁ”õ‰¥±±¥¹QåÁ•½É=Á•É…Ñ¥½¹U¹¥Ð¡Õ¥¤±¡…Í1½œõ±½Ì¹Í½µ”¡àôùMÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ•ñðœœ¤ôôõÑåÁ”¤±Á•¹‘¥¹œõMÑÉ¥¹œ¡Ô¹ÍÑ…ÑÕÍñðœœ¤ôôôÁ•¹‘¥¹}Á…åµ•¹Ðœí¥˜¡¥ÍA…¥‘=Á•É…Ñ¥¹U¹¥Ð¡Ô¥ñð …Á•¹‘¥¹œ˜˜…¡…Í1½œ¤¥½¹Ñ¥¹Õ”í½¹ÍÐÑ½Ñ…±•”õÁ½±¥ä¹™É••Ñ¥Ù¥Ñå•”±½¹™¥Éµ•õ‰¥±±¥¹1½µ½Õ¹Ð¡±½Ì±ÑåÁ”±l½¹™¥Éµ•t¤±É•Á½ÉÑ•õ‰¥±±¥¹1½µ½Õ¹Ð¡±½Ì±ÑåÁ”±lÁ…åµ•¹Ñ}É•Á½ÉÑ•t¤í¡…É•Ì¹ÁÕÍ ¡í¡…É•-•äéÑåÁ”±¡…É•QåÁ”è™É••}½Á•É…Ñ¥½¹}Õ¹¥Ðœ±½Á•É…Ñ¥½¹U¹¥Ñ%éÕ¥±Í•ÍÍ¥½¹%éMÑÉ¥¹œ¡Ô¹Í•ÍÍ¥½¹}¥‘ñðœœ¤±¹…µ”éÔ¹¹…µ•ññÕ¥±ÉÕ±•1…‰•°éƒ–7¢Êïž6£ž®/šÒï–.W¾ösš¾?¦‚9P‘íÁ½±¥ä¹™É••Ñ¥Ù¥Ñå••õ€±Ñ½Ñ…±•”±½¹™¥Éµ•‘µ½Õ¹Ðé½¹™¥Éµ•±É•Á½ÉÑ•‘µ½Õ¹ÐéÉ•Á½ÉÑ•±½ÕÑÍÑ…¹‘¥¹œé5…Ñ ¹µ…à À±Ñ½Ñ…±•”µ½¹™¥Éµ•µÉ•Á½ÉÑ•¤±ÍÑ…ÑÕÌéÔ¹ÍÑ…ÑÕÍñðœô¤(€ô(€½¹ÍÐ‰½½­¥¹I½ÝÌõ±½Ì¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ•ñðœœ¤ôôô‰½½­¥¹}µ½¹Ñ¡±äœ˜™lÁ•¹‘¥¹œœ°½¹™¥Éµ•œ°Á…åµ•¹Ñ}É•Á½ÉÑ•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡à¹ÍÑ…ÑÕÍñðœœ¤¤¤í™½È¡½¹ÍÐà½˜‰½½­¥¹I½ÝÌ¥í½¹ÍÐ…µ½Õ¹Ðõ5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹Ñ½Ñ…±ññà¹…µ½Õ¹Ð¤¤±ÍÑ…ÑÕÌõMÑÉ¥¹œ¡à¹ÍÑ…ÑÕÍñðœœ¤í¡…É•Ì¹ÁÕÍ ¡í¡…É•-•äè‰½½­¥¹}µ½¹Ñ¡±äèœ­MÑÉ¥¹œ¡à¹¥¤±Í½ÕÉ•1½%éà¹¥±¡…É•QåÁ”è‰½½­¥¹œœ±¹…µ”èŸš2žê3¦‚CžÒšr7–.dœ±ÉÕ±•1…‰•°éƒš¾?–/ž¦/–âÏ¢fš¾?šr 9P‘íÁ½±¥ä¹‰½½­¥¹5½¹Ñ¡±å••õ€±Ñ½Ñ…±•”é…µ½Õ¹Ð±½¹™¥Éµ•‘µ½Õ¹ÐéÍÑ…ÑÕÌôôô½¹™¥Éµ•œý…µ½Õ¹ÐèÀ±É•Á½ÉÑ•‘µ½Õ¹ÐéÍÑ…ÑÕÌôôôÁ…åµ•¹Ñ}É•Á½ÉÑ•œý…µ½Õ¹ÐèÀ±½ÕÑÍÑ…¹‘¥¹œéÍÑ…ÑÕÌôôôÁ•¹‘¥¹œœý…µ½Õ¹ÐèÀ±Á•É¥½‘MÑ…ÉÐéà¹Á•É¥½‘}ÍÑ…ÉÐ±Á•É¥½‘¹éà¹Á•É¥½‘}•¹±ÍÑ…ÑÕÍô¥ô(€¡…É•Ì¹Í½ÉÐ ¡„±ˆ¤ôù9Õµ‰•È¡ˆ¹½ÕÑÍÑ…¹‘¥¹ñðÀ¤µ9Õµ‰•È¡„¹½ÕÑÍÑ…¹‘¥¹ñðÀ¥ññMÑÉ¥¹œ¡„¹¹…µ”¤¹±½…±•½µÁ…É”¡MÑÉ¥¹œ¡ˆ¹¹…µ”¤°é µ!…¹Ðœ¤¤ì(€½¹ÍÐ™É••Ñ¥Ù¥ÑåQ½Ñ…°õ¡…É•Ì¹™¥±Ñ•È¡àôùl™É••}…Ñ¥Ù¥Ñäœ°™É••}½Á•É…Ñ¥½¹}Õ¹¥Ðt¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡à¹¡…É•QåÁ•ñðœœ¤¤¤¹É•‘Õ” ¡¸±à¤ôù¸­5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹Ñ½Ñ…±•”¤¤°À¤±Á…¥‘Ñ¥Ù¥ÑåQ½Ñ…°õ¡…É•Ì¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹¡…É•QåÁ•ñðœœ¤ôôôÁ…¥‘}…Ñ¥Ù¥Ñäœ¤¹É•‘Õ” ¡¸±à¤ôù¸­5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹Ñ½Ñ…±•”¤¤°À¤±‰½½­¥¹Q½Ñ…°õ¡…É•Ì¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹¡…É•QåÁ•ñðœœ¤ôôô‰½½­¥¹œœ¤¹É•‘Õ” ¡¸±à¤ôù¸­5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹Ñ½Ñ…±•”¤¤°À¤±ÍåÍÑ•µ••Q½Ñ…°õ™É••Ñ¥Ù¥ÑåQ½Ñ…°­Á…¥‘Ñ¥Ù¥ÑåQ½Ñ…°­‰½½­¥¹Q½Ñ…°ì(€½¹ÍÐ…Ñ¥Ù•	½½­¥¹œõ…Ý…¥Ð…Ñ¥Ù•	½½­¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P¤íÉ•ÑÕÉ¸í½¬éÑÉÕ”±Á½±¥ä±Á…åµ•¹ÑAÉ½™¥±”±ÍÕÁÁ½ÉÐéíÍÕÁÁ½ÉÑµ…¥°éÍÕÁÁ½ÉÐ¹ÍÕÁÁ½ÉÑµ…¥±ñðœœ±½™™¥¥…±1¥¹•UÉ°éÍÕÁÁ½ÉÐ¹½™™¥¥…±1¥¹•UÉ±ñðœô±Á±…Ñ™½ÉµÉ•‘¥Ðé…Ý…¥ÐÁ±…Ñ™½ÉµÉ•‘¥Ñ	…±…¹”¡•¹Ø±P¤±‰½½­¥¹œé…Ñ¥Ù•	½½­¥¹œýí…Ñ¥Ù”éÑÉÕ”±Á•É¥½‘MÑ…ÉÐé…Ñ¥Ù•	½½­¥¹œ¹Á•É¥½‘}ÍÑ…ÉÐ±Á•É¥½‘¹é…Ñ¥Ù•	½½­¥¹œ¹Á•É¥½‘}•¹‘ôéí…Ñ¥Ù”é™…±Í•ô±¡…É•Ì±ÍÕµµ…ÉäéíÍåÍÑ•µ••Q½Ñ…°±™É••Ñ¥Ù¥ÑåQ½Ñ…°±Á…¥‘Ñ¥Ù¥ÑåQ½Ñ…°±‰½½­¥¹Q½Ñ…°±½ÕÑÍÑ…¹‘¥¹œé¡…É•Ì¹É•‘Õ” ¡¸±à¤ôù¸­5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹½ÕÑÍÑ…¹‘¥¹œ¤¤°À¤±É•Á½ÉÑ•é¡…É•Ì¹É•‘Õ” ¡¸±à¤ôù¸­5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹É•Á½ÉÑ•‘µ½Õ¹Ð¤¤°À¥õô)ô)™Õ¹Ñ¥½¸…‘‘…±•¹‘…É5½¹Ñ¡Q…¥Á•¤¡¥Í¼¥í½¹ÍÐõ¹•Ü…Ñ”¡¥Í¼¤±Á…ÉÑÌõ¹•Ü%¹Ñ°¹…Ñ•Q¥µ•½Éµ…Ð •¸µœ±íÑ¥µ•i½¹”èÍ¥„½Q…¥Á•¤œ±å•…Èè¹Õµ•É¥Œœ±µ½¹Ñ èœÈµ‘¥¥Ðœ±‘…äèœÈµ‘¥¥Ðœ±¡½ÕÈèœÈµ‘¥¥Ðœ±µ¥¹ÕÑ”èœÈµ‘¥¥Ðœ±Í•½¹èœÈµ‘¥¥Ðœ±¡½ÕÉå±”è ÈÌô¤¹™½Éµ…ÑQ½A…ÉÑÌ¡¤¹É•‘Õ” ¡„±à¤ôø¡…mà¹ÑåÁ•tõà¹Ù…±Õ”±„¤±íô¤í±•Ðäô­Á…ÉÑÌ¹å•…È±´ô­Á…ÉÑÌ¹µ½¹Ñ ±‘…äô­Á…ÉÑÌ¹‘…äí´¬¬í¥˜¡´ôôôÄÌ¥í´ôÄíä¬­õ½¹ÍÐ±…ÍÐõ¹•Ü…Ñ”¡…Ñ”¹UQ¡ä±´°À¤¤¹•ÑUQ…Ñ” ¤±‘õ5…Ñ ¹µ¥¸¡‘…ä±±…ÍÐ¤íÉ•ÑÕÉ¸¹•Ü…Ñ”¡€‘íåô´‘íMÑÉ¥¹œ¡´¤¹Á…‘MÑ…ÉÐ È°œÀœ¥ô´‘íMÑÉ¥¹œ¡‘¤¹Á…‘MÑ…ÉÐ È°œÀœ¥õP‘íÁ…ÉÑÌ¹¡½ÕÉôè‘íÁ…ÉÑÌ¹µ¥¹ÕÑ•ôè‘íÁ…ÉÑÌ¹Í•½¹‘ô¬ÀàèÀÁ€¤¹Ñ½%M=MÑÉ¥¹œ ¥ô)…Íå¹Œ™Õ¹Ñ¥½¸É…¹ÑA…ÉÑ¹•ÉÉ•‘¥Ð¡•¹Ø±ˆ¥í½¹ÍÐÁ…äõ…Ý…¥ÐÙ•É¥™å‘µ¥¹)ÝÐ¡ˆ¹Ñ½­•¸±•¹Ø¤í¥˜ …Á…åññÁ…ä¹¹½Éµ…±¥é•‘}É½±”„ôôÁ±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤í½¹ÍÐPõMÑÉ¥¹œ¡ˆ¹Ñ…É•Ñ}Ñ•¹…¹Ñ}¥‘ñðœœ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤±…µÐõ9Õµ‰•È¡ˆ¹…µ½Õ¹Ð¥ñðÀí¥˜ …Qññ…µÐôôôÀ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¢òã–—’âï¢ú›¢"–B#’ös¦†7–ê›¦G¦†4œ¤í½¹ÍÐ‰•™½É”õ…Ý…¥ÐÁ±…Ñ™½ÉµÉ•‘¥Ñ	…±…¹”¡•¹Ø±P¤í¥˜¡…µÐðÀ˜™‰•™½É”­…µÐðÀ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&–n{¦G¦†7’â7–>¿–’ŸšZóžn»–&7–>¿žR£¦†7–ê˜œ¤í…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°‰¥±±¥¹}±½Ìœ±í¥é•¹% 	%0œ¤±Ñ•¹…¹Ñ}¥éP±‰¥±±¥¹}ÑåÁ”èÁ…ÉÑ¹•É}É•‘¥Ñ}É…¹Ðœ±…µ½Õ¹Ðé…µÐ±Ñ…àèÀ±Ñ½Ñ…°é…µÐ±ÍÑ…ÑÕÌè½¹™¥Éµ•œ±½¹™¥Éµ•‘}…Ðé¹½Ý%Í¼ ¤±½¹™¥Éµ•‘}‰äéÁ…ä¹•µ…¥°±Á•É¥½‘}ÍÑ…ÉÐé¹½Ý%Í¼ ¤±Á•É¥½‘}•¹é¹Õ±°±¹½Ñ”éMÑÉ¥¹œ¡ˆ¹¹½Ñ•ñðŸ–B#’ös’âï¢ú›¦†7–ê›¢ªÿšVÐœ¤±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤íÉ•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±‰…±…¹”é…Ý…¥ÐÁ±…Ñ™½ÉµÉ•‘¥Ñ	…±…¹”¡•¹Ø±P¥ô¥ô)…Íå¹Œ™Õ¹Ñ¥½¸½¹™¥ÉµI•Á½ÉÑ•‘	¥±±¥¹QåÁ”¡•¹Ø±P±ÑåÁ”±½¹™¥Éµ•‘	ä¥í½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°‰¥±±¥¹}±½Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™‰¥±±¥¹}ÑåÁ”õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÑåÁ”¥ô™ÍÑ…ÑÕÌõ¥¸¸¡Á•¹‘¥¹œ±Á…åµ•¹Ñ}É•Á½ÉÑ•¤™Í•±•Ðõ¥±…µ½Õ¹Ð±Ñ½Ñ…±€¤¹…Ñ   ¤ôùmt¤±¹½Üõ¹½Ý%Í¼ ¤í™½È¡½¹ÍÐà½˜É½ÝÌ¥…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°‰¥±±¥¹}±½Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡à¹¥¥õ€±íÍÑ…ÑÕÌè½¹™¥Éµ•œ±½¹™¥Éµ•‘}…Ðé¹½Ü±½¹™¥Éµ•‘}‰äé½¹™¥Éµ•‘	åô¤íÉ•ÑÕÉ¸í½Õ¹ÐéÉ½ÝÌ¹±•¹Ñ ±…µ½Õ¹ÐéÉ½ÝÌ¹É•‘Õ” ¡¸±à¤ôù¸­5…Ñ ¹µ…à À±Í…™•9Õ´¡à¹Ñ½Ñ…±ññà¹…µ½Õ¹Ð¤¤°À¤±½¹™¥Éµ•‘Ðé¹½Ýõô)…Íå¹Œ™Õ¹Ñ¥½¸¡½¹™¥ÉµI•Á½ÉÑ•‘=Á•É…Ñ¥¹A…åµ•¹Ð¡•¹Ø±ˆ¥í½¹ÍÐÁ…äõ…Ý…¥ÐÙ•É¥™å‘µ¥¹)ÝÐ¡ˆ¹Ñ½­•¸±•¹Ø¤í¥˜ …Á…åññÁ…ä¹¹½Éµ…±¥é•‘}É½±”„ôôÁ±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤í½¹ÍÐPõMÑÉ¥¹œ¡ˆ¹Ñ…É•Ñ}Ñ•¹…¹Ñ}¥‘ñðœœ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤±­•äõMÑÉ¥¹œ¡ˆ¹¡…É•-•åñðœœ¤¹ÑÉ¥´ ¤±ÑåÁ”õ­•ä¹ÍÑ…ÉÑÍ]¥Ñ  ‰½½­¥¹}µ½¹Ñ¡±äèœ¤ü‰½½­¥¹}µ½¹Ñ¡±äœé­•äí¥˜ …Qñð…ÑåÁ”¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂGžžš"Ûš"[–âÏ–.g¦‚žn¸œ¤í½¹ÍÐ‘½¹”õ…Ý…¥Ð½¹™¥ÉµI•Á½ÉÑ•‘	¥±±¥¹QåÁ”¡•¹Ø±P±ÑåÁ”±Á…ä¹•µ…¥°¤í¥˜ …‘½¹”¹½Õ¹Ð¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ãž¶'–úžŠë¢ª7žj’îcš²û–n{–‚Äœ¤í¥˜¡ÑåÁ”¹ÍÑ…ÉÑÍ]¥Ñ  …Ñ¥Ù¥Ñå}Õ¹¥Ðèœ¤¥í½¹ÍÐÕ¥õÑåÁ”¹Í±¥” …Ñ¥Ù¥Ñå}Õ¹¥Ðèœ¹±•¹Ñ ¤í…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Õ¥¥ô™ÍÑ…ÑÕÌõ•Ä¹Á•¹‘¥¹}Á…åµ•¹Ñ€±íÍÑ…ÑÕÌè½Á•¸œ±ÕÁ‘…Ñ•‘}…Ðé‘½¹”¹½¹™¥Éµ•‘Ñô¤¹…Ñ   ¤ôùíô¥õ¥˜¡ÑåÁ”ôôô‰½½­¥¹}µ½¹Ñ¡±äœ¥í½¹ÍÐÁ•¹‘¥¹U¹¥ÑÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™ÍÑ…ÑÕÌõ•Ä¹Á•¹‘¥¹}Á…åµ•¹Ð™Í•±•Ðõ¥±µ½‘Õ±•Í}©Í½¹€¤¹…Ñ   ¤ôùmt¤í™½È¡½¹ÍÐÔ½˜Á•¹‘¥¹U¹¥ÑÌ¥¥˜¡MÑÉ¥¹œ¡¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ô¹µ½‘Õ±•Í}©Í½¸±íô¤¤¹½Á•É…Ñ¥¹5½‘•ñð…Ñ¥Ù¥Ñäœ¤ôôô‰½½­¥¹œœ¥…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ô¹¥¥õ€±íÍÑ…ÑÕÌè½Á•¸œ±ÕÁ‘…Ñ•‘}…Ðé‘½¹”¹½¹™¥Éµ•‘Ñô¤¹…Ñ   ¤ôùíô¥õ…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±P±Á…ä¹•µ…¥±ñðœœ°Á±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ°½¹™¥Éµ}É•Á½ÉÑ•‘}½Á•É…Ñ¥¹}Á…åµ•¹Ðœ°‰¥±±¥¹}±½Ìœ±ÑåÁ”±¹Õ±°±í…µ½Õ¹Ðé‘½¹”¹…µ½Õ¹Ð±½Õ¹Ðé‘½¹”¹½Õ¹Ñô±íô¤¹…Ñ   ¤ôùíô¤íÉ•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”°¸¸¹‘½¹•ô¥ô)…Íå¹Œ™Õ¹Ñ¥½¸¡½¹™¥Éµ=Á•É…Ñ¥¹A…åµ•¹Ð¡•¹Ø±ˆ¥ì(€½¹ÍÐÁ…äõ…Ý…¥ÐÙ•É¥™å‘µ¥¹)ÝÐ¡ˆ¹Ñ½­•¸±•¹Ø¤í¥˜ …Á…åññÁ…ä¹¹½Éµ…±¥é•‘}É½±”„ôôÁ±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐPõMÑÉ¥¹œ¡ˆ¹Ñ…É•Ñ}Ñ•¹…¹Ñ}¥‘ñðœœ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤±µ½‘”õMÑÉ¥¹œ¡ˆ¹µ½‘•ñðœœ¤¹ÑÉ¥´ ¤±Í¥õMÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%‘ñðœœ¤¹ÑÉ¥´ ¤±™••Ìõ…Ý…¥ÐÁ±…Ñ™½Éµ	¥±±¥¹A½±¥ä¡•¹Ø¤í¥˜ …P¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¦ãšN’âï¢ú˜œ¤ì(€¥˜¡µ½‘”ôôô‰½½­¥¹œœ¥ì(€€€½¹ÍÐ…Ñ¥Ù”õ…Ý…¥Ð…Ñ¥Ù•	½½­¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P¤í¥˜¡…Ñ¥Ù”¥É•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±…±É•…‘åÑ¥Ù”éÑÉÕ”±Á•É¥½‘¹é…Ñ¥Ù”¹Á•É¥½‘}•¹‘ô¤ì(€€€½¹ÍÐÉ•Á½ÉÑ•õ…Ý…¥Ð½¹™¥ÉµI•Á½ÉÑ•‘	¥±±¥¹QåÁ”¡•¹Ø±P°‰½½­¥¹}µ½¹Ñ¡±äœ±Á…ä¹•µ…¥°¤±ÍÑ…ÉÐõ¹½Ý%Í¼ ¤í¥˜¡É•Á½ÉÑ•¹½Õ¹Ð¥í½¹ÍÐÁ•¹‘¥¹U¹¥ÑÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™ÍÑ…ÑÕÌõ•Ä¹Á•¹‘¥¹}Á…åµ•¹Ð™Í•±•Ðõ¥±µ½‘Õ±•Í}©Í½¹€¤¹…Ñ   ¤ôùmt¤í™½È¡½¹ÍÐÔ½˜Á•¹‘¥¹U¹¥ÑÌ¥í¥˜¡MÑÉ¥¹œ¡¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ô¹µ½‘Õ±•Í}©Í½¸±íô¤¤¹½Á•É…Ñ¥¹5½‘•ñð…Ñ¥Ù¥Ñäœ¤ôôô‰½½­¥¹œœ¥…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ô¹¥¥õ€±íÍÑ…ÑÕÌè½Á•¸œ±ÕÁ‘…Ñ•‘}…ÐéÍÑ…ÉÑô¤¹…Ñ   ¤ôùíô¥õ½¹ÍÐ…Ñ¥Ù…Ñ•õ…Ý…¥Ð…Ñ¥Ù•	½½­¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P¤íÉ•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±µ½‘”±…µ½Õ¹ÐéÉ•Á½ÉÑ•¹…µ½Õ¹Ð±Á•É¥½‘¹é…Ñ¥Ù…Ñ•˜™…Ñ¥Ù…Ñ•¹Á•É¥½‘}•¹‘ññ¹Õ±±ô¥õ½¹ÍÐ•¹õ…‘‘…±•¹‘…É5½¹Ñ¡Q…¥Á•¤¡ÍÑ…ÉÐ¤í…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°‰¥±±¥¹}±½Ìœ±í¥é•¹% 	%0œ¤±Ñ•¹…¹Ñ}¥éP±‰¥±±¥¹}ÑåÁ”è‰½½­¥¹}µ½¹Ñ¡±äœ±…µ½Õ¹Ðé™••Ì¹‰½½­¥¹5½¹Ñ¡±å•”±Ñ…àèÀ±Ñ½Ñ…°é™••Ì¹‰½½­¥¹5½¹Ñ¡±å•”±ÍÑ…ÑÕÌè½¹™¥Éµ•œ±½¹™¥Éµ•‘}…ÐéÍÑ…ÉÐ±½¹™¥Éµ•‘}‰äéÁ…ä¹•µ…¥°±Á•É¥½‘}ÍÑ…ÉÐéÍÑ…ÉÐ±Á•É¥½‘}•¹é•¹±¹½Ñ”éMÑÉ¥¹œ¡ˆ¹¹½Ñ•ñðŸ–æÏ–>ÃžŠë¢ª7¦‚CžÒž¦/š²øœ¤±É•…Ñ•‘}…ÐéÍÑ…ÉÑô¤í½¹ÍÐÁ•¹‘¥¹U¹¥ÑÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™ÍÑ…ÑÕÌõ•Ä¹Á•¹‘¥¹}Á…åµ•¹Ð™Í•±•Ðõ¥±µ½‘Õ±•Í}©Í½¹€¤¹…Ñ   ¤ôùmt¤í™½È¡½¹ÍÐÔ½˜Á•¹‘¥¹U¹¥ÑÌ¥í¥˜¡MÑÉ¥¹œ¡¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ô¹µ½‘Õ±•Í}©Í½¸±íô¤¤¹½Á•É…Ñ¥¹5½‘•ñð…Ñ¥Ù¥Ñäœ¤ôôô‰½½­¥¹œœ¥…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ô¹¥¥õ€±íÍÑ…ÑÕÌè½Á•¸œ±ÕÁ‘…Ñ•‘}…ÐéÍÑ…ÉÑô¤¹…Ñ   ¤ôùíô¥õÉ•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±µ½‘”±…µ½Õ¹Ðé™••Ì¹‰½½­¥¹5½¹Ñ¡±å•”±Á•É¥½‘¹é•¹‘ô¤ì(€ô(€¥˜¡µ½‘”ôôô½Á•É…Ñ¥½¹}Õ¹¥Ðœ¥ì(€€€½¹ÍÐÕ¥õMÑÉ¥¹œ¡ˆ¹½Á•É…Ñ¥½¹U¹¥Ñ%‘ñðœœ¤¹ÑÉ¥´ ¤í¥˜ …Õ¥¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š2–ºkž¦/¦‚žn¸œ¤í½¹ÍÐÕÈõ…Ý…¥Ð‘‰•Ð¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Õ¥¥ô™Í•±•Ðõ¥±µ½‘Õ±•Í}©Í½¹€¤¹…Ñ   ¤ôùmt¤í¥˜ …ÕÈ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã¢¦Ë’âï¢ú›žjž¦/¦‚žn¸œ¤í½¹ÍÐÕ´õ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡ÕÉlÁt¹µ½‘Õ±•Í}©Í½¸±íô¤¤í¥˜¡MÑÉ¥¹œ¡Õ´¹½Á•É…Ñ¥¹5½‘•ñð…Ñ¥Ù¥Ñäœ¤ôôô‰½½­¥¹œœ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“ž¦/¦‚žn»–Æ³¦‚CžÒšr#šZçš†#¾ò3¢®/¦Z/¦k¦‚CžÒž¦/š²(œ¤í¥˜¡…Ý…¥Ð¡…Í=Á•É…Ñ¥½¹U¹¥Ñ¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P±Õ¥¤¥É•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±…±É•…‘åÑ¥Ù”éÑÉÕ•ô¤í½¹ÍÐÑåÁ”õ‰¥±±¥¹QåÁ•½É=Á•É…Ñ¥½¹U¹¥Ð¡Õ¥¤±É•Á½ÉÑ•õ…Ý…¥Ð½¹™¥ÉµI•Á½ÉÑ•‘	¥±±¥¹QåÁ”¡•¹Ø±P±ÑåÁ”±Á…ä¹•µ…¥°¤±Ðõ¹½Ý%Í¼ ¤í¥˜¡É•Á½ÉÑ•¹½Õ¹Ð¥í…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Õ¥¥ô™ÍÑ…ÑÕÌõ•Ä¹Á•¹‘¥¹}Á…åµ•¹Ñ€±íÍÑ…ÑÕÌè½Á•¸œ±ÕÁ‘…Ñ•‘}…ÐéÑô¤¹…Ñ   ¤ôùíô¤íÉ•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±µ½‘”±…µ½Õ¹ÐéÉ•Á½ÉÑ•¹…µ½Õ¹Ð±½Á•É…Ñ¥½¹U¹¥Ñ%éÕ¥‘ô¥õ…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°‰¥±±¥¹}±½Ìœ±í¥é•¹% 	%0œ¤±Ñ•¹…¹Ñ}¥éP±‰¥±±¥¹}ÑåÁ”éÑåÁ”±…µ½Õ¹Ðé™••Ì¹™É••Ñ¥Ù¥Ñå•”±Ñ…àèÀ±Ñ½Ñ…°é™••Ì¹™É••Ñ¥Ù¥Ñå•”±ÍÑ…ÑÕÌè½¹™¥Éµ•œ±½¹™¥Éµ•‘}…ÐéÐ±½¹™¥Éµ•‘}‰äéÁ…ä¹•µ…¥°±Á•É¥½‘}ÍÑ…ÉÐéÐ±Á•É¥½‘}•¹é¹Õ±°±¹½Ñ”éMÑÉ¥¹œ¡ˆ¹¹½Ñ•ñðŸ–æÏ–>ÃžŠë¢ª7ž¦/¦‚žn»¦Z/¦kš²øœ¤±É•…Ñ•‘}…ÐéÑô¤í…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°½Á•É…Ñ¥½¹}Õ¹¥ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Õ¥¥ô™ÍÑ…ÑÕÌõ•Ä¹Á•¹‘¥¹}Á…åµ•¹Ñ€±íÍÑ…ÑÕÌè½Á•¸œ±ÕÁ‘…Ñ•‘}…ÐéÑô¤¹…Ñ   ¤ôùíô¤íÉ•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±µ½‘”±…µ½Õ¹Ðé™••Ì¹™É••Ñ¥Ù¥Ñå•”±½Á•É…Ñ¥½¹U¹¥Ñ%éÕ¥‘ô¤ì(€ô(€¥˜ …l…Ñ¥Ù¥Ñäœ°…Ñ¥Ù¥Ñå}É…Ñ”t¹¥¹±Õ‘•Ì¡µ½‘”¥ñð…Í¥¥É•ÑÕÉ¸©Í½¹ÉÈ ŸšÒï–.W’îcš²û¢®/š2–ºk–‚Óš²„œ¤í½¹ÍÐÍÈõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í¥¥ô™Í•±•Ðõ¥±¹…µ”±ÍÑ…ÑÕÌ±™•”±‘•Á½Í¥Ð±‘…Ñ•Í}©Í½¸±µ½‘Õ±•Í}©Í½¸±É•…Ñ•‘}…Ñ€¤¹…Ñ   ¤ôùmt¤í¥˜ …ÍÈ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã¢¦Ë’âï¢ú›žj–‚Óš²„œ¤í¥˜¡µ½‘”ôôô…Ñ¥Ù¥Ñå}É…Ñ”œ¥í½¹ÍÐÍ¹…Àõ…Ý…¥ÐÑ•¹…¹Ñ	¥±±¥¹M¹…ÁÍ¡½Ð¡•¹Ø±P¤±±¥¹”ô¡Í¹…À¹¡…É•Íññmt¤¹™¥¹¡àôùà¹¡…É•-•äôôô…Ñ¥Ù¥Ñå}É…Ñ”èœ­Í¥¤í¥˜ …±¥¹”¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Óžn»–&7šÊKšr'šRÛ¢ÊïšÒï–.WžÎïžÖÇ¢Êìœ¤í½¹ÍÐÉ•Á½ÉÑ•õ…Ý…¥Ð½¹™¥ÉµI•Á½ÉÑ•‘	¥±±¥¹QåÁ”¡•¹Ø±P±±¥¹”¹¡…É•-•ä±Á…ä¹•µ…¥°¤í¥˜¡É•Á½ÉÑ•¹½Õ¹Ð¥É•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±µ½‘”±…µ½Õ¹ÐéÉ•Á½ÉÑ•¹…µ½Õ¹Ð±Í•ÍÍ¥½¹%éÍ¥‘ô¤í½¹ÍÐ…µ½Õ¹Ðõ5…Ñ ¹µ…à À±5…Ñ ¹É½Õ¹¡Í…™•9Õ´¡±¥¹”¹½ÕÑÍÑ…¹‘¥¹œ¤¤¤í¥˜ ……µ½Õ¹Ð¥É•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±…±É•…‘åÑ¥Ù”éÑÉÕ•ô¤í½¹ÍÐÐõ¹½Ý%Í¼ ¤í…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°‰¥±±¥¹}±½Ìœ±í¥é•¹% 	%0œ¤±Ñ•¹…¹Ñ}¥éP±‰¥±±¥¹}ÑåÁ”é±¥¹”¹¡…É•-•ä±…µ½Õ¹Ð±Ñ…àèÀ±Ñ½Ñ…°é…µ½Õ¹Ð±ÍÑ…ÑÕÌè½¹™¥Éµ•œ±½¹™¥Éµ•‘}…ÐéÐ±½¹™¥Éµ•‘}‰äéÁ…ä¹•µ…¥°±Á•É¥½‘}ÍÑ…ÉÐéÐ±Á•É¥½‘}•¹é¹Õ±°±¹½Ñ”éMÑÉ¥¹œ¡ˆ¹¹½Ñ•ñðŸ–æÏ–>ÃžŠë¢ª7šRÛ¢ÊïšÒï–.WžÎïžÖÇ¢Êìœ¤±É•…Ñ•‘}…ÐéÑô¤íÉ•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±µ½‘”±…µ½Õ¹Ð±Í•ÍÍ¥½¹%éÍ¥‘ô¥õ¥˜¡…Ý…¥Ð¡…ÍÑ¥Ù¥Ñå¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P±Í¥¤¥É•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±…±É•…‘åÑ¥Ù”éÑÉÕ•ô¤í½¹ÍÐÑåÁ”õ‰¥±±¥¹QåÁ•½ÉÑ¥Ù¥Ñä¡Í¥¤±É•Á½ÉÑ•õ…Ý…¥Ð½¹™¥ÉµI•Á½ÉÑ•‘	¥±±¥¹QåÁ”¡•¹Ø±P±ÑåÁ”±Á…ä¹•µ…¥°¤í¥˜¡É•Á½ÉÑ•¹½Õ¹Ð¥É•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±µ½‘”±…µ½Õ¹ÐéÉ•Á½ÉÑ•¹…µ½Õ¹Ð±Í•ÍÍ¥½¹%éÍ¥‘ô¤í½¹ÍÐÐõ¹½Ý%Í¼ ¤í…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°‰¥±±¥¹}±½Ìœ±í¥é•¹% 	%0œ¤±Ñ•¹…¹Ñ}¥éP±‰¥±±¥¹}ÑåÁ”éÑåÁ”±…µ½Õ¹Ðé™••Ì¹™É••Ñ¥Ù¥Ñå•”±Ñ…àèÀ±Ñ½Ñ…°é™••Ì¹™É••Ñ¥Ù¥Ñå•”±ÍÑ…ÑÕÌè½¹™¥Éµ•œ±½¹™¥Éµ•‘}…ÐéÐ±½¹™¥Éµ•‘}‰äéÁ…ä¹•µ…¥°±Á•É¥½‘}ÍÑ…ÉÐéÐ±Á•É¥½‘}•¹é¹Õ±°±¹½Ñ”éMÑÉ¥¹œ¡ˆ¹¹½Ñ•ñðŸ–æÏ–>ÃžŠë¢ª7šÒï–.Wžfó–âš²øœ¤±É•…Ñ•‘}…ÐéÑô¤íÉ•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±µ½‘”±…µ½Õ¹Ðé™••Ì¹™É••Ñ¥Ù¥Ñå•”±Í•ÍÍ¥½¹%éÍ¥‘ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñ=Á•É…Ñ¥¹	¥±±¥¹MÑ…ÑÕÌ¡•¹Ø±À¥ì(€½¹ÍÐ©ÝÐõ…Ý…¥ÐÙ•É¥™å‘µ¥¹)ÝÐ¡À¹Ñ½­•¸±•¹Ø¤í½¹ÍÐPõMÑÉ¥¹œ ¡©ÝÐ˜™©ÝÐ¹Ñ•¹…¹Ñ}¥¥ññÀ¹}Ñ•¹…¹Ñ%‘ñðœœ¤¹Ñ½1½Ý•É…Í” ¤í¥˜ …©ÝÑñð…QññPôôôÁ±…Ñ™½É´œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤í½¹ÍÐ…¹M•ÑÑ¥¹Ìõ…Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±©ÝÐ¹•µ…¥°±À¹Ñ½­•¸±P°Í•ÑÑ¥¹Ìœ¤±…¹¥¹…¹”õ…¹M•ÑÑ¥¹Íññ…Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±©ÝÐ¹•µ…¥°±À¹Ñ½­•¸±P°™¥¹…¹”œ¤í¥˜ ……¹¥¹…¹”¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤í½¹ÍÐÍ¹…Àõ…Ý…¥ÐÑ•¹…¹Ñ	¥±±¥¹M¹…ÁÍ¡½Ð¡•¹Ø±P¤±É½ÝÌõ…Ý…¥Ð‰¥±±¥¹I½ÝÌ¡•¹Ø±P¤íÉ•ÑÕÉ¸©Í½¹=¬¡ì¸¸¹Í¹…À±…Ñ¥Ù¥Ñ¥•ÌéÉ½ÝÌ¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹ÍÑ…ÑÕÌ¤ôôô½¹™¥Éµ•œ˜™MÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ•ñðœœ¤¹ÍÑ…ÉÑÍ]¥Ñ  …Ñ¥Ù¥Ñå}ÁÕ‰±¥Í èœ¤¤¹µ…À¡àôø¡íÍ•ÍÍ¥½¹%éMÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ”¤¹Í±¥” …Ñ¥Ù¥Ñå}ÁÕ‰±¥Í èœ¹±•¹Ñ ¤±É•…Ñ•‘Ðéà¹É•…Ñ•‘}…Ñô¤¤±½Á•É…Ñ¥½¹U¹¥ÑÌéÉ½ÝÌ¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹ÍÑ…ÑÕÌ¤ôôô½¹™¥Éµ•œ˜™MÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ•ñðœœ¤¹ÍÑ…ÉÑÍ]¥Ñ  …Ñ¥Ù¥Ñå}Õ¹¥Ðèœ¤¤¹µ…À¡àôø¡í½Á•É…Ñ¥½¹U¹¥Ñ%éMÑÉ¥¹œ¡à¹‰¥±±¥¹}ÑåÁ”¤¹Í±¥” …Ñ¥Ù¥Ñå}Õ¹¥Ðèœ¹±•¹Ñ ¤±É•…Ñ•‘Ðéà¹É•…Ñ•‘}…Ñô¤¥ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑQ•¹…¹Ñ	¥±±¥¹A±…Ñ™½É´¡•¹Ø±À¥í½¹ÍÐÁ…äõ…Ý…¥ÐÙ•É¥™å‘µ¥¹)ÝÐ¡À¹Ñ½­•¸±•¹Ø¤í¥˜ …Á…åññÁ…ä¹¹½Éµ…±¥é•‘}É½±”„ôôÁ±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤í½¹ÍÐPõMÑÉ¥¹œ¡À¹Ñ…É•Ñ}Ñ•¹…¹Ñ}¥‘ñðœœ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤í¥˜ …P¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¦ãšN’âï¢ú˜œ¤íÉ•ÑÕÉ¸©Í½¹=¬¡…Ý…¥ÐÑ•¹…¹Ñ	¥±±¥¹M¹…ÁÍ¡½Ð¡•¹Ø±P¤¥ô)…Íå¹Œ™Õ¹Ñ¥½¸¡I•Á½ÉÑ=Á•É…Ñ¥¹A…åµ•¹Ð¡•¹Ø±ˆ¥í½¹ÍÐ©ÝÐõ…Ý…¥ÐÙ•É¥™å‘µ¥¹)ÝÐ¡ˆ¹Ñ½­•¸±•¹Ø¤±PõMÑÉ¥¹œ ¡©ÝÐ˜™©ÝÐ¹Ñ•¹…¹Ñ}¥¥ññˆ¹}Ñ•¹…¹Ñ%‘ñðœœ¤¹Ñ½1½Ý•É…Í” ¤í¥˜ …©ÝÑñð…QññPôôôÁ±…Ñ™½É´œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤í½¹ÍÐ…¹M•ÑÑ¥¹Ìõ…Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±©ÝÐ¹•µ…¥°±ˆ¹Ñ½­•¸±P°Í•ÑÑ¥¹Ìœ¤±…¹¥¹…¹”õ…¹M•ÑÑ¥¹Íññ…Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±©ÝÐ¹•µ…¥°±ˆ¹Ñ½­•¸±P°™¥¹…¹”œ¤í¥˜ ……¹¥¹…¹”¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤í½¹ÍÐ±…ÍÐÔõMÑÉ¥¹œ¡ˆ¹±…ÍÐÕñðœœ¤¹É•Á±…” ½q½œ°œœ¤í¥˜¡±…ÍÐÔ¹±•¹Ñ „ôôÔ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¢òã–—¢ö'–âÏ–âÏ¢fšr¯’êSžŠðœ¤í½¹ÍÐÍ¹…Àõ…Ý…¥ÐÑ•¹…¹Ñ	¥±±¥¹M¹…ÁÍ¡½Ð¡•¹Ø±P¤±±¥¹”ô¡Í¹…À¹¡…É•Íññmt¤¹™¥¹¡àôùMÑÉ¥¹œ¡à¹¡…É•-•ä¤ôôõMÑÉ¥¹œ¡ˆ¹¡…É•-•ä¤¤í¥˜ …±¥¹•ññÍ…™•9Õ´¡±¥¹”¹½ÕÑÍÑ…¹‘¥¹œ¤ðôÀ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦gž¶–âÏ–.gžn»–&7šÊKšr'–úžæÏ¦G¦†4œ¤í½¹ÍÐ¹½Üõ¹½Ý%Í¼ ¤±…µ½Õ¹Ðõ5…Ñ ¹µ…à À±5…Ñ ¹É½Õ¹¡Í…™•9Õ´¡±¥¹”¹½ÕÑÍÑ…¹‘¥¹œ¤¤¤±¹½Ñ”õ)M=8¹ÍÑÉ¥¹¥™ä¡íÍ½ÕÉ”èÑ•¹…¹Ñ}Á…åµ•¹Ñ}É•Á½ÉÐœ±±…ÍÐÔ±¹½Ñ”éMÑÉ¥¹œ¡ˆ¹¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤¹Í±¥” À°ÄÈÀ¤±É•Á½ÉÑ•‘	äé©ÝÐ¹•µ…¥°±É•Á½ÉÑ•‘Ðé¹½Ýô¤±ÑåÁ”õMÑÉ¥¹œ¡±¥¹”¹¡…É•-•ä¤¹ÍÑ…ÉÑÍ]¥Ñ  ‰½½­¥¹}µ½¹Ñ¡±äèœ¤ü‰½½­¥¹}µ½¹Ñ¡±äœéMÑÉ¥¹œ¡±¥¹”¹¡…É•-•ä¤±½±õ…Ý…¥Ð‘‰•Ð¡•¹Ø°‰¥±±¥¹}±½Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™‰¥±±¥¹}ÑåÁ”õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÑåÁ”¥ô™ÍÑ…ÑÕÌõ•Ä¹Á…åµ•¹Ñ}É•Á½ÉÑ•™Í•±•Ðõ¥™±¥µ¥ÐôÅ€¤¹…Ñ   ¤ôùmt¤í¥˜¡½±¹±•¹Ñ ¥…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°‰¥±±¥¹}±½Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½±‘lÁt¹¥¥õ€±í…µ½Õ¹Ð±Ñ½Ñ…°é…µ½Õ¹Ð±¹½Ñ”±É•…Ñ•‘}…Ðé¹½Ýô¤í•±Í”…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°‰¥±±¥¹}±½Ìœ±í¥é•¹% 	%0œ¤±Ñ•¹…¹Ñ}¥éP±‰¥±±¥¹}ÑåÁ”éÑåÁ”±…µ½Õ¹Ð±Ñ…àèÀ±Ñ½Ñ…°é…µ½Õ¹Ð±Í•ÍÍ¥½¹}¥é±¥¹”¹Í•ÍÍ¥½¹%‘ññ¹Õ±°±ÍÑ…ÑÕÌèÁ…åµ•¹Ñ}É•Á½ÉÑ•œ±½¹™¥Éµ•‘}…Ðé¹Õ±°±½¹™¥Éµ•‘}‰äé¹Õ±°±Á•É¥½‘}ÍÑ…ÉÐé±¥¹”¹Á•É¥½‘MÑ…ÉÑññ¹½Ü±Á•É¥½‘}•¹é±¥¹”¹Á•É¥½‘¹‘ññ¹Õ±°±¹½Ñ”±É•…Ñ•‘}…Ðé¹½Ýô¤í…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±P±©ÝÐ¹•µ…¥±ñðœœ°…‘µ¥¸œ°É•Á½ÉÑ}½Á•É…Ñ¥¹}Á…åµ•¹Ðœ°‰¥±±¥¹}±½Ìœ±½±‘lÁtü¹¥‘ñðœœ±¹Õ±°±í¡…É•-•äé±¥¹”¹¡…É•-•ä±…µ½Õ¹Ð±±…ÍÐÔé€¨¨¨‘í±…ÍÐÔ¹Í±¥” ´È¥õô±íô¤¹…Ñ   ¤ôùíô¤íÉ•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±…µ½Õ¹Ð±ÍÑ…ÑÕÌèÁ…åµ•¹Ñ}É•Á½ÉÑ•ô¥ô)…Íå¹Œ™Õ¹Ñ¥½¸½¹ÍÕµ•É•‘¥Ñ=É9••‘A…åµ•¹Ð¡•¹Ø±P±…µ½Õ¹Ð±­¥¹±¹½Ñ”±Á•É¥½‘¹õ¹Õ±°¥ì(€½¹ÍÐÈõ…Ý…¥Ð‘‰IÁŒ¡•¹Ø°½¹ÍÕµ•}Á±…Ñ™½Éµ}É•‘¥Ñ}…Ñ½µ¥Œœ±íÁ}Ñ•¹…¹Ñ}¥éP±Á}…µ½Õ¹Ðé5…Ñ ¹µ…à À±9Õµ‰•È¡…µ½Õ¹Ð¥ñðÀ¤±Á}­¥¹éMÑÉ¥¹œ¡­¥¹‘ñðœœ¤±Á}¹½Ñ”éMÑÉ¥¹œ¡¹½Ñ•ñðœœ¤±Á}Á•É¥½‘}•¹éÁ•É¥½‘¹‘ññ¹Õ±±ô¤¹…Ñ ¡”ôø¡í½¬é™…±Í”±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”éMÑÉ¥¹œ¡”¥ô¤¤ì(€¥˜ …ÉññÈ¹½¬ôôõ™…±Í”¥í¥˜¡È˜™È¹•ÉÉ½È¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿ–æÏ–>Ã¦†7–ê›š&š*×–’ÇšV_¾òhœ­È¹•ÉÉ½È¤íÉ•ÑÕÉ¸í½¬é™…±Í”±¹••‘A…åµ•¹ÐéÑÉÕ”±…µ½Õ¹Ð±‰…±…¹”é5…Ñ ¹µ…à À±9Õµ‰•È¡È˜™È¹‰…±…¹”¥ñðÀ¥õô(€É•ÑÕÉ¸í½¬éÑÉÕ”±‰…±…¹”é5…Ñ ¹µ…à À±9Õµ‰•È¡È¹‰…±…¹”¥ñðÀ¤±±•‘•É%éÈ¹±•‘•É%‘ññÈ¹±•‘•É}¥‘ñðœôì)ô)…Íå¹Œ™Õ¹Ñ¥½¸É½±±‰…­A±…Ñ™½ÉµÉ•‘¥ÑUÍ”¡•¹Ø±P±…µ½Õ¹Ð±±•‘•É%±¹½Ñ”¥ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°‰¥±±¥¹}±½Ìœ±í¥é•¹% 	%0œ¤±Ñ•¹…¹Ñ}¥éP±‰¥±±¥¹}ÑåÁ”èÁ±…Ñ™½Éµ}É•‘¥Ñ}É½±±‰…¬œ±…µ½Õ¹Ðé5…Ñ ¹…‰Ì¡Í…™•9Õ´¡…µ½Õ¹Ð¤¤±Ñ…àèÀ±Ñ½Ñ…°é5…Ñ ¹…‰Ì¡Í…™•9Õ´¡…µ½Õ¹Ð¤¤±ÍÑ…ÑÕÌè½¹™¥Éµ•œ±½¹™¥Éµ•‘}…Ðé¹½Ý%Í¼ ¤±½¹™¥Éµ•‘}‰äèÍåÍÑ•´œ±Á•É¥½‘}ÍÑ…ÉÐé¹½Ý%Í¼ ¤±Á•É¥½‘}•¹é¹Õ±°±¹½Ñ”éÉ½±±‰…¬è‘í±•‘•É%‘ñðœõð‘í¹½Ñ•ñðœõ€±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸½Á•É…Ñ¥¹¹Ñ¥Ñ±•µ•¹ÑÑ¥Ù”¡•¹Ø±P±Ì¥ì(€½¹ÍÐµ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ì˜™Ì¹µ½‘Õ±•Í}©Í½¸±íô¤¤ì(€¥˜¡MÑÉ¥¹œ¡µ½‘Ì¹½Á•É…Ñ¥¹5½‘•ñð…Ñ¥Ù¥Ñäœ¤ôôô‰½½­¥¹œœ¥É•ÑÕÉ¸€„„¡…Ý…¥Ð…Ñ¥Ù•	½½­¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P¤¤ì(€É•ÑÕÉ¸…Ý…¥Ð¡…ÍÑ¥Ù¥Ñå¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P±Ì˜™Ì¹¥¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸•¹ÍÕÉ•=Á•É…Ñ¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P±Ì¥ì(€½¹ÍÐµ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ì¹µ½‘Õ±•Í}©Í½¸±íô¤¤í½¹ÍÐµ½‘”õMÑÉ¥¹œ¡µ½‘Ì¹½Á•É…Ñ¥¹5½‘•ñð…Ñ¥Ù¥Ñäœ¤±™••Ìõ…Ý…¥ÐÁ±…Ñ™½Éµ	¥±±¥¹A½±¥ä¡•¹Ø¤ì(€¥˜¡µ½‘”ôôô‰½½­¥¹œœ¥ì(€€€½¹ÍÐ…Ðõ…Ý…¥Ð…Ñ¥Ù•	½½­¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P¤í¥˜¡…Ð¥É•ÑÕÉ¸í½¬éÑÉÕ”±µ½‘”±Á•É¥½‘¹é…Ð¹Á•É¥½‘}•¹‘ôì(€€€½¹ÍÐ•¹õ…‘‘…±•¹‘…É5½¹Ñ¡Q…¥Á•¤¡¹½Ý%Í¼ ¤¤±Œõ…Ý…¥Ð½¹ÍÕµ•É•‘¥Ñ=É9••‘A…åµ•¹Ð¡•¹Ø±P±™••Ì¹‰½½­¥¹5½¹Ñ¡±å•”°‰½½­¥¹}µ½¹Ñ¡±äœ±Ì¹¥±•¹¤í¥˜ …Œ¹½¬¥í…Ý…¥Ð•¹ÍÕÉ•A•¹‘¥¹	¥±±¥¹1½œ¡•¹Ø±P°‰½½­¥¹}µ½¹Ñ¡±äœ±™••Ì¹‰½½­¥¹5½¹Ñ¡±å•”°Ÿž¶'–úžžš"ÛžæÏ’ê“¦‚CžÒž¦/šr#¢Êìœ±Ì¹¥±•¹¤íÉ•ÑÕÉ¸ì¸¸¹Œ±µ½‘•õô(€€€½¹ÍÐÉ…•õ…Ý…¥Ð…Ñ¥Ù•	½½­¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P¤í¥˜¡É…•¥í…Ý…¥ÐÉ½±±‰…­A±…Ñ™½ÉµÉ•‘¥ÑUÍ”¡•¹Ø±P±™••Ì¹‰½½­¥¹5½¹Ñ¡±å•”±Œ¹±•‘•É%°‰½½­¥¹}•¹Ñ¥Ñ±•µ•¹Ñ}…±É•…‘å}É•…Ñ•œ¤¹…Ñ   ¤ôùíô¤íÉ•ÑÕÉ¸í½¬éÑÉÕ”±µ½‘”±Á•É¥½‘¹éÉ…•¹Á•É¥½‘}•¹‘õô(€€€ÑÉåì(€€€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°‰¥±±¥¹}±½Ìœ±í¥é•¹% 	%0œ¤±Ñ•¹…¹Ñ}¥éP±‰¥±±¥¹}ÑåÁ”è‰½½­¥¹}µ½¹Ñ¡±äœ±…µ½Õ¹Ðé™••Ì¹‰½½­¥¹5½¹Ñ¡±å•”±Ñ…àèÀ±Ñ½Ñ…°é™••Ì¹‰½½­¥¹5½¹Ñ¡±å•”±ÍÑ…ÑÕÌè½¹™¥Éµ•œ±½¹™¥Éµ•‘}…Ðé¹½Ý%Í¼ ¤±½¹™¥Éµ•‘}‰äèÁ±…Ñ™½Éµ}É•‘¥Ðœ±Á•É¥½‘}ÍÑ…ÉÐé¹½Ý%Í¼ ¤±Á•É¥½‘}•¹é•¹±¹½Ñ”èŸ¦‚CžÒž¦/šr#šZçš† œ±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€€€õ…Ñ ¡”¥í…Ý…¥ÐÉ½±±‰…­A±…Ñ™½ÉµÉ•‘¥ÑUÍ”¡•¹Ø±P±™••Ì¹‰½½­¥¹5½¹Ñ¡±å•”±Œ¹±•‘•É%°‰½½­¥¹}•¹Ñ¥Ñ±•µ•¹Ñ}™…¥±•œ¤¹…Ñ   ¤ôùíô¤íÑ¡É½Ü•ô(€€€É•ÑÕÉ¸í½¬éÑÉÕ”±µ½‘”±Á•É¥½‘¹é•¹‘ôì(€ô(€¥˜¡¥ÍA…¥‘=Á•É…Ñ¥¹M•ÍÍ¥½¸¡Ì¤¥É•ÑÕÉ¸í½¬éÑÉÕ”±µ½‘”±¡…É•5½‘”èÁ…¥‘}…Ñ¥Ù¥Ñå}É…Ñ”ôì(€¥˜¡…Ý…¥Ð¡…ÍÑ¥Ù¥Ñå¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P±Ì¹¥¤¥É•ÑÕÉ¸í½¬éÑÉÕ”±µ½‘•ôì(€½¹ÍÐŒõ…Ý…¥Ð½¹ÍÕµ•É•‘¥Ñ=É9••‘A…åµ•¹Ð¡•¹Ø±P±™••Ì¹™É••Ñ¥Ù¥Ñå•”°…Ñ¥Ù¥Ñå}ÁÕ‰±¥Í œ±Ì¹¥¤í¥˜ …Œ¹½¬¥í…Ý…¥Ð•¹ÍÕÉ•A•¹‘¥¹	¥±±¥¹1½œ¡•¹Ø±P±‰¥±±¥¹QåÁ•½ÉÑ¥Ù¥Ñä¡Ì¹¥¤±™••Ì¹™É••Ñ¥Ù¥Ñå•”°Ÿž¶'–úžžš"ÛžæÏ’ê“–7¢ÊïšÒï–.W–VžR£¢Êìœ±Ì¹¥¤íÉ•ÑÕÉ¸ì¸¸¹Œ±µ½‘•õô(€¥˜¡…Ý…¥Ð¡…ÍÑ¥Ù¥Ñå¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±P±Ì¹¥¤¥í…Ý…¥ÐÉ½±±‰…­A±…Ñ™½ÉµÉ•‘¥ÑUÍ”¡•¹Ø±P±™••Ì¹™É••Ñ¥Ù¥Ñå•”±Œ¹±•‘•É%°…Ñ¥Ù¥Ñå}•¹Ñ¥Ñ±•µ•¹Ñ}…±É•…‘å}É•…Ñ•œ¤¹…Ñ   ¤ôùíô¤íÉ•ÑÕÉ¸í½¬éÑÉÕ”±µ½‘•õô(€ÑÉåì(€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°‰¥±±¥¹}±½Ìœ±í¥é•¹% 	%0œ¤±Ñ•¹…¹Ñ}¥éP±‰¥±±¥¹}ÑåÁ”é‰¥±±¥¹QåÁ•½ÉÑ¥Ù¥Ñä¡Ì¹¥¤±…µ½Õ¹Ðé™••Ì¹™É••Ñ¥Ù¥Ñå•”±Ñ…àèÀ±Ñ½Ñ…°é™••Ì¹™É••Ñ¥Ù¥Ñå•”±ÍÑ…ÑÕÌè½¹™¥Éµ•œ±½¹™¥Éµ•‘}…Ðé¹½Ý%Í¼ ¤±½¹™¥Éµ•‘}‰äèÁ±…Ñ™½Éµ}É•‘¥Ðœ±Á•É¥½‘}ÍÑ…ÉÐé¹½Ý%Í¼ ¤±Á•É¥½‘}•¹é¹Õ±°±¹½Ñ”èŸšÒï–.Wžfó–âš²(œ±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€õ…Ñ ¡”¥í…Ý…¥ÐÉ½±±‰…­A±…Ñ™½ÉµÉ•‘¥ÑUÍ”¡•¹Ø±P±™••Ì¹™É••Ñ¥Ù¥Ñå•”±Œ¹±•‘•É%°…Ñ¥Ù¥Ñå}•¹Ñ¥Ñ±•µ•¹Ñ}™…¥±•œ¤¹…Ñ   ¤ôùíô¤íÑ¡É½Ü•ô(€É•ÑÕÉ¸í½¬éÑÉÕ”±µ½‘•ôì)ô()™Õ¹Ñ¥½¸}Ù…±¥‘…Ñ•M•ÍÍ¥½¹½É=Á•¹I½Ü¡Ì¥ì(€½¹ÍÐµ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ì˜™Ì¹µ½‘Õ±•Í}©Í½¸±íô¤¤±‘…Ñ•I½ÝÌõÍ…™•)Í½¸¡Ì˜™Ì¹‘…Ñ•Í}©Í½¸±mt¤ì(€¥˜¡µ½‘Ì¹½Á•É…Ñ¥¹5½‘”ôôô…Ñ¥Ù¥Ñäœ€˜˜ÉÉ…ä¹¥ÍÉÉ…ä¡‘…Ñ•I½ÝÌ¤€˜˜‘…Ñ•I½ÝÌ¹±•¹Ñ øÄ€˜˜€…µ½‘Ì¹…Ñ¥Ù¥Ñå…Ñ•ÍQ½•Ñ¡•È¥É•ÑÕÉ¸€Ÿš¶“šÒï–.Wšr'–’k–/š^—šrŽ¢.—–>–*ƒ¢–>¿–"–"—¦ãšNš^—šr¾ò3¢®/š.š"Cž6£ž®/–‚Óš²‡¾ò#š¾?–/ž6£ž®/–‚Óš²„9PÈÀÃ¾ò'¾òo¢.—–þ¦‚#’âš²‡–‚Ç–B7–£¦£š^—šr¾ò3¢®/–.û¦ãŽ3–’kš^—šrž
ë–B3’â–º3šVÓšÒï–.WŽ7Žœì((€½¹ÍÐÍÑ…ÑÕÌõMÑÉ¥¹œ¡Ì˜™Ì¹ÍÑ…ÑÕÍñðŸ¦^s¦Z$œ¤ì(€½¹ÍÐ‘…Ñ•Ìõ}Í•ÍÍ¥½¹…Ñ•I½ÝÌ¡Ì˜™Ì¹‘…Ñ•Í}©Í½¸¤ì(€¥˜¡ÍÑ…ÑÕÌ„ôôŸ–‚Ç–B7’â´œ˜™ÍÑ…ÑÕÌ„ôôŸ¦Z/šRøœ¥É•ÑÕÉ¸€œœì(€½¹ÍÐ‰…Í¥Œõ}Ù…±¥‘…Ñ•M•ÍÍ¥½¹%¹ÁÕÐ¡í¹…µ”éÌ˜™Ì¹¹…µ”±‘…Ñ•ÌéÍ…™•)Í½¸¡Ì˜™Ì¹‘…Ñ•Í}©Í½¸±mt¤±ÍÑ…ÑÕÍô¤ì(€¥˜¡‰…Í¥Œ¥É•ÑÕÉ¸‰…Í¥Œì(€¥˜¡µ½‘Ì¹Ý½É­Í¡½ÁM±½ÑÌ€˜˜‘…Ñ•Ì¹Í½µ”¡ôø…MÑÉ¥¹œ¡¹ÍÑ…ÉÑñðœœ¤¹ÑÉ¥´ ¤¤¥É•ÑÕÉ¸€Ÿš¶“–‚Ó–VžR£š^—šr¾ò?šfšº×š¢‡žÖ¾ò3¢®/–#ž
ëš¾?–/–>¿–‚Ç–B7šfšº×¢¢·–ºk¦Z/–ž/šf¦ZLœì(€¥˜¡µ½‘Ì¹Í•ÉÙ¥”€˜˜€…µ½‘Ì¹Í•ÉÙ¥•Ì¹±•¹Ñ ¥É•ÑÕÉ¸€Ÿš¶“–‚Ó–VžR£šr7–.g¦‚žn»š¢‡žÖ¾ò3¢®/¢Ï–ÂG–îëž®/’â–/šr7–.g¦‚žn¸œì(€¥˜¡µ½‘Ì¹É•Í½ÕÉ”€˜˜€…µ½‘Ì¹É•Í½ÕÉ•Ì¹±•¹Ñ ¥É•ÑÕÉ¸€Ÿš¶“–‚Ó–VžR£š2–ºk’êë–N‡¾ò?¢ÎšêCš¢‡žÖ¾ò3¢®/¢Ï–ÂG–îëž®/’â–/–>¿¦ã¢Îšê@œì(€¥˜¡µ½‘Ì¹Á…ÉÑ¥¥Á…¹ÑÌ€˜˜€…µ½‘Ì¹Á…ÉÑ¥¥Á…¹ÑQåÁ•Ì¹±•¹Ñ ¥É•ÑÕÉ¸€Ÿš¶“–‚Ó–VžR£ž–£ž¢»¾ò?’êëšVãš¢‡žÖ¾ò3¢®/¢Ï–ÂG–îëž®/’â–/ž–£ž¢¸œì(€¥˜¡µ½‘Ì¹½Á•É…Ñ¥¹5½‘”ôôô‰½½­¥¹œœ¥ì(€€€¥˜ …µ½‘Ì¹Ý½É­Í¡½ÁM±½ÑÌ¥É•ÑÕÉ¸€Ÿ¦‚CžÒ–z/š¶–ò?¦Z/šRû–&7¾ò3¢®/–VžR£š^—šr¾ò?šfšº×š¢‡žÖœì(€€€¥˜ …µ½‘Ì¹Á…åµ•¹Ð¥É•ÑÕÉ¸€Ÿ¦‚CžÒ–z/š¶–ò?¦Z/šRû–&7¾ò3¢®/–VžR£’îcš²ûš¢‡žÖœì(€€€½¹ÍÐ‰Àõµ½‘Ì¹‰½½­¥¹A½±¥åññíôì(€€€¥˜¡‰À¹Á…åµ•¹Ñ5½‘”ôôô‘•Á½Í¥Ðœ€˜˜Í…™•9Õ´¡‰À¹‘•Á½Í¥ÑY…±Õ”¤ðôÀ¥É•ÑÕÉ¸€Ÿ¢¢¦G–"Ûžj¢¢¦G¦G¦†7¾ò?š¾S’ú/–þ¦‚#–’ŸšZð€Àœì(€€€½¹ÍÐ¡…ÍAÉ¥”õÍ…™•9Õ´¡Ì¹™•”¤øÀñð€¡ÉÉ…ä¹¥ÍÉÉ…ä¡µ½‘Ì¹Í•ÉÙ¥•Ì¤˜™µ½‘Ì¹Í•ÉÙ¥•Ì¹Í½µ”¡àôùÍ…™•9Õ´¡à¹ÁÉ¥”¤øÀ¤¤ñð‘…Ñ•Ì¹Í½µ”¡ôùÍ…™•9Õ´¡¹™•”¤øÀ¤ì(€€€¥˜ …¡…ÍAÉ¥”¥É•ÑÕÉ¸€Ÿ¦‚CžÒ–z/š¶–ò?¦Z/šRû–&7¾ò3¢®/¢¢·–ºk–’ŸšZð€Àƒžjš¶–ò?šr7–.g¾ò?šfšº×¢ÊïžR œì(€ô(€É•ÑÕÉ¸€œœì)ô()™Õ¹Ñ¥½¸}Í•ÍÍ¥½¹	…Í•A…å±½…¡ˆ°¥¹±Õ‘••™…Õ±ÑÌõ™…±Í”¤ì(€½¹ÍÐ‘…Ñ„€ôíôì(€½¹ÍÐÁÕÐ€ô€¡­•ä°Ù…±Õ”°½¹‘¥Ñ¥½¸õÑÉÕ”¤€ôøì¥˜€¡½¹‘¥Ñ¥½¸¤‘…Ñ…m­•åt€ôÙ…±Õ”ìôì(€ÁÕÐ •Ù•¹Ñ}¥œ°±•…¹Ù•¹Ñ%¡ˆ¹•Ù•¹Ñ%¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹•Ù•¹Ñ%€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ¹…µ”œ°MÑÉ¥¹œ¡ˆ¹¹…µ•ñðœœ¤¹ÑÉ¥´ ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹¹…µ”€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ É•¥½¸œ°MÑÉ¥¹œ¡ˆ¹É•¥½¹ñðœœ¤¹ÑÉ¥´ ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹É•¥½¸€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ‘…Ñ•Í}©Í½¸œ°)M=8¹ÍÑÉ¥¹¥™ä¡}Í•ÍÍ¥½¹…Ñ•I½ÝÌ¡ˆ¹‘…Ñ•Ì¤¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹‘…Ñ•Ì€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ Ù•¹Õ”œ°MÑÉ¥¹œ¡ˆ¹Ù•¹Õ•ñðœœ¤¹ÑÉ¥´ ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹Ù•¹Õ”€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ™•”œ°9Õµ‰•È¡ˆ¹™•”¥ñðÀ°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹™•”€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ‘•Á½Í¥Ðœ°9Õµ‰•È¡ˆ¹‘•Á½Í¥Ð¥ñðÀ°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹‘•Á½Í¥Ð€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ±¥µ¥Ñ}½Õ¹Ðœ°9Õµ‰•È¡ˆ¹±¥µ¥Ð¥ñðÀ°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹±¥µ¥Ð€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ µ…á}ÍÑ…±±Ìœ°9Õµ‰•È¡ˆ¹µ…áMÑ…±±Ì¥ñðÀ°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹µ…áMÑ…±±Ì€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ÍÑ…ÑÕÌœ°MÑÉ¥¹œ¡ˆ¹ÍÑ…ÑÕÍñðŸ¦^s¦Z$œ¤¹ÑÉ¥´ ¤ñð€Ÿ¦^s¦Z$œ°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹ÍÑ…ÑÕÌ€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ¹••‘}É•Ù¥•Üœ°ˆ¹¹••‘I•Ù¥•Ü€ôôôÑÉÕ”ñðˆ¹¹••‘I•Ù¥•Ü€ôôô€ÑÉÕ”œ°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹¹••‘I•Ù¥•Ü€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ µ½‘Õ±•Í}©Í½¸œ°)M=8¹ÍÑÉ¥¹¥™ä¡}Í•ÍÍ¥½¹=‰©•Ð¡ˆ¹µ½‘Õ±•Ì°íô¤¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹µ½‘Õ±•Ì€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ •ÅÕ¥Á}©Í½¸œ°)M=8¹ÍÑÉ¥¹¥™ä¡}Í•ÍÍ¥½¹=‰©•Ð¡ˆ¹•ÅÕ¥À°íô¤¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹•ÅÕ¥À€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ‰…Í¥}•ÅÕ¥Àœ°MÑÉ¥¹œ¡ˆ¹‰…Í¥ÅÕ¥Áñðœœ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹‰…Í¥ÅÕ¥À€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ÕÍÑ½µ}™¥•±‘Í}©Í½¸œ°)M=8¹ÍÑÉ¥¹¥™ä¡}Í•ÍÍ¥½¹ÉÉ…ä¡ˆ¹ÕÍÑ½µ¥•±‘Ì¤¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹ÕÍÑ½µ¥•±‘Ì€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ …‘‘½¹Í}©Í½¸œ°)M=8¹ÍÑÉ¥¹¥™ä¡}Í•ÍÍ¥½¹ÉÉ…ä¡ˆ¹…‘‘½¹Ì¤¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹…‘‘½¹Ì€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ¥¹Ù½¥•}Ñ…á}©Í½¸œ°)M=8¹ÍÑÉ¥¹¥™ä¡}Í•ÍÍ¥½¹=‰©•Ð¡ˆ¹¥¹Ù½¥•Q…à°íÍÑ…±°éÑÉÕ”±•ÅÕ¥Àé™…±Í”±•áÑÉ„é™…±Í•ô¤¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹¥¹Ù½¥•Q…à€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ É•™Õ¹‘}ÉÕ±•Í}©Í½¸œ°ˆ¹É•™Õ¹‘IÕ±•Ì€ôô¹Õ±°ñðˆ¹É•™Õ¹‘IÕ±•Ì€ôôô€œœ€ü¹Õ±°€è)M=8¹ÍÑÉ¥¹¥™ä¡}Í•ÍÍ¥½¹=‰©•Ð¡ˆ¹É•™Õ¹‘IÕ±•Ì°íô¤¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹É•™Õ¹‘IÕ±•Ì€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ Ñ¡•µ”œ°MÑÉ¥¹œ¡ˆ¹Ñ¡•µ•ñðœœ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹Ñ¡•µ”€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ½É…¹¥é•Èœ°MÑÉ¥¹œ¡ˆ¹½É…¹¥é•Éñðœœ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹½É…¹¥é•È€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ½}½É…¹¥é•Èœ°MÑÉ¥¹œ¡ˆ¹½½Éññˆ¹½=É…¹¥é•Éñðœœ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹½½Éœ€„ôôÕ¹‘•™¥¹•ñðˆ¹½=É…¹¥é•È€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ½Ù•É}ÕÉ°œ°MÑÉ¥¹œ¡ˆ¹½Ù•Éñðœœ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹½Ù•È€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ ‘•ÍÉ¥ÁÑ¥½¸œ°MÑÉ¥¹œ¡ˆ¹‘•Íñðœœ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹‘•ÍŒ€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ …ÍÍ¥¹•‘}ÍÑ…™˜œ°}Í•ÍÍ¥½¹Q•áÑ1¥ÍÐ¡ˆ¹…ÍÍ¥¹•‘MÑ…™˜¤¹©½¥¸ œ°œ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹…ÍÍ¥¹•‘MÑ…™˜€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ …É••µ•¹Ñ}É•ÅÕ¥É•œ°…É••µ•¹ÑI•ÅÕ¥É•‘=¸¡ˆ¹…É••µ•¹ÑI•ÅÕ¥É•¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹…É••µ•¹ÑI•ÅÕ¥É•€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ …É••µ•¹Ñ}Ñ¥Ñ±”œ°MÑÉ¥¹œ¡ˆ¹…É••µ•¹ÑQ¥Ñ±•ñðŸ–‚Ç–B7–B#žÒ¾ò?šÒï–.WžÒÃ–&¢"šR“–V¢š?ž¾œ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹…É••µ•¹ÑQ¥Ñ±”€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ …É••µ•¹Ñ}½¹Ñ•¹Ðœ°MÑÉ¥¹œ¡ˆ¹…É••µ•¹Ñ½¹Ñ•¹Ññðœœ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹…É••µ•¹Ñ½¹Ñ•¹Ð€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ …É••µ•¹Ñ}Ù•ÉÍ¥½¸œ°MÑÉ¥¹œ¡ˆ¹…É••µ•¹ÑY•ÉÍ¥½¹ñðœœ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹…É••µ•¹ÑY•ÉÍ¥½¸€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ …É••µ•¹Ñ}ÕÁ‘…Ñ•‘}…Ðœ°¹½Ý%Í¼ ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹…É••µ•¹ÑI•ÅÕ¥É•€„ôôÕ¹‘•™¥¹•ñðˆ¹…É••µ•¹ÑQ¥Ñ±”€„ôôÕ¹‘•™¥¹•ñðˆ¹…É••µ•¹Ñ½¹Ñ•¹Ð€„ôôÕ¹‘•™¥¹•ñðˆ¹…É••µ•¹ÑY•ÉÍ¥½¸€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ Í•…Ñ}ÁÉ¥¥¹}•¹…‰±•œ°ˆ¹Í•…ÑAÉ¥¥¹¹…‰±•€ôôôÑÉÕ”ñðˆ¹Í•…ÑAÉ¥¥¹¹…‰±•€ôôô€ÑÉÕ”œ°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹Í•…ÑAÉ¥¥¹¹…‰±•€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ Í•…Ñ}¡½±‘}¡½ÕÉÌœ°5…Ñ ¹µ…à Ä°9Õµ‰•È¡ˆ¹Í•…Ñ!½±‘!½ÕÉÌ¥ñðÈÐ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹Í•…Ñ!½±‘!½ÕÉÌ€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ Í•…Ñ}µ…Á}ÕÉ°œ°MÑÉ¥¹œ¡ˆ¹Í•…Ñ5…ÁUÉ±ñðœœ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹Í•…Ñ5…ÁUÉ°€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ Í•…Ñ}…ÍÍ¥¹}‘…åÍ}‰•™½É”œ°5…Ñ ¹µ…à Ì°9Õµ‰•È¡ˆ¹Í•…ÑÍÍ¥¹…åÍ	•™½É”¥ñðÜ¤°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹Í•…ÑÍÍ¥¹…åÍ	•™½É”€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ Ù•¹Õ•}µ…Á}Ñ•µÁ±…Ñ•}¥œ°ˆ¹Ù•¹Õ•5…ÁQ•µÁ±…Ñ•%€üMÑÉ¥¹œ¡ˆ¹Ù•¹Õ•5…ÁQ•µÁ±…Ñ•%¤€è¹Õ±°°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹Ù•¹Õ•5…ÁQ•µÁ±…Ñ•%€„ôôÕ¹‘•™¥¹•¤ì(€ÁÕÐ Á…åµ•¹Ñ}ÁÉ½™¥±•}¥œ°ˆ¹Á…åµ•¹ÑAÉ½™¥±•%€üMÑÉ¥¹œ¡ˆ¹Á…åµ•¹ÑAÉ½™¥±•%¤€è¹Õ±°°¥¹±Õ‘••™…Õ±ÑÌñðˆ¹Á…åµ•¹ÑAÉ½™¥±•%€„ôôÕ¹‘•™¥¹•¤ì(€É•ÑÕÉ¸‘…Ñ„ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡É•…Ñ•M•ÍÍ¥½¸¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ôˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ±½¬€ô…Ý…¥Ð¡•­Q•¹…¹Ñ1½­•¡•¹Ø°Q99P¤ì(€¥˜€¡±½¬¹±½­•¤É•ÑÕÉ¸©Í½¹ÉÈ¡±½¬¹É•…Í½¸ñð€Ÿš¶“’âï¢ú›ž¦ë¦ZOžn»–&7ž
ë–R¿¢º¦:[–ºhœ¤ì(€½¹ÍÐ•ÉÈ€ô}Ù…±¥‘…Ñ•M•ÍÍ¥½¹%¹ÁÕÐ¡ˆ¤ì(€¥˜€¡•ÉÈ¤É•ÑÕÉ¸©Í½¹ÉÈ¡•ÉÈ¤ì(€½¹ÍÐ±¥µ¥ÑÉÈ€ô…Ý…¥Ð¡•­QÉ¥…±M•ÍÍ¥½¹1¥µ¥Ð¡•¹Ø°Q99P¤ì(€¥˜€¡±¥µ¥ÑÉÈ¤É•ÑÕÉ¸©Í½¹ÉÈ¡±¥µ¥ÑÉÈ¤ì(€½¹ÍÐ‰±½­•õ…Ý…¥ÐÉ•ÅÕ•ÍÑ•‘U¹…ÁÁÉ½Ù•‘5½‘Õ±•Ì¡•¹Ø±Q99P±ˆ¹µ½‘Õ±•Íññíô¤í¥˜¡‰±½­•¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ’î—’â/–*¢÷–Âkšr«žRÇ–æÏ–>Ãš‚ã–¾òhœ­‰±½­•¹©½¥¸ ŸŽœ¤¤ì(€ˆ¹µ½‘Õ±•Ìõ…Ý…¥ÐÑ•¹…¹Ñ±±½Ý•‘M•ÍÍ¥½¹5½‘Õ±•Ì¡•¹Ø±Q99P±ˆ¹µ½‘Õ±•Íññíô¤ì((€½¹ÍÐ¥€ô•¹% MLœ¤ì(€½¹ÍÐ‘…Ñ„€ôì(€€€¥°(€€€Ñ•¹…¹Ñ}¥èQ99P°(€€€ÕÉÉ•¹Ñ}½Õ¹Ðè€À°(€€€™½É•}…¹•°è™…±Í”°(€€€™½É•}…¹•±±•è™…±Í”°(€€€É•…Ñ•‘}…Ðè¹½Ý%Í¼ ¤°(€€€ÕÁ‘…Ñ•‘}…Ðè¹½Ý%Í¼ ¤°(€€€€¸¸¹}Í•ÍÍ¥½¹	…Í•A…å±½…¡ˆ°ÑÉÕ”¤°(€ôì(€½¹ÍÐ½Á•¹ÉÈõ…Ý…¥Ð}Ù…±¥‘…Ñ•M•ÍÍ¥½¹•Á•¹‘•¹¥•Í½É=Á•¸¡•¹Ø±Q99P±‘…Ñ„¤í¥˜¡½Á•¹ÉÈ¥É•ÑÕÉ¸©Í½¹ÉÈ¡½Á•¹ÉÈ¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°‘…Ñ„¤ì(€…Ý…¥ÐÍå¹9½Éµ…±¥é•‘M•ÍÍ¥½¹…Ñ…±½Ì¡•¹Ø±Q99P±‘…Ñ„¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥±Í•ÍÍ¥½¸é™½Éµ…ÑM•ÍÍ¥½¸¡ì¸¸¹‘…Ñ…ô¥ô¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡UÁ‘…Ñ•M•ÍÍ¥½¸¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ôˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ±MÑÉ¥¹œ¡ˆ¹¥‘ñðœœ¤¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ±½¬€ô…Ý…¥Ð¡•­Q•¹…¹Ñ1½­•¡•¹Ø°Q99P¤ì(€¥˜€¡±½¬¹±½­•¤É•ÑÕÉ¸©Í½¹ÉÈ¡±½¬¹É•…Í½¸ñð€Ÿš¶“’âï¢ú›ž¦ë¦ZOžn»–&7ž
ë–R¿¢º¦:[–ºhœ¤ì(€¥˜€ …ˆ¹¥¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂG–‚Óš²„¥œ¤ì(€½¹ÍÐÕÉÉ•¹ÑI½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Q99P¥ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥ô™Í•±•Ðô©€¤ì(€¥˜€ …ÕÉÉ•¹ÑI½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Óš²„œ¤ì(€½¹ÍÐÕÉÉ•¹ÐõÕÉÉ•¹ÑI½ÝÍlÁtì(€¥˜¡ˆ¹µ½‘Õ±•Ì„ôõÕ¹‘•™¥¹•¥í½¹ÍÐ‰±½­•õ…Ý…¥ÐÉ•ÅÕ•ÍÑ•‘U¹…ÁÁÉ½Ù•‘5½‘Õ±•Ì¡•¹Ø±Q99P±ˆ¹µ½‘Õ±•Íññíô¤í¥˜¡‰±½­•¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ’î—’â/–*¢÷–Âkšr«žRÇ–æÏ–>Ãš‚ã–¾òhœ­‰±½­•¹©½¥¸ ŸŽœ¤¤íˆ¹µ½‘Õ±•Ìõ…Ý…¥ÐÑ•¹…¹Ñ±±½Ý•‘M•ÍÍ¥½¹5½‘Õ±•Ì¡•¹Ø±Q99P±ˆ¹µ½‘Õ±•Íññíô¤íô(€½¹ÍÐÁ…Ñ €ôì¸¸¹}Í•ÍÍ¥½¹	…Í•A…å±½…¡ˆ°™…±Í”¤°ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ôì(€½¹ÍÐÍ¥µÕ±…Ñ•õì¸¸¹ÕÉÉ•¹Ð°¸¸¹Á…Ñ¡ôì(€½¹ÍÐ‰…Í¥ÉÈõ}Ù…±¥‘…Ñ•M•ÍÍ¥½¹%¹ÁÕÐ¡í¹…µ”éÍ¥µÕ±…Ñ•¹¹…µ”±‘…Ñ•ÌéÍ…™•)Í½¸¡Í¥µÕ±…Ñ•¹‘…Ñ•Í}©Í½¸±mt¤±ÍÑ…ÑÕÌéÍ¥µÕ±…Ñ•¹ÍÑ…ÑÕÍô¤ì(€¥˜¡‰…Í¥ÉÈ¥É•ÑÕÉ¸©Í½¹ÉÈ¡‰…Í¥ÉÈ¤ì(€½¹ÍÐ½Á•¹ÉÈõ…Ý…¥Ð}Ù…±¥‘…Ñ•M•ÍÍ¥½¹•Á•¹‘•¹¥•Í½É=Á•¸¡•¹Ø±Q99P±Í¥µÕ±…Ñ•¤í¥˜¡½Á•¹ÉÈ¥É•ÑÕÉ¸©Í½¹ÉÈ¡½Á•¹ÉÈ¤ì(€¥˜¡Í¥µÕ±…Ñ•¹ÍÑ…ÑÕÌôôôŸ–‚Ç–B7’â´ññÍ¥µÕ±…Ñ•¹ÍÑ…ÑÕÌôôôŸ¦Z/šRøœ¥í½¹ÍÐ•¹Ðõ…Ý…¥Ð•¹ÍÕÉ•=Á•É…Ñ¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±Q99P±Í¥µÕ±…Ñ•¤í¥˜ …•¹Ð¹½¬¥É•ÑÕÉ¸©Í½¹ÉÈ¡ƒ–Âkšr«–>[–ú_š¶–ò?ž¦/š²+¾òkšr³š²‡¦r 9P‘í•¹Ð¹…µ½Õ¹Ñ÷¾ò3–>¿žR£–B#’ös¦†7–ê˜9P‘í•¹Ð¹‰…±…¹•ñðÁõ€¥ô(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Q99P¥õ€°Á…Ñ ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Q99P¥ô™Í•±•Ðô©€¤ì(€¥˜¡É½ÝÍlÁt¥…Ý…¥ÐÍå¹9½Éµ…±¥é•‘M•ÍÍ¥½¹…Ñ…±½Ì¡•¹Ø±Q99P±É½ÝÍlÁt¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥éˆ¹¥±Í•ÍÍ¥½¸éÉ½ÝÍlÁtý™½Éµ…ÑM•ÍÍ¥½¸¡É½ÝÍlÁt¤é¹Õ±±ô¤ì)ô((¼¼‘•±•Ñ•M•ÍÍ¥½¸)…Íå¹Œ™Õ¹Ñ¥½¸¡•±•Ñ•M•ÍÍ¥½¸¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ˜™ˆ¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–>«šr'’âï¢ú›šNšr'¢–>¿’î—–"«¦f“ž¦ëžf÷–‚Óš²„œ¤ì(€½¹ÍÐÍ¥õˆ¹¥‘ññˆ¹Í•ÍÍ¥½¹%ì(€½¹ÍÐmÉ•Ì±Á…åÌ±¥Ñ•µÍtõ…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í¥¥ô™Í•±•Ðõ¥™±¥µ¥ÐôÅ€¤¹…Ñ   ¤ôùmt¤°(€€€‘‰•Ð¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í¥¥ô™Í•±•Ðõ¥™±¥µ¥ÐôÅ€¤¹…Ñ   ¤ôùmt¤°(€€€‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í¥¥ô™Í•±•Ðõ¥™±¥µ¥ÐôÅ€¤¹…Ñ   ¤ôùmt¤(€t¤ì(€¥˜¡É•Ì¹±•¹Ñ¡ññÁ…åÌ¹±•¹Ñ¡ññ¥Ñ•µÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Óš²‡–ÞËšr'–‚Ç–B7š"[¦GšÖžÒ¦2¾ò3ž
ë’þwžVg¢Ê‡–.g¢"š¶ß–>Ë¢ÎšZg’â7–>¿–"«¦f“¾ò3¢®/šRçžR£Ž3–Â–¶cŽ7Žœ¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€¤íÉ•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô(¼¼Ñ½±•M•ÍÍ¥½¸)…Íå¹Œ™Õ¹Ñ¥½¸¡Q½±•M•ÍÍ¥½¸¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ¥€ôˆ¹¥‘ññˆ¹Í•ÍÍ¥½¹%ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Óš²„œ¤ì(€½¹ÍÐ¹•áÐ€ôÉ½ÝÍlÁt¹ÍÑ…ÑÕÌôôôŸ¦^s¦Z$œüŸ–‚Ç–B7’â´œèŸ¦^s¦Z$œì(€½¹ÍÐ•ÉÈõ…Ý…¥Ð}Ù…±¥‘…Ñ•M•ÍÍ¥½¹•Á•¹‘•¹¥•Í½É=Á•¸¡•¹Ø±Q99P±ì¸¸¹É½ÝÍlÁt±ÍÑ…ÑÕÌé¹•áÑô¤í¥˜¡•ÉÈ¥É•ÑÕÉ¸©Í½¹ÉÈ¡•ÉÈ¤ì(€¥˜¡¹•áÐôôôŸ–‚Ç–B7’â´ññ¹•áÐôôôŸ¦Z/šRøœ¥í½¹ÍÐ•¹Ðõ…Ý…¥Ð•¹ÍÕÉ•=Á•É…Ñ¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±Q99P±É½ÝÍlÁt¤í¥˜ …•¹Ð¹½¬¥É•ÑÕÉ¸©Í½¹ÉÈ¡ƒ–Âkšr«–>[–ú_š¶–ò?ž¦/š²+¾òkšr³š²‡¦r 9P‘í•¹Ð¹…µ½Õ¹Ñ÷¾ò3–>¿žR£–B#’ös¦†7–ê˜9P‘í•¹Ð¹‰…±…¹•ñðÁõ€¥ô(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±íÍÑ…ÑÕÌé¹•áÑô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°ÍÑ…ÑÕÌé¹•áÑô¤ì)ô(¼¼Ñ½±•M•ÍÍ¥½¹MÑ…ÑÕÏ¾ò#žnÓš:—¢¢·–ºkš2–ºhÍÑ…ÑÕÏ¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡Q½±•M•ÍÍ¥½¹MÑ…ÑÕÌ¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÑ…É•ÑMÑ…ÑÕÌõˆ¹ÍÑ…ÑÕÍñðŸ–ÞËš"«š¶ˆœì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥ô™Í•±•Ðô©€¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Óš²„œ¤ì(€½¹ÍÐ•ÉÈõ…Ý…¥Ð}Ù…±¥‘…Ñ•M•ÍÍ¥½¹•Á•¹‘•¹¥•Í½É=Á•¸¡•¹Ø±Q99P±ì¸¸¹É½ÝÍlÁt±ÍÑ…ÑÕÌéÑ…É•ÑMÑ…ÑÕÍô¤í¥˜¡•ÉÈ¥É•ÑÕÉ¸©Í½¹ÉÈ¡•ÉÈ¤ì(€¥˜¡Ñ…É•ÑMÑ…ÑÕÌôôôŸ–‚Ç–B7’â´ññÑ…É•ÑMÑ…ÑÕÌôôôŸ¦Z/šRøœ¥í½¹ÍÐ•¹Ðõ…Ý…¥Ð•¹ÍÕÉ•=Á•É…Ñ¥¹¹Ñ¥Ñ±•µ•¹Ð¡•¹Ø±Q99P±É½ÝÍlÁt¤í¥˜ …•¹Ð¹½¬¥É•ÑÕÉ¸©Í½¹ÉÈ¡ƒ–Âkšr«–>[–ú_š¶–ò?ž¦/š²+¾òkšr³š²‡¦r 9P‘í•¹Ð¹…µ½Õ¹Ñ÷¾ò3–>¿žR£–B#’ös¦†7–ê˜9P‘í•¹Ð¹‰…±…¹•ñðÁõ€¥ô(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±íÍÑ…ÑÕÌéÑ…É•ÑMÑ…ÑÕÍô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±ÍÑ…ÑÕÌéÑ…É•ÑMÑ…ÑÕÍô¤ì)ô(¼¼½ÁåM•ÍÍ¥½¸)…Íå¹Œ™Õ¹Ñ¥½¸¡½ÁåM•ÍÍ¥½¸¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ±¥µ¥ÑÉÈ€ô…Ý…¥Ð¡•­QÉ¥…±M•ÍÍ¥½¹1¥µ¥Ð¡•¹Ø°Q99P¤ì(€¥˜€¡±¥µ¥ÑÉÈ¤É•ÑÕÉ¸©Í½¹ÉÈ¡±¥µ¥ÑÉÈ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Óš²„œ¤ì(€½¹ÍÐÍÉŒ€ôì¸¸¹É½ÝÍlÁuôì(€½¹ÍÐ¹•Ý%€ô•¹% MLœ¤ì(€ÍÉŒ¹¥õ¹•Ý%ìÍÉŒ¹¹…µ”ô¡ÍÉŒ¹¹…µ•ñðœœ¤¬Ÿ¾ò#¢’¢Ž÷¾ò$œì(€ÍÉŒ¹ÕÉÉ•¹Ñ}½Õ¹ÐôÀìÍÉŒ¹ÍÑ…ÑÕÌôŸ¦^s¦Z$œì(€ÍÉŒ¹™½É•}…¹•°õ™…±Í”ìÍÉŒ¹™½É•}…¹•±}Ñ…É•Ñ}¥õ¹Õ±°ìÍÉŒ¹™½É•}…¹•±}‘•…‘±¥¹”õ¹Õ±°ì(€ÍÉŒ¹É•…Ñ•‘}…Ðõ¹½Ý%Í¼ ¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Í•ÍÍ¥½¹Ìœ±ÍÉŒ¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥é¹•Ý%‘ô¤ì)ô((()™Õ¹Ñ¥½¸Á…åµ•¹ÑQ•ÉµÍ½ÉM•ÍÍ¥½¸¡Í•ÍÍ¥½¹I½Ü¥ì(€½¹ÍÐµ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Í•ÍÍ¥½¹I½Ü˜™Í•ÍÍ¥½¹I½Ü¹µ½‘Õ±•Í}©Í½¸±íô¤¤ì(€½¹ÍÐÀô¡µ½‘Ì¹Á…åµ•¹ÑQ•ÉµÌ˜™ÑåÁ•½˜µ½‘Ì¹Á…åµ•¹ÑQ•ÉµÌôôô½‰©•Ðœ¤ýµ½‘Ì¹Á…åµ•¹ÑQ•ÉµÌéíôì(€½¹ÍÐ‘•…‘±¥¹•!½ÕÉÌõ5…Ñ ¹µ…à Ä±5…Ñ ¹µ¥¸ ÜÈÀ±Á…ÉÍ•%¹Ð¡À¹‘•…‘±¥¹•!½ÕÉÌ°ÄÀ¥ññAe}1%9}!=UIL¤¤ì(€½¹ÍÐÉ•µ¥¹‘•É!½ÕÉÌõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡‘•…‘±¥¹•!½ÕÉÌ±Á…ÉÍ•%¹Ð¡À¹É•µ¥¹‘•É!½ÕÉÌ°ÄÀ¥ññI5%9I}!=UIL¤¤ì(€É•ÑÕÉ¸í‘•…‘±¥¹•!½ÕÉÌ±É•µ¥¹‘•É!½ÕÉÍôì)ô)™Õ¹Ñ¥½¸Á…åµ•¹Ñ•…‘±¥¹•A…å±½…¡Í•ÍÍ¥½¹I½Ü±…ÁÁÉ½Ù•‘Ñ%Í¼±Ñ½Ñ…°¥ì(€¥˜ „¡Í…™•9Õ´¡Ñ½Ñ…°¤øÀ¤¤É•ÑÕÉ¸í…ÁÁÉ½Ù•‘}…Ðé…ÁÁÉ½Ù•‘Ñ%Í¼±Á…åµ•¹Ñ}‘Õ•}…Ðé¹Õ±°±Á…åµ•¹Ñ}É•µ¥¹‘•É}…Ðé¹Õ±°±Á…åµ•¹Ñ}Ñ•ÉµÍ}Í¹…ÁÍ¡½Ðéíõôì(€½¹ÍÐÐõÁ…åµ•¹ÑQ•ÉµÍ½ÉM•ÍÍ¥½¸¡Í•ÍÍ¥½¹I½Ü¤±‰…Í”õ¹•Ü…Ñ”¡…ÁÁÉ½Ù•‘Ñ%Í¼¤ì(€É•ÑÕÉ¸í…ÁÁÉ½Ù•‘}…Ðé…ÁÁÉ½Ù•‘Ñ%Í¼°(€€€Á…åµ•¹Ñ}‘Õ•}…Ðé¹•Ü…Ñ”¡‰…Í”¹•ÑQ¥µ” ¤­Ð¹‘•…‘±¥¹•!½ÕÉÌ¨ÌØÀÀÀÀÀ¤¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€Á…åµ•¹Ñ}É•µ¥¹‘•É}…Ðé¹•Ü…Ñ”¡‰…Í”¹•ÑQ¥µ” ¤­Ð¹É•µ¥¹‘•É!½ÕÉÌ¨ÌØÀÀÀÀÀ¤¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€Á…åµ•¹Ñ}Ñ•ÉµÍ}Í¹…ÁÍ¡½ÐéÑôì)ô)™Õ¹Ñ¥½¸‘Õ•Ñ½ÉI•œ¡É•œ¥ì(€¥˜¡É•œ˜™É•œ¹Á…åµ•¹Ñ}‘Õ•}…Ð¥í½¹ÍÐõ¹•Ü…Ñ”¡É•œ¹Á…åµ•¹Ñ}‘Õ•}…Ð¤í¥˜ …¥Í9…8¡¤¥É•ÑÕÉ¸íô(€½¹ÍÐÌõÍ…™•)Í½¸¡É•œ˜™É•œ¹Á…åµ•¹Ñ}Ñ•ÉµÍ}Í¹…ÁÍ¡½Ð±íô¤± õ5…Ñ ¹µ…à Ä±Á…ÉÍ•%¹Ð¡Ì¹‘•…‘±¥¹•!½ÕÉÌ°ÄÀ¥ññAe}1%9}!=UIL¤ì(€½¹ÍÐˆõ¹•Ü…Ñ” ¡É•œ˜™É•œ¹…ÁÁÉ½Ù•‘}…Ð¥ñð¡É•œ˜™É•œ¹É•…Ñ•‘}…Ð¥ñðÀ¤íÉ•ÑÕÉ¸¥Í9…8¡ˆ¤ý¹Õ±°é¹•Ü…Ñ”¡ˆ¹•ÑQ¥µ” ¤­ ¨ÌØÀÀÀÀÀ¤ì)ô)™Õ¹Ñ¥½¸É•µ¥¹‘•ÉÑ½ÉI•œ¡É•œ¥ì(€¥˜¡É•œ˜™É•œ¹Á…åµ•¹Ñ}É•µ¥¹‘•É}…Ð¥í½¹ÍÐõ¹•Ü…Ñ”¡É•œ¹Á…åµ•¹Ñ}É•µ¥¹‘•É}…Ð¤í¥˜ …¥Í9…8¡¤¥É•ÑÕÉ¸íô(€½¹ÍÐÌõÍ…™•)Í½¸¡É•œ˜™É•œ¹Á…åµ•¹Ñ}Ñ•ÉµÍ}Í¹…ÁÍ¡½Ð±íô¤± õ5…Ñ ¹µ…à À±Á…ÉÍ•%¹Ð¡Ì¹É•µ¥¹‘•É!½ÕÉÌ°ÄÀ¥ññI5%9I}!=UIL¤ì(€½¹ÍÐˆõ¹•Ü…Ñ” ¡É•œ˜™É•œ¹…ÁÁÉ½Ù•‘}…Ð¥ñð¡É•œ˜™É•œ¹É•…Ñ•‘}…Ð¥ñðÀ¤íÉ•ÑÕÉ¸¥Í9…8¡ˆ¤ý¹Õ±°é¹•Ü…Ñ”¡ˆ¹•ÑQ¥µ” ¤­ ¨ÌØÀÀÀÀÀ¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸…ÁÁ±åI•Ù¥•ÝMÑ…ÑÕÍ¡…¹”¡•¹Ø°Q99P°É•œ°¹•áÑMÑ…ÑÕÌ°…‘µ¥¹9½Ñ”¤ì(€½¹ÍÐ‰•™½É•Ñ¥Ù”€ô¥ÍÑ¥Ù•½É…Á…¥Ñä¡É•œ¤ì(€½¹ÍÐÕÁ€ôíÉ•Ù¥•Ý}ÍÑ…ÑÕÌè¹•áÑMÑ…ÑÕÍôì(€¥˜€¡…‘µ¥¹9½Ñ”¤ÕÁ¹…‘µ¥¹}¹½Ñ”€ô…‘µ¥¹9½Ñ”ì(€¥˜€¡MÑÉ¥¹œ¡¹•áÑMÑ…ÑÕÍñðœœ¤€ôôô€Ÿ–ÞË¦2–>Xœ¤ì(€€€½¹ÍÐÍ•ÍÍ¥½¹I½Ü€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹I½Ü¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤¹…Ñ   ¤ôù¹Õ±°¤ì(€€€¥˜€¡Í•ÍÍ¥½¹I½Ü¤ì(€€€€€ÑÉåí½¹ÍÐÍ¹…Àõ…Ý…¥Ð•¹ÍÕÉ•A…åµ•¹ÑM¹…ÁÍ¡½Ñ½ÉI•œ¡•¹Ø±Q99P±É•œ±Í•ÍÍ¥½¹I½Ü±í™½É•]É¥Ñ”éÑÉÕ•ô¤í=‰©•Ð¹…ÍÍ¥¸¡ÕÁ±}Á…åµ•¹ÑM¹…ÁÍ¡½Ñ‰A…å±½…¡Í¹…À¤¤íô(€€€€€…Ñ ¡”¥í…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P°œœ°ÍåÍÑ•´œ°…ÁÁÉ½Ù…±}Á…åµ•¹Ñ}Í¹…ÁÍ¡½Ñ}‘•™•ÉÉ•œ°É•¥ÍÑÉ…Ñ¥½¹Ìœ±É•œ¹¥±¹Õ±°±íµ•ÍÍ…”é”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”éMÑÉ¥¹œ¡”¥ô±íô¤íô(€€€€€½¹ÍÐ…ÁÁÉ½Ù•‘Ðõ¹½Ý%Í¼ ¤ì(€€€€€=‰©•Ð¹…ÍÍ¥¸¡ÕÁ±Á…åµ•¹Ñ•…‘±¥¹•A…å±½…¡Í•ÍÍ¥½¹I½Ü±…ÁÁÉ½Ù•‘Ð±}½™™¥¥…±µ½Õ¹Ð¡É•œ¤¤¤ì(€€€ô(€ô(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±ÕÁ¤ì(€½¹ÍÐ¹•áÑI•œ€ôì¸¸¹É•œ°É•Ù¥•Ý}ÍÑ…ÑÕÌè¹•áÑMÑ…ÑÕÍôì(€½¹ÍÐ…™Ñ•ÉÑ¥Ù”€ô¥ÍÑ¥Ù•½É…Á…¥Ñä¡¹•áÑI•œ¤ì(€¥˜€¡‰•™½É•Ñ¥Ù”€„ôô…™Ñ•ÉÑ¥Ù”¤ì(€€€…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø°Q99P°É•œ°…™Ñ•ÉÑ¥Ù”€ü€¡Í…™•9Õ´¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤€è€´¡Í…™•9Õ´¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤¤ì(€€€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø°Q99P°€œœ°€ÍåÍÑ•´œ°€É•Ù¥•Ý}ÍÑ…ÑÕÍ}…Á…¥Ñå}…‘©ÕÍÐœ°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°É•œ¹¥°íÉ•Ù¥•Ý}ÍÑ…ÑÕÌéÉ•œ¹É•Ù¥•Ý}ÍÑ…ÑÕÍô°íÉ•Ù¥•Ý}ÍÑ…ÑÕÌé¹•áÑMÑ…ÑÕÍô°í…Á…¥Ñå}‘•±Ñ„é…™Ñ•ÉÑ¥Ù”€ü€¡Í…™•9Õ´¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤€è€´¡Í…™•9Õ´¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¥ô¤ì(€ô)ô((¼¼ÕÁ‘…Ñ•I•MÑ…ÑÕÏ¾ò#–Z»ž¶¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡UÁ‘…Ñ•I•MÑ…ÑÕÌ¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°É•Ù¥•Üœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€ÑÉäì(€€€…Ý…¥Ð…ÁÁ±åI•Ù¥•ÝMÑ…ÑÕÍ¡…¹”¡•¹Ø°Q99P°É•œ°ˆ¹ÍÑ…ÑÕÌ°ˆ¹…‘µ¥¹9½Ñ”¤ì(€ô…Ñ ¡”¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ¡”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€è€Ÿ–¾§š‚ã–’ÇšV\œ¤ì(€ô(€…Ý…¥ÐÍ•¹‘MÑ…ÑÕÍµ…¥°¡•¹Ø°ˆ¹ÍÑ…ÑÕÌ°É•œ¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô((¼¼‰…Ñ¡UÁ‘…Ñ•MÑ…ÑÕÏ¾ò#š&çš²‡¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡	…Ñ¡UÁ‘…Ñ•MÑ…ÑÕÌ¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°É•Ù¥•Üœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ•ÍÕ±ÑÌõmtì(€™½È€¡½¹ÍÐÉ•%½˜€¡ˆ¹É•%‘Íññmt¤¤ì(€€€ÑÉäì(€€€€€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Í•±•Ðô©€¤ì(€€€€€¥˜€ …É½ÝÌ¹±•¹Ñ ¤ìÉ•ÍÕ±ÑÌ¹ÁÕÍ ¡í•ÉÉ½ÈèŸš&û’â7–"Ã–‚Ç–B4ô¤ì½¹Ñ¥¹Õ”ìô(€€€€€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€€€€€…Ý…¥Ð…ÁÁ±åI•Ù¥•ÝMÑ…ÑÕÍ¡…¹”¡•¹Ø°Q99P°É•œ°ˆ¹ÍÑ…ÑÕÌ°ˆ¹…‘µ¥¹9½Ñ”¤ì(€€€€€…Ý…¥ÐÍ•¹‘MÑ…ÑÕÍµ…¥°¡•¹Ø°ˆ¹ÍÑ…ÑÕÌ°É•œ¤ì(€€€€€É•ÍÕ±ÑÌ¹ÁÕÍ ¡íÍÕ•ÍÌéÑÉÕ•ô¤ì(€€€ô…Ñ ¡”¤ìÉ•ÍÕ±ÑÌ¹ÁÕÍ ¡í•ÉÉ½Èé”¹µ•ÍÍ…•ô¤ìô(€ô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°É•ÍÕ±ÑÍô¤ì)ô((¼¼ƒ–ÇžR£¾òk’úw–¾§š‚ãž.š/–¾’þ„)…Íå¹Œ™Õ¹Ñ¥½¸Í•¹‘MÑ…ÑÕÍµ…¥°¡•¹Ø°ÍÑ…ÑÕÌ°É•œ¤ì(€½¹ÍÐQ99P€ô€¡É•œ€˜˜É•œ¹Ñ•¹…¹Ñ}¥¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€ÑÉäì(€€€½¹ÍÐÍ•Í9…µ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€€€½¹ÍÐÍ•ÍQåÁ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€€€½¹ÍÐ‘¸€ô•Ñ¥ÍÁ±…å9…µ”¡É•œ¹¹…µ”°É•œ¹‰É…¹‘}¹…µ•ñðœœ°Í•ÍQåÁ”¤ì(€€€½¹ÍÐÑŒ€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€€€¥˜€¡ÍÑ…ÑÕÌôôôŸ–ÞË¦2–>Xœ¤ì(€€€€€½¹ÍÐÍÈ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹Í•ÍÍ¥½¹}¥¥ô™Í•±•Ðõ‰…Í¥}•ÅÕ¥Á€¤ì(€€€€€½¹ÍÐ‰”€ôÍÈ¹±•¹Ñ ýÍÉlÁt¹‰…Í¥}•ÅÕ¥Áñðœœèœœì(€€€€€…Ý…¥Ðµ…¥±ÁÁÉ½Ù…°¡•¹Ø±É•œ¹•µ…¥°±‘¸±Í•Í9…µ”±É•œ¹¥±9Õµ‰•È¡É•œ¹…µ½Õ¹Ð¥ñðÀ±É•œ¹ÍÑ…±±}½Õ¹Ð±Í…™•)Í½¸¡É•œ¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸±mt¤±É•œ¹•ÅÕ¥Áµ•¹Ñ}©Í½¸±‰”±ÑŒ¤ì(€€€ô(€€€¥˜€¡ÍÑ…ÑÕÌôôôŸ’â7¦2–>Xœ¤…Ý…¥Ðµ…¥±I•©•Ñ¥½¸¡•¹Ø±É•œ¹•µ…¥°±‘¸±Í•Í9…µ”±ÑŒ¤ì(€€€…Ý…¥ÐÉ•½É‘9½Ñ¥™¥…Ñ¥½¸¡•¹Ø±íÑ•¹…¹Ñ%éQ99P±Õ¹¥Ñ%éÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±Í•ÍÍ¥½¹%éÉ•œ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹%éÉ•œ¹¥±•µ…¥°éÉ•œ¹•µ…¥°±•Ù•¹Ñ-•äéÍÑ…ÑÕÌôôôŸ–ÞË¦2–>XœüÉ•¥ÍÑÉ…Ñ¥½¹}…ÁÁÉ½Ù•œèÉ•¥ÍÑÉ…Ñ¥½¹}É•©•Ñ•œ±Ñ¥Ñ±”éÍÑ…ÑÕÌôôôŸ–ÞË¦2–>XœüŸ–ÞË¦2–>XœèŸ–‚Ç–B7žÖCšzs¦kž~”œ±‰½‘äéÍÑ…ÑÕÌôôôŸ–ÞË¦2–>XœüŸš
£žj–‚Ç–B7¾ò?¦‚CžÒ–ÞË¦2–>[¾ò3¢®/’úw’îcš²ûšr¦fC–º3š"C–ú3žê3’ösš–·ŽœèŸšr³š²‡–‚Ç–B7šr«¦2–>[Žœ±µ•Ñ„éíÉ•Ù¥•ÝMÑ…ÑÕÌéÍÑ…ÑÕÍõô¤¹…Ñ   ¤ôùíô¤ì(€ô…Ñ ¡”¤ì(€€€€¼¼ƒ–:šr³ž
è…Ñ íôƒ–£¦£–B{š:'¾òk–¾’þ‡–’ÇšV_šfžV¯¦v‹’î7¦†¿ž’ëš"C–*¾ò3–º3–£š~—’â7–"Ã–:–nƒŽ(€€€½¹Í½±”¹•ÉÉ½È Í•¹‘MÑ…ÑÕÍµ…¥°•ÉÉ½Èèœ°ÍÑ…ÑÕÌ°É•œ€˜˜É•œ¹•µ…¥°°”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€èMÑÉ¥¹œ¡”¤¤ì±½ÉÉ½È¡•¹Ø°íÍ½ÕÉ”èÍ•¹‘MÑ…ÑÕÍµ…¥°œ°µ•ÍÍ…”èÍ•¹‘MÑ…ÑÕÍµ…¥°•ÉÉ½Èèœ°•ÉÉ½Èé”€˜˜”¹µ•ÍÍ…”€ü”¹µ•ÍÍ…”€èMÑÉ¥¹œ¡”¥ô¤ì(€ô)ô((¼¼…ÁÁÉ½Ù•I•Ÿ¾ò#¢"ÕÁ‘…Ñ•I•MÑ…ÑÕÌƒ–*¢÷žnã–B3¾ò3’þwžVgš:—–>žnã–ºçšŸ¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡ÁÁÉ½Ù•I•œ¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Pô¡ˆ˜™ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°É•Ù¥•Üœ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œõÉ½ÝÍlÁt±É½ÕÀõ…Ý…¥Ð•Ñ	Õ¹‘±•É½ÕÁI•Ì¡•¹Ø±Q99P±É•œ¤ì(€½¹ÍÐÍÑ…ÑÕÌõˆ¹ÍÑ…ÑÕÍñð¡ˆ¹…ÁÁÉ½Ù•üŸ–ÞË¦2–>XœèŸ’â7¦2–>Xœ¤ì(€™½È¡½¹ÍÐœ½˜É½ÕÀ¥ì(€€€ÑÉåí…Ý…¥Ð…ÁÁ±åI•Ù¥•ÝMÑ…ÑÕÍ¡…¹”¡•¹Ø±Q99P±œ±ÍÑ…ÑÕÌ±ˆ¹…‘µ¥¹9½Ñ”¥ô(€€€…Ñ ¡”¥íÉ•ÑÕÉ¸©Í½¹ÉÈ¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸ–¾§š‚ã–’ÇšV\œ¥ô(€ô(€™½È¡½¹ÍÐœ½˜É½ÕÀ¥ì(€€€…Ý…¥ÐÍ•¹‘MÑ…ÑÕÍµ…¥°¡•¹Ø±ÍÑ…ÑÕÌ±œ¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±Q99P±œ¹Í•ÍÍ¥½¹}¥¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±ÍÑ…ÑÕÌ±‰Õ¹‘±•½Õ¹ÐéÉ½ÕÀ¹±•¹Ñ¡ô¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸ÉÕ¹A…åµ•¹Ñ½¹™¥ÉµM¥‘•™™•ÑÌ¡•¹Ø±Q99P±É•%±…µ½Õ¹Ð¥ì(€½¹ÍÐÉÈõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Í•±•Ðô©€¤ì(€¥˜ …ÉÈ¹±•¹Ñ ¥É•ÑÕÉ¸ì(€½¹ÍÐÉ•œõÉÉlÁt±¹½ÜõÉ•œ¹Á…¥‘}…Ñññ¹½Ý%Í¼ ¤ì(€½¹ÍÐÁ…åM•ÍI½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹Í•ÍÍ¥½¹}¥¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€ÑÉåì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™ÍÑ…ÑÕÌõ•Ä»¦‚CžVe€±íÍÑ…ÑÕÌèŸ¦:[–ºhœ±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€€€¥˜¡MÑÉ¥¹œ¡É•œ¹Í•…Ñ}¡½¥•}¥¹Ñ•¹Ññð…ÕÑ¼œ¤ôôôÁ…¥œ¥ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥õ€±íÍ•…Ñ}¡½¥•}ÍÑ…ÑÕÌè±½­•œ±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€€€õ•±Í”¥˜ …É•œ¹ÍÑ…±±}¹Õµ‰•È¥ì(€€€€€½¹ÍÐÍ•ÌõÁ…åM•ÍI½ÝÍlÁtì(€€€€€¥˜¡Í•Ì˜™Í•ÍÍ¥½¹ÕÑ½ÍÍ¥¹]¥¹‘½Ü¡Í•Ì¤¹…Ñ¥Ù”¥ì(€€€€€€€…Ý…¥Ð…ÕÑ½ÍÍ¥¹M•…Ñ½ÉA…¥‘I•œ¡•¹Ø±Q99P±ì¸¸¹É•œ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌèŸ–ÞËžæÏ¢Êìœ±Á…¥‘}…Ðé¹½Ýô¤ì(€€€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹Í•ÍÍ¥½¹}¥¥õ€±íÍ•…Ñ}…ÍÍ¥¹}‘½¹•}…Ðé¹½Ý%Í¼ ¥ô¤¹…Ñ   ¤ôùíô¤ì(€€€€€ô(€€€ô(€õ…Ñ ¡”¥í±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”èÉÕ¹A…åµ•¹Ñ½¹™¥ÉµM¥‘•™™•ÑÌœ±µ•ÍÍ…”èÍ•…Ð±½¬½…ÕÑ¼…ÍÍ¥¸™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤íô(€ÑÉåì(€€€½¹ÍÐÍ•Í9…µ”õ…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø±É•œ¹Í•ÍÍ¥½¹}¥±Q99P¤±Í•ÍQåÁ”õ…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø±É•œ¹Í•ÍÍ¥½¹}¥±Q99P¤±‘¸õ•Ñ¥ÍÁ±…å9…µ”¡É•œ¹¹…µ”±É•œ¹‰É…¹‘}¹…µ•ñðœœ±Í•ÍQåÁ”¤±ÑŒõ…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø±Q99P¤ì(€€€±•Ð•ÅÕ¥ÁMÑÈôœœíÑÉåí½¹ÍÐ•ÄõÍ…™•)Í½¸¡É•œ¹•ÅÕ¥Áµ•¹Ñ}©Í½¸±íô¤í•ÅÕ¥ÁMÑÈõ=‰©•Ð¹•¹ÑÉ¥•Ì¡•Ä¤¹™¥±Ñ•È ¡m¬±Ùt¤ôùØøÀ¤¹µ…À ¡m¬±Ùt¤ôù¬¬àœ­Ø¤¹©½¥¸ ŸŽœ¤íõ…Ñ ¡}”¥íô(€€€…Ý…¥Ðµ…¥±A…åµ•¹Ñ½¹™¥É´¡•¹Ø±É•œ¹•µ…¥°±‘¸±Í•Í9…µ”±…µ½Õ¹Ð±•ÅÕ¥ÁMÑÈ±É•œ¹ÍÑ…±±}¹Õµ‰•Éñðœœ±ÑŒ¤ì(€õ…Ñ ¡”¥í±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”èÉÕ¹A…åµ•¹Ñ½¹™¥ÉµM¥‘•™™•ÑÌœ±µ•ÍÍ…”èÁ…åµ•¹Ð½¹™¥É´µ…¥°™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤íô(€…Ý…¥ÐÉ•½É‘9½Ñ¥™¥…Ñ¥½¸¡•¹Ø±íÑ•¹…¹Ñ%éQ99P±Õ¹¥Ñ%éÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±Í•ÍÍ¥½¹%éÉ•œ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹%éÉ•œ¹¥±•µ…¥°éÉ•œ¹•µ…¥°±•Ù•¹Ñ-•äèÁ…åµ•¹Ñ}½¹™¥Éµ•œ±Ñ¥Ñ±”èŸ’îcš²û–ÞËžŠë¢ª4œ±‰½‘äèŸš
£žj’îcš²û–ÞË–º3š"CžŠë¢ª7Žœ±µ•Ñ„éí…µ½Õ¹ÐéÍ…™•9Õ´¡…µ½Õ¹Ð¤±Á…åµ•¹ÑMÑ…ÑÕÌéÉ•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍõô¤¹…Ñ   ¤ôùíô¤ì(€…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±Q99P±É•œ¹Í•ÍÍ¥½¹}¥¤ì)ô((¼¼½¹™¥ÉµA…åµ•¹Ó¾ò#–ú3–>Ãš&/–.WžŠë¢ª7¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡½¹™¥ÉµA…åµ•¹Ð¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸°Q99P°€™¥¹…¹”œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€€¼¼ƒ–B#’ö×žÖC–âÏ¾òk–#–º3šVÓ–þ¯žŸ¾ò3–7¦Cž¶–~ß¢†3Ž;’â7–k–’[¦£–&¿’ösžR£Ž?žj¦GšÖš‚ã–þ¾òo’îï’â–’ÇšV_–ÂÇšVÓžÖ¢Žs––n{–ú§Ž(€¥˜€ …ˆ¹}É½ÕÁ½¹”¤ì(€€€½¹ÍÐ¥õMÑÉ¥¹œ¡É•œ¹Á…åµ•¹Ñ}É½ÕÁ}¥‘ñðœœ¤¹ÑÉ¥´ ¤ì(€€€¥˜¡¥¥ì(€€€€€½¹ÍÐÉÀõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Á…åµ•¹Ñ}É½ÕÁ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€€€€€½¹ÍÐÑ…É•ÑÌõÉÀ¹™¥±Ñ•È¡œôø…¥ÍA…¥‘MÑ…ÑÕÌ¡œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤¤ì(€€€€€¥˜ …Ñ…É•ÑÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“žÖ–B#–ÞË–º3š"CžæÏ¢Êï¾ò3’â7¢÷¦7¢’žŠë¢ª4œ¤ì(€€€€€™½È¡½¹ÍÐœ½˜Ñ…É•ÑÌ¥ì(€€€€€€€¥˜¡}É•Ù¥•ÝMÑ…ÑÕÌ¡œ¤„ôôŸ–ÞË¦2–>Xœ¥É•ÑÕÉ¸©Í½¹ÉÈ ŸžÖ–B#–Ÿ’î7šr'–‚Óš²‡–Âkšr«¦2–>[¾ò3’â7¢÷šVÓžÖžŠë¢ª7’îcš²øœ¤ì(€€€€€€€¥˜¡¥Í…Á…¥Ñå%¹…Ñ¥Ù•QÉ…¹Í™•ÉMÑ…ÑÕÌ¡œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ¤¥É•ÑÕÉ¸©Í½¹ÉÈ ŸžÖ–B#–Ÿ–ÞËšr'–‚Ç–B7¦Ë–—¦¢ÊïšÖž¢/¾ò3’â7¢÷šVÓžÖžŠë¢ª7’îcš²øœ¤ì(€€€€€ô(€€€€€½¹ÍÐÍ¹…Àõmtì(€€€€€™½È¡½¹ÍÐœ½˜Ñ…É•ÑÌ¥ì(€€€€€€€½¹ÍÐÁ…åµ•¹ÑÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€€€€€€€½¹ÍÐ…±±½Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€€€€€€€½¹ÍÐ±•‘•Èõ…Ý…¥Ð‘‰•Ð¡•¹Ø°™¥¹…¹•}±•‘•Èœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€€€€€€€Í¹…À¹ÁÕÍ ¡íÉ•œéì¸¸¹ô±Á…åµ•¹ÑÌ±…±±½Ì±±•‘•Éô¤ì(€€€€€ô(€€€€€½¹ÍÐ…ÁÁ±¥•õmtì(€€€€€ÑÉåì(€€€€€€€™½È¡½¹ÍÐœ½˜Ñ…É•ÑÌ¥ì(€€€€€€€€€½¹ÍÐÉÈõ…Ý…¥Ð¡½¹™¥ÉµA…åµ•¹Ð¡•¹Ø±ì¸¸¹ˆ±É•%éœ¹¥±}É½ÕÁ½¹”éÑÉÕ”±}‘•™•ÉM¥‘•™™•ÑÌéÑÉÕ•ô¤ì(€€€€€€€€€½¹ÍÐ©¨õ…Ý…¥ÐÉÈ¹©Í½¸ ¤ì(€€€€€€€€€¥˜¡©¨˜™©¨¹•ÉÉ½È¥Ñ¡É½Ü¹•ÜÉÉ½È¡©¨¹•ÉÉ½È¤ì(€€€€€€€€€…ÁÁ±¥•¹ÁÕÍ ¡í¥éœ¹¥±…µ½Õ¹ÐéÍ…™•9Õ´¡©¨˜™©¨¹…µ½Õ¹Ð¥ô¤ì(€€€€€€€ô(€€€€€õ…Ñ ¡”¥ì(€€€€€€€™½È¡½¹ÍÐà½˜Í¹…À¥ì(€€€€€€€€€½¹ÍÐÁ…Ñ õì¸¸¹à¹É•ôí‘•±•Ñ”Á…Ñ ¹¥í‘•±•Ñ”Á…Ñ ¹Ñ•¹…¹Ñ}¥ì(€€€€€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡à¹É•œ¹¥¥õ€±Á…Ñ ¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡à¹É•œ¹¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€€€™½È¡½¹ÍÐÉ½Ü½˜à¹Á…åµ•¹ÑÌ¥…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á…åµ•¹ÑÌœ±É½Ü¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡à¹É•œ¹¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€€€™½È¡½¹ÍÐÉ½Ü½˜à¹…±±½Ì¥…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±É½Ü¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°™¥¹…¹•}±•‘•Èœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡à¹É•œ¹¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€€€™½È¡½¹ÍÐÉ½Ü½˜à¹±•‘•È¥…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°™¥¹…¹•}±•‘•Èœ±É½Ü¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸©Í½¹ÉÈ ŸžÖ–B#’îcš²ûžŠë¢ª7–’ÇšV_¾ò3žÎïžÖÇ–ÞË–n{–ú§šVÓžÖ¦GšÖž.š/¾òhœ¬¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸ¢ÎšZg–¾¯–—–’ÇšV\œ¤¤ì(€€€€€ô(€€€€€™½È¡½¹ÍÐà½˜…ÁÁ±¥•¥…Ý…¥ÐÉÕ¹A…åµ•¹Ñ½¹™¥ÉµM¥‘•™™•ÑÌ¡•¹Ø±Q99P±à¹¥±à¹…µ½Õ¹Ð¤¹…Ñ ¡”ôù±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è¡½¹™¥ÉµA…åµ•¹Ðœ±µ•ÍÍ…”èÉ½ÕÀÁ…åµ•¹ÐÍ¥‘”•™™•Ð™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤¤ì(€€€€€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±‰Õ¹‘±•½Õ¹ÐéÑ…É•ÑÌ¹±•¹Ñ ±Á…åµ•¹ÑÉ½ÕÁ%é¥‘ô¤ì(€€€ô(€ô(€¥˜€¡}É•Ù¥•ÝMÑ…ÑÕÌ¡É•œ¤€„ôô€Ÿ–ÞË¦2–>Xœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–Âkšr«¦2–>[¾ò3’â7¢÷žŠë¢ª7’îcš²øœ¤ì(€¥˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡}Á…åMÑ…ÑÕÌ¡É•œ¤¤€˜˜Í…™•9Õ´¡É•œ¹Á…¥‘}…µ½Õ¹Ð¤¬À¸ÀÀÀÄøõÍ…™•9Õ´¡É•œ¹Ñ½Ñ…±}…µ½Õ¹ÑññÉ•œ¹…µ½Õ¹Ð¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË–º3š"CžæÏ¢Êï¾ò3’â7¢÷¦7¢’žŠë¢ª4œ¤ì(€¥˜€¡¥Í…Á…¥Ñå%¹…Ñ¥Ù•QÉ…¹Í™•ÉMÑ…ÑÕÌ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË¦Ë–—¦¢ÊïšÖž¢/¾ò3’â7¢÷žŠë¢ª7’îcš²øœ¤ì(€½¹ÍÐ¹½Ü€ô¹½Ý%Í¼ ¤ì(€½¹ÍÐµ•Ñ¡½€ôˆ¹µ•Ñ¡½ñðÉ•œ¹Á…åµ•¹Ñ}µ•Ñ¡½ñð€Ÿš&/–.WžŠë¢ª4œì(€½¹ÍÐmÁ…åM•ÍI½ÝÌ°Á…å%Ñ•µ5…Át€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹Í•ÍÍ¥½¹}¥¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°(€€€}•ÑI•¥ÍÑÉ…Ñ¥½¹%Ñ•µÍ½ÉI•Ì¡•¹Ø°mÉ•t¤¹…Ñ   ¤ôø¡íô¤¤°(€t¤ì(€½¹ÍÐÁ…å5½¹•ä€ô}É•¥¹…¹•µ½Õ¹ÑÌ¡É•œ°Á…åM•ÍI½ÝÍlÁtñðíô°Á…å%Ñ•µ5…À€˜˜Á…å%Ñ•µ5…ÁmÉ•œ¹¥‘t¤ì(€½¹ÍÐ½™™¥¥…±Õ”õÁ…å5½¹•ä¹…Í¡Q½Ñ…±ññÍ…™•9Õ´¡É•œ¹Ñ½Ñ…±}…µ½Õ¹Ð¥ññÍ…™•9Õ´¡É•œ¹…µ½Õ¹Ð¤ì(€½¹ÍÐ‘Õ•	•™½É”õ5…Ñ ¹µ…à À±½™™¥¥…±Õ”µÍ…™•9Õ´¡É•œ¹Á…¥‘}…µ½Õ¹Ð¤¤ì(€½¹ÍÐ…µ½Õ¹Ðõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡‘Õ•	•™½É•ññ½™™¥¥…±Õ”±Í…™•9Õ´¡É•œ¹Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹Ð¥ññ‘Õ•	•™½É•ññ½™™¥¥…±Õ”¤¤ì(€½¹ÍÐÁ…åM¹…À€ô…Ý…¥Ð•¹ÍÕÉ•A…åµ•¹ÑM¹…ÁÍ¡½Ñ½ÉI•œ¡•¹Ø±Q99P±É•œ±Á…åM•ÍI½ÝÍlÁuññíô°íÝÉ¥Ñ•%™M…™”éÑÉÕ•ô¤¹…Ñ   ¤ôù}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µI•œ¡É•œ¤¤ì(€½¹ÍÐ¹•ÝA…¥õÍ…™•9Õ´¡É•œ¹Á…¥‘}…µ½Õ¹Ð¤­…µ½Õ¹Ð±}‰½½­M¹…ÀõÍ•±•Ñ•‘5½‘Õ±•M¹…ÁÍ¡½Ð¡É•œ¤±}Í•ÕÉ•Õ”õÍ…™•9Õ´¡}‰½½­M¹…À¹…µ½Õ¹ÑÕ•9½Ü¤±¹•áÑA…åMÑ…ÑÕÌõ¹•ÝA…¥¬À¸ÀÀÀÄøõ½™™¥¥…±Õ”üŸ–ÞËžæÏ¢Êìœè¡}Í•ÕÉ•Õ”øÀ˜™¹•ÝA…¥¬À¸ÀÀÀÄøõ}Í•ÕÉ•Õ”üŸ–ÞË’îc¢¢¦DœèŸšr«žæÏ¢Êìœ¤ì(€½¹ÍÐ½É•A…åµ•¹ÑÍ	•™½É”õ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐ½É•±±½Í	•™½É”õ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐ½É•1•‘•É	•™½É”õ…Ý…¥Ð‘‰•Ð¡•¹Ø°™¥¹…¹•}±•‘•Èœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€±•Ð½¹™¥Éµ•‘A…åµ•¹Ñ%ôœœì(€ÑÉåì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±ì(€€€€€Á…åµ•¹Ñ}ÍÑ…ÑÕÌé¹•áÑA…åMÑ…ÑÕÌ±Á…åµ•¹Ñ}µ•Ñ¡½éµ•Ñ¡½±Á…¥‘}…Ðè¡¹•áÑA…åMÑ…ÑÕÌôôôŸ–ÞËžæÏ¢Êìññ¹•áÑA…åMÑ…ÑÕÌôôôŸ–ÞË’îc¢¢¦Dœ¤ý¹½Üè¡É•œ¹Á…¥‘}…Ñññ¹Õ±°¤°(€€€€€Á…¥‘}…µ½Õ¹Ðé¹•ÝA…¥°¸¸¹}Á…åµ•¹ÑM¹…ÁÍ¡½Ñ‰A…å±½…¡Á…åM¹…À¤°(€€€ô¤ì(€€€½¹ÍÐÁ•¹‘¥¹A…åI½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™ÍÑ…ÑÕÌõ•Ä¸•Ô•	”àÔ•Ü•È•	•à•”á™Í•±•Ðõ¥‘€¤ì(€€€¥˜¡Á•¹‘¥¹A…åI½ÝÌ¹±•¹Ñ ¥ì(€€€€€½¹™¥Éµ•‘A…åµ•¹Ñ%õMÑÉ¥¹œ¡Á•¹‘¥¹A…åI½ÝÍlÁt¹¥¤ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡½¹™¥Éµ•‘A…åµ•¹Ñ%¥õ€±íÉ•¥ÍÑÉ…Ñ¥½¹}¥éˆ¹É•%±Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±•µ…¥°éÉ•œ¹•µ…¥°±…µ½Õ¹Ð±µ•Ñ¡½±ÍÑ…ÑÕÌèŸ–ÞËžŠë¢ª4œ±ÑÉ…‘•}¹¼éˆ¹µ•É¡…¹ÑQÉ…‘•9½ññÉ•œ¹Á…åµ•¹Ñ}±…ÍÐÕñðœœ±Á…¥‘}…Ðé¹½Ü±Á…åµ•¹Ñ}ÁÉ½™¥±•}¥è¡Á…åM¹…À˜™Á…åM¹…À¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥¥ññ¹Õ±°±Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½ÐéÁ…åM¹…Áññíõô¤ì(€€€€€™½È¡½¹ÍÐ•áÑÉ„½˜Á•¹‘¥¹A…åI½ÝÌ¹Í±¥” Ä¤¥ì(€€€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡•áÑÉ„¹¥¥õ€±í…µ½Õ¹ÐèÀ±ÍÑ…ÑÕÌèŸ–ÞË’ös–îˆœ±…‘µ¥¹}¹½Ñ”èŸ–B3’â–‚Ç–B7¦7¢’’îcš²û–n{–‚Ç¾ò3žŠë¢ª7’îcš²ûšf–B#’ö×’ös–îˆô¤¹…Ñ   ¤ôùíô¤ì(€€€€€ô(€€€õ•±Í•ì(€€€€€½¹™¥Éµ•‘A…åµ•¹Ñ%õ•¹% Adœ¤ì(€€€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á…åµ•¹ÑÌœ±í¥é½¹™¥Éµ•‘A…åµ•¹Ñ%±Ñ•¹…¹Ñ}¥éQ99P±É•¥ÍÑÉ…Ñ¥½¹}¥éˆ¹É•%±Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±•µ…¥°éÉ•œ¹•µ…¥°±…µ½Õ¹Ð±µ•Ñ¡½±ÍÑ…ÑÕÌèŸ–ÞËžŠë¢ª4œ±ÑÉ…‘•}¹¼éˆ¹µ•É¡…¹ÑQÉ…‘•9½ññÉ•œ¹Á…åµ•¹Ñ}±…ÍÐÕñðœœ±Á…¥‘}…Ðé¹½Ü±É•…Ñ•‘}…Ðé¹½Ü±Á…åµ•¹Ñ}ÁÉ½™¥±•}¥è¡Á…åM¹…À˜™Á…åM¹…À¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥¥ññ¹Õ±°±Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½ÐéÁ…åM¹…Áññíõô¤ì(€€€ô(€€€¥˜¡…µ½Õ¹ÐøÀ¥ì(€€€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±í¥é•¹% A0œ¤±Ñ•¹…¹Ñ}¥éQ99P±Á…åµ•¹Ñ}¥é½¹™¥Éµ•‘A…åµ•¹Ñ%‘ññ¹Õ±°±É•¥ÍÑÉ…Ñ¥½¹}¥éˆ¹É•%±Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±…±±½…Ñ¥½¹}ÑåÁ”èÁ…åµ•¹Ðœ±…µ½Õ¹Ð±É•…Ñ•‘}…Ðé¹½Ýô¤ì(€€€€€…Ý…¥ÐÝÉ¥Ñ•¥¹…¹•1•‘•È¡•¹Ø±Q99P±íÉ•¥ÍÑÉ…Ñ¥½¹%éˆ¹É•%±Í•ÍÍ¥½¹%éÉ•œ¹Í•ÍÍ¥½¹}¥±Á…åµ•¹Ñ%é½¹™¥Éµ•‘A…åµ•¹Ñ%‘ññ¹Õ±°±•¹ÑÉåQåÁ”èÁ…åµ•¹Ñ}É••¥Ù•œ±…µ½Õ¹Ð±‘¥É•Ñ¥½¸èÉ•‘¥Ðœ±µ•µ¼èŸžŠë¢ª7šRÛš²øœ±ÍÑÉ¥ÐéÑÉÕ•ô¤ì(€€€ô(€õ…Ñ ¡”¥ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥õ€±ì(€€€€€Á…åµ•¹Ñ}ÍÑ…ÑÕÌéÉ•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ±Á…åµ•¹Ñ}µ•Ñ¡½éÉ•œ¹Á…åµ•¹Ñ}µ•Ñ¡½‘ñðœœ±Á…¥‘}…ÐéÉ•œ¹Á…¥‘}…Ñññ¹Õ±°±Á…¥‘}…µ½Õ¹ÐéÍ…™•9Õ´¡É•œ¹Á…¥‘}…µ½Õ¹Ð¤°(€€€€€Á…åµ•¹Ñ}ÁÉ½™¥±•}¥éÉ•œ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥‘ññ¹Õ±°±Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½Ð±íô¤°(€€€€€Á…åµ•¹Ñ}½Ý¹•É}µ½‘”éÉ•œ¹Á…åµ•¹Ñ}½Ý¹•É}µ½‘•ñðœœ±Á…åµ•¹Ñ}µ•Ñ¡½‘Í}…±±½Ý•éÍ…™•)Í½¸¡É•œ¹Á…åµ•¹Ñ}µ•Ñ¡½‘Í}…±±½Ý•±íô¤°(€€€€€‰…¹­}…½Õ¹Ñ}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹‰…¹­}…½Õ¹Ñ}Í¹…ÁÍ¡½Ð±íô¤±±¥¹•Á…å}½¹™¥}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹±¥¹•Á…å}½¹™¥}Í¹…ÁÍ¡½Ð±íô¤°(€€€€€…É‘}½¹™¥}Í¹…ÁÍ¡½ÐéÍ…™•)Í½¸¡É•œ¹…É‘}½¹™¥}Í¹…ÁÍ¡½Ð±íô¤±Á…åµ•¹Ñ}Í¹…ÁÍ¡½Ñ}É•…Ñ•‘}…ÐéÉ•œ¹Á…åµ•¹Ñ}Í¹…ÁÍ¡½Ñ}É•…Ñ•‘}…Ñññ¹Õ±°(€€€ô¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€™½È¡½¹ÍÐÉ½Ü½˜½É•A…åµ•¹ÑÍ	•™½É”¥…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á…åµ•¹ÑÌœ±É½Ü¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€™½È¡½¹ÍÐÉ½Ü½˜½É•±±½Í	•™½É”¥…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±É½Ü¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°™¥¹…¹•}±•‘•Èœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€™½È¡½¹ÍÐÉ½Ü½˜½É•1•‘•É	•™½É”¥…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°™¥¹…¹•}±•‘•Èœ±É½Ü¤¹…Ñ   ¤ôùíô¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ ŸžŠë¢ª7’îcš²û–’ÇšV_¾ò3žÎïžÖÇ–ÞË–n{–ú§šr³š²‡–º3šVÓ¦GšÖž.š/¾òhœ¬¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸ¦GšÖ¢ÎšZg–¾¯–—–’ÇšV\œ¤¤ì(€ô(€¥˜¡ˆ¹}‘•™•ÉM¥‘•™™•ÑÌ¥É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±‘•™•ÉÉ•éÑÉÕ”±…µ½Õ¹Ð±¹•ÝA…¥±¹•áÑA…åMÑ…ÑÕÍô¤ì(€…Ý…¥ÐÉÕ¹A…åµ•¹Ñ½¹™¥ÉµM¥‘•™™•ÑÌ¡•¹Ø±Q99P±ˆ¹É•%±…µ½Õ¹Ð¤¹…Ñ ¡”ôù±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è¡½¹™¥ÉµA…åµ•¹Ðœ±µ•ÍÍ…”èÁ…åµ•¹ÐÍ¥‘”•™™•Ð™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±…µ½Õ¹Ð±¹•ÝA…¥±¹•áÑA…åMÑ…ÑÕÍô¤ì)ô((¼¼µ…É­A…åµ•¹ÑMÉ••¹Í¡½Ó¾ò#–ú3–>Ãš¢g¢¢c–ÞË–n{–‚Ç–º‹šr7¾ò?–ÞËšRÛ–"Ã–2¿š²ûš"«–r[¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡5…É­A…åµ•¹ÑMÉ••¹Í¡½Ð¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€¥˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡}Á…åMÑ…ÑÕÌ¡É•œ¤¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞËžŠë¢ª7’îcš²û¾ò3’â7¦r–7š¢g¢¢c–º‹šr7–n{–‚Äœ¤ì(€¥˜€¡}É•Ù¥•ÝMÑ…ÑÕÌ¡É•œ¤ôôôŸ–ÞË–>[šÚ œ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË–>[šÚ#¾ò3’â7¢÷š¢g¢¢c–º‹šr7–n{–‚Äœ¤ì(€½¹ÍÐ¹½Ü€ô¹½Ý%Í¼ ¤ì(€½¹ÍÐ½±‘9½Ñ”€ôMÑÉ¥¹œ¡É•œ¹…‘µ¥¹}¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ…ÁÁ•¹€ôo–ú3–>Átƒ–ÞË–n{–‚Ç–º‹šr7¾ò?–ÞËšRÛ–"Ã–2¿š²ûš"«–rX€‘í¹½ÝQ…¥Á•¥Q•áÐ ¥õ€ì(€½¹ÍÐ‘…Ñ„€ôì(€€€Á…åµ•¹Ñ}ÍÉ••¹Í¡½Ñ}ÍÑ…ÑÕÌèŸ–ÞË–n{–‚Ç–º‹šr4œ°(€€€Á…åµ•¹Ñ}ÍÉ••¹Í¡½Ñ}É••¥Ù•‘}…Ðé¹½Ü°(€€€…‘µ¥¹}¹½Ñ”è¡½±‘9½Ñ”€ü½±‘9½Ñ”€¬€œ€œ€è€œœ¤€¬…ÁÁ•¹°(€ôì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±‘…Ñ„¤ì(€ÑÉäì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™ÍÑ…ÑÕÌõ•Ä»–úžŠë¢ª5€±ì(€€€€€ÍÉ••¹Í¡½Ñ}ÍÑ…ÑÕÌèŸ–ÞË–n{–‚Ç–º‹šr4œ°(€€€€€ÍÉ••¹Í¡½Ñ}É••¥Ù•‘}…Ðé¹½Ü°(€€€€€…‘µ¥¹}¹½Ñ”é…ÁÁ•¹°(€€€ô¤ì(€ô…Ñ ¡”¤ì½¹Í½±”¹•ÉÉ½È Á…åµ•¹ÑÌÍÉ••¹Í¡½Ð½ÁÑ¥½¹…°ÕÁ‘…Ñ”Í­¥ÁÁ•œ°”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é”¤ì±½ÉÉ½È¡•¹Ø°íÍ½ÕÉ”è¡5…É­A…åµ•¹ÑMÉ••¹Í¡½Ðœ°µ•ÍÍ…”èÁ…åµ•¹ÑÌÍÉ••¹Í¡½Ð½ÁÑ¥½¹…°ÕÁ‘…Ñ”Í­¥ÁÁ•œ°•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°Á…åµ•¹ÑMÉ••¹Í¡½ÑMÑ…ÑÕÌèŸ–ÞË–n{–‚Ç–º‹šr4œ°Á…åµ•¹ÑMÉ••¹Í¡½ÑI••¥Ù•‘Ðé¹½Ýô¤ì)ô(((¼¼Í•¹‘A…åµ•¹ÑI•µ¥¹‘•Ë¾ò#–ú3–>Ãš&/–.W–¾–ë–ú’îcš²ûš>C¦K¾ò3šR¿š>Ð•µ…¥±}Ñ•µÁ±…Ñ•Ìƒ¢"oš2'¦"Tè¸¸¹tƒ¢ª{šÎW¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡M•¹‘A…åµ•¹ÑI•µ¥¹‘•È¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐÉ•%€ôˆ¹É•%ñðˆ¹¥ì(€¥˜€ …É•%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÉ•%œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôˆ¹Í•ÍÍ¥½¹%ñðˆ¹Í•ÍÍ¥½¹}¥ñðÉ•œ¹Í•ÍÍ¥½¹}¥ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°É•Ù¥•Üœ±Í•ÍÍ¥½¹%¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜€ …É•œ¹•µ…¥°¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7šÊKšr$µ…¥³¾ò3ž‡šÎW–¾’þ„œ¤ì(€¥˜€¡}É•Ù¥•ÝMÑ…ÑÕÌ¡É•œ¤€„ôô€Ÿ–ÞË¦2–>Xœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–Âkšr«¦2–>[¾ò3’â7¦§–B#–¾–ú’îcš²ûš>C¦Hœ¤ì(€¥˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡}Á…åMÑ…ÑÕÌ¡É•œ¤¤ñð}Á…åMÑ…ÑÕÌ¡É•œ¤€ôôô€Ÿ–7¢Êìœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË–º3š"C’îcš²ûš"[ž
ë–7¢Êï¾ò3’â7¦r–¾–ú’îcš²ûš>C¦Hœ¤ì(€¥˜€¡¥Í…Á…¥Ñå%¹…Ñ¥Ù•QÉ…¹Í™•ÉMÑ…ÑÕÌ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ¤ñð}É•Ù¥•ÝMÑ…ÑÕÌ¡É•œ¤ôôôŸ–ÞË–>[šÚ œ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË–>[šÚ#š"[¦Ë–—¦¢ÊïšÖž¢/¾ò3’â7¢÷–¾–ú’îcš²ûš>C¦Hœ¤ì(€½¹ÍÐÍ•Í9…µ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø°Í•ÍÍ¥½¹%°Q99P¤ì(€½¹ÍÐÍ•ÍQåÁ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø°Í•ÍÍ¥½¹%°Q99P¤ì(€½¹ÍÐÑŒ€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€½¹ÍÐÍ•±•Ñ•‘…Ñ•Ì€ôÍ…™•)Í½¸¡É•œ¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸°mt¤ì(€½¹ÍÐ‘…Ñ•ÍQ•áÐ€ôÉÉ…ä¹¥ÍÉÉ…ä¡Í•±•Ñ•‘…Ñ•Ì¤€üÍ•±•Ñ•‘…Ñ•Ì¹µ…À¡€ôøÑåÁ•½˜ôôô½‰©•Ðœ€ü€¡¹‘…Ñ”ñð¹Ù…±Õ”ñð¹±…‰•°ñð€œœ¤€èMÑÉ¥¹œ¡‘ñðœœ¤¤¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ ŸŽœ¤€èMÑÉ¥¹œ¡Í•±•Ñ•‘…Ñ•Ìñð€œœ¤ì(€½¹ÍÐ‘¥ÍÁ±…å9…µ”€ô•Ñ¥ÍÁ±…å9…µ”¡É•œ¹¹…µ”°É•œ¹‰É…¹‘}¹…µ•ñðœœ¤ì(€½¹ÍÐ…µ½Õ¹Ð€ô9Õµ‰•È¡É•œ¹…µ½Õ¹ÐñðÉ•œ¹Ñ½Ñ…±}…µ½Õ¹ÐñðÉ•œ¹É•¥ÍÑÉ…Ñ¥½¹}Ñ½Ñ…±}…µ½Õ¹Ðñð€À¤ñð€Àì(€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥Ðµ…¥±•…‘±¥¹•I•µ¥¹‘•È¡•¹Ø°É•œ¹•µ…¥°°‘¥ÍÁ±…å9…µ”°Í•Í9…µ”°É•œ¹¥°…µ½Õ¹Ð°Í•±•Ñ•‘…Ñ•Ì°É•œ¹•ÅÕ¥Áµ•¹Ñ}©Í½¸°€œœ°ÑŒ¤ì(€¥˜€¡É•ÍÕ±Ð€˜˜É•ÍÕ±Ð¹‘¥Í…‰±•¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦g–Â’þ‡žn»–&7–ÞË–sžR£¾ò3šr«–¾–èœ¤ì(€¥˜€ …É•ÍÕ±Ðñð€…É•ÍÕ±Ð¹½¬¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–¾’þ‡–’ÇšV_¾òhœ¬ ¡É•ÍÕ±Ð˜™É•ÍÕ±Ð¹•ÉÉ½È¥ñðŸšr«ž~—¦2¿¢ªœ¤¤ì(€½¹ÍÐ½±‘9½Ñ”€ôMÑÉ¥¹œ¡É•œ¹…‘µ¥¹}¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐ…ÁÁ•¹€ôo–ú3–>Átƒ–ÞË–¾–ë–ú’îcš²ûš>C¦H€‘í¹½ÝQ…¥Á•¥Q•áÐ ¥õ€ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±íÉ•µ¥¹‘•É}Í•¹ÐéÑÉÕ”±…‘µ¥¹}¹½Ñ”è¡½±‘9½Ñ”€ü½±‘9½Ñ”€¬€œ€œ€è€œœ¤€¬…ÁÁ•¹‘ô¤¹…Ñ   ¤ôùíô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°Ñ¼éÉ•œ¹•µ…¥°°ÍÕ‰©•Ñô¤ì)ô((¼¼…‘µ¥¹…¹•±I•Ÿ¾ò#–ú3–>Ã–>[šÚ#šr«žæÏ¢Êï¾ò?–úžŠë¢ª7–‚Ç–B7¾ò3’þwžVg¢ÎšZg’â7–"«¦f“¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡‘µ¥¹…¹•±I•œ¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°É•Ù¥•Üœ±ˆ¹Í•ÍÍ¥½¹%‘ññˆ¹Í•ÍÍ¥½¹}¥‘ñðœœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€½¹ÍÐÉ½ÕÀ€ô…Ý…¥Ð•Ñ	Õ¹‘±•É½ÕÁI•Ì¡•¹Ø°Q99P°É•œ¤ì(€½¹ÍÐ¹½Ü€ô¹½Ý%Í¼ ¤ì(€½¹ÍÐÉ•…Í½¸€ôMÑÉ¥¹œ¡ˆ¹É•…Í½¸ñðˆ¹…¹•±I•…Í½¸ñðˆ¹…¹•±}É•…Í½¸ñð€œœ¤¹ÑÉ¥´ ¤¹Í±¥” À°ÌÀÀ¤ì((€€¼¼ƒ–ÞË–º3š"C¦¢Êï¾ò?–ÞË–>[šÚ#¢š[ž
ë–«ž¶'š"C–*¾ò3’â7¦7¢’š&–B7¦†7š"[šRç¦GšÖŽ(€½¹ÍÐÁ•¹‘¥¹œ€ôÉ½ÕÀ¹™¥±Ñ•È¡œ€ôø}É•Ù¥•ÝMÑ…ÑÕÌ¡œ¤„ôôŸ–ÞË–>[šÚ œ€˜˜€…lŸ–ÞË¦¢Êìœ°É•™Õ¹‘•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¤ì(€¥˜€ …Á•¹‘¥¹œ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°…±É•…‘å…¹•±±•éÑÉÕ”°‰Õ¹‘±•½Õ¹ÐéÉ½ÕÀ¹±•¹Ñ¡ô¤ì((€€¼¼ƒ–>«¢šžÖ–B#–Ÿ’îï’âž¶–ÞËšr'–¾›šRÛ¾ò3–ÂÇšVÓžÖ¦Ë¦š²û–ú¢ú›¾òo’îcš²ûš¶ß–>Ë¢"Á…¥‘}…µ½Õ¹Ðƒ’þwžVg’â7š*ç¦f“Ž(€½¹ÍÐ¹••‘ÍI•™Õ¹€ôÁ•¹‘¥¹œ¹Í½µ”¡œ€ôø¥ÍA…¥‘MÑ…ÑÕÌ¡}Á…åMÑ…ÑÕÌ¡œ¤¤ñðÍ…™•9Õ´¡œ¹Á…¥‘}…µ½Õ¹Ð¤øÀ¤ì((€™½È€¡½¹ÍÐœ½˜Á•¹‘¥¹œ¤ì(€€€½¹ÍÐÝ…ÍÑ¥Ù”€ô¥ÍÑ¥Ù•½É…Á…¥Ñä¡œ¤ì(€€€½¹ÍÐÁ…¥€ô¥ÍA…¥‘MÑ…ÑÕÌ¡}Á…åMÑ…ÑÕÌ¡œ¤¤ñðÍ…™•9Õ´¡œ¹Á…¥‘}…µ½Õ¹Ð¤øÀì(€€€½¹ÍÐ½±‘9½Ñ”€ôMÑÉ¥¹œ¡œ¹…‘µ¥¹}¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤ì(€€€½¹ÍÐ±…‰•°€ô¹••‘ÍI•™Õ¹€ü€o–ú3–>Átƒ’âï¢ú›–>[šÚ#–‚Ç–B7¾ò3–ÞË¢ö'¦š²û–ú¢fWžBœ€è€o–ú3–>Átƒ’âï¢ú›–>[šÚ#–‚Ç–B4œì(€€€½¹ÍÐ…ÁÁ•¹€ô€‘í±…‰•±ô‘íÉ½ÕÀ¹±•¹Ñ øÄüŸ¾ò#žÖ–B#––_žÖ–B3¦Ë¦¾ò$œèœô‘íÉ•…Í½¸üŸ¾ös–:–nƒ¾òhœ­É•…Í½¸èœô€‘í¹½ÝQ…¥Á•¥Q•áÐ ¥õ€ì(€€€½¹ÍÐÕÁ€ôì(€€€€€É•Ù¥•Ý}ÍÑ…ÑÕÌèŸ–ÞË–>[šÚ œ°(€€€€€ÑÉ…¹Í™•É}ÍÑ…ÑÕÌè¹••‘ÍI•™Õ¹€ü€Ÿ¦¢Êï’â´œ€è¹Õ±°°(€€€€€ÑÉ…¹Í™•É}¡½Í•¹}…Ðè¹••‘ÍI•™Õ¹€ü¹½Ü€è€¡œ¹ÑÉ…¹Í™•É}¡½Í•¹}…Ñññ¹Õ±°¤°(€€€€€ÍÑ…±±}¹Õµ‰•Èé¹Õ±°°(€€€€€Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÉ•±•…Í•œ°(€€€€€Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°°(€€€€€Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°°(€€€€€…‘µ¥¹}¹½Ñ”è¡½±‘9½Ñ”€ü½±‘9½Ñ”€¬€œ€œ€è€œœ¤€¬…ÁÁ•¹°(€€€ôì(€€€¥˜€ …Á…¥€˜˜€…¹••‘ÍI•™Õ¹¤ì(€€€€€ÕÁ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ€ô€Ÿ–ÞË–>[šÚ œì(€€€€€ÕÁ¹Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹Ð€ô€Àì(€€€€€ÕÁ¹Á…åµ•¹Ñ}±…ÍÐÔ€ô¹Õ±°ì(€€€€€ÕÁ¹Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ð€ô¹Õ±°ì(€€€ô(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±ÕÁ¤ì(€€€¥˜€¡Ý…ÍÑ¥Ù”¤…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø±Q99P±œ°´¡Í…™•9Õ´¡œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤¤ì(€€€…Ý…¥ÐÉ•±•…Í•I•¥ÍÑÉ…Ñ¥½¹M•…ÑÌ¡•¹Ø±Q99P±œ±¹••‘ÍI•™Õ¹ü…‘µ¥¹}…¹•±}É•™Õ¹‘}Á•¹‘¥¹œœè…‘µ¥¹}…¹•°œ¤ì(€€€…Ý…¥ÐÉ•±•…Í•I•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½ÑÌ¡•¹Ø±Q99P±œ¤ì(€€€¥˜€ …¹••‘ÍI•™Õ¹¤ì(€€€€€ÑÉäì…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥ô™ÍÑ…ÑÕÌõ•Ä¸•Ô•	”àÔ•Ü•È•	•à•”á€±íÍÑ…ÑÕÌèŸ–ÞË–>[šÚ ô¤ìô…Ñ ¡”¤íô(€€€ô(€€€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P±ˆ¹•µ…¥±ñðœœ°½É…¹¥é•É}…‘µ¥¸œ±¹••‘ÍI•™Õ¹ü…‘µ¥¹}…¹•±}Ñ½}É•™Õ¹œè…‘µ¥¹}…¹•°œ°É•¥ÍÑÉ…Ñ¥½¹Ìœ±œ¹¥°(€€€€€íÉ•Ù¥•Ý}ÍÑ…ÑÕÌéœ¹É•Ù¥•Ý}ÍÑ…ÑÕÌ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌéœ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ±ÑÉ…¹Í™•É}ÍÑ…ÑÕÌéœ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍô±ÕÁ°(€€€€€íÉ•…Í½¸±‰Õ¹‘±•}É½ÕÀéÉ½ÕÀ¹±•¹Ñ øÄ±Á…¥‘}…µ½Õ¹ÐéÍ…™•9Õ´¡œ¹Á…¥‘}…µ½Õ¹Ð¤±…Á…¥Ñå}‘•±Ñ„éÝ…ÍÑ¥Ù”ü´¡Í…™•9Õ´¡œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤èÁô¤ì(€ô((€™½È¡½¹ÍÐÍ¥½˜l¸¸¹¹•ÜM•Ð¡Á•¹‘¥¹œ¹µ…À¡àôùà¹Í•ÍÍ¥½¹}¥¤¹™¥±Ñ•È¡	½½±•…¸¤¥t¥…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±Q99P±Í¥¤ì(€¥˜€¡¹••‘ÍI•™Õ¹¤ì(€€€€¼¼ƒ–¾–ë¦š²ûžRÏ¢®/–ÞËšRÛ–"Ã¦kž~—¾òo’âï¢ú›–>¿žnÓš:—–r£¦š²û–ú¢ú›–º3š"C–ú3žê3žŠë¢ª7Ž(€€€™½È€¡½¹ÍÐœ½˜Á•¹‘¥¹œ¤ì(€€€€€¥˜€ „¡¥ÍA…¥‘MÑ…ÑÕÌ¡}Á…åMÑ…ÑÕÌ¡œ¤¤ñðÍ…™•9Õ´¡œ¹Á…¥‘}…µ½Õ¹Ð¤øÀ¤ñð€…œ¹•µ…¥°¤½¹Ñ¥¹Õ”ì(€€€€€ÑÉäì(€€€€€€€½¹ÍÐÍ•Í9…µ”õ…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø±œ¹Í•ÍÍ¥½¹}¥±Q99P¤ì(€€€€€€€½¹ÍÐÑŒõ…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø±Q99P¤ì(€€€€€€€…Ý…¥Ðµ…¥±I•™Õ¹‘I•ÅÕ•ÍÑI••¥Ù•¡•¹Ø±œ¹•µ…¥°±•Ñ¥ÍÁ±…å9…µ”¡œ¹¹…µ”±œ¹‰É…¹‘}¹…µ•ñðœœ±…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø±œ¹Í•ÍÍ¥½¹}¥±Q99P¤¤±Í•Í9…µ”±ÑŒ¤ì(€€€€€ô…Ñ ¡”¤ì±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”è¡‘µ¥¹…¹•±I•œœ±…Ñ¥½¸è…‘µ¥¹…¹•±I•œœ±Ñ•¹…¹Ñ%éQ99P±É•%éœ¹¥±µ•ÍÍ…”èŸ’âï¢ú›–>[šÚ#–ú3¦š²û¦kž~—–¾¦–’ÇšV\œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìô(€€€ô(€€€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±ÍÑ…ÑÕÌèŸ–ÞË–>[šÚ œ±É•™Õ¹‘A•¹‘¥¹œéÑÉÕ”±ÑÉ…¹Í™•ÉMÑ…ÑÕÌèŸ¦¢Êï’â´œ±‰Õ¹‘±•½Õ¹ÐéÉ½ÕÀ¹±•¹Ñ¡ô¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±ÍÑ…ÑÕÌèŸ–ÞË–>[šÚ œ±É•™Õ¹‘A•¹‘¥¹œé™…±Í”±‰Õ¹‘±•½Õ¹ÐéÉ½ÕÀ¹±•¹Ñ¡ô¤ì)ô((¼¼É•™Õ¹‘•Á½Í¥Ð)…Íå¹Œ™Õ¹Ñ¥½¸¡I•™Õ¹‘•Á½Í¥Ð¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ˜™ˆ¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤í¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œõÉ½ÝÍlÁtí¥˜¡MÑÉ¥¹œ¡É•œ¹‘•Á½Í¥Ñ}É•™Õ¹‘•‘ñðœœ¤ôôôŸ–ÞË¦š*ó¦Dœ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“ž¶š*ó¦G–ÞË–º3š"C¦¦
œ¤ì(€¥˜¡lŸžRÏ¢®/¦¢Êìœ°Ÿ¦¢Êï’â´œ°Ÿ–ÞË¦¢Êìt¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦¢Êï’â·š"[–ÞË¦¢Êï’â7–>¿–>›¢ÖÃ¦š*ó¦Dœ¤ì(€½¹ÍÐÍ•Ìõ…Ý…¥Ð•ÑM•ÍÍ¥½¹I½Ü¡•¹Ø±É•œ¹Í•ÍÍ¥½¹}¥±Q99P¤¹…Ñ   ¤ôù¹Õ±°¤±ÍÁ±¥Ðõ}É••¥Ù•‘MÁ±¥Ñ½ÉI•œ¡É•œ±Í•Íññíô±¹Õ±°¤ì(€½¹ÍÐ…µ½Õ¹Ðõ5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡ÍÁ±¥Ð¹‘•Á½Í¥ÑI••¥Ù•±Í…™•9Õ´¡É•œ¹‘•Á½Í¥Ð¥ññÍ…™•9Õ´¡Í•Ì˜™Í•Ì¹‘•Á½Í¥Ð¤¤¤í¥˜¡…µ½Õ¹ÐðôÀ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“ž¶šÊKšr'–ÞË–¾›šRÛ’âS–>¿¦žjš*ó¦Dœ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±í‘•Á½Í¥Ñ}É•™Õ¹‘•èŸ–ÞË¦š*ó¦Dô¤ì(€…Ý…¥ÐÝÉ¥Ñ•¥¹…¹•1•‘•È¡•¹Ø±Q99P±íÉ•¥ÍÑÉ…Ñ¥½¹%éˆ¹É•%±Í•ÍÍ¥½¹%éÉ•œ¹Í•ÍÍ¥½¹}¥±•¹ÑÉåQåÁ”è‘•Á½Í¥Ñ}É•™Õ¹œ±…µ½Õ¹Ð±‘¥É•Ñ¥½¸è‘•‰¥Ðœ±µ•µ¼èŸ¦¦
š*ó¦Dô¤ì(€…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±Q99P±É•œ¹Í•ÍÍ¥½¹}¥¤íÉ•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±…µ½Õ¹Ñô¤ì)ô((¼¼¡•­¥¸(¼¼ƒŠRŠR ƒ–‚Ç–"Ã–ÇžR£š‚ã–þ¾òk–ú3–>ÃŽ3ž>û–‚ÓŽ5Ñ…ˆƒ¢"–Þ—¢ºžR¦k¢†3žŠó¦‚–ÇžR£–B3’â’î÷¢š?–&ƒŠRŠR (¼¼ƒ¢š?–&¾òk–‚Ç–"Ã–þ¦‚#Ž3–ÞË¦2–>[Ž7¾ò/Ž3–ÞËžæÏ¢Êïš"[–7¢ÊïŽ7¾ò/¦v{¦¢ÊïšÖž¢/’â·¾òo–>[šÚ#–‚Ç–"Ã’â–ú/–¾¯Ž3šr«–‚Ç–"ÃŽ7Ž)™Õ¹Ñ¥½¸¡•­¥¹Õ…É¡É•œ°Õ¹‘¼¥ì(€¥˜€¡Õ¹‘¼¤É•ÑÕÉ¸€œœì(€¥˜€¡}É•Ù¥•ÝMÑ…ÑÕÌ¡É•œ¤€„ôô€Ÿ–ÞË¦2–>Xœ¤É•ÑÕÉ¸€Ÿ–Âkšr«¦2–>[¾ò3’â7¢÷–‚Ç–"Àœì(€¥˜€ „¡¥Í	½½­¥¹M•ÕÉ•‘MÑ…ÑÕÌ¡}Á…åMÑ…ÑÕÌ¡É•œ¤¤ñð}Á…åMÑ…ÑÕÌ¡É•œ¤€ôôô€Ÿ–7¢Êìœ¤¤É•ÑÕÉ¸€Ÿ–Âkšr«–º3š"C–þ¢š’îcš²û¾ò3’â7¢÷–‚Ç–"Àœì(€¥˜€¡lŸžRÏ¢®/¦¢Êìœ°Ÿ–ÞË¦¢Êìt¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¤É•ÑÕÉ¸€Ÿš¶“–‚Ç–B7–ÞË¦Ë–—¦¢ÊïšÖž¢/¾ò3’â7¢÷–‚Ç–"Àœì(€É•ÑÕÉ¸€œœì)ô)™Õ¹Ñ¥½¸¡•­¥¹…Ñ„¡Õ¹‘¼°¹½Ü¥ì(€É•ÑÕÉ¸Õ¹‘¼€üí¡•­¥¹}ÍÑ…ÑÕÌèŸšr«–‚Ç–"Àœ°¡•­¥¹}…Ðé¹Õ±±ô(€€€€€€€€€€€€€€èí¡•­¥¹}ÍÑ…ÑÕÌèŸ–ÞË–‚Ç–"Àœ°¡•­¥¹}…Ðé¹½Ýôì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡¡•­¥¸¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°¡•­¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÕ¹‘¼€ôˆ¹Õ¹‘¼ôôõÑÉÕ•ññˆ¹Õ¹‘¼ôôôÑÉÕ”œì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•ÐõÉ•Ù¥•Ý}ÍÑ…ÑÕÌ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌ±ÑÉ…¹Í™•É}ÍÑ…ÑÕÍ€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€½¹ÍÐ•ÉÈ€ô¡•­¥¹Õ…É¡É•œ°Õ¹‘¼¤ì(€¥˜€¡•ÉÈ¤É•ÑÕÉ¸©Í½¹ÉÈ¡•ÉÈ¤ì(€½¹ÍÐ¹½Ü€ô¹½Ý%Í¼ ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€°¡•­¥¹…Ñ„¡Õ¹‘¼°¹½Ü¤¤ì(€½¹ÍÐ½Á•É…Ñ½È€ô…Ý…¥ÐÍÑ…™™¥ÍÁ±…å9…µ”¡•¹Ø°Q99P°ˆ¹•µ…¥°¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Í•…Ñ}½Á•É…Ñ¥½¹}±½Ìœ±ì¥è•¹% =A0œ¤°Ñ•¹…¹Ñ}¥èQ99P°Í•ÍÍ¥½¹}¥è€¡ˆ¹Í•ÍÍ¥½¹%‘ññ¹Õ±°¤°É•¥ÍÑÉ…Ñ¥½¹}¥èˆ¹É•%°ÍÑ…±±}¥è¹Õ±°°…Ñ¥½¸èÕ¹‘¼üÕ¹‘½¡•­¥¸œè¡•­¥¸œ°½Á•É…Ñ½É}ÑåÁ”è…‘µ¥¸œ°½Á•É…Ñ½É}¥è½Á•É…Ñ½È°¹½Ñ”è¹Õ±°°É•…Ñ•‘}…Ðè¹½Üô¤¹…Ñ   ¤ôùíô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°Õ¹‘½ô¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡UÁ‘…Ñ•I•¥ÍÑÉ…Ñ¥½¹Ñ¥½¸¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐÉ•%€ôˆ¹É•%ñðˆ¹¥ì(€½¹ÍÐ…Ñ¥½¸€ôMÑÉ¥¹œ¡ˆ¹É•Ñ¥½¸ñðˆ¹…Ñ¥½¹9…µ”ñðˆ¹µ½‘”ñð€œœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …É•%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÉ•%œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€½¹ÍÐÍ•ÍÍ¥½¹%€ôˆ¹Í•ÍÍ¥½¹%ñðˆ¹Í•ÍÍ¥½¹}¥ñðÉ•œ¹Í•ÍÍ¥½¹}¥ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°œœ±Í•ÍÍ¥½¹%¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜€¡…Ñ¥½¸€ôôô€…ÁÁÉ½Ù”œ¤É•ÑÕÉ¸¡ÁÁÉ½Ù•I•œ¡•¹Ø±ì¸¸¹ˆ±É•%±ÍÑ…ÑÕÌèŸ–ÞË¦2–>Xœ±…ÁÁÉ½Ù•éÑÉÕ”±Í•ÍÍ¥½¹%‘ô¤ì(€¥˜€¡…Ñ¥½¸€ôôô€É•©•Ðœ¤É•ÑÕÉ¸¡ÁÁÉ½Ù•I•œ¡•¹Ø±ì¸¸¹ˆ±É•%±ÍÑ…ÑÕÌèŸ’â7¦2–>Xœ±…ÁÁÉ½Ù•é™…±Í”±Í•ÍÍ¥½¹%‘ô¤ì(€¥˜€¡…Ñ¥½¸€ôôô€Ý…¥Ñ±¥ÍÐœ¤É•ÑÕÉ¸¡ÁÁÉ½Ù•I•œ¡•¹Ø±ì¸¸¹ˆ±É•%±ÍÑ…ÑÕÌèŸ–
g–>Xœ±Í•ÍÍ¥½¹%‘ô¤ì(€¥˜€¡…Ñ¥½¸€ôôô€µ…É­A…åµ•¹ÑI•Á½ÉÑ•œ¤É•ÑÕÉ¸¡5…É­A…åµ•¹ÑMÉ••¹Í¡½Ð¡•¹Ø±ì¸¸¹ˆ±É•%±Í•ÍÍ¥½¹%‘ô¤ì(€¥˜€¡…Ñ¥½¸€ôôô€½¹™¥ÉµA…åµ•¹Ðœ¤É•ÑÕÉ¸¡½¹™¥ÉµA…åµ•¹Ð¡•¹Ø±ì¸¸¹ˆ±É•%±Í•ÍÍ¥½¹%‘ô¤ì(€¥˜€¡…Ñ¥½¸€ôôô€…¹•±U¹Á…¥œ¤É•ÑÕÉ¸¡‘µ¥¹…¹•±I•œ¡•¹Ø±ì¸¸¹ˆ±É•%±Í•ÍÍ¥½¹%‘ô¤ì(€¥˜€¡…Ñ¥½¸€ôôô€É•µ¥¹‘A…åµ•¹Ðœ¤É•ÑÕÉ¸¡M•¹‘A…åµ•¹ÑI•µ¥¹‘•È¡•¹Ø±ì¸¸¹ˆ±É•%±Í•ÍÍ¥½¹%‘ô¤ì(€¥˜€¡…Ñ¥½¸€ôôô€¡•­¥¸œ¤É•ÑÕÉ¸¡¡•­¥¸¡•¹Ø±ì¸¸¹ˆ±É•%±Í•ÍÍ¥½¹%‘ô¤ì(€¥˜€¡…Ñ¥½¸€ôôô€Õ¹‘½¡•­¥¸œ¤É•ÑÕÉ¸¡¡•­¥¸¡•¹Ø±ì¸¸¹ˆ±É•%±Í•ÍÍ¥½¹%±Õ¹‘¼éÑÉÕ•ô¤ì(€¥˜€¡…Ñ¥½¸€ôôô€µ…É­U¹Á…¥œ¤ì(€€€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°™¥¹…¹”œ±Í•ÍÍ¥½¹%¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€€€¥˜€¡¥ÍA…¥‘MÑ…ÑÕÌ¡}Á…åMÑ…ÑÕÌ¡É•œ¤¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–ÞËžæÏ¢Êï¢ÎšZg’â7–>¿žnÓš:—šRç–n{šr«žæÏ¢Êï¾ò3¢®/¢ÖÃ¦¢Êïš"[’êë–Þ—š‚‡š¶šÖž¢,œ¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥õ€±íÁ…åµ•¹Ñ}ÍÑ…ÑÕÌèŸšr«žæÏ¢Êìô¤ì(€€€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì(€ô(€É•ÑÕÉ¸©Í½¹ÉÈ Ÿšr«ž~—šN7’ös¾òhœ­…Ñ¥½¸¤ì)ô((¼¼µ…É­±•…Ë¾ò#–ÞËšâ–‚Ó¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡5…É­±•…È¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°¡•­¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•ÐõÉ•Ù¥•Ý}ÍÑ…ÑÕÌ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌ±ÑÉ…¹Í™•É}ÍÑ…ÑÕÍ€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€¥˜€¡MÑÉ¥¹œ¡É•œ¹É•Ù¥•Ý}ÍÑ…ÑÕÍñðœœ¤€„ôô€Ÿ–ÞË¦2–>Xœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–Âkšr«¦2–>[¾ò3’â7¢÷šâ–‚Ðœ¤ì(€¥˜€ „¡¥Í	½½­¥¹M•ÕÉ•‘MÑ…ÑÕÌ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤ñðMÑÉ¥¹œ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ¤€ôôô€Ÿ–7¢Êìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–Âkšr«–º3š"C–þ¢š’îcš²û¾ò3’â7¢÷šâ–‚Ðœ¤ì(€¥˜€¡lŸžRÏ¢®/¦¢Êìœ°Ÿ–ÞË¦¢Êìt¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË¦Ë–—¦¢ÊïšÖž¢/¾ò3’â7¢÷šâ–‚Ðœ¤ì(€½¹ÍÐ‘…Ñ„€ôí±•…É}ÍÑ…ÑÕÌèŸ–ÞËšâ–‚Ðôì(€¥˜€¡ˆ¹É•™Õ¹‘•¤‘…Ñ„¹‘•Á½Í¥Ñ}É•™Õ¹‘•ôŸ–ÞË¦š*ó¦Dœì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±‘…Ñ„¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô((¼¼Í•¹‘9½Ñ¥™ä)…Íå¹Œ™Õ¹Ñ¥½¸¡M•¹‘9½Ñ¥™ä¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€½¹ÍÐ½¬€ô€¡…Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°É•Ù¥•Üœ¤¥ñð¡…Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°…¹¹½Õ¹”œ¤¤ì(€¥˜€ …½¬¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€±•ÐÅÌ€ôÑ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðõ•µ…¥°±¹…µ”±É•Ù¥•Ý}ÍÑ…ÑÕÍ€ì(€¥˜€¡ˆ¹Í•ÍÍ¥½¹%¤ÅÌ¬õ€™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥õ€ì(€¥˜€¡ˆ¹É•%¤ÅÌ¬õ€™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥õ€ì(€±•ÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±ÅÌ¤ì(€¥˜€¡ˆ¹Ñ…É•Ð˜™ˆ¹Ñ…É•Ð„ôô…±°œ¤É½ÝÌõÉ½ÝÌ¹™¥±Ñ•È¡ÈôùÈ¹É•Ù¥•Ý}ÍÑ…ÑÕÌôôõˆ¹Ñ…É•Ð¤ì(€±•ÐÍ•¹ÐôÀ°Í­¥ÁÁ•ôÀì(€½¹ÍÐÑŒ€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€™½È€¡½¹ÍÐÈ½˜É½ÝÌ¤¥˜¡È¹•µ…¥°¤ì(€€€ÑÉäì(€€€€€½¹ÍÐ‘¸€ô•Ñ¥ÍÁ±…å9…µ”¡È¹¹…µ”°È¹‰É…¹‘}¹…µ•ñðœœ°€œœ¤ì(€€€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥ÐÍ•¹‘Q•µÁ±…Ñ•µ…¥°¡•¹Ø°Q99P°€ÕÍÑ½µ}¹½Ñ¥”œ°È¹•µ…¥°°ì(€€€€€€€€Ÿ’âï¢ú›–B7ž¢ÄœèÑŒ¹¹…µ”ñð11	-}Q99Q}95°(€€€€€€€€Ÿ¦†¿ž’ë–B7ž¢Äœè‘¸ñðÈ¹¹…µ”ñð€œœ°(€€€€€€€€Ÿ¦kž~—–Ÿ–ºäœèˆ¹½¹Ñ•¹Ðñðˆ¹µ•ÍÍ…”ñð€œœ°(€€€€€€€€Ÿ–‚Óš²‡–B7ž¢Äœèˆ¹Í•ÍÍ¥½¹9…µ”ñð€œœ°(€€€€€ô°ÑŒ°È¹¥°íÑ…É•Ñ%éÈ¹¥±Ñ…É•ÑQ…‰±”èÉ•¥ÍÑÉ…Ñ¥½¹Ìœ±…Ñ½Éµ…¥°éˆ¹•µ…¥±ñðœœ±…Ñ½ÉI½±”è…¹¹½Õ¹”ô¤ì(€€€€€¥˜€¡É•ÍÕ±Ð€˜˜É•ÍÕ±Ð¹Í­¥ÁÁ•¤Í­¥ÁÁ•¬¬ì•±Í”¥˜¡É•ÍÕ±Ð€˜˜É•ÍÕ±Ð¹½¬¤Í•¹Ð¬¬ì(€€€ô…Ñ íô(€ô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°Í•¹Ð°Í­¥ÁÁ•‘ô¤ì)ô((¼¼É•Í•¹‘%¹Ù¥Ñ”)…Íå¹Œ™Õ¹Ñ¥½¸¡I•Í•¹‘%¹Ù¥Ñ”¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°ÍÑ…™˜œ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Ñ…É•Ñµ…¥°¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ãš¶“žº‡žB–N„œ¤ì(€½¹ÍÐÌõÉ½ÝÍlÁtì(€½¹ÍÐ±ÌõÌ¹±¥µ¥Ñ}Í•ÍÍ¥½¹ÌýMÑÉ¥¹œ¡Ì¹±¥µ¥Ñ}Í•ÍÍ¥½¹Ì¤¹ÍÁ±¥Ð œ°œ¤¹™¥±Ñ•È¡	½½±•…¸¤émtì(€½¹ÍÐÑŒ€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€½¹ÍÐ¥¹Ù¥Ñ”õ…Ý…¥ÐÁÉ•Á…É•MÑ…™™%¹Ù¥Ñ”¡•¹Ø±í…ÍÍ¥¹µ•¹ÑQåÁ”èÑ•¹…¹Ðœ±…ÍÍ¥¹µ•¹Ñ%éÌ¹¥±Ñ•¹…¹Ñ%éQ99P±•µ…¥°éÌ¹•µ…¥°±É½±”éÌ¹¹½Éµ…±¥é•‘}É½±•ññÌ¹É½±•ô¤ì(€ÑÉäì…Ý…¥Ðµ…¥±MÑ…™™%¹Ù¥Ñ”¡•¹Ø±Ì¹•µ…¥°±Ì¹¹…µ•ñðœœ±Ì¹É½±•ñðŸšÒï–.W–’—’òÐœ±Í…™•)Í½¸¡Ì¹Á•ÉµÍ}©Í½¸±íô¤±±Ì±ÑŒ±¥¹Ù¥Ñ”¹ÕÉ°¤ìô…Ñ ¡”¤ìÉ•ÑÕÉ¸©Í½¹ÉÈ Ÿ–¾’þ‡–’ÇšV_¾òhœ­”¹µ•ÍÍ…”¤ìô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥¹Ù¥Ñ…Ñ¥½¹MÑ…ÑÕÌéÌ¹Á±…Ñ™½Éµ}µ•µ‰•É}¥ü…•ÁÑ•œèÁ•¹‘¥¹œô¤ì)ô()™Õ¹Ñ¥½¸¹½Éµ…±¥é•MÑ…™™I½±•%¹ÁÕÐ¡É½±”¤ì(€½¹ÍÐÈ€ôMÑÉ¥¹œ¡É½±”ñð€œœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐµ…À€ôì(€€€€ÍÕÁ•É…‘µ¥¸œèÁ±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ°(€€€€Ÿ¢ÚžÒkžº‡žB–N„œèÁ±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ°(€€€€ŸšÒï–.W–’—’òÐœè½É…¹¥é•É}…‘µ¥¸œ°(€€€€Ÿ–Ç–&×–’—’òÐœè½É…¹¥é•É}…‘µ¥¸œ°(€€€€ÍÑ…™˜œè½É…¹¥é•É}…‘µ¥¸œ°(€€€€½É…¹¥é•É}…‘µ¥¸œè½É…¹¥é•É}…‘µ¥¸œ°(€€€€Ÿ’âï¢ú˜œè½É…¹¥é•É}½Ý¹•Èœ°(€€€€Ÿ’âï¢ú›¢œè½É…¹¥é•É}½Ý¹•Èœ°(€€€€½É…¹¥é•É}½Ý¹•Èœè½É…¹¥é•É}½Ý¹•Èœ°(€€€€Ÿ–‚Óš²‡žº‡žB–N„œèÍ•ÍÍ¥½¹}…‘µ¥¸œ°(€€€€Í•ÍÍ¥½¹}…‘µ¥¸œèÍ•ÍÍ¥½¹}…‘µ¥¸œ°(€€€€Ÿ¢Ê‡–.gžº‡žB–N„œè™¥¹…¹•}…‘µ¥¸œ°(€€€€™¥¹…¹•}…‘µ¥¸œè™¥¹…¹•}…‘µ¥¸œ°(€€€€Ÿž>û–‚Ó’êë–N„œè½¹Í¥Ñ•}ÍÑ…™˜œ°(€€€€½¹Í¥Ñ•}ÍÑ…™˜œè½¹Í¥Ñ•}ÍÑ…™˜œ(€ôì(€É•ÑÕÉ¸µ…ÁmÉtñðÈñð€½É…¹¥é•É}…‘µ¥¸œì)ô()…Íå¹Œ™Õ¹Ñ¥½¸Íå¹MÑ…™™M•ÍÍ¥½¹A•Éµ¥ÍÍ¥½¹Ì¡•¹Ø°Ñ•¹…¹Ñ%°ÍÑ…™™µ…¥°°Í•ÍÍ¥½¹%‘Ì¤ì(€½¹ÍÐ¥‘Ì€ô€¡Í•ÍÍ¥½¹%‘Íññmt¤¹µ…À¡àôùMÑÉ¥¹œ¡áñðœœ¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°€ÍÑ…™™}Í•ÍÍ¥½¹}Á•Éµ¥ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™ÍÑ…™™}•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÍÑ…™™µ…¥°¥õ€¤¹…Ñ   ¤ôùíô¤ì(€™½È€¡½¹ÍÐÍ¥½˜¥‘Ì¤ì(€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€ÍÑ…™™}Í•ÍÍ¥½¹}Á•Éµ¥ÍÍ¥½¹Ìœ°ì(€€€€€¥è•¹% MM@œ¤°Ñ•¹…¹Ñ}¥èÑ•¹…¹Ñ%°ÍÑ…™™}•µ…¥°èÍÑ…™™µ…¥°°Í•ÍÍ¥½¹}¥èÍ¥°(€€€€€…¹}Ù¥•ÜèÑÉÕ”°…¹}¡•­¥¸èÑÉÕ”°…¹}µ…É­}…‰Í•¹ÐèÑÉÕ”°…¹}¹½Ñ”èÑÉÕ”°…¹}µ…É­}É•™Õ¹‘}™±…œèÑÉÕ”°(€€€€€¥Í}…Ñ¥Ù”èÑÉÕ”°É•…Ñ•‘}…Ðè¹½Ý%Í¼ ¤°ÕÁ‘…Ñ•‘}…Ðè¹½Ý%Í¼ ¤(€€€ô¤¹…Ñ   ¤ôùíô¤ì(€ô)ô((¼¼…‘‘MÑ…™˜)…Íå¹Œ™Õ¹Ñ¥½¸¡‘‘MÑ…™˜¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÑ…É•Ñµ…¥°õ¹½Éµµ…¥°¡ˆ¹Ñ…É•Ñµ…¥°¤±Ñ…É•Ñ9…µ”õMÑÉ¥¹œ¡ˆ¹Ñ…É•Ñ9…µ•ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …Ñ…É•Ñµ…¥±ñð„½ymyqÍt­myqÍt­p¹myqÍt¬¼¹Ñ•ÍÐ¡Ñ…É•Ñµ…¥°¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¢òã–—š¶žŠëžjµ…¥°œ¤ì(€½¹ÍÐ•à€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°ÍÑ…™˜œ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ…É•Ñµ…¥°¥ô™Í•±•Ðô©€¤ì(€½¹ÍÐ¹½Éµ…±¥é•‘I½±”€ô¹½Éµ…±¥é•MÑ…™™I½±•%¹ÁÕÐ¡ˆ¹É½±”ñð€½É…¹¥é•É}…‘µ¥¸œ¤ì(€¥˜ …l½É…¹¥é•É}…‘µ¥¸œ°Í•ÍÍ¥½¹}…‘µ¥¸œ°™¥¹…¹•}…‘µ¥¸œ°½¹Í¥Ñ•}ÍÑ…™˜t¹¥¹±Õ‘•Ì¡¹½Éµ…±¥é•‘I½±”¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦g–/¢žK¢&Ë’â7¢÷žRÇžžš"ÛšZÃ–Šxœ¤ì(€½¹ÍÐ‘¥ÍÁ±…åI½±”€ô¹½Éµ…±¥é•‘I½±”ì(€½¹ÍÐÁ•ÉµÌ€ôˆ¹Á•ÉµÌñð€¡¹½Éµ…±¥é•‘I½±”€ôôô€½¹Í¥Ñ•}ÍÑ…™˜œ€üí¡•­¥¸éÑÉÕ•ô€èíô¤ì(€€¼¼ƒš:#š²+ž¾–r7¾òi…±³¾ò#–£¦£¾ò$¼•Ù•¹Ó¾ò#šVÓ–/žÎï–"_¾ò$¼Í•ÍÍ¥½»¾ò#š2–ºk–‚Óš²‡¾ò$(€½¹ÍÐÍ½Á•QåÁ”€ôl…±°œ°•Ù•¹Ðœ°Í•ÍÍ¥½¸t¹¥¹±Õ‘•Ì¡ˆ¹Í½Á•QåÁ”¤€üˆ¹Í½Á•QåÁ”€è€…±°œì(€½¹ÍÐÍ½Á•Ù•¹Ñ%€ôÍ½Á•QåÁ”ôôô•Ù•¹Ðœ€üMÑÉ¥¹œ¡ˆ¹Í½Á•Ù•¹Ñ%‘ñðœœ¤¹ÑÉ¥´ ¤€è€œœì(€½¹ÍÐÍÑ…™™%õ•álÁtü¹¥‘ññÉåÁÑ¼¹É…¹‘½µUU% ¤ì(€½¹ÍÐ‘…Ñ„õì(€€€•µ…¥°éÑ…É•Ñµ…¥°°(€€€Ñ•¹…¹Ñ}¥éQ99P°(€€€¹…µ”éÑ…É•Ñ9…µ”°(€€€‘¥ÍÁ±…å}¹…µ”éÑ…É•Ñ9…µ”°(€€€É½±”é‘¥ÍÁ±…åI½±”°(€€€¹½Éµ…±¥é•‘}É½±”é¹½Éµ…±¥é•‘I½±”°(€€€É½±•}¥é¹Õ±°°(€€€Á•ÉµÍ}©Í½¸é)M=8¹ÍÑÉ¥¹¥™ä¡Á•ÉµÌ¤°(€€€±¥µ¥Ñ}Í•ÍÍ¥½¹Ìè¡ˆ¹±¥µ¥ÑM•ÍÍ¥½¹Íññmt¤¹©½¥¸ œ°œ¤°(€€€Í½Á•}ÑåÁ”éÍ½Á•QåÁ”°(€€€Í½Á•}•Ù•¹Ñ}¥éÍ½Á•Ù•¹Ñ%°(€€€…Ñ¥Ù”éÑÉÕ”°(€€€¥Í}…Ñ¥Ù”éÑÉÕ”°(€€€ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¤°(€ôì(€¥˜¡•álÁt¥ì(€€€¥˜¡•álÁt¹Á±…Ñ™½Éµ}µ•µ‰•É}¥¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“’êë–ÞËšb¿žº‡žB¢¾ò3–>¿žnÓš:—–r£’â/šZç¢ªÿšVÓ¢žK¢&Ë¢"–‚Óš²„œ¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…™˜œ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ÍÑ…™™%¥õ€±‘…Ñ„¤ì(€õ•±Í”…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°ÍÑ…™˜œ±í¥éÍÑ…™™%°¸¸¹‘…Ñ…ô¤ì(€…Ý…¥ÐÍå¹MÑ…™™M•ÍÍ¥½¹A•Éµ¥ÍÍ¥½¹Ì¡•¹Ø°Q99P°Ñ…É•Ñµ…¥°°ˆ¹±¥µ¥ÑM•ÍÍ¥½¹Íññmt¤ì(€½¹ÍÐÑMÑ…™˜€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€½¹ÍÐ¥¹Ù¥Ñ”õ…Ý…¥ÐÁÉ•Á…É•MÑ…™™%¹Ù¥Ñ”¡•¹Ø±í…ÍÍ¥¹µ•¹ÑQåÁ”èÑ•¹…¹Ðœ±…ÍÍ¥¹µ•¹Ñ%éÍÑ…™™%±Ñ•¹…¹Ñ%éQ99P±•µ…¥°éÑ…É•Ñµ…¥°±É½±”é¹½Éµ…±¥é•‘I½±•ô¤ì(€±•ÐÍ•¹ÐõÑÉÕ”íÑÉäì½¹ÍÐµ…¥°õ…Ý…¥Ðµ…¥±MÑ…™™%¹Ù¥Ñ”¡•¹Ø±Ñ…É•Ñµ…¥°±Ñ…É•Ñ9…µ”±‘¥ÍÁ±…åI½±”±Á•ÉµÌ±ˆ¹±¥µ¥ÑM•ÍÍ¥½¹Íññmt±ÑMÑ…™˜±¥¹Ù¥Ñ”¹ÕÉ°¤íÍ•¹Ðô„„¡µ…¥°˜™µ…¥°¹½¬˜˜…µ…¥°¹Í­¥ÁÁ•¤ìô…Ñ ìÍ•¹Ðõ™…±Í”ô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥¹Ù¥Ñ…Ñ¥½¹MÑ…ÑÕÌèÁ•¹‘¥¹œœ±•µ…¥±M•¹ÐéÍ•¹Ñô¤ì)ô(¼¼Í•ÑMÑ…™™Ñ¥Ù—¾ò#¦Z/šRû¾ò?¦^s¦Z'–âÏ¢f¾ò3’þwžVg’êë–N‡¢ÎšZg¢"–‚Óš²‡š²+¦fC¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡M•ÑMÑ…™™Ñ¥Ù”¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜€ …ˆ¹Ñ…É•Ñµ…¥°¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÑ…É•Ñµ…¥°œ¤ì(€½¹ÍÐ…Ñ¥Ù”€ôˆ¹…Ñ¥Ù”€ôôôÑÉÕ”ñðˆ¹…Ñ¥Ù”€ôôô€ÑÉÕ”œñðˆ¹…Ñ¥Ù”€ôôô€Äñðˆ¹…Ñ¥Ù”€ôôô€œÄœì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…™˜œ±•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Ñ…É•Ñµ…¥°¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±ì(€€€¥Í}…Ñ¥Ù”é…Ñ¥Ù”°(€€€…Ñ¥Ù”é…Ñ¥Ù”°(€€€ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¤°(€ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°…Ñ¥Ù•ô¤ì)ô((¼¼É•µ½Ù•MÑ…™˜)…Íå¹Œ™Õ¹Ñ¥½¸¡I•µ½Ù•MÑ…™˜¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜€ …ˆ¹Ñ…É•Ñµ…¥°¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÑ…É•Ñµ…¥°œ¤ì(€¥˜€¡MÑÉ¥¹œ¡ˆ¹Ñ…É•Ñµ…¥°¤¹Ñ½1½Ý•É…Í” ¤€ôôôMÑÉ¥¹œ¡ˆ¹•µ…¥°¤¹Ñ½1½Ý•É…Í” ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ’â7¢÷–"«¦f“žn»–&7žfï–—’â·žj¢«–ÞÄœ¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°ÍÑ…™˜œ±•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Ñ…É•Ñµ…¥°¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô(¼¼ÕÁ‘…Ñ•MÑ…™™A•ÉµÌ)…Íå¹Œ™Õ¹Ñ¥½¸¡UÁ‘…Ñ•MÑ…™™A•ÉµÌ¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…™˜œ±•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Ñ…É•Ñµ…¥°¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±íÁ•ÉµÍ}©Í½¸é)M=8¹ÍÑÉ¥¹¥™ä¡ˆ¹Á•ÉµÍññíô¥ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô(¼¼ÕÁ‘…Ñ•MÑ…™™M•ÍÍ¥½¹Ì)…Íå¹Œ™Õ¹Ñ¥½¸¡UÁ‘…Ñ•MÑ…™™M•ÍÍ¥½¹Ì¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ•ÍÍ¥½¹Ì€ôˆ¹Í•ÍÍ¥½¹Ìñðˆ¹Í•ÍÍ¥½¹%‘Ìñðmtì(€½¹ÍÐÍ½Á•QåÁ”€ôˆ¹Í½Á•QåÁ”ñðˆ¹Í½Á•}ÑåÁ”ñð€…±°œì(€½¹ÍÐÍ½Á•Ù•¹Ñ%€ô€¡Í½Á•QåÁ”€ôôô€•Ù•¹Ðœ¤€ü€¡ˆ¹Í½Á•Ù•¹Ñ%ñðˆ¹Í½Á•}•Ù•¹Ñ}¥ñð€œœ¤€è€œœì(€½¹ÍÐÍÑ…™™UÁ€ôí±¥µ¥Ñ}Í•ÍÍ¥½¹ÌéÍ•ÍÍ¥½¹Ì¹©½¥¸ œ°œ¤°Í½Á•}ÑåÁ”éÍ½Á•QåÁ”°Í½Á•}•Ù•¹Ñ}¥éÍ½Á•Ù•¹Ñ%°ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ôì(€¥˜€¡ˆ¹É½±”¤ìÍÑ…™™UÁ¹¹½Éµ…±¥é•‘}É½±”€ôˆ¹É½±”ìÍÑ…™™UÁ¹É½±”€ôˆ¹É½±”ìô(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…™˜œ±•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Ñ…É•Ñµ…¥°¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±ÍÑ…™™UÁ¤ì(€…Ý…¥ÐÍå¹MÑ…™™M•ÍÍ¥½¹A•Éµ¥ÍÍ¥½¹Ì¡•¹Ø°Q99P°ˆ¹Ñ…É•Ñµ…¥°°Í•ÍÍ¥½¹Ì¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô((¼¼Í…Ù•¹¹½Õ¹•µ•¹Ð)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•¹¹½Õ¹•µ•¹Ð¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°…¹¹½Õ¹”œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€¥˜€¡ˆ¹¥¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°…¹¹½Õ¹•µ•¹ÑÌœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±íÑ¥Ñ±”éˆ¹Ñ¥Ñ±”±½¹Ñ•¹Ðéˆ¹½¹Ñ•¹Ññðœœ±ÕÉ°éˆ¹ÕÉ±ñðœœ±ÕÉ±}Ñ•áÐéˆ¹ÕÉ±Q•áÑñðœô¤ì(€€€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì(€ô(€½¹ÍÐ¥õ•¹% 98œ¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°…¹¹½Õ¹•µ•¹ÑÌœ±í¥±Ñ•¹…¹Ñ}¥éQ99P±Ñ¥Ñ±”éˆ¹Ñ¥Ñ±”±½¹Ñ•¹Ðéˆ¹½¹Ñ•¹Ññðœœ±ÕÉ°éˆ¹ÕÉ±ñðœœ±ÕÉ±}Ñ•áÐéˆ¹ÕÉ±Q•áÑñðœœ±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥‘ô¤ì)ô(¼¼‘•±•Ñ•¹¹½Õ¹•µ•¹Ð)…Íå¹Œ™Õ¹Ñ¥½¸¡•±•Ñ•¹¹½Õ¹•µ•¹Ð¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åA±…Ñ™½ÉµMÕÁ•É‘µ¥¸¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–"«¦f“–³–F+–¦fC–æÏ–>Ã¢ÚžÒkžº‡žB–N„œ¤ì(€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°…¹¹½Õ¹•µ•¹ÑÌœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô((¼¼Í…Ù•¥¹…¹•%Ñ•´)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•¥¹…¹•%Ñ•´¡•¹Ø±ˆ¥ìÉ•ÑÕÉ¸¡M…Ù•M•ÍÍ¥½¹…Í¡%Ñ•´¡•¹Ø±ˆ¤ìô(¼¼‘•±•Ñ•¥¹…¹•%Ñ•´)…Íå¹Œ™Õ¹Ñ¥½¸¡•±•Ñ•¥¹…¹•%Ñ•´¡•¹Ø±ˆ¥ìÉ•ÑÕÉ¸¡•±•Ñ•M•ÍÍ¥½¹…Í¡%Ñ•´¡•¹Ø±ˆ¤ìô(¼¼ÕÁ‘…Ñ•%¹Ù½¥•MÑ…ÑÕÌ)…Íå¹Œ™Õ¹Ñ¥½¸¡UÁ‘…Ñ•%¹Ù½¥•MÑ…ÑÕÌ¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±í¥¹Ù½¥•}ÍÑ…ÑÕÌéˆ¹ÍÑ…ÑÕÍô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô((¼¼Í•Ñ…ÍÑA…ÍÌ)…Íå¹Œ™Õ¹Ñ¥½¸¡M•Ñ…ÍÑA…ÍÌ¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°¡•­¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€€¼¼•µ…¥°ƒ–’Ÿ–Â?–¾¯’â7’â¢Óšr¦ƒš"CŽ3¢¢·–ºkš"C–*’ö–‚Ç–B7šfš~—’â7–"ÃŽ7žj¦vs¦îc–’ÇšV#¾ò3šV’â–ú/’â7–"–’Ÿ–Â?–¾¯š¾S–Â4(€½¹ÍÐ•´€ôMÑÉ¥¹œ¡ˆ¹Ñ…É•Ñµ…¥±ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜€ …•´¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂGšr–N„µ…¥°œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡•´¥ô™Í•±•Ðõ•µ…¥±€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ãšr–N„œ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°µ•µ‰•ÉÌœ±•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡•´¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±í™…ÍÑ}Á…ÍÌéˆ¹•¹…‰±”ýÑÉÕ”é™…±Í•ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°•¹…‰±•è„…ˆ¹•¹…‰±•ô¤ì)ô(¼¼Í…Ù•M¥Ñ•½¹™¥œ)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•M¥Ñ•½¹™¥œ¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ•á¥ÍÑ¥¹œ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°Ñ•¹…¹ÑÌœ±¥õ•Ä¸‘íQ99Qô™Í•±•Ðõ½¹™¥}©Í½¹€¤ì(€½¹ÍÐ½±‘™œ€ô•á¥ÍÑ¥¹œ¹±•¹Ñ €üÍ…™•)Í½¸¡•á¥ÍÑ¥¹lÁt¹½¹™¥}©Í½¸°íô¤€èíôì(€½¹ÍÐ½¹™¥œ€ôì¸¸¹½±‘™ôì(€¥˜€ ¡•É½%µœœ¥¸ˆ¤½¹™¥œ¹¡•É½%µœ€ôˆ¹¡•É½%µœñð€œœì(€¥˜€ ¥¹™½Q•áÐœ¥¸ˆ¤½¹™¥œ¹¥¹™½Q•áÐ€ôˆ¹¥¹™½Q•áÐñð€œœì(€¥˜€ ±½½UÉ°œ¥¸ˆ¤½¹™¥œ¹±½½UÉ°€ôˆ¹±½½UÉ°ñð€œœì(€¥˜€ ¤Äá¸œ¥¸ˆ€˜˜ˆ¹¤Äá¸€˜˜ÑåÁ•½˜ˆ¹¤Äá¸ôôô½‰©•Ðœ¤ì(€€€½¹ÍÐ±…¹ÌõÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹¤Äá¸¹±…¹Õ…•Ì¤ýˆ¹¤Äá¸¹±…¹Õ…•Ì¹µ…À¡MÑÉ¥¹œ¤¹™¥±Ñ•È¡	½½±•…¸¤élé µQ\tì(€€€¥˜ …±…¹Ì¹¥¹±Õ‘•Ì é µQ\œ¤¥±…¹Ì¹Õ¹Í¡¥™Ð é µQ\œ¤ì(€€€½¹™¥œ¹¤Äá¸õí•¹…‰±•è„…ˆ¹¤Äá¸¹•¹…‰±•±‘•™…Õ±Ñ1…¹Õ…”é±…¹Ì¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡ˆ¹¤Äá¸¹‘•™…Õ±Ñ1…¹Õ…•ñðœœ¤¤ýMÑÉ¥¹œ¡ˆ¹¤Äá¸¹‘•™…Õ±Ñ1…¹Õ…”¤èé µQ\œ±±…¹Õ…•Ìél¸¸¹¹•ÜM•Ð¡±…¹Ì¥t¹Í±¥” À°à¥ôì(€ô(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Ñ•¹…¹ÑÌœ±¥õ•Ä¸‘íQ99Qõ€±í½¹™¥}©Í½¸é)M=8¹ÍÑÉ¥¹¥™ä¡½¹™¥œ¥ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô((¼¼ƒŠRŠR ƒšr³–‚ÓšRÛš²û¢¢·–ºk¾òkšÊÿžR£š^‹šr$Ñ•¹…¹ÑÌ¹Á…åµ•¹Ñ}½¹™¥}©Í½»¾ò1ƒž
ë–R¿’â’úšê@ƒŠRŠR )™Õ¹Ñ¥½¸}Á…åµ•¹Ñ5•Ñ¡½‘Í±±½Ý•¡Ø¥ì(€½¹ÍÐàô¡Ø˜™ÑåÁ•½˜Øôôô½‰©•Ðœ¤ýØéÍ…™•)Í½¸¡Ø±íô¤ì(€É•ÑÕÉ¸í‰…¹¬éà¹‰…¹¬„ôõ™…±Í”±±¥¹•Á…äè„…à¹±¥¹•Á…ä±…Éè„…à¹…É‘ôì)ô)™Õ¹Ñ¥½¸}¹½Éµ…±¥é•A…åµ•¹Ñ=Ý¹•É5½‘”¡Ø¥ì(€½¹ÍÐÌõMÑÉ¥¹œ¡Ùñðœœ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤ì(€¥˜¡ÌôôôÁ±…Ñ™½Éµ}…•¹äññÌ¹•¹‘Í]¥Ñ  }…•¹äœ¤¥É•ÑÕÉ¸€Á±…Ñ™½Éµ}…•¹äœì(€¥˜¡ÌôôôÁ…ÉÑ¹•É}Í•±˜ññÌ¹¥¹±Õ‘•Ì Á…ÉÑ¹•Èœ¤¥É•ÑÕÉ¸€Á…ÉÑ¹•É}Í•±˜œì(€É•ÑÕÉ¸€½É…¹¥é•É}Í•±˜œì)ô)™Õ¹Ñ¥½¸}Á…åµ•¹ÑAÉ½™¥±•AÕ‰±¥Œ¡È¥ì(€¥˜ …È¥É•ÑÕÉ¸¹Õ±°ì(€½¹ÍÐ…±±½Ý•õ}Á…åµ•¹Ñ5•Ñ¡½‘Í±±½Ý•¡È¹…±±½Ý•‘}µ•Ñ¡½‘ÍññÈ¹…±±½Ý•‘5•Ñ¡½‘Íññíô¤ì(€½¹ÍÐ‰…¹¬õÈ¹‰…¹­}…½Õ¹Ñ}½‰©ññÈ¹‰…¹­½Õ¹Ñññíôì(€É•ÑÕÉ¸ì(€€€¥éÈ¹¥‘ñðœœ±¹…µ”éÈ¹¹…µ•ñðœœ±µ½‘”é}¹½Éµ…±¥é•A…åµ•¹Ñ=Ý¹•É5½‘”¡È¹µ½‘”¤±½Ý¹•É9…µ”éÈ¹½Ý¹•É}¹…µ•ññÈ¹½Ý¹•É9…µ•ñðœœ°(€€€¥Í•™…Õ±ÐéÈ¹¥Í}‘•™…Õ±ÐôôõÑÉÕ•ññÈ¹¥Í•™…Õ±ÐôôõÑÉÕ”±¥Í¹…‰±•éÈ¹¥Í}•¹…‰±•„ôõ™…±Í”˜™È¹¥Í¹…‰±•„ôõ™…±Í”°(€€€…±±½Ý•‘5•Ñ¡½‘Ìé…±±½Ý•°(€€€‰…¹­½Õ¹Ðéí‰…¹­9…µ”éÈ¹‰…¹­}¹…µ•ññ‰…¹¬¹‰…¹­9…µ•ñðœœ±‰É…¹¡9…µ”éÈ¹‰…¹­}‰É…¹¡ññ‰…¹¬¹‰É…¹¡9…µ•ñðœœ±…½Õ¹Ñ9…µ”éÈ¹…½Õ¹Ñ}¹…µ•ññ‰…¹¬¹…½Õ¹Ñ9…µ•ñðœœ±…½Õ¹Ñ9Õµ‰•ÈéÈ¹‰…¹­}…½Õ¹Ñññ‰…¹¬¹…½Õ¹Ñ9Õµ‰•Éñðœô°(€€€±¥¹•Á…äéí‘¥ÍÁ±…å9…µ”éÈ¹±¥¹•Á…å}‘¥ÍÁ±…å}¹…µ•ñð¡È¹±¥¹•Á…ä˜™È¹±¥¹•Á…ä¹‘¥ÍÁ±…å9…µ”¥ñðœœ±ÕÉ°éÈ¹±¥¹•Á…å}ÕÉ±ñð¡È¹±¥¹•Á…ä˜™È¹±¥¹•Á…ä¹ÕÉ°¥ñðœô°(€€€…Ééí‘¥ÍÁ±…å9…µ”éÈ¹…É‘}‘¥ÍÁ±…å}¹…µ•ñð¡È¹…É˜™È¹…É¹‘¥ÍÁ±…å9…µ”¥ñðœœ±ÕÉ°éÈ¹…É‘}ÕÉ±ñð¡È¹…É˜™È¹…É¹ÕÉ°¥ñðœô°(€€€¹½Ñ”éÈ¹¹½Ñ•ñðœœ±ÕÁ‘…Ñ•‘ÐéÈ¹ÕÁ‘…Ñ•‘}…ÑññÈ¹ÕÁ‘…Ñ•‘Ññðœœ±É•…Ñ•‘ÐéÈ¹É•…Ñ•‘}…ÑññÈ¹É•…Ñ•‘Ññðœœ(€ôì)ô)™Õ¹Ñ¥½¸}Á…åµ•¹ÑAÉ½™¥±•I½ÝÉ½µ	½‘ä¡ˆ±Q99P±¥¥ì(€É•ÑÕÉ¸ì(€€€¥°(€€€¹…µ”éMÑÉ¥¹œ¡ˆ¹¹…µ•ñðœœ¤¹ÑÉ¥´ ¥ñðŸšRÛš²û¢¢·–ºhœ°(€€€µ½‘”é}¹½Éµ…±¥é•A…åµ•¹Ñ=Ý¹•É5½‘”¡ˆ¹µ½‘”¤°(€€€½Ý¹•É}¹…µ”éMÑÉ¥¹œ¡ˆ¹½Ý¹•É9…µ•ññˆ¹½Ý¹•É}¹…µ•ñðœœ¤¹ÑÉ¥´ ¤°(€€€…±±½Ý•‘}µ•Ñ¡½‘Ìé}Á…åµ•¹Ñ5•Ñ¡½‘Í±±½Ý•¡ˆ¹…±±½Ý•‘5•Ñ¡½‘Íññˆ¹…±±½Ý•‘}µ•Ñ¡½‘Íññíô¤°(€€€‰…¹­}¹…µ”éMÑÉ¥¹œ¡ˆ¹‰…¹­9…µ•ññˆ¹‰…¹­}¹…µ•ñðœœ¤¹ÑÉ¥´ ¤°(€€€‰…¹­}‰É…¹ éMÑÉ¥¹œ¡ˆ¹‰…¹­	É…¹¡ññˆ¹‰…¹­}‰É…¹¡ñðœœ¤¹ÑÉ¥´ ¤°(€€€…½Õ¹Ñ}¹…µ”éMÑÉ¥¹œ¡ˆ¹…½Õ¹Ñ9…µ•ññˆ¹…½Õ¹Ñ}¹…µ•ñðœœ¤¹ÑÉ¥´ ¤°(€€€‰…¹­}…½Õ¹ÐéMÑÉ¥¹œ¡ˆ¹‰…¹­½Õ¹Ñññˆ¹‰…¹­}…½Õ¹Ññðœœ¤¹ÑÉ¥´ ¤°(€€€±¥¹•Á…å}‘¥ÍÁ±…å}¹…µ”éMÑÉ¥¹œ¡ˆ¹±¥¹•Á…å¥ÍÁ±…å9…µ•ññˆ¹±¥¹•Á…å}‘¥ÍÁ±…å}¹…µ•ñðœœ¤¹ÑÉ¥´ ¤°(€€€±¥¹•Á…å}ÕÉ°éMÑÉ¥¹œ¡ˆ¹±¥¹•Á…åUÉ±ññˆ¹±¥¹•Á…å}ÕÉ±ñðœœ¤¹ÑÉ¥´ ¤°(€€€…É‘}‘¥ÍÁ±…å}¹…µ”éMÑÉ¥¹œ¡ˆ¹…É‘¥ÍÁ±…å9…µ•ññˆ¹…É‘}‘¥ÍÁ±…å}¹…µ•ñðœœ¤¹ÑÉ¥´ ¤°(€€€…É‘}ÕÉ°éMÑÉ¥¹œ¡ˆ¹…É‘UÉ±ññˆ¹…É‘}ÕÉ±ñðœœ¤¹ÑÉ¥´ ¤°(€€€¹½Ñ”éMÑÉ¥¹œ¡ˆ¹¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤°(€€€¥Í}‘•™…Õ±Ðè„…ˆ¹¥Í•™…Õ±Ññð„…ˆ¹¥Í}‘•™…Õ±Ð°(€€€¥Í}•¹…‰±•è„¡ˆ¹¥Í¹…‰±•ôôõ™…±Í•ññˆ¹¥Í}•¹…‰±•ôôõ™…±Í”¤°(€€€ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¤(€ôì)ô)…Íå¹Œ™Õ¹Ñ¥½¸}±½…‘Q•¹…¹ÑA…åµ•¹Ñ½¹™¥œ¡•¹Ø±Q99P¥ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Ñ•¹…¹ÑÌœ±¥õ•Ä¸‘íQ99Qô™Í•±•Ðõ¹…µ”±Á…åµ•¹Ñ}½¹™¥}©Í½¸±‰…¹­}¥¹™¼±±¥¹•}ÕÉ±€¤¹…Ñ   ¤ôùmt¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿš&û’â7–"Ãžžš"ÛšRÛš²û¢¢·–ºhœ¤ì(€É•ÑÕÉ¸íÑ•¹…¹ÐéÉ½ÝÍlÁt±™œéÍ…™•)Í½¸¡É½ÝÍlÁt¹Á…åµ•¹Ñ}½¹™¥}©Í½¸±íô¥ôì)ô)™Õ¹Ñ¥½¸}±•…åA…åµ•¹ÑAÉ½™¥±•É½µ½¹™¥œ¡Q99P±Ñ•¹…¹Ð±™œ¥ì(€½¹ÍÐÁ´õÉÉ…ä¹¥ÍÉÉ…ä¡™œ¹Á…å5•Ñ¡½‘Ì¤ý™œ¹Á…å5•Ñ¡½‘Ìémtì(€½¹ÍÐ±Àõ™œ¹±¥¹•A…åQ•áÑññ™œ¹±¥¹•A…åññ™œ¹±¥¹•A…åUÉ±ññ™œ¹±¥¹•}Á…å}ÕÉ±ñð¡Á´¹™¥¹¡´ôø½±¥¹”½¤¹Ñ•ÍÐ¡MÑÉ¥¹œ¡´˜™´¹¹…µ•ñðœœ¤¤¥ññíô¤¹ÕÉ±ñðœœì(€½¹ÍÐÀõ™œ¹É•‘¥Ñ…É‘Q•áÑññ™œ¹É•‘¥Ñ…É‘ññ™œ¹…É‘A…åUÉ±ññ™œ¹É•‘¥Ñ…É‘UÉ±ññ™œ¹•Á…åUÉ±ññ™œ¹…É‘ññ™œ¹…É‘}Á…å}ÕÉ±ñð¡Á´¹™¥¹¡´ôø¿’þ‡žR¡ó–"ß–6…ñ…É‘óžÚƒžV0½¤¹Ñ•ÍÐ¡MÑÉ¥¹œ¡´˜™´¹¹…µ•ñðœœ¤¤¥ññíô¤¹ÕÉ±ñðœœì(€½¹ÍÐ…Ðõ™œ¹‰…¹­½Õ¹Ñññ™œ¹…½Õ¹Ññðœœì(€É•ÑÕÉ¸ì(€€€¥èÑ•¹…¹Ñ}‘•™…Õ±Ðœ±¹…µ”é™œ¹ÁÉ½™¥±•9…µ•ññ™œ¹Á…åµ•¹ÑAÉ½™¥±•9…µ•ñðŸ’âï¢ú›ž¦ë¦ZO¦‚C¢¢·šRÛš²øœ°(€€€µ½‘”é}¹½Éµ…±¥é•A…åµ•¹Ñ=Ý¹•É5½‘”¡™œ¹Á…åµ•¹Ñ=Ý¹•É5½‘•ññ™œ¹µ½‘”¤±½Ý¹•É}¹…µ”é™œ¹½Ý¹•É9…µ•ññÑ•¹…¹Ð¹¹…µ•ñðœœ°(€€€…±±½Ý•‘}µ•Ñ¡½‘Ìéí‰…¹¬è„……Ññð …±À˜˜…À¤±±¥¹•Á…äè„…±À±…Éè„…Áô°(€€€‰…¹­}¹…µ”é™œ¹‰…¹­9…µ•ññ™œ¹‰…¹­ñðœœ±‰…¹­}‰É…¹ é™œ¹‰…¹­	É…¹¡ññ™œ¹‰É…¹¡ñðœœ°(€€€…½Õ¹Ñ}¹…µ”é™œ¹…½Õ¹Ñ9…µ•ññ™œ¹…½Õ¹Ñ}¹…µ•ñðœœ±‰…¹­}…½Õ¹Ðé…Ð°(€€€±¥¹•Á…å}‘¥ÍÁ±…å}¹…µ”é±Àü1%9A…äœèœœ±±¥¹•Á…å}ÕÉ°é±À°(€€€…É‘}‘¥ÍÁ±…å}¹…µ”éÀüŸ’þ‡žR£–6„œèœœ±…É‘}ÕÉ°éÀ°(€€€¹½Ñ”é™œ¹Á…åµ•¹Ñ9½Ñ•ññ™œ¹¹½Ñ•ññÑ•¹…¹Ð¹‰…¹­}¥¹™½ñðœœ±¥Í}‘•™…Õ±ÐéÑÉÕ”±¥Í}•¹…‰±•éÑÉÕ”°(€€€É•…Ñ•‘}…Ðé™œ¹É•…Ñ•‘Ññðœœ±ÕÁ‘…Ñ•‘}…Ðé™œ¹ÕÁ‘…Ñ•‘Ññðœœ(€ôì)ô)™Õ¹Ñ¥½¸}ÁÉ½™¥±•ÍÉ½µA…åµ•¹Ñ½¹™¥œ¡Q99P±Ñ•¹…¹Ð±™œ¥ì(€½¹ÍÐÉ…ÜõÉÉ…ä¹¥ÍÉÉ…ä¡™œ¹ÁÉ½™¥±•Ì¤ý™œ¹ÁÉ½™¥±•Ìè¡ÉÉ…ä¹¥ÍÉÉ…ä¡™œ¹Á…åµ•¹ÑAÉ½™¥±•Ì¤ý™œ¹Á…åµ•¹ÑAÉ½™¥±•Ìémt¤ì(€½¹ÍÐÉ½ÝÌõÉ…Ü¹µ…À¡àôø¡ì¸¸¹à±¥éMÑÉ¥¹œ¡à˜™à¹¥‘ñðœœ¤¹ÑÉ¥´ ¤±¥Í}‘•™…Õ±Ðè„„¡à˜˜¡à¹¥Í}‘•™…Õ±ÐôôõÑÉÕ•ññà¹¥Í•™…Õ±ÐôôõÑÉÕ”¤¤±¥Í}•¹…‰±•è„¡à˜˜¡à¹¥Í}•¹…‰±•ôôõ™…±Í•ññà¹¥Í¹…‰±•ôôõ™…±Í”¤¥ô¤¤¹™¥±Ñ•È¡àôùà¹¥¤ì(€É•ÑÕÉ¸É½ÝÌ¹±•¹Ñ ýÉ½ÝÌém}±•…åA…åµ•¹ÑAÉ½™¥±•É½µ½¹™¥œ¡Q99P±Ñ•¹…¹Ð±™œ¥tì)ô)…Íå¹Œ™Õ¹Ñ¥½¸}Í••‘•™…Õ±ÑA…åµ•¹ÑAÉ½™¥±•%™9••‘•¡•¹Ø±Q99P¥ì(€€¼¼ƒžnã–ºçš^‹šr'–Fó–>¯–B7ž¢Ç¾òo–>«¢ºš^‹šr$)M=;¾ò3’â7–îëž®/’îï’öTÑ…‰±”€¼É½ßŽ(€½¹ÍÐíÑ•¹…¹Ð±™ôõ…Ý…¥Ð}±½…‘Q•¹…¹ÑA…åµ•¹Ñ½¹™¥œ¡•¹Ø±Q99P¤ì(€É•ÑÕÉ¸}ÁÉ½™¥±•ÍÉ½µA…åµ•¹Ñ½¹™¥œ¡Q99P±Ñ•¹…¹Ð±™œ¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸}Í…Ù•AÉ½™¥±•ÍQ½A…åµ•¹Ñ½¹™¥œ¡•¹Ø±Q99P±ÁÉ½™¥±•Ì±•áÑÉ…A…Ñ õíô¥ì(€½¹ÍÐí™ôõ…Ý…¥Ð}±½…‘Q•¹…¹ÑA…åµ•¹Ñ½¹™¥œ¡•¹Ø±Q99P¤ì(€½¹ÍÐ¹•áÐõì¸¸¹™œ°¸¸¹•áÑÉ…A…Ñ ±ÁÉ½™¥±•Ì±ÕÁ‘…Ñ•‘Ðé¹½Ý%Í¼ ¥ôì(€‘•±•Ñ”¹•áÐ¹Á…åµ•¹ÑAÉ½™¥±•Ìì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Ñ•¹…¹ÑÌœ±¥õ•Ä¸‘íQ99Qõ€±íÁ…åµ•¹Ñ}½¹™¥}©Í½¸é¹•áÑô¤ì(€É•ÑÕÉ¸¹•áÐì)ô)…Íå¹Œ™Õ¹Ñ¥½¸}•Ñ•™…Õ±ÑA…åµ•¹ÑAÉ½™¥±”¡•¹Ø±Q99P¥ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð}Í••‘•™…Õ±ÑA…åµ•¹ÑAÉ½™¥±•%™9••‘•¡•¹Ø±Q99P¤ì(€É•ÑÕÉ¸É½ÝÌ¹™¥¹¡ÈôùÈ¹¥Í}‘•™…Õ±ÐôôõÑÉÕ”˜™È¹¥Í}•¹…‰±•„ôõ™…±Í”¥ññÉ½ÝÌ¹™¥¹¡ÈôùÈ¹¥Í}•¹…‰±•„ôõ™…±Í”¥ññÉ½ÝÍlÁuññ¹Õ±°ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸}É•Í½±Ù•A…åµ•¹ÑAÉ½™¥±•½ÉM•ÍÍ¥½¸¡•¹Ø±Q99P±Í•ÍÍ¥½¹I½Ü¥ì(€½¹ÍÐÝ…¹Ñ•õMÑÉ¥¹œ¡Í•ÍÍ¥½¹I½Ü˜˜¡Í•ÍÍ¥½¹I½Ü¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥‘ññÍ•ÍÍ¥½¹I½Ü¹Á…åµ•¹ÑAÉ½™¥±•%¥ñðœœ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð}Í••‘•™…Õ±ÑA…åµ•¹ÑAÉ½™¥±•%™9••‘•¡•¹Ø±Q99P¤ì(€¥˜¡Ý…¹Ñ•¥ì(€€€½¹ÍÐ¡¥ÐõÉ½ÝÌ¹™¥¹¡ÈôùMÑÉ¥¹œ¡È¹¥¤ôôõÝ…¹Ñ•˜™È¹¥Í}•¹…‰±•„ôõ™…±Í”¤ì(€€€¥˜¡¡¥Ð¥É•ÑÕÉ¸¡¥Ðì(€€€Ñ¡É½Ü¹•ÜÉÉ½È Ÿš¶“–‚Óš²‡š2–ºkžjšRÛš²û¢¢·–ºk’â7–¶c–r£š"[–ÞË–sžR£¾ò3¢®/’âï¢ú›¦7šZÃš2–ºk–ú3–7šN7’öpœ¤ì(€ô(€É•ÑÕÉ¸É½ÝÌ¹™¥¹¡ÈôùÈ¹¥Í}‘•™…Õ±ÐôôõÑÉÕ”˜™È¹¥Í}•¹…‰±•„ôõ™…±Í”¥ññÉ½ÝÌ¹™¥¹¡ÈôùÈ¹¥Í}•¹…‰±•„ôõ™…±Í”¥ññÉ½ÝÍlÁuññ¹Õ±°ì)ô)™Õ¹Ñ¥½¸}Á…åµ•¹ÑAÉ½™¥±•UÍ…‰±•ÉÉ½È¡ÁÉ½™¥±”¥ì(€¥˜ …ÁÉ½™¥±•ññÁÉ½™¥±”¹¥Í}•¹…‰±•ôôõ™…±Í”¥É•ÑÕÉ¸€Ÿ–Âkšr«¢¢·–ºk–>¿žR£šRÛš²û¢¢·–ºhœì(€½¹ÍÐÀõ}Á…åµ•¹ÑAÉ½™¥±•AÕ‰±¥Œ¡ÁÉ½™¥±”¤±„õÀ¹…±±½Ý•‘5•Ñ¡½‘Íññíô±ˆõÀ¹‰…¹­½Õ¹Ñññíôì(€½¹ÍÐ‰…¹¬ô„„¡„¹‰…¹¬˜™MÑÉ¥¹œ¡ˆ¹…½Õ¹Ñ9Õµ‰•Éñðœœ¤¹ÑÉ¥´ ¤¤ì(€½¹ÍÐ±¥¹”ô„„¡„¹±¥¹•Á…ä˜™MÑÉ¥¹œ ¡À¹±¥¹•Á…åññíô¤¹ÕÉ±ñðœœ¤¹ÑÉ¥´ ¤¤ì(€½¹ÍÐ…Éô„„¡„¹…É˜™MÑÉ¥¹œ ¡À¹…É‘ññíô¤¹ÕÉ±ñðœœ¤¹ÑÉ¥´ ¤¤ì(€É•ÑÕÉ¸€ …‰…¹¬˜˜…±¥¹”˜˜……É¤üŸšRÛš²û¢¢·–ºk–Âkšr«–†¯–—–>¿’öÿžR£žj¦*¢†3–âÏ¢fŽ1%9A…äƒš"[’þ‡žR£–6‡’îcš²û¢Î¢¢(œèœœì)ô)™Õ¹Ñ¥½¸}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µAÉ½™¥±”¡ÁÉ½™¥±”¥ì(€½¹ÍÐÀõ}Á…åµ•¹ÑAÉ½™¥±•AÕ‰±¥Œ¡ÁÉ½™¥±”¤í¥˜ …À¥É•ÑÕÉ¸¹Õ±°ì(€É•ÑÕÉ¸íÁ…åµ•¹Ñ}ÁÉ½™¥±•}¥éÀ¹¥±Á…åµ•¹Ñ}ÁÉ½™¥±•}¹…µ”éÀ¹¹…µ”±Á…åµ•¹Ñ}½Ý¹•É}µ½‘”éÀ¹µ½‘”±½Ý¹•É}¹…µ”éÀ¹½Ý¹•É9…µ”±…±±½Ý•‘}µ•Ñ¡½‘ÌéÀ¹…±±½Ý•‘5•Ñ¡½‘Ì±‰…¹­}…½Õ¹ÐéÀ¹‰…¹­½Õ¹Ð±±¥¹•Á…äéÀ¹±¥¹•Á…ä±…ÉéÀ¹…É±Í¹…ÁÍ¡½Ñ}É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ôì)ô)™Õ¹Ñ¥½¸}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µI•œ¡È¥ì(€½¹ÍÐÍ¹…ÀõÍ…™•)Í½¸¡È¹Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½Ð±¹Õ±°¤ì(€¥˜¡Í¹…À˜™ÑåÁ•½˜Í¹…Àôôô½‰©•Ðœ¥É•ÑÕÉ¸Í¹…Àì(€¥˜¡È¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥‘ññÈ¹‰…¹­}…½Õ¹Ñ}Í¹…ÁÍ¡½Ð¥ì(€€€É•ÑÕÉ¸íÁ…åµ•¹Ñ}ÁÉ½™¥±•}¥éÈ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥‘ñðœœ±Á…åµ•¹Ñ}ÁÉ½™¥±•}¹…µ”éÈ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¹…µ•ñðœœ±Á…åµ•¹Ñ}½Ý¹•É}µ½‘”éÈ¹Á…åµ•¹Ñ}½Ý¹•É}µ½‘•ñðœœ±½Ý¹•É}¹…µ”éÈ¹Á…åµ•¹Ñ}½Ý¹•É}¹…µ•ñðœœ±…±±½Ý•‘}µ•Ñ¡½‘ÌéÍ…™•)Í½¸¡È¹Á…åµ•¹Ñ}µ•Ñ¡½‘Í}…±±½Ý•±í‰…¹¬éÑÉÕ”±±¥¹•Á…äé™…±Í”±…Éé™…±Í•ô¤±‰…¹­}…½Õ¹ÐéÍ…™•)Í½¸¡È¹‰…¹­}…½Õ¹Ñ}Í¹…ÁÍ¡½Ð±íô¤±±¥¹•Á…äéÍ…™•)Í½¸¡È¹±¥¹•Á…å}½¹™¥}Í¹…ÁÍ¡½Ð±íô¤±…ÉéÍ…™•)Í½¸¡È¹…É‘}½¹™¥}Í¹…ÁÍ¡½Ð±íô¥ôì(€ô(€É•ÑÕÉ¸¹Õ±°ì)ô)™Õ¹Ñ¥½¸}Á…åµ•¹ÑM¹…ÁÍ¡½ÑAÕ‰±¥Œ¡Í¹…À¥ì(€½¹ÍÐÌõÍ¹…À˜™ÑåÁ•½˜Í¹…Àôôô½‰©•ÐœýÍ¹…Àéíô±…±±½Ý•õ}Á…åµ•¹Ñ5•Ñ¡½‘Í±±½Ý•¡Ì¹…±±½Ý•‘}µ•Ñ¡½‘ÍññÌ¹…±±½Ý•‘5•Ñ¡½‘Íññíô¤±‰…¹¬õÌ¹‰…¹­}…½Õ¹ÑññÌ¹‰…¹­½Õ¹Ñññíôì(€É•ÑÕÉ¸íÁ…åµ•¹ÑAÉ½™¥±•%éÌ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥‘ññÌ¹Á…åµ•¹ÑAÉ½™¥±•%‘ñðœœ±Á…åµ•¹ÑAÉ½™¥±•9…µ”éÌ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¹…µ•ññÌ¹Á…åµ•¹ÑAÉ½™¥±•9…µ•ñðœœ±Á…åµ•¹Ñ=Ý¹•É5½‘”é}¹½Éµ…±¥é•A…åµ•¹Ñ=Ý¹•É5½‘”¡Ì¹Á…åµ•¹Ñ}½Ý¹•É}µ½‘•ññÌ¹Á…åµ•¹Ñ=Ý¹•É5½‘”¤±Á…åµ•¹Ñ=Ý¹•É9…µ”éÌ¹½Ý¹•É}¹…µ•ññÌ¹Á…åµ•¹Ñ}½Ý¹•É}¹…µ•ñðœœ±…±±½Ý•‘5•Ñ¡½‘Ìé…±±½Ý•±‰…¹­½Õ¹Ðéí‰…¹­9…µ”é‰…¹¬¹‰…¹­9…µ•ññ‰…¹¬¹‰…¹­}¹…µ•ñðœœ±‰É…¹¡9…µ”é‰…¹¬¹‰É…¹¡9…µ•ññ‰…¹¬¹‰É…¹¡}¹…µ•ñðœœ±…½Õ¹Ñ9…µ”é‰…¹¬¹…½Õ¹Ñ9…µ•ññ‰…¹¬¹…½Õ¹Ñ}¹…µ•ñðœœ±…½Õ¹Ñ9Õµ‰•Èé‰…¹¬¹…½Õ¹Ñ9Õµ‰•Éññ‰…¹¬¹‰…¹­½Õ¹Ñññ‰…¹¬¹‰…¹­}…½Õ¹Ññðœô±±¥¹•Á…äéÌ¹±¥¹•Á…åññíô±…ÉéÌ¹…É‘ññíô±Í¹…ÁÍ¡½ÑÉ•…Ñ•‘ÐéÌ¹Í¹…ÁÍ¡½Ñ}É•…Ñ•‘}…ÑññÌ¹Á…åµ•¹Ñ}Í¹…ÁÍ¡½Ñ}É•…Ñ•‘}…Ññðœœ±±•…äè„…Ì¹±•…åôì)ô)™Õ¹Ñ¥½¸}Á…åµ•¹ÑM¹…ÁÍ¡½Ñ‰A…å±½…¡Í¹…À¥ì(€½¹ÍÐÁÕˆõ}Á…åµ•¹ÑM¹…ÁÍ¡½ÑAÕ‰±¥Œ¡Í¹…À¤ì(€É•ÑÕÉ¸íÁ…åµ•¹Ñ}ÁÉ½™¥±•}¥éÁÕˆ¹Á…åµ•¹ÑAÉ½™¥±•%‘ññ¹Õ±°±Á…åµ•¹Ñ}ÁÉ½™¥±•}Í¹…ÁÍ¡½ÐéÍ¹…Áññíô±Á…åµ•¹Ñ}½Ý¹•É}µ½‘”éÁÕˆ¹Á…åµ•¹Ñ=Ý¹•É5½‘•ñðœœ±Á…åµ•¹Ñ}µ•Ñ¡½‘Í}…±±½Ý•éÁÕˆ¹…±±½Ý•‘5•Ñ¡½‘Ì±‰…¹­}…½Õ¹Ñ}Í¹…ÁÍ¡½ÐéÁÕˆ¹‰…¹­½Õ¹Ð±±¥¹•Á…å}½¹™¥}Í¹…ÁÍ¡½ÐéÁÕˆ¹±¥¹•Á…åññíô±…É‘}½¹™¥}Í¹…ÁÍ¡½ÐéÁÕˆ¹…É‘ññíô±Á…åµ•¹Ñ}Í¹…ÁÍ¡½Ñ}É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ôì)ô)™Õ¹Ñ¥½¸}¥ÍA…åµ•¹ÑMÑ…ÉÑ•¡É•œ¥ì(€½¹ÍÐÁÌõMÑÉ¥¹œ¡É•œ˜™É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ¤¹ÑÉ¥´ ¤ì(€É•ÑÕÉ¸¥ÍA…¥‘MÑ…ÑÕÌ¡ÁÌ¥ññlŸ–úžŠë¢ª4œ°Ÿ’îcš²û–úžŠë¢ª4œ°Ÿ–ÞË–n{–‚Äœ°Ÿ–7¢Êìt¹¥¹±Õ‘•Ì¡ÁÌ¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸•¹ÍÕÉ•A…åµ•¹ÑM¹…ÁÍ¡½Ñ½ÉI•œ¡•¹Ø±Q99P±É•œ±Í•ÍÍ¥½¹I½Ü±½ÁÑÌõíô¥ì(€½¹ÍÐ•á¥ÍÑ¥¹œõ}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µI•œ¡É•œ¤ì(€¥˜¡•á¥ÍÑ¥¹œ¥ì(€€€¥˜ …}¥ÍA…åµ•¹ÑMÑ…ÉÑ•¡É•œ¤¥ì(€€€€€ÑÉåì(€€€€€€€½¹ÍÐ±…Ñ•ÍÐõ…Ý…¥Ð}É•Í½±Ù•A…åµ•¹ÑAÉ½™¥±•½ÉM•ÍÍ¥½¸¡•¹Ø±Q99P±Í•ÍÍ¥½¹I½Ýññíô¤ì(€€€€€€€¥˜¡±…Ñ•ÍÐ˜™MÑÉ¥¹œ¡±…Ñ•ÍÐ¹¥‘ñðœœ¤ôôõMÑÉ¥¹œ¡•á¥ÍÑ¥¹œ¹Á…åµ•¹Ñ}ÁÉ½™¥±•}¥‘ñðœœ¤¥ì(€€€€€€€€€½¹ÍÐ™É•Í õ}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µAÉ½™¥±”¡±…Ñ•ÍÐ¤ì(€€€€€€€€€•á¥ÍÑ¥¹œ¹…±±½Ý•‘}µ•Ñ¡½‘Ìõ™É•Í ¹…±±½Ý•‘}µ•Ñ¡½‘Ìí•á¥ÍÑ¥¹œ¹±¥¹•Á…äõ™É•Í ¹±¥¹•Á…äí•á¥ÍÑ¥¹œ¹…Éõ™É•Í ¹…Éì(€€€€€€€ô(€€€€€õ…Ñ ¡”¥í½¹Í½±”¹•ÉÉ½È É•™É•Í …±±½Ý•µ•Ñ¡½‘ÌÍ­¥ÁÁ•œ±”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é”¤íô(€€€ô(€€€É•ÑÕÉ¸•á¥ÍÑ¥¹œì(€ô(€½¹ÍÐÁÉ½™¥±”õ…Ý…¥Ð}É•Í½±Ù•A…åµ•¹ÑAÉ½™¥±•½ÉM•ÍÍ¥½¸¡•¹Ø±Q99P±Í•ÍÍ¥½¹I½Ýññíô¤ì(€½¹ÍÐ•ÉÈõ}Á…åµ•¹ÑAÉ½™¥±•UÍ…‰±•ÉÉ½È¡ÁÉ½™¥±”¤í¥˜¡•ÉÈ¥Ñ¡É½Ü¹•ÜÉÉ½È¡•ÉÈ¤ì(€½¹ÍÐÍ¹…Àõ}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µAÉ½™¥±”¡ÁÉ½™¥±”¤±…¹]É¥Ñ”õ½ÁÑÌ¹™½É•]É¥Ñ•ñð …}¥ÍA…åµ•¹ÑMÑ…ÉÑ•¡É•œ¤¤ì(€¥˜¡…¹]É¥Ñ”˜™É•œ˜™É•œ¹¥¥…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±}Á…åµ•¹ÑM¹…ÁÍ¡½Ñ‰A…å±½…¡Í¹…À¤¤ì(€•±Í”¥˜¡}¥ÍA…åµ•¹ÑMÑ…ÉÑ•¡É•œ¤¥Í¹…À¹±•…äõÑÉÕ”ì(€É•ÑÕÉ¸Í¹…Àì)ô)™Õ¹Ñ¥½¸}Á…åµ•¹Ñ5•Ñ¡½‘-•ä¡µ•Ñ¡½¥ì(€½¹ÍÐÌõMÑÉ¥¹œ¡µ•Ñ¡½‘ñðœœ¤¹Ñ½1½Ý•É…Í” ¤ì(€¥˜¡Ì¹¥¹±Õ‘•Ì ±¥¹”œ¤¥É•ÑÕÉ¸€±¥¹•Á…äœì(€¥˜¡Ì¹¥¹±Õ‘•Ì Ÿ’þ‡žR œ¥ññÌ¹¥¹±Õ‘•Ì Ÿ–"ß–6„œ¥ññÌ¹¥¹±Õ‘•Ì …Éœ¥ññÌ¹¥¹±Õ‘•Ì ŸžÚƒžV0œ¤¥É•ÑÕÉ¸€…Éœì(€É•ÑÕÉ¸€‰…¹¬œì)ô)™Õ¹Ñ¥½¸}µ•Ñ¡½‘±±½Ý•‘É½µM¹…ÁÍ¡½Ð¡Í¹…À±µ•Ñ¡½¥ì(€É•ÑÕÉ¸€„…}Á…åµ•¹Ñ5•Ñ¡½‘Í±±½Ý• ¡Í¹…À˜™Í¹…À¹…±±½Ý•‘}µ•Ñ¡½‘Ì¥ññíô¥m}Á…åµ•¹Ñ5•Ñ¡½‘-•ä¡µ•Ñ¡½¥tì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑA…åµ•¹ÑAÉ½™¥±•Ì¡•¹Ø±À¥ì(€½¹ÍÐQ99PõÀ˜™À¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€É•ÑÕÉ¸©Í½¹=¬ ¡…Ý…¥Ð}Í••‘•™…Õ±ÑA…åµ•¹ÑAÉ½™¥±•%™9••‘•¡•¹Ø±Q99P¤¤¹µ…À¡}Á…åµ•¹ÑAÉ½™¥±•AÕ‰±¥Œ¤¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•A…åµ•¹ÑAÉ½™¥±”¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ˜™ˆ¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÕÉÉ•¹Ðõ…Ý…¥Ð}Í••‘•™…Õ±ÑA…åµ•¹ÑAÉ½™¥±•%™9••‘•¡•¹Ø±Q99P¤ì(€½¹ÍÐ¥õMÑÉ¥¹œ¡ˆ¹¥‘ñðœœ¤¹ÑÉ¥´ ¥ññ•¹% AeMPœ¤±É½Üõ}Á…åµ•¹ÑAÉ½™¥±•I½ÝÉ½µ	½‘ä¡ˆ±Q99P±¥¤ì(€±•ÐÁÉ½™¥±•ÌõÕÉÉ•¹Ð¹™¥±Ñ•È¡àôùMÑÉ¥¹œ¡à¹¥¤„ôõ¥¤ì(€¥˜¡É½Ü¹¥Í}‘•™…Õ±Ð¥ÁÉ½™¥±•ÌõÁÉ½™¥±•Ì¹µ…À¡àôø¡ì¸¸¹à±¥Í}‘•™…Õ±Ðé™…±Í•ô¤¤ì(€ÁÉ½™¥±•Ì¹ÁÕÍ ¡ì¸¸¹É½Ü±É•…Ñ•‘}…Ðè¡ÕÉÉ•¹Ð¹™¥¹¡àôùMÑÉ¥¹œ¡à¹¥¤ôôõ¥¥ññíô¤¹É•…Ñ•‘}…Ñññ¹½Ý%Í¼ ¥ô¤ì(€¥˜ …ÁÉ½™¥±•Ì¹Í½µ”¡àôùà¹¥Í}‘•™…Õ±ÐôôõÑÉÕ”˜™à¹¥Í}•¹…‰±•„ôõ™…±Í”¤¥í½¹ÍÐ™¥ÉÍÐõÁÉ½™¥±•Ì¹™¥¹¡àôùà¹¥Í}•¹…‰±•„ôõ™…±Í”¤í¥˜¡™¥ÉÍÐ¥™¥ÉÍÐ¹¥Í}‘•™…Õ±ÐõÑÉÕ”íô(€½¹ÍÐ‘•˜õÁÉ½™¥±•Ì¹™¥¹¡àôùà¹¥Í}‘•™…Õ±ÐôôõÑÉÕ”¥ññÁÉ½™¥±•ÍlÁuññÉ½Ü±ÁÕˆõ}Á…åµ•¹ÑAÉ½™¥±•AÕ‰±¥Œ¡‘•˜¤±µ•Ñ¡½‘Ìõmtì(€¥˜¡ÁÕˆ¹…±±½Ý•‘5•Ñ¡½‘Ì¹±¥¹•Á…ä˜™ÁÕˆ¹±¥¹•Á…ä¹ÕÉ°¥µ•Ñ¡½‘Ì¹ÁÕÍ ¡í¹…µ”è1%9A…äœ±ÕÉ°éÁÕˆ¹±¥¹•Á…ä¹ÕÉ±ô¤ì(€¥˜¡ÁÕˆ¹…±±½Ý•‘5•Ñ¡½‘Ì¹…É˜™ÁÕˆ¹…É¹ÕÉ°¥µ•Ñ¡½‘Ì¹ÁÕÍ ¡í¹…µ”èŸ’þ‡žR£–6‡¾ò?žÚƒžV0œ±ÕÉ°éÁÕˆ¹…É¹ÕÉ±ô¤ì(€…Ý…¥Ð}Í…Ù•AÉ½™¥±•ÍQ½A…åµ•¹Ñ½¹™¥œ¡•¹Ø±Q99P±ÁÉ½™¥±•Ì±íÁ…åµ•¹Ñ9½Ñ”éÁÕˆ¹¹½Ñ•ñðœœ±‰…¹­9…µ”éÁÕˆ¹‰…¹­½Õ¹Ð¹‰…¹­9…µ•ñðœœ±‰…¹­	É…¹ éÁÕˆ¹‰…¹­½Õ¹Ð¹‰É…¹¡9…µ•ñðœœ±…½Õ¹Ñ9…µ”éÁÕˆ¹‰…¹­½Õ¹Ð¹…½Õ¹Ñ9…µ•ñðœœ±‰…¹­½Õ¹ÐéÁÕˆ¹‰…¹­½Õ¹Ð¹…½Õ¹Ñ9Õµ‰•Éñðœœ±Á…å5•Ñ¡½‘Ìéµ•Ñ¡½‘Ì±Á…åµ•¹Ñ=Ý¹•É5½‘”éÁÕˆ¹µ½‘•ñð½É…¹¥é•É}Í•±˜œ±½Ý¹•É9…µ”éÁÕˆ¹½Ý¹•É9…µ•ñðœô¤ì(€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P±ˆ¹•µ…¥±ñðœœ°™¥¹…¹•}…‘µ¥¸œ°Á…åµ•¹Ñ}ÁÉ½™¥±•}Í…Ù•œ°Ñ•¹…¹ÑÌœ±Q99P±¹Õ±°±íÁÉ½™¥±•%é¥‘ô±íÍÑ½É…”èÁ…åµ•¹Ñ}½¹™¥}©Í½¸ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¥‘ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡¥Í…‰±•A…åµ•¹ÑAÉ½™¥±”¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ˜™ˆ¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ¥õMÑÉ¥¹œ¡ˆ¹¥‘ñðœœ¤¹ÑÉ¥´ ¤í¥˜ …¥¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úošRÛš²û¢¢·–ºh%œ¤ì(€½¹ÍÐÕÉÉ•¹Ðõ…Ý…¥Ð}Í••‘•™…Õ±ÑA…åµ•¹ÑAÉ½™¥±•%™9••‘•¡•¹Ø±Q99P¤±¡¥ÐõÕÉÉ•¹Ð¹™¥¹¡àôùMÑÉ¥¹œ¡à¹¥¤ôôõ¥¤ì(€¥˜ …¡¥Ð¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"ÃšRÛš²û¢¢·–ºhœ¤ì(€¥˜¡¡¥Ð¹¥Í}‘•™…Õ±ÐôôõÑÉÕ”¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦‚C¢¢·šRÛš²û¢¢·–ºk’â7–>¿–sžR£¾ò3¢®/–#¢¢·–ºk–Û’î[¦‚C¢¢´œ¤ì(€½¹ÍÐ¥¹UÍ”õ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Á…åµ•¹Ñ}ÁÉ½™¥±•}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥ô™Í•±•Ðõ¥±¹…µ•€¤¹…Ñ   ¤ôùmt¤ì(€¥˜¡¥¹UÍ”¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“šRÛš²û¢¢·–ºk’î7¢Š¬€œ­¥¹UÍ”¹±•¹Ñ ¬œƒ–/–‚Óš²‡’öÿžR£¾ò3¢®/–#šRçžR£–Û’î[šRÛš²û¢¢·–ºhœ¤ì(€…Ý…¥Ð}Í…Ù•AÉ½™¥±•ÍQ½A…åµ•¹Ñ½¹™¥œ¡•¹Ø±Q99P±ÕÉÉ•¹Ð¹µ…À¡àôùMÑÉ¥¹œ¡à¹¥¤ôôõ¥ýì¸¸¹à±¥Í}•¹…‰±•é™…±Í”±ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ôéà¤¤ì(€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P±ˆ¹•µ…¥±ñðœœ°™¥¹…¹•}…‘µ¥¸œ°Á…åµ•¹Ñ}ÁÉ½™¥±•}‘¥Í…‰±•œ°Ñ•¹…¹ÑÌœ±Q99P±¹Õ±°±íÁÉ½™¥±•%é¥‘ô±íÍÑ½É…”èÁ…åµ•¹Ñ}½¹™¥}©Í½¸ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñ¥¹…¹•A…åµ•¹ÑÉ½ÕÁÌ¡•¹Ø±À¥ì(€½¹ÍÐQ99PõÀ˜™À¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ%õÀ¹Í•ÍÍ¥½¹%‘ññÀ¹Í•ÍÍ¥½¹}¥‘ñðœœí±•ÐÅÌõÑ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€í¥˜¡Í%¥ÅÌ¬õ€™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í%¥õ€ì(€½¹ÍÐmÉ•Ì±Í•ÍÍ¥½¹Ítõ…Ý…¥ÐAÉ½µ¥Í”¹…±°¡m‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±ÅÌ¤¹…Ñ   ¤ôùmt¤±‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¥t¤ì(€½¹ÍÐÍµ…ÀõíôíÍ•ÍÍ¥½¹Ì¹™½É… ¡ÌôùÍµ…ÁmÌ¹¥‘tõÌ¤í½¹ÍÐ¥Ñ•µ5…Àõ…Ý…¥Ð}•ÑI•¥ÍÑÉ…Ñ¥½¹%Ñ•µÍ½ÉI•Ì¡•¹Ø±É•Ì¤¹…Ñ   ¤ôø¡íô¤¤±É½ÕÁÌõíôì(€™½È¡½¹ÍÐÈ½˜É•Ì¹™¥±Ñ•È¡}¥ÍI••¥Ù…‰±•I•œ¤¥ì(€€€½¹ÍÐÍ•ÌõÍµ…ÁmÈ¹Í•ÍÍ¥½¹}¥‘uññíô±µ½¹•äõ}É•¥¹…¹•µ½Õ¹ÑÌ¡È±Í•Ì±¥Ñ•µ5…ÁmÈ¹¥‘t¤±Í¹…Àõ}Á…åµ•¹ÑM¹…ÁÍ¡½ÑAÕ‰±¥Œ¡}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µI•œ¡È¥ññíÁ…åµ•¹Ñ}ÁÉ½™¥±•}¹…µ”èŸšr«’þw–¶cšRÛš²û–þ¯žœœ±Á…åµ•¹Ñ}½Ý¹•É}µ½‘”è±•…äœ±…±±½Ý•‘}µ•Ñ¡½‘Ìéí‰…¹¬éÑÉÕ•õô¤ì(€€€½¹ÍÐ­•äô¡Í¹…À¹Á…åµ•¹ÑAÉ½™¥±•%‘ñð±•…äœ¤¬ðœ¬¡Í¹…À¹Á…åµ•¹Ñ=Ý¹•É5½‘•ñð±•…äœ¤ì(€€€¥˜ …É½ÕÁÍm­•åt¥É½ÕÁÍm­•åtõíÁ…åµ•¹ÑAÉ½™¥±•%éÍ¹…À¹Á…åµ•¹ÑAÉ½™¥±•%±Á…åµ•¹ÑAÉ½™¥±•9…µ”éÍ¹…À¹Á…åµ•¹ÑAÉ½™¥±•9…µ•ñðŸšr«’þw–¶cšRÛš²û–þ¯žœœ±½Ý¹•É5½‘”éÍ¹…À¹Á…åµ•¹Ñ=Ý¹•É5½‘•ñð±•…äœ±½Ý¹•É9…µ”éÍ¹…À¹Á…åµ•¹Ñ=Ý¹•É9…µ•ñðœœ±½Õ¹ÐèÀ±É••¥Ù…‰±”èÀ±É••¥Ù•èÀ±‘•Á½Í¥ÐèÀ±ÑÉ…¹Í™•ÉÕ”èÁôì(€€€É½ÕÁÍm­•åt¹½Õ¹Ð¬¬íÉ½ÕÁÍm­•åt¹É••¥Ù…‰±”¬õµ½¹•ä¹…Í¡Q½Ñ…°í¥˜¡}¥Í½¹™¥Éµ•‘A…¥‘I•œ¡È¤¥É½ÕÁÍm­•åt¹É••¥Ù•¬õµ½¹•ä¹…Í¡Q½Ñ…°íÉ½ÕÁÍm­•åt¹‘•Á½Í¥Ð¬õµ½¹•ä¹‘•Á½Í¥ÑQ½Ñ…°ì(€€€¥˜¡Í¹…À¹Á…åµ•¹Ñ=Ý¹•É5½‘”ôôôÁ±…Ñ™½Éµ}…•¹äœ¥É½ÕÁÍm­•åt¹ÑÉ…¹Í™•ÉÕ”¬õ5…Ñ ¹µ…à À±µ½¹•ä¹…Í¡Q½Ñ…°µµ½¹•ä¹‘•Á½Í¥ÑQ½Ñ…°¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡=‰©•Ð¹Ù…±Õ•Ì¡É½ÕÁÌ¤¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑA…åµ•¹ÑM•ÑÑ¥¹Ì¡•¹Ø±À¥ì(€½¹ÍÐQ99PõÀ˜™À¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐíÑ•¹…¹ÐéÐ±™ôõ…Ý…¥Ð}±½…‘Q•¹…¹ÑA…åµ•¹Ñ½¹™¥œ¡•¹Ø±Q99P¤ì(€±•ÐÁ…å5•Ñ¡½‘ÌõÉÉ…ä¹¥ÍÉÉ…ä¡™œ¹Á…å5•Ñ¡½‘Ì¤ý™œ¹Á…å5•Ñ¡½‘Ì¹™¥±Ñ•È¡´ôù´˜™´¹¹…µ”¤émtì(€¥˜ …Á…å5•Ñ¡½‘Ì¹±•¹Ñ ¥í½¹ÍÐÍ••õmt±±Àõ™œ¹±¥¹•A…åQ•áÑññ™œ¹±¥¹•A…åññ™œ¹±¥¹•A…åUÉ±ññ™œ¹±¥¹•}Á…å}ÕÉ±ñðœœ±Àõ™œ¹É•‘¥Ñ…É‘Q•áÑññ™œ¹É•‘¥Ñ…É‘ññ™œ¹…É‘A…åUÉ±ññ™œ¹É•‘¥Ñ…É‘UÉ±ññ™œ¹•Á…åUÉ±ññ™œ¹…É‘ññ™œ¹…É‘}Á…å}ÕÉ±ñðœœí¥˜¡±À¥Í••¹ÁÕÍ ¡í¹…µ”è1%9A…äœ±ÕÉ°é±Áô¤í¥˜¡À¥Í••¹ÁÕÍ ¡í¹…µ”èŸ’þ‡žR£–6‡¾ò?žÚƒžV0œ±ÕÉ°éÁô¤íÁ…å5•Ñ¡½‘ÌõÍ••íô(€É•ÑÕÉ¸©Í½¹=¬¡íÁ…åµ•¹Ñ9½Ñ”é™œ¹Á…åµ•¹Ñ9½Ñ•ññ™œ¹¹½Ñ•ñðœœ±‰…¹­9…µ”é™œ¹‰…¹­9…µ•ññ™œ¹‰…¹­ñðœœ±‰…¹­	É…¹ é™œ¹‰…¹­	É…¹¡ññ™œ¹‰É…¹¡ñðœœ±…½Õ¹Ñ9…µ”é™œ¹…½Õ¹Ñ9…µ•ññ™œ¹…½Õ¹Ñ}¹…µ•ñðœœ±‰…¹­½Õ¹Ðé™œ¹‰…¹­½Õ¹Ñññ™œ¹…½Õ¹Ññðœœ±Á…å5•Ñ¡½‘Ì±±¥¹•UÉ°éÐ¹±¥¹•}ÕÉ±ñðœœ±‰…¹­%¹™¼éÐ¹‰…¹­}¥¹™½ñðœœ±Á…åµ•¹ÑAÉ½™¥±•Ìé}ÁÉ½™¥±•ÍÉ½µA…åµ•¹Ñ½¹™¥œ¡Q99P±Ð±™œ¤¹µ…À¡}Á…åµ•¹ÑAÉ½™¥±•AÕ‰±¥Œ¥ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•A…åµ•¹ÑM•ÑÑ¥¹Ì¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ˜™ˆ¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐí™ôõ…Ý…¥Ð}±½…‘Q•¹…¹ÑA…åµ•¹Ñ½¹™¥œ¡•¹Ø±Q99P¤±Á…å5•Ñ¡½‘ÌõÉÉ…ä¹¥ÍÉÉ…ä¡ˆ¹Á…å5•Ñ¡½‘Ì¤ýˆ¹Á…å5•Ñ¡½‘Ì¹µ…À¡´ôø¡í¹…µ”éMÑÉ¥¹œ ¡´˜™´¹¹…µ”¥ñðœœ¤¹ÑÉ¥´ ¤±ÕÉ°éMÑÉ¥¹œ ¡´˜™´¹ÕÉ°¥ñðœœ¤¹ÑÉ¥´ ¥ô¤¤¹™¥±Ñ•È¡´ôù´¹¹…µ”¤émtì(€½¹ÍÐÁ…åµ•¹Ðõì¸¸¹™œ±Á…åµ•¹Ñ9½Ñ”éˆ¹Á…åµ•¹Ñ9½Ñ•ñðœœ±‰…¹­9…µ”éˆ¹‰…¹­9…µ•ñðœœ±‰…¹­	É…¹ éˆ¹‰…¹­	É…¹¡ñðœœ±…½Õ¹Ñ9…µ”éˆ¹…½Õ¹Ñ9…µ•ñðœœ±‰…¹­½Õ¹Ðéˆ¹‰…¹­½Õ¹Ññðœœ±Á…å5•Ñ¡½‘Ì±ÕÁ‘…Ñ•‘Ðé¹½Ý%Í¼ ¥ôì(€¥˜¡ÉÉ…ä¹¥ÍÉÉ…ä¡Á…åµ•¹Ð¹ÁÉ½™¥±•Ì¤˜™Á…åµ•¹Ð¹ÁÉ½™¥±•Ì¹±•¹Ñ ¥ì(€€€½¹ÍÐ¥‘àõÁ…åµ•¹Ð¹ÁÉ½™¥±•Ì¹™¥¹‘%¹‘•à¡àôùà˜˜¡à¹¥Í}‘•™…Õ±ÐôôõÑÉÕ•ññà¹¥Í•™…Õ±ÐôôõÑÉÕ”¤¤±¤õ¥‘àøôÀý¥‘àèÀ±àõì¸¸¹Á…åµ•¹Ð¹ÁÉ½™¥±•Ím¥uôì(€€€à¹‰…¹­}¹…µ”õÁ…åµ•¹Ð¹‰…¹­9…µ”íà¹‰…¹­}‰É…¹ õÁ…åµ•¹Ð¹‰…¹­	É…¹ íà¹…½Õ¹Ñ}¹…µ”õÁ…åµ•¹Ð¹…½Õ¹Ñ9…µ”íà¹‰…¹­}…½Õ¹ÐõÁ…åµ•¹Ð¹‰…¹­½Õ¹Ðíà¹¹½Ñ”õÁ…åµ•¹Ð¹Á…åµ•¹Ñ9½Ñ”ì(€€€à¹…±±½Ý•‘}µ•Ñ¡½‘Ìõí‰…¹¬è„…Á…åµ•¹Ð¹‰…¹­½Õ¹Ññð…Á…å5•Ñ¡½‘Ì¹±•¹Ñ ±±¥¹•Á…äéÁ…å5•Ñ¡½‘Ì¹Í½µ”¡´ôø½±¥¹”½¤¹Ñ•ÍÐ¡´¹¹…µ”¤¤±…ÉéÁ…å5•Ñ¡½‘Ì¹Í½µ”¡´ôø¿’þ‡žR¡ó–"ß–6…ñ…É‘óžÚƒžV0½¤¹Ñ•ÍÐ¡´¹¹…µ”¤¥ôì(€€€à¹±¥¹•Á…å}ÕÉ°ô¡Á…å5•Ñ¡½‘Ì¹™¥¹¡´ôø½±¥¹”½¤¹Ñ•ÍÐ¡´¹¹…µ”¤¥ññíô¤¹ÕÉ±ñðœœíà¹…É‘}ÕÉ°ô¡Á…å5•Ñ¡½‘Ì¹™¥¹¡´ôø¿’þ‡žR¡ó–"ß–6…ñ…É‘óžÚƒžV0½¤¹Ñ•ÍÐ¡´¹¹…µ”¤¥ññíô¤¹ÕÉ±ñðœœíà¹ÕÁ‘…Ñ•‘}…Ðõ¹½Ý%Í¼ ¤íÁ…åµ•¹Ð¹ÁÉ½™¥±•Ím¥tõàì(€ô(€½¹ÍÐ‰…¹­%¹™¼õmÁ…åµ•¹Ð¹Á…åµ•¹Ñ9½Ñ”±Á…åµ•¹Ð¹‰…¹­9…µ”±Á…åµ•¹Ð¹‰…¹­	É…¹ ±Á…åµ•¹Ð¹…½Õ¹Ñ9…µ”±Á…åµ•¹Ð¹‰…¹­½Õ¹Ñt¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ q¸œ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Ñ•¹…¹ÑÌœ±¥õ•Ä¸‘íQ99Qõ€±íÁ…åµ•¹Ñ}½¹™¥}©Í½¸éÁ…åµ•¹Ð±‰…¹­}¥¹™¼é‰…¹­%¹™½ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô((¼¼ƒš¶–ò?¦Z/šRû’úw¢ÎÓ¦¦_¢¶'¾òk–B3š¶—šª‹š~—š^‹šr'–‚Óš²‡š²’ö7¾ò3–7šª‹š~—š^‹šr'’îcš²û¢¢·–ºkŽ)…Íå¹Œ™Õ¹Ñ¥½¸}Ù…±¥‘…Ñ•M•ÍÍ¥½¹•Á•¹‘•¹¥•Í½É=Á•¸¡•¹Ø±Q99P±Ì¥ì(€½¹ÍÐÉ½ÝÉÈõ}Ù…±¥‘…Ñ•M•ÍÍ¥½¹½É=Á•¹I½Ü¡Ì¤í¥˜¡É½ÝÉÈ¥É•ÑÕÉ¸É½ÝÉÈì(€½¹ÍÐÍÑ…ÑÕÌõMÑÉ¥¹œ¡Ì˜™Ì¹ÍÑ…ÑÕÍñðŸ¦^s¦Z$œ¤ì(€¥˜¡ÍÑ…ÑÕÌ„ôôŸ–‚Ç–B7’â´œ˜™ÍÑ…ÑÕÌ„ôôŸ¦Z/šRøœ¥É•ÑÕÉ¸€œœì(€½¹ÍÐµ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ì˜™Ì¹µ½‘Õ±•Í}©Í½¸±íô¤¤ì(€¥˜¡µ½‘Ì¹Á…åµ•¹Ð¥ì(€€€±•ÐÀíÑÉåíÀõ…Ý…¥Ð}É•Í½±Ù•A…åµ•¹ÑAÉ½™¥±•½ÉM•ÍÍ¥½¸¡•¹Ø±Q99P±Íññíô¤íõ…Ñ ¡”¥íÉ•ÑÕÉ¸”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸš¶“–‚ÓšRÛš²û¢¢·–ºkž‡šÎW¢žšz@œíô(€€€½¹ÍÐÁ”õ}Á…åµ•¹ÑAÉ½™¥±•UÍ…‰±•ÉÉ½È¡À¤í¥˜¡Á”¥É•ÑÕÉ¸€Ÿš¶“–‚Ó–VžR£’îcš²ûš¢‡žÖ¾ò0œ­Á”ì(€ô(€É•ÑÕÉ¸€œœì)ô()…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñ½µÁ…¹åM•ÑÑ¥¹Ì¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Ñ•¹…¹ÑÌœ°¥õ•Ä¸‘íQ99Qô™Í•±•Ðõ¥±¹…µ”±Í±Õœ±½¹™¥}©Í½¸±•µ…¥±}™É½´±•µ…¥±}É•Á±å}Ñ¼±™½½Ñ•É}Ñ•áÐ±Í¥Ñ•}ÕÉ°±±¥¹•}ÕÉ°±±½½}ÕÉ±€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ãžžš"Û¢¢·–ºhœ¤ì(€½¹ÍÐÐõÉ½ÝÍlÁt°™œõÍ…™•)Í½¸¡Ð¹½¹™¥}©Í½¸°íô¤°Œõ™œ¹½µÁ…¹åññíôì(€É•ÑÕÉ¸©Í½¹=¬¡íÍåÍÑ•µ9…µ”éŒ¹ÍåÍÑ•µ9…µ•ñð=%9¾ösšÒï–.Wž¦/žº‡žBžÎïžÖÄœ°½µÁ…¹å9…µ”éŒ¹½µÁ…¹å9…µ•ññÐ¹¹…µ•ñðœœ°Í•ÉÙ¥•µ…¥°éŒ¹Í•ÉÙ¥•µ…¥±ññÐ¹•µ…¥±}É•Á±å}Ñ½ñðœœ°Í•ÉÙ¥•1¥¹”éŒ¹Í•ÉÙ¥•1¥¹•ññÐ¹±¥¹•}ÕÉ±ñðœœ°Á¡½¹”éŒ¹Á¡½¹•ñðœœ°Ý•‰Í¥Ñ”éŒ¹Ý•‰Í¥Ñ•ññÐ¹Í¥Ñ•}ÕÉ±ñðœœ°±½¥¹Q•áÐéŒ¹±½¥¹Q•áÑñðœœ°Í•ÉÙ¥•%¹™¼éŒ¹Í•ÉÙ¥•%¹™½ñðœœ°±½½UÉ°éÐ¹±½½}ÕÉ±ñðœô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•½µÁ…¹åM•ÑÑ¥¹Ì¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°Ñ•¹…¹ÑÌœ±¥õ•Ä¸‘íQ99Qô™Í•±•Ðõ½¹™¥}©Í½¹€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ãžžš"Û¢¢·–ºhœ¤ì(€½¹ÍÐ™œõÍ…™•)Í½¸¡É½ÝÍlÁt¹½¹™¥}©Í½¸°íô¤ì(€™œ¹½µÁ…¹äõíÍåÍÑ•µ9…µ”éˆ¹ÍåÍÑ•µ9…µ•ñðœœ°½µÁ…¹å9…µ”éˆ¹½µÁ…¹å9…µ•ñðœœ°Í•ÉÙ¥•µ…¥°éˆ¹Í•ÉÙ¥•µ…¥±ñðœœ°Í•ÉÙ¥•1¥¹”éˆ¹Í•ÉÙ¥•1¥¹•ñðœœ°Á¡½¹”éˆ¹Á¡½¹•ñðœœ°Ý•‰Í¥Ñ”éˆ¹Ý•‰Í¥Ñ•ñðœœ°±½¥¹Q•áÐéˆ¹±½¥¹Q•áÑñðœœ°Í•ÉÙ¥•%¹™¼éˆ¹Í•ÉÙ¥•%¹™½ñðœôì(€½¹ÍÐ‘…Ñ„õí½¹™¥}©Í½¸é)M=8¹ÍÑÉ¥¹¥™ä¡™œ¥ôì(€¥˜€¡ˆ¹½µÁ…¹å9…µ”„ôõÕ¹‘•™¥¹•¤‘…Ñ„¹¹…µ”õˆ¹½µÁ…¹å9…µ•ñðœœì(€¥˜€¡ˆ¹Ý•‰Í¥Ñ”„ôõÕ¹‘•™¥¹•¤‘…Ñ„¹Í¥Ñ•}ÕÉ°õˆ¹Ý•‰Í¥Ñ•ñðœœì(€¥˜€¡ˆ¹Í•ÉÙ¥•µ…¥°„ôõÕ¹‘•™¥¹•¤‘…Ñ„¹•µ…¥±}É•Á±å}Ñ¼õˆ¹Í•ÉÙ¥•µ…¥±ñðœœì(€¥˜€¡ˆ¹Í•ÉÙ¥•1¥¹”„ôõÕ¹‘•™¥¹•¤‘…Ñ„¹±¥¹•}ÕÉ°õˆ¹Í•ÉÙ¥•1¥¹•ñðœœì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Ñ•¹…¹ÑÌœ±¥õ•Ä¸‘íQ99Qõ€±‘…Ñ„¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ•ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñµ…¥±Q•µÁ±…Ñ•Ì¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P°…¹¹½Õ¹”œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ‘‰I½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€•µ…¥±}Ñ•µÁ±…Ñ•Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô¨™½É‘•ÈõÑ•µÁ±…Ñ•}­•ä¹…Í€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐµ…À€ô¹•Ü5…À ¤ì(€™½È€¡½¹ÍÐ½˜‘•™…Õ±Ñµ…¥±Q•µÁ±…Ñ•Ì ¤¤µ…À¹Í•Ð¡¹Ñ•µÁ±…Ñ•}­•ä°ì¸¸¹°¥Í•™…Õ±ÐéÑÉÕ•ô¤ì(€™½È€¡½¹ÍÐÈ½˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡‘‰I½ÝÌ¤ý‘‰I½ÝÌémt¤¤ì(€€€½¹ÍÐ‰…Í”€ôµ…À¹•Ð¡È¹Ñ•µÁ±…Ñ•}­•ä¤ñðíôì(€€€µ…À¹Í•Ð¡È¹Ñ•µÁ±…Ñ•}­•ä°ì(€€€€€€¸¸¹‰…Í”°(€€€€€¥éÈ¹¥°(€€€€€Ñ•µÁ±…Ñ•}­•äéÈ¹Ñ•µÁ±…Ñ•}­•ä°(€€€€€Ñ¥Ñ±”éÈ¹Ñ¥Ñ±•ññ‰…Í”¹Ñ¥Ñ±•ñðœœ°(€€€€€ÍÕ‰©•ÐéÈ¹ÍÕ‰©•Ñññ‰…Í”¹ÍÕ‰©•Ññðœœ°(€€€€€‰½‘äéÈ¹‰½‘åññÈ¹‰½‘å}¡Ñµ±ññ‰…Í”¹‰½‘åñðœœ°(€€€€€¥Í}…Ñ¥Ù”éÈ¹¥Í}…Ñ¥Ù”„ôõ™…±Í”°(€€€€€ÕÁ‘…Ñ•‘}…ÐéÈ¹ÕÁ‘…Ñ•‘}…Ññðœœ°(€€€€€ÕÁ‘…Ñ•‘}‰äéÈ¹ÕÁ‘…Ñ•‘}‰åñðœœ°(€€€€€¥Í•™…Õ±Ðé™…±Í”°(€€€ô¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡ÉÉ…ä¹™É½´¡µ…À¹Ù…±Õ•Ì ¤¤¹µ…À¡Èôø¡ì(€€€¥éÈ¹¥‘ñðœœ°Ñ•µÁ±…Ñ•-•äéÈ¹Ñ•µÁ±…Ñ•}­•ä°Ñ•µÁ±…Ñ•}­•äéÈ¹Ñ•µÁ±…Ñ•}­•ä°Ñ¥Ñ±”éÈ¹Ñ¥Ñ±•ñðœœ°ÍÕ‰©•ÐéÈ¹ÍÕ‰©•Ññðœœ°(€€€‰½‘äéÈ¹‰½‘åñðœœ°¥ÍÑ¥Ù”éÈ¹¥Í}…Ñ¥Ù”„ôõ™…±Í”°¥Í}…Ñ¥Ù”éÈ¹¥Í}…Ñ¥Ù”„ôõ™…±Í”°¥Í•™…Õ±Ðè„…È¹¥Í•™…Õ±Ð°(€€€É½ÕÀéÈ¹É½ÕÁñðœœ°ÕÁ‘…Ñ•‘ÐéÈ¹ÕÁ‘…Ñ•‘}…Ññðœœ°ÕÁ‘…Ñ•‘	äéÈ¹ÕÁ‘…Ñ•‘}‰åñðœœ(€ô¤¤¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•µ…¥±Q•µÁ±…Ñ”¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°…¹¹½Õ¹”œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ­•äõMÑÉ¥¹œ¡ˆ¹Ñ•µÁ±…Ñ•-•åññˆ¹Ñ•µÁ±…Ñ•}­•åñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …­•ä¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÑ•µÁ±…Ñ•-•äœ¤ì(€½¹ÍÐ•á¥ÍÑ¥¹œ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°•µ…¥±}Ñ•µÁ±…Ñ•Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Ñ•µÁ±…Ñ•}­•äõ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡­•ä¥ô™Í•±•Ðõ¥‘€¤¹…Ñ   ¤ôùmt¤ì(€½¹ÍÐ‰½‘åQ•áÐ€ôˆ¹‰½‘äñðˆ¹½¹Ñ•¹Ðñð€œœì(€½¹ÍÐÉ½Üõì(€€€Ñ•¹…¹Ñ}¥éQ99P°(€€€Ñ•µÁ±…Ñ•}­•äé­•ä°(€€€Ñ¥Ñ±”éˆ¹Ñ¥Ñ±•ñðœœ°(€€€ÍÕ‰©•Ðéˆ¹ÍÕ‰©•Ññðœœ°(€€€‰½‘äé‰½‘åQ•áÐ°€€€€€€€€€€€¼¼ƒ¢ÎšZg–ê¯š²’ö7ž
è‰½‘ç¾ò#–:–¾¬‰½‘å}¡Ñµ³¾ò3š&û’â7–"Ã¢¦Ëš²’ö7¢3–¶cšªS–’ÇšV_¾ò$(€€€¥Í}…Ñ¥Ù”è¡ˆ¹¥ÍÑ¥Ù”ôôõ™…±Í•ññˆ¹¥Í}…Ñ¥Ù”ôôõ™…±Í•ññˆ¹¥ÍÑ¥Ù”ôôô™…±Í”ññˆ¹¥Í}…Ñ¥Ù”ôôô™…±Í”œ¤ý™…±Í”éÑÉÕ”°(€€€ÕÁ‘…Ñ•‘}‰äéˆ¹•µ…¥±ñðœœ°(€€€ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¤(€ôì(€¥˜€¡•á¥ÍÑ¥¹œ€˜˜•á¥ÍÑ¥¹lÁt€˜˜•á¥ÍÑ¥¹lÁt¹¥¤É½Ü¹¥€ô•á¥ÍÑ¥¹lÁt¹¥ì(€½¹ÍÐÍ…Ù•õ…Ý…¥Ð‘‰UÁÍ•ÉÐ¡•¹Ø°•µ…¥±}Ñ•µÁ±…Ñ•Ìœ±É½Ü°Ñ•¹…¹Ñ}¥±Ñ•µÁ±…Ñ•}­•äœ¤ì(€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P±ˆ¹•µ…¥±ñðœœ°…¹¹½Õ¹”œ°•µ…¥±}Ñ•µÁ±…Ñ•}Í…Ù•œ°•µ…¥±}Ñ•µÁ±…Ñ•Ìœ±­•ä±¹Õ±°±íÑ•µÁ±…Ñ•}­•äé­•ä±¥Í}…Ñ¥Ù”éÉ½Ü¹¥Í}…Ñ¥Ù•ô±íô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°Ñ•µÁ±…Ñ”éÍ…Ù•‘ô¤ì)ô)™Õ¹Ñ¥½¸™½Éµ…Ñ5•µ‰•ÉI½Ü¡È¥ì½¹ÍÐ™…ÍÑA…ÍÌõÈ¹™…ÍÑ}Á…ÍÌôôõÑÉÕ•ññÈ¹™…ÍÑ}Á…ÍÌôôôÑÉÕ”œìÉ•ÑÕÉ¸í¥éÈ¹¥‘ñðœœ°•µ…¥°éÈ¹•µ…¥±ñðœœ°¹…µ”éÈ¹¹…µ•ññÈ¹‘¥ÍÁ±…å}¹…µ•ñðœœ°Á¡½¹”éÈ¹Á¡½¹•ñðœœ°‰É…¹éÈ¹‰É…¹‘}¹…µ•ñðœœ°‰É…¹‘9…µ”éÈ¹‰É…¹‘}¹…µ•ñðœœ°™ˆéÈ¹™‰}ÕÉ±ññÈ¹™…•‰½½­ññÈ¹™‰ñðœœ°¥œéÈ¹¥}ÕÉ±ññÈ¹¥¹ÍÑ…É…µññÈ¹¥ñðœœ°…Ñ•½ÉäéÈ¹…Ñ•½ÉåññÈ¹Í…±•}…Ñ•½Éåñðœœ°¥¹ÑÉ¼éÈ¹¥¹ÑÉ½ññÈ¹‰É…¹‘}¥¹ÑÉ½ññÈ¹‘•ÍÉ¥ÁÑ¥½¹ñðœœ°™…ÍÑA…ÍÌ°™…ÍÑ}Á…ÍÌé™…ÍÑA…ÍÌ°…‘µ¥¹9½Ñ”éÈ¹…‘µ¥¹}¹½Ñ•ñðœœ°…‘µ¥¹}¹½Ñ”éÈ¹…‘µ¥¹}¹½Ñ•ñðœœ°…‘µ¥¹9½Ñ•ÐéÈ¹…‘µ¥¹}¹½Ñ•}ÕÁ‘…Ñ•‘}…Ññðœœ°É•…Ñ•‘ÐéÈ¹É•…Ñ•‘}…Ññðœœ°ÕÁ‘…Ñ•‘ÐéÈ¹ÕÁ‘…Ñ•‘}…Ññðœôìô)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•5•µ‰•É9½Ñ”¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°É•Ù¥•Üœ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÑ…É•Ðõ¹½Éµµ…¥°¡ˆ¹µ•µ‰•Éµ…¥±ññˆ¹Ñ…É•Ñµ…¥±ñðœœ¤í¥˜ …Ñ…É•Ð¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂGšr–N„µ…¥°œ¤í½¹ÍÐ¹½Ñ”õMÑÉ¥¹œ¡ˆ¹¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤í¥˜ …¹½Ñ”¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¢òã–—–
g¢¢ìœ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ…É•Ð¥ô™Í•±•Ðô©€¤í¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã¦g’ö7šr–N„œ¤ì(€½¹ÍÐ¹½Üõ¹½Ý%Í¼ ¤±±¥¹”õl‘í¹½ÝQ…¥Á•¥Q•áÐ ¥÷¾öp‘íˆ¹•µ…¥±ñðŸžº‡žB¢õt€‘í¹½Ñ•õ€±ÁÉ•ØõMÑÉ¥¹œ¡É½ÝÍlÁt¹…‘µ¥¹}¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤±µ•É•õÁÉ•ØýÁÉ•Ø¬q¸œ­±¥¹”é±¥¹”ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ…É•Ð¥õ€±í…‘µ¥¹}¹½Ñ”éµ•É•±…‘µ¥¹}¹½Ñ•}ÕÁ‘…Ñ•‘}…Ðé¹½Ü±…‘µ¥¹}¹½Ñ•}ÕÁ‘…Ñ•‘}‰äéMÑÉ¥¹œ¡ˆ¹•µ…¥±ñðœœ¤±ÕÁ‘…Ñ•‘}…Ðé¹½Ýô¤ì(€½¹ÍÐÉ•Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ¥±¥­”¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ…É•Ð¥ô™Í•±•Ðõ¥±…‘µ¥¹}¹½Ñ•€¤¹…Ñ   ¤ôùmt¤í™½È¡½¹ÍÐÈ½˜É•Ì¥í½¹ÍÐÉÀõMÑÉ¥¹œ¡È¹…‘µ¥¹}¹½Ñ•ñðœœ¤¹ÑÉ¥´ ¤í…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡È¹¥¥õ€±í…‘µ¥¹}¹½Ñ”éÉÀýÉÀ¬q¸œ­±¥¹”é±¥¹•ô¤¹…Ñ   ¤ôùíô¤íõÉ•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±¹½Ñ”éµ•É•‘ô¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñ5•µ‰•ÉÌ¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P°É•Ù¥•Üœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐµ•µ‰•ÉÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°µ•µ‰•ÉÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€É•ÑÕÉ¸©Í½¹=¬¡µ•µ‰•ÉÌ¹µ…À¡™½Éµ…Ñ5•µ‰•ÉI½Ü¤¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡•Ñ5•µ‰•É!¥ÍÑ½Éä¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±Q99P°É•Ù¥•Üœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ­•äõMÑÉ¥¹œ¡À¹µ•µ‰•É-•åññÀ¹­•åññÀ¹•µ…¥±ññÀ¹Á¡½¹•ññÀ¹‰É…¹‘ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …­•ä¤É•ÑÕÉ¸©Í½¹=¬¡mt¤ì(€½¹ÍÐÄõ•¹½‘•UI%½µÁ½¹•¹Ð œ¨œ­­•ä¬œ¨œ¤ì(€½¹ÍÐmÉ•Ì±Í•ÍÍ¥½¹Ì±•Ù•¹ÑÍtõ…Ý…¥ÐAÉ½µ¥Í”¹…±°¡m‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™½Èô¡•µ…¥°¹¥±¥­”¸‘íÅô±Á¡½¹”¹¥±¥­”¸‘íÅô±‰É…¹‘}¹…µ”¹¥±¥­”¸‘íÅô±¹…µ”¹¥±¥­”¸‘íÅô¤™Í•±•Ðô¨™½É‘•ÈõÉ•…Ñ•‘}…Ð¹‘•Í€¤°‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤°‘‰•Ð¡•¹Ø°•Ù•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¥t¤ì(€½¹ÍÐÍµ…ÀõíôìÍ•ÍÍ¥½¹Ì¹™½É… ¡ÌôùÍµ…ÁmÌ¹¥‘tõÌ¤ì½¹ÍÐ•µ…Àõíôì•Ù•¹ÑÌ¹™½É… ¡”ôù•µ…Ám”¹¥‘tõ”¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É•Ì¹µ…À¡Èôù}™½Éµ…Ñ‘µ¥¹I•¥ÍÑÉ…Ñ¥½¸¡È°Íµ…ÁmÈ¹Í•ÍÍ¥½¹}¥‘uññíô°•µ…Ál¡Íµ…ÁmÈ¹Í•ÍÍ¥½¹}¥‘uññíô¤¹•Ù•¹Ñ}¥‘uññíô¤¤¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡UÁ‘…Ñ•MÑ…™™M½Á”¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÑ…É•Ñµ…¥°õMÑÉ¥¹œ¡ˆ¹Ñ…É•Ñµ…¥±ññˆ¹Ñ…É•Ñ}•µ…¥±ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …Ñ…É•Ñµ…¥°¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂDÑ…É•Ñµ…¥°œ¤ì(€½¹ÍÐÉ…ÜõMÑÉ¥¹œ¡ˆ¹Í½Á•QåÁ•ññˆ¹Í½Á•}ÑåÁ•ñð…±°œ¤¹ÑÉ¥´ ¤ì(€½¹ÍÐÍ½Á•QåÁ”õÉ…ÜôôôÍ•ÍÍ¥½¹ÌœüÍ•ÍÍ¥½¸œè¡É…ÜôôôÍ•É¥•Ìœü•Ù•¹Ðœè¡l…±°œ°•Ù•¹Ðœ°Í•ÍÍ¥½¸t¹¥¹±Õ‘•Ì¡É…Ü¤ýÉ…Üè…±°œ¤¤ì(€½¹ÍÐÍ½Á•Ù•¹Ñ%õÍ½Á•QåÁ”ôôô•Ù•¹ÐœýMÑÉ¥¹œ¡ˆ¹•Ù•¹Ñ%‘ññˆ¹Í½Á•Ù•¹Ñ%‘ññˆ¹Í½Á•}•Ù•¹Ñ}¥‘ñðœœ¤¹ÑÉ¥´ ¤èœœì(€½¹ÍÐ¥‘Ìô¡ˆ¹±¥µ¥ÑM•ÍÍ¥½¹Íññˆ¹Í½Á•M•ÍÍ¥½¹%‘Íññˆ¹Í½Á•}Í•ÍÍ¥½¹}¥‘Íññmt¤¹µ…À¡àôùMÑÉ¥¹œ¡áñðœœ¤¹ÑÉ¥´ ¤¤¹™¥±Ñ•È¡	½½±•…¸¤ì(€½¹ÍÐ‘…Ñ„õíÍ½Á•}ÑåÁ”éÍ½Á•QåÁ”°Í½Á•}•Ù•¹Ñ}¥éÍ½Á•Ù•¹Ñ%°±¥µ¥Ñ}Í•ÍÍ¥½¹ÌéÍ½Á•QåÁ”ôôôÍ•ÍÍ¥½¸œý¥‘Ì¹©½¥¸ œ°œ¤èœœ°ÕÁ‘…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ôì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…™˜œ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™•µ…¥°õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ…É•Ñµ…¥°¥õ€±‘…Ñ„¤ì(€…Ý…¥ÐÍå¹MÑ…™™M•ÍÍ¥½¹A•Éµ¥ÍÍ¥½¹Ì¡•¹Ø±Q99P±Ñ…É•Ñµ…¥°±Í½Á•QåÁ”ôôôÍ•ÍÍ¥½¸œý¥‘Ìémt¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±Í½Á•QåÁ”±Í½Á•Ù•¹Ñ%±±¥µ¥ÑM•ÍÍ¥½¹Ìé¥‘Íô¤ì)ô(((¼¼•ÑÉ••µ•¹ÑQ•µÁ±…Ñ•Ï¾ò#–>[–ú_š&šr'ž¾šr³¾ò3šr–’hÏš²û¾ò3–BG’â/žnã–ºç¢"+¢ÎšZg¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑÉ••µ•¹ÑQ•µÁ±…Ñ”¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Ñ•¹…¹Ñ}…É••µ•¹Ñ}Ñ•µÁ±…Ñ•Ìœ°(€€€Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðô¨™½É‘•ÈõÉ•…Ñ•‘}…Ð¹…Í€¤ì(€€¼¼ƒ–BG’â/žnã–ºç¾òk¢"+¢ÎšZgšÊKšr$Í±½Ñ}¹¿¾ò3¢«–.Wš2šÒûž
èÍ±½Ð€Ä(€½¹ÍÐÍ±½Ñ5…À€ôíôì(€É½ÝÌ¹™½É…  ¡È°¤¤€ôøì(€€€½¹ÍÐÍ±½Ð€ô€¡È¹Í±½Ñ}¹¼€˜˜È¹Í±½Ñ}¹¼€øô€Ä€˜˜È¹Í±½Ñ}¹¼€ðô€Ì¤€üÈ¹Í±½Ñ}¹¼€è€¡¤€¬€Ä¤ì(€€€¥˜€ …Í±½Ñ5…ÁmÍ±½Ñt¤Í±½Ñ5…ÁmÍ±½Ñt€ôÈì(€ô¤ì(€½¹ÍÐÉ•ÍÕ±Ð€ôlÄ°È°Ít¹µ…À¡Í±½Ð€ôøì(€€€½¹ÍÐÈ€ôÍ±½Ñ5…ÁmÍ±½Ñtñðíôì(€€€É•ÑÕÉ¸ì(€€€€€Í±½Ñ}¹¼èÍ±½Ð°(€€€€€±…‰•°èÈ¹±…‰•°ñð€¡Í±½Ð€ôôô€Ä€˜˜È¹Ñ¥Ñ±”€ü€Ÿ¦‚C¢¢·–B#žÒœ€èƒž¾šr°‘íÍ±½Ñõ€¤°(€€€€€Ñ¥Ñ±”èÈ¹Ñ¥Ñ±”ñð€œœ°(€€€€€½¹Ñ•¹ÐèÈ¹½¹Ñ•¹Ðñð€œœ°(€€€€€Ù•ÉÍ¥½¸èÈ¹Ù•ÉÍ¥½¸ñð€œœ°(€€€ôì(€ô¤ì(€É•ÑÕÉ¸©Í½¹=¬¡É•ÍÕ±Ð¤ì)ô((¼¼Í…Ù•É••µ•¹ÑQ•µÁ±…Ñ—¾ò#–Ë–¶cš2–ºhÍ±½Ðƒžjž¾šr³¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡M…Ù•É••µ•¹ÑQ•µÁ±…Ñ”¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°ˆ¹•µ…¥°°ˆ¹Ñ½­•¸°Q99P°€ÍÕÁ•É…‘µ¥¸œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ±½Ð€ô9Õµ‰•È¡ˆ¹Í±½Ñ}¹¼¤ñð€Äì(€¥˜€¡Í±½Ð€ð€ÄñðÍ±½Ð€ø€Ì¤É•ÑÕÉ¸©Í½¹ÉÈ Í±½Ñ}¹¼ƒ–þ¦‚#ž
è€ÅøÌœ¤ì(€½¹ÍÐ¹½Ü€ô¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤ì(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Ñ•¹…¹Ñ}…É••µ•¹Ñ}Ñ•µÁ±…Ñ•Ìœ°(€€€Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í±½Ñ}¹¼õ•Ä¸‘íÍ±½Ñô™Í•±•Ðõ¥‘€¤ì(€¥˜€¡É½ÝÌ¹±•¹Ñ ¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€Ñ•¹…¹Ñ}…É••µ•¹Ñ}Ñ•µÁ±…Ñ•Ìœ°(€€€€€Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í±½Ñ}¹¼õ•Ä¸‘íÍ±½Ñõ€°ì(€€€€€±…‰•°èˆ¹±…‰•°ñðƒž¾šr°‘íÍ±½Ñõ€°(€€€€€Ñ¥Ñ±”èˆ¹Ñ¥Ñ±”ñð€œœ°(€€€€€½¹Ñ•¹Ðèˆ¹½¹Ñ•¹Ðñð€œœ°(€€€€€Ù•ÉÍ¥½¸èˆ¹Ù•ÉÍ¥½¸ñð€œœ°(€€€€€ÕÁ‘…Ñ•‘}…Ðè¹½Ü°(€€€ô¤ì(€ô•±Í”ì(€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°€Ñ•¹…¹Ñ}…É••µ•¹Ñ}Ñ•µÁ±…Ñ•Ìœ°ì(€€€€€¥è•¹% Pœ¤°(€€€€€Ñ•¹…¹Ñ}¥èQ99P°(€€€€€Í±½Ñ}¹¼èÍ±½Ð°(€€€€€±…‰•°èˆ¹±…‰•°ñðƒž¾šr°‘íÍ±½Ñõ€°(€€€€€Ñ¥Ñ±”èˆ¹Ñ¥Ñ±”ñð€œœ°(€€€€€½¹Ñ•¹Ðèˆ¹½¹Ñ•¹Ðñð€œœ°(€€€€€Ù•ÉÍ¥½¸èˆ¹Ù•ÉÍ¥½¸ñð€œœ°(€€€€€ÕÁ‘…Ñ•‘}…Ðè¹½Ü°(€€€€€É•…Ñ•‘}…Ðè¹½Ü°(€€€ô¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡ì½¬èÑÉÕ”ô¤ì)ô((¼¼™½É•…¹•³¾ò#’â7–>¿š*_–*o–º–F+¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡½É•…¹•°¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐ‘°€ô¹•Ü…Ñ” ¤ì‘°¹Í•Ñ!½ÕÉÌ¡‘°¹•Ñ!½ÕÉÌ ¤¬Ðà¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±ì(€€€™½É•}…¹•°éÑÉÕ”°™½É•}…¹•±}Ñ…É•Ñ}¥éˆ¹Ñ…É•ÑM•ÍÍ¥½¹%‘ññ¹Õ±°°™½É•}…¹•±}‘•…‘±¥¹”é‘°¹Ñ½%M=MÑÉ¥¹œ ¤°(€ô¤ì(€½¹ÍÐÍ•Í9…µ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø°ˆ¹Í•ÍÍ¥½¹%°Q99P¤ì(€±•ÐÑ…É•ÑM•Í9…µ”ôœœì(€¥˜€¡ˆ¹Ñ…É•ÑM•ÍÍ¥½¹%¤Ñ…É•ÑM•Í9…µ”õ…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø°ˆ¹Ñ…É•ÑM•ÍÍ¥½¹%°Q99P¤ì(€½¹ÍÐ‘±MÑÈõ€‘í‘°¹•Ñ5½¹Ñ  ¤¬Åô¼‘í‘°¹•Ñ…Ñ” ¥ô€‘í‘°¹•Ñ!½ÕÉÌ ¥ôèÀÁ€ì(€½¹ÍÐÉ•Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹Í•ÍÍ¥½¹%¥ô™É•Ù¥•Ý}ÍÑ…ÑÕÌõ¥¸¸ •Ô•Ü•È•ä”á”àÐ•Ô”á”äØ°•Ô•	”àÔ•Ô••ä•Ø•À•à¤™Í•±•Ðô©€¤ì(€½¹ÍÐÑ½É”€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€™½È€¡½¹ÍÐÈ½˜É•Ì¤ì(€€€½¹ÍÐÍÐ€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø°È¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€€€½¹ÍÐ‘¸€ô•Ñ¥ÍÁ±…å9…µ”¡È¹¹…µ”±È¹‰É…¹‘}¹…µ•ñðœœ±ÍÐ¤ì(€€€ÑÉäì…Ý…¥Ðµ…¥±½É•…¹•±¡½¥”¡•¹Ø±È¹•µ…¥°±‘¸±Í•Í9…µ”±Ñ…É•ÑM•Í9…µ”±‘±MÑÈ±Ñ½É”¤ìô…Ñ íô(€ô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°¹½Ñ¥™¥•éÉ•Ì¹±•¹Ñ¡ô¤ì)ô((¼¼…É••QÉ…¹Í™•Ë¾ò#–îÛšr¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡É••QÉ…¹Í™•È¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œ€ôÉ½ÝÍlÁtì(€€¼¼ƒ¢ê¯’î÷¦¦_¢¶'¾òk–&7–>Ã–þ¦‚#–
Ï–”•µ…¥³¾ò3¦¦_¢¶'¢"–‚Ç–B4•µ…¥°ƒ–Bï–B#¾ò#’â7–>¿¢ºO’â7žnã¦^s¢¢žãžfó–îÛšr¾ò$(€¥˜€ …ˆ¹•µ…¥°¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úl•µ…¥°œ¤ì(€¥˜€¡MÑÉ¥¹œ¡É•œ¹•µ…¥±ñðœœ¤¹Ñ½1½Ý•É…Í” ¤€„ôôMÑÉ¥¹œ¡ˆ¹•µ…¥±ñðœœ¤¹Ñ½1½Ý•É…Í” ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦fCšN7’ösš¶“–‚Ç–B4œ¤ì(€½¹ÍÐ¹½Ü€ô¹½Ý%Í¼ ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±ì(€€€ÑÉ…¹Í™•É}ÍÑ…ÑÕÌèŸ–ÞË–îÛšr|œ°ÑÉ…¹Í™•É}Ñ…É•Ñ}Í•ÍÍ¥½¹}¥éˆ¹Ñ…É•ÑM•ÍÍ¥½¹%°ÑÉ…¹Í™•É}¡½Í•¹}…Ðé¹½Ü°(€ô¤ì(€½¹ÍÐ¹•ÝM•Ì€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹I½Ü¡•¹Ø°ˆ¹Ñ…É•ÑM•ÍÍ¥½¹%°Q99P¤ì(€¥˜€ …¹•ÝM•Ì¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ãžn»š¢g–‚Óš²„œ¤ì(€½¹ÍÐ¹•ÝI•%€ô•¹% Iœ¤ì(€½¹ÍÐ¹•Ý•”€ô…±•”¡¹•ÝM•Ì°Í…™•)Í½¸¡É•œ¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸±mt¤°É•œ¹ÍÑ…±±}½Õ¹Ð¤ì(€½¹ÍÐ¹•ÝQ½Ñ…°€ô¹•Ý•”¬¡9Õµ‰•È¡¹•ÝM•Ì¹‘•Á½Í¥Ð¥ñðÀ¤ì(€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±ì(€€€¥é¹•ÝI•%°Ñ•¹…¹Ñ}¥éQ99P°(€€€Í•ÍÍ¥½¹}¥éˆ¹Ñ…É•ÑM•ÍÍ¥½¹%°•Ù•¹Ñ}¥é±•…¹Ù•¹Ñ%¡¹•ÝM•Ì¹•Ù•¹Ñ}¥¤°(€€€•µ…¥°éÉ•œ¹•µ…¥°°Á±…Ñ™½Éµ}µ•µ‰•É}¥éÉ•œ¹Á±…Ñ™½Éµ}µ•µ‰•É}¥‘ññ¹Õ±°°¹…µ”éÉ•œ¹¹…µ”°Á¡½¹”éÉ•œ¹Á¡½¹”°(€€€‰É…¹‘}¹…µ”éÉ•œ¹‰É…¹‘}¹…µ•ñðœœ°‰É…¹‘}¥¹ÑÉ¼éÉ•œ¹‰É…¹‘}¥¹ÑÉ½ñðœœ°(€€€Í•±±}…Ñ•½ÉäéÉ•œ¹Í•±±}…Ñ•½Éåñðœœ°Í•±±}¥Ñ•µÌéÉ•œ¹Í•±±}¥Ñ•µÍñðœœ°(€€€Í•±±}±¥¹¬éÉ•œ¹Í•±±}±¥¹­ñðœœ°Á¡½Ñ½}ÕÉ°éÉ•œ¹Á¡½Ñ½}ÕÉ±ñðœœ°(€€€•ÅÕ¥Áµ•¹Ñ}©Í½¸éÉ•œ¹•ÅÕ¥Áµ•¹Ñ}©Í½¹ñðíôœ°(€€€ÕÍÑ½µ}™¥•±‘Í}©Í½¸éÉ•œ¹ÕÍÑ½µ}™¥•±‘Í}©Í½¹ñðíôœ°(€€€ÍÑ…±±}½Õ¹ÐéÉ•œ¹ÍÑ…±±}½Õ¹Ð°‘•Á½Í¥Ðé9Õµ‰•È¡¹•ÝM•Ì¹‘•Á½Í¥Ð¥ñðÀ°(€€€É•Ù¥•Ý}ÍÑ…ÑÕÌèŸ–ÞË¦2–>Xœ°(€€€Á…åµ•¹Ñ}ÍÑ…ÑÕÌé¥ÍA…¥‘MÑ…ÑÕÌ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤ýÉ•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌèŸšr«žæÏ¢Êìœ°(€€€…µ½Õ¹Ðé¹•ÝQ½Ñ…°°Ñ½Ñ…±}…µ½Õ¹Ðé¹•ÝQ½Ñ…°°(€€€¡•­¥¹}ÍÑ…ÑÕÌèŸšr«–‚Ç–"Àœ°±•…É}ÍÑ…ÑÕÌèŸšr«šâ–‚Ðœ°‘•Á½Í¥Ñ}É•™Õ¹‘•èŸšr«¦š*ó¦Dœ°(€€€ÍÑ…±±}¹Õµ‰•Èèœœ°Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸éÉ•œ¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¹ñðmtœ°(€€€½É¥¥¹…±}Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥°É•…Ñ•‘}…Ðé¹½Ü°(€ô¤ì(€€¼¼4´ÀÇ¾òk–îÛšršZÃ–‚Óš²‡–B7¦†7š&šâošRçžR£–:–¶@IA(€…Ý…¥Ð‘‰IÁŒ¡•¹Ø°€±…¥µ}Í•ÍÍ¥½¹}Í±½Ðœ°ì(€€€Á}Ñ•¹…¹Ñ}¥èQ99P°Á}Í•ÍÍ¥½¹}¥èˆ¹Ñ…É•ÑM•ÍÍ¥½¹%°Á}ÍÑ…±±}½Õ¹Ðè€¡Í…™•9Õ´¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤(€ô¤ì(€½¹ÍÐ½±‘•”€ô9Õµ‰•È¡É•œ¹…µ½Õ¹ÑñðÀ¤ì(€½¹ÍÐ‘¸€ô•Ñ¥ÍÁ±…å9…µ”¡É•œ¹¹…µ”°É•œ¹‰É…¹‘}¹…µ•ñðœœ¤ì(€½¹ÍÐÑQÉ…¹Í™•È€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€ÑÉäì(€€€¥˜€¡¹•ÝQ½Ñ…°„ôõ½±‘•”¤…Ý…¥Ðµ…¥±QÉ…¹Í™•É¥™™•”¡•¹Ø±É•œ¹•µ…¥°±‘¸±¹•ÝM•Ì¹¹…µ”±¹•ÝQ½Ñ…°±½±‘•”±ÑQÉ…¹Í™•È¤ì(€€€•±Í”…Ý…¥Ðµ…¥±QÉ…¹Í™•ÉM…µ••”¡•¹Ø±É•œ¹•µ…¥°±‘¸±¹•ÝM•Ì¹¹…µ”±ÑQÉ…¹Í™•È¤ì(€ô…Ñ íô(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”°¹•ÝI•%‘ô¤ì)ô(((¼¼ƒŠRŠR à´Èƒ¦š²û¢š?–&¾òkžRÇ¢ÎšZg–ê¯¢š?–&–âÛ–ë¢†3šRÿ¢Êï–îë¢¶Ã¾ò3¦š²û¦G¦†7žRÇš&¦‚¢«–.W¢¢#žº\ƒŠRŠR )™Õ¹Ñ¥½¸™¥ÉÍÑM•ÍÍ¥½¹…Ñ•Y…±Õ”¡Í•Ì°É•œ¤ì(€½¹ÍÐÍ•±•Ñ•€ôÍ…™•)Í½¸¡É•œ€˜˜É•œ¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸°mt¤ì(€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡Í•±•Ñ•¤€˜˜Í•±•Ñ•¹±•¹Ñ ¤É•ÑÕÉ¸Í•±•Ñ•‘lÁtì(€½¹ÍÐ‘…Ñ•Ì€ôÍ…™•)Í½¸¡Í•Ì€˜˜Í•Ì¹‘…Ñ•Í}©Í½¸°mt¤ì(€¥˜€¡ÉÉ…ä¹¥ÍÉÉ…ä¡‘…Ñ•Ì¤€˜˜‘…Ñ•Ì¹±•¹Ñ ¤É•ÑÕÉ¸‘…Ñ•Ì¹µ…À¡ôù¹‘…Ñ•ññ¹ÍÑ…ÉÑ…Ñ•ññ¹‘…åñðœœ¤¹™¥±Ñ•È¡	½½±•…¸¥lÁtñð€œœì(€É•ÑÕÉ¸€¡Í•Ì€˜˜€¡Í•Ì¹‘…Ñ”ñðÍ•Ì¹ÍÑ…ÉÑ}‘…Ñ”ñðÍ•Ì¹ÍÑ…ÉÑ}…Ð¤¤ñð€œœì)ô)™Õ¹Ñ¥½¸‘…åÍ	•™½É•Ù•¹Ð¡•Ù•¹Ñ…Ñ•Y…±Õ”°‰…Í•%Í¼¤ì(€¥˜€ …•Ù•¹Ñ…Ñ•Y…±Õ”¤É•ÑÕÉ¸¹Õ±°ì(€½¹ÍÐ•Ù•¹Ñ…Ñ”€ô¹•Ü…Ñ”¡MÑÉ¥¹œ¡•Ù•¹Ñ…Ñ•Y…±Õ”¤¹Í±¥” À°ÄÀ¤€¬€PÀÀèÀÀèÀÀ¬ÀàèÀÀœ¤ì(€½¹ÍÐ‰…Í•…Ñ”€ô¹•Ü…Ñ”¡MÑÉ¥¹œ¡‰…Í•%Í¼ñð¹½Ý%Í¼ ¤¤¹Í±¥” À°ÄÀ¤€¬€PÀÀèÀÀèÀÀ¬ÀàèÀÀœ¤ì(€¥˜€¡¥Í9…8¡•Ù•¹Ñ…Ñ”¹•ÑQ¥µ” ¤¤ñð¥Í9…8¡‰…Í•…Ñ”¹•ÑQ¥µ” ¤¤¤É•ÑÕÉ¸¹Õ±°ì(€É•ÑÕÉ¸5…Ñ ¹™±½½È ¡•Ù•¹Ñ…Ñ”¹•ÑQ¥µ” ¤€´‰…Í•…Ñ”¹•ÑQ¥µ” ¤¤€¼€àØÐÀÀÀÀÀ¤ì)ô)™Õ¹Ñ¥½¸¹½Éµ…±¥é•I•™Õ¹‘IÕ±•Ì¡É…ÝIÕ±•Ì¤ì(€½¹ÍÐÉÕ±•Í=‰¨€ôÉ…ÝIÕ±•Ì€˜˜ÑåÁ•½˜É…ÝIÕ±•Ì€ôôô€½‰©•Ðœ€üÉ…ÝIÕ±•Ì€èU1Q}IU9}IU1Lì(€½¹ÍÐ±¥ÍÐ€ôÉÉ…ä¹¥ÍÉÉ…ä¡ÉÕ±•Í=‰¨¹ÉÕ±•Ì¤€˜˜ÉÕ±•Í=‰¨¹ÉÕ±•Ì¹±•¹Ñ €üÉÕ±•Í=‰¨¹ÉÕ±•Ì€èU1Q}IU9}IU1L¹ÉÕ±•Ìì(€É•ÑÕÉ¸ìÑÉ…¹Í™•É•••™…Õ±ÐèÍ…™•9Õ´¡ÉÕ±•Í=‰¨¹ÑÉ…¹Í™•É•••™…Õ±Ð¤°ÉÕ±•Ìé±¥ÍÐôì)ô)™Õ¹Ñ¥½¸Á¥­I•™Õ¹‘IÕ±”¡ÉÕ±•Í=‰¨°‘…åÍ	•™½É”¤ì(€½¹ÍÐÉÕ±•Ì€ô¹½Éµ…±¥é•I•™Õ¹‘IÕ±•Ì¡ÉÕ±•Í=‰¨¤¹ÉÕ±•Ìì(€¥˜€¡‘…åÍ	•™½É”€ôôô¹Õ±°ñð‘…åÍ	•™½É”€ôôôÕ¹‘•™¥¹•¤É•ÑÕÉ¸ì­•äèµ…¹Õ…°œ°±…‰•°èŸž‡šÎW¢«–.W–"“šZßš^—šr¾ò3¢®/’âï¢ú›š&/–.WžŠë¢ª4œ°…‘µ¥¹••QåÁ”è™¥á•œ°…‘µ¥¹•”èÀôì(€½¹ÍÐÍ½ÉÑ•€ôÉÕ±•Ì¹Í±¥” ¤¹Í½ÉÐ ¡„±ˆ¤ôø¡9Õµ‰•È¡ˆ¹µ¥¹…åÌ¥ñð´ääää¤´¡9Õµ‰•È¡„¹µ¥¹…åÌ¥ñð´ääää¤¤ì(€É•ÑÕÉ¸Í½ÉÑ•¹™¥¹¡ÉÕ±”ôùì(€€€½¹ÍÐµ¥¸€ôÉÕ±”¹µ¥¹…åÌ€ôôôÕ¹‘•™¥¹•€ü€´ääää€è9Õµ‰•È¡ÉÕ±”¹µ¥¹…åÌ¤ì(€€€½¹ÍÐµ…à€ôÉÕ±”¹µ…á…åÌ€ôôôÕ¹‘•™¥¹•€ü€äääää€è9Õµ‰•È¡ÉÕ±”¹µ…á…åÌ¤ì(€€€É•ÑÕÉ¸‘…åÍ	•™½É”€øôµ¥¸€˜˜‘…åÍ	•™½É”€ðôµ…àì(€ô¤ñðÍ½ÉÑ•‘mÍ½ÉÑ•¹±•¹Ñ ´ÅtñðU1Q}IU9}IU1L¹ÉÕ±•ÍmU1Q}IU9}IU1L¹ÉÕ±•Ì¹±•¹Ñ ´Åtì)ô)™Õ¹Ñ¥½¸…±‘µ¥¹••	åIÕ±”¡ÉÕ±”°Á…¥‘µ½Õ¹Ð¤ì(€½¹ÍÐÁ…¥€ôÍ…™•9Õ´¡Á…¥‘µ½Õ¹Ð¤ì(€¥˜€ …ÉÕ±”¤É•ÑÕÉ¸€Àì(€¥˜€¡ÉÕ±”¹…‘µ¥¹••QåÁ”€ôôô€Á•É•¹Ðœ¤É•ÑÕÉ¸5…Ñ ¹É½Õ¹¡Á…¥€¨€¡9Õµ‰•È¡ÉÕ±”¹…‘µ¥¹••A•É•¹Ð¥ñðÀ¤€¼€ÄÀÀ¤ì(€É•ÑÕÉ¸5…Ñ ¹µ¥¸¡Á…¥°Í…™•9Õ´¡ÉÕ±”¹…‘µ¥¹•”¤¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸…±I•™Õ¹‘MÕ•ÍÑ¥½¸¡•¹Ø°Q99P°É•œ¤ì(€½¹ÍÐmÍ•ÍI½ÝÌ°Ñ•¹…¹ÑÑà°¥Ñ•µ5…Át€ô…Ý…¥ÐAÉ½µ¥Í”¹…±°¡l(€€€‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹Í•ÍÍ¥½¹}¥¥ô™Í•±•Ðô©€¤°(€€€•ÑQ•¹…¹ÑÑà¡•¹Ø±Q99P¤°(€€€}•ÑI•¥ÍÑÉ…Ñ¥½¹%Ñ•µÍ½ÉI•Ì¡•¹Ø°mÉ•t¤¹…Ñ   ¤ôø¡íô¤¤(€t¤ì(€½¹ÍÐÍ•Ì€ôÍ•ÍI½ÝÍlÁtñðíôì(€½¹ÍÐÍ•ÍÍ¥½¹IÕ±•Ì€ôÍ…™•)Í½¸¡Í•Ì¹É•™Õ¹‘}ÉÕ±•Í}©Í½¸°¹Õ±°¤ì(€½¹ÍÐÉÕ±•Í=‰¨€ô¹½Éµ…±¥é•I•™Õ¹‘IÕ±•Ì¡Í•ÍÍ¥½¹IÕ±•ÌñðÑ•¹…¹ÑÑà¹‘•™…Õ±ÑI•™Õ¹‘IÕ±•ÌñðU1Q}IU9}IU1L¤ì(€½¹ÍÐµ½¹•ä€ô}É•¥¹…¹•µ½Õ¹ÑÌ¡É•œ°Í•Ì°¥Ñ•µ5…À€˜˜¥Ñ•µ5…ÁmÉ•œ¹¥‘t¤ì(€½¹ÍÐÁ…¥‘µ½Õ¹Ð€ôÍ…™•9Õ´¡É•œ¹Á…¥‘}…µ½Õ¹Ð¤ñð€¡¥ÍA…¥‘MÑ…ÑÕÌ¡É•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤€ü€¡µ½¹•ä¹…Í¡Q½Ñ…°ñðÍ…™•9Õ´¡É•œ¹…µ½Õ¹ÐñðÉ•œ¹Ñ½Ñ…±}…µ½Õ¹Ð¤¤€è€À¤ì(€½¹ÍÐÉ•ÅÕ•ÍÑ…Ñ”€ôÉ•œ¹ÑÉ…¹Í™•É}¡½Í•¹}…Ðñð¹½Ý%Í¼ ¤ì(€½¹ÍÐ•Ù•¹Ñ…Ñ”€ô™¥ÉÍÑM•ÍÍ¥½¹…Ñ•Y…±Õ”¡Í•Ì°É•œ¤ì(€½¹ÍÐ‘…åÍ	•™½É”€ô‘…åÍ	•™½É•Ù•¹Ð¡•Ù•¹Ñ…Ñ”°É•ÅÕ•ÍÑ…Ñ”¤ì(€½¹ÍÐÍ¹…ÀõÍ•±•Ñ•‘5½‘Õ±•M¹…ÁÍ¡½Ð¡É•œ¤±µ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Í•Ì¹µ½‘Õ±•Í}©Í½¸±íô¤¤±‰Àô¡Í¹…À¹‰½½­¥¹A½±¥ä˜™ÑåÁ•½˜Í¹…À¹‰½½­¥¹A½±¥äôôô½‰©•Ðœ¤ý¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡í‰½½­¥¹A½±¥äéÍ¹…À¹‰½½­¥¹A½±¥åô¤¹‰½½­¥¹A½±¥äéµ½‘Ì¹‰½½­¥¹A½±¥äì(€¥˜¡MÑÉ¥¹œ¡µ½‘Ì¹½Á•É…Ñ¥¹5½‘•ñð…Ñ¥Ù¥Ñäœ¤ôôô‰½½­¥¹œœ€˜˜ÉÉ…ä¹¥ÍÉÉ…ä¡‰À¹…¹•±Q¥•ÉÌ¤€˜˜‰À¹…¹•±Q¥•ÉÌ¹±•¹Ñ ¥ì(€€€±•Ð¡½ÕÉÍ	•™½É”õ‘…åÍ	•™½É”¨ÈÐí½¹ÍÐÑ¥‘ÌõÉ•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½Ñ%‘Ì¡É•œ¤í¥˜¡Ñ¥‘Ì¹±•¹Ñ ¥í½¹ÍÐÍ±½ÑÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Ñ¥µ•Í±½ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ¥‘ÍlÁt¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤í½¹ÍÐÍÑ…ÉÐõ}‰½½­¥¹MÑ…ÉÑ%Í¼¡Í±½ÑÍlÁt¤í¥˜¡ÍÑ…ÉÐ¥¡½ÕÉÍ	•™½É”ô¡¹•Ü…Ñ”¡ÍÑ…ÉÐ¤¹•ÑQ¥µ” ¤µ¹•Ü…Ñ”¡É•ÅÕ•ÍÑ…Ñ”¤¹•ÑQ¥µ” ¤¤¼ÌØÀÀÀÀÀíô(€€€½¹ÍÐÑ¥•Èõ‰À¹…¹•±Q¥•ÉÌ¹™¥¹¡àôù¡½ÕÉÍ	•™½É”øõÍ…™•9Õ´¡à¹µ¥¹!½ÕÉÌ¤¥ññ‰À¹…¹•±Q¥•ÉÍm‰À¹…¹•±Q¥•ÉÌ¹±•¹Ñ ´Åtí½¹ÍÐ…Í õ5…Ñ ¹™±½½È¡Á…¥‘µ½Õ¹Ð©Í…™•9Õ´¡Ñ¥•È¹É•™Õ¹‘A•É•¹Ð¤¼ÄÀÀ¤±É•‘¥Ðõ5…Ñ ¹µ¥¸¡Á…¥‘µ½Õ¹Ðµ…Í ±5…Ñ ¹™±½½È¡Á…¥‘µ½Õ¹Ð©Í…™•9Õ´¡Ñ¥•È¹É•‘¥ÑA•É•¹Ð¤¼ÄÀÀ¤¤ì(€€€É•ÑÕÉ¸íÁ…¥‘µ½Õ¹Ð±•Ù•¹Ñ…Ñ”é•Ù•¹Ñ…Ñ•ñðœœ±É•ÅÕ•ÍÑ…Ñ”±‘…åÍ	•™½É”±¡½ÕÉÍ	•™½É”±É•™Õ¹‘IÕ±•-•äéÑ¥•È¹­•åñðœœ±É•™Õ¹‘IÕ±•1…‰•°éƒ¦‚CžÒ–>[šÚ#¢š?–&¾ösš>C–&4€‘í5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡¡½ÕÉÍ	•™½É”¤¥ôƒ–Â?šf	€±É•™Õ¹‘‘µ¥¹•”é5…Ñ ¹µ…à À±Á…¥‘µ½Õ¹Ðµ…Í µÉ•‘¥Ð¤±É•™Õ¹‘QÉ…¹Í™•É•”èÀ±É•™Õ¹‘µ½Õ¹Ðé…Í ±ÑÉ…¹Í™•ÉÉ•‘¥Ñµ½Õ¹ÐéÉ•‘¥Ð±¹½¹I•™Õ¹‘µ½Õ¹Ðé5…Ñ ¹µ…à À±Á…¥‘µ½Õ¹Ðµ…Í µÉ•‘¥Ð¤±‰½½­¥¹A½±¥äéÑÉÕ•ôì(€ô(€½¹ÍÐÉÕ±”€ôÁ¥­I•™Õ¹‘IÕ±”¡ÉÕ±•Í=‰¨°‘…åÍ	•™½É”¤ì(€½¹ÍÐÉ•™Õ¹‘‘µ¥¹•”€ô5…Ñ ¹µ¥¸¡Á…¥‘µ½Õ¹Ð°…±‘µ¥¹••	åIÕ±”¡ÉÕ±”°Á…¥‘µ½Õ¹Ð¤¤ì(€½¹ÍÐÉ•™Õ¹‘QÉ…¹Í™•É•”€ô5…Ñ ¹µ¥¸¡5…Ñ ¹µ…à À°Á…¥‘µ½Õ¹Ð€´É•™Õ¹‘‘µ¥¹•”¤°Í…™•9Õ´¡ÉÕ±•Í=‰¨¹ÑÉ…¹Í™•É•••™…Õ±Ð¤¤ì(€½¹ÍÐÉ•™Õ¹‘µ½Õ¹Ð€ô5…Ñ ¹µ…à À°Á…¥‘µ½Õ¹Ð€´É•™Õ¹‘‘µ¥¹•”€´É•™Õ¹‘QÉ…¹Í™•É•”¤ì(€É•ÑÕÉ¸íÁ…¥‘µ½Õ¹Ð±•Ù•¹Ñ…Ñ”é•Ù•¹Ñ…Ñ•ñðœœ±É•ÅÕ•ÍÑ…Ñ”±‘…åÍ	•™½É”±É•™Õ¹‘IÕ±•-•äéÉÕ±”¹­•åñðœœ±É•™Õ¹‘IÕ±•1…‰•°éÉÕ±”¹±…‰•±ñðŸ’âï¢ú›š&/–.WžŠë¢ª4œ±É•™Õ¹‘‘µ¥¹•”±É•™Õ¹‘QÉ…¹Í™•É•”±É•™Õ¹‘µ½Õ¹Ð±ÑÉ…¹Í™•ÉÉ•‘¥Ñµ½Õ¹ÐèÀ±¹½¹I•™Õ¹‘µ½Õ¹ÐéÉ•™Õ¹‘‘µ¥¹•”­É•™Õ¹‘QÉ…¹Í™•É•”±‰½½­¥¹A½±¥äé™…±Í•ôì)ô(()™Õ¹Ñ¥½¸}‰½½­¥¹MÑ…ÉÑ%Í¼¡Í±½Ð¥ì(€¥˜ …Í±½Ññð…Í±½Ð¹‘…Ñ•}­•ä¥É•ÑÕÉ¸¹Õ±°í½¹ÍÐÐõMÑÉ¥¹œ¡Í±½Ð¹ÍÑ…ÉÑ}Ñ•áÑñðœÀÀèÀÀœ¤¹ÑÉ¥´ ¥ñðœÀÀèÀÀœì(€½¹ÍÐ¥Í¼õ€‘íÍ±½Ð¹‘…Ñ•}­•åõP‘íÐ¹±•¹Ñ ôôôÔýÐ¬œèÀÀœéÑô¬ÀàèÀÁ€í½¹ÍÐõ¹•Ü…Ñ”¡¥Í¼¤íÉ•ÑÕÉ¸¥Í9…8¡¹•ÑQ¥µ” ¤¤ý¹Õ±°é¹Ñ½%M=MÑÉ¥¹œ ¤ì)ô)™Õ¹Ñ¥½¸}É•Á±…•½¥¹5½‘Õ±•M¹…ÁÍ¡½Ð¡É•œ°µÕÑ…Ñ”¥ì(€½¹ÍÐÉ½ÝÌõÍ…™•)Í½¸¡É•œ˜™É•œ¹ÕÍÑ½µ}™¥•±‘Í}©Í½¸±mt¤í½¹ÍÐ…ÉÈõÉÉ…ä¹¥ÍÉÉ…ä¡É½ÝÌ¤ýÉ½ÝÌ¹Í±¥” ¤émtí±•Ð¡¥Ðõ…ÉÈ¹™¥¹¡àôùà˜™à¹­•äôôô}}‘½¥¹}µ½‘Õ±•Ìœ¤ì(€¥˜ …¡¥Ð¥í¡¥Ðõí­•äè}}‘½¥¹}µ½‘Õ±•Ìœ±Ù…±Õ”éíõôí…ÉÈ¹ÁÕÍ ¡¡¥Ð¥ô¡¥Ð¹Ù…±Õ”ô¡¡¥Ð¹Ù…±Õ”˜™ÑåÁ•½˜¡¥Ð¹Ù…±Õ”ôôô½‰©•Ðœ¤ýì¸¸¹¡¥Ð¹Ù…±Õ•ôéíôíµÕÑ…Ñ”¡¡¥Ð¹Ù…±Õ”¤íÉ•ÑÕÉ¸…ÉÈì)ô)…Íå¹Œ™Õ¹Ñ¥½¸¡I•Í¡•‘Õ±•	½½­¥¹œ¡•¹Ø±ˆ¥ì(€½¹ÍÐPõˆ¹}Ñ•¹…¹Ñ%±É½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤í¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã¦‚CžÒœ¤ì(€½¹ÍÐÉ•œõÉ½ÝÍlÁt±½Ý¸õ…Ý…¥ÐÙ•É¥™¥•‘I•=Ý¹•ÉÕ…É¡•¹Ø±É•œ±ˆ°ŸšRçšržjœ¤í¥˜¡½Ý¸¥É•ÑÕÉ¸½Ý¸ì(€¥˜¡lŸ–ÞË–>[šÚ œ°Ÿ’â7¦2–>Xt¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É•œ¹É•Ù¥•Ý}ÍÑ…ÑÕÍñðœœ¤¥ññlŸ–ÞË¦¢Êìœ°Ÿ–ÞË¦š²øt¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“¦‚CžÒ–ÞËžÖCšv¾ò3’â7¢÷šRçšr|œ¤ì(€½¹ÍÐÍ•ÍI½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹Í•ÍÍ¥½¹}¥¥ô™Í•±•Ðô©€¤í¥˜ …Í•ÍI½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã¦‚CžÒ–‚Óš²„œ¤ì(€½¹ÍÐÍ•ÌõÍ•ÍI½ÝÍlÁt±Õ¹¥ÐõÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥ý…Ý…¥Ð•Ñ=Á•É…Ñ¥½¹U¹¥ÑI½Ü¡•¹Ø±P±É•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥±É•œ¹Í•ÍÍ¥½¹}¥¤é¹Õ±°±µ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Õ¹¥ÐýÍ…™•)Í½¸¡Õ¹¥Ð¹µ½‘Õ±•Í}©Í½¸±íô¤éÍ…™•)Í½¸¡Í•Ì¹µ½‘Õ±•Í}©Í½¸±íô¤¤í¥˜ …µ½‘Ì¹Ý½É­Í¡½ÁM±½ÑÌ˜˜…MÑÉ¥¹œ¡µ½‘Ì¹½Á•É…Ñ¥¹5½‘•ñðœœ¤¹¥¹±Õ‘•Ì ‰½½­¥¹œœ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7’â7šb¿šfšº×¦‚CžÒ–z,œ¤ì(€½¹ÍÐ¹•Ý%õMÑÉ¥¹œ¡ˆ¹Ñ¥µ•Í±½Ñ%‘ñðœœ¤¹ÑÉ¥´ ¤í¥˜ …¹•Ý%¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¦ãšNšZÃžj¦‚CžÒšfšºÔœ¤ì(€½¹ÍÐÕ¹¥Ñ¥±Ñ•ÈõÕ¹¥Ðý€™½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Õ¹¥Ð¹¥¥õ€èœ™½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥õ¥Ì¹¹Õ±°œì(€½¹ÍÐ¹•ÝI½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Ñ¥µ•Í±½ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹Í•ÍÍ¥½¹}¥¥ô‘íÕ¹¥Ñ¥±Ñ•Éô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¹•Ý%¥ô™ÍÑ…ÑÕÌõ•Ä¹½Á•¸™Í•±•Ðô©€¤í¥˜ …¹•ÝI½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ ŸšZÃšfšº×–ÞË’â7–>¿¦‚CžÒš"[’â7–Æ³šZóš¶“ž¦/¦‚žn¸œ¤ì(€½¹ÍÐ½±‘%‘ÌõÉ•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½Ñ%‘Ì¡É•œ¤í¥˜¡½±‘%‘Ì¹¥¹±Õ‘•Ì¡¹•Ý%¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ’öƒ¦ãšNžj–ÂÇšb¿žn»–&7šfšºÔœ¤ì(€½¹ÍÐ½±‘I½ÝÌõ½±‘%‘Ì¹±•¹Ñ ý…Ý…¥Ð‘‰•Ð¡•¹Ø°Ñ¥µ•Í±½ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ¥¸¸ ‘í½±‘%‘Ì¹µ…À¡àôù•¹½‘•UI%½µÁ½¹•¹Ð¡à¤¤¹©½¥¸ œ°œ¥ô¤™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤émtì(€½¹ÍÐÍ¹…ÀõÍ•±•Ñ•‘5½‘Õ±•M¹…ÁÍ¡½Ð¡É•œ¤±Á½±¥äô¡Í¹…À¹‰½½­¥¹A½±¥ä˜™ÑåÁ•½˜Í¹…À¹‰½½­¥¹A½±¥äôôô½‰©•Ðœ¤ýÍ¹…À¹‰½½­¥¹A½±¥äéµ½‘Ì¹‰½½­¥¹A½±¥äì(€½¹ÍÐ½±‘MÑ…ÉÐõ}‰½½­¥¹MÑ…ÉÑ%Í¼¡½±‘I½ÝÍlÁt¤í¥˜¡½±‘MÑ…ÉÐ¥í½¹ÍÐ¡½ÕÉÌô¡¹•Ü…Ñ”¡½±‘MÑ…ÉÐ¤¹•ÑQ¥µ” ¤µ…Ñ”¹¹½Ü ¤¤¼ÌØÀÀÀÀÀí¥˜¡¡½ÕÉÌñÍ…™•9Õ´¡Á½±¥ä¹É•Í¡•‘Õ±•	•™½É•!½ÕÉÌ¤¥É•ÑÕÉ¸©Í½¹ÉÈ¡ƒ–ÞË¢Ú¦;–>¿šRçšršr¦fC¾ò#¦rš>C–&4€‘íÍ…™•9Õ´¡Á½±¥ä¹É•Í¡•‘Õ±•	•™½É•!½ÕÉÌ¥ôƒ–Â?šf¾ò%€¥ô(€½¹ÍÐ½Õ¹Ðõ5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡Í…™•9Õ´¡Í¹…À¹É•Í¡•‘Õ±•½Õ¹Ð¤¤¤±™É•”õ5…Ñ ¹µ…à À±5…Ñ ¹™±½½È¡Í…™•9Õ´¡Á½±¥ä¹™É••I•Í¡•‘Õ±•½Õ¹Ð¤¤¤í±•Ð•áÑÉ„ôÀì(€¥˜¡½Õ¹Ðøõ™É•”¥í¥˜¡Á½±¥ä¹•áÑÉ…I•Í¡•‘Õ±•5½‘”ôôôÉ•©•Ðœ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“¦‚CžÒ–ÞË¦S–>¿šRçšrš²‡šVã’â+¦f@œ¤í•áÑÉ„õÍ…™•9Õ´¡Á½±¥ä¹•áÑÉ…I•Í¡•‘Õ±••”¤í¥˜¡Á½±¥ä¹•áÑÉ…I•Í¡•‘Õ±•5½‘”ôôô¹•Ý}‘•Á½Í¥Ðœ˜˜…•áÑÉ„¥•áÑÉ„õÍ…™•9Õ´¡Í¹…À¹‰½½­¥¹•Á½Í¥Ð¥ô(€½¹ÍÐÅÑäõ5…Ñ ¹µ…à Ä±Í…™•9Õ´¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤±±…¥´õ…Ý…¥Ð‘‰IÁŒ¡•¹Ø°±…¥µ}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éP±Á}Ñ¥µ•Í±½Ñ}¥é¹•Ý%±Á}ÅÑäéÅÑåô¤¹…Ñ ¡”ôø¡í½¬é™…±Í”±•ÉÉ½Èé”¹µ•ÍÍ…•ô¤¤í¥˜ …±…¥µññ±…¥´¹½¬ôôõ™…±Í”¥É•ÑÕÉ¸©Í½¹ÉÈ ¡±…¥´˜™±…¥´¹•ÉÉ½È¥ñðŸšZÃšfšº×–B7¦†7’â7¢ÚÌœ¤ì(€ÑÉåì(€€€™½È¡½¹ÍÐ¥½˜½±‘%‘Ì¥…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éP±Á}Ñ¥µ•Í±½Ñ}¥é¥±Á}ÅÑäéÅÑåô¤ì(€€€½¹ÍÐ˜õ}É•Á±…•½¥¹5½‘Õ±•M¹…ÁÍ¡½Ð¡É•œ±ØôùíØ¹Ñ¥µ•Í±½Ñ%‘Ìõm¹•Ý%‘tíØ¹É•Í¡•‘Õ±•½Õ¹Ðõ½Õ¹Ð¬ÄíØ¹±…ÍÑI•Í¡•‘Õ±•‘Ðõ¹½Ý%Í¼ ¤íØ¹‰½½­¥¹A½±¥äõÁ½±¥åô¤ì(€€€½¹ÍÐ¹•áÑ	…±…¹”õ5…Ñ ¹µ…à À±Í…™•9Õ´¡É•œ¹ÑÉ…¹Í™•É}‰…±…¹•}‘Õ”¤­•áÑÉ„¤ì(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±í‰½½­¥¹}…±•¹‘…É}¥é¹•ÝI½ÝÍlÁt¹‰½½­¥¹}…±•¹‘…É}¥‘ññ¹Õ±°±Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸é)M=8¹ÍÑÉ¥¹¥™ä¡m¹•ÝI½ÝÍlÁt¹‘…Ñ•}­•åt¤±ÕÍÑ½µ}™¥•±‘Í}©Í½¸é)M=8¹ÍÑÉ¥¹¥™ä¡˜¤±ÑÉ…¹Í™•É}‰…±…¹•}‘Õ”é¹•áÑ	…±…¹”±…‘µ¥¹}¹½Ñ”è¡MÑÉ¥¹œ¡É•œ¹…‘µ¥¹}¹½Ñ•ñðœœ¤­€ožÎïžÖÅtƒšRçšr|€‘í½Õ¹Ð¬Åôƒš²‡¾òh‘í½±‘%‘Ì¹©½¥¸ œ°œ¥ôƒŠH€‘í¹•Ý%‘ô€‘í¹½ÝQ…¥Á•¥Q•áÐ ¥õ€¤¹ÑÉ¥´ ¥ô¤ì(€€€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±P±ˆ¹•µ…¥±ññÉ•œ¹•µ…¥°°µ•µ‰•Èœ°‰½½­¥¹}É•Í¡•‘Õ±”œ°É•¥ÍÑÉ…Ñ¥½¹Ìœ±É•œ¹¥±íÑ¥µ•Í±½Ñ%‘Ìé½±‘%‘Ì±É•Í¡•‘Õ±•½Õ¹Ðé½Õ¹Ñô±íÑ¥µ•Í±½Ñ%‘Ìém¹•Ý%‘t±É•Í¡•‘Õ±•½Õ¹Ðé½Õ¹Ð¬Ä±•áÑÉ…•”é•áÑÉ„±½Á•É…Ñ¥½¹U¹¥Ñ%éÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±±ô¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥ÐÉ•½É‘9½Ñ¥™¥…Ñ¥½¸¡•¹Ø±íÑ•¹…¹Ñ%éP±Õ¹¥Ñ%éÉ•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±Í•ÍÍ¥½¹%éÉ•œ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹%éÉ•œ¹¥±•µ…¥°éÉ•œ¹•µ…¥°±•Ù•¹Ñ-•äè‰½½­¥¹}É•Í¡•‘Õ±•œ±Ñ¥Ñ±”èŸ¦‚CžÒ–ÞËšRçšr|œ±‰½‘äéƒšZÃšfšº×¾òh‘í¹•ÝI½ÝÍlÁt¹‘…Ñ•}­•åô€‘í¹•ÝI½ÝÍlÁt¹ÍÑ…ÉÑ}Ñ•áÑñðœõ€±µ•Ñ„éí½±‘Q¥µ•Í±½Ñ%‘Ìé½±‘%‘Ì±¹•ÝQ¥µ•Í±½Ñ%é¹•Ý%±•áÑÉ…•”é•áÑÉ…õô¤¹…Ñ   ¤ôùíô¤ì(€€€É•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±É•Í¡•‘Õ±•½Õ¹Ðé½Õ¹Ð¬Ä±•áÑÉ…•”é•áÑÉ„±‰…±…¹•Õ”é¹•áÑ	…±…¹”±‘…Ñ”é¹•ÝI½ÝÍlÁt¹‘…Ñ•}­•ä±ÍÑ…ÉÐé¹•ÝI½ÝÍlÁt¹ÍÑ…ÉÑ}Ñ•áÐ±•¹é¹•ÝI½ÝÍlÁt¹•¹‘}Ñ•áÑô¤ì(€õ…Ñ ¡”¥í…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éP±Á}Ñ¥µ•Í±½Ñ}¥é¹•Ý%±Á}ÅÑäéÅÑåô¤¹…Ñ   ¤ôùíô¤í™½È¡½¹ÍÐ¥½˜½±‘%‘Ì¥…Ý…¥Ð‘‰IÁŒ¡•¹Ø°±…¥µ}Ñ¥µ•Í±½Ñ}…Á…¥Ñäœ±íÁ}Ñ•¹…¹Ñ}¥éP±Á}Ñ¥µ•Í±½Ñ}¥é¥±Á}ÅÑäéÅÑåô¤¹…Ñ   ¤ôùíô¤íÉ•ÑÕÉ¸©Í½¹ÉÈ ŸšRçšršr«–º3š"C¾ò3–:šfšº×–ÞË’þwžVg¾òhœ¬¡”¹µ•ÍÍ…•ñðŸšr«ž~—¦2¿¢ªœ¤¥ô)ô((¼¼•ÑI•™Õ¹‘MÕ•ÍÑ¥½»¾ò#–ú3–>Ã¦Z/–V¦¢Êï–ö#žª_šf¾ò3–úx]½É­•Èƒ’úw¢ÎšZg–ê¯¢š?–&–âÛ–ë–îë¢¶Ãš&¦‚¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑI•™Õ¹‘MÕ•ÍÑ¥½¸¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99Pô¡ˆ˜™ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ½ÕÀõ…Ý…¥Ð•Ñ	Õ¹‘±•É½ÕÁI•Ì¡•¹Ø±Q99P±É½ÝÍlÁt¤ì(€½¹ÍÐÑ…É•ÑÌõÉ½ÕÀ¹™¥±Ñ•È¡œôø¡¥ÍA…¥‘MÑ…ÑÕÌ¡œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¥ññÍ…™•9Õ´¡œ¹Á…¥‘}…µ½Õ¹Ð¤øÀ¤˜˜…lŸ–ÞË¦¢Êìœ°É•™Õ¹‘•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¤ì(€¥˜ …Ñ…É•ÑÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–Âkšr«–º3š"C’îcš²ûš"[–ÞË–º3š"C¦¢Êìœ¤ì(€½¹ÍÐ‘•Ñ…¥±Ìõmtì(€™½È¡½¹ÍÐœ½˜Ñ…É•ÑÌ¤‘•Ñ…¥±Ì¹ÁÕÍ ¡íÉ•œéœ°¸¸¹…Ý…¥Ð…±I•™Õ¹‘MÕ•ÍÑ¥½¸¡•¹Ø±Q99P±œ¥ô¤ì(€½¹ÍÐÁ…¥‘µ½Õ¹Ðõ‘•Ñ…¥±Ì¹É•‘Õ” ¡¸±à¤ôù¸­à¹Á…¥‘µ½Õ¹Ð°À¤ì(€½¹ÍÐÉ•™Õ¹‘‘µ¥¹•”õ‘•Ñ…¥±Ì¹É•‘Õ” ¡¸±à¤ôù¸­à¹É•™Õ¹‘‘µ¥¹•”°À¤ì(€½¹ÍÐÉ•™Õ¹‘QÉ…¹Í™•É•”õ‘•Ñ…¥±Ì¹É•‘Õ” ¡¸±à¤ôù¸­à¹É•™Õ¹‘QÉ…¹Í™•É•”°À¤ì(€½¹ÍÐÉ•™Õ¹‘µ½Õ¹Ðõ‘•Ñ…¥±Ì¹É•‘Õ” ¡¸±à¤ôù¸­Í…™•9Õ´¡à¹É•™Õ¹‘µ½Õ¹Ð¤°À¤±ÑÉ…¹Í™•ÉÉ•‘¥Ñµ½Õ¹Ðõ‘•Ñ…¥±Ì¹É•‘Õ” ¡¸±à¤ôù¸­Í…™•9Õ´¡à¹ÑÉ…¹Í™•ÉÉ•‘¥Ñµ½Õ¹Ð¤°À¤±¹½¹I•™Õ¹‘µ½Õ¹Ðõ‘•Ñ…¥±Ì¹É•‘Õ” ¡¸±à¤ôù¸­Í…™•9Õ´¡à¹¹½¹I•™Õ¹‘µ½Õ¹Ð¤°À¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±‰Õ¹‘±•½Õ¹ÐéÉ½ÕÀ¹±•¹Ñ ±Á…¥‘µ½Õ¹Ð±É•™Õ¹‘‘µ¥¹•”±É•™Õ¹‘QÉ…¹Í™•É•”±É•™Õ¹‘µ½Õ¹Ð±ÑÉ…¹Í™•ÉÉ•‘¥Ñµ½Õ¹Ð±¹½¹I•™Õ¹‘µ½Õ¹Ð±•Ù•¹Ñ…Ñ”éÑ…É•ÑÌ¹±•¹Ñ øÄüŸžÖ–B#–Ä€œ­Ñ…É•ÑÌ¹±•¹Ñ ¬œƒ–‚Ó¾ò#’úw–B–‚Óš^—šr¢¢#žº_¾ò$œé‘•Ñ…¥±ÍlÁt¹•Ù•¹Ñ…Ñ”±‘…åÍ	•™½É”éÑ…É•ÑÌ¹±•¹Ñ øÄý¹Õ±°é‘•Ñ…¥±ÍlÁt¹‘…åÍ	•™½É”±É•™Õ¹‘IÕ±•1…‰•°éÑ…É•ÑÌ¹±•¹Ñ øÄüŸžÖ–B#–‚Óš²‡–ÞË’úw–B–‚Ó¦š²û¢š?–&–*ƒžâôœé‘•Ñ…¥±ÍlÁt¹É•™Õ¹‘IÕ±•1…‰•°±‘•Ñ…¥±Ìé‘•Ñ…¥±Ì¹µ…À¡àôø¡íÉ•%éà¹É•œ¹¥±Í•ÍÍ¥½¹%éà¹É•œ¹Í•ÍÍ¥½¹}¥±Á…¥‘µ½Õ¹Ðéà¹Á…¥‘µ½Õ¹Ð±É•™Õ¹‘‘µ¥¹•”éà¹É•™Õ¹‘‘µ¥¹•”±É•™Õ¹‘QÉ…¹Í™•É•”éà¹É•™Õ¹‘QÉ…¹Í™•É•”±É•™Õ¹‘µ½Õ¹Ðéà¹É•™Õ¹‘µ½Õ¹Ð±•Ù•¹Ñ…Ñ”éà¹•Ù•¹Ñ…Ñ”±‘…åÍ	•™½É”éà¹‘…åÍ	•™½É”±É•™Õ¹‘IÕ±•1…‰•°éà¹É•™Õ¹‘IÕ±•1…‰•°±ÑÉ…¹Í™•ÉÉ•‘¥Ñµ½Õ¹ÐéÍ…™•9Õ´¡à¹ÑÉ…¹Í™•ÉÉ•‘¥Ñµ½Õ¹Ð¤±¹½¹I•™Õ¹‘µ½Õ¹ÐéÍ…™•9Õ´¡à¹¹½¹I•™Õ¹‘µ½Õ¹Ð¤±¡½ÕÉÍ	•™½É”éà¹¡½ÕÉÍ	•™½É”üý¹Õ±°±‰½½­¥¹A½±¥äè„…à¹‰½½­¥¹A½±¥åô¤¥ô¤ì)ô(¼¼…ÁÁ±åI•™Õ¹“¾ò#šR“–>/žRÏ¢®/¦¢Êï¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡ÁÁ±åI•™Õ¹¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99Pô¡ˆ˜™ˆ¹}Ñ•¹…¹Ñ%¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œõÉ½ÝÍlÁt±½Ý¸õ…Ý…¥ÐÙ•É¥™¥•‘I•=Ý¹•ÉÕ…É¡•¹Ø±É•œ±ˆ°ŸžRÏ¢®/¦š²ûžjœ¤í¥˜¡½Ý¸¥É•ÑÕÉ¸½Ý¸ì(€¥˜¡lŸ–ÞË¦¢Êìœ°É•™Õ¹‘•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË–º3š"C¦¢Êìœ¤ì((€½¹ÍÐÉ½ÕÀõ…Ý…¥Ð•Ñ	Õ¹‘±•É½ÕÁI•Ì¡•¹Ø±Q99P±É•œ¤ì(€¥˜ …É½ÕÀ¹Í½µ”¡œôù¥ÍA…¥‘MÑ…ÑÕÌ¡œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¥ññÍ…™•9Õ´¡œ¹Á…¥‘}…µ½Õ¹Ð¤øÀ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–Âkšr«žŠë¢ª7’îcš²û¾ò3’â7¢÷žRÏ¢®/¦š²øœ¤ì((€½¹ÍÐÍÑ…Ñ•Ìõmtì(€ÑÉåì(€€€™½È¡½¹ÍÐœ½˜É½ÕÀ¥ì(€€€€€¥˜¡lŸ–ÞË¦¢Êìœ°É•™Õ¹‘•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¥½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐÍÑ…Ñ”õ…Ý…¥Ð…ÁÑÕÉ•I•™Õ¹‘I•Í½ÕÉ•MÑ…Ñ”¡•¹Ø±Q99P±œ¤ì(€€€€€ÍÑ…Ñ•Ì¹ÁÕÍ ¡ÍÑ…Ñ”¤ì((€€€€€…Ý…¥ÐÉ•±•…Í•I•™Õ¹‘I•Í½ÕÉ•ÍMÑÉ¥Ð¡•¹Ø±Q99P±ÍÑ…Ñ”°Ÿ¦š²ûžRÏ¢®/¦/šRû’ö7žö»¾ò?šfšº×–’ÇšV\œ¤ì(€€€€€¥˜¡ÍÑ…Ñ”¹…Ñ¥Ù”¥ì(€€€€€€€…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø±Q99P±œ°µÍÑ…Ñ”¹ÅÑä¤ì(€€€€€€€ÍÑ…Ñ”¹½Õ¹Ñ‘©ÕÍÑ•õÑÉÕ”ì(€€€€€ô((€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥õ€±ì(€€€€€€€ÑÉ…¹Í™•É}ÍÑ…ÑÕÌèŸ¦¢Êï’â´œ±ÑÉ…¹Í™•É}¡½Í•¹}…Ðé¹½Ý%Í¼ ¤°(€€€€€€€ÍÑ…±±}¹Õµ‰•Èé¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÉ•±•…Í•œ±Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°(€€€€€ô¤ì(€€€ô(€õ…Ñ ¡”¥ì(€€€€¼¼ƒ–ÞË¢fWžBžjšVÓžÖ–£¦£–n{–ú§¾òk–‚Ç–B7ž.š/Ž–B7¦†7Ž’ö7žö»Žšfšº×’â¢Öß–n{–ú§Ž(€€€™½È¡½¹ÍÐÍÑ…Ñ”½˜ÍÑ…Ñ•Ì¹Í±¥” ¤¹É•Ù•ÉÍ” ¤¥ì(€€€€€½¹ÍÐœõÍÑ…Ñ”¹É•œì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥õ€±ì(€€€€€€€ÑÉ…¹Í™•É}ÍÑ…ÑÕÌéœ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍññ¹Õ±°±ÑÉ…¹Í™•É}¡½Í•¹}…Ðéœ¹ÑÉ…¹Í™•É}¡½Í•¹}…Ñññ¹Õ±°°(€€€€€€€ÍÑ…±±}¹Õµ‰•Èéœ¹ÍÑ…±±}¹Õµ‰•Éññ¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌéœ¹Í•…Ñ}¡½¥•}ÍÑ…ÑÕÍññ¹Õ±°°(€€€€€€€Í•…Ñ}¡½¥•}ÑåÁ”éœ¹Í•…Ñ}¡½¥•}ÑåÁ•ññ¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðéœ¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ñññ¹Õ±°(€€€€€ô¤¹…Ñ   ¤ôùíô¤ì(€€€€€¥˜¡ÍÑ…Ñ”¹½Õ¹Ñ‘©ÕÍÑ•¥…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø±Q99P±œ±ÍÑ…Ñ”¹ÅÑä¤¹…Ñ   ¤ôùíô¤ì(€€€€€…Ý…¥ÐÉ•ÍÑ½É•I•™Õ¹‘I•Í½ÕÉ•MÑ…Ñ”¡•¹Ø±Q99P±ÍÑ…Ñ”¤¹…Ñ   ¤ôùíô¤ì(€€€ô(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦š²ûžRÏ¢®/šÊKšr'–º3š"C¾ò3žÎïžÖÇ–ÞË–n{–ú§šVÓžÖ¢ÎšZg¾òhœ¬¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸšr«ž~—¦2¿¢ªœ¤¤ì(€ô((€™½È¡½¹ÍÐÍÑ…Ñ”½˜ÍÑ…Ñ•Ì¥ì(€€€½¹ÍÐœõÍÑ…Ñ”¹É•œì(€€€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P±ˆ¹•µ…¥±ññœ¹•µ…¥°°µ•µ‰•Èœ°É•™Õ¹‘}É•ÅÕ•ÍÑ•‘}É•±•…Í•}…Á…¥Ñå}…¹‘}ÍÑ…±°œ°É•¥ÍÑÉ…Ñ¥½¹Ìœ±œ¹¥°(€€€€€íÑÉ…¹Í™•É}ÍÑ…ÑÕÌéœ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍô±íÑÉ…¹Í™•É}ÍÑ…ÑÕÌèŸ¦¢Êï’â´ô°(€€€€€í…Á…¥Ñå}‘•±Ñ„éÍÑ…Ñ”¹…Ñ¥Ù”üµÍÑ…Ñ”¹ÅÑäèÀ±‰Õ¹‘±•}É½ÕÀéÉ½ÕÀ¹±•¹Ñ øÄ±ÍÑ…±±}É•±•…Í”éÑÉÕ•ô(€€€€¤¹…Ñ   ¤ôùíô¤ì(€ô(€ÑÉåì(€€€½¹ÍÐÍ•Í9…µ”õ…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø±É•œ¹Í•ÍÍ¥½¹}¥±Q99P¤±ÑŒõ…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø±Q99P¤ì(€€€…Ý…¥Ðµ…¥±I•™Õ¹‘I•ÅÕ•ÍÑI••¥Ù•¡•¹Ø±É•œ¹•µ…¥°±•Ñ¥ÍÁ±…å9…µ”¡É•œ¹¹…µ”±É•œ¹‰É…¹‘}¹…µ•ñðœœ±…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø±É•œ¹Í•ÍÍ¥½¹}¥±Q99P¤¤±Í•Í9…µ”±ÑŒ¤ì(€õ…Ñ ¡”¥íô(€™½È¡½¹ÍÐÍÑ…Ñ”½˜ÍÑ…Ñ•Ì¥…Ý…¥ÐÉ•½É‘9½Ñ¥™¥…Ñ¥½¸¡•¹Ø±íÑ•¹…¹Ñ%éQ99P±Õ¹¥Ñ%éÍÑ…Ñ”¹É•œ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±Í•ÍÍ¥½¹%éÍÑ…Ñ”¹É•œ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹%éÍÑ…Ñ”¹É•œ¹¥±•µ…¥°éÍÑ…Ñ”¹É•œ¹•µ…¥°±•Ù•¹Ñ-•äèÉ•™Õ¹‘}É•ÅÕ•ÍÑ•œ±Ñ¥Ñ±”èŸ¦š²ûžRÏ¢®/–ÞË¦–èœ±‰½‘äèŸ’âï¢ú›–ÞËšRÛ–"Ãš
£žj¦š²ûžRÏ¢®/Žœ±µ•Ñ„éíõô¤¹…Ñ   ¤ôùíô¤ì(€™½È¡½¹ÍÐÍ¥½˜l¸¸¹¹•ÜM•Ð¡É½ÕÀ¹µ…À¡àôùà¹Í•ÍÍ¥½¹}¥¤¹™¥±Ñ•È¡	½½±•…¸¤¥t¥…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±Q99P±Í¥¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±‰Õ¹‘±•½Õ¹ÐéÉ½ÕÀ¹±•¹Ñ¡ô¤ì)ô(¼¼½¹™¥ÉµI•™Õ¹“¾ò#–ú3–>ÃžŠë¢ª7¦š²û¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡½¹™¥ÉµI•™Õ¹¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99Pô¡ˆ˜™ˆ¹}Ñ•¹…¹Ñ%¤ì(€¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì((€½¹ÍÐÉ½ÕÀõ…Ý…¥Ð•Ñ	Õ¹‘±•É½ÕÁI•Ì¡•¹Ø±Q99P±É½ÝÍlÁt¤ì(€½¹ÍÐÑ…É•ÑÌõÉ½ÕÀ¹™¥±Ñ•È¡œôø…lŸ–ÞË¦¢Êìœ°É•™Õ¹‘•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤˜˜¡¥Í…Á…¥Ñå%¹…Ñ¥Ù•QÉ…¹Í™•ÉMÑ…ÑÕÌ¡œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ¥ññ¥ÍA…¥‘MÑ…ÑÕÌ¡œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¥ññÍ…™•9Õ´¡œ¹Á…¥‘}…µ½Õ¹Ð¤øÀ¤¤ì(€¥˜ …Ñ…É•ÑÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË–º3š"C¦¢Êïš"[šÊKšr'–>¿¢fWžB¢ÎšZdœ¤ì((€½¹ÍÐÍÕ•ÍÑ¥½¹Ìõmtí™½È¡½¹ÍÐœ½˜Ñ…É•ÑÌ¥ÍÕ•ÍÑ¥½¹Ì¹ÁÕÍ ¡íÉ•œéœ°¸¸¹…Ý…¥Ð…±I•™Õ¹‘MÕ•ÍÑ¥½¸¡•¹Ø±Q99P±œ¥ô¤ì(€½¹ÍÐÉ•Í•ÉÙ•‘QÉ…¹Í™•ÉÉ•‘¥ÐõÍÕ•ÍÑ¥½¹Ì¹É•‘Õ” ¡¸±à¤ôù¸­Í…™•9Õ´¡à¹ÑÉ…¹Í™•ÉÉ•‘¥Ñµ½Õ¹Ð¤°À¤ì(€¥˜¡É•Í•ÉÙ•‘QÉ…¹Í™•ÉÉ•‘¥ÐøÀ€˜˜MÑÉ¥¹œ¡ˆ¹™½É•…Í¡I•™Õ¹‘ñðœœ¤„ôôÑÉÕ”œ¥É•ÑÕÉ¸©Í½¹ÉÈ¡ƒš¶“¦‚CžÒ’úw–:–>[šÚ#¢š?–&šr$9P‘í5…Ñ ¹É½Õ¹¡É•Í•ÉÙ•‘QÉ…¹Í™•ÉÉ•‘¥Ð¥ôƒ–>¿¢ö'’â/š²‡’öÿžR£Ž¢®/–#’öÿžR£Ž3šRçšr¾ò?¢ö'–‚ÓŽ7’þwžVg–:’îcš²û¾òo¢.—žŠë–ºkšRçž
ëž>û¦G¦š²û¾ò3¢®/šb;žŠë¦ãšNž>û¦G¦š²û¢fWžBŽ	€¤ì(€½¹ÍÐÁ…¥‘Q½Ñ…°õÍÕ•ÍÑ¥½¹Ì¹É•‘Õ” ¡¸±à¤ôù¸­à¹Á…¥‘µ½Õ¹Ð°À¤ì(€½¹ÍÐÍÕ•ÍÑ•‘‘µ¥¸õÍÕ•ÍÑ¥½¹Ì¹É•‘Õ” ¡¸±à¤ôù¸­à¹É•™Õ¹‘‘µ¥¹•”°À¤ì(€½¹ÍÐÍÕ•ÍÑ•‘QÉ…¹Í™•ÈõÍÕ•ÍÑ¥½¹Ì¹É•‘Õ” ¡¸±à¤ôù¸­à¹É•™Õ¹‘QÉ…¹Í™•É•”°À¤ì(€½¹ÍÐ…‘µ¥¹Q½Ñ…°ô¡ˆ¹É•™Õ¹‘‘µ¥¹•”„ôõÕ¹‘•™¥¹•‘ññˆ¹É•™Õ¹‘}…‘µ¥¹}™•”„ôõÕ¹‘•™¥¹•¤ýÍ…™•9Õ´¡ˆ¹É•™Õ¹‘‘µ¥¹•”üýˆ¹É•™Õ¹‘}…‘µ¥¹}™•”¤éÍÕ•ÍÑ•‘‘µ¥¸ì(€½¹ÍÐÑÉ…¹Í™•ÉQ½Ñ…°ô¡ˆ¹É•™Õ¹‘QÉ…¹Í™•É•”„ôõÕ¹‘•™¥¹•‘ññˆ¹É•™Õ¹‘}ÑÉ…¹Í™•É}™•”„ôõÕ¹‘•™¥¹•¤ýÍ…™•9Õ´¡ˆ¹É•™Õ¹‘QÉ…¹Í™•É•”üýˆ¹É•™Õ¹‘}ÑÉ…¹Í™•É}™•”¤éÍÕ•ÍÑ•‘QÉ…¹Í™•Èì(€¥˜¡…‘µ¥¹Q½Ñ…°ðÁññÑÉ…¹Í™•ÉQ½Ñ…°ðÀ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦¢Êïš&¦‚’â7–>¿–Â?šZð€Àœ¤ì(€¥˜¡…‘µ¥¹Q½Ñ…°­ÑÉ…¹Í™•ÉQ½Ñ…°ùÁ…¥‘Q½Ñ…°¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢†3šRÿ¢Êï¢"¢ö'–âÏš&/žê3¢Êï’â7–>¿–’ŸšZó–ÞËžæÏ¦G¦†4œ¤ì((€™Õ¹Ñ¥½¸…±±½…Ñ”¡Ñ½Ñ…°¥í±•ÐÕÍ•ôÀíÉ•ÑÕÉ¸ÍÕ•ÍÑ¥½¹Ì¹µ…À ¡à±¤¤ôùí¥˜¡¤ôôõÍÕ•ÍÑ¥½¹Ì¹±•¹Ñ ´Ä¥É•ÑÕÉ¸5…Ñ ¹µ…à À±Ñ½Ñ…°µÕÍ•¤í½¹ÍÐØõÁ…¥‘Q½Ñ…°øÀý5…Ñ ¹™±½½È¡Ñ½Ñ…°©à¹Á…¥‘µ½Õ¹Ð½Á…¥‘Q½Ñ…°¤èÀíÕÍ•¬õØíÉ•ÑÕÉ¸Øíô¤íô(€½¹ÍÐ…‘µ¥¹±±½Œõ…±±½…Ñ”¡…‘µ¥¹Q½Ñ…°¤±ÑÉ…¹Í™•É±±½Œõ…±±½…Ñ”¡ÑÉ…¹Í™•ÉQ½Ñ…°¤ì((€½¹ÍÐ…ÁÁ±¥•õmt±É•…Ñ•‘±±½%‘Ìõmt±É•…Ñ•‘1•‘•É%‘Ìõmt±‘¥É•ÑI•±•…Í•MÑ…Ñ•Ìõmtì(€±•ÐÉ•™Õ¹‘Q½Ñ…°ôÀì(€ÑÉåì(€€€™½È¡±•Ð¤ôÀí¤ñÍÕ•ÍÑ¥½¹Ì¹±•¹Ñ í¤¬¬¥ì(€€€€€½¹ÍÐàõÍÕ•ÍÑ¥½¹Ím¥t±œõà¹É•œì(€€€€€½¹ÍÐ™½É•…Í õMÑÉ¥¹œ¡ˆ¹™½É•…Í¡I•™Õ¹‘ñðœœ¤ôôôÑÉÕ”œì(€€€€€½¹ÍÐÉ•™Õ¹‘µ½Õ¹Ðõà¹‰½½­¥¹A½±¥äý5…Ñ ¹µ…à À±5…Ñ ¹µ¥¸¡à¹Á…¥‘µ½Õ¹Ð±Í…™•9Õ´¡à¹É•™Õ¹‘µ½Õ¹Ð¤¬¡™½É•…Í ýÍ…™•9Õ´¡à¹ÑÉ…¹Í™•ÉÉ•‘¥Ñµ½Õ¹Ð¤èÀ¤¤¤é5…Ñ ¹µ…à À±à¹Á…¥‘µ½Õ¹Ðµ…‘µ¥¹±±½m¥tµÑÉ…¹Í™•É±±½m¥t¤ì(€€€€€É•™Õ¹‘Q½Ñ…°¬õÉ•™Õ¹‘µ½Õ¹Ðì(€€€€€½¹ÍÐÉÕ±•1…‰•°õMÑÉ¥¹œ¡ˆ¹É•™Õ¹‘IÕ±•1…‰•±ññˆ¹É•™Õ¹‘}ÉÕ±•}±…‰•±ññà¹É•™Õ¹‘IÕ±•1…‰•±ñðŸ’âï¢ú›š&/–.WžŠë¢ª4œ¤¹Í±¥” À°ÄÈÀ¤ì((€€€€€€¼¼ƒ¢.—’âï¢ú›žnÓš:—–ú{–ÞË’îcš²ûž.š/žŠë¢ª7¦š²û¾ò3–#žR£–>¿–n{–ú§šZç–ò?¦/šRû¢ÎšêCŽ(€€€€€¥˜ …¥Í…Á…¥Ñå%¹…Ñ¥Ù•QÉ…¹Í™•ÉMÑ…ÑÕÌ¡œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌ¤¥ì(€€€€€€€½¹ÍÐÍÑ…Ñ”õ…Ý…¥Ð…ÁÑÕÉ•I•™Õ¹‘I•Í½ÕÉ•MÑ…Ñ”¡•¹Ø±Q99P±œ¤ì(€€€€€€€‘¥É•ÑI•±•…Í•MÑ…Ñ•Ì¹ÁÕÍ ¡ÍÑ…Ñ”¤ì(€€€€€€€…Ý…¥ÐÉ•±•…Í•I•™Õ¹‘I•Í½ÕÉ•ÍMÑÉ¥Ð¡•¹Ø±Q99P±ÍÑ…Ñ”°Ÿ¦š²ûžŠë¢ª7¦/šRû’ö7žö»¾ò?šfšº×–’ÇšV\œ¤ì(€€€€€€€¥˜¡ÍÑ…Ñ”¹…Ñ¥Ù”¥ì(€€€€€€€€€…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø±Q99P±œ°µÍÑ…Ñ”¹ÅÑä¤ì(€€€€€€€€€ÍÑ…Ñ”¹½Õ¹Ñ‘©ÕÍÑ•õÑÉÕ”ì(€€€€€€€ô(€€€€€ô((€€€€€½¹ÍÐÕÁõì(€€€€€€€ÑÉ…¹Í™•É}ÍÑ…ÑÕÌèŸ–ÞË¦¢Êìœ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌèŸ–ÞË¦¢Êìœ°(€€€€€€€É•™Õ¹‘}…µ½Õ¹ÐéÉ•™Õ¹‘µ½Õ¹Ð±É•™Õ¹‘}…‘µ¥¹}™•”é…‘µ¥¹±±½m¥t±É•™Õ¹‘}ÑÉ…¹Í™•É}™•”éÑÉ…¹Í™•É±±½m¥t°(€€€€€€€É•™Õ¹‘}ÉÕ±•}±…‰•°éÉÕ±•1…‰•°±É•™Õ¹‘•‘}…Ðé¹½Ý%Í¼ ¤±É•™Õ¹‘}¹½Ñ”éMÑÉ¥¹œ¡ˆ¹É•™Õ¹‘9½Ñ•ñðœœ¤¹Í±¥” À°ÔÀÀ¤°(€€€€€€€ÍÑ…±±}¹Õµ‰•Èé¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÉ•±•…Í•œ±Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°(€€€€€ôì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥õ€±ÕÁ¤ì(€€€€€…ÁÁ±¥•¹ÁÕÍ ¡íœ±ÕÁ‘ô¤ì((€€€€€±•ÐÉ•™Õ¹‘A…åµ•¹Ñ%õ¹Õ±°ì(€€€€€½¹ÍÐÁ…¥‘I½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥ô™ÍÑ…ÑÕÌõ•Ä¸•Ô•Ü•È•Ü•È•	•à•”á™Í•±•Ðõ¥™½É‘•ÈõÁ…¥‘}…Ð¹‘•ÍŒ™±¥µ¥ÐôÅ€¤¹…Ñ   ¤ôùmt¤ì(€€€€€¥˜¡Á…¥‘I½ÝÍlÁt¥É•™Õ¹‘A…åµ•¹Ñ%õÁ…¥‘I½ÝÍlÁt¹¥ì((€€€€€¥˜¡É•™Õ¹‘µ½Õ¹ÐøÀ¥ì(€€€€€€€½¹ÍÐÁ…±%õ•¹% A0œ¤ì(€€€€€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±í¥éÁ…±%±Ñ•¹…¹Ñ}¥éQ99P±Á…åµ•¹Ñ}¥éÉ•™Õ¹‘A…åµ•¹Ñ%±É•¥ÍÑÉ…Ñ¥½¹}¥éœ¹¥±Í•ÍÍ¥½¹}¥éœ¹Í•ÍÍ¥½¹}¥±½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥éœ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±…±±½…Ñ¥½¹}ÑåÁ”èÉ•™Õ¹œ±…µ½Õ¹ÐéÉ•™Õ¹‘µ½Õ¹Ð±É•…Ñ•‘}…Ðé¹½Ý%Í¼ ¥ô¤ì(€€€€€€€É•…Ñ•‘±±½%‘Ì¹ÁÕÍ ¡Á…±%¤ì(€€€€€€€½¹ÍÐ±•‘%õ…Ý…¥ÐÝÉ¥Ñ•¥¹…¹•1•‘•È¡•¹Ø±Q99P±íÉ•¥ÍÑÉ…Ñ¥½¹%éœ¹¥±Í•ÍÍ¥½¹%éœ¹Í•ÍÍ¥½¹}¥±Á…åµ•¹Ñ%éÉ•™Õ¹‘A…åµ•¹Ñ%±•¹ÑÉåQåÁ”èÉ•™Õ¹‘}ÁÉ¥¹¥Á…°œ±…µ½Õ¹ÐéÉ•™Õ¹‘µ½Õ¹Ð±‘¥É•Ñ¥½¸è‘•‰¥Ðœ±µ•µ¼èŸ–º3š"C¦š²øœ±ÍÑÉ¥ÐéÑÉÕ”±µ•Ñ„éíÁ…¥‘µ½Õ¹Ðéà¹Á…¥‘µ½Õ¹Ð±…‘µ¥¹•”é…‘µ¥¹±±½m¥t±ÑÉ…¹Í™•É•”éÑÉ…¹Í™•É±±½m¥uõô¤ì(€€€€€€€¥˜¡±•‘%¥É•…Ñ•‘1•‘•É%‘Ì¹ÁÕÍ ¡±•‘%¤ì(€€€€€ô(€€€ô(€õ…Ñ ¡”¥ì(€€€€¼¼ƒ–n{–ú§šr³š²‡¦GšÖ¢"–‚Ç–B7ž.š,(€€€™½È¡½¹ÍÐ¥½˜É•…Ñ•‘1•‘•É%‘Ì¥…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°™¥¹…¹•}±•‘•Èœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€™½È¡½¹ÍÐ¥½˜É•…Ñ•‘±±½%‘Ì¥…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¥¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€™½È¡½¹ÍÐà½˜…ÁÁ±¥•¹Í±¥” ¤¹É•Ù•ÉÍ” ¤¥ì(€€€€€½¹ÍÐœõà¹œì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥õ€±ì(€€€€€€€ÑÉ…¹Í™•É}ÍÑ…ÑÕÌéœ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍññ¹Õ±°±Á…åµ•¹Ñ}ÍÑ…ÑÕÌéœ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñðœœ°(€€€€€€€É•™Õ¹‘}…µ½Õ¹ÐéÍ…™•9Õ´¡œ¹É•™Õ¹‘}…µ½Õ¹Ð¤±É•™Õ¹‘}…‘µ¥¹}™•”éÍ…™•9Õ´¡œ¹É•™Õ¹‘}…‘µ¥¹}™•”¤°(€€€€€€€É•™Õ¹‘}ÑÉ…¹Í™•É}™•”éÍ…™•9Õ´¡œ¹É•™Õ¹‘}ÑÉ…¹Í™•É}™•”¤±É•™Õ¹‘}ÉÕ±•}±…‰•°éœ¹É•™Õ¹‘}ÉÕ±•}±…‰•±ñðœœ°(€€€€€€€É•™Õ¹‘•‘}…Ðéœ¹É•™Õ¹‘•‘}…Ñññ¹Õ±°±É•™Õ¹‘}¹½Ñ”éœ¹É•™Õ¹‘}¹½Ñ•ñðœœ°(€€€€€€€ÍÑ…±±}¹Õµ‰•Èéœ¹ÍÑ…±±}¹Õµ‰•Éññ¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌéœ¹Í•…Ñ}¡½¥•}ÍÑ…ÑÕÍññ¹Õ±°°(€€€€€€€Í•…Ñ}¡½¥•}ÑåÁ”éœ¹Í•…Ñ}¡½¥•}ÑåÁ•ññ¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðéœ¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ñññ¹Õ±°(€€€€€ô¤¹…Ñ   ¤ôùíô¤ì(€€€ô(€€€™½È¡½¹ÍÐÍÑ…Ñ”½˜‘¥É•ÑI•±•…Í•MÑ…Ñ•Ì¹Í±¥” ¤¹É•Ù•ÉÍ” ¤¥ì(€€€€€¥˜¡ÍÑ…Ñ”¹½Õ¹Ñ‘©ÕÍÑ•¥…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø±Q99P±ÍÑ…Ñ”¹É•œ±ÍÑ…Ñ”¹ÅÑä¤¹…Ñ   ¤ôùíô¤ì(€€€€€…Ý…¥ÐÉ•ÍÑ½É•I•™Õ¹‘I•Í½ÕÉ•MÑ…Ñ”¡•¹Ø±Q99P±ÍÑ…Ñ”¤¹…Ñ   ¤ôùíô¤ì(€€€ô(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦š²ûžŠë¢ª7šÊKšr'–º3š"C¾ò3žÎïžÖÇ–ÞË–n{–ú§šr³š²‡šVÓžÖ¢ÎšZg¾òhœ¬¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸšr«ž~—¦2¿¢ªœ¤¤ì(€ô((€€¼¼ƒ¦v{š‚ã–þ–&¿’ösžR£¾ò#ž¢÷š‚ãŽµ…¥³ŽžÖÇ¢¢#¾ò'’â7¦bï–†{¦š²ûš"C–*Ž(€™½È¡±•Ð¤ôÀí¤ñÍÕ•ÍÑ¥½¹Ì¹±•¹Ñ í¤¬¬¥ì(€€€½¹ÍÐàõÍÕ•ÍÑ¥½¹Ím¥t±œõà¹É•œ±É•™Õ¹‘µ½Õ¹Ðõ5…Ñ ¹µ…à À±à¹Á…¥‘µ½Õ¹Ðµ…‘µ¥¹±±½m¥tµÑÉ…¹Í™•É±±½m¥t¤ì(€€€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P±ˆ¹•µ…¥±ñðœœ°™¥¹…¹•}…‘µ¥¸œ°É•™Õ¹‘}½¹™¥Éµ•‘}É•±•…Í•}…Á…¥Ñå}…¹‘}ÍÑ…±°œ°É•¥ÍÑÉ…Ñ¥½¹Ìœ±œ¹¥°(€€€€€íÑÉ…¹Í™•É}ÍÑ…ÑÕÌéœ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍô±íÑÉ…¹Í™•É}ÍÑ…ÑÕÌèŸ–ÞË¦¢Êìœ±É•™Õ¹‘}…µ½Õ¹ÐéÉ•™Õ¹‘µ½Õ¹Ñô°(€€€€€í‰Õ¹‘±•}É½ÕÀéÑ…É•ÑÌ¹±•¹Ñ øÄ±É•™Õ¹‘}…µ½Õ¹ÐéÉ•™Õ¹‘µ½Õ¹Ñô(€€€€¤¹…Ñ   ¤ôùíô¤ì(€€€ÑÉåì(€€€€€½¹ÍÐÍ•Í9…µ”õ…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø±œ¹Í•ÍÍ¥½¹}¥±Q99P¤±ÑŒõ…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø±Q99P¤ì(€€€€€…Ý…¥Ðµ…¥±I•™Õ¹‘½¹™¥É´¡•¹Ø±œ¹•µ…¥°±•Ñ¥ÍÁ±…å9…µ”¡œ¹¹…µ”±œ¹‰É…¹‘}¹…µ•ñðœœ±…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø±œ¹Í•ÍÍ¥½¹}¥±Q99P¤¤±Í•Í9…µ”±ÑŒ±É•™Õ¹‘µ½Õ¹Ð¤ì(€€€õ…Ñ ¡”¥íô(€ô(€™½È¡½¹ÍÐÍ¥½˜l¸¸¹¹•ÜM•Ð¡Ñ…É•ÑÌ¹µ…À¡àôùà¹Í•ÍÍ¥½¹}¥¤¹™¥±Ñ•È¡	½½±•…¸¤¥t¥…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±Q99P±Í¥¤ì((€É•ÑÕÉ¸©Í½¹=¬¡ì(€€€ÍÕ•ÍÌéÑÉÕ”±‰Õ¹‘±•½Õ¹ÐéÑ…É•ÑÌ¹±•¹Ñ ±Á…¥‘µ½Õ¹ÐéÁ…¥‘Q½Ñ…°±É•™Õ¹‘µ½Õ¹ÐéÉ•™Õ¹‘Q½Ñ…°°(€€€É•™Õ¹‘‘µ¥¹•”é…‘µ¥¹Q½Ñ…°±É•™Õ¹‘QÉ…¹Í™•É•”éÑÉ…¹Í™•ÉQ½Ñ…°°(€€€É•™Õ¹‘IÕ±•1…‰•°éÑ…É•ÑÌ¹±•¹Ñ øÄüŸžÖ–B#–‚Óš²‡šVÓžÖ–º3š"C¦¢ÊìœèŸ¦¢Êï–º3š"@œ(€ô¤ì)ô(¼¼ƒŠRŠR MQ%=8€ÄÈµ4èƒ’â7–>¿š*_–*o–>[šÚ#¾ò?–îÛšr¾ò?¦š²ûš¢‡žÖƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR ((¼¼€Ä¸ÁÉ•Ù¥•Ý½É•…¹•±M•ÍÍ¥½»¾ò!S¾òk¦‚C¢š÷’â7–>¿š*_–*o–öÇ¦~ÿ’êëšVã¾ò3’â7–¾¯–—¢ÎšZg¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡AÉ•Ù¥•Ý½É•…¹•±M•ÍÍ¥½¸¡•¹Ø°À¤ì(€½¹ÍÐQ99P€ô€¡À€˜˜À¹}Ñ•¹…¹Ñ%¤€ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°À¹•µ…¥°°À¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ•Í%€ôÀ¹Í•ÍÍ¥½¹%ñðÀ¹Í•ÍÍ¥½¹}¥ì(€¥˜€ …Í•Í%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úlÍ•ÍÍ¥½¹%œ¤ì(€½¹ÍÐÍ•ÍI½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•Í%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …Í•ÍI½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Óš²„œ¤ì(€½¹ÍÐÍ•Ì€ôÍ•ÍI½ÝÍlÁtì(€¥˜€¡Í•Ì¹™½É•}…¹•°¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Óš²‡–ÞË–V–.W’â7–>¿š*_–*o¢fWžB¾ò3’â7–>¿¦7¢’–V–.Tœ¤ì(€½¹ÍÐ™½É•5½‘”€ôÀ¹™½É•5½‘”ñðÀ¹™½É•}µ½‘”ñð€œœì(€¥˜€ …lÑÉ…¹Í™•É}½É}É•™Õ¹œ°É•™Õ¹‘}½¹±ät¹¥¹±Õ‘•Ì¡™½É•5½‘”¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¦ãšN¢fWžBš¢‡–ò?¾ò!ÑÉ…¹Í™•É}½É}É•™Õ¹ƒš"XÉ•™Õ¹‘}½¹±ç¾ò$œ¤ì(€½¹ÍÐÉ•Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°(€€€Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•Í%¥ô™Í•±•ÐõÉ•Ù¥•Ý}ÍÑ…ÑÕÌ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌ±ÑÉ…¹Í™•É}ÍÑ…ÑÕÍ€¤ì(€½¹ÍÐÑ¥•ÈÄ€ômt°Ñ¥•ÈÈ€ômt°Ñ¥•ÈÌ€ômtì(€™½È€¡½¹ÍÐÈ½˜É•Ì¤ì(€€€½¹ÍÐ±…å•È€ô±…ÍÍ¥™å½É•1…å•È¡È¤ì(€€€¥˜€¡±…å•È€ôôô€Ä¤Ñ¥•ÈÄ¹ÁÕÍ ¡È¤ì(€€€•±Í”¥˜€¡±…å•È€ôôô€È¤Ñ¥•ÈÈ¹ÁÕÍ ¡È¤ì(€€€•±Í”Ñ¥•ÈÌ¹ÁÕÍ ¡È¤ì(€ô(€É•ÑÕÉ¸©Í½¹=¬¡ì(€€€½¬èÑÉÕ”°(€€€Í•ÍÍ¥½¹%èÍ•Í%°(€€€Í•ÍÍ¥½¹9…µ”èÍ•Ì¹¹…µ”ñðÍ•Í%°(€€€™½É•5½‘”°(€€€•±¥¥‰±•}½Õ¹ÐèÑ¥•ÈÄ¹±•¹Ñ °€€€€¼¼ƒž²³’â–Æ“¾òk–>¿¦ã–îÛšrš"[¦¢Êì(€€€¹½Ñ¥•}½¹±å}½Õ¹ÐèÑ¥•ÈÈ¹±•¹Ñ °€¼¼ƒž²³’ê3–Æ“¾òk–>«¦kž~”(€€€Í­¥Á}½Õ¹ÐèÑ¥•ÈÌ¹±•¹Ñ °€€€€€€€€¼¼ƒž²³’â'–Æ“¾òk’â7¦Ë–—šÖž¢,(€€€Ñ½Ñ…°èÉ•Ì¹±•¹Ñ °(€€€‰É•…­‘½Ý¸èì(€€€€€Ñ¥•ÈÅ}±…‰•±ÌèÑ¥•ÈÄ¹µ…À¡Èôø¡íÉ•Ù¥•Ý}ÍÑ…ÑÕÌéÈ¹É•Ù¥•Ý}ÍÑ…ÑÕÌ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌéÈ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍô¤¤°(€€€€€Ñ¥•ÈÉ}±…‰•±ÌèÑ¥•ÈÈ¹µ…À¡Èôø¡íÉ•Ù¥•Ý}ÍÑ…ÑÕÌéÈ¹É•Ù¥•Ý}ÍÑ…ÑÕÌ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌéÈ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍô¤¤°(€€€ô°(€ô¤ì)ô((¼¼€È¸™½É•…¹•±M•ÍÍ¥½»¾ò!A=MS¾òkš¶–ò?–V–.W’â7–>¿š*_–*o¢fWžB¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡½É•…¹•±M•ÍÍ¥½¸¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì(€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°ˆ¹•µ…¥°°ˆ¹Ñ½­•¸°Q99P°€Í•ÍÍ¥½¹Ìœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÍ•Í%€ôˆ¹Í•ÍÍ¥½¹%ñðˆ¹Í•ÍÍ¥½¹}¥ì(€¥˜€ …Í•Í%¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úlÍ•ÍÍ¥½¹%œ¤ì(€½¹ÍÐÉ•…Í½¹½‘”€ôˆ¹É•…Í½¹½‘”ñðˆ¹É•…Í½¹}½‘”ñð€œœì(€½¹ÍÐÉ•…Í½¹1…‰•°€ô=I}IM=9}=MmÉ•…Í½¹½‘•tñðÉ•…Í½¹½‘”ñð€Ÿ’â7–>¿š*_–*o–nƒžÒ€œì(€½¹ÍÐ™½É•5½‘”€ôˆ¹™½É•5½‘”ñðˆ¹™½É•}µ½‘”ñð€œœì(€¥˜€ …lÑÉ…¹Í™•É}½É}É•™Õ¹œ°É•™Õ¹‘}½¹±ät¹¥¹±Õ‘•Ì¡™½É•5½‘”¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/¦ãšNš¶žŠëžj¢fWžBš¢‡–ò<œ¤ì(€¥˜€¡™½É•5½‘”€ôôô€ÑÉ…¹Í™•É}½É}É•™Õ¹œ€˜˜€„¡ˆ¹ÑÉ…¹Í™•ÉQ…É•ÑM•ÍÍ¥½¹%‘ññˆ¹ÑÉ…¹Í™•É}Ñ…É•Ñ}Í•ÍÍ¥½¹}¥¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš>C’úo–îÛšr–‚Óš²‡š¢‡–ò?–þ¦‚#š2–ºkžn»š¢g–‚Óš²„%œ¤ì(€¥˜€¡™½É•5½‘”€ôôô€É•™Õ¹‘}½¹±äœ€˜˜€¡ˆ¹ÑÉ…¹Í™•ÉQ…É•ÑM•ÍÍ¥½¹%‘ññˆ¹ÑÉ…¹Í™•É}Ñ…É•Ñ}Í•ÍÍ¥½¹}¥¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡–îÛšrš¢‡–ò?’â7–>¿š2–ºk–îÛšržn»š¢g–‚Óš²„œ¤ì(€½¹ÍÐÑ…É•ÑM•Í%€ô€¡™½É•5½‘”€ôôô€ÑÉ…¹Í™•É}½É}É•™Õ¹œ¤€ü€¡ˆ¹ÑÉ…¹Í™•ÉQ…É•ÑM•ÍÍ¥½¹%‘ññˆ¹ÑÉ…¹Í™•É}Ñ…É•Ñ}Í•ÍÍ¥½¹}¥¤€è¹Õ±°ì((€½¹ÍÐÍ•ÍI½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•Í%¥ô™Í•±•Ðô©€¤ì(€¥˜€ …Í•ÍI½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Óš²„œ¤ì(€½¹ÍÐÍ•Ì€ôÍ•ÍI½ÝÍlÁtì(€¥˜€¡Í•Ì¹™½É•}…¹•°¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Óš²‡–ÞË–V–.W’â7–>¿š*_–*o¢fWžB¾ò3’â7–>¿¦7¢’–V–.Tœ¤ì(€±•ÐÑ…É•ÑM•Í9…µ”€ô€œœì(€¥˜€¡Ñ…É•ÑM•Í%¤ì(€€€½¹ÍÐÑÑI½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ…É•ÑM•Í%¥ô™Í•±•Ðõ¥±¹…µ•€¤ì(€€€¥˜€ …ÑÑI½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–îÛšržn»š¢g–‚Óš²„œ¤ì(€€€Ñ…É•ÑM•Í9…µ”€ôÑÑI½ÝÍlÁt¹¹…µ”ñð€œœì(€ô((€½¹ÍÐ¹½Ü€ô¹•Ü…Ñ” ¤ì(€€¼¼ƒ¦ãšNšr¦fCš:‡žR£’âï¢ú›¢¢·–ºk¾ò Ç¾öxÄØàƒ–Â?šf¾ò'¾ò3šr«–†¯–&žR£žÎïžÖÇ¦‚C¢¢´(€±•Ð}¡ÉÌ€ô9Õµ‰•È¡ˆ¹¡½¥•!½ÕÉÌñðˆ¹¡½¥•}¡½ÕÉÌ¤ì(€¥˜€ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡}¡ÉÌ¤ñð}¡ÉÌ€ðô€À¤}¡ÉÌ€ô=I}!=%}!=UILì(€}¡ÉÌ€ô5…Ñ ¹µ¥¸ ÄØà°5…Ñ ¹µ…à Ä°5…Ñ ¹É½Õ¹¡}¡ÉÌ¤¤¤ì(€½¹ÍÐ‘•…‘±¥¹”€ô¹•Ü…Ñ”¡¹½Ü¹•ÑQ¥µ” ¤€¬}¡ÉÌ€¨€ØÀ€¨€ØÀ€¨€ÄÀÀÀ¤ì(€½¹ÍÐ‘•…‘±¥¹•Q•áÐ€ô‘•…‘±¥¹”¹Ñ½1½…±•MÑÉ¥¹œ é µQ\œ°íÑ¥µ•i½¹”èÍ¥„½Q…¥Á•¤œ°¡½ÕÈÄÈé™…±Í•ô¤ì(€½¹ÍÐ}¹½Ñ”€ôMÑÉ¥¹œ¡ˆ¹¹½Ñ”ñð€œœ¤¹ÑÉ¥´ ¤ì((€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•Í%¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€°ì(€€€™½É•}…¹•°èÑÉÕ”°(€€€™½É•}…¹•±}Ñ…É•Ñ}¥èÑ…É•ÑM•Í%ñð¹Õ±°°(€€€™½É•}…¹•±}‘•…‘±¥¹”è‘•…‘±¥¹”¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€ÍÑ…ÑÕÌè€Ÿ¦^s¦Z$œ°(€€€ÕÁ‘…Ñ•‘}…Ðè¹½Ü¹Ñ½%M=MÑÉ¥¹œ ¤°(€ô¤ì((€½¹ÍÐÉ•Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°(€€€Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•Í%¥ô™Í•±•Ðô©€¤ì(€½¹ÍÐÑŒ€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€±•Ð¹½Ñ¥™¥•€ô€À°Ñ¥•ÈÅ¹Ð€ô€À°Ñ¥•ÈÉ¹Ð€ô€À°Í­¥ÁÁ•€ô€À°É•™Õ¹‘5…É­•€ô€Àì((€™½È€¡½¹ÍÐÈ½˜É•Ì¤ì(€€€½¹ÍÐ±…å•È€ô±…ÍÍ¥™å½É•1…å•È¡È¤ì(€€€¥˜€¡±…å•È€ôôô€Ä¤Ñ¥•ÈÅ¹Ð¬¬ì(€€€•±Í”¥˜€¡±…å•È€ôôô€È¤Ñ¥•ÈÉ¹Ð¬¬ì(€€€•±Í”ìÍ­¥ÁÁ•¬¬ì½¹Ñ¥¹Õ”ìô((€€€¥˜€¡™½É•5½‘”€ôôô€É•™Õ¹‘}½¹±äœ€˜˜±…å•È€ôôô€Ä¤ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡È¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€°ì(€€€€€€€ÑÉ…¹Í™•É}ÍÑ…ÑÕÌè€ŸžRÏ¢®/¦¢Êìœ°(€€€€€€€ÑÉ…¹Í™•É}¡½Í•¹}…Ðè¹½Ü¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€€€ô¤¹…Ñ   ¤ôùíô¤ì(€€€€€É•™Õ¹‘5…É­•¬¬ì(€€€ô((€€€¥˜€¡È¹•µ…¥°¤ì(€€€€€ÑÉäì(€€€€€€€½¹ÍÐ‘¸€ô•Ñ¥ÍÁ±…å9…µ”¡È¹¹…µ”°È¹‰É…¹‘}¹…µ•ñðœœ¤ì(€€€€€€€…Ý…¥Ðµ…¥±½É•…¹•±9½Ñ¥”¡•¹Ø°È¹•µ…¥°°‘¸°Í•Ì¹¹…µ•ññÍ•Í%°ÑŒ°(€€€€€€€€€íÑ…É•ÑM•Í9…µ”°‘•…‘±¥¹•Q•áÐ°É•…Í½¹1…‰•°°¹½Ñ”é}¹½Ñ•ô¤ì(€€€€€€€¹½Ñ¥™¥•¬¬ì(€€€€€ô…Ñ ¡”¤ì½¹Í½±”¹•ÉÉ½È µ…¥±½É•…¹•±9½Ñ¥”™…¥±•œ°È¹•µ…¥°°”˜™”¹µ•ÍÍ…”¤ì±½ÉÉ½È¡•¹Ø°íÍ½ÕÉ”è¡½É•…¹•±M•ÍÍ¥½¸œ°µ•ÍÍ…”èµ…¥±½É•…¹•±9½Ñ¥”™…¥±•œ°•ÉÉ½Èé”˜™”¹µ•ÍÍ…•ô¤ìô(€€€ô(€ô((€É•ÑÕÉ¸©Í½¹=¬¡ì(€€€ÍÕ•ÍÌèÑÉÕ”°Í•ÍÍ¥½¹%èÍ•Í%°É•…Í½¹½‘”°É•…Í½¹1…‰•°°™½É•5½‘”°Ñ…É•ÑM•Í%°(€€€¹½Ñ¥™¥•°Ñ¥•ÈÄèÑ¥•ÈÅ¹Ð°Ñ¥•ÈÈèÑ¥•ÈÉ¹Ð°Í­¥ÁÁ•°É•™Õ¹‘5…É­•°(€€€™½É•¡½¥••…‘±¥¹”è‘•…‘±¥¹”¹Ñ½%M=MÑÉ¥¹œ ¤°¡½¥•!½ÕÉÌè}¡ÉÌ°‘•…‘±¥¹•Q•áÐ°(€ô¤ì)ô((¼¼€Ì¸…É••½É•QÉ…¹Í™•Ë¾ò!A=MS¾òkšR“–>/–B3š?–îÛšr|ƒŠPƒ’â7–>¿š*_–*o–Â#žR£¾ò$()™Õ¹Ñ¥½¸ÑÉ…¹Í™•ÉQ…É•Ñ…Ñ•Ì¡É•œ±Ñ…É•ÑM•ÍÍ¥½¸¥ì(€½¹ÍÐ½±õÍ…™•)Í½¸¡É•œ˜™É•œ¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸±mt¤±½±‘½Õ¹Ðõ5…Ñ ¹µ…à Ä±ÉÉ…ä¹¥ÍÉÉ…ä¡½±¤ý½±¹±•¹Ñ èÄ¤ì(€½¹ÍÐÑ…É•Ðõ}Í•ÍÍ¥½¹…Ñ•I½ÝÌ¡Ñ…É•ÑM•ÍÍ¥½¸˜™Ñ…É•ÑM•ÍÍ¥½¸¹‘…Ñ•Í}©Í½¸¤ì(€¥˜ …Ñ…É•Ð¹±•¹Ñ ¥É•ÑÕÉ¸mtì(€É•ÑÕÉ¸Ñ…É•Ð¹Í±¥” À±5…Ñ ¹µ¥¸¡½±‘½Õ¹Ð±Ñ…É•Ð¹±•¹Ñ ¤¤¹µ…À¡àôùà¹‘…Ñ”¤ì)ô)™Õ¹Ñ¥½¸Í•±•Ñ•‘5½‘Õ±•M¹…ÁÍ¡½Ð¡É•œ¥ì(€½¹ÍÐÉ½ÝÌõÍ…™•)Í½¸¡É•œ˜™É•œ¹ÕÍÑ½µ}™¥•±‘Í}©Í½¸±mt¤ì(€½¹ÍÐ¡¥Ðô¡ÉÉ…ä¹¥ÍÉÉ…ä¡É½ÝÌ¤ýÉ½ÝÌémt¤¹™¥¹¡àôùà˜™à¹­•äôôô}}‘½¥¹}µ½‘Õ±•Ìœ¤ì(€É•ÑÕÉ¸¡¥Ð˜™¡¥Ð¹Ù…±Õ”˜™ÑåÁ•½˜¡¥Ð¹Ù…±Õ”ôôô½‰©•Ðœý¡¥Ð¹Ù…±Õ”éíôì)ô)™Õ¹Ñ¥½¸…±QÉ…¹Í™•É5½‘Õ±•áÑÉ„¡É•œ±Ñ…É•ÑM•ÍÍ¥½¸¥ì(€½¹ÍÐµ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡Ñ…É•ÑM•ÍÍ¥½¸˜™Ñ…É•ÑM•ÍÍ¥½¸¹µ½‘Õ±•Í}©Í½¸±íô¤¤ì(€½¹ÍÐÍ¹…ÀõÍ•±•Ñ•‘5½‘Õ±•M¹…ÁÍ¡½Ð¡É•œ¤í±•ÐÑ½Ñ…°ôÀì(€¥˜¡µ½‘Ì¹Ý½É­Í¡½ÁM±½ÑÌ¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿžn»š¢g–‚Óš²‡¦r¢š¦7šZÃ¦ãšfšº×¾ò3¢®/žRÇ’âï¢ú›’êë–Þ—–º'š:K¾ò3’â7¢÷¢«–.W¢ö'žžìœ¤ì(€¥˜¡µ½‘Ì¹Í•ÉÙ¥”˜™Í¹…À¹Í•ÉÙ¥”¥í½¹ÍÐàõµ½‘Õ±•%Ñ•µ	å%¡µ½‘Ì¹Í•ÉÙ¥•Ì±Í¹…À¹Í•ÉÙ¥”¹¥¤í¥˜ …à¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿžn»š¢g–‚Óš²‡šÊKšr'–:šr7–.g¦‚žn¸œ¤íÑ½Ñ…°¬õÍ…™•9Õ´¡à¹ÁÉ¥”¥ô(€¥˜¡µ½‘Ì¹É•Í½ÕÉ”˜™Í¹…À¹É•Í½ÕÉ”¥í½¹ÍÐàõµ½‘Õ±•%Ñ•µ	å%¡µ½‘Ì¹É•Í½ÕÉ•Ì±Í¹…À¹É•Í½ÕÉ”¹¥¤í¥˜ …à¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿžn»š¢g–‚Óš²‡šÊKšr'–:š2–ºk¢Îšê@œ¤íÑ½Ñ…°¬õÍ…™•9Õ´¡à¹ÁÉ¥”¥ô(€¥˜¡µ½‘Ì¹Á…ÉÑ¥¥Á…¹ÑÌ˜™Í¹…À¹Á…ÉÑ¥¥Á…¹ÑÌ¥ì(€€€™½È¡½¹ÍÐm¥±½±‘t½˜=‰©•Ð¹•¹ÑÉ¥•Ì¡Í¹…À¹Á…ÉÑ¥¥Á…¹ÑÍññíô¤¥í½¹ÍÐàõµ½‘Õ±•%Ñ•µ	å%¡µ½‘Ì¹Á…ÉÑ¥¥Á…¹ÑQåÁ•Ì±¥¤í¥˜ …à¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿžn»š¢g–‚Óš²‡ž–£ž¢»¢¢·–ºk’â7–B0œ¤íÑ½Ñ…°¬õ5…Ñ ¹µ…à À±Á…ÉÍ•%¹Ð¡½±¹ÅÑä°ÄÀ¥ñðÀ¤©Í…™•9Õ´¡à¹ÁÉ¥”¥ô(€ô(€É•ÑÕÉ¸Ñ½Ñ…°ì)ô)™Õ¹Ñ¥½¸…±QÉ…¹Í™•É‘‘½¹Q½Ñ…°¡É•œ±Ñ…É•ÑM•ÍÍ¥½¸¥ì(€½¹ÍÐ‘•™ÌõÍ…™•)Í½¸¡Ñ…É•ÑM•ÍÍ¥½¸˜™Ñ…É•ÑM•ÍÍ¥½¸¹…‘‘½¹Í}©Í½¸±mt¤±ÅÑäõÍ…™•)Í½¸¡É•œ˜™É•œ¹…‘‘½¹}ÅÑå}©Í½¸±íô¤ì(€±•ÐÑ½Ñ…°ôÀì(€™½È¡½¹ÍÐm¬±Ùt½˜=‰©•Ð¹•¹ÑÉ¥•Ì¡ÅÑåññíô¤¥ì(€€€½¹ÍÐ¸õ5…Ñ ¹µ…à À±9Õµ‰•È¡Ø˜™ÑåÁ•½˜Øôôô½‰©•Ðœü¡Ø¹ÅÑåññØ¹½Õ¹ÑññØ¹ÅÕ…¹Ñ¥ÑåñðÀ¤éØ¥ñðÀ¤í¥˜ …¸¥½¹Ñ¥¹Õ”ì(€€€±•Ð‘•˜ô½yq¬¼¹Ñ•ÍÐ¡¬¤ý‘•™Ím9Õµ‰•È¡¬¥uññ¹Õ±°é¹Õ±°í¥˜ …‘•˜¥‘•˜õ‘•™Ì¹™¥¹¡àôùMÑÉ¥¹œ¡à¹¥‘ññà¹¹…µ•ñðœœ¤ôôõMÑÉ¥¹œ¡¬¤¤ì(€€€¥˜ …‘•˜¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿžn»š¢g–‚Óš²‡žòë–ÂG–:–‚Ç–B7žj–*ƒ¢Îó¦‚žn¸œ¤ì(€€€Ñ½Ñ…°¬õ¸©Í…™•9Õ´¡‘•˜¹ÁÉ¥”¤ì(€ôÉ•ÑÕÉ¸Ñ½Ñ…°ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸‰Õ¥±‘QÉ…¹Í™•É¥¹…¹”¡•¹Ø±P±É•œ±Ñ…É•ÑM•ÍÍ¥½¸¥ì(€½¹ÍÐ‘…Ñ•ÌõÑÉ…¹Í™•ÉQ…É•Ñ…Ñ•Ì¡É•œ±Ñ…É•ÑM•ÍÍ¥½¸¤ì(€¥˜ …‘…Ñ•Ì¹±•¹Ñ ¥Ñ¡É½Ü¹•ÜÉÉ½È Ÿžn»š¢g–‚Óš²‡šÊKšr'–>¿žR£š^—šr|œ¤ì(€€¼¼ƒ–îÛšršb¿Ž3–:–‚Ç–B7šB³–"ÃšZÃ–‚ÓŽ7¾ò3’â7šb¿¦7šZÃ¢Îó¢Êß¾òo¦G¦†7¢"–ÞËšRÛš²û–îÛžê3–:–‚Ç–B7¾ò3’â7–nƒžn»š¢g–‚Óš²‡¢¢·–ºk¦7žº_Ž(€½¹ÍÐÑ½Ñ…°õ5…Ñ ¹µ…à À±Í…™•9Õ´¡É•œ¹Ñ½Ñ…±}…µ½Õ¹Ð¥ññÍ…™•9Õ´¡É•œ¹…µ½Õ¹Ð¤¤ì(€½¹ÍÐÍ½ÕÉ•A…¥õ5…Ñ ¹µ…à À±Í…™•9Õ´¡É•œ¹Á…¥‘}…µ½Õ¹Ð¤¤ì(€É•ÑÕÉ¸ì(€€€Í•±•Ñ•‘…Ñ•Ìé‘…Ñ•Ì°(€€€Ñ½Ñ…°°(€€€Í½ÕÉ•A…¥°(€€€É•‘¥ÑÁÁ±¥•é5…Ñ ¹µ¥¸¡Í½ÕÉ•A…¥±Ñ½Ñ…°¤°(€€€‰…±…¹•Õ”é5…Ñ ¹µ…à À±Ñ½Ñ…°µÍ½ÕÉ•A…¥¤°(€€€É•™Õ¹‘Õ”èÀ(€ôì)ô)…Íå¹Œ™Õ¹Ñ¥½¸±½¹•I•¥ÍÑÉ…Ñ¥½¹%Ñ•µÍ½ÉQÉ…¹Í™•È¡•¹Ø±P±Í½ÕÉ•I•%±Ñ…É•ÑI•%¥ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í½ÕÉ•I•%¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€™½È¡½¹ÍÐÍÉŒ½˜É½ÝÌ¥ì(€€€½¹ÍÐÉ½Üõì¸¸¹ÍÉŒ±¥é•¹% %Q4œ¤±Ñ•¹…¹Ñ}¥éP±É•¥ÍÑÉ…Ñ¥½¹}¥éÑ…É•ÑI•%‘ôì(€€€‘•±•Ñ”É½Ü¹É•…Ñ•‘}…Ðì‘•±•Ñ”É½Ü¹ÕÁ‘…Ñ•‘}…Ðì(€€€É½Ü¹É•…Ñ•‘}…Ðõ¹½Ý%Í¼ ¤ì(€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌœ±É½Ü¤ì(€ô(€É•ÑÕÉ¸É½ÝÌì)ô)…Íå¹Œ™Õ¹Ñ¥½¸Í½ÕÉ•½¹™¥Éµ•‘A…åµ•¹Ñ½ÉQÉ…¹Í™•È¡•¹Ø±P±É•%¥ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™ÍÑ…ÑÕÌõ•Ä¸•Ô•Ü•È•Ü•È•	•à•”á™Í•±•Ðô¨™½É‘•ÈõÁ…¥‘}…Ð¹‘•ÍŒ™±¥µ¥ÐôÅ€¤¹…Ñ   ¤ôùmt¤ì(€É•ÑÕÉ¸É½ÝÍlÁuññ¹Õ±°ì)ô(()…Íå¹Œ™Õ¹Ñ¥½¸¡É••½É•QÉ…¹Í™•È¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ˜™ˆ¹}Ñ•¹…¹Ñ%í¥˜ …ˆ¹É•%¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úo–‚Ç–B7žÞ£¢f|œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤í¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œõÉ½ÝÍlÁt±½Ý¸õ…Ý…¥ÐÙ•É¥™¥•‘I•=Ý¹•ÉÕ…É¡•¹Ø±É•œ±ˆ°Ÿ–îÛšržjœ¤í¥˜¡½Ý¸¥É•ÑÕÉ¸½Ý¸ì(€½¹ÍÐÍ•ÍI½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹Í•ÍÍ¥½¹}¥¥ô™Í•±•Ðô©€¤í¥˜ …Í•ÍI½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–:–‚Óš²„œ¤ì(€½¹ÍÐÍ•ÌõÍ•ÍI½ÝÍlÁt±Ñ…É•ÑM•Í%õÍ•Ì¹™½É•}…¹•±}Ñ…É•Ñ}¥ì(€¥˜ …Í•Ì¹™½É•}…¹•°¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Óš²‡–Âkšr«–V–.W’â7–>¿š*_–*o¢fWžBœ¤ì(€¥˜ …Ñ…É•ÑM•Í%¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿšr«¢¢·–ºk–îÛšržn»š¢g–‚Óš²„œ¤ì(€¥˜¡Í•Ì¹™½É•}…¹•±}‘•…‘±¥¹”˜™¹•Ü…Ñ” ¤ù¹•Ü…Ñ”¡Í•Ì¹™½É•}…¹•±}‘•…‘±¥¹”¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦ãšNšr¦fC–ÞË¦8œ¤ì(€¥˜¡MÑÉ¥¹œ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤ôôôŸ–ÞË–îÛšr|œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË–º3š"C–îÛšr|œ¤ì(€¥˜¡lŸžRÏ¢®/¦¢Êìœ°Ÿ¦¢Êï’â´œ°Ÿ–ÞË¦¢Êìœ°É•™Õ¹‘•t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË¦Ë–—¦¢ÊïšÖž¢/¾ò3’â7¢÷–îÛšr|œ¤ì((€½¹ÍÐÑÑI½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ…É•ÑM•Í%¥ô™Í•±•Ðô©€¤í¥˜ …ÑÑI½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–îÛšržn»š¢g–‚Óš²„œ¤ì(€½¹ÍÐÑÐõÑÑI½ÝÍlÁt±ÍÑ…±±½Õ¹Ðõ5…Ñ ¹µ…à Ä±Í…™•9Õ´¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤ì(€±•ÐÑ˜íÑÉåíÑ˜õ…Ý…¥Ð‰Õ¥±‘QÉ…¹Í™•É¥¹…¹”¡•¹Ø±Q99P±É•œ±ÑÐ¥õ…Ñ ¡”¥íÉ•ÑÕÉ¸©Í½¹ÉÈ¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸžn»š¢g–‚Óš²‡ž‡šÎWš&ÿš:—–:–‚Ç–B4œ¥ô((€½¹ÍÐ±…¥´õ…Ý…¥Ð‘‰IÁŒ¡•¹Ø°±…¥µ}Í•ÍÍ¥½¹}Í±½Ðœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}Í•ÍÍ¥½¹}¥éÑ…É•ÑM•Í%±Á}ÍÑ…±±}½Õ¹ÐéÍÑ…±±½Õ¹Ñô¤ì(€¥˜ …±…¥µññ±…¥´¹½¬ôôõ™…±Í”¥É•ÑÕÉ¸©Í½¹ÉÈ¡±…¥´ü¡±…¥´¹•ÉÉ½ÉñðŸžn»š¢g–‚Óš²‡–B7¦†7’â7¢ÚÌœ¤èŸ–B7¦†7¦:[–ºk–’ÇšV\œ¤ì((€½¹ÍÐ¹½Üõ¹½Ý%Í¼ ¤±¹•ÝI•%õ•¹% Iœ¤±Í•ÑÑ±•µ•¹Ñ%õ•¹% QILœ¤ì(€½¹ÍÐÍ½ÕÉ•MÑ…Ñ”õ…Ý…¥Ð…ÁÑÕÉ•I•™Õ¹‘I•Í½ÕÉ•MÑ…Ñ”¡•¹Ø±Q99P±É•œ¤ì(€½¹ÍÐÍ½ÕÉ•A…åµ•¹Ðõ…Ý…¥ÐÍ½ÕÉ•½¹™¥Éµ•‘A…åµ•¹Ñ½ÉQÉ…¹Í™•È¡•¹Ø±Q99P±É•œ¹¥¤ì(€±•ÐÍ½ÕÉ•5…É­•õ™…±Í”ì((€ÑÉåì(€€€€¼¼ƒ–ÞËšr'–¾›šRÛšfšÊÿžR£Ž3–:’îcš²û–þ¯žŸŽ7¾ò3’â7¢÷–nƒ–îÛšr–ß–ßš>ošRÛš²û–âÏš"Û¾òošr«’îcš²ûš&7’öÿžR£žn»š¢g–‚Óš²‡žVÛ’â/šRÛš²û¢¢·–ºkŽ(€€€±•ÐÍ¹…Àõ}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µI•œ¡É•œ¤ì(€€€¥˜ …Í¹…À¥ì(€€€€€½¹ÍÐÁÉ½˜õ…Ý…¥Ð}É•Í½±Ù•A…åµ•¹ÑAÉ½™¥±•½ÉM•ÍÍ¥½¸¡•¹Ø±Q99P±ÑÐ¤ì(€€€€€Í¹…Àõ}Á…åµ•¹ÑM¹…ÁÍ¡½ÑÉ½µAÉ½™¥±”¡ÁÉ½˜¤ì(€€€ô((€€€½¹ÍÐ¹•ÝI•œõì(€€€€€¥é¹•ÝI•%±Ñ•¹…¹Ñ}¥éQ99P°(€€€€€‰Õ¹‘±•}¥éÉ•œ¹‰Õ¹‘±•}¥‘ñðœœ±‰Õ¹‘±•}É½ÕÁ}¥éÉ•œ¹‰Õ¹‘±•}É½ÕÁ}¥‘ñðœœ°(€€€€€Í•ÍÍ¥½¹}¥éÑ…É•ÑM•Í%±•Ù•¹Ñ}¥é±•…¹Ù•¹Ñ%¡ÑÐ¹•Ù•¹Ñ}¥¤°(€€€€€•µ…¥°éÉ•œ¹•µ…¥°±Á±…Ñ™½Éµ}µ•µ‰•É}¥éÉ•œ¹Á±…Ñ™½Éµ}µ•µ‰•É}¥‘ññ¹Õ±°±¹…µ”éÉ•œ¹¹…µ”±Á¡½¹”éÉ•œ¹Á¡½¹•ñðœœ°(€€€€€‰É…¹‘}¹…µ”éÉ•œ¹‰É…¹‘}¹…µ•ñðœœ±‰É…¹‘}¥¹ÑÉ¼éÉ•œ¹‰É…¹‘}¥¹ÑÉ½ñðœœ°(€€€€€Í•±±}…Ñ•½ÉäéÉ•œ¹Í•±±}…Ñ•½Éåñðœœ±Í•±±}¥Ñ•µÌéÉ•œ¹Í•±±}¥Ñ•µÍñðœœ±Í•±±}±¥¹¬éÉ•œ¹Í•±±}±¥¹­ñðœœ°(€€€€€Á¡½Ñ½}ÕÉ°éÉ•œ¹Á¡½Ñ½}ÕÉ±ñðœœ±™‰}ÕÉ°éÉ•œ¹™‰}ÕÉ±ñðœœ±¥}ÕÉ°éÉ•œ¹¥}ÕÉ±ñðœœ°(€€€€€•ÅÕ¥Áµ•¹Ñ}©Í½¸éÉ•œ¹•ÅÕ¥Áµ•¹Ñ}©Í½¹ññíô±ÕÍÑ½µ}™¥•±‘Í}©Í½¸éÉ•œ¹ÕÍÑ½µ}™¥•±‘Í}©Í½¹ññmt±Á…ÉÑ¥¥Á…¹ÑÍ}©Í½¸éÉ•œ¹Á…ÉÑ¥¥Á…¹ÑÍ}©Í½¹ññíô°(€€€€€ÍÑ…±±}½Õ¹ÐéÍÑ…±±½Õ¹Ð±‘•Á½Í¥ÐéÍ…™•9Õ´¡É•œ¹‘•Á½Í¥Ð¤±É•Ù¥•Ý}ÍÑ…ÑÕÌéÉ•œ¹É•Ù¥•Ý}ÍÑ…ÑÕÍñðŸ–ÞË¦2–>Xœ°(€€€€€Á…åµ•¹Ñ}ÍÑ…ÑÕÌéÉ•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍñð ¡Ñ˜¹Ñ½Ñ…°ôôôÀ¤üŸ–7¢Êìœè¡Ñ˜¹‰…±…¹•Õ”ðôÀüŸ–ÞËžæÏ¢ÊìœèŸšr«žæÏ¢Êìœ¤¤°(€€€€€Á…åµ•¹Ñ}µ•Ñ¡½éÉ•œ¹Á…åµ•¹Ñ}µ•Ñ¡½‘ñðœœ±Á…åµ•¹Ñ}±…ÍÐÔéÉ•œ¹Á…åµ•¹Ñ}±…ÍÐÕññ¹Õ±°±Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…ÐéÉ•œ¹Á…åµ•¹Ñ}É•Á½ÉÑ•‘}…Ñññ¹Õ±°°(€€€€€Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹ÐéÍ…™•9Õ´¡É•œ¹Á…åµ•¹Ñ}É•Á½ÉÑ}…µ½Õ¹Ð¤±Á…¥‘}…ÐéÉ•œ¹Á…¥‘}…Ñññ¹Õ±°°(€€€€€…µ½Õ¹ÐéÑ˜¹Ñ½Ñ…°±Ñ½Ñ…±}…µ½Õ¹ÐéÑ˜¹Ñ½Ñ…°±Á…¥‘}…µ½Õ¹ÐéÑ˜¹Í½ÕÉ•A…¥°(€€€€€ÑÉ…¹Í™•É}É•‘¥Ñ}…µ½Õ¹ÐéÑ˜¹É•‘¥ÑÁÁ±¥•±ÑÉ…¹Í™•É}‰…±…¹•}‘Õ”éÑ˜¹‰…±…¹•Õ”±ÑÉ…¹Í™•É}É•™Õ¹‘}‘Õ”èÀ±ÑÉ…¹Í™•É}Í•ÑÑ±•µ•¹Ñ}¥éÍ•ÑÑ±•µ•¹Ñ%°(€€€€€…‘‘½¹}ÅÑå}©Í½¸éÉ•œ¹…‘‘½¹}ÅÑå}©Í½¹ññíô±…‘‘½¹}…µ½Õ¹ÐéÍ…™•9Õ´¡É•œ¹…‘‘½¹}…µ½Õ¹Ð¤±Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸éÑ˜¹Í•±•Ñ•‘…Ñ•Ì°(€€€€€Ñ…á}¥éÉ•œ¹Ñ…á}¥‘ñðœœ±¥¹Ù½¥•}Ñ¥Ñ±”éÉ•œ¹¥¹Ù½¥•}Ñ¥Ñ±•ñðœœ±¥¹Ù½¥•}ÑåÁ”éÉ•œ¹¥¹Ù½¥•}ÑåÁ•ñðœœ±¥¹Ù½¥•}•µ…¥°éÉ•œ¹¥¹Ù½¥•}•µ…¥±ñðœœ±¥¹Ù½¥•}…ÉÉ¥•ÈéÉ•œ¹¥¹Ù½¥•}…ÉÉ¥•Éñðœœ°(€€€€€¥¹Ù½¥•}ÍÑ…ÑÕÌéÉ•œ¹¥¹Ù½¥•}ÍÑ…ÑÕÍñðœœ±¡•­¥¹}ÍÑ…ÑÕÌèŸšr«–‚Ç–"Àœ±±•…É}ÍÑ…ÑÕÌèŸšr«šâ–‚Ðœ±‘•Á½Í¥Ñ}É•™Õ¹‘•éÉ•œ¹‘•Á½Í¥Ñ}É•™Õ¹‘•‘ñðŸšr«¦š*ó¦Dœ°(€€€€€ÍÑ…±±}¹Õµ‰•Èèœœ±Í•…Ñ}¡½¥•}¥¹Ñ•¹ÐéÉ•œ¹Í•…Ñ}¡½¥•}¥¹Ñ•¹Ññð…ÕÑ¼œ±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÁ•¹‘¥¹œœ±Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°°(€€€€€…É••µ•¹Ñ}…•ÁÑ•éÉ•œ¹…É••µ•¹Ñ}…•ÁÑ•ôôõÑÉÕ”±…É••µ•¹Ñ}Ù¥•Ý•éÉ•œ¹…É••µ•¹Ñ}Ù¥•Ý•ôôõÑÉÕ”°(€€€€€½É¥¥¹…±}Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±ÑÉ…¹Í™•ÉÉ•‘}™É½µ}É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•œ¹¥±É•…Ñ•‘}…Ðé¹½Ü°(€€€€€€¸¸¹}Á…åµ•¹ÑM¹…ÁÍ¡½Ñ‰A…å±½…¡Í¹…À¤°(€€€€€€¸¸¸¡Ñ˜¹‰…±…¹•Õ”øÀýÁ…åµ•¹Ñ•…‘±¥¹•A…å±½…¡ÑÐ±¹½Ü±Ñ˜¹‰…±…¹•Õ”¤éíô¤(€€€ôì((€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¹•ÝI•œ¤ì(€€€…Ý…¥Ð±½¹•I•¥ÍÑÉ…Ñ¥½¹%Ñ•µÍ½ÉQÉ…¹Í™•È¡•¹Ø±Q99P±É•œ¹¥±¹•ÝI•%¤ì((€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°ÑÉ…¹Í™•É}Í•ÑÑ±•µ•¹ÑÌœ±ì(€€€€€¥éÍ•ÑÑ±•µ•¹Ñ%±Ñ•¹…¹Ñ}¥éQ99P°(€€€€€Í½ÕÉ•}É•¥ÍÑÉ…Ñ¥½¹}¥éÉ•œ¹¥±Í½ÕÉ•}Í•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥°(€€€€€Ñ…É•Ñ}É•¥ÍÑÉ…Ñ¥½¹}¥é¹•ÝI•%±Ñ…É•Ñ}Í•ÍÍ¥½¹}¥éÑ…É•ÑM•Í%°(€€€€€Í½ÕÉ•}Á…¥‘}…µ½Õ¹ÐéÑ˜¹Í½ÕÉ•A…¥±Ñ…É•Ñ}Ñ½Ñ…±}…µ½Õ¹ÐéÑ˜¹Ñ½Ñ…°°(€€€€€É•‘¥Ñ}…ÁÁ±¥•éÑ˜¹É•‘¥ÑÁÁ±¥•±‰…±…¹•}‘Õ”éÑ˜¹‰…±…¹•Õ”°(€€€€€É•™Õ¹‘}‘Õ”èÀ±É•™Õ¹‘}Á…¥èÀ±ÍÑ…ÑÕÌéÑ˜¹‰…±…¹•Õ”øÀü‰…±…¹•}‘Õ”œèÍ•ÑÑ±•œ°(€€€€€É•…Ñ•‘}…Ðé¹½Ü±Í•ÑÑ±•‘}…ÐéÑ˜¹‰…±…¹•Õ”ðôÀý¹½Üé¹Õ±°(€€€ô¤ì((€€€¥˜¡Ñ˜¹É•‘¥ÑÁÁ±¥•øÀ¥ì(€€€€€…Ý…¥Ð‘‰%¹Í•ÉÐ¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±ì(€€€€€€€¥é•¹% A0œ¤±Ñ•¹…¹Ñ}¥éQ99P±Á…åµ•¹Ñ}¥éÍ½ÕÉ•A…åµ•¹ÐýÍ½ÕÉ•A…åµ•¹Ð¹¥é¹Õ±°°(€€€€€€€É•¥ÍÑÉ…Ñ¥½¹}¥é¹•ÝI•%±Í•ÍÍ¥½¹}¥éÑ…É•ÑM•Í%°(€€€€€€€…±±½…Ñ¥½¹}ÑåÁ”èÑÉ…¹Í™•É}É•‘¥Ðœ±…µ½Õ¹ÐéÑ˜¹É•‘¥ÑÁÁ±¥•±É•…Ñ•‘}…Ðé¹½Ü(€€€€€ô¤ì(€€€€€…Ý…¥ÐÝÉ¥Ñ•¥¹…¹•1•‘•È¡•¹Ø±Q99P±íÉ•¥ÍÑÉ…Ñ¥½¹%éÉ•œ¹¥±Í•ÍÍ¥½¹%éÉ•œ¹Í•ÍÍ¥½¹}¥±Á…åµ•¹Ñ%éÍ½ÕÉ•A…åµ•¹ÐýÍ½ÕÉ•A…åµ•¹Ð¹¥é¹Õ±°±Í•ÑÑ±•µ•¹Ñ%±•¹ÑÉåQåÁ”èÑÉ…¹Í™•É}É•‘¥Ñ}½ÕÐœ±…µ½Õ¹ÐéÑ˜¹É•‘¥ÑÁÁ±¥•±‘¥É•Ñ¥½¸è‘•‰¥Ðœ±µ•µ¼èŸ–îÛšr¢ö'–ëš^‹šr'–¾›šRØœ±ÍÑÉ¥ÐéÑÉÕ•ô¤ì(€€€€€…Ý…¥ÐÝÉ¥Ñ•¥¹…¹•1•‘•È¡•¹Ø±Q99P±íÉ•¥ÍÑÉ…Ñ¥½¹%é¹•ÝI•%±Í•ÍÍ¥½¹%éÑ…É•ÑM•Í%±Á…åµ•¹Ñ%éÍ½ÕÉ•A…åµ•¹ÐýÍ½ÕÉ•A…åµ•¹Ð¹¥é¹Õ±°±Í•ÑÑ±•µ•¹Ñ%±•¹ÑÉåQåÁ”èÑÉ…¹Í™•É}É•‘¥Ñ}¥¸œ±…µ½Õ¹ÐéÑ˜¹É•‘¥ÑÁÁ±¥•±‘¥É•Ñ¥½¸èÉ•‘¥Ðœ±µ•µ¼èŸ–îÛšr¢ö'–—š^‹šr'–¾›šRØœ±ÍÑÉ¥ÐéÑÉÕ•ô¤ì(€€€ô((€€€€¼¼ƒ¢"+–‚Ó¦/šRû¾òk’ö7žö»¢"šfšº×’â7¢÷šB³–"ÃšZÃ–‚Ó¾òošZÃ–‚Ó’þwžVg–:šr³Ž3¦ã’ö7š?¦†cŽ7¾ò3¦7šZÃ¦7žö»–¾›¦jo’ö7žö»Ž(€€€…Ý…¥ÐÉ•±•…Í•I•™Õ¹‘I•Í½ÕÉ•ÍMÑÉ¥Ð¡•¹Ø±Q99P±Í½ÕÉ•MÑ…Ñ”°Ÿ–îÛšr¦/šRû–:–‚Ó’ö7žö»¾ò?šfšº×–’ÇšV\œ¤ì(€€€¥˜¡Í½ÕÉ•MÑ…Ñ”¹…Ñ¥Ù”¥ì(€€€€€…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø±Q99P±É•œ°µÍÑ…±±½Õ¹Ð¤ì(€€€€€Í½ÕÉ•MÑ…Ñ”¹½Õ¹Ñ‘©ÕÍÑ•õÑÉÕ”ì(€€€ô((€€€€¼¼ƒšr–ú3š&7š*+–:–‚Ç–B7š¢g¢¢cž
ë–ÞË–îÛšr¾òo–&7¦v‹’îï’öW’âš¶—–’ÇšV_¦÷¢÷–º3šVÓ–n{–ú§Ž(€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±ì(€€€€€ÑÉ…¹Í™•É}ÍÑ…ÑÕÌèŸ–ÞË–îÛšr|œ±ÑÉ…¹Í™•É}Ñ…É•Ñ}Í•ÍÍ¥½¹}¥éÑ…É•ÑM•Í%±ÑÉ…¹Í™•É}¡½Í•¹}…Ðé¹½Ü°(€€€€€…‘µ¥¹}¹½Ñ”è¡MÑÉ¥¹œ¡É•œ¹…‘µ¥¹}¹½Ñ•ñðœœ¤¬œožÎïžÖÅtƒ–îÛšr¢Ì€œ¬¡ÑÐ¹¹…µ•ññÑ…É•ÑM•Í%¤¬œ€œ­¹½ÝQ…¥Á•¥Q•áÐ ¤¤¹ÑÉ¥´ ¤(€€€ô¤ì(€€€Í½ÕÉ•5…É­•õÑÉÕ”ì((€€€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±Q99P±ˆ¹•µ…¥±ññÉ•œ¹•µ…¥°°µ•µ‰•Èœ°™½É•}ÑÉ…¹Í™•É}½µÁ±•Ñ”œ°É•¥ÍÑÉ…Ñ¥½¹Ìœ±É•œ¹¥°(€€€€€íÍ•ÍÍ¥½¹}¥éÉ•œ¹Í•ÍÍ¥½¹}¥±Á…¥‘}…µ½Õ¹ÐéÍ…™•9Õ´¡É•œ¹Á…¥‘}…µ½Õ¹Ð¤±Á…åµ•¹Ñ}ÍÑ…ÑÕÌéÉ•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍô°(€€€€€íÑ…É•Ñ}É•¥ÍÑÉ…Ñ¥½¹}¥é¹•ÝI•%±Ñ…É•Ñ}Í•ÍÍ¥½¹}¥éÑ…É•ÑM•Í%±Á…¥‘}…µ½Õ¹ÐéÑ˜¹Í½ÕÉ•A…¥±Á…åµ•¹Ñ}ÍÑ…ÑÕÌé¹•ÝI•œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍô°(€€€€€íÍ½ÕÉ•}Á…åµ•¹Ñ}¥éÍ½ÕÉ•A…åµ•¹ÐýÍ½ÕÉ•A…åµ•¹Ð¹¥é¹Õ±°±¥Ñ•µÍ}±½¹•éÑÉÕ”±Í•…Ñ}É•…ÍÍ¥¹}É•ÅÕ¥É•éÑÉÕ•ô(€€€€¤¹…Ñ   ¤ôùíô¤ì((€€€…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±Q99P±É•œ¹Í•ÍÍ¥½¹}¥¤ì(€€€…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±Q99P±Ñ…É•ÑM•Í%¤ì(€õ…Ñ ¡”¥ì(€€€€¼¼ƒ’îï’öW’âš¶—–’ÇšV_¾òk–#–n{–ú§–:–‚Ç–B7¾ò3–7–"«¦f“šr³š²‡šZÃ–‚Ó¢ÎšZg¢"š¶ã¦
šZÃ–‚Ó–B7¦†7Ž(€€€¥˜¡Í½ÕÉ•5…É­•¥ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥õ€±ì(€€€€€€€ÑÉ…¹Í™•É}ÍÑ…ÑÕÌéÉ•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍññ¹Õ±°±ÑÉ…¹Í™•É}Ñ…É•Ñ}Í•ÍÍ¥½¹}¥éÉ•œ¹ÑÉ…¹Í™•É}Ñ…É•Ñ}Í•ÍÍ¥½¹}¥‘ññ¹Õ±°°(€€€€€€€ÑÉ…¹Í™•É}¡½Í•¹}…ÐéÉ•œ¹ÑÉ…¹Í™•É}¡½Í•¹}…Ñññ¹Õ±°±…‘µ¥¹}¹½Ñ”éÉ•œ¹…‘µ¥¹}¹½Ñ•ñðœœ(€€€€€ô¤¹…Ñ   ¤ôùíô¤ì(€€€ô(€€€¥˜¡Í½ÕÉ•MÑ…Ñ”¹½Õ¹Ñ‘©ÕÍÑ•¥…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø±Q99P±É•œ±ÍÑ…±±½Õ¹Ð¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥ÐÉ•ÍÑ½É•I•™Õ¹‘I•Í½ÕÉ•MÑ…Ñ”¡•¹Ø±Q99P±Í½ÕÉ•MÑ…Ñ”¤¹…Ñ   ¤ôùíô¤ì((€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°Á…åµ•¹Ñ}…±±½…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¹•ÝI•%¥ô™…±±½…Ñ¥½¹}ÑåÁ”õ•Ä¹ÑÉ…¹Í™•É}É•‘¥Ñ€¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°™¥¹…¹•}±•‘•Èœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÑÑ±•µ•¹Ñ}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÑÑ±•µ•¹Ñ%¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹}¥Ñ•µÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¹•ÝI•%¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°ÑÉ…¹Í™•É}Í•ÑÑ±•µ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•ÑÑ±•µ•¹Ñ%¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰•±•Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¹•ÝI•%¥õ€¤¹…Ñ   ¤ôùíô¤ì(€€€…Ý…¥Ð‘‰IÁŒ¡•¹Ø°É•±•…Í•}Í•ÍÍ¥½¹}Í±½Ðœ±íÁ}Ñ•¹…¹Ñ}¥éQ99P±Á}Í•ÍÍ¥½¹}¥éÑ…É•ÑM•Í%±Á}ÍÑ…±±}½Õ¹ÐéÍÑ…±±½Õ¹Ñô¤¹…Ñ   ¤ôùíô¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–îÛšr¢ÎšZg–îëž®/–’ÇšV_¾ò3žÎïžÖÇ–ÞË–n{–ú§–:–‚Ç–B7¾òhœ¬¡”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”èŸšr«ž~—¦2¿¢ªœ¤¤ì(€ô((€É•ÑÕÉ¸©Í½¹=¬¡ì(€€€ÍÕ•ÍÌéÑÉÕ”±¹•ÝI•%±ÑÉ…¹Í™•ÉÉ•‘Q¼éÑ…É•ÑM•Í%°(€€€Í½ÕÉ•A…¥éÑ˜¹Í½ÕÉ•A…¥±Ñ…É•ÑQ½Ñ…°éÑ˜¹Ñ½Ñ…°±É•‘¥ÑÁÁ±¥•éÑ˜¹É•‘¥ÑÁÁ±¥•°(€€€‰…±…¹•Õ”éÑ˜¹‰…±…¹•Õ”±É•™Õ¹‘Õ”èÀ±Í•ÑÑ±•µ•¹Ñ%°(€€€‘…Ñ…QÉ…¹Í™•ÉÉ•éÑÉÕ”±Í•…ÑI•…ÍÍ¥¹I•ÅÕ¥É•éÑÉÕ”(€ô¤ì)ô(((¼¼€Ð¸…ÁÁ±å½É•I•™Õ¹‘7¾ò!A=MS¾òkšR“–>/¦ãšNžRÏ¢®/¦¢ÊìƒŠPƒ’â7–>¿š*_–*o–Â#žR£¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡ÁÁ±å½É•I•™Õ¹‘4¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ˜™ˆ¹}Ñ•¹…¹Ñ%í¥˜ …ˆ¹É•%¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢®/š>C’úo–‚Ç–B7žÞ£¢f|œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤í¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€½¹ÍÐÉ•œõÉ½ÝÍlÁt±½Ý¸õ…Ý…¥ÐÙ•É¥™¥•‘I•=Ý¹•ÉÕ…É¡•¹Ø±É•œ±ˆ°ŸžRÏ¢®/’â7–>¿š*_–*o¦¢Êïžjœ¤í¥˜¡½Ý¸¥É•ÑÕÉ¸½Ý¸ì(€½¹ÍÐÍÈõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹Í•ÍÍ¥½¹}¥¥ô™Í•±•Ðô©€¤±Í•ÌõÍÉlÁuññíôì(€¥˜ …Í•Ì¹™½É•}…¹•°¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Óš²‡–Âkšr«–V–.W’â7–>¿š*_–*o¢fWžBœ¤í¥˜¡Í•Ì¹™½É•}…¹•±}‘•…‘±¥¹”˜™¹•Ü…Ñ” ¤ù¹•Ü…Ñ”¡Í•Ì¹™½É•}…¹•±}‘•…‘±¥¹”¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¦ãšNšr¦fC–ÞË¦8œ¤ì(€¥˜¡MÑÉ¥¹œ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤ôôôŸ–ÞË–îÛšr|œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7–ÞË–º3š"C–îÛšr¾ò3’â7¢÷žRÏ¢®/¦¢Êìœ¤ì(€¥˜¡lŸžRÏ¢®/¦¢Êìœ°Ÿ¦¢Êï’â´t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É•œ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¥É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±…±É•…‘åI•ÅÕ•ÍÑ•éÑÉÕ•ô¤ì(€½¹ÍÐ…Ñ¥Ù”õ¥ÍÑ¥Ù•½É…Á…¥Ñä¡É•œ¤ì(€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•œ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±íÑÉ…¹Í™•É}ÍÑ…ÑÕÌèŸžRÏ¢®/¦¢Êìœ±ÑÉ…¹Í™•É}¡½Í•¹}…Ðé¹½Ý%Í¼ ¤±ÍÑ…±±}¹Õµ‰•Èé¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÉ•±•…Í•œ±Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€¥˜¡…Ñ¥Ù”¥…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø±Q99P±É•œ°´¡Í…™•9Õ´¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤¤¹…Ñ   ¤ôùíô¤ì(€…Ý…¥ÐÉ•±•…Í•I•¥ÍÑÉ…Ñ¥½¹M•…ÑÌ¡•¹Ø±Q99P±É•œ°™½É•}É•™Õ¹œ¤í…Ý…¥ÐÉ•±•…Í•I•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½ÑÌ¡•¹Ø±Q99P±É•œ¤í…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±Q99P±É•œ¹Í•ÍÍ¥½¹}¥¤ì(€É•ÑÕÉ¸©Í½¹=¬¡íÍÕ•ÍÌéÑÉÕ”±™½É•MÑ…ÑÕÌèÉ•™Õ¹‘}É•ÅÕ•ÍÑ•œ±ÑÉ…¹Í™•ÉMÑ…ÑÕÌèŸžRÏ¢®/¦¢Êìô¤ì)ô((¼¼€Ô¸ÉÕ¹½É•¡½¥••…‘±¥¹—¾ò!A=MS¾òkžÎïžÖÇš:Kž¢/š"[š&/–.W–~ß¢†0€Ðàƒ–Â?šf¦ûšr¢fWžB¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡IÕ¹½É•¡½¥••…‘±¥¹”¡•¹Ø°ˆ¤ì(€½¹ÍÐQ99P€ô€¡ˆ€˜˜ˆ¹}Ñ•¹…¹Ñ%¤€ì(€¥˜€¡ˆ¹•µ…¥°€˜˜ˆ¹Ñ½­•¸¤ì¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø°ˆ¹•µ…¥°°ˆ¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ìô(€½¹ÍÐ¹½Ü€ô¹•Ü…Ñ” ¤ì(€±•ÐÍ•ÍEÌ€ô™½É•}…¹•°õ•Ä¹ÑÉÕ”™Í•±•Ðõ¥±Ñ•¹…¹Ñ}¥±¹…µ”±™½É•}…¹•±}‘•…‘±¥¹•€ì(€¥˜€¡Q99P¤Í•ÍEÌ€ôÑ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™€€¬Í•ÍEÌì(€½¹ÍÐÍ•ÍÍ¥½¹Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€Í•ÍÍ¥½¹Ìœ°Í•ÍEÌ¤¹…Ñ   ¤ôùmt¤ì(€±•ÐÁÉ½•ÍÍ•€ô€Àì(€™½È€¡½¹ÍÐÍ•Ì½˜Í•ÍÍ¥½¹Ì¤ì(€€€¥˜€ …Í•Ì¹™½É•}…¹•±}‘•…‘±¥¹”¤½¹Ñ¥¹Õ”ì(€€€¥˜€¡¹½Ü€ð¹•Ü…Ñ”¡Í•Ì¹™½É•}…¹•±}‘•…‘±¥¹”¤¤½¹Ñ¥¹Õ”ì(€€€½¹ÍÐÉ•Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°Ñ•¹…¹Ñ}¥õ•Ä¸‘íÍ•Ì¹Ñ•¹…¹Ñ}¥‘ô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í•Ì¹¥¥ô™É•Ù¥•Ý}ÍÑ…ÑÕÌõ•Ä¸•Ô•Ü•È•ä”á”àÐ•Ô”á”äØ™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€€€™½È€¡½¹ÍÐÈ½˜É•Ì¤ì(€€€€€¥˜€¡MÑÉ¥¹œ¡È¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐ¹½ÝMÑÈ€ô¹½Ü¹Ñ½%M=MÑÉ¥¹œ ¤ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°€É•¥ÍÑÉ…Ñ¥½¹Ìœ°¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡È¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íÈ¹Ñ•¹…¹Ñ}¥‘õ€°ìÑÉ…¹Í™•É}ÍÑ…ÑÕÌè€ŸžRÏ¢®/¦¢Êìœ°ÑÉ…¹Í™•É}¡½Í•¹}…Ðè¹½ÝMÑÈô¤ì(€€€€€ÑÉäì½¹ÍÐÑŒ€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°È¹Ñ•¹…¹Ñ}¥¤ì½¹ÍÐ‘¸€ô•Ñ¥ÍÁ±…å9…µ”¡È¹¹…µ”°È¹‰É…¹‘}¹…µ•ñðœœ¤ì…Ý…¥Ðµ…¥±½É•…¹•±9½Ñ¥”¡•¹Ø°È¹•µ…¥°°‘¸°Í•Ì¹¹…µ•ññÈ¹Í•ÍÍ¥½¹}¥°ÑŒ¤ìô…Ñ ¡”¤íô(€€€€€ÁÉ½•ÍÍ•¬¬ì(€€€ô(€ô(€É•ÑÕÉ¸©Í½¹=¬¡ìÍÕ•ÍÌéÑÉÕ”°ÁÉ½•ÍÍ•ô¤ì)ô((¼¼€Ø¸½¹™¥Éµ½É•I•™Õ¹“¾ò!A=MS¾òk–ú3–>ÃžŠë¢ª7’â7–>¿š*_–*o¦š²û–º3š"C¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸¡½¹™¥Éµ½É•I•™Õ¹¡•¹Ø±ˆ¥ì(€½¹ÍÐQ99Põˆ˜™ˆ¹}Ñ•¹…¹Ñ%í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°™¥¹…¹”œ¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•ÐõÑÉ…¹Í™•É}ÍÑ…ÑÕÍ€¤í¥˜ …É½ÝÌ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B4œ¤ì(€¥˜ …lŸžRÏ¢®/¦¢Êìœ°Ÿ¦¢Êï’â´t¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡É½ÝÍlÁt¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš¶“–‚Ç–B7’â7–r£–>¿¦š²ûž.š,œ¤ì(€É•ÑÕÉ¸¡½¹™¥ÉµI•™Õ¹¡•¹Ø±ˆ¤ì)ô((¼¼ƒŠRŠR MQ%=8€ÄÌèA…ä€¼1%9A…äƒ–n{¢ªüƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR ((¼¼A…äƒ’îcš²û–n{¢ªÿ¾ò!A=MP™½É·¾ò$(¼¼1%9A…ä½¹™¥É´É•‘¥É•Ó¾ò!S¾ò$(¼¼ƒŠRŠR MQ%=8€ÄÐèÉ½¸ƒ–ºkšf’îï–.dƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR ((¼¼ƒžæÏ¢Êïšr¦fCšª‹š~—¾ò ÀÈèÀÀUQ¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸É½¹¡•­A…åµ•¹ÑÌ¡•¹Ø¥ì(€½¹ÍÐ¹½Üõ¹•Ü…Ñ” ¤±É•Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±É•Ù¥•Ý}ÍÑ…ÑÕÌõ•Ä¸•Ô•Ü•È•ä”á”àÐ•Ô”á”äØ™Á…åµ•¹Ñ}ÍÑ…ÑÕÌõ•Ä¸•Ø”å••Ü•ä•Ì•à•È•	™Í•±•Ðô©€¤ì(€½¹ÍÐÑ…¡”õíô±ÁÉ½•ÍÍ•‘É½ÕÁÌõ¹•ÜM•Ð ¤±ÁÉ½•ÍÍ•‘I•Ìõ¹•ÜM•Ð ¤ì(€…Íå¹Œ™Õ¹Ñ¥½¸Ñà¡Ð¥í¥˜ …Ñ…¡•mÑt¥Ñ…¡•mÑtõ…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø±Ð¤íÉ•ÑÕÉ¸Ñ…¡•mÑuô(€™½È¡½¹ÍÐÈ½˜É•Ì¥ì(€€€½¹ÍÐPõÈ¹Ñ•¹…¹Ñ}¥±‘Õ”õ‘Õ•Ñ½ÉI•œ¡È¤±É•µ¥¹õÉ•µ¥¹‘•ÉÑ½ÉI•œ¡È¤í¥˜ …‘Õ”¥½¹Ñ¥¹Õ”ì(€€€½¹ÍÐÉ½ÕÁ-•äõMÑÉ¥¹œ¡È¹‰Õ¹‘±•}É½ÕÁ}¥‘ñðœœ¤¹ÑÉ¥´ ¤ýP¬ñ	ðœ­MÑÉ¥¹œ¡È¹‰Õ¹‘±•}É½ÕÁ}¥¤éP¬ñIðœ­MÑÉ¥¹œ¡È¹¥¤ì(€€€¥˜¡¹½Üøõ‘Õ”¥ì(€€€€€¥˜¡ÁÉ½•ÍÍ•‘É½ÕÁÌ¹¡…Ì¡É½ÕÁ-•ä¤¥½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐÉ½ÕÀõ…Ý…¥Ð•Ñ	Õ¹‘±•É½ÕÁI•Ì¡•¹Ø±P±È¤ì(€€€€€€¼¼ƒš¶–âãžÖ–B#’îcš²û–þ¦‚#’â¢Öß¾òo¢.—š¶ß–>Ë¢ÎšZg–ëž>û–Û’â·’â–‚Ó–ÞËšr'–¾›šRÛ¾ò3žšš¶‹š:Kž¢/¢«–.W–>[šÚ#¾ò3¦ÿ–7¢ª“–"«žr–¾›¦GšÖŽ(€€€€€¥˜¡É½ÕÀ¹Í½µ”¡œôùÍ…™•9Õ´¡œ¹Á…¥‘}…µ½Õ¹Ð¤øÁññ¥ÍA…¥‘MÑ…ÑÕÌ¡œ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤¤¥íÁÉ½•ÍÍ•‘É½ÕÁÌ¹…‘¡É½ÕÁ-•ä¤í½¹Ñ¥¹Õ•ô(€€€€€™½È¡½¹ÍÐœ½˜É½ÕÀ¥ì(€€€€€€€¥˜¡ÁÉ½•ÍÍ•‘I•Ì¹¡…Ì¡MÑÉ¥¹œ¡œ¹¥¤¥ññ}É•Ù¥•ÝMÑ…ÑÕÌ¡œ¤ôôôŸ–ÞË–>[šÚ œ¥½¹Ñ¥¹Õ”ì(€€€€€€€½¹ÍÐ…Ñ¥Ù”õ¥ÍÑ¥Ù•½É…Á…¥Ñä¡œ¤±ÕÁõíÉ•Ù¥•Ý}ÍÑ…ÑÕÌèŸ–ÞË–>[šÚ œ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌèŸ–ÞË–>[šÚ œ±Á…åµ•¹Ñ}•áÁ¥É•‘}…Ðé¹½Ü¹Ñ½%M=MÑÉ¥¹œ ¤°(€€€€€€€€€ÍÑ…±±}¹Õµ‰•Èé¹Õ±°±Í•…Ñ}¡½¥•}ÍÑ…ÑÕÌèÉ•±•…Í•œ±Í•…Ñ}¡½¥•}ÑåÁ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±°°(€€€€€€€€€…‘µ¥¹}¹½Ñ”è¡œ¹…‘µ¥¹}¹½Ñ•ñðœœ¤¬œƒ¦ûšršr«žæÏ¢Êï¢«–.W–>[šÚ œ¬¡É½ÕÀ¹±•¹Ñ øÄüŸ¾ò#–§–‚ÓžÖ–B#šVÓžÖ–>[šÚ#¾ò$œèœœ¤¬œ€œ­¹½ÝQ…¥Á•¥Q•áÐ ¥ôì(€€€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQõ€±ÕÁ¤ì(€€€€€€€¥˜¡…Ñ¥Ù”¥…Ý…¥Ð…‘©ÕÍÑI•¥ÍÑÉ…Ñ¥½¹…Á…¥Ñä¡•¹Ø±P±œ°´¡Í…™•9Õ´¡œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€…Ý…¥ÐÉ•±•…Í•I•¥ÍÑÉ…Ñ¥½¹M•…ÑÌ¡•¹Ø±P±œ°Á…åµ•¹Ñ}½Ù•É‘Õ”œ¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€…Ý…¥ÐÉ•±•…Í•I•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½ÑÌ¡•¹Ø±P±œ¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Á…åµ•¹ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™É•¥ÍÑÉ…Ñ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡œ¹¥¥ô™ÍÑ…ÑÕÌõ¥¸¸ •Ô•	”àÔ•Ð•	”äà•Ø••	°•Ô•	”àÔ•Ü•È•	•à•”á¥€±íÍÑ…ÑÕÌèŸ–ÞË–>[šÚ ô¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€…Ý…¥ÐÝÉ¥Ñ•Õ‘¥Ñ1½œ¡•¹Ø±P°œœ°ÍåÍÑ•´œ°Á…åµ•¹Ñ}½Ù•É‘Õ•}…¹•°œ°É•¥ÍÑÉ…Ñ¥½¹Ìœ±œ¹¥±íÉ•Ù¥•Ý}ÍÑ…ÑÕÌéœ¹É•Ù¥•Ý}ÍÑ…ÑÕÌ±Á…åµ•¹Ñ}ÍÑ…ÑÕÌéœ¹Á…åµ•¹Ñ}ÍÑ…ÑÕÍô±ÕÁ±í‰Õ¹‘±•}É½ÕÀéÉ½ÕÀ¹±•¹Ñ øÄ±‘Õ•}…Ðé‘Õ”¹Ñ½%M=MÑÉ¥¹œ ¤±…Á…¥Ñå}‘•±Ñ„é…Ñ¥Ù”ü´¡Í…™•9Õ´¡œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄ¤èÁô¤ì(€€€€€€€…Ý…¥ÐÉ•™É•Í¡M•ÍÍ¥½¹MÑ…ÑÍM…™”¡•¹Ø±P±œ¹Í•ÍÍ¥½¹}¥¤ì(€€€€€€€ÑÉåí½¹ÍÐÍ¸õ…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø±œ¹Í•ÍÍ¥½¹}¥±P¤±ÍÐõ…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø±œ¹Í•ÍÍ¥½¹}¥±P¤±‘¸õ•Ñ¥ÍÁ±…å9…µ”¡œ¹¹…µ”±œ¹‰É…¹‘}¹…µ•ñðœœ±ÍÐ¤±ÑŒõ…Ý…¥ÐÑà¡P¤í…Ý…¥Ðµ…¥±ÕÑ½…¹•°¡•¹Ø±œ¹•µ…¥°±‘¸±Í¸±ÑŒ¥õ…Ñ ¡”¥íô(€€€€€€€…Ý…¥ÐÉ•½É‘9½Ñ¥™¥…Ñ¥½¸¡•¹Ø±íÑ•¹…¹Ñ%éP±Õ¹¥Ñ%éœ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±Í•ÍÍ¥½¹%éœ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹%éœ¹¥±•µ…¥°éœ¹•µ…¥°±•Ù•¹Ñ-•äèÁ…åµ•¹Ñ}½Ù•É‘Õ•}…¹•±±•œ±Ñ¥Ñ±”èŸ¦ûšršr«’îcš²û–ÞË–>[šÚ œ±‰½‘äèŸ–nƒ¢Ú¦;’îcš²ûšr¦fC¾ò3š¶“ž¶–‚Ç–B7¾ò?¦‚CžÒ–ÞË¢«–.W–>[šÚ#Žœ±µ•Ñ„éí‘Õ•Ðéœ¹Á…åµ•¹Ñ}‘Õ•}…Ññðœõô¤¹…Ñ   ¤ôùíô¤ì(€€€€€€€ÁÉ½•ÍÍ•‘I•Ì¹…‘¡MÑÉ¥¹œ¡œ¹¥¤¤ì(€€€€€ô(€€€€€ÁÉ½•ÍÍ•‘É½ÕÁÌ¹…‘¡É½ÕÁ-•ä¤ì(€€€õ•±Í”¥˜¡É•µ¥¹˜™¹½ÜøõÉ•µ¥¹˜˜…È¹É•µ¥¹‘•É}Í•¹Ð¥ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡È¹¥¥ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQõ€±íÉ•µ¥¹‘•É}Í•¹ÐéÑÉÕ•ô¤ì(€€€€€ÑÉåí½¹ÍÐÍ¸õ…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø±È¹Í•ÍÍ¥½¹}¥±P¤±ÍÐõ…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø±È¹Í•ÍÍ¥½¹}¥±P¤±‘¸õ•Ñ¥ÍÁ±…å9…µ”¡È¹¹…µ”±È¹‰É…¹‘}¹…µ•ñðœœ±ÍÐ¤±ÍÈõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡È¹Í•ÍÍ¥½¹}¥¥ô™Í•±•Ðõ‰…Í¥}•ÅÕ¥Á€¤±ÑŒõ…Ý…¥ÐÑà¡P¤í…Ý…¥Ðµ…¥±•…‘±¥¹•I•µ¥¹‘•È¡•¹Ø±È¹•µ…¥°±‘¸±Í¸±È¹¥±}½™™¥¥…±µ½Õ¹Ð¡È¤±Í…™•)Í½¸¡È¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸±mt¤±È¹•ÅÕ¥Áµ•¹Ñ}©Í½¸±ÍÉlÁtü¹‰…Í¥}•ÅÕ¥Áñðœœ±ÑŒ¥õ…Ñ ¡”¥íô(€€€€€…Ý…¥ÐÉ•½É‘9½Ñ¥™¥…Ñ¥½¸¡•¹Ø±íÑ•¹…¹Ñ%éP±Õ¹¥Ñ%éÈ¹½Á•É…Ñ¥½¹}Õ¹¥Ñ}¥‘ññ¹Õ±°±Í•ÍÍ¥½¹%éÈ¹Í•ÍÍ¥½¹}¥±É•¥ÍÑÉ…Ñ¥½¹%éÈ¹¥±•µ…¥°éÈ¹•µ…¥°±•Ù•¹Ñ-•äèÁ…åµ•¹Ñ}É•µ¥¹‘•Èœ±Ñ¥Ñ±”èŸ’îcš²ûšr¦fCš>C¦Hœ±‰½‘äèŸš
£žj–‚Ç–B7¾ò?¦‚CžÒ–Âkšr'š²û¦‚–ú–º3š"C¾ò3¢®/’úw’îcš²ûšr¦fC¢fWžBŽœ±µ•Ñ„éí‘Õ•ÐéÈ¹Á…åµ•¹Ñ}‘Õ•}…Ññðœõô¤¹…Ñ   ¤ôùíô¤ì(€€€ô(€ô)ô((¼¼ƒ¦/–ë¦ûšr¦‚CžVgšR“’ö7¾ò ÀÈèÀÀUQ¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸É½¹I•±•…Í•MÑ…±±Ì¡•¹Ø¤ì(€½¹ÍÐ¹½Ý5Ì€ô…Ñ”¹¹½Ü ¤ì(€€¼¼ƒ¢Þ£žžš"Û¾òk’î”Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðƒž
ëš¶–ò?šr¦fC¾òo¢"+¢ÎšZgšÊKšr'šr¦fCšfš&7žR ¡½±‘}Ñ¥µ”ƒžnã–ºç–"“šZßŽ(€½¹ÍÐÍÑ…±±Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°ÍÑ…±±Ìœ±ÍÑ…ÑÕÌõ•Ä¸•ä•À”äÀ•Ü”äÔ”ää™Í•±•Ðô©€¤ì(€½¹ÍÐÉ•±•…Í•‘I•Ì€ô¹•ÜM•Ð ¤ì(€™½È€¡½¹ÍÐÌ½˜€¡ÍÑ…±±Íññmt¤¤ì(€€€½¹ÍÐ•áÁ5Ì€ôÌ¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ð€ü…Ñ”¹Á…ÉÍ”¡Ì¹Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ð¤€è9…8ì(€€€½¹ÍÐ½±‘5Ì€ôÌ¹¡½±‘}Ñ¥µ”€ü…Ñ”¹Á…ÉÍ”¡Ì¹¡½±‘}Ñ¥µ”¤€è9…8ì(€€€½¹ÍÐ•áÁ¥É•€ô9Õµ‰•È¹¥Í¥¹¥Ñ”¡•áÁ5Ì¤(€€€€€€ü•áÁ5Ì€ðô¹½Ý5Ì(€€€€€€è€¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡½±‘5Ì¤€˜˜€¡¹½Ý5Ìµ½±‘5Ì¤€øôMQ11}!=1}eL¨ÈÐ¨ØÀ¨ØÀ¨ÄÀÀÀ¤ì(€€€¥˜€ …•áÁ¥É•¤½¹Ñ¥¹Õ”ì(€€€½¹ÍÐÑ•¹…¹Ñ%€ôÌ¹Ñ•¹…¹Ñ}¥ì(€€€½¹ÍÐÉ•%€ôMÑÉ¥¹œ¡Í•…ÑI•%¡Ì¥ñðœœ¤ì(€€€¥˜€¡É•%€˜˜€…É•±•…Í•‘I•Ì¹¡…Ì¡Ñ•¹…¹Ñ%¬ðœ­É•%¤¤ì(€€€€€½¹ÍÐÉÈ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘ô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡É•%¥ô™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤ì(€€€€€¥˜€¡ÉÈ¹±•¹Ñ ¤…Ý…¥ÐÉ•±•…Í•A…¥‘M•…Ñ!½±¡•¹Ø±Ñ•¹…¹Ñ%±ÉÉlÁt°É½¹}•áÁ¥É•œ¤ì(€€€€€•±Í”…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±¥õ•Ä¸‘íÌ¹¥‘ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘õ€±íÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€€€€€É•±•…Í•‘I•Ì¹…‘¡Ñ•¹…¹Ñ%¬ðœ­É•%¤ì(€€€ô•±Í”¥˜€ …É•%¤ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°ÍÑ…±±Ìœ±¥õ•Ä¸‘íÌ¹¥‘ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íÑ•¹…¹Ñ%‘õ€±íÍÑ…ÑÕÌèŸž¦ë¦ZHœ±É•¥ÍÑÉ…Ñ¥½¹}¥é¹Õ±°±•µ…¥°é¹Õ±°±¡½±‘}Ñ¥µ”é¹Õ±°±Í•…Ñ}¡½±‘}•áÁ¥É•Í}…Ðé¹Õ±±ô¤ì(€€€ô(€ô)ô((¼¼ƒ¢†3–&7š>C¦K¾ò ÀÄèÀÀUQ€ô€ÀäèÀÀƒ–>Ãž¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸É½¹AÉ•Ù•¹ÑI•µ¥¹‘•ÉÌ¡•¹Ø¤ì(€½¹ÍÐ¹½Ü€ô¹•Ü…Ñ” ¤ì(€€¼¼ƒ¢Þ£žžš"Û¾òkšJ#š&šr'–VžR£–‚Óš²„(€½¹ÍÐÍ•ÍÍ¥½¹Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±ÍÑ…ÑÕÌõ•Ä¸•Ô•À•Ä•Ô”äÀ”á•Ð•à•™Í•±•Ðô©€¤ì(€½¹ÍÐÑ…¡”€ôíôì(€…Íå¹Œ™Õ¹Ñ¥½¸•ÑI•µ¥¹‘•ÉQ•¹…¹ÑÑà¡Ñ¥¤ì(€€€¥˜€ …Ñ…¡•mÑ¥‘t¤Ñ…¡•mÑ¥‘t€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Ñ¥¤ì(€€€É•ÑÕÉ¸Ñ…¡•mÑ¥‘tì(€ô(€™½È€¡½¹ÍÐÌ½˜Í•ÍÍ¥½¹Ì¤ì(€€€½¹ÍÐQ99P€ôÌ¹Ñ•¹…¹Ñ}¥€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€€€½¹ÍÐ‘…Ñ•Ì€ôÍ…™•)Í½¸¡Ì¹‘…Ñ•Í}©Í½¸±mt¤ì(€€€¥˜€ …‘…Ñ•Ì¹±•¹Ñ ¤½¹Ñ¥¹Õ”ì(€€€½¹ÍÐ™¥ÉÍÐ€ô¹•Ü…Ñ”¡‘…Ñ•ÍlÁt¹‘…Ñ”¤ì(€€€½¹ÍÐ‘¥™˜€ô5…Ñ ¹•¥° ¡™¥ÉÍÐµ¹½Ü¤¼ ÄÀÀÀ¨ØÀ¨ØÀ¨ÈÐ¤¤ì(€€€€¼¼ƒšÒï–.W¦Ë–—–&48ƒ–’§–ú3š2žê3¢«–.W¢Žs’ö7¾ò#¦‚C¢¢´€Üƒ–’§Žšr’ö8€Ìƒ–’§¾ò'¾ò3’âžnÓ–"ÃšÒï–.W¦Z/–ž/–&7Ž(€€€€¼¼Í•…Ñ}…ÍÍ¥¹}‘½¹•}…Ðƒ–>«¢¢c¦2šr¢þG’âš²‡–~ß¢†3¾ò3’â7–7¦bïš¶‹–ú3žê3šZÃ’îcš²û¢¢Š¯¢Žs’ö7Ž(€€€½¹ÍÐ…ÕÑ½]¥¹‘½ÜõÍ•ÍÍ¥½¹ÕÑ½ÍÍ¥¹]¥¹‘½Ü¡Ì±¹½Ü¤ì(€€€¥˜€¡…ÕÑ½]¥¹‘½Ü¹…Ñ¥Ù”¤ì(€€€€€ÑÉäì(€€€€€€€…Ý…¥Ð‰…Ñ¡ÍÍ¥¹M•…ÑÍ½ÉM•ÍÍ¥½¸¡•¹Ø±Q99P±Ì¤ì(€€€€€€€½¹ÍÐÉ…¹Ðõ¹½Ý%Í¼ ¤ì(€€€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥õ€±íÍ•…Ñ}…ÍÍ¥¹}‘½¹•}…ÐéÉ…¹Ñô¤ì(€€€€€€€Ì¹Í•…Ñ}…ÍÍ¥¹}‘½¹•}…ÐõÉ…¹Ðì(€€€€€ô…Ñ ¡”¥ì½¹Í½±”¹•ÉÉ½È ½¹Ñ¥¹Õ½ÕÌ‰…Ñ …ÍÍ¥¸™…¥±•œ°”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é”¤ì±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”èÉ½¹AÉ•Ù•¹ÑI•µ¥¹‘•ÉÌœ±µ•ÍÍ…”è½¹Ñ¥¹Õ½ÕÌ‰…Ñ …ÍÍ¥¸™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìô(€€€ô(€€€¥˜€¡‘¥™˜„ôôÌ¤½¹Ñ¥¹Õ”ì(€€€€¼¼ƒ¢†3–&7¦kž~—–¾–ë–&7–7¢Žs¢ÞG’âš²‡¾ò3žŠë’þwš&šr'žVÛ’â/ž²›–B#šŠw’îÛ¢¦÷šr'’ö7žö»Ž(€€€ÑÉäì(€€€€€…Ý…¥Ð‰…Ñ¡ÍÍ¥¹M•…ÑÍ½ÉM•ÍÍ¥½¸¡•¹Ø±Q99P±Ì¤ì(€€€€€½¹ÍÐÉ…¹Ðõ¹½Ý%Í¼ ¤ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥õ€±íÍ•…Ñ}…ÍÍ¥¹}‘½¹•}…ÐéÉ…¹Ñô¤ì(€€€€€Ì¹Í•…Ñ}…ÍÍ¥¹}‘½¹•}…ÐõÉ…¹Ðì(€€€ô…Ñ ¡”¥ì±½ÉÉ½È¡•¹Ø±íÍ½ÕÉ”èÉ½¹AÉ•Ù•¹ÑI•µ¥¹‘•ÉÌœ±µ•ÍÍ…”èÁÉ”µµ…¥°‰…Ñ …ÍÍ¥¸™…¥±•œ±•ÉÉ½Èé”˜™”¹µ•ÍÍ…”ý”¹µ•ÍÍ…”é•ô¤ìô(€€€½¹ÍÐÉ•Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥ô™É•Ù¥•Ý}ÍÑ…ÑÕÌõ•Ä¸•Ô•Ü•È•ä”á”àÐ•Ô”á”äØ™Í•±•Ðô©€¤ì(€€€½¹ÍÐÑŒ€ô…Ý…¥Ð•ÑI•µ¥¹‘•ÉQ•¹…¹ÑÑà¡Q99P¤ì(€€€™½È€¡½¹ÍÐÈ½˜É•Ì¤ì(€€€€€¥˜€ …¥ÍA…¥‘MÑ…ÑÕÌ¡È¹Á…åµ•¹Ñ}ÍÑ…ÑÕÌ¤¤½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐ‘¸õ•Ñ¥ÍÁ±…å9…µ”¡È¹¹…µ”±È¹‰É…¹‘}¹…µ•ñðœœ¤ì(€€€€€ÑÉäì…Ý…¥Ðµ…¥±AÉ•Ù•¹ÑI•µ¥¹‘•È¡•¹Ø±È¹•µ…¥°±‘¸±Ì¹¹…µ”±‘…Ñ•ÍlÁt¹‘…Ñ”±Ì¹Ù•¹Õ•ñðœœ±ÑŒ±È¹¥±•ÅÕ¥ÁMÕµµ…ÉåÉ½µ)Í½¸¡È¹•ÅÕ¥Áµ•¹Ñ}©Í½¸¤±È¹ÍÑ…±±}¹Õµ‰•Éñðœœ±Ì¹Í•…Ñ}µ…Á}ÕÉ±ñðœœ¤ìô…Ñ íô(€€€ô(€ô)ô((¼¼ƒ’â7–>¿š*_–*o¦ûšr¢«–.W¦¢Êï¾ò ÀÈèÀÀUQ¾ò$)…Íå¹Œ™Õ¹Ñ¥½¸É½¹½É•…¹•±áÁ¥Éä¡•¹Ø¤ì(€½¹ÍÐ¹½Ü€ô¹•Ü…Ñ” ¤ì(€€¼¼ƒ¢Þ£žžš"Ø(€½¹ÍÐÍ•ÍÍ¥½¹Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±™½É•}…¹•°õ•Ä¹ÑÉÕ”™Í•±•Ðô©€¤ì(€™½È€¡½¹ÍÐÌ½˜Í•ÍÍ¥½¹Ì¤ì(€€€½¹ÍÐQ99P€ôÌ¹Ñ•¹…¹Ñ}¥€ì€€¼¼4´ÀË¾òiÑ•¹…¹Ðƒ–ÞËžRÇ¢Þ¿žRÇ–Æ“¦¦_¢¶'¾ò#¢š,É½ÕÑ••Ð½É½ÕÑ•A½ÍÓ¾ò$(€€€¥˜€ …Ì¹™½É•}…¹•±}‘•…‘±¥¹”¤½¹Ñ¥¹Õ”ì(€€€¥˜€¡¹½Üñ¹•Ü…Ñ”¡Ì¹™½É•}…¹•±}‘•…‘±¥¹”¤¤½¹Ñ¥¹Õ”ì(€€€€¼¼ƒš&û–ëšr«–k¦ãšNžj–‚Ç–B7¾ò!ÑÉ…¹Í™•É}ÍÑ…ÑÕÌƒž
ëž¦ëš"X¹Õ±³¾ò$(€€€½¹ÍÐÉ•Ì€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•ÍÍ¥½¹}¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ì¹¥¥ô™É•Ù¥•Ý}ÍÑ…ÑÕÌõ¥¸¸ •Ô•Ü•È•ä”á”àÐ•Ô”á”äØ°•Ô•	”àÔ•Ô••ä•Ø•À•à¤™Í•±•Ðô©€¤ì(€€€½¹ÍÐÕ¹ÁÉ½•ÍÍ•€ôÉ•Ì¹™¥±Ñ•È¡Èôø…È¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍññÈ¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÌôôôœœ¤ì(€€€½¹ÍÐÑŒ€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€€€™½È€¡½¹ÍÐÈ½˜Õ¹ÁÉ½•ÍÍ•¤ì(€€€€€…Ý…¥Ð‘‰UÁ‘…Ñ”¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±¥õ•Ä¸‘íÈ¹¥‘ô™Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qõ€±íÑÉ…¹Í™•É}ÍÑ…ÑÕÌèŸžRÏ¢®/¦¢Êìœ±ÑÉ…¹Í™•É}¡½Í•¹}…Ðé¹½Ý%Í¼ ¥ô¤ì(€€€€€½¹ÍÐÍÐõ…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø°È¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€€€€€½¹ÍÐ‘¸õ•Ñ¥ÍÁ±…å9…µ”¡È¹¹…µ”±È¹‰É…¹‘}¹…µ•ñðœœ±ÍÐ¤ì(€€€€€ÑÉäì…Ý…¥Ðµ…¥±ÕÑ½I•™Õ¹¡•¹Ø±È¹•µ…¥°±‘¸±Ì¹¹…µ”±ÑŒ¤ìô…Ñ íô(€€€ô(€ô)ô((¼¼ƒŠRŠR MQ%=8€ÄÔèƒ¢Þ¿žRÄƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR (()™Õ¹Ñ¥½¸¥ÍÍ…Á”¡Ø¥íÉ•ÑÕÉ¸MÑÉ¥¹œ¡Ùñðœœ¤¹É•Á±…” ½qp½œ°qqqpœ¤¹É•Á±…” ¼ì½œ°qpìœ¤¹É•Á±…” ¼°½œ°qp°œ¤¹É•Á±…” ½q¸½œ°qq¸œ¥ô)™Õ¹Ñ¥½¸¥Í…Ñ”¡‘…Ñ”±ÍÑ…ÉÐ¥íÉ•ÑÕÉ¸MÑÉ¥¹œ¡‘…Ñ•ñðœœ¤¹É•Á±…” ¼´½œ°œœ¤¬Pœ­MÑÉ¥¹œ¡ÍÑ…ÉÑñðœÀÀèÀÀœ¤¹É•Á±…” ¼è½œ°œœ¤¹Á…‘¹ Ø°œÀœ¥ô)…Íå¹Œ™Õ¹Ñ¥½¸¡	½½­¥¹…±•¹‘…É%Ì¡•¹Ø±À¥ì(½¹ÍÐPõÀ¹}Ñ•¹…¹Ñ%±…±•¹‘…É%õMÑÉ¥¹œ¡À¹…±•¹‘…É%‘ñðœœ¤í¥˜ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±À¹•µ…¥°±À¹Ñ½­•¸±P¤¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤í½¹ÍÐÉ•Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðõ¥±Í•ÍÍ¥½¹}¥±‰½½­¥¹}…±•¹‘…É}¥±¹…µ”±‰É…¹‘}¹…µ”±Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸±ÕÍÑ½µ}™¥•±‘Í}©Í½¸±É•Ù¥•Ý}ÍÑ…ÑÕÌ±ÑÉ…¹Í™•É}ÍÑ…ÑÕÍ€¤í½¹ÍÐÍ•ÍÍ¥½¹Ìõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™Í•±•Ðõ¥±¹…µ”±Ù•¹Õ•€¤í½¹ÍÐÍ´õ=‰©•Ð¹™É½µ¹ÑÉ¥•Ì¡Í•ÍÍ¥½¹Ì¹µ…À¡àôùmà¹¥±át¤¤í½¹ÍÐÍ±½Ñ%‘Ìõl¸¸¹¹•ÜM•Ð¡É•Ì¹™±…Ñ5…À¡É•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½Ñ%‘Ì¤¥tí±•ÐÍ±½ÑÌõmtí¥˜¡Í±½Ñ%‘Ì¹±•¹Ñ ¥Í±½ÑÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Ñ¥µ•Í±½ÑÌœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ¥¸¸ ‘íÍ±½Ñ%‘Ì¹µ…À¡àôù•¹½‘•UI%½µÁ½¹•¹Ð¡à¤¤¹©½¥¸ œ°œ¥ô¤™Í•±•Ðô©€¤¹…Ñ   ¤ôùmt¤í½¹ÍÐÍ°õ=‰©•Ð¹™É½µ¹ÑÉ¥•Ì¡Í±½ÑÌ¹µ…À¡àôùmà¹¥±át¤¤í±•Ð½ÕÐõl	%8éY19Hœ°YIM%=8èÈ¸Àœ°AI=%è´¼½=%9¼½	½½­¥¹œ…±•¹‘…È¼½i µQ\œ°1M1éI=I%8tí™½È¡½¹ÍÐÈ½˜É•Ì¥í¥˜¡lŸ–ÞË–>[šÚ œ°Ÿ’â7¦2–>Xt¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡È¹É•Ù¥•Ý}ÍÑ…ÑÕÍñðœœ¤¥ññlŸ–ÞË¦¢Êìœ°Ÿ–ÞË¦š²øt¹¥¹±Õ‘•Ì¡MÑÉ¥¹œ¡È¹ÑÉ…¹Í™•É}ÍÑ…ÑÕÍñðœœ¤¤¥½¹Ñ¥¹Õ”í™½È¡½¹ÍÐ¥½˜É•¥ÍÑÉ…Ñ¥½¹Q¥µ•Í±½Ñ%‘Ì¡È¤¥í½¹ÍÐàõÍ±m¥‘t±ÌõÍµmÈ¹Í•ÍÍ¥½¹}¥‘uññíôí¥˜ …áññ…±•¹‘…É%˜™MÑÉ¥¹œ¡È¹‰½½­¥¹}…±•¹‘…É}¥‘ññà¹‰½½­¥¹}…±•¹‘…É}¥‘ñðœœ¤„ôõ…±•¹‘…É%¥½¹Ñ¥¹Õ”í½ÕÐ¹ÁÕÍ  	%8éYY9Pœ°U%èœ­È¹¥¬œ´œ­¥¬‘½¥¹œœ°QMQIPíQi%õÍ¥„½Q…¥Á•¤èœ­¥Í…Ñ”¡à¹‘…Ñ•}­•ä±à¹ÍÑ…ÉÑ}Ñ•áÐ¤°Q9íQi%õÍ¥„½Q…¥Á•¤èœ­¥Í…Ñ”¡à¹‘…Ñ•}­•ä±à¹•¹‘}Ñ•áÑññà¹ÍÑ…ÉÑ}Ñ•áÐ¤°MU55Idèœ­¥ÍÍ…Á” ¡Ì¹¹…µ•ñðŸ¦‚CžÒœ¤¬Ÿ¾öpœ¬¡È¹‰É…¹‘}¹…µ•ññÈ¹¹…µ•ñðœœ¤¤°1=Q%=8èœ­¥ÍÍ…Á”¡Ì¹Ù•¹Õ•ñðœœ¤°9éYY9Pœ¥õõ½ÕÐ¹ÁÕÍ  9éY19Hœ¤íÉ•ÑÕÉ¸¹•ÜI•ÍÁ½¹Í”¡½ÕÐ¹©½¥¸ qÉq¸œ¤±íÍÑ…ÑÕÌèÈÀÀ±¡•…‘•ÉÌéì¸¸¹½ÉÍ!•…‘•ÉÌ ¤°½¹Ñ•¹ÐµQåÁ”œèÑ•áÐ½…±•¹‘…Èì¡…ÉÍ•ÐõÕÑ˜´àœ°½¹Ñ•¹Ðµ¥ÍÁ½Í¥Ñ¥½¸œè¥¹±¥¹”ì™¥±•¹…µ”ô‰‘½¥¹œµ‰½½­¥¹Ì¹¥Ìˆõô¥ô()…Íå¹Œ™Õ¹Ñ¥½¸¡•ÑMåÍÑ•µ…Ñ……Ñ…±½œ¡•¹Ø±À¥ì(€½¹ÍÐÁ…äõ…Ý…¥ÐÙ•É¥™å‘µ¥¹)ÝÐ¡À¹Ñ½­•¸±•¹Ø¤ì(€¥˜ …Á…åññÁ…ä¹¹½Éµ…±¥é•‘}É½±”„ôôÁ±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€½¹ÍÐÉ½ÝÌõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Á±…Ñ™½Éµ}Í•ÑÑ¥¹Ìœ°Í•ÑÑ¥¹}­•äõ•Ä¹ÍåÍÑ•µ}‘…Ñ…}…Ñ…±½œ™Í•±•ÐõÍ•ÑÑ¥¹}­•ä±Ù…±Õ•}©Í½¸±ÕÁ‘…Ñ•‘}…Ð™±¥µ¥ÐôÄœ¤ì(€½¹ÍÐÉ½ÜõÉ½ÝÍlÁuññ¹Õ±°ì(€±•Ð…Ñ…±½œõÉ½Üü¹Ù…±Õ•}©Í½¹ññíôì(€¥˜¡ÑåÁ•½˜…Ñ…±½œôôôÍÑÉ¥¹œœ¥íÑÉåí…Ñ…±½œõ)M=8¹Á…ÉÍ”¡…Ñ…±½œ¥õ…Ñ ¡|¥í…Ñ…±½œõíõõô(€É•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±…Ñ…±½œ±ÕÁ‘…Ñ•‘ÐéÉ½Üü¹ÕÁ‘…Ñ•‘}…Ñññ¹Õ±±ô¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸É½ÕÑ••Ð¡•¹Ø°…Ñ¥½¸°À°É•Ä¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½Éµ5•µ‰•ÉAÉ½™¥±”œ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½Éµ5•µ‰•ÉAÉ½™¥±”¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•Ñ5å	É…¹‘Ìœ¤É•ÑÕÉ¸…Ý…¥Ð¡•Ñ5å	É…¹‘Ì¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôôµ…Ñ¡	É…¹‘…¹‘¥‘…Ñ•Ìœ¤É•ÑÕÉ¸…Ý…¥Ð¡5…Ñ¡	É…¹‘…¹‘¥‘…Ñ•Ì¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•Ñ	É…¹‘•ÍÍI•ÅÕ•ÍÑÌœ¤É•ÑÕÉ¸…Ý…¥Ð¡•Ñ	É…¹‘•ÍÍI•ÅÕ•ÍÑÌ¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑI•¥ÍÑÉ…Ñ¥½¹Q•…´œ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑI•¥ÍÑÉ…Ñ¥½¹Q•…´¡•¹Ø±À¤ì(€€¼¼ƒ’â7¦r¢šÑ•¹…¹Ðƒžj¢Þ¿žRÄ(€¥˜€¡…Ñ¥½¸ôôôÁÕ‰±¥¥Í½Ù•Éäœ¤É•ÑÕÉ¸…Ý…¥Ð¡AÕ‰±¥¥Í½Ù•Éä¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôôÁÕ‰±¥áÁ½ÍÕÉ•••œ¤É•ÑÕÉ¸…Ý…¥Ð¡AÕ‰±¥áÁ½ÍÕÉ•••¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôôÁÕ‰±¥A±…Ñ™½ÉµAÉ½™¥±”œ¤É•ÑÕÉ¸…Ý…¥Ð¡AÕ‰±¥A±…Ñ™½ÉµAÉ½™¥±”¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½ÉµAÕ‰±¥AÉ½™¥±”œ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½ÉµAÕ‰±¥AÉ½™¥±”¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑáÁ½ÍÕÉ•A±…¹ÍA±…Ñ™½É´œ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑáÁ½ÍÕÉ•A±…¹ÍA±…Ñ™½É´¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½ÉµáÁ½ÍÕÉ•=É‘•ÉÌœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½ÉµáÁ½ÍÕÉ•=É‘•ÉÌ¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½ÉµÑÑÉ¥‰ÕÑ¥½¹I•Á½ÉÐœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½ÉµÑÑÉ¥‰ÕÑ¥½¹I•Á½ÉÐ¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•Ñ5åI•Í±½‰…°œ¤É•ÑÕÉ¸…Ý…¥Ð¡•Ñ5åI•Í±½‰…°¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô…‘µ¥¹5”œ¤É•ÑÕÉ¸…Ý…¥Ð¡‘µ¥¹5”¡•¹Ø°À¤ì(€¥˜€¡…Ñ¥½¸ôôô±¥ÍÑ1½¥¹]½É­ÍÁ…•Ìœ¤É•ÑÕÉ¸…Ý…¥Ð¡1¥ÍÑ1½¥¹]½É­ÍÁ…•Ì¡•¹Ø°À¤ì(€¥˜€¡…Ñ¥½¸ôôô…ÁÁ±å1¥ÍÐœ¤É•ÑÕÉ¸…Ý…¥Ð¡ÁÁ±å1¥ÍÐ¡•¹Ø°À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑQ•¹…¹ÑÍ‘µ¥¸œ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑQ•¹…¹ÑÍ‘µ¥¸¡•¹Ø°À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½Éµ…Í¡‰½…Éœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½Éµ…Í¡‰½…É¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½Éµ5•ÑÉ¥•Ñ…¥±Ìœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½Éµ5•ÑÉ¥•Ñ…¥±Ì¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑMåÍÑ•µ…Ñ……Ñ…±½œœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑMåÍÑ•µ…Ñ……Ñ…±½œ¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½Éµ5•µ‰•ÉÍ‘µ¥¸œ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½Éµ5•µ‰•ÉÍ‘µ¥¸¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½Éµ•ÍÍÍÍ¥¹µ•¹ÑÌœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½Éµ•ÍÍÍÍ¥¹µ•¹ÑÌ¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½Éµ	¥±±¥¹A½±¥äœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½Éµ	¥±±¥¹A½±¥ä¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½ÉµA…åµ•¹ÑAÉ½™¥±”œ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½ÉµA…åµ•¹ÑAÉ½™¥±”¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑQ•¹…¹Ñ	¥±±¥¹A±…Ñ™½É´œ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑQ•¹…¹Ñ	¥±±¥¹A±…Ñ™½É´¡•¹Ø±À¤ì(€€€€€€€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½ÉµM•ÉÙ¥•M…±•Ìœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½ÉµM•ÉÙ¥•M…±•Ì¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑAÕ‰±¥	¥±±¥¹A½±¥äœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑAÕ‰±¥	¥±±¥¹A½±¥ä¡•¹Ø¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½ÉµMÕÁÁ½ÉÑQ¡É•…‘Ìœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½ÉµMÕÁÁ½ÉÑQ¡É•…‘Ì¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½ÉµMÕÁÁ½ÉÑ5•ÍÍ…•Ìœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½ÉµMÕÁÁ½ÉÑ5•ÍÍ…•Ì¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½ÉµQ•¹…¹Ñ5½‘Õ±•Ìœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑA±…Ñ™½ÉµQ•¹…¹Ñ5½‘Õ±•Ì¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôôÁ±…Ñ™½ÉµQ•¹…¹Ñ=Ý¹•ÉMÑ…ÑÕÌœ¤É•ÑÕÉ¸…Ý…¥Ð¡A±…Ñ™½ÉµQ•¹…¹Ñ=Ý¹•ÉMÑ…ÑÕÌ¡•¹Ø°À¤ì(€¥˜€¡…Ñ¥½¸ôôôÁ±…Ñ™½ÉµQ•¹…¹ÑM•ÍÍ¥½¹Ìœ¤É•ÑÕÉ¸…Ý…¥Ð¡A±…Ñ™½ÉµQ•¹…¹ÑM•ÍÍ¥½¹Ì¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôôÁ±…Ñ™½ÉµQ•¹…¹Ñ=Á•É…Ñ¥½¹U¹¥ÑÌœ¤É•ÑÕÉ¸…Ý…¥Ð¡A±…Ñ™½ÉµQ•¹…¹Ñ=Á•É…Ñ¥½¹U¹¥ÑÌ¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑA±…Ñ™½ÉµÉ•‘¥Ñ	…±…¹”œ¥í½¹ÍÐÁ…äõ…Ý…¥ÐÙ•É¥™å‘µ¥¹)ÝÐ¡À¹Ñ½­•¸±•¹Ø¤í¥˜ …Á…åññÁ…ä¹¹½Éµ…±¥é•‘}É½±”„ôôÁ±…Ñ™½Éµ}ÍÕÁ•É}…‘µ¥¸œ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤íÉ•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ”±‰…±…¹”é…Ý…¥ÐÁ±…Ñ™½ÉµÉ•‘¥Ñ	…±…¹”¡•¹Ø±MÑÉ¥¹œ¡À¹Ñ…É•Ñ}Ñ•¹…¹Ñ}¥‘ñðœœ¤¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤¥ô¤íô(€¥˜€¡…Ñ¥½¸ôôô•Ñ=Á•É…Ñ¥¹	¥±±¥¹MÑ…ÑÕÌœ¤É•ÑÕÉ¸…Ý…¥Ð¡•Ñ=Á•É…Ñ¥¹	¥±±¥¹MÑ…ÑÕÌ¡•¹Ø±À¤ì(€¥˜€¡…Ñ¥½¸ôôô•ÑMÑ…ÉÑÕÁÉ•‘¥ÑA½±¥äœ¤É•ÑÕÉ¸…Ý…¥Ð¡•ÑMÑ…ÉÑÕÁÉ•‘¥ÑA½±¥ä¡•¹Ø±À¤ì((€€¼¼=%9¾òkžžš"ÛžRÇžfï–”)]SŽ–‚Óš²„¿–‚Ç–B7¦^s¢¿š"[žžš"ØÍ¥Ñ•}ÕÉ°ƒ¢«–.W¢žšzC¾ò3’â7¢ššÆ’öÿžR£¢¢òã–—’îžŠóŽ(€½¹ÍÐQ99P€ô…Ý…¥ÐÉ•Í½±Ù•Q•¹…¹Ñ½ÉI•ÅÕ•ÍÐ¡•¹Ø°À°É•Ä¤ì(€¥˜€ …Q99P¤ì(€€€É•ÑÕÉ¸¹•ÜI•ÍÁ½¹Í”¡)M=8¹ÍÑÉ¥¹¥™ä¡í½¬é™…±Í”°•ÉÉ½ÈèŸž‡šÎW¢ú£¢¶c’âï¢ú›ž¦ë¦ZO¾ò3¢®/–ú{’âï¢ú›š>C’úožjšÒï–.W¦žÖC¦Ë–”ô¤°íÍÑ…ÑÕÌèÐÀÀ°¡•…‘•ÉÌé½ÉÍ!•…‘•ÉÌ ¥ô¤ì(€ô(€À¹Ñ•¹…¹Ð€ôQ99Pì(€À¹}Ñ•¹…¹Ñ%€ôQ99Pì€€¼¼ƒšÎ£–—’úl¡…¹‘±•Èƒ’öÿžR (€€¼¼ƒ¦žÞkšâ³¢¦˜€¼ƒ¢¢ëšZÜ(€¥˜€¡…Ñ¥½¸ôôôÁ¥¹œœ¤ì(€€€±•ÐÍÕÁ…‰…Í•=¬õ™…±Í”°ÍÑ…™™½Õ¹ÐôÀ°Í•ÍÍ¥½¹½Õ¹ÐôÀ°•ÉÉ5Íœôœœì(€€€ÑÉäì(€€€€€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°ÍÑ…™˜œ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðõ•µ…¥°±É½±•€¤ì(€€€€€ÍÕÁ…‰…Í•=¬õÑÉÕ”ìÍÑ…™™½Õ¹ÐõÉ½ÝÌ¹±•¹Ñ ì(€€€ô…Ñ ¡”¤ì•ÉÉ5Íœõ”¹µ•ÍÍ…”ìô(€€€ÑÉäì(€€€€€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™Í•±•Ðõ¥‘€¤ì(€€€€€Í•ÍÍ¥½¹½Õ¹ÐõÉ½ÝÌ¹±•¹Ñ ì(€€€ô…Ñ ¡”¤íô(€€€É•ÑÕÉ¸©Í½¹=¬¡ì(€€€€€½¬éÑÉÕ”°Ñ•¹…¹ÐéQ99P°(€€€€€ÍÕÁ…‰…Í”èÍÕÁ…‰…Í•=¬€ü€ŸŠrƒš¶–âàœ€è€ŸŠv0ƒ–’ÇšV_¾òhœ­•ÉÉ5Íœ°(€€€€€ÍÑ…™™½Õ¹Ð°Í•ÍÍ¥½¹½Õ¹Ð°(€€€€€•¹Ù}ÍÕÁ…‰…Í•}ÕÉ°è•¹Ø¹MUA	M}UI0€ü€ŸŠrƒ–ÞË¢¢·–ºhœ€è€ŸŠv0ƒšr«¢¢·–ºhœ°(€€€€€•¹Ù}ÍÕÁ…‰…Í•}­•äèÍÕÁ…‰…Í•M•ÉÙ¥•I½±•-•ä¡•¹Ø¤€ü€ŸŠrƒ–ÞË¢¢·–ºhœ€è€ŸŠv0ƒšr«¢¢·–ºhœ°(€€€€€•¹Ù}É•Í•¹‘}­•äè•¹Ø¹IM9}-d€ü€ŸŠrƒ–ÞË¢¢·–ºhœ€è€ŸŠv0ƒšr«¢¢·–ºhœ°(€€€ô¤ì(€ô(€¥˜€¡…Ñ¥½¸ôôô•Á…åI•ÑÕÉ¸œ¤ì(€€€É•ÑÕÉ¸¹•ÜI•ÍÁ½¹Í” œÁó’îcš²øA$ƒ–Âkšr«–VžR œ±íÍÑ…ÑÕÌèÈÀÁô¤ì(€ô(€¥˜€¡…Ñ¥½¸ôôô±¥¹•A…å½¹™¥É´œ¤É•ÑÕÉ¸©Í½¹ÉÈ 1%9A…äƒ–Âkšr«–VžR œ¤ì(€¥˜€¡…Ñ¥½¸ôôô±¥¹•A…å…¹•°œ¤É•ÑÕÉ¸©Í½¹ÉÈ 1%9A…äƒ–Âkšr«–VžR œ¤ì((€½¹ÍÐ™•…ÑÕÉ••¹¥•€ô…Ý…¥Ð•¹™½É•Q•¹…¹Ñ•…ÑÕÉ”¡•¹Ø°Q99P°…Ñ¥½¸¤ì(€¥˜€¡™•…ÑÕÉ••¹¥•¤É•ÑÕÉ¸™•…ÑÕÉ••¹¥•ì(€½¹ÍÐÉ½±••¹¥•€ô…Ý…¥Ð•¹™½É•Q•¹…¹ÑI½±”¡•¹Ø°Q99P°…Ñ¥½¸°À¤ì(€¥˜€¡É½±••¹¥•¤É•ÑÕÉ¸É½±••¹¥•ì((€ÍÝ¥Ñ ¡…Ñ¥½¸¤ì(€€€…Í”€™É½¹Ñ	½½ÑÍÑÉ…Àœè€€€€€É•ÑÕÉ¸¡É½¹Ñ	½½ÑÍÑÉ…À¡•¹Ø±À¤ì(€€€…Í”€•Ñ=Á•É…Ñ¥½¹U¹¥ÑÍAÕ‰±¥ŒœèÉ•ÑÕÉ¸¡•Ñ=Á•É…Ñ¥½¹U¹¥ÑÍAÕ‰±¥Œ¡•¹Ø±À¤ì(€€€…Í”€•Ñ=Á•É…Ñ¥½¹U¹¥ÑÍ‘µ¥¸œèÉ•ÑÕÉ¸¡•Ñ=Á•É…Ñ¥½¹U¹¥ÑÍ‘µ¥¸¡•¹Ø±À¤ì(€€€…Í”€•Ñ	½½­¥¹…±•¹‘…É‘µ¥¸œèÉ•ÑÕÉ¸¡•Ñ	½½­¥¹…±•¹‘…É‘µ¥¸¡•¹Ø±À¤ì(€€€…Í”€•ÑAÉ½µ½Ñ¥½¹IÕ±•Í‘µ¥¸œèÉ•ÑÕÉ¸¡•ÑAÉ½µ½Ñ¥½¹IÕ±•Í‘µ¥¸¡•¹Ø±À¤ì(€€€…Í”€•ÑáÁ½ÍÕÉ•…Ñ…±½œœèÉ•ÑÕÉ¸¡•ÑáÁ½ÍÕÉ•…Ñ…±½œ¡•¹Ø±À¤ì(€€€…Í”€•Ñ5åI•Ý…É‘ÌœèÉ•ÑÕÉ¸¡•Ñ5åI•Ý…É‘Ì¡•¹Ø±À¤ì(€€€…Í”€•Ñ5å9½Ñ¥™¥…Ñ¥½¹ÌœèÉ•ÑÕÉ¸¡•Ñ5å9½Ñ¥™¥…Ñ¥½¹Ì¡•¹Ø±À¤ì(€€€…Í”€•Ñ9½Ñ¥™¥…Ñ¥½¹Í‘µ¥¸œèÉ•ÑÕÉ¸¡•Ñ9½Ñ¥™¥…Ñ¥½¹Í‘µ¥¸¡•¹Ø±À¤ì(€€€…Í”€‰½½­¥¹…±•¹‘…É%ÌœèÉ•ÑÕÉ¸¡	½½­¥¹…±•¹‘…É%Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑÙ•¹ÑÌœè€€€€€€€€€€É•ÑÕÉ¸¡•ÑÙ•¹ÑÌ¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¹Ìœè€€€€€€€€É•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹Ì¡•¹Ø±À¤ì(€€€…Í”€•Ñ	Õ¹‘±•ÍAÕ‰±¥Œœè€€€É•ÑÕÉ¸¡•Ñ	Õ¹‘±•ÍAÕ‰±¥Œ¡•¹Ø±À¤ì(€€€…Í”€•Ñ	Õ¹‘±•Ìœè€€€€€€€€€É•ÑÕÉ¸¡•Ñ	Õ¹‘±•Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¸œè€€€€€€€€€É•ÑÕÉ¸¡•ÑM•ÍÍ¥½¸¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¹É••µ•¹ÐœèÉ•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹É••µ•¹Ð¡•¹Ø±À¤ì(€€€…Í”€±¥ÍÑÑ¥Ù•A¡½Ñ½Ñ¥Ù¥Ñ¥•ÌœèÉ•ÑÕÉ¸¡1¥ÍÑÑ¥Ù•A¡½Ñ½Ñ¥Ù¥Ñ¥•Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑA¡½Ñ½Ñ¥Ù¥Ñå	åM±ÕœœèÉ•ÑÕÉ¸¡•ÑA¡½Ñ½Ñ¥Ù¥Ñå	åM±Õœ¡•¹Ø±À¤ì(€€€…Í”€•Ñ5•µ‰•Èœè€€€€€€€€€€É•ÑÕÉ¸¡•Ñ5•µ‰•È¡•¹Ø±À¤ì(€€€…Í”€•Ñ5åI•Ìœè€€€€€€€€€€É•ÑÕÉ¸¡•Ñ5åI•Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑI•1½½­ÕÀœè€€€€€€€É•ÑÕÉ¸¡•ÑI•1½½­ÕÀ¡•¹Ø±À¤ì(€€€…Í”€•Ñ¹¹½Õ¹•µ•¹ÑÌœè€€€É•ÑÕÉ¸¡•Ñ¹¹½Õ¹•µ•¹ÑÌ¡•¹Ø±À¤ì(€€€…Í”€•ÑM•…Ñ5…Àœè€€€€€€€€€É•ÑÕÉ¸¡•ÑM•…Ñ5…À¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¹M¡½ÉÑ1¥¹¬œèÉ•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹M¡½ÉÑ1¥¹¬¡•¹Ø±À¤ì(€€€…Í”€•ÑÉÉ½É1½Ìœè€€€€€€€É•ÑÕÉ¸¡•ÑÉÉ½É1½Ì¡•¹Ø±À¤ì(€€€…Í”€…‘µ¥¹1½¥¸œè€€€€€€€€€É•ÑÕÉ¸¡‘µ¥¹1½¥¸¡•¹Ø±À¤ì(€€€…Í”€…ÁÁ±åQÉ¥…°œè€€€€€€€€€É•ÑÕÉ¸¡ÁÁ±åQÉ¥…°¡•¹Ø±À¤ì(€€€…Í”€…ÁÁÉ½Ù•ÁÁ±äœè€€€€€€€É•ÑÕÉ¸¡ÁÁÉ½Ù•ÁÁ±ä¡•¹Ø±À¤ì(€€€…Í”€É•ÅÕ•ÍÑÁÁ±åMÕÁÁ±•µ•¹ÐœèÉ•ÑÕÉ¸¡I•ÅÕ•ÍÑÁÁ±åMÕÁÁ±•µ•¹Ð¡•¹Ø±À¤ì(€€€…Í”€±½­Q•¹…¹Ðœè€€€€€€€€€É•ÑÕÉ¸¡1½­Q•¹…¹Ð¡•¹Ø±À¤ì(€€€…Í”€Õ¹±½­Q•¹…¹Ðœè€€€€€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢"(€ÌÀƒš^—žê3¢ÊïšÖž¢/–ÞË–sžR£¾ò3¢®/’öÿžR£š¶–ò?ž¦/š²(œ¤ì(€€€…Í”€…‘µ¥¹1½½ÕÐœè€€€€€€€€É•ÑÕÉ¸¡‘µ¥¹1½½ÕÐ¡•¹Ø±À¤ì(€€€…Í”€…‘µ¥¹5”œè€€€€€€€€€€€€É•ÑÕÉ¸¡‘µ¥¹5”¡•¹Ø±À¤ì(€€€…Í”€•Ñ…Í¡‰½…Éœè€€€€€€€É•ÑÕÉ¸¡•Ñ…Í¡‰½…É¡•¹Ø±À¤ì(€€€…Í”€…‘µ¥¹	ÕÍ¥¹•ÍÍ=Ù•ÉÙ¥•ÜœèÉ•ÑÕÉ¸¡‘µ¥¹	ÕÍ¥¹•ÍÍ=Ù•ÉÙ¥•Ü¡•¹Ø±À¤ì(€€€…Í”€™¥¹…¹•=Ù•ÉÙ¥•ÜœèÉ•ÑÕÉ¸¡¥¹…¹•=Ù•ÉÙ¥•Ü¡•¹Ø±À¤ì(€€€…Í”€™¥¹…¹•I•Á½ÉÐœèÉ•ÑÕÉ¸¡¥¹…¹•I•Á½ÉÐ¡•¹Ø±À¤ì(€€€…Í”€…‘µ¥¹¥¹…¹•¹½µ…±¥•ÌœèÉ•ÑÕÉ¸¡‘µ¥¹¥¹…¹•¹½µ…±¥•Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¹…Í¡‰½…ÉœèÉ•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹…Í¡‰½…É¡•¹Ø±À¤ì(€€€…Í”€…‘µ¥¹M•…Ñ	½…ÉœèÉ•ÑÕÉ¸¡‘µ¥¹M•…Ñ	½…É¡•¹Ø±À¤ì(€€€…Í”€•ÑQ½‘½ÌœèÉ•ÑÕÉ¸¡•ÑQ½‘½Ì¡•¹Ø±À¤ì(€€€…Í”€•Ñ‘µ¥¹M•ÍÍ¥½¹Í…Í¡‰½…ÉœèÉ•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹…Í¡‰½…É¡•¹Ø±À¤ì(€€€…Í”€•Ñ‘µ¥¹M•ÍÍ¥½¹…Í¡‰½…ÉœèÉ•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹…Í¡‰½…É¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¹I•¥ÍÑÉ…Ñ¥½¹ÌœèÉ•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹I•¥ÍÑÉ…Ñ¥½¹Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¹ÅÕ¥Áµ•¹Ñ•Ñ…¥±ÌœèÉ•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹ÅÕ¥Áµ•¹Ñ•Ñ…¥±Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑA…åµ•¹ÑM•ÑÑ¥¹ÌœèÉ•ÑÕÉ¸¡•ÑA…åµ•¹ÑM•ÑÑ¥¹Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑA…åµ•¹ÑAÉ½™¥±•ÌœèÉ•ÑÕÉ¸¡•ÑA…åµ•¹ÑAÉ½™¥±•Ì¡•¹Ø±À¤ì(€€€…Í”€•Ñ¥¹…¹•A…åµ•¹ÑÉ½ÕÁÌœèÉ•ÑÕÉ¸¡•Ñ¥¹…¹•A…åµ•¹ÑÉ½ÕÁÌ¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¹…Í¡‰½½¬œèÉ•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹…Í¡‰½½¬¡•¹Ø±À¤ì(€€€…Í”€•Ñµ…¥±Q•µÁ±…Ñ•ÌœèÉ•ÑÕÉ¸¡•Ñµ…¥±Q•µÁ±…Ñ•Ì¡•¹Ø±À¤ì(€€€…Í”€•Ñ5•µ‰•ÉÌœèÉ•ÑÕÉ¸¡•Ñ5•µ‰•ÉÌ¡•¹Ø±À¤ì(€€€…Í”€•Ñ5•µ‰•É!¥ÍÑ½ÉäœèÉ•ÑÕÉ¸¡•Ñ5•µ‰•É!¥ÍÑ½Éä¡•¹Ø±À¤ì(€€€…Í”€•Ñ½µÁ…¹åM•ÑÑ¥¹ÌœèÉ•ÑÕÉ¸¡•Ñ½µÁ…¹åM•ÑÑ¥¹Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑQ•¹…¹Ñ5½‘Õ±•AÉ½™¥±”œèÉ•ÑÕÉ¸¡•ÑQ•¹…¹Ñ5½‘Õ±•AÉ½™¥±”¡•¹Ø±À¤ì(€€€…Í”€•ÑQ•¹…¹ÑQ¡•µ”œèÉ•ÑÕÉ¸¡•ÑQ•¹…¹ÑQ¡•µ”¡•¹Ø±À¤ì(€€€…Í”€•ÑMÕÁÁ½ÉÑQ¡É•…‘ÌœèÉ•ÑÕÉ¸¡•ÑMÕÁÁ½ÉÑQ¡É•…‘Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑMÕÁÁ½ÉÑ5•ÍÍ…•ÌœèÉ•ÑÕÉ¸¡•ÑMÕÁÁ½ÉÑ5•ÍÍ…•Ì¡•¹Ø±À¤ì(€€€…Í”€‘½Ý¹±½…‘M•ÍÍ¥½¸œè€€€€É•ÑÕÉ¸¡½Ý¹±½…‘M•ÍÍ¥½¸¡•¹Ø±À¤ì(€€€…Í”€•ÑI•Ìœè€€€€€€€€€€€€É•ÑÕÉ¸¡•ÑI•Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑI•Í	åM•ÍÍ¥½¸œè€€€É•ÑÕÉ¸¡•ÑI•Í	åM•ÍÍ¥½¸¡•¹Ø±À¤ì(€€€…Í”€½¹Í¥Ñ•M•ÍÍ¥½¹Ìœè€€€€€É•ÑÕÉ¸¡=¹Í¥Ñ•M•ÍÍ¥½¹Ì¡•¹Ø±À¤ì(€€€…Í”€½¹Í¥Ñ•I•Ìœè€€€€€€€€€É•ÑÕÉ¸¡=¹Í¥Ñ•I•Ì¡•¹Ø±À¤ì(€€€…Í”€½¹Í¥Ñ•A…ÍÍ½‘•Y•É¥™äœèÉ•ÑÕÉ¸¡=¹Í¥Ñ•A…ÍÍ½‘•Y•É¥™ä¡•¹Ø±À¤ì(€€€…Í”€½¹Í¥Ñ•M¡¥™Ñ1¥ÍÐœèÉ•ÑÕÉ¸¡=¹Í¥Ñ•M¡¥™Ñ1¥ÍÐ¡•¹Ø±À¤ì(€€€…Í”€½¹Í¥Ñ•A…ÍÍ½‘•1¥ÍÐœè€€É•ÑÕÉ¸¡=¹Í¥Ñ•A…ÍÍ½‘•1¥ÍÐ¡•¹Ø±À¤ì(€€€…Í”€•ÑMÑ…™˜œè€€€€€€€€€€€É•ÑÕÉ¸¡•ÑMÑ…™˜¡•¹Ø±À¤ì(€€€…Í”€•ÑÙ•¹ÑÍ‘µ¥¸œè€€€€€É•ÑÕÉ¸¡•ÑÙ•¹ÑÍ‘µ¥¸¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¹Í‘µ¥¸œè€€€É•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹Í‘µ¥¸¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¹Y¥ÍÕ…±ÍÍ•ÑÌœèÉ•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹Y¥ÍÕ…±ÍÍ•ÑÌ¡•¹Ø±À¤ì(€€€…Í”€•ÑM•ÍÍ¥½¹Y¥ÍÕ…±)½‰ÌœèÉ•ÑÕÉ¸¡•ÑM•ÍÍ¥½¹Y¥ÍÕ…±)½‰Ì¡•¹Ø±À¤ì(€€€…Í”€•ÑA…åµ•¹ÑÌœè€€€€€€€€É•ÑÕÉ¸¡•ÑA…åµ•¹ÑÌ¡•¹Ø±À¤ì(€€€…Í”€•Ñ¥¹…¹”œè€€€€€€€€€É•ÑÕÉ¸¡•Ñ¥¹…¹”¡•¹Ø±À¤ì(€€€…Í”€•Ñ%¹Ù½¥•1¥ÍÐœè€€€€€É•ÑÕÉ¸¡•Ñ%¹Ù½¥•1¥ÍÐ¡•¹Ø±À¤ì(€€€…Í”€•ÑM¥Ñ•½¹™¥œœè€€€€€€É•ÑÕÉ¸¡•ÑM¥Ñ•½¹™¥œ¡•¹Ø±À¤ì(€€€…Í”€•ÑÉ••µ•¹ÑQ•µÁ±…Ñ”œèÉ•ÑÕÉ¸¡•ÑÉ••µ•¹ÑQ•µÁ±…Ñ”¡•¹Ø±À¤ì(€€€…Í”€•ÑÉ••µ•¹ÑQ•µÁ±…Ñ•ÌœèÉ•ÑÕÉ¸¡•ÑÉ••µ•¹ÑQ•µÁ±…Ñ”¡•¹Ø±À¤ì(€€€…Í”€•Ñ½É•I•™Õ¹‘1¥ÍÐœè€É•ÑÕÉ¸¡•Ñ½É•I•™Õ¹‘1¥ÍÐ¡•¹Ø±À¤ì(€€€…Í”€ÁÉ•Ù¥•Ý½É•…¹•±M•ÍÍ¥½¸œèÉ•ÑÕÉ¸¡AÉ•Ù¥•Ý½É•…¹•±M•ÍÍ¥½¸¡•¹Ø±À¤ì(€€€‘•™…Õ±ÐèÉ•ÑÕÉ¸©Í½¹ÉÈ Õ¹­¹½Ý¸P…Ñ¥½¸è€œ­…Ñ¥½¸¤ì(€ô)ô()…Íå¹Œ™Õ¹Ñ¥½¸•¹™½É•M•ÍÍ¥½¹5½‘Õ±•½ÉÑ¥½¸¡•¹Ø±P±…Ñ¥½¸±ˆ¥ì(€½¹ÍÐµ…Àõì(€€€Í•±•ÑMÑ…±°èÍ•…ÑM•±•Ñ¥½¸œ±±…¥µA…¥‘M•…ÐèÍ•…ÑM•±•Ñ¥½¸œ±…‘µ¥¹M•…Ñ	½…ÉèÍ•…ÑM•±•Ñ¥½¸œ±…‘µ¥¹ÍÍ¥¹M•…ÐèÍ•…ÑM•±•Ñ¥½¸œ±ÉÕ¹	…Ñ¡ÍÍ¥¸èÍ•…ÑM•±•Ñ¥½¸œ±Í…Ù•M•…Ñ5…ÀèÍ•…ÑM•±•Ñ¥½¸œ±Í…Ù•M•…Ñ5…Á%µ…”èÍ•…ÑM•±•Ñ¥½¸œ°(€€€ÍÕ‰µ¥ÑA…åµ•¹ÐèÁ…åµ•¹Ðœ±ÍÕ‰µ¥ÑA…åµ•¹Ñ	…Ñ èÁ…åµ•¹Ðœ±É•…Ñ•1¥¹•A…å=É‘•ÈèÁ…åµ•¹Ðœ±É•…Ñ•Á…å=É‘•ÈèÁ…åµ•¹Ðœ±½¹™¥ÉµA…åµ•¹ÐèÁ…åµ•¹Ðœ±Í•¹‘A…åµ•¹ÑI•µ¥¹‘•ÈèÁ…åµ•¹Ðœ°(€€€¡•­¥¸è¡•­¥¸œ±½¹Í¥Ñ•5…É¬è¡•­¥¸œ±µ…É­±•…Èè¡•­¥¸œ±½¹Í¥Ñ•A…ÍÍ½‘••¹•É…Ñ”è¡•­¥¸œ±½¹Í¥Ñ•A…ÍÍ½‘•Q½±”è¡•­¥¸œ°(€€€ÕÁ‘…Ñ•%¹Ù½¥•MÑ…ÑÕÌè¥¹Ù½¥”œ(€ôì(€½¹ÍÐ­•äõµ…Ám…Ñ¥½¹tí¥˜ …­•ä¥É•ÑÕÉ¸¹Õ±°í±•ÐÍ¥õMÑÉ¥¹œ¡ˆ¹Í•ÍÍ¥½¹%‘ññˆ¹Í•ÍÍ¥½¹}¥‘ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …Í¥€˜˜ˆ¹É•%¥í½¹ÍÐÉÈõ…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•ÐõÍ•ÍÍ¥½¹}¥‘€¤¹…Ñ   ¤ôùmt¤íÍ¥õMÑÉ¥¹œ¡ÉÉlÁt˜™ÉÉlÁt¹Í•ÍÍ¥½¹}¥‘ñðœœ¥ô(€¥˜ …Í¥€˜˜lÍ…Ù•M•…Ñ5…Àœ°Í…Ù•M•…Ñ5…Á%µ…”œ°Ñ½±•M•ÍÍ¥½¸t¹¥¹±Õ‘•Ì¡…Ñ¥½¸¤¥Í¥õMÑÉ¥¹œ¡ˆ¹¥‘ñðœœ¤¹ÑÉ¥´ ¤ì(€¥˜ …Í¥¥É•ÑÕÉ¸¹Õ±°í½¹ÍÐÍÈõ…Ý…¥Ð‘‰•Ð¡•¹Ø°Í•ÍÍ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Í¥¥ô™Í•±•Ðõ¥±µ½‘Õ±•Í}©Í½¹€¤¹…Ñ   ¤ôùmt¤í¥˜ …ÍÈ¹±•¹Ñ ¥É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Óš²„œ¤í½¹ÍÐµ½‘Ìõ¹½Éµ…±¥é•M•ÍÍ¥½¹5½‘Õ±•Ì¡Í…™•)Í½¸¡ÍÉlÁt¹µ½‘Õ±•Í}©Í½¸±íô¤¤í¥˜ …µ½‘Ím­•åt¥É•ÑÕÉ¸©Í½¹ÉÈ¡ƒš¶“–‚Óš²‡šr«–VžR£Ž0‘í­•å÷Ž7–*¢÷š¢‡žÖ€¤íÉ•ÑÕÉ¸¹Õ±°ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸É½ÕÑ•A½ÍÐ¡•¹Ø°…Ñ¥½¸°ˆ°Ñà°É•Ä¤ì(€€¼¼ƒ–æÏ–>Ã–Æ“–.W’ös’â7žÚQ•¹…¹ÓŽ(€¥˜¡…Ñ¥½¸ôôôÑÉ…­A±…Ñ™½ÉµÑÑÉ¥‰ÕÑ¥½¸œ¥É•ÑÕÉ¸¡QÉ…­A±…Ñ™½ÉµÑÑÉ¥‰ÕÑ¥½¸¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÉ•…Ñ•%‘•¹Ñ¥Ñå1¥¹¬œ¥É•ÑÕÉ¸¡É•…Ñ•%‘•¹Ñ¥Ñå1¥¹¬¡•¹Ø±ˆ±É•Ä¤ì(€¥˜¡…Ñ¥½¸ôôô…•ÁÑMÑ…™™%¹Ù¥Ñ”œ¥É•ÑÕÉ¸¡•ÁÑMÑ…™™%¹Ù¥Ñ”¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÍ…Ù•5•µ‰•É	É…¹œ¥É•ÑÕÉ¸¡M…Ù•5•µ‰•É	É…¹¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÉ•Í½±Ù•	É…¹‘•ÍÍI•ÅÕ•ÍÐœ¥É•ÑÕÉ¸¡I•Í½±Ù•	É…¹‘•ÍÍI•ÅÕ•ÍÐ¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÉ•…Ñ•I•¥ÍÑÉ…Ñ¥½¹5•µ‰•É%¹Ù¥Ñ”œ¥É•ÑÕÉ¸¡É•…Ñ•I•¥ÍÑÉ…Ñ¥½¹5•µ‰•É%¹Ù¥Ñ”¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôô…•ÁÑI•¥ÍÑÉ…Ñ¥½¹5•µ‰•É%¹Ù¥Ñ”œ¥É•ÑÕÉ¸¡•ÁÑI•¥ÍÑÉ…Ñ¥½¹5•µ‰•É%¹Ù¥Ñ”¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôµ•µ‰•É=¹Í¥Ñ•Ñ¥½¸œ¥É•ÑÕÉ¸¡5•µ‰•É=¹Í¥Ñ•Ñ¥½¸¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÉ•…Ñ•A±…Ñ™½Éµ•ÍÍ%¹Ù¥Ñ”œ¥É•ÑÕÉ¸¡É•…Ñ•A±…Ñ™½Éµ•ÍÍ%¹Ù¥Ñ”¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÍ•ÑA±…Ñ™½Éµ•ÍÍÑ¥Ù”œ¥É•ÑÕÉ¸¡M•ÑA±…Ñ™½Éµ•ÍÍÑ¥Ù”¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÍ…Ù•A±…Ñ™½Éµ5•µ‰•ÉAÉ½™¥±”œ¥É•ÑÕÉ¸¡M…Ù•A±…Ñ™½Éµ5•µ‰•ÉAÉ½™¥±”¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÉ•…Ñ•=É…¹¥é•ÉÁÁ±¥…Ñ¥½¹É…™Ðœ¥É•ÑÕÉ¸¡É•…Ñ•=É…¹¥é•ÉÁÁ±¥…Ñ¥½¹É…™Ð¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôô…ÁÁÉ½Ù•ÁÁ±äœ¥É•ÑÕÉ¸¡ÁÁÉ½Ù•ÁÁ±ä¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÉ•ÅÕ•ÍÑÁÁ±åMÕÁÁ±•µ•¹Ðœ¥É•ÑÕÉ¸¡I•ÅÕ•ÍÑÁÁ±åMÕÁÁ±•µ•¹Ð¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÉ•©•ÑÁÁ±äœ¥É•ÑÕÉ¸¡I•©•ÑÁÁ±ä¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôô…ÁÁ±åQÉ¥…°œ¥É•ÑÕÉ¸¡ÁÁ±åQÉ¥…°¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÍ•¹‘A±…Ñ™½ÉµMÕÁÁ½ÉÑ5•ÍÍ…”œ¥É•ÑÕÉ¸¡M•¹‘A±…Ñ™½ÉµMÕÁÁ½ÉÑ5•ÍÍ…”¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôµ…É­A±…Ñ™½ÉµMÕÁÁ½ÉÑI•…œ¥É•ÑÕÉ¸¡5…É­A±…Ñ™½ÉµMÕÁÁ½ÉÑI•…¡•¹Ø±ˆ¤ì(€¥˜¡…Ñ¥½¸ôôôÍ…Ù•A±…Ñ™½ÉµQ•¹…¹Ñ5½‘Õ±•Ìœ¥É•ÑÕÉ¸¡M…Ù•A±…Ñ™½ÉµQ•¹…¹Ñ5½‘Õ±•Ì¡•¹Ø±ˆ¤ì(€€€€€¥˜¡…Ñ¥½¸ôôôÉ•½É‘A±…Ñ™½ÉµM•ÉÙ¥•M…±”œ¥É•ÑÕÉ¸¡I•½É‘A±…Ñ™½ÉµM•ÉÙ¥•M…±”¡•¹Ø±ˆ¤ì(€€¼¼=%9¾òk–¾¯–—šN7’ösžjžžš"ÛžRÄ)]P€¼ƒ–‚Óš²„€¼ƒ–‚Ç–B7¦^s¢¿¢žšzC¾òoš¶–ò<¡…¹‘±•Èƒ’î7šr–kš²+¦fC¢"Ñ•¹…¹Ðƒ¦¦_¢¶'Ž(€½¹ÍÐQ99P€ô…Ý…¥ÐÉ•Í½±Ù•Q•¹…¹Ñ½ÉI•ÅÕ•ÍÐ¡•¹Ø°ˆ°É•Ä¤ì(€¥˜€ …Q99P¤ì(€€€É•ÑÕÉ¸¹•ÜI•ÍÁ½¹Í”¡)M=8¹ÍÑÉ¥¹¥™ä¡í½¬é™…±Í”°•ÉÉ½ÈèŸž‡šÎW¢ú£¢¶c’âï¢ú›ž¦ë¦ZLô¤°íÍÑ…ÑÕÌèÐÀÀ°¡•…‘•ÉÌé½ÉÍ!•…‘•ÉÌ ¥ô¤ì(€ô(€ˆ¹Ñ•¹…¹Ð€ôQ99Pì(€ˆ¹}Ñ•¹…¹Ñ%€ôQ99Pì€€¼¼ƒšÎ£–—’úl¡…¹‘±•Èƒ’öÿžR (€€¼¼ƒšÎ£–—’úšê@%@ƒ¢"UÍ•Èµ•¹Ó¾ò#’úo’â7–>¿š*_–*o–B3š?¢¶'šNk–¾¯–—¾ò$(€¥˜€¡É•Ä¤ì(€€€ˆ¹}¥À€ôÉ•Ä¹¡•…‘•ÉÌ¹•Ð µ½¹¹•Ñ¥¹œµ%@œ¤ñðÉ•Ä¹¡•…‘•ÉÌ¹•Ð `µ½ÉÝ…É‘•µ½Èœ¤ñðÉ•Ä¹¡•…‘•ÉÌ¹•Ð `µI•…°µ%@œ¤ñð¹Õ±°ì(€€€ˆ¹}ÕÍ•É•¹Ð€ôÉ•Ä¹¡•…‘•ÉÌ¹•Ð UÍ•Èµ•¹Ðœ¤ñð¹Õ±°ì(€ô(€½¹ÍÐ™•…ÑÕÉ••¹¥•€ô…Ý…¥Ð•¹™½É•Q•¹…¹Ñ•…ÑÕÉ”¡•¹Ø°Q99P°…Ñ¥½¸¤ì(€¥˜€¡™•…ÑÕÉ••¹¥•¤É•ÑÕÉ¸™•…ÑÕÉ••¹¥•ì(€½¹ÍÐÉ½±••¹¥•€ô…Ý…¥Ð•¹™½É•Q•¹…¹ÑI½±”¡•¹Ø°Q99P°…Ñ¥½¸°ˆ¤ì(€¥˜€¡É½±••¹¥•¤É•ÑÕÉ¸É½±••¹¥•ì(€½¹ÍÐÍ•ÍÍ¥½¹5½‘Õ±••¹¥•õ…Ý…¥Ð•¹™½É•M•ÍÍ¥½¹5½‘Õ±•½ÉÑ¥½¸¡•¹Ø±Q99P±…Ñ¥½¸±ˆ¤ì(€¥˜¡Í•ÍÍ¥½¹5½‘Õ±••¹¥•¥É•ÑÕÉ¸Í•ÍÍ¥½¹5½‘Õ±••¹¥•ì((€¥˜€¡…Ñ¥½¸ôôôÉ•Í•¹‘I•½¹™¥É´œ¤ì(€€€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸±Q99P°É•Ù¥•Üœ¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€€€½¹ÍÐÉ½ÝÌ€ô…Ý…¥Ð‘‰•Ð¡•¹Ø°É•¥ÍÑÉ…Ñ¥½¹Ìœ±Ñ•¹…¹Ñ}¥õ•Ä¸‘íQ99Qô™¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡ˆ¹É•%¥ô™Í•±•Ðô©€¤ì(€€€¥˜ …É½ÝÌ¹±•¹Ñ ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿš&û’â7–"Ã–‚Ç–B7¢ÎšZdœ¤ì(€€€½¹ÍÐÉ•œõÉ½ÝÍlÁtì(€€€½¹ÍÐÍ•Í9…µ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹9…µ”¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€€€½¹ÍÐÍ•ÍQåÁ”€ô…Ý…¥Ð•ÑM•ÍÍ¥½¹QåÁ”¡•¹Ø°É•œ¹Í•ÍÍ¥½¹}¥°Q99P¤ì(€€€½¹ÍÐ‘¸€ô•Ñ¥ÍÁ±…å9…µ”¡É•œ¹¹…µ”°É•œ¹‰É…¹‘}¹…µ•ñðœœ°Í•ÍQåÁ”¤ì(€€€½¹ÍÐÑ½Ñ…°€ô9Õµ‰•È¡É•œ¹…µ½Õ¹Ð¥ñðÀì(€€€½¹ÍÐÍÑ…±±½Õ¹Ð€ô9Õµ‰•È¡É•œ¹ÍÑ…±±}½Õ¹Ð¥ñðÄì(€€€½¹ÍÐÍ•±•Ñ•‘…Ñ•Ì€ôÍ…™•)Í½¸¡É•œ¹Í•±•Ñ•‘}‘…Ñ•Í}©Í½¸±mt¤ì(€€€½¹ÍÐ•ÅÕ¥À€ôÍ…™•)Í½¸¡É•œ¹•ÅÕ¥Áµ•¹Ñ}©Í½¸±íô¤ì(€€€½¹ÍÐÑI•Í•¹€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€€€ÑÉäì…Ý…¥Ðµ…¥±I•½¹™¥É´¡•¹Ø±É•œ¹•µ…¥°±‘¸±Í•Í9…µ”±É•œ¹¥±Ñ½Ñ…°±ÍÑ…±±½Õ¹Ð±Í•±•Ñ•‘…Ñ•Ì±•ÅÕ¥À±ÑI•Í•¹¤ìô(€€€…Ñ ¡”¥ìÉ•ÑÕÉ¸©Í½¹ÉÈ Ÿ–¾’þ‡–’ÇšV_¾òhœ­”¹µ•ÍÍ…”¤ìô(€€€É•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ•ô¤ì(€ô(€¥˜€¡…Ñ¥½¸ôôôÑ•ÍÑµ…¥°œ¤ì(€€€¥˜€ ……Ý…¥ÐÙ•É¥™åMÑ…™˜¡•¹Ø±ˆ¹•µ…¥°±ˆ¹Ñ½­•¸°Q99P¤¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿž‡š²+¦f@œ¤ì(€€€½¹ÍÐÑ¼€ôˆ¹Ñ¼ì(€€€¥˜ …Ñ¼¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿžòë–ÂGšRÛ’îÛ–rÃ–v œ¤ì(€€€½¹ÍÐÑQ•ÍÐ€ô…Ý…¥Ð•ÑQ•¹…¹ÑÑà¡•¹Ø°Q99P¤ì(€€€½¹ÍÐÉ•ÍÕ±Ð€ô…Ý…¥ÐÍ•¹‘µ…¥°¡•¹Ø°Ñ¼°ƒŽ@‘íÑQ•ÍÐ¹¹…µ•÷ŽG’þ‡’îÛžÎïžÖÇšâ³¢¦™€°•µ…¥±]É…À¡€(ñÀûŠrƒ¦gšb¿’â–Âšâ³¢¦›’þ‡’îÛŽð½Àø(ñÀû–ššzsš
£šRÛ–"Ã¦g–Â’þ‡¾ò3’î¢† €ñÍÑÉ½¹œø‘íÑQ•ÍÐ¹¹…µ•ôð½ÍÑÉ½¹œøƒžj’þ‡’îÛžÎïžÖÇ¢¢·–ºkš¶žŠë¾òð½Àø(ñÀÍÑå±”ô‰½±½ÈèŒàààí™½¹ÐµÍ¥é”èÄÉÁàˆûšâ³¢¦›šf¦ZO¾òh‘í¹½Ý%Í¼ ¥ôð½Àø)€°ÑQ•ÍÐ¤°ÑQ•ÍÐ¤ì(€€€¥˜¡É•ÍÕ±Ð¹½¬¤É•ÑÕÉ¸©Í½¹=¬¡í½¬éÑÉÕ•ô¤ì(€€€É•ÑÕÉ¸©Í½¹ÉÈ Ÿ–¾’þ‡–’ÇšV_¾òhœ¬¡É•ÍÕ±Ð¹•ÉÉ½ÉñðŸšr«ž~—¦2¿¢ªœ¤¤ì(€ô(€ÍÝ¥Ñ ¡…Ñ¥½¸¤ì(€€€…Í”€É•¥ÍÑ•Èœè€€€€€€€€€€€É•ÑÕÉ¸¡I•¥ÍÑ•È¡•¹Ø±ˆ±Ñà¤ì(€€€…Í”€É•¥ÍÑ•É	Õ¹‘±”œè€€€€€É•ÑÕÉ¸¡I•¥ÍÑ•É	Õ¹‘±”¡•¹Ø±ˆ±Ñà¤ì(€€€…Í”€Í…Ù•	Õ¹‘±”œè€€€€€€€€€É•ÑÕÉ¸¡M…Ù•	Õ¹‘±”¡•¹Ø±ˆ¤ì(€€€…Í”€É•…Ñ•M¡½ÉÑ1¥¹¬œè€€€€É•ÑÕÉ¸¡É•…Ñ•M¡½ÉÑ1¥¹¬¡•¹Ø±ˆ¤ì(€€€…Í”€ÁÕÉ•ÉÉ½É1½Ìœè€€€€€É•ÑÕÉ¸¡AÕÉ•ÉÉ½É1½Ì¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•	Õ¹‘±”œè€€€€€€€É•ÑÕÉ¸¡•±•Ñ•	Õ¹‘±”¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•5•µ‰•Èœè€€€€€€€€€É•ÑÕÉ¸¡M…Ù•5•µ‰•È¡•¹Ø±ˆ¤ì(€€€…Í”€…¹•±I•œœè€€€€€€€€€€É•ÑÕÉ¸¡…¹•±I•œ¡•¹Ø±ˆ¤ì(€€€…Í”€É•Í¡•‘Õ±•	½½­¥¹œœè€€É•ÑÕÉ¸¡I•Í¡•‘Õ±•	½½­¥¹œ¡•¹Ø±ˆ¤ì(€€€…Í”€Í•±•ÑMÑ…±°œè€€€€€€€€É•ÑÕÉ¸¡M•±•ÑMÑ…±°¡•¹Ø±ˆ¤ì(€€€…Í”€±…¥µA…¥‘M•…Ðœè€€€€€€É•ÑÕÉ¸¡±…¥µA…¥‘M•…Ð¡•¹Ø±ˆ¤ì(€€€…Í”€…‘µ¥¹M•…Ñ	½…Éœè€€€€€É•ÑÕÉ¸¡‘µ¥¹M•…Ñ	½…É¡•¹Ø±ˆ¤ì(€€€…Í”€…‘µ¥¹ÍÍ¥¹M•…Ðœè€€€€É•ÑÕÉ¸¡‘µ¥¹ÍÍ¥¹M•…Ð¡•¹Ø±ˆ¤ì(€€€…Í”€…‘µ¥¹UÁ‘…Ñ•M•…ÑA½Í¥Ñ¥½¹ÌœèÉ•ÑÕÉ¸¡‘µ¥¹UÁ‘…Ñ•M•…ÑA½Í¥Ñ¥½¹Ì¡•¹Ø±ˆ¤ì(€€€…Í”€…‘µ¥¹U¹…ÍÍ¥¹M•…Ðœè€€É•ÑÕÉ¸¡‘µ¥¹U¹…ÍÍ¥¹M•…Ð¡•¹Ø±ˆ¤ì(€€€…Í”€ÉÕ¹	…Ñ¡ÍÍ¥¸œè€€€€€É•ÑÕÉ¸¡IÕ¹	…Ñ¡ÍÍ¥¸¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•M•…Ñ5…Àœè€€€€€€€€É•ÑÕÉ¸¡M…Ù•M•…Ñ5…À¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•M•…Ñ5…Á%µ…”œè€€€É•ÑÕÉ¸¡M…Ù•M•…Ñ5…Á%µ…”¡•¹Ø±ˆ¤ì(€€€…Í”€ÍÕ‰µ¥ÑA…åµ•¹Ðœè€€€€€€É•ÑÕÉ¸¡MÕ‰µ¥ÑA…åµ•¹Ð¡•¹Ø±ˆ¤ì(€€€…Í”€ÍÕ‰µ¥ÑA…åµ•¹Ñ	…Ñ œè€É•ÑÕÉ¸¡MÕ‰µ¥ÑA…åµ•¹Ñ	…Ñ ¡•¹Ø±ˆ¤ì(€€€…Í”€Õ¹‘½A…åµ•¹ÑI•Á½ÉÐœè€€É•ÑÕÉ¸¡U¹‘½A…åµ•¹ÑI•Á½ÉÐ¡•¹Ø±ˆ¤ì(€€€…Í”€É•…Ñ•1¥¹•A…å=É‘•Èœè€É•ÑÕÉ¸¡É•…Ñ•1¥¹•A…å=É‘•È¡•¹Ø±ˆ¤ì(€€€…Í”€É•…Ñ•Á…å=É‘•Èœè€€€É•ÑÕÉ¸¡É•…Ñ•Á…å=É‘•È¡•¹Ø±ˆ¤ì(€€€…Í”€É•…Ñ•Ù•¹Ðœè€€€€€€€€É•ÑÕÉ¸¡É•…Ñ•Ù•¹Ð¡•¹Ø±ˆ¤ì(€€€…Í”€ÕÁ‘…Ñ•Ù•¹Ðœè€€€€€€€€É•ÑÕÉ¸¡UÁ‘…Ñ•Ù•¹Ð¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•Ù•¹Ðœè€€€€€€€€É•ÑÕÉ¸¡•±•Ñ•Ù•¹Ð¡•¹Ø±ˆ¤ì(€€€…Í”€É•…Ñ•M•ÍÍ¥½¸œè€€€€€€É•ÑÕÉ¸¡É•…Ñ•M•ÍÍ¥½¸¡•¹Ø±ˆ¤ì(€€€…Í”€ÕÁ‘…Ñ•M•ÍÍ¥½¸œè€€€€€€É•ÑÕÉ¸¡UÁ‘…Ñ•M•ÍÍ¥½¸¡•¹Ø±ˆ¤ì(€€€…Í”€…ÕÑ½QÉ…¹Í±…Ñ•M•ÍÍ¥½¸œèÉ•ÑÕÉ¸¡ÕÑ½QÉ…¹Í±…Ñ•M•ÍÍ¥½¸¡•¹Ø±ˆ¤ì(€€€…Í”€ÕÁ±½…‘½Ù•ÈœèÉ•ÑÕÉ¸¡UÁ±½…‘½Ù•È¡•¹Ø°ˆ¤ì(€€€…Í”€•¹•É…Ñ•M•ÍÍ¥½¹Y¥ÍÕ…°œèÉ•ÑÕÉ¸¡•¹•É…Ñ•M•ÍÍ¥½¹Y¥ÍÕ…°¡•¹Ø±ˆ¤ì(€€€…Í”€Í•ÑM•ÍÍ¥½¹5…¥¹Y¥ÍÕ…°œèÉ•ÑÕÉ¸¡M•ÑM•ÍÍ¥½¹5…¥¹Y¥ÍÕ…°¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•M•ÍÍ¥½¹Y¥ÍÕ…±ÍÍ•ÐœèÉ•ÑÕÉ¸¡•±•Ñ•M•ÍÍ¥½¹Y¥ÍÕ…±ÍÍ•Ð¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•M•ÍÍ¥½¸œè€€€€€€É•ÑÕÉ¸¡•±•Ñ•M•ÍÍ¥½¸¡•¹Ø±ˆ¤ì(€€€…Í”€Ñ½±•M•ÍÍ¥½¸œè€€€€€€É•ÑÕÉ¸¡Q½±•M•ÍÍ¥½¸¡•¹Ø±ˆ¤ì(€€€…Í”€Ñ½±•M•ÍÍ¥½¹MÑ…ÑÕÌœèÉ•ÑÕÉ¸¡Q½±•M•ÍÍ¥½¹MÑ…ÑÕÌ¡•¹Ø±ˆ¤ì(€€€…Í”€½ÁåM•ÍÍ¥½¸œè€€€€€€€€É•ÑÕÉ¸¡½ÁåM•ÍÍ¥½¸¡•¹Ø±ˆ¤ì(€€€…Í”€ÕÁ‘…Ñ•I•MÑ…ÑÕÌœè€€€€É•ÑÕÉ¸¡UÁ‘…Ñ•I•MÑ…ÑÕÌ¡•¹Ø±ˆ¤ì(€€€…Í”€‰…Ñ¡UÁ‘…Ñ•MÑ…ÑÕÌœè€€É•ÑÕÉ¸¡	…Ñ¡UÁ‘…Ñ•MÑ…ÑÕÌ¡•¹Ø±ˆ¤ì(€€€…Í”€…ÁÁÉ½Ù•I•œœè€€€€€€€€€É•ÑÕÉ¸¡ÁÁÉ½Ù•I•œ¡•¹Ø±ˆ¤ì(€€€…Í”€½¹™¥ÉµA…åµ•¹Ðœè€€€€€É•ÑÕÉ¸¡½¹™¥ÉµA…åµ•¹Ð¡•¹Ø±ˆ¤ì(€€€…Í”€µ…É­A…åµ•¹ÑMÉ••¹Í¡½ÐœèÉ•ÑÕÉ¸¡5…É­A…åµ•¹ÑMÉ••¹Í¡½Ð¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•I•9½Ñ”œèÉ•ÑÕÉ¸¡M…Ù•I•9½Ñ”¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•5•µ‰•É9½Ñ”œèÉ•ÑÕÉ¸¡M…Ù•5•µ‰•É9½Ñ”¡•¹Ø±ˆ¤ì(€€€…Í”€Í•¹‘A…åµ•¹ÑI•µ¥¹‘•ÈœèÉ•ÑÕÉ¸¡M•¹‘A…åµ•¹ÑI•µ¥¹‘•È¡•¹Ø±ˆ¤ì(€€€…Í”€…‘µ¥¹…¹•±I•œœè€€€€€É•ÑÕÉ¸¡‘µ¥¹…¹•±I•œ¡•¹Ø±ˆ¤ì(€€€…Í”€É•™Õ¹‘•Á½Í¥Ðœè€€€€€€É•ÑÕÉ¸¡I•™Õ¹‘•Á½Í¥Ð¡•¹Ø±ˆ¤ì(€€€…Í”€¡•­¥¸œè€€€€€€€€€€€€É•ÑÕÉ¸¡¡•­¥¸¡•¹Ø±ˆ¤ì(€€€…Í”€½¹Í¥Ñ•5…É¬œè€€€€€€€€€É•ÑÕÉ¸¡=¹Í¥Ñ•5…É¬¡•¹Ø±ˆ¤ì(€€€…Í”€½¹Í¥Ñ•A…ÍÍ½‘•Y•É¥™äœè€€É•ÑÕÉ¸¡=¹Í¥Ñ•A…ÍÍ½‘•Y•É¥™ä¡•¹Ø±ˆ¤ì(€€€…Í”€½¹Í¥Ñ•A…ÍÍ½‘••¹•É…Ñ”œèÉ•ÑÕÉ¸¡=¹Í¥Ñ•A…ÍÍ½‘••¹•É…Ñ”¡•¹Ø±ˆ¤ì(€€€…Í”€½¹Í¥Ñ•A…ÍÍ½‘•Q½±”œè€€É•ÑÕÉ¸¡=¹Í¥Ñ•A…ÍÍ½‘•Q½±”¡•¹Ø±ˆ¤ì(€€€…Í”€½¹Í¥Ñ•M¡¥™ÑMÑ…ÉÐœèÉ•ÑÕÉ¸¡=¹Í¥Ñ•M¡¥™ÑMÑ…ÉÐ¡•¹Ø±ˆ¤ì(€€€…Í”€½¹Í¥Ñ•M¡¥™Ñ¹œèÉ•ÑÕÉ¸¡=¹Í¥Ñ•M¡¥™Ñ¹¡•¹Ø±ˆ¤ì(€€€…Í”€µ…É­±•…Èœè€€€€€€€€€€É•ÑÕÉ¸¡5…É­±•…È¡•¹Ø±ˆ¤ì(€€€…Í”€Í•¹‘9½Ñ¥™äœè€€€€€€€€€É•ÑÕÉ¸¡M•¹‘9½Ñ¥™ä¡•¹Ø±ˆ¤ì(€€€…Í”€É•Í•¹‘%¹Ù¥Ñ”œè€€€€€€€É•ÑÕÉ¸¡I•Í•¹‘%¹Ù¥Ñ”¡•¹Ø±ˆ¤ì(€€€…Í”€…‘‘MÑ…™˜œè€€€€€€€€€€€É•ÑÕÉ¸¡‘‘MÑ…™˜¡•¹Ø±ˆ¤ì(€€€…Í”€É•µ½Ù•MÑ…™˜œè€€€€€€€€É•ÑÕÉ¸¡I•µ½Ù•MÑ…™˜¡•¹Ø±ˆ¤ì(€€€…Í”€Í•ÑMÑ…™™Ñ¥Ù”œè€€€€€É•ÑÕÉ¸¡M•ÑMÑ…™™Ñ¥Ù”¡•¹Ø±ˆ¤ì(€€€…Í”€ÕÁ‘…Ñ•MÑ…™™A•ÉµÌœè€€€É•ÑÕÉ¸¡UÁ‘…Ñ•MÑ…™™A•ÉµÌ¡•¹Ø±ˆ¤ì(€€€…Í”€ÕÁ‘…Ñ•MÑ…™™M•ÍÍ¥½¹ÌœèÉ•ÑÕÉ¸¡UÁ‘…Ñ•MÑ…™™M•ÍÍ¥½¹Ì¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•¹¹½Õ¹•µ•¹Ðœè€€€É•ÑÕÉ¸¡M…Ù•¹¹½Õ¹•µ•¹Ð¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•¹¹½Õ¹•µ•¹Ðœè€É•ÑÕÉ¸¡•±•Ñ•¹¹½Õ¹•µ•¹Ð¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•¥¹…¹•%Ñ•´œè€€€€É•ÑÕÉ¸¡M…Ù•¥¹…¹•%Ñ•´¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•M•ÍÍ¥½¹…Í¡%Ñ•´œèÉ•ÑÕÉ¸¡M…Ù•M•ÍÍ¥½¹…Í¡%Ñ•´¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•M•ÍÍ¥½¹…Í¡%Ñ•´œèÉ•ÑÕÉ¸¡•±•Ñ•M•ÍÍ¥½¹…Í¡%Ñ•´¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•¥¹…¹•%Ñ•´œè€€É•ÑÕÉ¸¡•±•Ñ•¥¹…¹•%Ñ•´¡•¹Ø±ˆ¤ì(€€€…Í”€ÕÁ‘…Ñ•%¹Ù½¥•MÑ…ÑÕÌœèÉ•ÑÕÉ¸¡UÁ‘…Ñ•%¹Ù½¥•MÑ…ÑÕÌ¡•¹Ø±ˆ¤ì(€€€…Í”€¡•­5•µ‰•Éµ…¥±A¡½¹”œèÉ•ÑÕÉ¸¡¡•­5•µ‰•Éµ…¥±A¡½¹”¡•¹Ø±ˆ¤ì(€€€…Í”€±¥ÍÑÑ¥Ù•A¡½Ñ½Ñ¥Ù¥Ñ¥•ÌœèÉ•ÑÕÉ¸¡1¥ÍÑÑ¥Ù•A¡½Ñ½Ñ¥Ù¥Ñ¥•Ì¡•¹Ø±ˆ¤ì(€€€…Í”€•ÑA¡½Ñ½Ñ¥Ù¥Ñå	åM±ÕœœèÉ•ÑÕÉ¸¡•ÑA¡½Ñ½Ñ¥Ù¥Ñå	åM±Õœ¡•¹Ø±ˆ¤ì(€€€…Í”€ÍÕ‰µ¥ÑA¡½Ñ½1•…œèÉ•ÑÕÉ¸¡MÕ‰µ¥ÑA¡½Ñ½1•…¡•¹Ø±ˆ¤ì(€€€…Í”€±¥ÍÑA¡½Ñ½Ñ¥Ù¥Ñ¥•ÌœèÉ•ÑÕÉ¸¡1¥ÍÑA¡½Ñ½Ñ¥Ù¥Ñ¥•Ì¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•A¡½Ñ½Ñ¥Ù¥ÑäœèÉ•ÑÕÉ¸¡M…Ù•A¡½Ñ½Ñ¥Ù¥Ñä¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•A¡½Ñ½Ñ¥Ù¥ÑåÉ…µ”œèÉ•ÑÕÉ¸¡M…Ù•A¡½Ñ½Ñ¥Ù¥ÑåÉ…µ”¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•A¡½Ñ½Ñ¥Ù¥ÑåÉ…µ”œèÉ•ÑÕÉ¸¡•±•Ñ•A¡½Ñ½Ñ¥Ù¥ÑåÉ…µ”¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•A¡½Ñ½Ñ¥Ù¥ÑäœèÉ•ÑÕÉ¸¡•±•Ñ•A¡½Ñ½Ñ¥Ù¥Ñä¡•¹Ø±ˆ¤ì(€€€…Í”€±¥ÍÑA¡½Ñ½1•…‘Ìœè€€€€€É•ÑÕÉ¸¡1¥ÍÑA¡½Ñ½1•…‘Ì¡•¹Ø±ˆ¤ì(€€€…Í”€±¥ÍÑ½¹Ñ…Ñ1•…‘Ìœè€€€É•ÑÕÉ¸¡1¥ÍÑ½¹Ñ…Ñ1•…‘Ì¡•¹Ø±ˆ¤ì(€€€…Í”€±¥ÍÑY•¹Õ•5…ÁÌœè€€€€€€É•ÑÕÉ¸¡1¥ÍÑY•¹Õ•5…ÁÌ¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•Y•¹Õ•5…Àœè€€€€€€€É•ÑÕÉ¸¡M…Ù•Y•¹Õ•5…À¡•¹Ø±ˆ¤ì(€€€…Í”€…ÁÁ±åY•¹Õ•5…Àœè€€€€€€É•ÑÕÉ¸¡ÁÁ±åY•¹Õ•5…À¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•Y•¹Õ•5…Àœè€€€€€É•ÑÕÉ¸¡•±•Ñ•Y•¹Õ•5…À¡•¹Ø±ˆ¤ì(€€€…Í”€Í•Ñ…ÍÑA…ÍÌœè€€€€€€€€É•ÑÕÉ¸¡M•Ñ…ÍÑA…ÍÌ¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•M¥Ñ•½¹™¥œœè€€€€€É•ÑÕÉ¸¡M…Ù•M¥Ñ•½¹™¥œ¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•Q•¹…¹Ñ5½‘Õ±•AÉ½™¥±”œèÉ•ÑÕÉ¸¡M…Ù•Q•¹…¹Ñ5½‘Õ±•AÉ½™¥±”¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•Q•¹…¹ÑQ¡•µ”œèÉ•ÑÕÉ¸¡M…Ù•Q•¹…¹ÑQ¡•µ”¡•¹Ø±ˆ¤ì(€€€…Í”€É•…Ñ•MÕÁÁ½ÉÑQ¡É•…œèÉ•ÑÕÉ¸¡É•…Ñ•MÕÁÁ½ÉÑQ¡É•…¡•¹Ø±ˆ¤ì(€€€…Í”€Í•¹‘MÕÁÁ½ÉÑ5•ÍÍ…”œèÉ•ÑÕÉ¸¡M•¹‘MÕÁÁ½ÉÑ5•ÍÍ…”¡•¹Ø±ˆ¤ì(€€€…Í”€µ…É­MÕÁÁ½ÉÑI•…œèÉ•ÑÕÉ¸¡5…É­MÕÁÁ½ÉÑI•…¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•=Á•É…Ñ¥½¹U¹¥ÐœèÉ•ÑÕÉ¸¡M…Ù•=Á•É…Ñ¥½¹U¹¥Ð¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•	½½­¥¹…±•¹‘…ÈœèÉ•ÑÕÉ¸¡M…Ù•	½½­¥¹…±•¹‘…È¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•=Á•É…Ñ¥½¹U¹¥ÐœèÉ•ÑÕÉ¸¡•±•Ñ•=Á•É…Ñ¥½¹U¹¥Ð¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•AÉ½µ½Ñ¥½¹IÕ±”œèÉ•ÑÕÉ¸¡M…Ù•AÉ½µ½Ñ¥½¹IÕ±”¡•¹Ø±ˆ¤ì(€€€…Í”€‘•±•Ñ•AÉ½µ½Ñ¥½¹IÕ±”œèÉ•ÑÕÉ¸¡•±•Ñ•AÉ½µ½Ñ¥½¹IÕ±”¡•¹Ø±ˆ¤ì(€€€…Í”€É•…Ñ•áÁ½ÍÕÉ•=É‘•ÈœèÉ•ÑÕÉ¸¡É•…Ñ•áÁ½ÍÕÉ•=É‘•È¡•¹Ø±ˆ¤ì(€€€…Í”€…¹•±áÁ½ÍÕÉ•=É‘•ÈœèÉ•ÑÕÉ¸¡…¹•±áÁ½ÍÕÉ•=É‘•È¡•¹Ø±ˆ¤ì(€€€…Í”€É…¹ÑA…ÉÑ¹•ÉÉ•‘¥ÐœèÉ•ÑÕÉ¸É…¹ÑA…ÉÑ¹•ÉÉ•‘¥Ð¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•MÑ…ÉÑÕÁÉ•‘¥ÑA½±¥äœèÉ•ÑÕÉ¸¡M…Ù•MÑ…ÉÑÕÁÉ•‘¥ÑA½±¥ä¡•¹Ø±ˆ¤ì(€€€…Í”€½¹™¥Éµ=Á•É…Ñ¥¹A…åµ•¹ÐœèÉ•ÑÕÉ¸¡½¹™¥Éµ=Á•É…Ñ¥¹A…åµ•¹Ð¡•¹Ø±ˆ¤ì(€€€…Í”€É•Á½ÉÑ=Á•É…Ñ¥¹A…åµ•¹ÐœèÉ•ÑÕÉ¸¡I•Á½ÉÑ=Á•É…Ñ¥¹A…åµ•¹Ð¡•¹Ø±ˆ¤ì(€€€…Í”€ÕÁ‘…Ñ•I•¥ÍÑÉ…Ñ¥½¹Ñ¥½¸œè€€€€€€É•ÑÕÉ¸¡UÁ‘…Ñ•I•¥ÍÑÉ…Ñ¥½¹Ñ¥½¸¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•A…åµ•¹ÑM•ÑÑ¥¹Ìœè€€€€€€É•ÑÕÉ¸¡M…Ù•A…åµ•¹ÑM•ÑÑ¥¹Ì¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•A…åµ•¹ÑAÉ½™¥±”œè€€€€€€É•ÑÕÉ¸¡M…Ù•A…åµ•¹ÑAÉ½™¥±”¡•¹Ø±ˆ¤ì(€€€…Í”€‘¥Í…‰±•A…åµ•¹ÑAÉ½™¥±”œè€€€É•ÑÕÉ¸¡¥Í…‰±•A…åµ•¹ÑAÉ½™¥±”¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•µ…¥±Q•µÁ±…Ñ”œè€€€€€€É•ÑÕÉ¸¡M…Ù•µ…¥±Q•µÁ±…Ñ”¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•½µÁ…¹åM•ÑÑ¥¹Ìœè€€€€€€É•ÑÕÉ¸¡M…Ù•½µÁ…¹åM•ÑÑ¥¹Ì¡•¹Ø±ˆ¤ì(€€€…Í”€ÕÁ‘…Ñ•MÑ…™™M½Á”œè€€€€€€É•ÑÕÉ¸¡UÁ‘…Ñ•MÑ…™™M½Á”¡•¹Ø±ˆ¤ì(€€€…Í”€Í•ÑMÑ…™™M½Á”œè€€€€€€É•ÑÕÉ¸¡UÁ‘…Ñ•MÑ…™™M½Á”¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•É••µ•¹ÑQ•µÁ±…Ñ”œèÉ•ÑÕÉ¸¡M…Ù•É••µ•¹ÑQ•µÁ±…Ñ”¡•¹Ø±ˆ¤ì(€€€…Í”€Í…Ù•É••µ•¹ÑQ•µÁ±…Ñ•ÌœèÉ•ÑÕÉ¸¡M…Ù•É••µ•¹ÑQ•µÁ±…Ñ”¡•¹Ø±ˆ¤ì(€€€…Í”€™½É•…¹•°œè€€€€€€€€É•ÑÕÉ¸¡½É•…¹•°¡•¹Ø±ˆ¤ì(€€€…Í”€…É••QÉ…¹Í™•Èœè€€€€€€É•ÑÕÉ¸¡É••QÉ…¹Í™•È¡•¹Ø±ˆ¤ì(€€€…Í”€…ÁÁ±åI•™Õ¹œè€€€€€€€€É•ÑÕÉ¸¡ÁÁ±åI•™Õ¹¡•¹Ø±ˆ¤ì(€€€…Í”€½¹™¥ÉµI•™Õ¹œè€€€€€€É•ÑÕÉ¸¡½¹™¥ÉµI•™Õ¹¡•¹Ø±ˆ¤ì(€€€€¼¼ƒŠRŠR ƒ’â7–>¿š*_–*oš¢‡žÖ¾ò#ž6£ž®,…Ñ¥½»¾ò3’â7¢š¢N/–:šr'¦
?¢ò¿¾ò'ŠRŠR (€€€…Í”€™½É•…¹•±M•ÍÍ¥½¸œè€€É•ÑÕÉ¸¡½É•…¹•±M•ÍÍ¥½¸¡•¹Ø±ˆ¤ì(€€€…Í”€…É••½É•QÉ…¹Í™•Èœè€€É•ÑÕÉ¸¡É••½É•QÉ…¹Í™•È¡•¹Ø±ˆ¤ì(€€€…Í”€…ÁÁ±å½É•I•™Õ¹œè€€€€€¼¼…±¥…Ï¾òk¢š?š‚ó–B7ž¢Ä(€€€…Í”€…ÁÁ±å½É•I•™Õ¹‘4œè€€É•ÑÕÉ¸¡ÁÁ±å½É•I•™Õ¹‘4¡•¹Ø±ˆ¤ì(€€€…Í”€ÉÕ¹½É•¡½¥••…‘±¥¹”œèÉ•ÑÕÉ¸¡IÕ¹½É•¡½¥••…‘±¥¹”¡•¹Ø±ˆ¤ì(€€€…Í”€½¹™¥Éµ½É•I•™Õ¹œè€€É•ÑÕÉ¸¡½¹™¥Éµ½É•I•™Õ¹¡•¹Ø±ˆ¤ì(€€€…Í”€•ÑI•™Õ¹‘MÕ•ÍÑ¥½¸œèÉ•ÑÕÉ¸¡•ÑI•™Õ¹‘MÕ•ÍÑ¥½¸¡•¹Ø±ˆ¤ì(€€€€¼¼ƒ–¢¢ÄA=MPƒ–Fó–>¯žjP…Ñ¥½¹Ì(€€€…Í”€•Ñ¥¹…¹”œè€€€€€€€€€É•ÑÕÉ¸¡•Ñ¥¹…¹”¡•¹Ø±ˆ¤ì(€€€…Í”€•ÑI•Í	åM•ÍÍ¥½¸œè€€€É•ÑÕÉ¸¡•ÑI•Í	åM•ÍÍ¥½¸¡•¹Ø±ˆ¤ì(€€€‘•™…Õ±ÐèÉ•ÑÕÉ¸©Í½¹ÉÈ Õ¹­¹½Ý¸A=MP…Ñ¥½¸è€œ­…Ñ¥½¸¤ì(€ô)ô((¼¼ƒŠRŠR MQ%=8€ÄØèƒ’âï¦Ë–—¦îxƒŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠRŠR )•áÁ½ÉÐ‘•™…Õ±Ðì(€…Íå¹Œ™•Ñ ¡É•ÅÕ•ÍÐ°•¹Ø°Ñà¤ì(€€€€¼¼=ILÁÉ•™±¥¡Ð(€€€¥˜€¡É•ÅÕ•ÍÐ¹µ•Ñ¡½ôôô=AQ%=9Lœ¤ì(€€€€€É•ÑÕÉ¸¹•ÜI•ÍÁ½¹Í”¡¹Õ±°°íÍÑ…ÑÕÌèÈÀÐ°¡•…‘•ÉÌé½ÉÍ!•…‘•ÉÌ ¥ô¤ì(€€€ô(€€€€¼¼ƒ–ë¦2¿šf¢š¢÷–n{ž¶SŽ3¢ªÃŽ–r£–k’î¦êóŽ–N«’âž¶Ž7Ž’â¢Þ¿–†¯¦Ë–:ï¾ò3šr–’[–Æ…Ñ ƒ–ÂÇšr'žÞkžÒ‹–>¿–¾¯Ž(€€€½¹ÍÐ}±½Ñà€ôíµ•Ñ¡½éÉ•ÅÕ•ÍÐ¹µ•Ñ¡½°Á…Ñ èœœ°…Ñ¥½¸èœœ°Ñ•¹…¹Ñ%èœœ°•µ…¥°èœœ°É•%èœœ°Í•ÍÍ¥½¹%èœôì(€€€ÑÉäì(€€€€€½¹ÍÐÕÉ°€ô¹•ÜUI0¡É•ÅÕ•ÍÐ¹ÕÉ°¤ì(€€€€€½¹ÍÐÁ…Ñ¡¹…µ”€ôÕÉ°¹Á…Ñ¡¹…µ”ì(€€€€€½¹ÍÐ…Ñ¥½¸€ôÕÉ°¹Í•…É¡A…É…µÌ¹•Ð …Ñ¥½¸œ¥ñðœœì(€€€€€}±½Ñà¹Á…Ñ €ôÁ…Ñ¡¹…µ”ì(€€€€€}±½Ñà¹…Ñ¥½¸€ô…Ñ¥½¸ì((€€€€€€¼¼ƒŠRŠR ½½±”=ÕÑ ƒ¢Þ¿žRÇ¾ò!S¾ò'ŠRŠR (€€€€€¥˜€¡É•ÅÕ•ÍÐ¹µ•Ñ¡½ôôôPœ€˜˜Á…Ñ¡¹…µ”¹•¹‘Í]¥Ñ  œ½…ÕÑ ½½½±”½ÍÑ…ÉÐœ¤¤ì(€€€€€€€É•ÑÕÉ¸…Ý…¥Ð¡½½±•MÑ…ÉÐ¡•¹Ø°ÕÉ°¤ì(€€€€€ô(€€€€€¥˜€¡É•ÅÕ•ÍÐ¹µ•Ñ¡½ôôôPœ€˜˜Á…Ñ¡¹…µ”¹•¹‘Í]¥Ñ  œ½…ÕÑ ½½½±”½…±±‰…¬œ¤¤ì(€€€€€€€É•ÑÕÉ¸…Ý…¥Ð¡½½±•…±±‰…¬¡•¹Ø°ÕÉ°¤ì(€€€€€ô(€€€€€¥˜€¡É•ÅÕ•ÍÐ¹µ•Ñ¡½ôôôPœ€˜˜Á…Ñ¡¹…µ”¹•¹‘Í]¥Ñ  œ½…ÕÑ ½±¥¹”½ÍÑ…ÉÐœ¤¤ì(€€€€€€€É•ÑÕÉ¸…Ý…¥Ð¡1¥¹•MÑ…ÉÐ¡•¹Ø°ÕÉ°¤ì(€€€€€ô(€€€€€¥˜€¡É•ÅÕ•ÍÐ¹µ•Ñ¡½ôôôPœ€˜˜Á…Ñ¡¹…µ”¹•¹‘Í]¥Ñ  œ½…ÕÑ ½±¥¹”½…±±‰…¬œ¤¤ì(€€€€€€€É•ÑÕÉ¸…Ý…¥Ð¡1¥¹•…±±‰…¬¡•¹Ø°ÕÉ°¤ì(€€€€€ô(€€€€€€¼¼ƒ¢"(Õ¹¥™¥•½½±”=ÕÑ ƒ––kžnã–ºç¢ö'–v¾òož>û¢†3–³¦Z/–—–>’öÿžR €½…ÕÑ ½±¥¹”½ÍÑ…ÉÓŽ(€€€€€¥˜€¡É•ÅÕ•ÍÐ¹µ•Ñ¡½ôôôPœ€˜˜Á…Ñ¡¹…µ”¹•¹‘Í]¥Ñ  œ½…ÕÑ ½½½±”½Õ¹¥™¥•½ÍÑ…ÉÐœ¤¤ì(€€€€€€€½¹ÍÐÔ€ô¹•ÜUI0 œ½…ÕÑ ½½½±”½ÍÑ…ÉÐœ°ÕÉ°¹½É¥¥¸¤ì(€€€€€€€™½È€¡½¹ÍÐm¬±Ùt½˜ÕÉ°¹Í•…É¡A…É…µÌ¹•¹ÑÉ¥•Ì ¤¤ì(€€€€€€€€€¥˜€¡¬€„ôô€¹•áÐœ¤Ô¹Í•…É¡A…É…µÌ¹Í•Ð¡¬°Ø¤ì(€€€€€€€ô(€€€€€€€É•ÑÕÉ¸I•ÍÁ½¹Í”¹É•‘¥É•Ð¡Ô¹Ñ½MÑÉ¥¹œ ¤°€ÌÀÈ¤ì(€€€€€ô(€€€€€¥˜€¡É•ÅÕ•ÍÐ¹µ•Ñ¡½ôôôPœ€˜˜Á…Ñ¡¹…µ”¹•¹‘Í]¥Ñ  œ½…ÕÑ ½½½±”½Õ¹¥™¥•½…±±‰…¬œ¤¤ì(€€€€€€€½¹ÍÐÔ€ô¹•ÜUI0¡…‘µ¥¹1½¥¹M¥Ñ•UÉ°¡•¹Ø¤¤ì(€€€€€€€Ô¹Í•…É¡A…É…µÌ¹Í•Ð ±½¥¹}•ÉÉ½Èœ°€±•…å}½½±•}…±±‰…¬œ¤ì(€€€€€€€É•ÑÕÉ¸I•ÍÁ½¹Í”¹É•‘¥É•Ð¡Ô¹Ñ½MÑÉ¥¹œ ¤°€ÌÀÈ¤ì(€€€€€ô((€€€€€€¼¼ƒŠRŠR ƒž~·žÚË–v¢ö'–v¾òh½Ì¼ñ½‘”øƒŠRŠR (€€€€€€¼¼ƒžRÇžžš"Û–³¦Z/žÚË–~žj€½Ì¼¨É½ÕÑ”ƒ–Â;¦Ë’ú¾òo’â7–âØ…Ñ¥½»¾ò1Ñ•¹…¹ÐƒžRÇž~·žŠó¢ÎšZg¢žšzCŽ(€€€€€½¹ÍÐÍ¡½ÉÑ5…Ñ €ôÁ…Ñ¡¹…µ”¹µ…Ñ  ½yp½Íp¼¡m„µèÀ´åuìÐ°ÄÙô¤½¤¤ì(€€€€€¥˜€¡É•ÅÕ•ÍÐ¹µ•Ñ¡½ôôôPœ€˜˜Í¡½ÉÑ5…Ñ ¤ì(€€€€€€€É•ÑÕÉ¸…Ý…¥Ð¡M¡½ÉÑI•‘¥É•Ð¡•¹Ø°Í¡½ÉÑ5…Ñ¡lÅt¹Ñ½1½Ý•É…Í” ¤¤ì(€€€€€ô((€€€€€¥˜€¡É•ÅÕ•ÍÐ¹µ•Ñ¡½ôôôPœ¤ì(€€€€€€€½¹ÍÐÀ€ô=‰©•Ð¹™É½µ¹ÑÉ¥•Ì¡ÕÉ°¹Í•…É¡A…É…µÌ¤ì(€€€€€€€}±½Ñà¹Ñ•¹…¹Ñ%€€ôÀ¹}Ñ•¹…¹Ñ%ñðÀ¹Ñ•¹…¹Ðñð€œœì(€€€€€€€}±½Ñà¹•µ…¥°€€€€€ôÀ¹•µ…¥°ñð€œœì(€€€€€€€}±½Ñà¹É•%€€€€€ôÀ¹É•%ñð€œœì(€€€€€€€}±½Ñà¹Í•ÍÍ¥½¹%€ôÀ¹Í•ÍÍ¥½¹%ñð€œœì(€€€€€€€€¼¼€½…‘µ¥¸½µ”(€€€€€€€¥˜€¡Á…Ñ¡¹…µ”¹•¹‘Í]¥Ñ  œ½…‘µ¥¸½µ”œ¤ñð…Ñ¥½¸ôôô…‘µ¥¹5”œ¤É•ÑÕÉ¸…Ý…¥Ð¡‘µ¥¹5”¡•¹Ø°À¤ì(€€€€€€€É•ÑÕÉ¸…Ý…¥ÐÉ½ÕÑ••Ð¡•¹Ø°…Ñ¥½¸°À°É•ÅÕ•ÍÐ¤ì(€€€€€ô((€€€€€¥˜€¡É•ÅÕ•ÍÐ¹µ•Ñ¡½ôôôA=MPœ¤ì(€€€€€€€€¼¼A…äƒ–n{¢ªÿ¾òk’îcš²øA$ƒ–Âkšr«–VžR (€€€€€€€¥˜€¡…Ñ¥½¸ôôô•Á…åI•ÑÕÉ¸œ¤ì(€€€€€€€€€É•ÑÕÉ¸¹•ÜI•ÍÁ½¹Í” œÁó’îcš²øA$ƒ–Âkšr«–VžR œ±íÍÑ…ÑÕÌèÈÀÁô¤ì(€€€€€€€ô(€€€€€€€€¼¼ƒ’â¢"°A=MS¾òkšR¿š>Ð…ÁÁ±¥…Ñ¥½¸½©Í½¸ƒ¢"Ñ•áÐ½Á±…¥¸ƒ–Ÿžj)M=8(€€€€€€€±•Ð‰½‘äõíôì(€€€€€€€ÑÉäì(€€€€€€€€€½¹ÍÐÉ…Ü€ô…Ý…¥ÐÉ•ÅÕ•ÍÐ¹Ñ•áÐ ¤ì(€€€€€€€€€‰½‘ä€ôÉ…Ü€ü)M=8¹Á…ÉÍ”¡É…Ü¤€èíôì(€€€€€€€ô…Ñ ¡”¤ì(€€€€€€€€€É•ÑÕÉ¸©Í½¹ÉÈ ¥¹Ù…±¥)M=8‰½‘äœ¤ì(€€€€€€€ô(€€€€€€€€¼¼…Ñ¥½¸ƒ–>¿–r UI0ƒš"X‰½‘äƒ’â´(€€€€€€€½¹ÍÐ…Ð€ô…Ñ¥½¸ñð‰½‘ä¹…Ñ¥½¸ñð€œœì(€€€€€€€}±½Ñà¹…Ñ¥½¸€€€€ô…Ðì(€€€€€€€}±½Ñà¹Ñ•¹…¹Ñ%€€ô‰½‘ä¹}Ñ•¹…¹Ñ%ñð‰½‘ä¹Ñ•¹…¹Ðñð€œœì(€€€€€€€}±½Ñà¹•µ…¥°€€€€€ô‰½‘ä¹•µ…¥°ñð€œœì(€€€€€€€}±½Ñà¹É•%€€€€€ô‰½‘ä¹É•%ñð€œœì(€€€€€€€}±½Ñà¹Í•ÍÍ¥½¹%€ô‰½‘ä¹Í•ÍÍ¥½¹%ñð€œœì(€€€€€€€€¼¼€½…‘µ¥¸½±½½ÕÐ(€€€€€€€¥˜€¡Á…Ñ¡¹…µ”¹•¹‘Í]¥Ñ  œ½…‘µ¥¸½±½½ÕÐœ¤ñð…Ðôôô…‘µ¥¹1½½ÕÐœ¤É•ÑÕÉ¸…Ý…¥Ð¡‘µ¥¹1½½ÕÐ¡•¹Ø°‰½‘ä¤ì(€€€€€€€€¼¼ƒžRÏ¢®/¢¦›žR£¾ò#’â7¦ržfï–—¾ò$(€€€€€€€¥˜€¡Á…Ñ¡¹…µ”¹•¹‘Í]¥Ñ  œ½…ÁÁ±äœ¤ñð…Ðôôô…ÁÁ±åQÉ¥…°œ¤É•ÑÕÉ¸…Ý…¥Ð¡ÁÁ±åQÉ¥…°¡•¹Ø°‰½‘ä¤ì(€€€€€€€€¼¼ƒ–’k’âï¢ú›ž¦ë¦ZO¦ãšN¾ò!1%9¾ò=½½±”ƒ–ÞË¦¦_¢¶'–ú3žjž~·šV Ñ½­•»¾ò3’â7¦r Ñ•¹…¹Ðƒ–&7žö»–>šVã¾ò$(€€€€€€€¥˜€¡…ÐôôôÍ•±•Ñ1½¥¹]½É­ÍÁ…”œ¤É•ÑÕÉ¸…Ý…¥Ð¡M•±•Ñ1½¥¹]½É­ÍÁ…”¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÁ±…Ñ™½Éµ¹Ñ•ÉQ•¹…¹Ðœ¤É•ÑÕÉ¸…Ý…¥Ð¡A±…Ñ™½Éµ¹Ñ•ÉQ•¹…¹Ð¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÁ±…Ñ™½ÉµUÁÍ•ÉÑQ•¹…¹Ñ=Ý¹•Èœ¤É•ÑÕÉ¸…Ý…¥Ð¡A±…Ñ™½ÉµUÁÍ•ÉÑQ•¹…¹Ñ=Ý¹•È¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÉ…¹ÑA…ÉÑ¹•ÉÉ•‘¥Ðœ¤É•ÑÕÉ¸…Ý…¥ÐÉ…¹ÑA…ÉÑ¹•ÉÉ•‘¥Ð¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÍ…Ù•MÑ…ÉÑÕÁÉ•‘¥ÑA½±¥äœ¤É•ÑÕÉ¸…Ý…¥Ð¡M…Ù•MÑ…ÉÑÕÁÉ•‘¥ÑA½±¥ä¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÍ…Ù•A±…Ñ™½Éµ	¥±±¥¹A½±¥äœ¤É•ÑÕÉ¸…Ý…¥Ð¡M…Ù•A±…Ñ™½Éµ	¥±±¥¹A½±¥ä¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÍ…Ù•A±…Ñ™½ÉµA…åµ•¹ÑAÉ½™¥±”œ¤É•ÑÕÉ¸…Ý…¥Ð¡M…Ù•A±…Ñ™½ÉµA…åµ•¹ÑAÉ½™¥±”¡•¹Ø°‰½‘ä¤ì(€¥˜€¡…ÐôôôÉ•½É‘A±…Ñ™½ÉµM•ÉÙ¥•M…±”œ¤É•ÑÕÉ¸…Ý…¥Ð¡I•½É‘A±…Ñ™½ÉµM•ÉÙ¥•M…±”¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…Ðôôô½¹™¥Éµ=Á•É…Ñ¥¹A…åµ•¹Ðœ¤É•ÑÕÉ¸…Ý…¥Ð¡½¹™¥Éµ=Á•É…Ñ¥¹A…åµ•¹Ð¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…Ðôôô½¹™¥ÉµI•Á½ÉÑ•‘=Á•É…Ñ¥¹A…åµ•¹Ðœ¤É•ÑÕÉ¸…Ý…¥Ð¡½¹™¥ÉµI•Á½ÉÑ•‘=Á•É…Ñ¥¹A…åµ•¹Ð¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÍ…Ù•áÁ½ÍÕÉ•A±…¹A±…Ñ™½É´œ¤É•ÑÕÉ¸…Ý…¥Ð¡M…Ù•áÁ½ÍÕÉ•A±…¹A±…Ñ™½É´¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÍ…Ù•A±…Ñ™½ÉµAÕ‰±¥AÉ½™¥±”œ¤É•ÑÕÉ¸…Ý…¥Ð¡M…Ù•A±…Ñ™½ÉµAÕ‰±¥AÉ½™¥±”¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…Ðôôô½¹™¥ÉµáÁ½ÍÕÉ•A…åµ•¹Ðœ¤É•ÑÕÉ¸…Ý…¥Ð¡½¹™¥ÉµáÁ½ÍÕÉ•A…åµ•¹Ð¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…Ðôôô…¹•±áÁ½ÍÕÉ•A±…Ñ™½É´œ¤É•ÑÕÉ¸…Ý…¥Ð¡…¹•±áÁ½ÍÕÉ•A±…Ñ™½É´¡•¹Ø°‰½‘ä¤ì(€€€€€€€€¼¼ƒ’â¦6×¦Z/¦k¾ò#–æÏ–>Ãžº‡žB–N‡¾ò$(€€€€€€€¥˜€¡…Ðôôô…ÁÁÉ½Ù•ÁÁ±äœ¤É•ÑÕÉ¸…Ý…¥Ð¡ÁÁÉ½Ù•ÁÁ±ä¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÉ•ÅÕ•ÍÑÁÁ±åMÕÁÁ±•µ•¹Ðœ¤É•ÑÕÉ¸…Ý…¥Ð¡I•ÅÕ•ÍÑÁÁ±åMÕÁÁ±•µ•¹Ð¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÉ•©•ÑÁÁ±äœ¤É•ÑÕÉ¸…Ý…¥Ð¡I•©•ÑÁÁ±ä¡•¹Ø°‰½‘ä¤ì(€€€€€€€€¼¼ƒ¦:[–ºh€¼ƒ¢ž¦:X(€€€€€€€¥˜€¡…Ðôôô±½­Q•¹…¹Ðœ¤É•ÑÕÉ¸…Ý…¥Ð¡1½­Q•¹…¹Ð¡•¹Ø°‰½‘ä¤ì(€€€€€€€¥˜€¡…ÐôôôÕ¹±½­Q•¹…¹Ðœ¤É•ÑÕÉ¸©Í½¹ÉÈ Ÿ¢"(€ÌÀƒš^—žê3¢ÊïšÖž¢/–ÞË–sžR£¾ò3¢®/’öÿžR£š¶–ò?ž¦/š²(œ¤ì(€€€€€€€É•ÑÕÉ¸…Ý…¥ÐÉ½ÕÑ•A½ÍÐ¡•¹Ø°…Ð°‰½‘ä°Ñà°É•ÅÕ•ÍÐ¤ì(€€€€€ô((€€€€€É•ÑÕÉ¸©Í½¹ÉÈ 5•Ñ¡½9½Ð±±½Ý•œ¤ì(€€€ô…Ñ ¡”¤ì(€€€€€½¹Í½±”¹•ÉÉ½È ]½É­•È•ÉÉ½Èèœ°”¤ì(€€€€€€¼¼ƒ–£–~šRSš"«¾òk’îï’öWšò?š:—žj¦2¿¢ª“¦÷¢šžVg’â/žÞkžÒ‹¾ò3–B›–&šR“–>/žr/–"ÃŽ3žVÃ–âãŽ7¾ò3’öƒš"G¦÷–>«¢÷ž2sŽ(€€€€€€¼¼ƒžR Ý…¥ÑU¹Ñ¥°ƒ–r£¢3šf¿–¾¯¾ò3’â7š.[š‹–n{š'Ž(€€€€€½¹ÍÐ}±½%Ð€ô±½ÉÉ½È¡•¹Ø°ì(€€€€€€€Í½ÕÉ”è€Ý½É­•Èœ°(€€€€€€€…Ñ¥½¸è€¡}±½Ñà€˜˜}±½Ñà¹…Ñ¥½¸¤ñð€œœ°(€€€€€€€Ñ•¹…¹Ñ%è€¡}±½Ñà€˜˜}±½Ñà¹Ñ•¹…¹Ñ%¤ñð€œœ°(€€€€€€€•µ…¥°è€¡}±½Ñà€˜˜}±½Ñà¹•µ…¥°¤ñð€œœ°(€€€€€€€É•%è€¡}±½Ñà€˜˜}±½Ñà¹É•%¤ñð€œœ°(€€€€€€€Í•ÍÍ¥½¹%è€¡}±½Ñà€˜˜}±½Ñà¹Í•ÍÍ¥½¹%¤ñð€œœ°(€€€€€€€•ÉÉ½Èè”°(€€€€€€€‘•Ñ…¥°èíµ•Ñ¡½è€¡}±½Ñà€˜˜}±½Ñà¹µ•Ñ¡½¤ñð€œœ°Á…Ñ è€¡}±½Ñà€˜˜}±½Ñà¹Á…Ñ ¤ñð€œô°(€€€€€ô¤ì(€€€€€¥˜€¡Ñà€˜˜ÑåÁ•½˜Ñà¹Ý…¥ÑU¹Ñ¥°€ôôô€™Õ¹Ñ¥½¸œ¤Ñà¹Ý…¥ÑU¹Ñ¥°¡}±½%Ð¤ì•±Í”…Ý…¥Ð}±½%Ðì(€€€€€É•ÑÕÉ¸©Í½¹ÉÈ ŸžÎïžÖÇžfóžRžVÃ–âã¾ò3–ÞË¢¢c¦2Ž¢®/¢¿žæ¯’âï¢ú›’â›š>C’úožfóžRšf¦ZOŽœ¤ì(€€€ô(€ô°((€…Íå¹ŒÍ¡•‘Õ±•¡•Ù•¹Ð°•¹Ø°Ñà¤ì(€€€…Ý…¥ÐÍå¹áÁ½ÍÕÉ•MÑ…ÑÕÍ•Ì¡•¹Ø¤ì(€€€½¹ÍÐÕÑ!½ÕÈ€ô¹•Ü…Ñ”¡•Ù•¹Ð¹Í¡•‘Õ±•‘Q¥µ”¤¹•ÑUQ!½ÕÉÌ ¤ì(€€€¥˜€¡ÕÑ!½ÕÈôôôÄ¤ì(€€€€€…Ý…¥ÐÉ½¹AÉ•Ù•¹ÑI•µ¥¹‘•ÉÌ¡•¹Ø¤ì(€€€€€…Ý…¥ÐÉ½¹É…¹Ñ½µÁ±•Ñ•‘I•Ý…É‘Ì¡•¹Ø¤ì(€€€€€…Ý…¥ÐÉ½¹QÉ¥…±áÁ¥É•I•µ¥¹‘•ÉÌ¡•¹Ø¤ì€¼¼ƒ¢¦›žR£–"Ãšrš>C¦H(€€€ô•±Í”ì(€€€€€€¼¼€ÀÈèÀÀUQ€ô€ÄÀèÀÀƒ–>ÃžŒƒŠHƒžæÏ¢Êïšr¦f@€¬ƒšR“’ö7¦/–è€¬ƒ’â7–>¿š*_–*o¦ûšr|(€€€€€…Ý…¥ÐÉ½¹¡•­A…åµ•¹ÑÌ¡•¹Ø¤ì(€€€€€…Ý…¥ÐÉ½¹I•±•…Í•MÑ…±±Ì¡•¹Ø¤ì(€€€€€…Ý…¥ÐÉ½¹½É•…¹•±áÁ¥Éä¡•¹Ø¤ì(€€€€€€¼¼ƒ’â7–>¿š*_–*o¦ãšN¦ûšr¢«–.W¢ö'¦¢Êì(€€€€€…Ý…¥Ð¡IÕ¹½É•¡½¥••…‘±¥¹”¡•¹Ø°íô¤ì(€€€ô(€ô°)ôì(