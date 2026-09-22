const {authUser,req:sbreq,json,profile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});const p=await profile(u.id);if(p?.blocked)return json(res,403,{error:'Account blocked'});
 const cid=String(req.query?.conversation_id||'');const kid=String(req.query?.kundali_id||'');if(!cid&&!kid)return json(res,400,{error:'conversation_id or kundali_id required'});
 let k=null;
 if(cid){
  const c=(await sbreq(`/rest/v1/conversations?id=eq.${esc(cid)}&select=*`))[0];if(!c)return json(res,404,{error:'Conversation not found'});const participant=c.user_id===u.id||c.astrologer_id===u.id||p?.role==='admin';if(!participant)return json(res,403,{error:'Forbidden'});
  const msgs=await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(cid)}&kundali_id=not.is.null&select=kundali_id,created_at&order=created_at.desc&limit=1`);const linked=msgs[0]?.kundali_id;
  if(linked)k=(await sbreq(`/rest/v1/kundalis?id=eq.${esc(linked)}&select=*`))[0]||null;
  if(!k){const rows=await sbreq(`/rest/v1/kundalis?user_id=eq.${esc(c.user_id)}&select=*&order=created_at.desc&limit=1`);k=rows[0]||null;}
 }else{
  const rows=await sbreq(`/rest/v1/kundalis?id=eq.${esc(kid)}&select=*`);k=rows[0]||null;if(!k)return json(res,404,{error:'Kundli not found'});if(k.user_id!==u.id){const cs=await sbreq(`/rest/v1/conversations?user_id=eq.${esc(k.user_id)}&astrologer_id=eq.${esc(u.id)}&status=in.(accepted,closed)&select=id&limit=1`);if(!cs[0])return json(res,403,{error:'Kundli access not allowed'})}
 }
 if(!k)return json(res,404,{error:'No saved Kundli found for this user'});return json(res,200,{kundli:k});
}catch(e){return json(res,500,{error:e.message})}};