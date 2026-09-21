const {authUser,json,profile}=require("./_lib");
module.exports=async(req,res)=>{try{const u=await authUser(req);if(!u)return json(res,401,{error:"Login required"});const p=await profile(u.id);json(res,200,{user:{id:u.id,email:u.email,name:p?.full_name||"",role:p?.role||"user"}})}catch(e){json(res,500,{error:e.message})}};
