const {authUser,req:sbreq,json,profile}=require('./_lib');
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});const p=await profile(u.id);if(p?.role!=='admin')return json(res,403,{error:'Admin only'});
 if(req.method==='GET'){
  const rows=await sbreq('/rest/v1/astrologer_applications?select=*,profile:profiles!astrologer_applications_user_id_fkey(id,full_name,email,phone)&order=created_at.desc');
  return json(res,200,{applications:rows});
 }
 const b=req.body||{};
 if(req.method==='POST' || req.method==='PATCH'){
  const userId=b.user_id||b.userId; if(!userId)return json(res,400,{error:'user_id required'});
  const status=b.status;
  if(!['approved','rejected'].includes(status))return json(res,400,{error:'status must be approved or rejected'});
  const apps=await sbreq(`/rest/v1/astrologer_applications?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  if(!apps[0])return json(res,404,{error:'Application not found'});
  if(status==='approved'){
   const a=apps[0];
   await sbreq(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({role:'astrologer',avatar_url:a.avatar_url||null,updated_at:new Date().toISOString()})});
   await sbreq('/rest/v1/astrologers',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id:userId,bio:a.bio,experience_years:a.experience_years,expertise:a.expertise,languages:a.languages,fee:a.requested_fee,discount:0,avatar_url:a.avatar_url||null,online:false,verified:true,approved_at:new Date().toISOString()})});
  }
  const rows=await sbreq(`/rest/v1/astrologer_applications?id=eq.${encodeURIComponent(apps[0].id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status,admin_note:String(b.admin_note||''),updated_at:new Date().toISOString()})});
  return json(res,200,{application:rows[0]||null});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){json(res,500,{error:e.message})}};
