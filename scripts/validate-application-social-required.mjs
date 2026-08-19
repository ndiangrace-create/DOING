import fs from 'node:fs';

const source=fs.readFileSync('doing-smart-activation.js','utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};

assert(source.includes('id="saFacebook"'),'正式申請缺少 Facebook 粉專欄位');
assert(source.includes('id="saInstagram"'),'正式申請缺少 Instagram 欄位');
assert(!source.includes('id="saNoPublic"'),'正式申請仍存在「沒有公開頁面」勾選');
assert(!source.includes('目前確實尚未建立公開頁面'),'正式申請仍顯示舊的無公開頁面文案');
assert(source.includes("if(!facebook&&!instagram)return showErr('申請營運帳號必須提供 Facebook 粉專或 Instagram 至少一個。')"),'送出前未強制 Facebook／Instagram 至少一個');
assert(source.includes('facebook.com|fb\\.com')||source.includes('facebook\\.com|fb\\.com'),'Facebook 粉專網址未驗證網域');
assert(source.includes('instagram\\.com'),'Instagram 網址未驗證網域');
assert(source.includes('publicLinks=[facebook,instagram].filter(Boolean)'),'正式申請沒有只把 Facebook／Instagram 寫入公開資訊');
assert(source.includes('noPublicLink:false'),'正式申請仍可能使用無公開頁面例外');

console.log('application social requirement invariant: OK');
