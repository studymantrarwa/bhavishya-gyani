const {cfg,req:sbreq,json}=require('./_lib');
function clean(v){return String(v||'').trim()}
function list(v){if(Array.isArray(v))return v.map(clean).filter(Boolean).slice(0,30);return clean(v).split(',').map(clean).filter(Boolean).slice(0,30)}
function dataUrl(v){const m=String(v||'').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);return m?{mime:m[1]==='image/jpg'?'image/jpeg':m[1],base64:m[2]}:null}
async function authAdmin(c,email,password,meta){
 const r=await fetch(c.url+'/auth/v1/admin/users',{method:'POST',headers:{'Content-Type':'application/json',apikey:c.service,Authorization:'Bearer '+c.service},body:JSON.stringify({email,password,email_confirm:true,user_metadata:meta})});
 const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}
 if(!r.ok)throw new Error(d?.message||d?.msg||d?.error_description||'Could not create account');
 return d.user;
}
async function uploadPhoto(c,userId,photo){
 const parsed=dataUrl(photo); if(!parsed)return null;
 const ext=parsed.mime==='image/png'?'png':parsed.mime==='image/webp'?'webp':'jpg';
 const path=`${userId}/${Date.now()}.${ext}`; const bytes=Buffer.from(parsed.base64,'base64');
 if(bytes.length>350000)throw new Error('Photo must be compressed below 350 KB');
 const r=await fetch(c.url+'/storage/v1/object/astrologer-photos/'+path,{method:'POST',headers:{'Content-Type':parsed.mime,apikey:c.service,Authorization:'Bearer '+c.service,'x-upsert':'true'},body:bytes});
 if(!r.ok){const t=await r.text();throw new Error('Photo upload failed: '+t.slice(0,180))}
 return c.url+'/storage/v1/object/public/astrologer-photos/'+path;
}
module.exports=async(req,res)=>{try{
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 const b=req.body||{},name=clean(b.name),phone=clean(b.phone),email=clean(b.email).toLowerCase(),password=String(b.password||'');
 const experience=Math.max(0,Math.min(80,parseInt(b.experience_years||0,10)||0));
 const education=clean(b.education).slice(0,500); const bio=clean(b.bio).slice(0,3000); const expertise=list(b.expertise); const languages=list(b.languages); const fee=Math.max(0,Number(b.requested_fee)||0);
 if(!name)return json(res,400,{error:'Name is required'}); if(!/^\d{10}$/.test(phone.replace(/\D/g,'')))return json(res,400,{error:'Valid 10 digit mobile number is required'}); if(!/^\S+@\S+\.\S+$/.test(email))return json(res,400,{error:'Valid email is required'}); if(password.length<6)return json(res,400,{error:'Password must be at least 6 characters'}); if(!education)return json(res,400,{error:'Education / Qualification is required'}); if(!bio)return json(res,400,{error:'About / Bio is required'}); if(!expertise.length)return json(res,400,{error:'At least one astrology expertise is required'});
 const c=cfg(); if(!c.url||!c.service)return json(res,500,{error:'Supabase server environment variables are missing'});
 const user=await authAdmin(c,email,password,{full_name:name,phone,account_type:'astrologer'});
 const id=user.id;
 let avatar=null,photoWarning=null;
 try{if(b.photo_data_url)avatar=await uploadPhoto(c,id,b.photo_data_url)}catch(e){photoWarning=e.message}
 await sbreq('/rest/v1/profiles',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id,full_name:name,email,phone,avatar_url:avatar,role:'user',updated_at:new Date().toISOString()})});
 const appRows=await sbreq('/rest/v1/astrologer_applications',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:id,education,bio,experience_years:experience,expertise,languages,requested_fee:fee,avatar_url:avatar,status:'pending',updated_at:new Date().toISOString()})});
 return json(res,201,{ok:true,message:'Registration successful. Admin approval is required before your profile becomes visible.',application:appRows[0]||null,photo_warning:photoWarning,login_email:email});
}catch(e){return json(res,400,{error:e.message||'Astrologer registration failed'})}};
