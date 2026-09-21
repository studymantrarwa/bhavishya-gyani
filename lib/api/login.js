const {json,credential,profile}=require('./_lib');
const {verifyPassword,createSession}=require('../security');
module.exports=async(req,res)=>{
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  try{
    const b=req.body||{};const type=String(b.account_type||b.role||'user').toLowerCase();
    if(!['user','astrologer','admin'].includes(type))return json(res,400,{error:'Invalid account type'});
    const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
    const c=await credential(type,email);
    if(!c||!verifyPassword(password,c))return json(res,401,{error:'Invalid email or password'});
    const p=await profile(c.id);if(!p)return json(res,401,{error:'Account profile not found'});
    if(p.blocked)return json(res,403,{error:'Account blocked'});
    if(type==='astrologer'){
      const a=(await require('./_lib').req(`/rest/v1/astrologers?id=eq.${encodeURIComponent(c.id)}&select=verified&limit=1`))[0];
      if(!a?.verified)return json(res,403,{error:'Astrologer account is awaiting Admin approval'});
    }
    const token=createSession(p.id,p.email,type);
    return json(res,200,{token,user:{id:p.id,email:p.email,name:p.full_name||'',role:type,phone:p.phone||null,avatar_url:p.avatar_url||null}});
  }catch(e){return json(res,500,{error:e.message||'Login failed'})}
};
