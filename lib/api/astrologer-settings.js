const {authUser,req:sbreq,json,profile}=require("./_lib");
module.exports=async(req,res)=>{
 try{
  const u=await authUser(req);if(!u)return json(res,401,{error:"Login required"});
  const p=await profile(u.id);if(p?.role!=="astrologer")return json(res,403,{error:"Astrologer only"});
  const b=req.body||{};if(req.method!=="POST"&&req.method!=="PATCH")return json(res,405,{error:"Method not allowed"});
  const now=new Date().toISOString();
  if(b.action==='heartbeat'){
    const rows=await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({online:true,last_seen:now})});
    return json(res,200,{ok:true,online:true,last_seen:rows[0]?.last_seen||now});
  }
  const current=(await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(u.id)}&select=online`))[0]||{};
  const patch={};
  if(b.fee!=null)patch.fee=Math.max(0,Number(b.fee)||0);
  if(b.discount!=null)patch.discount=Math.max(0,Math.min(100,Number(b.discount)||0));
  if(b.online!=null){patch.online=!!b.online;patch.last_seen=b.online?now:null}
  if(b.chat_enabled!=null)patch.chat_enabled=!!b.chat_enabled;
  if(b.call_enabled!=null)patch.call_enabled=!!b.call_enabled;
  if(b.video_enabled!=null)patch.video_enabled=!!b.video_enabled;
  const rows=await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
  const becameOnline=b.online===true && !current.online;
  if(becameOnline){
    try{
      const follows=await sbreq(`/rest/v1/astrologer_follows?astrologer_id=eq.${encodeURIComponent(u.id)}&select=user_id`);
      const title=`${p.full_name||'Astrologer'} is Online`;
      const body='Your followed astrologer is now online and available for consultation.';
      if(follows.length)await sbreq('/rest/v1/notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(follows.map(x=>({user_id:x.user_id,title,body})))});
    }catch(_e){}
  }
  return json(res,200,{ok:true,astrologer:rows[0]||null,...patch,notification_sent:becameOnline});
 }catch(e){return json(res,500,{error:e.message})}
};
