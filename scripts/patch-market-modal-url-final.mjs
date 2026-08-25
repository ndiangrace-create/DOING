import fs from 'node:fs';
const p='doing-market-public-2bl.js';let s=fs.readFileSync(p,'utf8');
const from="await openRegistration(id)}catch(e){showMessage(e?.message||'報名資料載入失敗')}";
const to="await openRegistration(id);const u=new URL(location.href);u.searchParams.delete('market_autoreg');u.searchParams.delete('session');if(tenant)u.searchParams.set('tenant',tenant);history.replaceState({},'',u.pathname+u.search+u.hash)}catch(e){showMessage(e?.message||'報名資料載入失敗')}";
const n=s.split(from).length-1;if(n!==1)throw new Error('modal url patch occurrence='+n);s=s.replace(from,to);fs.writeFileSync(p,s);console.log('patched '+p);
