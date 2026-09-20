const {authUser,req:sbreq,json,profile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
const now=()=>Date.now();
const RETENTION_MS=172800000;
async function getConv(id){const r=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}&select=*`);return r[0]||null}
async function expire(c){
 if(!c)return c;
 const t=now();
 if(c.status==='requested' && t-new Date(c.requested_at||c.created_at).getTime()>120000){
   const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(c.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'missed',missed_by:'astrologer',retention_until:new Date(t+RETENTION_MS).toISOString()})});
   return rows[0]||{...c,status:'missed',missed_by:'astrologer',retention_until:new Date(t+RETENTION_MS).toISOString()};
 }
 if(c.status==='astrologer_accepted' && c.user_confirm_deadline && t>new Date(c.user_confirm_deadline).getTime()){
   const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(c.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'missed',missed_by:'user',retention_until:new Date(t+RETENTION_MS).toISOString()})});
   return rows[0]||{...c,status:'missed',missed_by:'user',retention_until:new Date(t+RETENTION_MS).toISOString()};
 }
 return c;
}
async function decorate(c){
 if(!c)return c;
 const ps=await sbreq(`/rest/v1/profiles?id=in.(${esc(c.user_id)},${esc(c.astrologer_id)})&select=id,full_name,avatar_url,role`);
 const user=ps.find(x=>x.id===c.user_id)||null, astrologer=ps.find(x=>x.id===c.astrologer_id)||null;
 let kundli=null;
 if(c.status==='accepted'||c.status==='closed'){
   const ks=await sbreq(`/rest/v1/kundalis?user_id=eq.${esc(c.user_id)}&select=id,name,dob,birth_time,place,gender,latitude,longitude,timezone,created_at&order=created_at.desc&limit=1`); kundli=ks[0]||null;
 }
 return {...c,user,astrologer,kundli};
}
async function assertParticipant(u,c){return c&&[c.user_id,c.astrologer_id].includes(u.id)}
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});const p=await profile(u.id);if(p?.blocked)return json(res,403,{error:'Your account is blocked'});
 if(req.method==='GET'){
   const id=String(req.query?.conversation_id||req.query?.id||'');
   if(id){let c=await getConv(id);if(!await assertParticipant(u,c)&&p?.role!=='admin')return json(res,403,{error:'Forbidden'});c=await expire(c);const messages=await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&select=*&order=created_at.asc&limit=1000`);return json(res,200,{conversation:await decorate(c),messages});}
   let rows=await sbreq(`/rest/v1/conversations?or=(user_id.eq.${esc(u.id)},astrologer_id.eq.${esc(u.id)})&select=*&order=created_at.desc&limit=150`);
   rows=await Promise.all(rows.map(expire));rows=await Promise.all(rows.map(decorate));rows=rows.map(c=>({...c,history_visibility:((now()-new Date(c.closed_at||c.last_message_at||c.created_at).getTime())>172800000)?'permanent_archive':'recent_48h'}));return json(res,200,{conversations:rows});
 }
 if(req.method==='POST'){
   const b=req.body||{},action=String(b.action||'request');
   if(action==='request'||action==='call'){
     if(p.role!=='user')return json(res,403,{error:'Only users can request a chat/call'});
     const aid=String(b.astrologerId||'');if(!aid)return json(res,400,{error:'astrologerId required'});
     const channel=action==='call'?'call':'chat';
     const a=(await sbreq(`/rest/v1/astrologers?id=eq.${esc(aid)}&select=*`))[0];if(!a||!a.verified)return json(res,409,{error:'Astrologer is not approved'});if(channel==='chat' && (!a.online || a.chat_enabled===false))return json(res,409,{error:'Chat is currently OFF or astrologer is offline'});if(channel==='call' && (!a.online || a.call_enabled===false))return json(res,409,{error:'Call is currently OFF or astrologer is offline'});
     const old=await sbreq(`/rest/v1/conversations?user_id=eq.${esc(u.id)}&astrologer_id=eq.${esc(aid)}&channel=eq.${esc(channel)}&status=in.(requested,astrologer_accepted,accepted)&select=*`);if(old[0])return json(res,200,{conversation:await decorate(await expire(old[0])),existing:true});
     const rows=await sbreq('/rest/v1/conversations',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:u.id,astrologer_id:aid,status:'requested',channel,requested_at:new Date().toISOString(),fee_snapshot:Number(a.fee||0),discount_snapshot:Number(a.discount||0)})});return json(res,201,{conversation:await decorate(rows[0])});
   }
   const id=String(b.conversationId||b.conversation_id||'');if(!id)return json(res,400,{error:'conversationId required'});let c=await getConv(id);if(!await assertParticipant(u,c))return json(res,403,{error:'Forbidden'});c=await expire(c);
   if(action==='user-confirm'){
     if(p.role!=='user'||c.user_id!==u.id)return json(res,403,{error:'User only'});if(c.status!=='astrologer_accepted')return json(res,409,{error:'This request is not waiting for user confirmation'});if(!c.user_confirm_deadline||now()>new Date(c.user_confirm_deadline).getTime())return json(res,409,{error:'User confirmation window expired'});
     const sec=Math.max(0,Math.round((now()-new Date(c.astrologer_accepted_at||c.created_at).getTime())/1000));const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'accepted',accepted_at:new Date().toISOString(),user_confirmed_at:new Date().toISOString(),user_confirm_response_seconds:sec})});return json(res,200,{conversation:await decorate(rows[0])});
   }
   if(action==='close'){
     if(!['user','astrologer','admin'].includes(p.role))return json(res,403,{error:'Forbidden'});const closedAt=new Date();const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'closed',closed_at:closedAt.toISOString(),retention_until:new Date(closedAt.getTime()+RETENTION_MS).toISOString()})});return json(res,200,{conversation:await decorate(rows[0])});
   }
   return json(res,400,{error:'Unknown action'});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
