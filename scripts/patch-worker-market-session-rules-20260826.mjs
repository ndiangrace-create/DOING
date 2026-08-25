import fs from 'node:fs';

const files=['worker.js','worker.txt'];
const marker='// MARKET_SESSION_RULES_2BL_PARITY_20260826';

function replaceOnce(source,needle,replacement,label){
  const count=source.split(needle).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly 1 match, got ${count}`);
  return source.replace(needle,replacement);
}
function editFunction(source,name,edit){
  const start=source.indexOf(`async function ${name}(`);
  if(start<0)throw new Error(`missing function ${name}`);
  const brace=source.indexOf('{',start);let depth=0,end=-1;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){depth--;if(depth===0){end=i+1;break}}
  }
  if(end<0)throw new Error(`unterminated function ${name}`);
  const block=source.slice(start,end),next=edit(block);
  if(next===block)throw new Error(`function ${name} was not changed`);
  return source.slice(0,start)+next+source.slice(end);
}
function patch(source){
  if(source.includes(marker))return source;
  source=source.replace('// ── SECTION 1: 常數設定 ─────────────────────────────────────────',`${marker}\n// 2BL CURRENT session settings parity: formal schedule + multi-day tiers + portals/type.\n// ── SECTION 1: 常數設定 ─────────────────────────────────────────`);

  source=replaceOnce(source,
`  put('payment_profile_id', b.paymentProfileId ? String(b.paymentProfileId) : null, includeDefaults || b.paymentProfileId !== undefined);\n  return data;`,
`  put('payment_profile_id', b.paymentProfileId ? String(b.paymentProfileId) : null, includeDefaults || b.paymentProfileId !== undefined);\n  put('type', String(b.type||'').trim(), includeDefaults || b.type !== undefined);\n  put('portals_json', JSON.stringify(_sessionArray(b.portals)), includeDefaults || b.portals !== undefined);\n  put('registration_schedule_json', JSON.stringify(_sessionObject(b.registrationSchedule, {})), includeDefaults || b.registrationSchedule !== undefined);\n  put('multi_day_tiers_json', JSON.stringify(_sessionArray(b.multiDayTiers)), includeDefaults || b.multiDayTiers !== undefined);\n  return data;`, 'session payload fields');

  source=replaceOnce(source,
`    venueMapTemplateId: s.venue_map_template_id || '',\n    paymentProfileId: s.payment_profile_id || '',\n  };\n}\nfunction calcFee(ses, selectedDates, stallCount) {`,
`    venueMapTemplateId: s.venue_map_template_id || '',\n    paymentProfileId: s.payment_profile_id || '',\n    type: s.type || '',\n    portals: safeJson(s.portals_json, []),\n    registrationSchedule: safeJson(s.registration_schedule_json, {}),\n    multiDayTiers: safeJson(s.multi_day_tiers_json, []),\n  };\n}\n\nfunction _marketDateKeyShift(dateKey,days){\n  const base=new Date(String(dateKey||'').slice(0,10)+'T00:00:00+08:00');\n  if(Number.isNaN(base.getTime()))return '';\n  const shifted=new Date(base.getTime()+Number(days||0)*86400000+8*3600000);\n  return shifted.toISOString().slice(0,10);\n}\nfunction _marketTaipeiTime(dateKey,hhmm){\n  const t=String(hhmm||'00:00').trim();\n  const d=new Date(String(dateKey||'').slice(0,10)+'T'+(t.length===5?t+':00':t)+'+08:00');\n  return Number.isNaN(d.getTime())?null:d.getTime();\n}\nfunction _marketParseTaipeiDateTime(value){\n  const raw=String(value||'').trim();if(!raw)return null;\n  const hasZone=/[zZ]|[+-]\\d\\d:?\\d\\d$/.test(raw);const d=new Date(hasZone?raw:(raw.length===16?raw+':00+08:00':raw+'+08:00'));\n  return Number.isNaN(d.getTime())?null:d.getTime();\n}\nfunction registrationScheduleError(ses,at=Date.now()){\n  if(!ses)return '找不到場次';\n  const schedule=safeJson(ses.registration_schedule_json,{});if(!schedule||schedule.enabled!==true)return '';\n  const dates=_sessionDateRows(ses.dates_json);const first=dates[0]&&dates[0].date;if(!first)return '場次尚未設定活動日期，不能啟用報名排程';\n  const phases=Array.isArray(schedule.phases)?schedule.phases.slice(0,3):[];let valid=0;\n  for(let i=0;i<phases.length;i++){const p=phases[i]||{};let start=null,end=null;\n    if(i===0){start=_marketParseTaipeiDateTime(p.startAt||p.start_at);const close=Math.max(0,parseInt(p.closeDaysBefore??p.close_days_before,10)||0);const k=_marketDateKeyShift(first,-close);end=_marketTaipeiTime(k,'23:59:59');}\n    else{const reopen=Math.max(0,parseInt(p.reopenDaysBefore??p.reopen_days_before,10)||0),close=Math.max(0,parseInt(p.closeDaysBefore??p.close_days_before,10)||0);start=_marketTaipeiTime(_marketDateKeyShift(first,-reopen),'00:00');end=_marketTaipeiTime(_marketDateKeyShift(first,-close),'23:59:59');}\n    if(start==null||end==null||end<start)continue;valid++;if(at>=start&&at<=end)return '';\n  }\n  if(!valid)return '報名排程已啟用，但尚未填入完整開放階段';\n  return '目前不在本場報名開放時間';\n}\nfunction calcFee(ses, selectedDates, stallCount) {`, 'format/session rules');

  source=source.replace(/function calcFee\(ses, selectedDates, stallCount\) \{[\s\S]*?\n\}\nfunction effectiveEquipIncl/,`function calcFee(ses, selectedDates, stallCount) {\n  const dates = safeJson(ses.dates_json, []);\n  const baseFee = safeNum(ses.fee);\n  const stalls = Math.max(parseInt(stallCount)||1, 1);\n  const selected=Array.isArray(selectedDates)?selectedDates.map(String).filter(Boolean):[];\n  const tiers=safeJson(ses.multi_day_tiers_json,[]);\n  if(selected.length>0&&Array.isArray(tiers)&&tiers.length){\n    const matches=tiers.map((x,i)=>({i,min:Math.max(1,parseInt(x.minDays??x.min_days??x.days??1,10)||1),max:Math.max(0,parseInt(x.maxDays??x.max_days??0,10)||0),price:Math.max(0,safeNum(x.price??x.dailyPrice??x.daily_price))}))\n      .filter(x=>selected.length>=x.min&&(x.max===0||selected.length<=x.max)).sort((a,b)=>b.min-a.min||a.i-b.i);\n    if(matches.length)return matches[0].price*selected.length*stalls;\n  }\n  if (dates.length > 1 && selected.length > 0) {\n    const allSelected = dates.every(d => selected.includes(d.date));\n    if (allSelected && baseFee > 0) return baseFee * stalls;\n    return selected.reduce((sum, sd) => { const def = dates.find(d => d.date === sd); return sum + (def ? (Number(def.fee) || 0) : 0); }, 0) * stalls;\n  }\n  if (dates.length === 1) return (Number(dates[0].fee) || baseFee || 0) * stalls;\n  return baseFee * stalls;\n}\nfunction effectiveEquipIncl`);

  source=editFunction(source,'prepareRegistration',block=>{
    const needle=`  const TENANT = (b && b._tenantId);`;
    const add=`  const TENANT = (b && b._tenantId);\n  const _scheduleSid=String(b.sessionId||b.session_id||'').trim();\n  if(_scheduleSid){const _scheduleRows=await dbGet(env,'sessions',\`tenant_id=eq.\${TENANT}&id=eq.\${encodeURIComponent(_scheduleSid)}&select=id,dates_json,registration_schedule_json\`).catch(()=>[]);const _scheduleErr=registrationScheduleError(_scheduleRows[0]);if(_scheduleErr)return {error:_scheduleErr};}`;
    if(!block.includes(needle))throw new Error('prepareRegistration tenant line missing');return block.replace(needle,add);
  });

  source=editFunction(source,'hCreateSession',block=>{
    const needle=`  const TENANT = b && b._tenantId;`;
    const add=`  const TENANT = b && b._tenantId;\n  if((b.agreementRequired===true||b.agreementRequired==='true')&&!String(b.agreementVersion||'').trim()) return jsonErr('已要求報名同意合約，請先選擇正式合約版本');`;
    if(!block.includes(needle))throw new Error('hCreateSession tenant line missing');return block.replace(needle,add);
  });

  source=editFunction(source,'hUpdateSession',block=>{
    const needle=`  const simulated={...current,...patch};`;
    const add=`  const simulated={...current,...patch};\n  if(agreementRequiredOn(simulated.agreement_required)&&!String(simulated.agreement_version||'').trim()) return jsonErr('已要求報名同意合約，請先選擇正式合約版本');`;
    if(!block.includes(needle))throw new Error('hUpdateSession simulated line missing');return block.replace(needle,add);
  });

  return source;
}

for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const next=patch(source);fs.writeFileSync(file,next,'utf8');
  console.log(`${file}: ${source===next?'already-patched':'patched'}`);
}
if(fs.readFileSync('worker.js','utf8')!==fs.readFileSync('worker.txt','utf8'))throw new Error('worker.js/worker.txt mismatch after patch');
console.log(JSON.stringify({result:'PASS',marker,files},null,2));
