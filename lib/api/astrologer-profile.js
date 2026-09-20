const {authUser,req:sbreq,json,profile}=require('./_lib');
module.exports=async(req,res)=>{try{
 const u=await authUser(req); if(!u)return json(res,401,{error:'Login required'});
 const p=await profile(u.id); if(p?.role!=='astrologer')return json(res,403,{error:'Astrologer only'});
 if(req.method==='GET'){
  const rows=await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(u.id)}&select=*`);
  return json(res,200,{astrologer:rows[0]||null});
 }
 if(req.method==='PATCH'){
  const b=req.body||{}; const patch={};
  for(const k of ['education','bio','experience_years','expertise','languages','call_enabled','chat_enabled','video_enabled','boosted']) if(k in b) patch[k]=b[k];
  if('fee' in b) patch.fee=Math.max(0,Number(b.fee)||0);
  if('discount' in b) patch.discount=Math.min(100,Math.max(0,Number(b.discount)||0));
  if('online' in b) patch.online=!!b.online;if('chat_enabled' in b) patch.chat_enabled=!!b.chat_enabled;
  if(!Object.keys(patch).length)return json(res,400,{error:'Nothing to update'});
  const rows=await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
  return json(res,200,{astrologer:rows[0]||null});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
