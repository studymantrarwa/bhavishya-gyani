const {authUser,req:sbreq,json,profile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
const isSchemaMismatch=e=>/could not find the ['\"]?(?:amount|preferred_date|preferred_time|user_name|notes|astrologer_note|admin_note)['\"]? column|column .* does not exist|schema cache/i.test(String(e?.message||e));
const normalizeBooking=b=>({
 ...b,
 preferred_date:b.preferred_date??b.booking_date??'',
 preferred_time:b.preferred_time??b.booking_time??'',
 amount:b.amount??b.price??0,
 notes:b.notes??b.note??'',
 pooja_name:b.pooja_name??'',
 status:b.status==='accepted'?'confirmed':b.status
});
async function astroGuard(req,res){const u=await authUser(req);if(!u||u.account_type!=='astrologer'){json(res,403,{error:'Astrologer only'});return null}return u}
async function userGuard(req,res){const u=await authUser(req);if(!u||u.account_type!=='user'){json(res,403,{error:'User only'});return null}return u}
async function blobImage(data,id){if(!data)return null;if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('Vercel Blob token is not configured. Add BLOB_READ_WRITE_TOKEN in Vercel Environment Variables.');const m=String(data).match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);if(!m)throw new Error('Invalid pooja image. Use JPG, PNG or WebP.');if(Buffer.byteLength(m[2],'base64')>3*1024*1024)throw new Error('Pooja image must be 3 MB or smaller.');const {put}=require('@vercel/blob');const ext=m[1].includes('png')?'png':m[1].includes('webp')?'webp':'jpg';const out=await put(`poojas/${id}.${ext}`,Buffer.from(m[2],'base64'),{access:'public',token:process.env.BLOB_READ_WRITE_TOKEN,contentType:m[1]==='image/jpg'?'image/jpeg':m[1]});return out.url}
module.exports=async(req,res)=>{try{
 if(req.method==='GET'){
  const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});
  if(u.account_type==='astrologer'){
   if(String(req.query?.bookings||'')==='1'){const rows=await sbreq(`/rest/v1/pooja_bookings?astrologer_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=500`);return json(res,200,{bookings:rows.map(normalizeBooking)});}
   const rows=await sbreq(`/rest/v1/poojas?astrologer_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=200`);return json(res,200,{poojas:rows});
  }
  if(u.account_type==='user'){
   if(String(req.query?.bookings||'')==='1'){const rows=await sbreq(`/rest/v1/pooja_bookings?user_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=500`);return json(res,200,{bookings:rows.map(normalizeBooking)});}
   const rows=await sbreq('/rest/v1/poojas?active=eq.true&select=*&order=created_at.desc&limit=200');
   const ids=[...new Set(rows.map(x=>x.astrologer_id).filter(Boolean))];
   const astros=ids.length?await sbreq(`/rest/v1/astrologer_accounts?id=in.(${ids.map(esc).join(',')})&select=id,full_name`):[];const map=new Map(astros.map(a=>[String(a.id),a]));
   return json(res,200,{poojas:rows.map(p=>({...p,astrologer:map.get(String(p.astrologer_id))||null}))});
  }
  return json(res,403,{error:'Unsupported account'});
 }
 if(req.method==='POST'){
  const b=req.body||{};
  if(b.action==='book'){
   const u=await userGuard(req,res);if(!u)return;const id=String(b.poojaId||'');if(!id)return json(res,400,{error:'poojaId required'});
   const p=(await sbreq(`/rest/v1/poojas?id=eq.${esc(id)}&active=eq.true&select=*&limit=1`))[0];if(!p)return json(res,404,{error:'Pooja is not available'});
   const me=await profile(u.id,'user');const row={user_id:u.id,astrologer_id:p.astrologer_id,pooja_id:p.id,user_name:String(me?.full_name||''),phone:String(me?.phone||''),preferred_date:String(b.preferredDate||''),preferred_time:String(b.preferredTime||''),notes:String(b.notes||''),amount:Number(p.price||0),status:'pending'};
   if(!row.preferred_date||!row.preferred_time)return json(res,400,{error:'Preferred date and time are required'});
   try{
    const rows=await sbreq('/rest/v1/pooja_bookings',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
    return json(res,201,{booking:normalizeBooking(rows[0]||row)});
   }catch(e){
    if(!isSchemaMismatch(e))throw e;
    // Older pooja_bookings schema used pooja_name/price/booking_date/booking_time/note/status=accepted.
    const legacy={user_id:u.id,astrologer_id:p.astrologer_id,pooja_id:p.id,pooja_name:String(p.name||''),price:Number(p.price||0),booking_date:row.preferred_date,booking_time:row.preferred_time,note:row.notes,status:'pending'};
    const rows=await sbreq('/rest/v1/pooja_bookings',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(legacy)});
    return json(res,201,{booking:normalizeBooking(rows[0]||legacy),compatibility:'legacy-pooja-schema'});
   }
  }
  const u=await astroGuard(req,res);if(!u)return;
  if(b.action==='create'||b.action==='update'){
   const id=String(b.id||'').trim();
   if(b.action==='create'){
    const name=String(b.name||'').trim();if(!name)return json(res,400,{error:'Pooja name is required'});
    const base={astrologer_id:u.id,name,description:String(b.description||'').trim(),price:Math.max(0,Number(b.price)||0),active:b.active!==false};
    if(b.image_data)base.image_url=await blobImage(b.image_data,`${u.id}-${Date.now()}`);
    const rows=await sbreq('/rest/v1/poojas',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(base)});return json(res,201,{pooja:rows[0]||base});
   }
   if(!id)return json(res,400,{error:'Pooja id required'});const own=(await sbreq(`/rest/v1/poojas?id=eq.${esc(id)}&astrologer_id=eq.${esc(u.id)}&select=id&limit=1`))[0];if(!own)return json(res,404,{error:'Pooja not found'});
   const patch={};if('name'in b)patch.name=String(b.name||'').trim();if('description'in b)patch.description=String(b.description||'').trim();if('price'in b)patch.price=Math.max(0,Number(b.price)||0);if('active'in b)patch.active=!!b.active;if(b.image_data)patch.image_url=await blobImage(b.image_data,id);patch.updated_at=new Date().toISOString();
   const rows=await sbreq(`/rest/v1/poojas?id=eq.${esc(id)}&astrologer_id=eq.${esc(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});return json(res,200,{pooja:rows[0]||null});
  }
  if(b.action==='booking'){
   const u=await astroGuard(req,res);if(!u)return;const id=String(b.bookingId||'');if(!id)return json(res,400,{error:'bookingId required'});
   const status=String(b.status||'');if(!['pending','confirmed','rejected','completed','cancelled'].includes(status))return json(res,400,{error:'Invalid booking status'});
   try{
    const rows=await sbreq(`/rest/v1/pooja_bookings?id=eq.${esc(id)}&astrologer_id=eq.${esc(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status,astrologer_note:String(b.note||''),updated_at:new Date().toISOString()})});return json(res,200,{booking:normalizeBooking(rows[0]||null)});
   }catch(e){
    if(!isSchemaMismatch(e) && !/check constraint|violates.*constraint|invalid input value/i.test(String(e?.message||e)))throw e;
    const legacyStatus=status==='confirmed'?'accepted':status;
    const rows=await sbreq(`/rest/v1/pooja_bookings?id=eq.${esc(id)}&astrologer_id=eq.${esc(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:legacyStatus,updated_at:new Date().toISOString()})});return json(res,200,{booking:normalizeBooking(rows[0]||null),compatibility:'legacy-pooja-schema'});
   }
  }

  if(b.action==='delete'){const id=String(b.id||'');if(!id)return json(res,400,{error:'Pooja id required'});const rows=await sbreq(`/rest/v1/poojas?id=eq.${esc(id)}&astrologer_id=eq.${esc(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({active:false,updated_at:new Date().toISOString()})});return json(res,200,{pooja:rows[0]||null});}
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message||'Pooja request failed'})}};
