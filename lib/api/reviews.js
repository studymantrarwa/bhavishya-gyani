const {authUser,req:sbreq,json}=require('./_lib');
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});
 if(req.method==='GET'){
  const rows=await sbreq(`/rest/v1/reviews?or=(user_id.eq.${encodeURIComponent(u.id)},astrologer_id.eq.${encodeURIComponent(u.id)})&select=*,user:profiles!reviews_user_id_fkey(full_name),astrologer:profiles!reviews_astrologer_id_fkey(full_name)&order=created_at.desc`);
  return json(res,200,{reviews:rows});
 }
 if(req.method==='POST'){
  const b=req.body||{};if(!b.conversationId||!b.rating)return json(res,400,{error:'conversationId and rating required'});
  const cs=await sbreq(`/rest/v1/conversations?id=eq.${encodeURIComponent(b.conversationId)}&select=*`);const c=cs[0];
  if(!c||c.user_id!==u.id||c.status!=='closed')return json(res,403,{error:'Review is allowed only after a closed chat'});
  const rows=await sbreq('/rest/v1/reviews',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({conversation_id:c.id,user_id:u.id,astrologer_id:c.astrologer_id,rating:Math.max(1,Math.min(5,Number(b.rating))),review:String(b.review||'')})});
  return json(res,201,{review:rows[0]});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
