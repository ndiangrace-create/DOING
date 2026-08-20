import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('doing-smart-activation.js','utf8');
const worker=fs.readFileSync('worker.js','utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

assert(source.includes('品牌／社群公開網址 1 *'),'正式申請缺少第一個必填公開網址欄位');
assert(source.includes('品牌／社群公開網址 2（選填）'),'正式申請未將第二個公開網址標示為選填');
assert(source.includes('id="saFacebook"')&&source.includes('id="saInstagram"'),'正式申請缺少相容的公開網址欄位');
assert(!source.includes('id="saNoPublic"'),'正式申請仍存在「沒有公開頁面」勾選');
assert(!source.includes('目前確實尚未建立公開頁面'),'正式申請仍顯示舊的無公開頁面文案');
assert(source.includes("if(!rawFacebook&&!rawInstagram)return showErr('請至少提供一個品牌、社群、官網或作品頁網址。')"),'送出前未強制至少一個公開網址');
assert(!source.includes('facebook.com|fb\\.com')&&!source.includes('instagram\\.com'),'正式申請仍把公開網址鎖定特定社群網域');
assert(source.includes('publicLinks=[facebook,instagram].filter(Boolean)'),'正式申請沒有把通過驗證的公開網址寫入正式資料');
assert(source.includes('noPublicLink:false'),'正式申請仍可能使用無公開頁面例外');
assert(worker.includes('function normalizeApplicationPublicUrl(value)'),'Worker 缺少公開網址正規化');
assert(worker.includes('rawPublicLinks.length!==publicLinks.length'),'Worker 未阻擋不安全或錯誤格式網址');
assert(worker.includes("if(!publicLinks.length)return jsonErr('請至少提供一個品牌、社群、官網或作品頁網址')"),'Worker 仍允許無公開網址例外');

const helper=source.match(/function normalizePublicUrl\(value\)\{[\s\S]*?\n\}/)?.[0];
assert(helper,'無法讀取前端公開網址正規化函式');
const context={URL};
vm.runInNewContext(`${helper};results=[normalizePublicUrl('www.ndian.live'),normalizePublicUrl('https://instagram.com/doing'),normalizePublicUrl('javascript:alert(1)'),normalizePublicUrl('not a url')]`,context);
assert(context.results[0]==='https://www.ndian.live/','未自動替一般官網補上 https://');
assert(context.results[1]==='https://instagram.com/doing','完整社群網址未被接受');
assert(context.results[2]===''&&context.results[3]==='','不安全或錯誤網址未被阻擋');

console.log('application public link requirement invariant: OK');
