import fs from 'node:fs';

const file='worker.js';
let source=fs.readFileSync(file,'utf8');
const before=source;

// 正式名稱 SSOT：同一個本人報名／預約歷史入口一律稱「我的報名」。
source=source.replaceAll('我的紀錄','我的報名');

function replaceCallbackBlock({noteMarker, endMarker, replacement}){
  const noteAt=source.indexOf(noteMarker);
  if(noteAt<0){
    if(source.includes(replacement.guard))return;
    throw new Error('找不到待修正 OAuth 區塊：'+noteMarker);
  }
  const start=source.lastIndexOf("      await dbUpdate(env,'tenant_apply_logs'",noteAt);
  if(start<0)throw new Error('找不到 OAuth application dbUpdate 起點：'+noteMarker);
  const endAt=source.indexOf(endMarker,noteAt);
  if(endAt<0)throw new Error('找不到 OAuth callback 結尾：'+noteMarker);
  const end=endAt+endMarker.length;
  source=source.slice(0,start)+replacement.text+source.slice(end);
}

replaceCallbackBlock({
  noteMarker:"note:'LINE 驗證完成',status:'pending'",
  endMarker:"return Response.redirect(applicationTarget.toString(),302);",
  replacement:{
    guard:"workspace_auto_activation_status_line",
    text:`      await dbUpdate(env,'tenant_apply_logs',\`id=eq.\${encodeURIComponent(applicationId)}\`,{brand_name:brand,contact_name:contact,contact_email:contactEmail,contact_phone:phone,event_type:(appPayload.useCases||[]).join(','),plan_type:'review',note:'LINE 驗證完成，正在建立工作空間',status:'pending',application_json:applicationJson});
      // workspace_auto_activation_status_line：DB trigger 會同步完成自動開通或轉人工複核；回跳與通知必須讀回正式狀態，不可固定寫「等待平台審核」。
      const activationRows=await dbGet(env,'tenant_apply_logs',\`id=eq.\${encodeURIComponent(applicationId)}&select=status,tenant_id,note\`).catch(()=>[]),activation=activationRows[0]||{},activationStatus=String(activation.status||'pending');
      if(activationStatus==='approved'){
        try{await sendEmail(env,contactEmail,'【DOING】工作空間已建立',emailWrap(\`<p>\${contact} 您好：</p><p>你的 LINE 驗證已完成，DOING 工作空間已自動建立，可以直接開始設定與使用。</p><p><b>申請編號：</b>\${applicationId}</p>\`));}catch(e){}
        applicationTarget.searchParams.set('application_status','approved');
        if(activation.tenant_id)applicationTarget.searchParams.set('tenant_id',String(activation.tenant_id));
      }else if(activationStatus==='manual_review'){
        try{await sendEmail(env,contactEmail,'【DOING】LINE 驗證完成｜資料需要人工確認',emailWrap(\`<p>\${contact} 您好：</p><p>你的 LINE 驗證已完成，但這筆申請有身分或資料需要 DOING 人員確認；資料已安全保留，不需要重新申請。</p><p><b>申請編號：</b>\${applicationId}</p>\`));}catch(e){}
        applicationTarget.searchParams.set('application_status','manual_review');
      }else{
        try{await sendEmail(env,contactEmail,'【DOING】LINE 驗證完成',emailWrap(\`<p>\${contact} 您好：</p><p>你的 LINE 驗證已完成，系統正在建立工作空間；不需要等待一般人工審核。</p><p><b>申請編號：</b>\${applicationId}</p>\`));}catch(e){}
        applicationTarget.searchParams.set('application_status',activationStatus||'pending');
      }
      applicationTarget.searchParams.set('application_id',applicationId);return Response.redirect(applicationTarget.toString(),302);`
  }
});

replaceCallbackBlock({
  noteMarker:"note:'Google 驗證完成',status:'pending'",
  endMarker:"return Response.redirect(u.toString(),302);",
  replacement:{
    guard:"workspace_auto_activation_status_google",
    text:`    await dbUpdate(env,'tenant_apply_logs',\`id=eq.\${encodeURIComponent(applicationId)}\`,{brand_name:brand,contact_name:contact,contact_email:contactEmail,contact_phone:phone,event_type:(appPayload.useCases||[]).join(','),plan_type:'review',note:'Google 驗證完成，正在建立工作空間',status:'pending',application_json:applicationJson});
    // workspace_auto_activation_status_google：Google 僅為備援，但狀態規則與 LINE 共用同一正式申請資料根。
    const activationRows=await dbGet(env,'tenant_apply_logs',\`id=eq.\${encodeURIComponent(applicationId)}&select=status,tenant_id,note\`).catch(()=>[]),activation=activationRows[0]||{},activationStatus=String(activation.status||'pending');
    try{
      const subject=activationStatus==='approved'?'【DOING】工作空間已建立':activationStatus==='manual_review'?'【DOING】身分驗證完成｜資料需要人工確認':'【DOING】身分驗證完成';
      const message=activationStatus==='approved'?'你的身分驗證已完成，DOING 工作空間已自動建立，可以直接開始設定與使用。':activationStatus==='manual_review'?'你的身分驗證已完成，但這筆申請有身分或資料需要 DOING 人員確認；資料已安全保留，不需要重新申請。':'你的身分驗證已完成，系統正在建立工作空間；不需要等待一般人工審核。';
      await sendEmail(env,contactEmail,subject,emailWrap(\`<p>\${contact} 您好：</p><p>\${message}</p><p><b>申請編號：</b>\${applicationId}</p>\`));
    }catch(e){}
    const u=new URL(doingSiteUrl(env));u.hash='apply';u.searchParams.set('application_status',activationStatus||'pending');u.searchParams.set('application_id',applicationId);if(activation.tenant_id)u.searchParams.set('tenant_id',String(activation.tenant_id));return Response.redirect(u.toString(),302);`
  }
});

if(source===before){
  console.log('Worker 已是 v20 正式名稱／自動開通回跳版本，無需再修改。');
  process.exit(0);
}
fs.writeFileSync('worker.js',source);
fs.writeFileSync('worker.txt',source);
console.log('已修正 worker.js / worker.txt：我的報名名稱一致＋OAuth 後讀回自動開通正式狀態。');
