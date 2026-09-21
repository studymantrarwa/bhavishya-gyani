const {authUser,req:sbreq,json}=require("./_lib");
module.exports=async(req,res)=>{try{const u=await authUser(req);if(!u)return json(res,401,{error:"Login required"});const rows=await sbreq(`/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}&select=*`);json(res,200,{profile:rows[0]||null})}catch(e){json(res,500,{error:e.message})}};
