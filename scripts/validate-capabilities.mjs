import fs from 'node:fs';

const file = process.cwd() + '/doing-capabilities.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const allowed = new Set(['done', 'verify', 'issue', 'later']);
const ids = new Set();
const errors = [];

if (!Array.isArray(data.modules) || !data.modules.length) errors.push('modules 不可為空');
for (const module of data.modules || []) {
  if (!module.id || ids.has(module.id)) errors.push('模組 id 缺少或重複：' + String(module.id || ''));
  ids.add(module.id);
  if (!module.area || !module.title || !module.summary) errors.push('模組資料不完整：' + String(module.id || ''));
  if (!Array.isArray(module.features) || !module.features.length) errors.push('模組沒有功能清單：' + String(module.id || ''));
  const labels = new Set();
  for (const feature of module.features || []) {
    if (!feature.label || labels.has(feature.label)) errors.push('功能名稱缺少或重複：' + String(module.id || ''));
    labels.add(feature.label);
    if (!allowed.has(feature.status)) errors.push('不支援的狀態：' + String(feature.status || ''));
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const features = data.modules.flatMap(module => module.features);
const counts = Object.fromEntries([...allowed].map(status => [status, features.filter(feature => feature.status === status).length]));
console.log('DOING 功能地圖驗證通過：', data.modules.length, '個模組／', features.length, '項功能', counts);
