const crypto=require('crypto');
const {authUser,req:sbreq,json,ensureProfile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
function topicFor(id){const secret=process.env.APP_AUTH_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||'change-this-secret';return 'bg-chat:'+crypto.createHmac('sha256',secret).update('conversation:'+String(id)).digest('hex').slice(0,48)}
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});
 const p=await ensureProfile(u);if(p?.blocked)return json(res,403,{error:'Account blocked'});
 const id=String(req.query?.conversation_id||req.body?.conversationId||'').trim();if(!id)return json(res,400,{error:'conversation_id required'});
 const c=(await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}&select=id,user_id,astrologer_id,admin_id,status,channel`))[0];
 const allowed=c&&(c.user_id===u.id||c.astrologer_id===u.id||c.admin_id===u.id||p?.role==='admin');
 if(!allowed)return json(res,403,{error:'Forbidden'});
 return json(res,200,{topic:topicFor(id),private:false,readOnly:p?.role==='admin',participant:p?.role!=='admin'});
}catch(e){return json(res,500,{error:e.message})}};
module.exports.topicFor=topicFor;
