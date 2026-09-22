const {authUser,req:sbreq,json,ensureProfile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});const p=await ensureProfile(u);if(p?.blocked)return json(res,403,{error:'Account blocked'});
 const id=String(req.query?.conversation_id||req.body?.conversationId||'').trim();if(!id)return json(res,400,{error:'conversation_id required'});
 const c=(await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}&select=*`))[0];const allowed=c&&(c.user_id===u.id||c.astrologer_id===u.id||c.admin_id===u.id||p?.role==='admin');if(!allowed)return json(res,403,{error:'Forbidden'});
 if(req.method==='GET'){const rows=await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&select=*&order=created_at.asc&limit=5000`);return json(res,200,{messages:rows,conversation:c});}
 if(req.method==='POST'){
  if(p?.role==='admin')return json(res,403,{error:'Admin is read-only in chat'});
  if(c.status!=='accepted')return json(res,409,{error:'Chat is not active'});
  if(c.user_id!==u.id&&c.astrologer_id!==u.id)return json(res,403,{error:'Only chat participants can send messages'});
  const body=String(req.body?.body||'').trim().slice(0,4000);if(!body)return json(res,400,{error:'Message is empty'});
  const messageId=String(req.body?.messageId||'').trim();
  if(messageId&&!uuid.test(messageId))return json(res,400,{error:'Invalid messageId'});
  if(messageId){const existing=(await sbreq(`/rest/v1/messages?id=eq.${esc(messageId)}&conversation_id=eq.${esc(id)}&select=*`))[0];if(existing)return json(res,200,{message:existing,existing:true});}
  const payload={conversation_id:id,sender_id:u.id,body,kundali_id:req.body?.kundaliId||null};if(messageId)payload.id=messageId;
  const rows=await sbreq('/rest/v1/messages',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
  const message=rows[0];
  await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({last_message_at:message?.created_at||new Date().toISOString()})});
  return json(res,201,{message});
 }
 if(req.method==='PATCH'&&req.body?.action==='read'){
  if(p?.role==='admin')return json(res,200,{ok:true,read_at:new Date().toISOString(),read_only:true});
  const at=new Date().toISOString();await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&sender_id=neq.${esc(u.id)}&read_at=is.null`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({read_at:at})});return json(res,200,{ok:true,read_at:at});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};