const {authUser,req:sbreq,json,ensureProfile}=require('./_lib');
const {contactViolation}=require('../contact-filter');
const {topicFor}=require('./chat-room');
const esc=v=>encodeURIComponent(String(v));
async function broadcastMessage(conversationId,message){
  const base=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(!base||!key)return;
  const topic=topicFor(conversationId);
  try{await fetch(`${base}/realtime/v1/api/broadcast/${encodeURIComponent(topic)}/events/message`,{method:'POST',headers:{'apikey':key,'Content-Type':'application/json'},body:JSON.stringify({id:message.id,sender_id:message.sender_id,body:message.body,created_at:message.created_at,read_at:message.read_at||null})});}catch(e){}
}
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});const p=await ensureProfile(u);if(p?.blocked)return json(res,403,{error:'Account blocked'});
 const id=String(req.query?.conversation_id||req.body?.conversationId||'').trim();if(!id)return json(res,400,{error:'conversation_id required'});
 const c=(await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}&select=*`))[0];const participant=c&&(c.user_id===u.id||c.astrologer_id===u.id);const allowed=participant||c?.admin_id===u.id||p?.role==='admin';if(!allowed)return json(res,403,{error:'Forbidden'});
 if(req.method==='GET'){const rows=await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&select=*&order=created_at.asc&limit=5000`);return json(res,200,{messages:rows,conversation:c});}
 if(req.method==='POST'){
  if(p?.role==='admin'||!participant)return json(res,403,{error:'Admin is read-only. Only User and Astrologer can send messages.'});
  if(c.status!=='accepted')return json(res,409,{error:'Chat is not active'});
  const body=String(req.body?.body||'').trim().slice(0,4000);if(!body)return json(res,400,{error:'Message is empty'});
  const violation=contactViolation(body);if(violation.blocked)return json(res,422,{error:'Mobile numbers, email, links, social/contact details and payment contact details are not allowed in chat.'});
  const rows=await sbreq('/rest/v1/messages',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({conversation_id:id,sender_id:u.id,body,kundali_id:req.body?.kundaliId||null})});
  await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({last_message_at:new Date().toISOString()})});
  await broadcastMessage(id,rows[0]);
  return json(res,201,{message:rows[0]});
 }
 if(req.method==='PATCH'&&req.body?.action==='read'){const at=new Date().toISOString();await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&sender_id=neq.${esc(u.id)}&read_at=is.null`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({read_at:at})});return json(res,200,{ok:true,read_at:at});}
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
