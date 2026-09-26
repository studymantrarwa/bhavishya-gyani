const {authUser,req:sbreq,json,profile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
const WAIT=120000, RET=172800000, now=()=>Date.now();
const recipientStatus=p=>p?.role==='user'?'call_requested_astrologer':'call_requested_user';
async function get(id){return (await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}&select=*`))[0]||null}
async function expire(c){
 if(!c)return c;
 if(['call_requested_user','call_requested_astrologer'].includes(c.status)&&now()-new Date(c.requested_at||c.created_at).getTime()>WAIT){
  const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(c.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'missed',missed_by:c.status==='call_requested_user'?'astrologer':'user',retention_until:new Date(now()+RET).toISOString(),closed_at:new Date().toISOString()})});
  return rows[0]||{...c,status:'missed'};
 }
 return c;
}
async function decorate(c){
 if(!c)return null;
 const ids=[c.user_id,c.astrologer_id].filter(Boolean);
 const ps=ids.length?await sbreq(`/rest/v1/profiles?id=in.(${ids.map(esc).join(',')})&select=id,full_name,avatar_url,role`):[];
 const find=id=>id?ps.find(x=>x.id===id)||null:null;
 return {...c,user:find(c.user_id),astrologer:find(c.astrologer_id)};
}
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});
 const p=await profile(u.id,u.account_type);if(!p)return json(res,403,{error:'Profile not found'});if(!['user','astrologer'].includes(p.role))return json(res,403,{error:'User or Astrologer only'});if(p.blocked)return json(res,403,{error:'Account blocked'});
 if(req.method==='GET'){
  const st=recipientStatus(p), col=p.role==='user'?'user_id':'astrologer_id';
  let rows=await sbreq(`/rest/v1/conversations?${col}=eq.${esc(u.id)}&channel=eq.call&status=eq.${esc(st)}&select=*&order=requested_at.asc&limit=20`);
  rows=await Promise.all(rows.map(expire));rows=rows.filter(x=>x.status===st);
  return json(res,200,{requests:await Promise.all(rows.map(decorate))});
 }
 if(req.method==='POST'){
  const b=req.body||{},id=String(b.conversationId||'').trim();if(!id)return json(res,400,{error:'conversationId required'});
  let c=await get(id);if(!c||c.channel!=='call')return json(res,404,{error:'Call not found'});
  const expected=recipientStatus(p);
  if((p.role==='user'&&c.user_id!==u.id)||(p.role==='astrologer'&&c.astrologer_id!==u.id))return json(res,403,{error:'Not the call recipient'});
  c=await expire(c);if(c.status!==expected)return json(res,409,{error:'Call request is no longer pending'});
  if(b.action==='reject'){
   const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'call_rejected',closed_at:new Date().toISOString(),retention_until:new Date(now()+RET).toISOString()})});
   return json(res,200,{conversation:await decorate(rows[0])});
  }
  if(b.action==='accept'){
   const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'call_accepted',accepted_at:new Date().toISOString()})});
   return json(res,200,{conversation:await decorate(rows[0])});
  }
  return json(res,400,{error:'Unknown action'});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
