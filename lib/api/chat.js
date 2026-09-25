const {authUser,req:sbreq,json,ensureProfile}=require('./_lib');
const {wallet,chargeConversation,applyActiveChatOffers,userFree}=require('./finance');
const esc=v=>encodeURIComponent(String(v));
const ACTIVE=['requested','astrologer_accepted','accepted'];
const HISTORY=['closed','missed','rejected'];
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
 if(c.status==='requested'&&now()-new Date(c.requested_at||c.created_at).getTime()>120000){
  const r=await sbreq(`/rest/v1/conversations?id=eq.${esc(c.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'missed',missed_by:'astrologer',retention_until:new Date(now()+172800000).toISOString()})});
  return r[0]||{...c,status:'missed',missed_by:'astrologer'};
 }
 if(c.status==='astrologer_accepted'&&c.user_confirm_deadline&&now()>new Date(c.user_confirm_deadline).getTime()){
  const r=await sbreq(`/rest/v1/conversations?id=eq.${esc(c.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'missed',missed_by:'user',retention_until:new Date(now()+172800000).toISOString()})});
  return r[0]||{...c,status:'missed',missed_by:'user'};
 }
 return c;
}
async function listFor(u,p){
 let q;
 if(p?.role==='admin') q='/rest/v1/conversations?select=*&order=last_message_at.desc.nullslast,created_at.desc&limit=1000';
 else q=`/rest/v1/conversations?or=(user_id.eq.${esc(u.id)},astrologer_id.eq.${esc(u.id)},admin_id.eq.${esc(u.id)})&channel=in.(chat,support)&select=*&order=last_message_at.desc.nullslast,created_at.desc&limit=500`;
 let rows=await sbreq(q); rows=await Promise.all(rows.map(expire));
 // User history is permanent. Astrologer history is intentionally limited to 48h after end.
 if(p?.role==='astrologer'){
  const cutoff=now()-172800000;
  rows=rows.filter(c=>ACTIVE.includes(c.status)||new Date(c.closed_at||c.last_message_at||c.created_at||0).getTime()>=cutoff);
 }
 return rows;
}
async function kundliForUser(kid,userId){
 if(!kid)return null;
 const k=(await sbreq(`/rest/v1/kundalis?id=eq.${esc(kid)}&select=id,user_id,name,dob,birth_time,place,gender,latitude,longitude,timezone,calculation_data`))[0]||null;
 if(!k||k.user_id!==userId)return null;
 return k;
}
async function savePrechat(c,k,u){
 if(!c||!k)return null;
 const body=`__BG_CHAT_INTAKE__\nनाम: ${k.name||''}\nजन्म तारीख: ${k.dob||''}\nजन्म समय: ${k.birth_time||''}\nजन्म स्थान: ${k.place||''}`;
 const rows=await sbreq('/rest/v1/messages',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({conversation_id:c.id,sender_id:u.id,body,kundali_id:k.id})});
 return rows[0]||null;
}
function prechatData(rows){
 const m=(rows||[]).slice().reverse().find(x=>String(x.body||'').startsWith('__BG_CHAT_INTAKE__'));
 if(!m)return null;
 const lines=String(m.body).split('\n'),o={kundali_id:m.kundali_id||null};
 for(const line of lines.slice(1)){const i=line.indexOf(':');if(i<0)continue;const k=line.slice(0,i).trim(),v=line.slice(i+1).trim();if(k==='नाम')o.name=v;if(k==='जन्म तारीख')o.dob=v;if(k==='जन्म समय')o.birth_time=v;if(k==='जन्म स्थान')o.place=v;}
 return o;
}
async function messagesFor(id){const rows=await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&select=*&order=created_at.asc&limit=5000`);return rows.filter(m=>!String(m.body||'').startsWith('__BG_CALL_SIGNAL__'))}
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});
 const p=await ensureProfile(u);if(p?.blocked)return json(res,403,{error:'Account blocked'});
 if(req.method==='GET'){
  const id=String(req.query?.conversation_id||req.query?.id||'').trim();
  if(id){
   const c=await expire(await getConv(id));if(!allowed(u,p,c))return json(res,403,{error:'Forbidden'});
   const all=await messagesFor(id);const accepted=HISTORY.includes(c.status)||c.status==='accepted';
   return json(res,200,{conversation:await decorate(c),messages:accepted?all:[],prechat:prechatData(all)});
  }
  const rows=await listFor(u,p);return json(res,200,{conversations:await Promise.all(rows.map(decorate))});
 }
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const b=req.body||{},action=String(b.action||'request');
 if(action==='request'||action==='call'){
  const aid=String(b.astrologerId||'').trim();
  // Chat requests keep the existing flow untouched.
  if(action==='request'){
   if(p?.role!=='user')return json(res,403,{error:'Only user accounts can start a new request'});
   if(aid){
    const a=(await sbreq(`/rest/v1/astrologers?id=eq.${esc(aid)}&select=*`))[0];
    if(!a||!a.verified)return json(res,409,{error:'Astrologer is not approved'});
    const fresh=a.last_seen&&((Date.now()-new Date(a.last_seen).getTime())<=75000);if(!a.online||!fresh)return json(res,409,{error:'Astrologer is offline'});
    const rate=Math.max(0,Number(a.fee_per_minute??a.fee??0));
    if(rate>0){
      await applyActiveChatOffers(u.id);
      const free=await userFree(u.id); const w=await wallet(u.id); const freeMinutes=Number(free.free_chat_minutes||0); const balance=Number(w.balance||0);
      if(freeMinutes<1&&balance<rate)return json(res,402,{error:`Free chat minutes खत्म हैं। कम से कम ₹${rate.toFixed(2)} wallet में होना चाहिए।`,free_minutes:freeMinutes,balance});
    }
    if(a.chat_enabled===false)return json(res,409,{error:'Astrologer chat is OFF'});
    let kundli=null;const kid=String(b.kundliId||'').trim();if(kid){kundli=await kundliForUser(kid,u.id);if(!kundli)return json(res,403,{error:'Selected Kundli does not belong to this account'});}
    const oldRows=await sbreq(`/rest/v1/conversations?user_id=eq.${esc(u.id)}&astrologer_id=eq.${esc(aid)}&channel=eq.chat&select=*&order=created_at.desc&limit=1`);
    const old=oldRows[0]||null;
    if(old&&ACTIVE.includes(old.status))return json(res,200,{conversation:await decorate(old),existing:true});
    if(old&&HISTORY.includes(old.status)){
     const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(old.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'requested',requested_at:new Date().toISOString(),astrologer_accepted_at:null,user_confirm_deadline:null,user_confirmed_at:null,accepted_at:null,closed_at:null,missed_by:null,astrologer_response_seconds:null,user_confirm_response_seconds:null,retention_until:null,last_message_at:old.last_message_at||null})});
     const c=rows[0]||{...old,status:'requested'};if(kundli)await savePrechat(c,kundli,u);return json(res,200,{conversation:await decorate(c),reopened:true});
    }
    const body={user_id:u.id,astrologer_id:aid,admin_id:null,status:'requested',channel:'chat',requested_at:new Date().toISOString(),fee_snapshot:Number(a.fee_per_minute??a.fee??0),discount_snapshot:Number(a.discount||0)};
    const rows=await sbreq('/rest/v1/conversations',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});return json(res,201,{conversation:await decorate(rows[0])});
   }
   const admins=await sbreq('/rest/v1/profiles?role=eq.admin&select=id,full_name,avatar_url,role&limit=1');const admin=admins[0];if(!admin)return json(res,503,{error:'No admin support account is available'});
   const old=await sbreq(`/rest/v1/conversations?user_id=eq.${esc(u.id)}&admin_id=eq.${esc(admin.id)}&channel=eq.support&status=eq.accepted&select=*&order=created_at.desc&limit=1`);if(old[0])return json(res,200,{conversation:await decorate(old[0]),existing:true});
   const rows=await sbreq('/rest/v1/conversations',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:u.id,astrologer_id:null,admin_id:admin.id,status:'accepted',channel:'support',requested_at:new Date().toISOString(),accepted_at:new Date().toISOString()})});return json(res,201,{conversation:await decorate(rows[0])});
  }

  // Voice call request. A call is always started from an already active chat
  // so neither side can use the call system to contact arbitrary accounts.
  const sourceId=String(b.sourceConversationId||b.conversationId||'').trim();
  if(!sourceId)return json(res,400,{error:'Active chat conversationId is required to start a call'});
  const source=await getConv(sourceId);
  if(!source||source.channel!=='chat'||source.status!=='accepted')return json(res,409,{error:'Call can be started only from an active chat'});
  if(source.user_id!==u.id&&source.astrologer_id!==u.id)return json(res,403,{error:'You are not a participant of this chat'});
  const pairUser=source.user_id,pairAstro=source.astrologer_id;
  if(!pairAstro)return json(res,409,{error:'Astrologer is not available for this call'});
  if(p?.role==='user'){
   const a=(await sbreq(`/rest/v1/astrologers?id=eq.${esc(pairAstro)}&select=*`))[0];
   if(!a||!a.verified)return json(res,409,{error:'Astrologer is not approved'});
   const fresh=a.last_seen&&((Date.now()-new Date(a.last_seen).getTime())<=75000);if(!a.online||!fresh)return json(res,409,{error:'Astrologer is offline'});
   if(a.call_enabled===false)return json(res,409,{error:'Astrologer call is OFF'});
  }else if(p?.role!=='astrologer'||u.id!==pairAstro)return json(res,403,{error:'Only the chat user or astrologer can start this call'});
  const existing=await sbreq(`/rest/v1/conversations?user_id=eq.${esc(pairUser)}&astrologer_id=eq.${esc(pairAstro)}&channel=eq.call&select=*&order=created_at.desc&limit=1`);
  const old=existing[0]||null;
  const activeCallStatuses=['call_requested_user','call_requested_astrologer','call_accepted'];
  const requestedStatus=p?.role==='user'?'call_requested_user':'call_requested_astrologer';
  if(old&&activeCallStatuses.includes(old.status))return json(res,200,{conversation:await decorate(old),existing:true});
  const common={user_id:pairUser,astrologer_id:pairAstro,admin_id:null,status:requestedStatus,channel:'call',requested_at:new Date().toISOString(),astrologer_accepted_at:null,user_confirm_deadline:null,user_confirmed_at:null,accepted_at:null,closed_at:null,missed_by:null,retention_until:null};
  let c;
  if(old){
   const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(old.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(common)});
   c=rows[0]||{...old,...common};
  }else{
   const rows=await sbreq('/rest/v1/conversations',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(common)});
   c=rows[0];
  }
  return json(res,201,{conversation:await decorate(c)});
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
 if(action==='close'){
  if(!['user','astrologer','admin'].includes(p?.role))return json(res,403,{error:'Not allowed'});
  const closedAt=new Date().toISOString();
  const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'closed',closed_at:closedAt,retention_until:p?.role==='user'?null:new Date(now()+172800000).toISOString()})});
  const updated=rows[0]||{...c,status:'closed',closed_at:closedAt};
  if(updated.channel==='chat'&&updated.accepted_at&&updated.astrologer_id){const bill=await chargeConversation(updated);if(bill.insufficient)return json(res,402,{error:`Chat charge ₹${bill.required.toFixed(2)} के लिए wallet balance ₹${bill.balance.toFixed(2)} है। पहले wallet recharge करें।`,billing:bill});return json(res,200,{conversation:await decorate(updated),billing:bill});}
  return json(res,200,{conversation:await decorate(updated)});
 }
 return json(res,400,{error:'Unknown action'});
}catch(e){return json(res,500,{error:e.message})}};
