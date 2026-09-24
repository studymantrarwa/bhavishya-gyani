const {authUser,req:sbreq,json,profile}=require('./_lib');
module.exports=async(req,res)=>{try{
 const u=await authUser(req); if(!u)return json(res,401,{error:'Login required'});
 const p=await profile(u.id); if(!['user','astrologer','admin'].includes(p?.role))return json(res,403,{error:'Login required'});
 if(req.method==='GET'){
  const requestedId=String(req.query?.id||'').trim();
  const target=requestedId||u.id;
  if(requestedId && requestedId!==u.id){
   const rows=await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(target)}&verified=eq.true&select=*`);
   const a=rows[0];
   if(!a)return json(res,404,{error:'Astrologer not found'});
   const acc=(await sbreq(`/rest/v1/astrologer_accounts?id=eq.${encodeURIComponent(target)}&select=id,full_name,blocked,approved&limit=1`))[0];
   if(!acc||acc.blocked||acc.approved===false)return json(res,404,{error:'Astrologer not found'});
   const app=await sbreq(`/rest/v1/astrologer_applications?user_id=eq.${encodeURIComponent(target)}&select=education&limit=1`);
   const online=!!a.online;return json(res,200,{astrologer:{...a,online,full_name:acc.full_name||'Astrologer',avatar_url:a.avatar_url||null,education:a.education||app[0]?.education||''}});
  }
  const rows=await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(u.id)}&select=*`);
  return json(res,200,{astrologer:rows[0]||null});
 }
 if(req.method==='PATCH'){
  const b=req.body||{}; const patch={};
  for(const k of ['education','bio','experience_years','expertise','languages','call_enabled','chat_enabled','video_enabled','boosted']) if(k in b) patch[k]=b[k];
  if('fee' in b) patch.fee=Math.max(0,Number(b.fee)||0);
  if('discount' in b) patch.discount=Math.min(100,Math.max(0,Number(b.discount)||0));
  if('online' in b){patch.online=!!b.online;patch.last_seen=b.online?new Date().toISOString():null;}if('chat_enabled' in b) patch.chat_enabled=!!b.chat_enabled;
  if(!Object.keys(patch).length)return json(res,400,{error:'Nothing to update'});
  const rows=await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
  return json(res,200,{astrologer:rows[0]||null});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
