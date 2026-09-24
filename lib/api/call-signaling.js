const {authUser,req:sbreq,json,profile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
const PREFIX='__BG_CALL_SIGNAL__';
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});
 const p=await profile(u.id,u.account_type);if(!p||!['user','astrologer'].includes(p.role))return json(res,403,{error:'Call access denied'});
 const id=String(req.query?.conversation_id||req.body?.conversationId||'').trim();if(!id)return json(res,400,{error:'conversation_id required'});
 const c=(await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}&select=*`))[0];
 if(!c||c.channel!=='call'||c.status!=='call_accepted')return json(res,409,{error:'Call is not active'});
 if(c.user_id!==u.id&&c.astrologer_id!==u.id)return json(res,403,{error:'Forbidden'});
 if(req.method==='GET'){
  const rows=await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&select=id,sender_id,body,created_at&order=created_at.asc&limit=500`);
  const signals=rows.filter(x=>String(x.body||'').startsWith(PREFIX)).map(x=>{
   try{return {...x,signal:JSON.parse(String(x.body).slice(PREFIX.length))}}catch(e){return null}
  }).filter(Boolean);
  return json(res,200,{signals});
 }
 if(req.method==='POST'){
  const signal=req.body?.signal;if(!signal||typeof signal!=='object')return json(res,400,{error:'signal required'});
  const type=String(signal.type||'');if(!['offer','answer','ice','bye'].includes(type))return json(res,400,{error:'Invalid signal'});
  const body=PREFIX+JSON.stringify({type,payload:signal.payload||{}});
  const rows=await sbreq('/rest/v1/messages',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({conversation_id:id,sender_id:u.id,body})});
  return json(res,201,{signal:{id:rows[0]?.id,sender_id:u.id,created_at:rows[0]?.created_at,type,payload:signal.payload||{}}});
 }
 if(req.method==='DELETE'){
  const rows=await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&body=like.${encodeURIComponent(PREFIX+'*')}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
  return json(res,200,{ok:true});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
