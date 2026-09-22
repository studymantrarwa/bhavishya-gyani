const {authUser,req:sbreq,json,profile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
module.exports=async(req,res)=>{try{
 const u=await authUser(req); if(!u)return json(res,401,{error:'Login required'});
 const p=await profile(u.id); if(p?.blocked)return json(res,403,{error:'Account blocked'});
 if(req.method==='GET'){
   let rows=[];
   if(p?.role==='astrologer') rows=await sbreq(`/rest/v1/payments?astrologer_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=500`);
   else if(p?.role==='admin') rows=await sbreq('/rest/v1/payments?select=*&order=created_at.desc&limit=500');
   else rows=await sbreq(`/rest/v1/payments?user_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=500`);
   return json(res,200,{payments:rows});
 }
 if(req.method==='POST'){
   if(p?.role!=='user')return json(res,403,{error:'Only users can create payment records'});
   const b=req.body||{}; const amount=Math.max(0,Number(b.amount)||0); if(!amount)return json(res,400,{error:'amount required'});
   const row={user_id:u.id,astrologer_id:b.astrologer_id||null,conversation_id:b.conversation_id||null,amount,currency:String(b.currency||'INR'),method:String(b.method||'manual'),reference:String(b.reference||'').slice(0,200),proof_url:b.proof_url||null,status:'pending'};
   const rows=await sbreq('/rest/v1/payments',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
   return json(res,201,{payment:rows[0]});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
