const {authUser,req:sbreq,json,profile,cfg}=require('./_lib');

function clean(v,max=500){return String(v??'').trim().slice(0,max)}
function parseImage(v){
  const m=String(v||'').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!m)return null;
  const mime=m[1]==='image/jpg'?'image/jpeg':m[1];
  const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
  const buf=Buffer.from(m[2],'base64');
  if(buf.length>700000)throw new Error('Profile photo must be under 700 KB');
  return {mime,ext,buf};
}
async function ensureBucket(c){
  const r=await fetch(c.url+'/storage/v1/bucket',{method:'POST',headers:{'Content-Type':'application/json',apikey:c.service,Authorization:'Bearer '+c.service},body:JSON.stringify({id:'profile-avatars',name:'profile-avatars',public:true,file_size_limit:700000,allowed_mime_types:['image/jpeg','image/png','image/webp']})});
  if(!r.ok && r.status!==409){const t=await r.text();throw new Error('Storage bucket setup failed: '+t.slice(0,160))}
}
async function uploadAvatar(c,userId,role,dataUrl){
  const p=parseImage(dataUrl); if(!p)return null;
  await ensureBucket(c);
  const path=`${role}/${userId}/profile.${p.ext}`;
  const r=await fetch(c.url+'/storage/v1/object/profile-avatars/'+path,{method:'POST',headers:{'Content-Type':p.mime,apikey:c.service,Authorization:'Bearer '+c.service,'x-upsert':'true'},body:p.buf});
  if(!r.ok){const t=await r.text();throw new Error('Profile photo upload failed: '+t.slice(0,180))}
  return c.url+'/storage/v1/object/public/profile-avatars/'+path+'?v='+Date.now();
}
async function roleRow(id,role){
  if(role==='astrologer')return (await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(id)}&select=*`))[0]||null;
  if(role==='admin')return (await sbreq(`/rest/v1/admin_profiles?id=eq.${encodeURIComponent(id)}&select=*`))[0]||null;
  return (await sbreq(`/rest/v1/user_profiles?id=eq.${encodeURIComponent(id)}&select=*`))[0]||null;
}
module.exports=async(req,res)=>{
  try{
    const u=await authUser(req); if(!u)return json(res,401,{error:'Login required'});
    const p=await profile(u.id); if(!p)return json(res,404,{error:'Profile not found'});
    const role=p.role;
    if(req.method==='GET'){
      let row=await roleRow(u.id,role);
      if(!row){
        if(role==='admin') row=(await sbreq('/rest/v1/admin_profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:u.id})}))[0]||null;
        else if(role==='user') row=(await sbreq('/rest/v1/user_profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:u.id})}))[0]||null;
      }
      return json(res,200,{profile:{...p,role_specific:row}});
    }
    if(req.method!=='PATCH')return json(res,405,{error:'Method not allowed'});
    const b=req.body||{}, patch={};
    if('full_name' in b)patch.full_name=clean(b.full_name,120);
    if('phone' in b)patch.phone=clean(b.phone,30);
    const c=cfg();
    if(b.avatar_data_url){
      if(!c.url||!c.service)throw new Error('Supabase server environment variables are missing');
      patch.avatar_url=await uploadAvatar(c,u.id,role,b.avatar_data_url);
    }
    const pr=(await sbreq(`/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:new Date().toISOString()})}))[0]||p;
    let rp={};
    if(role==='astrologer'){
      const allowed=['bio','education','experience_years','expertise','languages','fee','discount'];
      for(const k of allowed)if(k in b)rp[k]=k==='experience_years'?Math.max(0,Math.min(80,Number(b[k])||0)):k==='fee'||k==='discount'?Math.max(0,Number(b[k])||0):b[k];
      if(patch.avatar_url)rp.avatar_url=patch.avatar_url;
      if(Object.keys(rp).length){
        rp.id=u.id;
        const row=(await sbreq('/rest/v1/astrologers',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rp)}))[0]||null;
      }
    }else if(role==='admin'){
      const allowed=['bio','department'];
      for(const k of allowed)if(k in b)rp[k]=clean(b[k],1000);
      rp.id=u.id;
      await sbreq('/rest/v1/admin_profiles',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rp)});
    }else{
      const allowed=['gender','language','city','preferences'];
      for(const k of allowed)if(k in b)rp[k]=k==='preferences'?(b[k]||{}):clean(b[k],500);
      rp.id=u.id;
      await sbreq('/rest/v1/user_profiles',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rp)});
    }
    return json(res,200,{ok:true,profile:{...pr,role_specific:await roleRow(u.id,role)}});
  }catch(e){return json(res,500,{error:e.message||'Profile update failed'});}
};
