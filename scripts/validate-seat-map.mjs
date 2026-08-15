import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(file, 'utf8');
const worker = read('worker.js');
const admin = read('admin.html');
const index = read('index.html');
const register = read('register.html');
const migration = read('supabase_seat_map.sql');

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`缺少驗收項目：${label}`);
}

function forbid(source, pattern, label) {
  if (pattern.test(source)) throw new Error(`出現禁止項目：${label}`);
}

function parseInlineScripts(file, source) {
  let count = 0;
  for (const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (!match[1].trim()) continue;
    new vm.Script(match[1], { filename: `${file}#script${++count}` });
  }
}

for (const [file, source] of [['admin.html', admin], ['index.html', index], ['register.html', register]]) {
  parseInlineScripts(file, source);
}

requireText(worker, "case 'adminUpdateSeatPositions'", '桌位拖曳與旋轉儲存 API');
requireText(worker, "case 'adminUnassignSeat'", '退回待排 API');
requireText(worker, 'seatTargetsAreAdjacent(targets)', '雙攤相鄰後端驗證');
requireText(worker, 'return connected.size===rows.length', '雙攤連通判斷');
requireText(worker, 'map_rotation', '桌位旋轉資料欄位');
requireText(worker, "action:'admin_assign'", '排位操作紀錄');
requireText(worker, "action:'admin_unassign'", '退排操作紀錄');
requireText(worker, 'isRegistrationOwner(regRows[0], p.email, p.phone)', '攤友本人位置驗證');

requireText(admin, '點攤商，再點地圖位置', '手機直覺排位指引');
requireText(admin, 'await loadSeatOps(SeatOps.sid)', '排完自動前往下一位');
requireText(admin, 'data-seat-code=', '方形桌位操作');
requireText(admin, '整組桌位已移動並自動儲存', '多攤一起拖動');
requireText(admin, 'seatOpsRotateGroup', '直接旋轉');
requireText(admin, 'seatOpsUnassign', '直接退回待排');
requireText(admin, 'touches.length===2', '雙指縮放');
requireText(admin, 'seatPlanMarkDirty', '自動儲存');
requireText(admin, 'SeatPlanLineStart', '起點終點排成一列');
requireText(admin, 'const W=2160', '高畫質分享圖');
requireText(admin, "r.equipmentText||'設備自備'", '分享圖完整設備名單');
requireText(admin, 'min-height:56px', '手機大按鈕');
forbid(admin, /移動模式|旋轉模式/, '複雜模式工具列');

for (const [file, source] of [['index.html', index], ['register.html', register]]) {
  requireText(source, '<strong id="preNoticeSeat">', `${file} 大號碼優先`);
  requireText(source, '.my-seat-table.mine', `${file} 自己桌位突出`);
  requireText(source, '.my-seat-table.other', `${file} 其他桌位淡化`);
  requireText(source, 'preNoticeDateTabs', `${file} 活動日分頁`);
  requireText(source, 'bindMySeatZoom', `${file} 雙指縮放`);
  requireText(source, "apiGet('getSeatMap'", `${file} 讀取本人位置資料`);
  requireText(source, '設備自備', `${file} 設備資訊`);
  requireText(source, '兩天活動預設使用相同位置', `${file} 多日同位置說明`);
}

requireText(migration, 'add column if not exists map_rotation', '資料庫旋轉欄位遷移');

console.log('Seat map mobile acceptance checks passed.');
