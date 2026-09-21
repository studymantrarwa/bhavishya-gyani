const {authUser,req:sbreq,json,profile,ensureProfile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
const ACTIVE=['requested','astrologer_accepted','accepted'];

async function getConv(id){const r=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}&select=*`);return r[0]||null}
async function decorate(c){
  if(!c)return null;
  const ids=[c.user_id,c.astrologer_id,c.admin_id].filter(Boolean);
  const ps=ids.length?await sbreq(`/rest/v1/profiles?id=in.(${ids.map(esc).join(',')})&select=id,full_name,avatar_url,role`):[];
  const find=id=>id?ps.find(x=>x.id===id)||null:null;
  return {...c,user:find(c.user_id),astrologer:find(c.astrologer_id),admin:find(c.admin_id)};
}
function participant(u,p,c){return !!c&&(c.user_id===u.id||c.astrologer_id===u.id||c.admin_id===u.id||p?.role==='admin')}
async function listFor(u,p){
  if(p?.role==='admin')return sbreq('/rest/v1/conversations?select=*&order=coalesce(last_message_at,created_at).desc&limit=1000');
  return sbreq(`/rest/v1/conversations?or=(user_id.eq.${esc(u.id)},astrologer_id.eq.${esc(u.id)},admin_id.eq.${esc(u.id)})&select=*&order=coalesce(last_message_at,created_at).desc&limit=300`);
}
module.exports=async(req,res)=>{try{
  const u=await authUser(req); if(!u)return json(res,401,{error:'Login required'});
  const p=await ensureProfile(u); if(p?.blocked)return json(res,403,{error:'Account blocked'});

  if(req.method==='GET'){
    const id=String(req.query?.conversation_id||req.query?.id||'').trim();
    if(id){
      const c=await getConv(id); if(!participant(u,p,c))return json(res,403,{error:'Forbidden'});
      const messages=await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&select=*&order=created_at.asc&limit=5000`);
      return json(res,200,{conversation:await decorate(c),messages});
    }
    const rows=await listFor(u,p);
    const conversations=await Promise.all(rows.map(decorate));
    return json(res,200,{conversations});
  }

  if(req.method==='POST'){
    const b=req.body||{}, action=String(b.action||'request');

    if(action==='request'||action==='call'){
      if(p?.role!=='user')return json(res,403,{error:'Only user accounts can start a new request'});
      const channel=action==='call'?'call':'chat';
      const aid=String(b.astrologerId||'').trim();
      if(aid){
        const a=(await sbreq(`/rest/v1/astrologers?id=eq.${esc(aid)}&select=*`))[0];
        if(!a||!a.verified)return json(res,409,{error:'Astrologer is not approved'});
        if(channel==='chat'&&(!a.online||a.chat_enabled===false))return json(res,409,{error:'Astrologer chat is currently OFF or offline'});
        const old=await sbreq(`/rest/v1/conversations?user_id=eq.${esc(u.id)}&astrologer_id=eq.${esc(aid)}&channel=eq.${esc(channel)}&status=in.(requested,astrologer_accepted,accepted)&select=*&order=created_at.desc&limit=1`);
        if(old[0])return json(res,200,{conversation:await decorate(old[0]),existing:true});
        const rows=await sbreq('/rest/v1/conversations',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:u.id,astrologer_id:aid,admin_id:null,status:'requested',channel,requested_at:new Date().toISOString(),fee_snapshot:Number(a.fee||0),discount_snapshot:Number(a.discount||0)})});
        return json(res,201,{conversation:await decorate(rows[0])});
      }
      // No astrologerId means a direct support chat with an admin.
      const admins=await sbreq('/rest/v1/profiles?role=eq.admin&select=id,full_name,avatar_url,role&limit=1');
      const admin=admins[0]; if(!admin)return json(res,503,{error:'No admin support account is available'});
      const old=await sbreq(`/rest/v1/conversations?user_id=eq.${esc(u.id)}&admin_id=eq.${esc(admin.id)}&channel=eq.support&status=eq.accepted&select=*&order=created_at.desc&limit=1`);
      if(old[0])return json(res,200,{conversation:await decorate(old[0]),existing:true});
      const rows=await sbreq('/rest/v1/conversations',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:u.id,astrologer_id:null,admin_id:admin.id,status:'accepted',channel:'support',requested_at:new Date().toISOString(),accepted_at:new Date().toISOString()})});
      return json(res,201,{conversation:await decorate(rows[0]),existing:false});
    }

    const id=String(b.conversationId||b.conversation_id||'').trim();
    if(!id)return json(res,400,{error:'conversationId required'});
    const c=await getConv(id); if(!participant(u,p,c))return json(res,403,{error:'Forbidden'});

    if(action==='admin-accept'){
      if(p?.role!=='admin')return json(res,403,{error:'Admin only'});
      const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'accepted',accepted_at:new Date().toISOString(),admin_id:u.id})});
      return json(res,200,{conversation:await decorate(rows[0])});
    }
    if(action==='close'){
      const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'closed',closed_at:new Date().toISOString()})});
      return json(res,200,{conversation:await decorate(rows[0])});
    }
    return json(res,400,{error:'Unknown action'});
  }
  return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
