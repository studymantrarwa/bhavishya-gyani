const {cfg,req:sbreq,json,createAccount}=require('./_lib');
function clean(v){return String(v||'').trim()}
function list(v){if(Array.isArray(v))return v.map(clean).filter(Boolean).slice(0,30);return clean(v).split(',').map(clean).filter(Boolean).slice(0,30)}
async function uploadPhoto(photo){
  if(!photo)return null;
  const m=String(photo).match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);if(!m)throw new Error('Invalid profile image');
  const bytes=Buffer.from(m[2],'base64');if(bytes.length>350000)throw new Error('Photo must be compressed below 350 KB');
  const {put}=require('@vercel/blob');
  const ext=m[1].includes('png')?'png':m[1].includes('webp')?'webp':'jpg';
  const blob=await put(`astrologers/${Date.now()}-${require('crypto').randomUUID()}.${ext}`,bytes,{access:'public',contentType:m[1]==='image/jpg'?'image/jpeg':m[1]});
  return blob.url;
}
module.exports=async(req,res)=>{try{
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const b=req.body||{},name=clean(b.name),phone=clean(b.phone).replace(/\D/g,''),email=clean(b.email).toLowerCase(),password=String(b.password||'');
 const experience=Math.max(0,Math.min(80,parseInt(b.experience_years||0,10)||0));
 const education=clean(b.education).slice(0,500),bio=clean(b.bio).slice(0,3000),expertise=list(b.expertise),languages=list(b.languages),fee=Math.max(0,Number(b.requested_fee)||0);
 if(!name)return json(res,400,{error:'Name is required'});
 if(!/^\d{10}$/.test(phone))return json(res,400,{error:'Valid 10 digit mobile number is required'});
 if(!/^\S+@\S+\.\S+$/.test(email))return json(res,400,{error:'Valid email is required'});
 if(password.length<6)return json(res,400,{error:'Password must be at least 6 characters'});
 if(!education)return json(res,400,{error:'Education / Qualification is required'});
 if(!bio)return json(res,400,{error:'About / Bio is required'});
 if(!expertise.length)return json(res,400,{error:'At least one astrology expertise is required'});
 const avatar=await uploadPhoto(b.photo_data_url);
 const p=await createAccount({accountType:'astrologer',name,email,phone,password,avatar_url:avatar});
 const appRows=await sbreq('/rest/v1/astrologer_applications',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:p.id,education,bio,experience_years:experience,expertise,languages,requested_fee:fee,avatar_url:avatar,status:'pending',updated_at:new Date().toISOString()})});
 // Create the astrologer profile immediately, but keep it unverified until admin approval.
 await sbreq('/rest/v1/astrologers',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:p.id,bio,education,experience_years:experience,expertise,languages,fee,avatar_url:avatar,verified:false,online:false})});
 return json(res,201,{ok:true,message:'Registration successful. Admin approval is required before your profile becomes visible.',application:appRows[0]||null,login_email:email,photo_url:avatar});
}catch(e){return json(res,400,{error:e.message||'Astrologer registration failed'})}};
