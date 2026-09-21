const {authUser,req:sbreq,json,profile}=require('./_lib');
module.exports=async(req,res)=>{try{
 const u=await authUser(req); if(!u)return json(res,401,{error:'Login required'});
 if(req.method==='GET'){
  const rows=await sbreq(`/rest/v1/astrologer_applications?user_id=eq.${encodeURIComponent(u.id)}&select=*`);
  return json(res,200,{application:rows[0]||null});
 }
 if(req.method==='POST'){
  const p=await profile(u.id); if(p?.role==='admin')return json(res,400,{error:'Admin account cannot apply as astrologer'});
  const b=req.body||{};
  const row={user_id:u.id,bio:String(b.bio||''),experience_years:Math.max(0,parseInt(b.experience_years||0,10)||0),expertise:Array.isArray(b.expertise)?b.expertise:[],languages:Array.isArray(b.languages)?b.languages:[],requested_fee:Math.max(0,Number(b.requested_fee)||0),status:'pending',updated_at:new Date().toISOString()};
  const rows=await sbreq('/rest/v1/astrologer_applications',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
  return json(res,200,{application:rows[0]});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
