const {cfg,req:sbreq,json}=require("./_lib");
module.exports=async(req,res)=>{
 if(req.method!=="POST") return json(res,405,{error:"Method not allowed"});
 try{
  const b=req.body||{},c=cfg();
  if(!c.url||!c.anon) return json(res,500,{error:"Supabase is not configured"});
  const r=await fetch(c.url+"/auth/v1/signup",{method:"POST",headers:{"Content-Type":"application/json",apikey:c.anon},body:JSON.stringify({email:b.email,password:b.password,data:{full_name:b.name||"",requested_role:b.role==="astrologer"?"astrologer":"user"}})});
  const d=await r.json(); if(!r.ok) return json(res,400,{error:d.msg||d.message||"Signup failed"});
  if(d.user){
   try{await sbreq("/rest/v1/profiles",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({id:d.user.id,full_name:b.name||"",role:"user"})})}catch(e){}
  }
  json(res,201,{token:d.access_token||null,session:d.session||null,user:{id:d.user?.id,email:d.user?.email,name:b.name||"",role:"user"}});
 }catch(e){json(res,500,{error:e.message})}
}
