const {authUser,req:sbreq,json}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
module.exports=async(req,res)=>{
 try{
  const u=await authUser(req); if(!u) return json(res,401,{error:'Login required'});
  if(req.method==='GET'){
   let path=`/rest/v1/reviews?select=*&order=created_at.desc&limit=200`;
   if(u.account_type==='astrologer') path=`/rest/v1/reviews?astrologer_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=200`;
   else if(u.account_type==='user') path=`/rest/v1/reviews?user_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=200`;
   else return json(res,403,{error:'Not allowed'});
   return json(res,200,{reviews:await sbreq(path)});
  }
  if(req.method==='POST'){
   if(u.account_type!=='user') return json(res,403,{error:'Only users can review'});
   const b=req.body||{}; const cid=String(b.conversationId||'').trim(); const rating=Number(b.rating);
   if(!cid||!Number.isFinite(rating)) return json(res,400,{error:'conversationId and rating required'});
   const convRows=await sbreq(`/rest/v1/conversations?id=eq.${esc(cid)}&select=*`); const c=convRows[0];
   if(!c||c.user_id!==u.id||c.status!=='closed') return json(res,403,{error:'Review is allowed only after a closed chat'});
   const existingRows=await sbreq(`/rest/v1/reviews?conversation_id=eq.${esc(cid)}&user_id=eq.${esc(u.id)}&select=id`);
   if(existingRows[0]) return json(res,409,{error:'You already reviewed this chat'});
   const row={conversation_id:c.id,user_id:u.id,astrologer_id:c.astrologer_id,rating:Math.max(1,Math.min(5,Math.round(rating))),review:String(b.review||'').trim(),moderation_status:'approved'};
   const rows=await sbreq('/rest/v1/reviews',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
   const rs=await sbreq(`/rest/v1/reviews?astrologer_id=eq.${esc(c.astrologer_id)}&moderation_status=neq.hidden&select=rating`);
   const avg=rs.length?rs.reduce((s,r)=>s+Number(r.rating||0),0)/rs.length:0;
   await sbreq(`/rest/v1/astrologers?id=eq.${esc(c.astrologer_id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({rating_avg:Math.round(avg*100)/100,updated_at:new Date().toISOString()})});
   return json(res,201,{review:rows[0]});
  }
  return json(res,405,{error:'Method not allowed'});
 }catch(e){return json(res,500,{error:e.message});}
};
