const {authUser,req:sbreq,json,ensureProfile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
const active=['requested','astrologer_accepted','accepted'];
const now=()=>Date.now();
async function getConv(id){const r=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}&select=*`);return r[0]||null}
async function decorate(c){
 if(!c)return null;
 const ids=[c.user_id,c.astrologer_id,c.admin_id].filter(Boolean);
 const ps=ids.length?await sbreq(`/rest/v1/profiles?id=in.(${ids.map(esc).join(',')})&select=id,full_name,avatar_url,role`):[];
 const find=id=>id?ps.find(x=>x.id===id)||null:null;
 return {...c,user:find(c.user_id),astrologer:find(c.astrologer_id),admin:find(c.admin_id)};
}
function allowed(u,p,c){return !!c&&(c.user_id===u.id||c.astrologer_id===u.id||c.admin_id===u.id||p?.role==='admin')}
async function expire(c){
 if(!c)return c;
 if(c.status==='requested'&&now()-new Date(c.requested_at||c.created_at).getTime()>120000){const r=await sbreq(`/rest/v1/conversations?id=eq.${esc(c.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'missed',missed_by:'astrologer',retention_until:new Date(now()+172800000).toISOString()})});return r[0]||{...c,status:'missed',missed_by:'astrologer'}}
 if(c.status==='astrologer_accepted'&&c.user_confirm_deadline&&now()>new Date(c.user_confirm_deadline).getTime()){const r=await sbreq(`/rest/v1/conversations?id=eq.${esc(c.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'missed',missed_by:'user',retention_until:new Date(now()+172800000).toISOString()})});return r[0]||{...c,status:'missed',missed_by:'user'}}
 return c;
}
async function listFor(u,p){
 const q=p?.role==='admin'?'/rest/v1/conversations?select=*&order=last_message_at.desc.nullslast,created_at.desc&limit=1000':`/rest/v1/conversations?or=(user_id.eq.${esc(u.id)},astrologer_id.eq.${esc(u.id)},admin_id.eq.${esc(u.id)})&select=*&order=last_message_at.desc.nullslast,created_at.desc&limit=300`;
 let rows=await sbreq(q);rows=await Promise.all(rows.map(expire));return rows;
}
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});const p=await ensureProfile(u);if(p?.blocked)return json(res,403,{error:'Account blocked'});
 if(req.method==='GET'){
  const id=String(req.query?.conversation_id||req.query?.id||'').trim();
  if(id){const c=await expire(await getConv(id));if(!allowed(u,p,c))return json(res,403,{error:'Forbidden'});const messages=await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&select=*&order=created_at.asc&limit=5000`);return json(res,200,{conversation:await decorate(c),messages});}
  const rows=await listFor(u,p);return json(res,200,{conversations:await Promise.all(rows.map(decorate))});
 }
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const b=req.body||{},action=String(b.action||'request');
 if(action==='request'||action==='call'){
  if(p?.role!=='user')return json(res,403,{error:'Only user accounts can start a new request'});
  const channel=action==='call'?'call':'chat',aid=String(b.astrologerId||'').trim();
  if(aid){
   const a=(await sbreq(`/rest/v1/astrologers?id=eq.${esc(aid)}&select=*`))[0];
   if(!a||!a.verified)return json(res,409,{error:'Astrologer is not approved'});
   const fresh=a.last_seen&&((Date.now()-new Date(a.last_seen).getTime())<=75000);if(!a.online||!fresh)return json(res,409,{error:'Astrologer is offline'});
   if(channel==='chat'&&a.chat_enabled===false)return json(res,409,{error:'Astrologer chat is OFF'});
   if(channel==='call'&&a.call_enabled===false)return json(res,409,{error:'Astrologer call is OFF'});
   const old=await sbreq(`/rest/v1/conversations?user_id=eq.${esc(u.id)}&astrologer_id=eq.${esc(aid)}&channel=eq.${esc(channel)}&status=in.(requested,astrologer_accepted,accepted)&select=*&order=created_at.desc&limit=1`);
   if(old[0])return json(res,200,{conversation:await decorate(old[0]),existing:true});
   const body={user_id:u.id,astrologer_id:aid,admin_id:null,status:'requested',channel,requested_at:new Date().toISOString(),fee_snapshot:Number(a.fee||0),discount_snapshot:Number(a.discount||0)};
   const rows=await sbreq('/rest/v1/conversations',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});return json(res,201,{conversation:await decorate(rows[0])});
  }
  const admins=await sbreq('/rest/v1/profiles?role=eq.admin&select=id,full_name,avatar_url,role&limit=1');const admin=admins[0];if(!admin)return json(res,503,{error:'No admin support account is available'});
  const old=await sbreq(`/rest/v1/conversations?user_id=eq.${esc(u.id)}&admin_id=eq.${esc(admin.id)}&channel=eq.support&status=eq.accepted&select=*&order=created_at.desc&limit=1`);if(old[0])return json(res,200,{conversation:await decorate(old[0]),existing:true});
  const rows=await sbreq('/rest/v1/conversations',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:u.id,astrologer_id:null,admin_id:admin.id,status:'accepted',channel:'support',requested_at:new Date().toISOString(),accepted_at:new Date().toISOString()})});return json(res,201,{conversation:await decorate(rows[0])});
 }
 const id=String(b.conversationId||b.conversation_id||'').trim();if(!id)return json(res,400,{error:'conversationId required'});let c=await getConv(id);c=await expire(c);if(!allowed(u,p,c))return json(res,403,{error:'Forbidden'});
 if(action==='admin-accept'){if(p?.role!=='admin')return json(res,403,{error:'Admin only'});const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'accepted',accepted_at:new Date().toISOString(),admin_id:u.id})});return json(res,200,{conversation:await decorate(rows[0])});}
 if(action==='user-confirm'){
  if(p?.role!=='user'||c.user_id!==u.id)return json(res,403,{error:'User only'});
  if(c.status!=='astrologer_accepted')return json(res,409,{error:`Chat is ${c.status}, not awaiting confirmation`});
  if(c.user_confirm_deadline&&now()>new Date(c.user_confirm_deadline).getTime())return json(res,409,{error:'Confirmation window expired'});
  const sec=Math.max(0,Math.round((now()-new Date(c.astrologer_accepted_at||c.created_at).getTime())/1000));
  const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'accepted',user_confirmed_at:new Date().toISOString(),accepted_at:new Date().toISOString(),user_confirm_response_seconds:sec})});return json(res,200,{conversation:await decorate(rows[0])});
 }
 if(action==='close'){const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'closed',closed_at:new Date().toISOString(),retention_until:null})});return json(res,200,{conversation:await decorate(rows[0])});}
 return json(res,400,{error:'Unknown action'});
}catch(e){return json(res,500,{error:e.message})}};
