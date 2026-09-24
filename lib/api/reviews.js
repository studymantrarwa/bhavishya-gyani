const {authUser,req:sbreq,json}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});
 if(req.method==='GET'){
   if(u.account_type==='astrologer'){
     const rows=await sbreq(`/rest/v1/reviews?astrologer_id=eq.${esc(u.id)}&moderation_status=neq.hidden&select=*&order=created_at.desc&limit=500`);
     const ids=[...new Set(rows.map(r=>r.user_id).filter(Boolean))];
     const users=ids.length?await sbreq(`/rest/v1/user_accounts?id=in.(${ids.map(esc).join(',')})&select=id,full_name`):[];
     const map=new Map(users.map(x=>[String(x.id),x]));
     return json(res,200,{reviews:rows.map(r=>({...r,user:map.get(String(r.user_id))||null}))});
   }
   const astrologerId=String(req.query?.astrologerId||'').trim();
   if(astrologerId){
     const rows=await sbreq(`/rest/v1/reviews?astrologer_id=eq.${esc(astrologerId)}&moderation_status=neq.hidden&select=id,conversation_id,user_id,astrologer_id,rating,review,created_at&order=created_at.desc&limit=500`);
     const ids=[...new Set(rows.map(r=>r.user_id).filter(Boolean))];
     const users=ids.length?await sbreq(`/rest/v1/user_accounts?id=in.(${ids.map(esc).join(',')})&select=id,full_name`):[];
     const map=new Map(users.map(x=>[String(x.id),x]));
     return json(res,200,{reviews:rows.map(r=>({...r,user:map.get(String(r.user_id))||null}))});
   }
   const cid=String(req.query?.conversationId||'').trim();
   const path=`/rest/v1/reviews?user_id=eq.${esc(u.id)}${cid?'&conversation_id=eq.'+esc(cid):''}&select=*&order=created_at.desc&limit=500`;
   return json(res,200,{reviews:await sbreq(path)});
 }
 if(req.method==='POST'){
   if(u.account_type!=='user')return json(res,403,{error:'Only users can review'});
   const b=req.body||{};if(!b.conversationId||!b.rating)return json(res,400,{error:'conversationId and rating required'});
   const c=(await sbreq(`/rest/v1/conversations?id=eq.${esc(b.conversationId)}&select=*`))[0];
   if(!c||c.user_id!==u.id||c.status!=='closed')return json(res,403,{error:'Review is allowed only after a closed chat'});
   const row={conversation_id:c.id,user_id:u.id,astrologer_id:c.astrologer_id,rating:Math.max(1,Math.min(5,Number(b.rating))),review:String(b.review||'').trim()};
   let rows;try{rows=await sbreq('/rest/v1/reviews',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});}catch(e){if(/duplicate|unique|23505/i.test(String(e.message||'')))return json(res,409,{error:'इस chat के लिए review पहले ही submit हो चुका है'});throw e}
   const rs=await sbreq(`/rest/v1/reviews?astrologer_id=eq.${esc(c.astrologer_id)}&moderation_status=neq.hidden&select=rating`);
   const avg=rs.length?rs.reduce((s,r)=>s+Number(r.rating||0),0)/rs.length:0;
   await sbreq(`/rest/v1/astrologers?id=eq.${esc(c.astrologer_id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({rating_avg:Math.round(avg*100)/100})});
   return json(res,201,{review:rows[0]});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message||'Review request failed'})}};