(function(){
  'use strict';
  const API='https://tobeloved-api.ndiangrace.workers.dev';
  const refs=new Map(),seen=new Set();
  const clean=v=>String(v??'').trim();
  function sourceFor(item,preferred){return preferred||((item&&item.exposureOrderId)?'paid_exposure':'global_discovery')}
  function keyFor(item,source){return [source,clean(item&&item.tenantId),clean(item&&item.sessionId),clean(item&&item.exposureOrderId)].join(':')}
  function newId(){
    if(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')return globalThis.crypto.randomUUID();
    const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  function refFor(item,source){const key=keyFor(item,source);if(!refs.has(key))refs.set(key,newId());return refs.get(key)}
  function track(eventType,item,preferred){
    if(!item||!item.tenantId||!item.sessionId)return Promise.resolve(false);
    const source=sourceFor(item,preferred),attributionId=refFor(item,source),dedupe=[eventType,keyFor(item,source),attributionId].join(':');
    if(seen.has(dedupe))return Promise.resolve(true);seen.add(dedupe);
    return fetch(API+'?action=trackPlatformAttribution',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({eventType,source,attributionId,tenantId:item.tenantId,sessionId:item.sessionId,exposureOrderId:item.exposureOrderId||'',pagePath:location.pathname})}).then(r=>r.ok).catch(()=>false);
  }
  function urlFor(item,preferred){
    const source=sourceFor(item,preferred),u=new URL(location.href);u.search='';u.hash='';
    u.searchParams.set('tenant',clean(item.tenantId));u.searchParams.set('session',clean(item.sessionId));
    u.searchParams.set('doing_source',source);u.searchParams.set('doing_attribution_id',refFor(item,source));u.searchParams.set('doing_attribution_session_id',clean(item.sessionId));
    if(item.exposureOrderId)u.searchParams.set('doing_exposure_order_id',clean(item.exposureOrderId));
    return u.toString();
  }
  function open(item,preferred){track('click',item,preferred);location.href=urlFor(item,preferred)}
  function context(){const u=new URL(location.href),source=clean(u.searchParams.get('doing_source')),attributionId=clean(u.searchParams.get('doing_attribution_id')),sessionId=clean(u.searchParams.get('doing_attribution_session_id')),exposureOrderId=clean(u.searchParams.get('doing_exposure_order_id'));return {source,attributionId,sessionId,exposureOrderId,path:location.pathname}}
  function payloadFields(){const x=context();if(!x.source||!x.attributionId||!x.sessionId)return {};return {doing_attribution_source:x.source,doing_attribution_id:x.attributionId,doing_attribution_session_id:x.sessionId,doing_exposure_order_id:x.exposureOrderId,doing_attribution_path:x.path}}
  function observe(elements,itemFor,preferred){
    const rows=[...elements];if(!rows.length)return;
    if(!('IntersectionObserver'in window)){rows.slice(0,1).forEach(el=>track('impression',itemFor(el),preferred));return}
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting&&entry.intersectionRatio>=.5){track('impression',itemFor(entry.target),preferred);io.unobserve(entry.target)}}),{threshold:.5});
    rows.forEach(el=>io.observe(el));
  }
  window.DoingAttribution={track,open,urlFor,context,payloadFields,observe};
})();
