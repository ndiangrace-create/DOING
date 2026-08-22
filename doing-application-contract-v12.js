(()=>{
'use strict';
if(window.__doingApplicationContractV12)return;
window.__doingApplicationContractV12=true;
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,init={})=>{
  try{
    const url=typeof input==='string'?input:String(input?.url||'');
    if(url.includes('action=createOrganizerApplicationDraft')&&typeof init.body==='string'){
      const body=JSON.parse(init.body);
      const app=body?.application;
      if(app&&typeof app==='object'){
        const analysis=(app.assistantAnalysis&&typeof app.assistantAnalysis==='object')?app.assistantAnalysis:{};
        app.assistantAnalysis={...analysis,confirmed:true,scope:'doing_only'};
        const helper=(app.helperUnderstanding&&typeof app.helperUnderstanding==='object')?app.helperUnderstanding:{};
        app.helperUnderstanding={...helper,confirmed:true,customerServiceOnly:true,applicationGate:false};
        if(!Array.isArray(app.painPoints)||!app.painPoints.length)app.painPoints=['other'];
        init={...init,body:JSON.stringify(body)};
      }
    }
  }catch(_){/* keep original request if compatibility bridge cannot parse */}
  return nativeFetch(input,init);
};
})();
