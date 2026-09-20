const {cfg,req:sbreq,json,profile}=require("./_lib");
module.exports=async(req,res)=>{
 if(req.method!=="POST") return json(res,405,{error:"Method not allowed"});
 try{
  const b=req.body||{},c=cfg(); if(!c.url||!c.anon)return json(res,500,{error:"Supabase is not configured"});
  const r=await fetch(c.url+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json",apikey:c.anon},body:JSON.stringify({email:b.email,password:b.password})});
  const d=await r.json();if(!r.ok)return json(res,401,{error:d.msg||d.message||"Invalid login"});
  const p=await profile(d.user.id);
  json(res,200,{token:d.access_token,session:d.session||null,user:{id:d.user.id,email:d.user.email,name:p?.full_name||"",role:p?.role||"user"}});
 }catch(e){json(res,500,{error:e.message})}
}
