import fs from 'node:fs';

const files=['worker.js','worker.txt'];
for(const file of files){
  let source=fs.readFileSync(file,'utf8');
  const marker="    await dbUpdate(env,'tenant_apply_logs',`id=eq.${encodeURIComponent(applicationId)}`,{brand_name:brand,contact_name:contact,contact_email:contactEmail,contact_phone:phone,event_type:(appPayload.useCases||[]).join(','),plan_type:'review',note:'Google 驗證完成，正在建立工作空間',status:'pending',application_json:applicationJson});";
  const at=source.indexOf(marker);
  if(at<0) throw new Error(file+': 找不到 Google 正式送出區塊');
  const before=source.slice(Math.max(0,at-900),at);
  if(before.includes("application_status','supplement_submitted'")){
    console.log(file+': Google 補件閉環已存在');
    continue;
  }
  const insert=`      await dbUpdate(env,'tenant_apply_logs',\`id=eq.\${encodeURIComponent(applicationId)}\`,{status:'replaced',note:'已併入補件申請'}).catch(()=>{});\n      const u=new URL(doingSiteUrl(env));u.hash='apply';u.searchParams.set('application_status','supplement_submitted');u.searchParams.set('application_id',supplement.id);\n      return Response.redirect(u.toString(),302);\n    }\n`;
  source=source.slice(0,at)+insert+source.slice(at);
  fs.writeFileSync(file,source);
  console.log(file+': 已恢復 Google 補件 return／閉合區塊');
}
if(fs.readFileSync('worker.js','utf8')!==fs.readFileSync('worker.txt','utf8')) throw new Error('worker.js / worker.txt 不一致');
